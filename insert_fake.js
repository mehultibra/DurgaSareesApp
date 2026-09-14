const fetch = require('node-fetch');

async function insertFakePresence() {
    let url = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/LiveSessions/TEST_USER_123?updateMask.fieldPaths=lastActive&updateMask.fieldPaths=customerName&updateMask.fieldPaths=customerStation&updateMask.fieldPaths=cartCount&updateMask.fieldPaths=cartValue&updateMask.fieldPaths=cartSummary&updateMask.fieldPaths=historyMap&updateMask.fieldPaths=currentProduct";
    
    let payload = {
        fields: {
            customerName: { stringValue: "Test User (System Generated)" },
            customerStation: { stringValue: "Test Station" },
            lastActive: { timestampValue: new Date().toISOString() },
            cartCount: { integerValue: 0 },
            cartValue: { integerValue: 0 },
            cartSummary: { stringValue: "" },
            currentProduct: { nullValue: null },
            historyMap: { stringValue: "{}" }
        }
    };

    let res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    let data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

insertFakePresence();
