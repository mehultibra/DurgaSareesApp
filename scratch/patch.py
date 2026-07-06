import re

handle = open('www/app.js', 'r', encoding='utf-8')
content = handle.read()
handle.close()

target = """    if (closeEdit) window.cartEditingMap[productId] = false;
    updateCartHeader();
    openCart(); // Re-render to show updated static text
}"""

replacement = """    if (closeEdit) window.cartEditingMap[productId] = false;
    updateCartHeader();
    openCart(); // Re-render to show updated static text

    // 🚀 NEW: 2-WAY SYNC - FIREBASE & EXCEL WEBHOOK
    if (matchP && matchP.docId) {
        // Firebase Live DB Update
        var fbUpdateUrl = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + matchP.docId + "?updateMask.fieldPaths=price&updateMask.fieldPaths=packing";
        var payload = {
            fields: {
                price: { integerValue: newRate },
                packing: { stringValue: newPacking }
            }
        };

        window.fetchWithRetry(fbUpdateUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 1).then(res => {
            if (res.ok) console.log("✅ Live Database Updated Successfully for " + matchP.name);
            else console.error("❍ Live Database Update Failed: " + res.status);
        }).catch(err => console.error("Database sync error:", err));

        // Excel Webhook Sync via Apps Script
        if (window.DS_APP_SCRIPT_URL) {
            fetch(window.DS_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'updateProductDetails',
                    productName: matchP.name,
                    price: newRate,
                    packing: newPacking
                })
            }).catch(e => console.error("Excel Webhook error:", e));
        }
    }
}"""

if target in content:
    content = content.replace(target, replacement)
    handle = open('www/app.js', 'w', encoding='utf-8')
    handle.write(content)
    handle.close()
    print("Replaced successfully!")
else:
    print("Target not found!")