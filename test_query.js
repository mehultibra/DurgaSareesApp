const fetch = require('node-fetch');

async function testQuery() {
    let limitDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let url = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents:runQuery";
    let queryPayload = {
        structuredQuery: {
            from: [{ collectionId: "LiveSessions" }],
            where: {
                fieldFilter: {
                    field: { fieldPath: "lastActive" },
                    op: "GREATER_THAN_OR_EQUAL",
                    value: { timestampValue: limitDate.toISOString() }
                }
            },
            orderBy: [{ field: { fieldPath: "lastActive" }, direction: "DESCENDING" }],
            limit: 1000
        }
    };

    let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryPayload)
    });
    let data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testQuery();
