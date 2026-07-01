const https = require('https');

const bucket = "durga-sarees.firebasestorage.app";
const fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

// Just get an item from the list API
const listUrl = fbBase + "?prefix=Grid%2FPrint%2FAam%20papad%2F&delimiter=/";

https.get(listUrl, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.items && json.items.length > 0) {
                const item = json.items[0];
                const fullUrl = fbBase + encodeURIComponent(item.name) + "?alt=media";
                console.log("Full URL:", fullUrl);
                
                https.get(fullUrl, res2 => {
                    console.log("Fetch Status:", res2.statusCode);
                    console.log("Headers:", res2.headers);
                });
            } else {
                console.log("No items found");
            }
        } catch(e) { console.error(e); }
    });
});
