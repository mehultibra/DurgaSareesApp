const fs = require('fs');

let content = fs.readFileSync('www/app.js', 'utf-8');

content = content.replace(
    "nameLabel.innerText = (detailTitle && detailTitle.innerText) ? detailTitle.innerText : productName;",
    "nameLabel.value = (detailTitle && detailTitle.innerText) ? detailTitle.innerText : productName;"
);

content = content.replace(
    "window.saveToOutbox = function (docId, designId, fileUri) {",
    "window.saveToOutbox = function (docId, designId, fileUri, productName) {"
);
content = content.replace(
    "var req = tx.objectStore(\"outbox\").put({ docId, designId, fileUri, ts: Date.now(), processAfter: Date.now() + 5000 });",
    "var req = tx.objectStore(\"outbox\").put({ docId, designId, fileUri, productName, ts: Date.now(), processAfter: Date.now() + 5000 });"
);

content = content.replace(
    "    var designInput = document.getElementById('adminDesignNumberInput');\n    var finalDesignId = (designInput && designInput.value) ? designInput.value.trim().toUpperCase() : \"02\";\n\n    if (modal) modal.style.display = 'none';\n\n    try {\n        var outboxId = await window.saveToOutbox(window.tempCamDocId, finalDesignId, window.tempCamPhotoPath);",
    "    var nameInput = document.getElementById('adminPreviewProductName');\n    var finalProductName = (nameInput && nameInput.value) ? nameInput.value.trim() : \"\";\n    var designInput = document.getElementById('adminDesignNumberInput');\n    var finalDesignId = (designInput && designInput.value) ? designInput.value.trim().toUpperCase() : \"02\";\n\n    if (modal) modal.style.display = 'none';\n\n    try {\n        var outboxId = await window.saveToOutbox(window.tempCamDocId, finalDesignId, window.tempCamPhotoPath, finalProductName);"
);

content = content.replace(
    "var filename = `${item.docId}___${item.designId}_${item.ts}.jpg`;",
    "var safeName = item.productName ? encodeURIComponent(item.productName) : \"NA\";\n            var filename = `${item.docId}___${item.designId}___${safeName}___${item.ts}.jpg`;"
);

fs.writeFileSync('www/app.js', content, 'utf-8');
console.log("Patched app.js successfully via Node");
