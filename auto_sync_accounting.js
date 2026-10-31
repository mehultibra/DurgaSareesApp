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

    const GST_STATE_MAP = {
        '01': 'JAMMU AND KASHMIR', '02': 'HIMACHAL PRADESH', '03': 'PUNJAB', '04': 'CHANDIGARH',
        '05': 'UTTARAKHAND', '06': 'HARYANA', '07': 'DELHI', '08': 'RAJASTHAN', '09': 'UTTAR PRADESH',
        '10': 'BIHAR', '11': 'SIKKIM', '12': 'ARUNACHAL PRADESH', '13': 'NAGALAND', '14': 'MANIPUR',
        '15': 'MIZORAM', '16': 'TRIPURA', '17': 'MEGHALAYA', '18': 'ASSAM', '19': 'WEST BENGAL',
        '20': 'JHARKHAND', '21': 'ODISHA', '22': 'CHHATTISGARH', '23': 'MADHYA PRADESH', '24': 'GUJARAT',
        '25': 'DAMAN AND DIU', '26': 'DADRA AND NAGAR HAVELI', '27': 'MAHARASHTRA', '28': 'ANDHRA PRADESH',
        '29': 'KARNATAKA', '30': 'GOA', '31': 'LAKSHADWEEP', '32': 'KERALA', '33': 'TAMIL NADU',
        '34': 'PUDUCHERRY', '35': 'ANDAMAN AND NICOBAR', '36': 'TELANGANA', '37': 'ANDHRA PRADESH', '38': 'LADAKH'
    };

    function extractState(m) {
        if (!m) return '';
        const gst = String(m.GST || m.g || '').trim();
        if (gst.length >= 2 && GST_STATE_MAP[gst.substring(0, 2)]) {
            return GST_STATE_MAP[gst.substring(0, 2)];
        }
        const txt = ((m.city || m.ct || '') + ' ' + (m.ST || m.st || '') + ' ' + (m.AD1 || '') + ' ' + (m.AD2 || '') + ' ' + (m.AD3 || '') + ' ' + (m.AD4 || '')).toUpperCase();
        if (txt.includes('(M.H') || txt.includes('(MH') || txt.includes('MAHARASHTRA') || txt.includes('MUMBAI') || txt.includes('PUNE') || txt.includes('NAGPUR') || txt.includes('BHUSAVAL')) return 'MAHARASHTRA';
        if (txt.includes('(G.J') || txt.includes('(GJ') || txt.includes('GUJARAT') || txt.includes('SURAT') || txt.includes('AHMEDABAD') || txt.includes('RAJKOT') || txt.includes('VADODARA')) return 'GUJARAT';
        if (txt.includes('(R.J') || txt.includes('(RJ') || txt.includes('(RAJ') || txt.includes('RAJASTHAN') || txt.includes('JAIPUR') || txt.includes('JODHPUR')) return 'RAJASTHAN';
        if (txt.includes('(M.P') || txt.includes('(MP') || txt.includes('MADHYA PRADESH') || txt.includes('INDORE') || txt.includes('BHOPAL') || txt.includes('JABALPUR')) return 'MADHYA PRADESH';
        if (txt.includes('(U.P') || txt.includes('(UP') || txt.includes('UTTAR PRADESH') || txt.includes('KANPUR') || txt.includes('LUCKNOW') || txt.includes('VARANASI') || txt.includes('AGRA')) return 'UTTAR PRADESH';
        if (txt.includes('(C.G') || txt.includes('(CG') || txt.includes('CHHATTISGARH') || txt.includes('RAIPUR') || txt.includes('BILASPUR')) return 'CHHATTISGARH';
        if (txt.includes('(A.P') || txt.includes('(AP') || txt.includes('ANDHRA PRADESH') || txt.includes('VIJAYWADA') || txt.includes('VISAKHAPATNAM') || txt.includes('GUNTUR')) return 'ANDHRA PRADESH';
        if (txt.includes('(T.S') || txt.includes('(TS') || txt.includes('TELANGANA') || txt.includes('HYDERABAD') || txt.includes('WARANGAL')) return 'TELANGANA';
        if (txt.includes('(O.D') || txt.includes('(OD') || txt.includes('ODISHA') || txt.includes('ORISSA') || txt.includes('CUTTACK') || txt.includes('BHUBANESWAR')) return 'ODISHA';
        if (txt.includes('(W.B') || txt.includes('(WB') || txt.includes('WEST BENGAL') || txt.includes('KOLKATA') || txt.includes('SILIGURI')) return 'WEST BENGAL';
        if (txt.includes('(B.R') || txt.includes('(BR') || txt.includes('BIHAR') || txt.includes('PATNA') || txt.includes('GAYA') || txt.includes('MUZAFFARPUR')) return 'BIHAR';
        if (txt.includes('(J.K') || txt.includes('(JK') || txt.includes('JHARKHAND') || txt.includes('RANCHI') || txt.includes('JAMSHEDPUR') || txt.includes('DHANBAD')) return 'JHARKHAND';
        if (txt.includes('(K.A') || txt.includes('(KA') || txt.includes('KARNATAKA') || txt.includes('BANGALORE') || txt.includes('BENGALURU') || txt.includes('MYSORE')) return 'KARNATAKA';
        if (txt.includes('(T.N') || txt.includes('(TN') || txt.includes('(T.M') || txt.includes('TAMIL NADU') || txt.includes('CHENNAI') || txt.includes('MADURAI') || txt.includes('COIMBATORE')) return 'TAMIL NADU';
        if (txt.includes('(K.L') || txt.includes('(KL') || txt.includes('KERALA') || txt.includes('KOCHI') || txt.includes('CALICUT')) return 'KERALA';
        if (txt.includes('(H.R') || txt.includes('(HR') || txt.includes('HARYANA') || txt.includes('ROHTAK') || txt.includes('PANIPAT') || txt.includes('AMBALA')) return 'HARYANA';
        if (txt.includes('(P.B') || txt.includes('(PB') || txt.includes('PUNJAB') || txt.includes('LUDHIANA') || txt.includes('AMRITSAR') || txt.includes('JALANDHAR')) return 'PUNJAB';
        if (txt.includes('(A.S') || txt.includes('(AS') || txt.includes('ASSAM') || txt.includes('GUWAHATI')) return 'ASSAM';
        if (txt.includes('DELHI')) return 'DELHI';
        return (m.ST && m.ST.trim() !== '-') ? m.ST.trim() : '';
    }

    // Load any persisted party linkings (from Firebase/admin actions) to preserve across syncs
    const partyLinksBackupPath = path.join(WWW_DIR, 'party_links_backup.json');
    let localLinks = {};
    if (fs.existsSync(partyLinksBackupPath)) {
        try { localLinks = JSON.parse(fs.readFileSync(partyLinksBackupPath, 'utf8')); } catch(e){}
    }

    // Try fetching live PartyLinks from Firebase Firestore
    try {
        console.log('☁️ Checking for live Firebase PartyLinks...');
        const fRes = await fetch('https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/PartyLinks', { signal: AbortSignal.timeout(6000) });
        if (fRes.ok) {
            const fData = await fRes.json();
            const docs = (fData && fData.documents) ? fData.documents : [];
            docs.forEach(doc => {
                if (!doc.fields) return;
                const f = doc.fields;
                const code = (f.partyCode && f.partyCode.stringValue) ? f.partyCode.stringValue.trim().toUpperCase() : doc.name.split('/').pop().toUpperCase();
                localLinks[code] = {
                    code: code,
                    phone: f.phone ? f.phone.stringValue : '',
                    station: f.station ? f.station.stringValue : '',
                    state: f.state ? f.state.stringValue : '',
                    agent: f.agent ? f.agent.stringValue : '',
                    transport: f.transport ? f.transport.stringValue : '',
                    gst: f.gst ? f.gst.stringValue : '',
                    role: f.role ? f.role.stringValue : 'customer'
                };
            });
            fs.writeFileSync(partyLinksBackupPath, JSON.stringify(localLinks, null, 2));
            console.log(`☁️ Synced ${docs.length} PartyLinks from Firebase.`);
        }
    } catch(cloudErr) {
        console.log('ℹ️ Local party links backup will be used:', cloudErr.message);
    }

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

        // Apply any permanent cloud link overrides
        let linkData = localLinks[k] || localLinks[code] || null;
        if (linkData) {
            if (linkData.phone && !phone) phone = linkData.phone;
        }

        const detectedState = extractState(m);
        const finalState = (linkData && linkData.state) ? linkData.state : detectedState;

        customers.push({
            c: code,
            n: m.partyname || code,
            p: phone,
            ct: m.city || m.CITY || '',
            st: finalState,
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
            tr: (linkData && linkData.transport) ? linkData.transport : (transportByParty.get(k) || ''),
            ag: (linkData && linkData.agent) ? linkData.agent : (agentByParty.get(k) || ''),
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
            let linkData = localLinks[k] || null;
            customers.push({
                c: k,
                n: k,
                p: (linkData && linkData.phone) ? linkData.phone : (phoneMap.get(k) || ''),
                ct: '',
                st: (linkData && linkData.state) ? linkData.state : '',
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
                tr: (linkData && linkData.transport) ? linkData.transport : (transportByParty.get(k) || ''),
                ag: (linkData && linkData.agent) ? linkData.agent : (agentByParty.get(k) || '')
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
