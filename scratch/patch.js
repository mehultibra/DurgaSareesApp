const fs = require('fs');
let content = fs.readFileSync('www/app.js', 'utf8');

// Fix double declaration of DS_APP_SCRIPT_URL
content = content.replace(/window\.DS_APP_SCRIPT_URL = "https:\/\/script\.google\.com.*?\r?\nwindow\.DS_APP_SCRIPT_URL = "https:\/\/script\.google\.com.*?\r?\n/, 'window.DS_APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx89H5yDUi-60Q2Rk12PH1TH34Nt-BncrMRhYSewu1LdLOj_GCWGKKz1Qmx2OmeGwlL/exec";\n');

const targetRegex = /if \(closeEdit\) window\.cartEditingMap\[productId\] = false;\s*updateCartHeader\(\);\s*openCart\(\); \/\/ Re-render to show updated static text\s*\}/m;

const replacementStr =     if (closeEdit) window.cartEditingMap[productId] = false;
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
            else console.error("❌ Live Database Update Failed: " + res.status);
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
};

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacementStr);
    fs.writeFileSync('www/app.js', content, 'utf8');
    console.log('Replaced successfully!');
} else {
    console.log('Could not find target string!');
}
