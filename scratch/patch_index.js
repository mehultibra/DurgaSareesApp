const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf-8');

// 1. Change Cloudinary text color to rgb:13888F (Rama)
content = content.replace(/color: 'white'/g, "color: 'rgb:13888F'");

// 2. Filename parsing logic
const oldParse = `    const parts = filename.replace('.jpg', '').split('___');
    if (parts.length < 2) {
        console.error("Invalid filename architecture:", filename);
        return null;
    }

    const docId = parts[0];
    const designIdAndTimestamp = parts[1].split('_');
    const designId = designIdAndTimestamp[0];`;

const newParse = `    const parts = filename.replace('.jpg', '').split('___');
    if (parts.length < 2) {
        console.error("Invalid filename architecture:", filename);
        return null;
    }

    let docId = parts[0];
    let designId;
    let customName = null;

    if (parts.length >= 4) {
        designId = parts[1];
        if (parts[2] && parts[2] !== 'NA') {
            customName = decodeURIComponent(parts[2]);
        }
    } else {
        const designIdAndTimestamp = parts[1].split('_');
        designId = designIdAndTimestamp[0];
    }`;

content = content.replace(oldParse, newParse);

// 3. Database Update logic
const oldDbLogic = `    try {
        // Query Firestore Products collection using docId to retrieve actual gridUrl
        const productRef = db.collection('Products').doc(docId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            console.error(\`Product docId [\${docId}] not found in Firestore.\`);
            return null;
        }

        const product = productDoc.data();
        let finalGridUrl = product.gridUrl;
        let finalZoomUrl = product.zoomUrl;

        if (!finalGridUrl) {
            console.error(\`Product [\${docId}] lacks a valid gridUrl mapping.\`);
            return null;
        }

        const productName = product.name || 'Durga Sarees';`;

const newDbLogic = `    try {
        // Query Firestore Products collection using docId to retrieve actual gridUrl
        const productRef = db.collection('Products').doc(docId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            console.error(\`Product docId [\${docId}] not found in Firestore.\`);
            return null;
        }

        const product = productDoc.data();
        let finalGridUrl = product.gridUrl;
        let finalZoomUrl = product.zoomUrl;

        if (!finalGridUrl) {
            console.error(\`Product [\${docId}] lacks a valid gridUrl mapping.\`);
            return null;
        }

        const productName = customName || product.name || 'Durga Sarees';
        if (customName && product.name !== customName) {
            await productRef.update({ name: customName }).catch(e => console.error("Failed to update product name:", e));
        }`;

content = content.replace(oldDbLogic, newDbLogic);

fs.writeFileSync('functions/index.js', content, 'utf-8');
console.log("Patched index.js successfully");
