/**
 * Durga Sarees - Enterprise Accounting Sync Engine ("Firebase Brain" Model)
 * --------------------------------------------------------------------------
 * 1. Reads live SQL JSON exports from XAMPP TRADING directory.
 * 2. Strictly filters for Customers (ATYPE=1) and Agents/Brokers (ATYPE=12).
 *    (Internal accounts like Salary, Purchases, TDS, Bank, Suppliers are excluded).
 * 3. Builds Master Customer Summaries, Customer Reports, and PhoneDirectory.
 * 4. Delta Hash Check: Computes MD5 hash per party and only syncs changed documents to Firebase.
 * 5. Syncs in Firestore batches (up to 400 writes/batch) to 4 collections:
 *    - AccountingCustomers/{partyCode}
 *    - AccountingReports/{partyCode}
 *    - PhoneDirectory/{phone10}
 *    - AccountingMeta/dashboard
 * 6. Saves local cache outside www/ into ./erp_sync_cache/ without bloating Git.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE_DIR = 'C:/xampp/htdocs/TRADING/js/VU5JUVVFU09GVFdBUkVTNTA0MTA=U09GVFdBUkVTVU5JUVVF/2627/json/';
const CACHE_DIR = path.join(__dirname, 'erp_sync_cache');
const HASHES_FILE = path.join(CACHE_DIR, 'sync_hashes.json');
const PARTY_LINKS_BACKUP = path.join(CACHE_DIR, 'party_links_backup.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── GST & State Mapping ──────────────────────────────────────────
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

// ── Firebase Auth Helper ──────────────────────────────────────────
async function getFirebaseAccessToken() {
    try {
        const auth = require('C:/Users/DELLNEW/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
        const c = require('C:/Users/DELLNEW/.config/configstore/firebase-tools.json');
        if (c && c.tokens && c.tokens.refresh_token) {
            const tokenObj = await auth.getAccessToken(c.tokens.refresh_token, c.tokens.scopes || []);
            if (tokenObj && tokenObj.access_token) return tokenObj.access_token;
        }
    } catch (e) {
        console.warn('⚠️ Could not obtain Firebase CLI token:', e.message);
    }
    return null;
}

// ── Firestore Value Encoder ───────────────────────────────────────
function toFirestoreValue(val, inArray = false) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: String(val) };
        return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) {
        if (inArray) {
            return { mapValue: { fields: { _a: toFirestoreValue(val, false) } } };
        }
        return { arrayValue: { values: val.map(v => toFirestoreValue(v, true)) } };
    }
    if (typeof val === 'object') {
        const fields = {};
        for (const k of Object.keys(val)) {
            if (val[k] !== undefined) fields[k] = toFirestoreValue(val[k], false);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

function sanitizeDocId(str) {
    if (!str) return 'UNKNOWN';
    return String(str).trim().toUpperCase()
        .replace(/\//g, '__SLASH__')
        .replace(/\.+$/g, match => '__DOT'.repeat(match.length))
        .replace(/^\.+/g, match => '__DOT'.repeat(match.length))
        .replace(/\./g, '_DOT_')
        .replace(/\s{2,}/g, match => '__SP'.repeat(match.length))
        .replace(/\s/g, '_');
}

// ── Main Sync Function ────────────────────────────────────────────
async function syncAccountingData() {
    console.log('====================================================');
    console.log('🔄 Durga Sarees - Enterprise Accounting Sync Started');
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

    // Step 2: Strictly filter for Customers (1) and Agents/Brokers (12)
    console.log('👥 2. Filtering allowed customer & agent accounts from MST...');
    const allowedPartyCodes = new Set();
    const mstPartyMap = new Map();
    mst.forEach(m => {
        if (m.ATYPE === '1' || m.ATYPE === '12') {
            const code = String(m.partyname || m.value || '').trim().toUpperCase();
            if (code) {
                allowedPartyCodes.add(code);
                mstPartyMap.set(code, m);
            }
        }
    });
    console.log(`✅ Allowed Parties: ${allowedPartyCodes.size} (ATYPE=1 Customers & ATYPE=12 Agents/Brokers)`);

    // Step 3: Phone mappings from ACGROUP & MST
    console.log('📞 3. Building phone & broker mappings...');
    const phoneMap = new Map();
    const allPhonesByParty = new Map();

    acgroup.forEach(g => {
        const code = String(g.code || '').trim().toUpperCase();
        if (code && g.MO) {
            let raw = String(g.MO).replace(/\D/g, '');
            if (raw.length >= 10) {
                let p10 = raw.slice(-10);
                phoneMap.set(code, p10);
                if (!allPhonesByParty.has(code)) allPhonesByParty.set(code, new Set());
                allPhonesByParty.get(code).add(p10);
            }
        }
    });

    mst.forEach(m => {
        const code = String(m.partyname || m.value || '').trim().toUpperCase();
        if (!allowedPartyCodes.has(code)) return;
        [m.MO, m.PH1, m.FX1].forEach(rawField => {
            if (!rawField) return;
            let raw = String(rawField).replace(/\D/g, '');
            if (raw.length >= 10) {
                let p10 = raw.slice(-10);
                if (!phoneMap.has(code)) phoneMap.set(code, p10);
                if (!allPhonesByParty.has(code)) allPhonesByParty.set(code, new Set());
                allPhonesByParty.get(code).add(p10);
            }
        });
    });

    console.log('📦 4. Mapping DET item lines by IDE...');
    const detMap = new Map();
    det.forEach(d => {
        if (d.IDE && Array.isArray(d.billDetails)) {
            detMap.set(d.IDE, d.billDetails);
        }
    });

    // Step 5: Compiling customer financial reports (STRICTLY for allowed parties)
    console.log('📊 5. Compiling customer financial reports...');
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
                outstanding: [],
                bills: {}
            };
        }
        return reportsByParty[k];
    }

    // A. Ledger transactions
    ledger.forEach(l => {
        const code = String(l.code || '').trim().toUpperCase();
        if (!code || !allowedPartyCodes.has(code)) return;
        const p = getPartyReport(code);
        const dr = parseFloat(l.DRAMT) || 0;
        const cr = parseFloat(l.CRAMT) || 0;
        p.ledger.push({
            d: l.DATE || '',
            v: l.DOCNO || l.BILLNO || l.VNO || '',
            t: l.TYPE || '',
            r: l.RFCODE || l.RMK || '',
            dr: dr,
            cr: cr,
            f: l.FRM || (l.CNO === '2' ? 'R.F' : (l.CNO === '1' ? 'DSPL' : 'DS'))
        });
    });

    // Running ledger balances
    const ledgerBalances = new Map();
    const totalDrByParty = new Map();
    const totalCrByParty = new Map();

    Object.keys(reportsByParty).forEach(code => {
        const lList = reportsByParty[code].ledger;
        lList.sort((a, b) => (a.d || '').localeCompare(b.d || ''));
        let running = 0;
        let totDr = 0;
        let totCr = 0;
        lList.forEach(entry => {
            totDr += entry.dr;
            totCr += entry.cr;
            running += (entry.dr - entry.cr);
            entry.bal = Math.round(running * 100) / 100;
        });
        ledgerBalances.set(code, running);
        totalDrByParty.set(code, totDr);
        totalCrByParty.set(code, totCr);
    });

    // B. BLS (Transport & Sales Bills)
    bls.forEach(party => {
        const code = String(party.code || '').trim().toUpperCase();
        if (!code || !allowedPartyCodes.has(code)) return;
        const p = getPartyReport(code);
        const m = mstPartyMap.get(code) || {};

        if (Array.isArray(party.billDetails)) {
            party.billDetails.forEach(b => {
                const billNo = String(b.BILL || b.VNO || '').trim();
                const items = (b.IDE && detMap.get(b.IDE)) ? detMap.get(b.IDE) : [];
                const itemRows = [];

                if (items.length > 0) {
                    items.forEach((it, itemIdx) => {
                        const qualName = it.qual || it.altql || '';
                        const ctgry = it.CTGRY || '';
                        const pck = it.PCK || '';
                        const unit = it.UNIT || 'PCS';
                        const pcs = parseInt(it.PCS) || 0;
                        const mts = parseFloat(it.MTS) || 0;
                        const rate = parseFloat(it.RATE) || 0;
                        const amt = parseFloat(it.AMT) || 0;
                        const sr = it.hsn || it.SR || '540754';

                        itemRows.push([
                            qualName,
                            ctgry,
                            pck,
                            unit,
                            pcs,
                            mts,
                            rate,
                            amt,
                            sr
                        ]);

                        p.salesItems.push({
                            b: billNo,
                            d: b.DATE || '',
                            q: qualName,
                            c: ctgry,
                            pck: pck,
                            unit: unit,
                            pcs: pcs,
                            mts: mts,
                            r: rate,
                            a: amt
                        });

                        p.finishSales.push([
                            b.DATE || '',
                            billNo,
                            qualName,
                            ctgry,
                            pck,
                            unit,
                            pcs,
                            mts,
                            rate,
                            amt,
                            parseFloat(b.BAMT || b.fnlamt || 0),
                            b.DT || '',
                            b.TRNSP || '',
                            b.RRNO || '',
                            b.PLC || '',
                            b.PRCL || b.CSNO || '1',
                            b.haste || b.BCODE || '',
                            itemIdx === 0
                        ]);
                    });
                } else {
                    p.finishSales.push([
                        b.DATE || '',
                        billNo,
                        b.QUAL || '',
                        '',
                        b.PCK || '',
                        'PCS',
                        parseInt(b.TPCS) || 0,
                        parseFloat(b.TMTS) || 0,
                        0,
                        parseFloat(b.grsamt || b.BAMT) || 0,
                        parseFloat(b.BAMT || b.fnlamt || 0),
                        b.DT || '',
                        b.TRNSP || '',
                        b.RRNO || '',
                        b.PLC || '',
                        b.PRCL || b.CSNO || '1',
                        b.haste || b.BCODE || '',
                        true
                    ]);
                }

                // Full Bill Record for 1-Click Tax Invoice Viewer
                if (billNo) {
                    p.bills[billNo] = [
                        billNo,                                    // 0: Bill No
                        b.DATE || '',                              // 1: Bill Date
                        m.partyname || code,                       // 2: Party Name
                        phoneMap.get(code) || '',                  // 3: Phone
                        m.AD1 ? `${m.AD1 || ''} ${m.AD2 || ''}`.trim() : (b.PLC || ''), // 4: Address
                        b.PLC || '',                               // 5: Destination
                        b.TRNSP || '',                             // 6: Transport Name
                        b.RRNO || '',                              // 7: LR No
                        b.RRDET || '',                             // 8: LR Date
                        b.PRCL || b.CSNO || '1',                   // 9: Parcels / Cases
                        b.WGT || '',                               // 10: Weight
                        b.FRT || '',                               // 11: Freight
                        b.EWB || '',                               // 12: e-Way
                        b.haste || b.BCODE || '',                  // 13: Broker / Haste
                        parseFloat(b.grsamt || b.BAMT) || 0,       // 14: Gross Amount
                        'Discount',                                // 15: Discount Label
                        parseFloat(b.DISC || b.billdis || 0),      // 16: Discount %
                        parseFloat(b.discamt || 0),                // 17: Discount Amount
                        parseFloat(b.VTRET || 5),                  // 18: GST %
                        parseFloat(b.VTAMT || 0),                  // 19: GST Amount
                        parseFloat(b.BAMT || b.fnlamt || 0),       // 20: Net Bill Amount
                        b.paid || 'N',                             // 21: Paid Status
                        b.DT || 'Due',                             // 22: Due Info
                        itemRows                                   // 23: Item Lines
                    ];
                }

                const trnName = b.TRNSP || b[12];
                if (trnName && !transportByParty.has(code)) {
                    transportByParty.set(code, String(trnName).trim());
                }
                const agName = b.BCODE || b[11];
                if (agName && !agentByParty.has(code)) {
                    agentByParty.set(code, String(agName).trim());
                }
            });
        }

        if (Array.isArray(party.transportDetails)) {
            party.transportDetails.forEach(t => {
                p.transport.push(t);
                if (t.transportName && !transportByParty.has(code)) {
                    transportByParty.set(code, String(t.transportName).trim());
                }
            });
        }

        if (Array.isArray(party.salesItems)) {
            party.salesItems.forEach(s => p.salesItems.push(s));
        }
    });

    // C. Outstanding bills
    ost.forEach(party => {
        const code = String(party.code || '').trim().toUpperCase();
        if (!code || !allowedPartyCodes.has(code)) return;
        const p = getPartyReport(code);
        const bList = party.billDetails || party.bills || [];
        if (Array.isArray(bList)) {
            bList.forEach(b => {
                const billDt = b.DATE || '';
                let osDays = 0;
                if (billDt) {
                    const diffTime = Date.now() - new Date(billDt).getTime();
                    osDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                }
                const bBroker = b.BCODE || b.BROKER || '';
                p.outstanding.push({
                    bno: b.BILL || b.VNO || b.BILLNO || '',
                    dt: billDt,
                    bamt: parseFloat(b.FAMT || b.GRSAMT || b.BILLAMT) || 0,
                    pamt: parseFloat(b.PAMT || b.PENDINGAMT) || 0,
                    ag: bBroker,
                    ct: b.CITY || '',
                    tr: b.TR || '',
                    du: parseInt(b.DUE_DAYS || osDays) || 0,
                    f: b.FRM || (b.CNO === '2' ? 'R.F' : (b.CNO === '1' ? 'DSPL' : 'DS'))
                });
                if (bBroker && !agentByParty.has(code)) {
                    agentByParty.set(code, String(bBroker).trim());
                }
            });
        }
    });

    // Step 6: Load party links overrides (Fetch live from Firestore & merge into local cache)
    console.log('🔄 6. Fetching live PartyLinks from Firestore...');
    let localLinks = {};
    const fallbackBackup = path.join(__dirname, 'www', 'party_links_backup.json');
    if (fs.existsSync(PARTY_LINKS_BACKUP)) {
        try { localLinks = JSON.parse(fs.readFileSync(PARTY_LINKS_BACKUP, 'utf8')); } catch(e){}
    } else if (fs.existsSync(fallbackBackup)) {
        try { localLinks = JSON.parse(fs.readFileSync(fallbackBackup, 'utf8')); } catch(e){}
    }

    try {
        const liveToken = await getFirebaseAccessToken();
        if (liveToken) {
            let pageToken = '';
            let fetchedCount = 0;
            const PROJECT_ID = 'durga-sarees';
            do {
                const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/PartyLinks?pageSize=1000` + (pageToken ? `&pageToken=${pageToken}` : '');
                const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + liveToken } });
                if (res.ok) {
                    const json = await res.json();
                    (json.documents || []).forEach(doc => {
                        const f = doc.fields || {};
                        const code = (f.partyCode && f.partyCode.stringValue) || decodeURIComponent(doc.name.split('/').pop());
                        if (code) {
                            localLinks[code] = Object.assign(localLinks[code] || {}, {
                                name: f.name ? f.name.stringValue : (localLinks[code] && localLinks[code].name),
                                phone: f.phone ? f.phone.stringValue : (localLinks[code] && localLinks[code].phone),
                                transport: f.transport ? f.transport.stringValue : (localLinks[code] && localLinks[code].transport),
                                agent: f.agent ? f.agent.stringValue : (localLinks[code] && localLinks[code].agent),
                                state: f.state ? f.state.stringValue : (localLinks[code] && localLinks[code].state),
                                role: f.role ? f.role.stringValue : (localLinks[code] && localLinks[code].role),
                                station: f.station ? f.station.stringValue : (localLinks[code] && localLinks[code].station),
                                gst: f.gst ? f.gst.stringValue : (localLinks[code] && localLinks[code].gst),
                                address: f.address ? f.address.stringValue : (localLinks[code] && localLinks[code].address),
                                firm: f.firm ? f.firm.stringValue : (localLinks[code] && localLinks[code].firm)
                            });
                            fetchedCount++;
                        }
                    });
                    pageToken = json.nextPageToken || '';
                } else {
                    console.warn(`⚠️ PartyLinks fetch returned HTTP ${res.status}`);
                    break;
                }
            } while (pageToken);
            fs.writeFileSync(PARTY_LINKS_BACKUP, JSON.stringify(localLinks, null, 2));
            console.log(`✅ Live PartyLinks synced: ${fetchedCount} links merged into backup cache.`);
        }
    } catch (e) {
        console.warn('⚠️ Could not fetch live PartyLinks from Firestore:', e.message);
    }

    // Step 7: Compile Customer Summaries and Phone Directory
    console.log('👥 6. Compiling master customer records & Phone Directory...');
    const nowIso = new Date().toISOString();
    const customers = [];
    const phoneDirectoryMap = {};
    const uniqueStates = new Set();
    const uniqueAgents = new Set();

    allowedPartyCodes.forEach(code => {
        const m = mstPartyMap.get(code);
        if (!m) return;
        const isAgent = (m.ATYPE === '12');
        const rep = reportsByParty[code] || { ledger: [], salesItems: [], finishSales: [], transport: [], outstanding: [] };

        let bal = ledgerBalances.get(code);
        if (bal === undefined) {
            bal = 0;
            rep.outstanding.forEach(o => { bal += o.pamt; });
        }
        const absBal = Math.abs(bal || 0);
        const drCr = (bal < 0) ? 'Cr' : (bal > 0 ? 'Dr' : '');

        let primaryPhone = phoneMap.get(code) || '';
        let phonesSet = allPhonesByParty.get(code) || new Set();

        let linkData = localLinks[code] || null;
        if (linkData && linkData.phone) {
            let pClean = String(linkData.phone).replace(/\D/g, '').slice(-10);
            if (pClean.length === 10) {
                primaryPhone = pClean;
                phonesSet.add(pClean);
            }
        }

        const detectedState = extractState(m);
        const finalState = (linkData && linkData.state) ? linkData.state : detectedState;
        const finalStation = (linkData && linkData.station) ? linkData.station : (m.city || m.CITY || '');
        const finalTransport = (linkData && linkData.transport) ? linkData.transport : (transportByParty.get(code) || '');
        const finalAgent = (linkData && linkData.agent) ? linkData.agent : (agentByParty.get(code) || '');
        const finalGst = (linkData && linkData.gst) ? linkData.gst : (m.GST || '');
        const role = isAgent ? 'agent' : 'customer';

        if (finalState) uniqueStates.add(finalState);
        if (finalAgent) uniqueAgents.add(finalAgent);

        const cleanPhonesArr = Array.from(phonesSet);

        const summaryObj = {
            code: code,
            name: m.partyname || code,
            nameUpper: String(m.partyname || code).trim().toUpperCase(),
            phone: primaryPhone,
            cleanPhones: cleanPhonesArr,
            gst: finalGst,
            station: finalStation,
            state: finalState,
            transport: finalTransport,
            agent: finalAgent,
            atype: m.ATYPE,
            role: role,
            totalDebit: Math.round(totalDrByParty.get(code) || 0),
            totalCredit: Math.round(totalCrByParty.get(code) || 0),
            netBalance: Math.round(absBal),
            drCr: drCr,
            outstandingCount: rep.outstanding.length,
            salesBillsCount: rep.finishSales.length,
            updatedAt: nowIso
        };

        customers.push(summaryObj);

        // Group into PhoneDirectory
        cleanPhonesArr.forEach(p10 => {
            if (!phoneDirectoryMap[p10]) {
                phoneDirectoryMap[p10] = {
                    phone: p10,
                    matchedAccounts: [],
                    updatedAt: nowIso
                };
            }
            phoneDirectoryMap[p10].matchedAccounts.push({
                code: code,
                name: m.partyname || code,
                station: finalStation,
                state: finalState,
                agent: finalAgent,
                transport: finalTransport,
                gst: finalGst,
                role: role
            });
        });
    });

    // Step 7.1: Include and preserve any app-created contacts (e.g. codes starting with APP_) from localLinks
    Object.keys(localLinks).forEach(code => {
        if (!code.startsWith('APP_')) return;
        const link = localLinks[code];
        if (!link || !link.name) return;
        const pClean = String(link.phone || '').replace(/\D/g, '').slice(-10);
        const role = (link.role === 'agent' || link.isAgent) ? 'agent' : 'customer';
        const finalState = link.state || '';
        const finalAgent = link.agent || '';
        if (finalState) uniqueStates.add(finalState);
        if (finalAgent) uniqueAgents.add(finalAgent);

        const summaryObj = {
            code: code,
            name: link.name,
            nameUpper: String(link.name).trim().toUpperCase(),
            phone: pClean,
            phones: pClean ? [pClean] : [],
            station: link.station || '',
            state: finalState,
            agent: finalAgent,
            transport: link.transport || '',
            gst: link.gst || '',
            role: role,
            balance: 0,
            drCr: '',
            absBalance: 0,
            pendingBillsCount: 0,
            hasOutstanding: false,
            totalSalesDr: 0,
            totalSalesCr: 0,
            updatedAt: nowIso
        };
        customers.push(summaryObj);

        if (pClean && pClean.length === 10) {
            if (!phoneDirectoryMap[pClean]) {
                phoneDirectoryMap[pClean] = {
                    phone: pClean,
                    primaryRole: role,
                    matchedAccounts: [],
                    updatedAt: nowIso
                };
            }
            phoneDirectoryMap[pClean].matchedAccounts.push({
                code: code,
                name: link.name,
                station: link.station || '',
                state: finalState,
                agent: finalAgent,
                transport: link.transport || '',
                gst: link.gst || '',
                role: role
            });
        }
    });

    // Step 8: Dashboard Meta Document
    const dashboardDoc = {
        totalCustomers: customers.filter(c => c.role === 'customer').length,
        totalAgents: customers.filter(c => c.role === 'agent').length,
        states: Array.from(uniqueStates).filter(Boolean).sort(),
        agents: Array.from(uniqueAgents).filter(Boolean).sort(),
        lastSyncedAt: nowIso
    };

    // Step 9: Save local caches outside www/
    console.log('💾 7. Writing local cache into erp_sync_cache/...');
    const custCachePath = path.join(CACHE_DIR, 'accounting_customers.json');
    const repCachePath = path.join(CACHE_DIR, 'accounting_reports.json');

    fs.writeFileSync(custCachePath, JSON.stringify(customers));
    fs.writeFileSync(repCachePath, JSON.stringify(reportsByParty));

    const custMB = (fs.statSync(custCachePath).size / (1024 * 1024)).toFixed(2);
    const repMB = (fs.statSync(repCachePath).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Local Cache Saved: Customers (${custMB} MB, ${customers.length} accounts) | Reports (${repMB} MB)`);

    // Step 10: Delta Hash Calculation & Firestore Batch Sync
    console.log('☁️ 8. Checking delta changes for Firestore push...');
    let existingHashes = {};
    if (fs.existsSync(HASHES_FILE)) {
        try { existingHashes = JSON.parse(fs.readFileSync(HASHES_FILE, 'utf8')); } catch(e){}
    }
    const newHashes = Object.assign({}, existingHashes);

    const pendingWrites = [];

    function computeHash(obj) {
        // Strip updatedAt from hash check so stable data never re-triggers sync
        const copy = Object.assign({}, obj);
        delete copy.updatedAt;
        return crypto.createHash('md5').update(JSON.stringify(copy)).digest('hex');
    }

    // A. Check AccountingCustomers
    customers.forEach(c => {
        const docId = sanitizeDocId(c.code);
        const hKey = 'cust_' + docId;
        const currentHash = computeHash(c);
        if (existingHashes[hKey] !== currentHash) {
            pendingWrites.push({
                collection: 'AccountingCustomers',
                docId: docId,
                data: c,
                hashKey: hKey,
                hashValue: currentHash
            });
        }
    });

    // B. Check AccountingReports
    allowedPartyCodes.forEach(code => {
        const docId = sanitizeDocId(code);
        const rep = reportsByParty[code] || { ledger: [], salesItems: [], finishSales: [], transport: [], outstanding: [], bills: {} };
        const repData = {
            code: code,
            ledger: rep.ledger,
            finishSales: rep.finishSales,
            salesItems: rep.salesItems,
            transport: rep.transport,
            outstanding: rep.outstanding,
            bills: rep.bills || {},
            updatedAt: nowIso
        };
        const hKey = 'rep_' + docId;
        const currentHash = computeHash(repData);
        if (existingHashes[hKey] !== currentHash) {
            pendingWrites.push({
                collection: 'AccountingReports',
                docId: docId,
                data: repData,
                hashKey: hKey,
                hashValue: currentHash
            });
        }
    });

    // C. Check PhoneDirectory
    Object.keys(phoneDirectoryMap).forEach(p10 => {
        const docData = phoneDirectoryMap[p10];
        const hKey = 'phone_' + p10;
        const currentHash = computeHash(docData);
        if (existingHashes[hKey] !== currentHash) {
            pendingWrites.push({
                collection: 'PhoneDirectory',
                docId: p10,
                data: docData,
                hashKey: hKey,
                hashValue: currentHash
            });
        }
    });

    // D. Check AccountingMeta/dashboard
    const dashHash = computeHash(dashboardDoc);
    if (existingHashes['meta_dashboard'] !== dashHash) {
        pendingWrites.push({
            collection: 'AccountingMeta',
            docId: 'dashboard',
            data: dashboardDoc,
            hashKey: 'meta_dashboard',
            hashValue: dashHash
        });
    }

    console.log(`📊 Delta Analysis: ${pendingWrites.length} documents modified/new since last sync.`);

    if (pendingWrites.length > 0) {
        console.log('🚀 Authenticating with Firebase for batch push...');
        const token = await getFirebaseAccessToken();
        if (!token) {
            console.warn('⚠️ Could not obtain Firebase token. Delta writes will retry on next run.');
        } else {
            const BATCH_SIZE = 400;
            const PROJECT_ID = 'durga-sarees';
            let committedCount = 0;

            for (let i = 0; i < pendingWrites.length; i += BATCH_SIZE) {
                const chunk = pendingWrites.slice(i, i + BATCH_SIZE);
                const writeOps = chunk.map(item => ({
                    update: {
                        name: `projects/${PROJECT_ID}/databases/(default)/documents/${item.collection}/${item.docId}`,
                        fields: toFirestoreValue(item.data).mapValue.fields
                    }
                }));

                try {
                    const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ writes: writeOps })
                    });

                    if (commitRes.ok) {
                        chunk.forEach(item => {
                            newHashes[item.hashKey] = item.hashValue;
                        });
                        committedCount += chunk.length;
                        console.log(`✅ Batch committed: ${committedCount} / ${pendingWrites.length} documents`);
                    } else {
                        const errText = await commitRes.text();
                        console.error(`❌ Batch commit failed (HTTP ${commitRes.status}):`, errText.slice(0, 300));
                        break;
                    }
                } catch (batchErr) {
                    console.error('❌ Network error during batch commit:', batchErr.message);
                    break;
                }
            }

            // Save updated delta hashes
            fs.writeFileSync(HASHES_FILE, JSON.stringify(newHashes, null, 2));
            console.log(`💾 Delta hashes updated. Successfully synced ${committedCount} documents to Firestore.`);
        }
    } else {
        console.log('⚡ All Firestore documents are already up-to-date. Zero cloud writes required.');
    }

    console.log('🎉 Enterprise Accounting Sync completed successfully.');
}

syncAccountingData().catch(console.error);
