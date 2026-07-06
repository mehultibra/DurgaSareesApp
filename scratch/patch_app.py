import re

with open('www/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update triggerAdminCamera
content = content.replace(
    "nameLabel.innerText = (detailTitle && detailTitle.innerText) ? detailTitle.innerText : productName;",
    "nameLabel.value = (detailTitle && detailTitle.innerText) ? detailTitle.innerText : productName;"
)

# 2. Update saveToOutbox signature
content = content.replace(
    "window.saveToOutbox = function (docId, designId, fileUri) {",
    "window.saveToOutbox = function (docId, designId, fileUri, productName) {"
)
content = content.replace(
    "var req = tx.objectStore(\"outbox\").put({ docId, designId, fileUri, ts: Date.now(), processAfter: Date.now() + 5000 });",
    "var req = tx.objectStore(\"outbox\").put({ docId, designId, fileUri, productName, ts: Date.now(), processAfter: Date.now() + 5000 });"
)

# 3. Update confirmAdminUpload
content = content.replace(
    "    var designInput = document.getElementById('adminDesignNumberInput');\n    var finalDesignId = (designInput && designInput.value) ? designInput.value.trim().toUpperCase() : \"02\";\n\n    if (modal) modal.style.display = 'none';\n\n    try {\n        var outboxId = await window.saveToOutbox(window.tempCamDocId, finalDesignId, window.tempCamPhotoPath);",
    "    var nameInput = document.getElementById('adminPreviewProductName');\n    var finalProductName = (nameInput && nameInput.value) ? nameInput.value.trim() : \"\";\n    var designInput = document.getElementById('adminDesignNumberInput');\n    var finalDesignId = (designInput && designInput.value) ? designInput.value.trim().toUpperCase() : \"02\";\n\n    if (modal) modal.style.display = 'none';\n\n    try {\n        var outboxId = await window.saveToOutbox(window.tempCamDocId, finalDesignId, window.tempCamPhotoPath, finalProductName);"
)

# 4. Update processCameraOutbox
content = content.replace(
    "var filename = `${item.docId}___${item.designId}_${item.ts}.jpg`;",
    "var safeName = item.productName ? encodeURIComponent(item.productName) : \"NA\";\n            var filename = `${item.docId}___${item.designId}___${safeName}___${item.ts}.jpg`;"
)

with open('www/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched app.js successfully")
