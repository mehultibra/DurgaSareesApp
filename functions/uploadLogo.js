const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const env = fs.readFileSync('.env', 'utf8').split('\n');
let creds = {};
env.forEach(line => {
    let parts = line.split('=');
    if (parts.length >= 2) {
        // Strip quotes and carriage returns
        creds[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"\r]/g, '');
    }
});

cloudinary.config({
    cloud_name: creds.CLOUDINARY_CLOUD_NAME,
    api_key: creds.CLOUDINARY_API_KEY,
    api_secret: creds.CLOUDINARY_API_SECRET
});

console.log("Uploading logo to Cloudinary...");

cloudinary.uploader.upload("../www/logo.png", { public_id: "durga_watermark" })
    .then((result) => console.log("Logo uploaded successfully:", result.secure_url))
    .catch((error) => console.error("Upload error:", error));
