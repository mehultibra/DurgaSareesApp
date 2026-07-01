const https = require('https');

const bucket = "durga-sarees.firebasestorage.app";

function fetchProducts() {
    https.get("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products?pageSize=10", res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const doc = json.documents[0];
                const gridUrl = doc.fields.gridUrl.stringValue;
                const zoomUrl = doc.fields.zoomUrl ? doc.fields.zoomUrl.stringValue : gridUrl;
                console.log("Found product gridUrl:", gridUrl);
                console.log("Found product zoomUrl:", zoomUrl);
                
                testPrefix(gridUrl);
            } catch(e) {
                console.error("Error parsing", e);
            }
        });
    });
}

function testPrefix(gridUrl) {
    let cleanGridPath = gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
    
    // openDetail style:
    let prefix1 = cleanGridPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
    const url1 = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?prefix=${prefix1}&delimiter=/`;

    // manageProductHDCache style:
    let encPath = cleanGridPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    const url2 = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/?prefix=${encPath}%2F&delimiter=/`;

    fetchUrl(url1, "URL 1 (openDetail style uses slash)");
    fetchUrl(url2, "URL 2 (manageProduct style uses %2F)");
}

function fetchUrl(url, label) {
    console.log(`\nFetching ${label}: ${url}`);
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Response for ${label} (Status ${res.statusCode}):`);
            try {
                const json = JSON.parse(data);
                console.log(`Prefixes found: ${json.prefixes ? json.prefixes.length : 0}`);
                console.log(`Items found: ${json.items ? json.items.length : 0}`);
            } catch(e) {
                console.log("Error parsing JSON:", data.substring(0, 100));
            }
        });
    }).on('error', err => {
        console.error(`Error fetching ${label}:`, err.message);
    });
}

fetchProducts();
