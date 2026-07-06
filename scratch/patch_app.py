import re

with open('www/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'function saveCartInlineEdit.*?openCart\(\); // Re-render to show updated static text\n}', re.DOTALL)

replacement = '''function saveCartInlineEdit(productId, closeEdit = true) {
    var rateInput = document.getElementById('ie_rate_' + productId);
    var packInput = document.getElementById('ie_pack_' + productId);

    var newRate = rateInput ? parseInt(rateInput.value) || 0 : 0;
    var newPacking = packInput ? packInput.value.trim() || "1" : "1";

    var items = [];
    for (var k in cart) {
        if (cart[k].p && cart[k].p.id === productId) {
            items.push(cart[k]);
        }
    }

    var productName = items.length > 0 ? items[0].p.name : "";

    items.forEach(item => {
        var safeDesignLabel = item.design || 'DIRECT';
        var qtyInput = document.getElementById('ie_qty_' + productId + '_' + safeDesignLabel);
        if (qtyInput) {
            var newQty = parseInt(qtyInput.value) || 0;
            if (newQty <= 0) {
                delete cart[productId + "_" + item.design];
            } else {
                item.qty = newQty;
                item.p.price = newRate;
                item.p.packing = newPacking;
                cart[productId + "_" + item.design] = item;
            }
        }
    });

    // Save to edited memory so changes persist across cart wipes
    if (items.length > 0) {
        var edited = {};
        try { edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {}; } catch (e) { }
        edited[productName] = { price: newRate, packing: newPacking };
        localStorage.setItem("dsEditedProducts", JSON.stringify(edited));
    }

    var matchP = allProducts.find(x => x.id === productId);
    var docId = matchP ? matchP.docId : null;
    if (matchP) {
        matchP.price = newRate;
        matchP.packing = newPacking;
    }

    localStorage.setItem("dsCart", JSON.stringify(cart));

    if (closeEdit) window.cartEditingMap[productId] = false;
    updateCartHeader();
    openCart(); // Re-render to show updated static text

    // ?? NEW: 2-WAY SYNC - FIREBASE UPDATE
    if (docId) {
        var fbUpdateUrl = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + docId + "?updateMask.fieldPaths=price&updateMask.fieldPaths=packing";
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
            if (res.ok) console.log("? Live Database Updated Successfully for " + productName);
            else console.error("? Live Database Update Failed: " + res.status);
        }).catch(err => console.error("Database sync error:", err));

        // ?? EXCEL WEBHOOK SYNC
        if (window.DS_APP_SCRIPT_URL) {
            fetch(window.DS_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'updateProductDetails',
                    productName: matchP ? matchP.name : productName,
                    price: newRate,
                    packing: newPacking
                })
            }).catch(e => console.error("Excel Webhook error:", e));
        }
    }
}'''

new_content = re.sub(pattern, replacement, content)

with open('www/app.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
    
print("Replaced successfully!")
