/**
 * Durga Sarees - Automated Accounting Sync Script
 * ------------------------------------------------
 * Automatically reads live exported SQL JSON files from:
 * C:\xampp\htdocs\TRADING\js\VU5JUVVFU09GVFdBUkVTNTA0MTA=U09GVFdBUkVTVU5JUVVF\2627\json
 *
 * Compiles:
 * 1. www/accounting_customers.json (fast search index for all 11,000+ accounts with agent, transport, balance)
 * 2. www/accounting_reports.json (indexed customer reports: Ledger, Finish Sales, Transport LRs, Outstanding)
 *
 * Can be run manually or automatically via Windows Task Scheduler every 2 hours.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = 'C:/xampp/htdocs/TRADING/js/VU5JUVVFU09GVFdBUkVTNTA0MTA=U09GVFdBUkVTVU5JUVVF/2627/json/';
const WWW_DIR = path.join(__dirname, 'www');

async function syncAccountingData() {
    console.log('====================================================');
    console.log('🔄 Durga Sarees - Accounting Sync Started');
    console.log(`⏰ Time: ${new Date().toLocaleString('en-IN')}`);
    console.log('====================================================');

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
        process.exit(1);
    }

    console.log('📂 1. Reading source files from XAMPP...');
    const mst = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'MST.json'), 'utf8'));
    const acgroup = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'ACGROUP.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'LEDGER.json'), 'utf8'));
    const bls = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'BLS.json'), 'utf8'));
    const det = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'DET.json'), 'utf8'));
    const ost = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'OUTSTANDING.json'), 'utf8'));

    console.log('📞 2. Building phone & broker mappings...');
    const phoneMap = new Map();
    acgroup.forEach(g => {
        const code = String(g.code || '').trim().toUpperCase();
        if (code && g.MO) {
            let phone = String(g.MO).replace(/\D/g, '');
            if (phone.length > 10) phone = phone.slice(-10);
            if (phone.length === 10) phoneMap.set(code, phone);
        }
    });

    console.log('📦 3. Mapping DET item lines by IDE...');
    const detMap = new Map();
    det.forEach(d => {
        if (d.IDE && Array.isArray(d.billDetails)) {
            detMap.set(d.IDE, d.billDetails);
        }
    });

    console.log('📊 4. Compiling customer financial reports...');
    const reportsByParty = {};
    const transportByParty = new Map();
    const agentByParty = new Map();

    function getPartyReport(code) {
        const k = String(code || '').trim().toUpperCase();
        if (!reportsByParty[k]) {
            reportsByParty[k] = {
                ledger: [],
                salesItems: [],
                finishSales: [],
                transport: [],
                outstanding: []
            };
        }
        return reportsByParty[k];
    }

    // A. Ledger transactions
    ledger.forEach(l => {
        const code = String(l.code || '').trim();
        if (!code) return;
        const p = getPartyReport(code);
        const dr = parseFloat(l.DRAMT) || 0;
        const cr = parseFloat(l.CRAMT) || 0;
        p.ledger.push({
            d: l.DATE || '',
            v: l.DOCNO || l.BILLNO || l.VNO || '',
            t: l.TYPE || '',
            r: l.RFCODE || l.RMK || '',
            dr: dr,
            cr: cr
        });
    });

    // Calculate running ledger balances
    const ledgerBalances = new Map();
    Object.keys(reportsByParty).forEach(code => {
        const lList = reportsByParty[code].ledger;
        lList.sort((a, b) => (a.d || '').localeCompare(b.d || ''));
        let running = 0;
        lList.forEach(entry => {
            running += (entry.dr - entry.cr);
            entry.bal = Math.round(running * 100) / 100;
        });
        ledgerBalances.set(code, running);
    });

    // B. BLS (Transport & Sales Bills)
    bls.forEach(party => {
        const code = String(party.code || '').trim();
        if (!code) return;
        const p = getPartyReport(code);
        (party.billDetails || []).forEach(b => {
            const trnsp = String(b.TRNSP || '').trim();
            const lr = String(b.RRNO || '').trim();
            const plc = String(b.PLC || '').trim();
            const haste = String(b.HASTE || b.AGENT || '').trim();

            if (trnsp && !transportByParty.has(code.toUpperCase())) {
                transportByParty.set(code.toUpperCase(), trnsp);
            }
            if (haste && !agentByParty.has(code.toUpperCase())) {
                agentByParty.set(code.toUpperCase(), haste);
            }

            if (trnsp || lr || plc || b.FRT || b.PRCL) {
                p.transport.push({
                    b: b.BILL || b.VNO || '',
                    d: b.DATE || '',
                    t: trnsp,
                    lr: lr,
                    lrd: b.RRDET || '',
                    st: plc,
                    cs: b.PRCL || b.CSNO || '',
                    wt: b.WGT || '',
                    fr: b.FRT || '',
                    ewb: b.EWB || '',
                    amt: parseFloat(b.BAMT) || 0
                });
            }

            // Finish Sales record [DATE, BILLNO, PCS, MTS, RATE, AMOUNT, AGENT, ...]
            p.finishSales.push([
                b.DATE || '',
                b.BILL || b.VNO || '',
                parseInt(b.PCS) || 0,
                parseFloat(b.MTS) || 0,
                parseFloat(b.RATE) || 0,
                parseFloat(b.BAMT) || 0,
                haste || '',
                b.DISC || '',
                b.TAX || '',
                b.NET || b.BAMT || '',
                lr,
                plc,
                trnsp
            ]);

            // Item-wise fabric sales from DET
            const items = detMap.get(b.IDE) || [];
            items.forEach(it => {
                p.salesItems.push({
                    b: b.BILL || b.VNO || '',
                    d: b.DATE || '',
                    q: it.qual || it.altql || '',
                    c: it.CTGRY || '',
                    pcs: parseInt(it.PCS) || 0,
                    mts: parseFloat(it.MTS) || 0,
                    r: parseFloat(it.RATE) || 0,
                    a: parseFloat(it.AMT) || 0
                });
            });
        });
    });

    // C. Outstanding bills
    ost.forEach(party => {
        const code = String(party.code || '').trim();
        if (!code) return;
        const p = getPartyReport(code);
        (party.billDetails || []).forEach(b => {
            const pamt = parseFloat(b.PAMT) || 0;
            if (pamt > 0) {
                p.outstanding.push({
                    b: b.BILL || b.VNO || '',
                    d: b.DATE || '',
                    pcs: parseInt(b.PCS) || 0,
                    amt: parseFloat(b.FAMT || b.GRSAMT) || 0,
                    rec: parseFloat(b.RECAMT) || 0,
                    pamt: pamt
                });
            }
        });
    });

    console.log('👥 5. Compiling Master Customers List...');
    const customers = [];
    const seenCodes = new Set();

    mst.forEach(m => {
        if (m.ATYPE !== '1' && m.ATYPE !== '12') return; // Sundry Debtors (1) & Brokers / Agents (12)
        const isAgent = (m.ATYPE === '12');
        const code = String(m.partyname || m.value || '').trim();
        if (!code || seenCodes.has(code.toUpperCase())) return;
        seenCodes.add(code.toUpperCase());

        const k = code.toUpperCase();
        const rep = reportsByParty[k] || { ledger: [], salesItems: [], finishSales: [], transport: [], outstanding: [] };

        let bal = ledgerBalances.get(k);
        if (bal === undefined) {
            bal = 0;
            rep.outstanding.forEach(o => { bal += o.pamt; });
        }

        const absBal = Math.abs(bal || 0);
        const drCr = (bal < 0) ? 'Cr' : (bal > 0 ? 'Dr' : '');

        let phone = phoneMap.get(k) || '';
        if (!phone && (m.MO || m.PH1 || m.FX1)) {
            const raw = String(m.MO || m.PH1 || m.FX1).replace(/\D/g, '');
            if (raw.length >= 10) phone = raw.slice(-10);
        }

        customers.push({
            c: code,
            n: m.partyname || code,
            p: phone,
            ct: m.city || m.CITY || '',
            a: [m.AD1, m.AD2, m.AD3, m.AD4].filter(Boolean).map(s => String(s).trim()).join(', '),
            g: m.GST || '',
            b: Math.round(absBal),
            d: drCr,
            sb: Math.round(bal || 0),
            pb: rep.outstanding.length,
            tb: rep.transport.length,
            hl: rep.ledger.length > 0,
            hs: rep.salesItems.length > 0,
            ht: rep.transport.length > 0,
            ho: rep.outstanding.length > 0,
            tr: transportByParty.get(k) || '',
            ag: agentByParty.get(k) || '',
            role: isAgent ? 'agent' : 'customer',
            isAgent: isAgent
        });
    });

    // Also include active parties with reports not in ATYPE=1
    Object.keys(reportsByParty).forEach(k => {
        if (!seenCodes.has(k)) {
            seenCodes.add(k);
            const rep = reportsByParty[k];
            const bal = ledgerBalances.get(k) || 0;
            const absBal = Math.abs(bal);
            const drCr = (bal < 0) ? 'Cr' : (bal > 0 ? 'Dr' : '');
            customers.push({
                c: k,
                n: k,
                p: phoneMap.get(k) || '',
                ct: '',
                a: '',
                g: '',
                b: Math.round(absBal),
                d: drCr,
                sb: Math.round(bal),
                pb: rep.outstanding.length,
                tb: rep.transport.length,
                hl: rep.ledger.length > 0,
                hs: rep.salesItems.length > 0,
                ht: rep.transport.length > 0,
                ho: rep.outstanding.length > 0,
                tr: transportByParty.get(k) || '',
                ag: agentByParty.get(k) || ''
            });
        }
    });

    // Sort: Accounts with active reports/balances first, then alphabetical
    customers.sort((a, b) => {
        const aActive = (a.hl || a.hs || a.ht || a.ho || a.b > 0) ? 1 : 0;
        const bActive = (b.hl || b.hs || b.ht || b.ho || b.b > 0) ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;
        if (b.sb !== a.sb) return b.sb - a.sb;
        return a.n.localeCompare(b.n);
    });

    const custFile = path.join(WWW_DIR, 'accounting_customers.json');
    const repFile = path.join(WWW_DIR, 'accounting_reports.json');

    console.log(`💾 6. Writing ${custFile} (${customers.length} accounts)...`);
    fs.writeFileSync(custFile, JSON.stringify(customers));

    console.log(`💾 7. Writing ${repFile} (${Object.keys(reportsByParty).length} parties)...`);
    fs.writeFileSync(repFile, JSON.stringify(reportsByParty));

    const custMB = (fs.statSync(custFile).size / (1024 * 1024)).toFixed(2);
    const repMB = (fs.statSync(repFile).size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Success! Customers file: ${custMB} MB | Reports file: ${repMB} MB`);

    // 8. Auto-commit and push to Git
    try {
        console.log('🚀 8. Pushing updated accounting data to Git/Firebase...');
        execSync('git add www/accounting_customers.json www/accounting_reports.json', { cwd: __dirname, stdio: 'inherit' });
        const commitMsg = `Live accounting sync: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
        try {
            execSync(`git commit -m "${commitMsg}"`, { cwd: __dirname, stdio: 'inherit' });
            execSync('git push origin main', { cwd: __dirname, stdio: 'inherit' });
            console.log('✅ Git Push Completed Successfully!');
        } catch (gitErr) {
            console.log('ℹ️ No data changes to commit.');
        }
    } catch (e) {
        console.warn('⚠️ Git auto-push warning:', e.message);
    }

    console.log('🎉 Accounting sync finished successfully.');
}

syncAccountingData().catch(console.error);
