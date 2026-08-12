const functions = require('firebase-functions/v1');
exports.processCameraImage = functions.storage.object().onFinalize(async (object) => {
    const admin = require('firebase-admin');
    const cloudinary = require('cloudinary').v2;
    const axios = require('axios');
    const piexif = require('piexifjs');

    // Lazy Initialization of Firebase Admin to prevent deployment timeouts
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }

    // Initialize Cloudinary config lazily to ensure environment variables are fully loaded
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    const filePath = object.name;
    const bucketName = object.bucket;

    // Trigger strictly for files in Uploads/Temp_Staging/ or Uploads/Raw/
    if (!filePath || (!filePath.startsWith('Uploads/Temp_Staging/') && !filePath.startsWith('Uploads/Raw/'))) {
        return null;
    }

    const filename = filePath.split('/').pop();

    // Parse filename: [docId]___[designId]_[timestamp].jpg
    const parts = filename.replace('.jpg', '').split('___');
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
    }

    const bucket = admin.storage().bucket(bucketName);
    const db = admin.firestore();

    try {
        // Query Firestore Products collection using docId to retrieve actual gridUrl
        const productRef = db.collection('Products').doc(docId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            console.error(`Product docId [${docId}] not found in Firestore.`);
            return null;
        }

        const product = productDoc.data();
        let finalGridUrl = product.gridUrl;
        let finalZoomUrl = product.zoomUrl;

        if (!finalGridUrl) {
            console.error(`Product [${docId}] lacks a valid gridUrl mapping.`);
            return null;
        }

        const productName = customName || product.name || 'Durga Sarees';
        if (customName && product.name !== customName) {
            await productRef.update({ name: customName }).catch(e => console.error("Failed to update product name:", e));
        }
        const dsNum = parseInt(designId.replace(/\D/g, ''));
        const formattedDesignId = (isNaN(dsNum) ? designId : String(dsNum).padStart(2, '0'));

        // Upload raw buffer to Cloudinary to apply Chained Eager Transformations
        const file = bucket.file(filePath);
        const [buffer] = await file.download();

        const isBypass = filename.includes('___BYPASS');

        const eagerTransformations = isBypass ? [
            // Grid (360px WebP)
            { transformation: [{ width: 360, crop: 'scale' }, { fetch_format: 'webp' }] },
            // Zoom (1080px WebP)
            { transformation: [{ width: 1080, crop: 'scale' }, { fetch_format: 'webp' }] },
            // Master (Original JPG)
            { transformation: [{ fetch_format: 'jpg' }] },
            // Share (1024px JPG)
            { transformation: [{ width: 1024, crop: 'scale' }, { fetch_format: 'jpg' }] }
        ] : [
            {
                transformation: [
                    { effect: 'improve' }, { effect: 'brightness:15' }, { effect: 'saturation:20' }, { effect: 'contrast:10' }, { effect: 'sharpen:50' },
                    { width: 1080, crop: 'scale' },
                    { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.21, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                    { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'rgb:13888F' },
                    { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'rgb:13888F' },
                    { width: 360, crop: 'scale' },
                    { fetch_format: 'webp' }
                ]
            },
            {
                transformation: [
                    { effect: 'improve' }, { effect: 'brightness:15' }, { effect: 'saturation:20' }, { effect: 'contrast:10' }, { effect: 'sharpen:50' },
                    { width: 1080, crop: 'scale' },
                    { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.21, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                    { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'rgb:13888F' },
                    { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'rgb:13888F' },
                    { fetch_format: 'webp' }
                ]
            },
            { transformation: [{ effect: 'improve' }, { effect: 'brightness:15' }, { effect: 'saturation:20' }, { effect: 'contrast:10' }, { effect: 'sharpen:50' }, { fetch_format: 'jpg' }] },
            {
                transformation: [
                    { effect: 'improve' }, { effect: 'brightness:15' }, { effect: 'saturation:20' }, { effect: 'contrast:10' }, { effect: 'sharpen:50' },
                    { width: 1080, crop: 'scale' },
                    { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.21, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                    { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'rgb:13888F' },
                    { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'rgb:13888F' },
                    { width: 1024, crop: 'scale' },
                    { fetch_format: 'jpg' }
                ]
            }
        ];

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
                folder: 'DurgaSareesTemp',
                eager: eagerTransformations,
                eager_async: false // Wait for transformations to complete
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
            uploadStream.end(buffer);
        });

        if (!uploadResult.eager || uploadResult.eager.length < 4) {
            console.error(`Cloudinary eager transformations failed or returned incomplete for ${filename}. Result:`, JSON.stringify(uploadResult.eager));
            return null; // Exit gracefully to prevent Firebase crash and broken URLs
        }

        // Check if secure_url exists (in case eager failed internally)
        if (!uploadResult.eager[0].secure_url || !uploadResult.eager[1].secure_url || !uploadResult.eager[2].secure_url || !uploadResult.eager[3].secure_url) {
            console.error(`Cloudinary eager transformations returned errors for ${filename}. Result:`, JSON.stringify(uploadResult.eager));
            return null;
        }

        // Download ALL VERSIONS from Cloudinary
        const gridUrlCloudinary = uploadResult.eager[0].secure_url;
        const zoomUrlCloudinary = uploadResult.eager[1].secure_url;
        const masterUrlCloudinary = uploadResult.eager[2].secure_url;
        const shareUrlCloudinary = uploadResult.eager[3].secure_url;

        const [gridResponse, zoomResponse, masterResponse, shareResponse] = await Promise.all([
            axios.get(gridUrlCloudinary, { responseType: 'arraybuffer' }),
            axios.get(zoomUrlCloudinary, { responseType: 'arraybuffer' }),
            axios.get(masterUrlCloudinary, { responseType: 'arraybuffer' }),
            axios.get(shareUrlCloudinary, { responseType: 'arraybuffer' })
        ]);

        const gridBuffer = Buffer.from(gridResponse.data, 'binary');
        const zoomBuffer = Buffer.from(zoomResponse.data, 'binary');
        let masterBuffer = Buffer.from(masterResponse.data, 'binary');
        const shareBuffer = Buffer.from(shareResponse.data, 'binary');

        // Apply EXIF Tagging for NAS Backup
        try {
            const masterBase64 = masterBuffer.toString('binary');
            const exifObj = {
                "0th": {
                    [piexif.ImageIFD.Software]: "App"
                }
            };
            const exifBytes = piexif.dump(exifObj);
            const taggedMasterBase64 = piexif.insert(exifBytes, masterBase64);
            masterBuffer = Buffer.from(taggedMasterBase64, 'binary');
        } catch (exifErr) {
            console.error("EXIF Tagging failed for master backup:", exifErr);
            // Non-fatal, continue with untagged masterBuffer
        }

        // THE STORAGE OVERWRITE COLLISION LOGIC
        if (!finalZoomUrl || finalZoomUrl.toLowerCase() === 'none' || finalZoomUrl === finalGridUrl) {
            finalZoomUrl = finalGridUrl.endsWith('/') ? finalGridUrl.slice(0, -1) + '_HD/' : finalGridUrl + '_HD/';
            // Update the Firestore document so the mobile app knows where to look for the Zoom images
            await productRef.update({ zoomUrl: finalZoomUrl });
        }

        // Format paths ensuring trailing slashes
        finalGridUrl = finalGridUrl.endsWith('/') ? finalGridUrl : finalGridUrl + '/';
        finalZoomUrl = finalZoomUrl.endsWith('/') ? finalZoomUrl : finalZoomUrl + '/';

        const destFileName = designId.toLowerCase() === 'cover' ? 'cover.webp' : `${designId}.webp`;

        // Save Grid Buffer to Firebase
        await bucket.file(`${finalGridUrl}${destFileName}`).save(gridBuffer, { metadata: { contentType: 'image/webp', metadata: { source: '888' } } });

        // Save Zoom Buffer to Firebase
        await bucket.file(`${finalZoomUrl}${destFileName}`).save(zoomBuffer, { metadata: { contentType: 'image/webp', metadata: { source: '888' } } });

        // Save Share JPG Buffer to Firebase in Jpg folder
        const shareDestName = designId.toLowerCase() === 'cover' ? 'cover.jpg' : `${designId}.jpg`;
        const shareInputPath = finalGridUrl.replace(/^(Grid|Zoom)\//i, 'Jpg/') + shareDestName;
        await bucket.file(shareInputPath).save(shareBuffer, { metadata: { contentType: 'image/jpeg', metadata: { source: '888' } } });

        // Save Master Buffer to NAS input path mirroring Grid path
        const masterDestName = designId.toLowerCase() === 'cover' ? 'cover.jpg' : `${designId}.jpg`;
        const masterInputPath = finalGridUrl.replace(/^(Grid|Zoom)\//i, 'Input/') + masterDestName;
        await bucket.file(masterInputPath).save(masterBuffer, { metadata: { contentType: 'image/jpeg', metadata: { source: '888' } } });

        console.log(`Success: Generated ${destFileName} at ${finalGridUrl} and ${finalZoomUrl}. Master saved to ${masterInputPath}`);
        
        // Touch the product document to bump its updateTime so it sorts to the top of the main grid
        await productRef.update({ latestImageAddedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(e => console.error("Failed to bump updateTime:", e));

        // Delete the staging file since processing succeeded
        await file.delete();
        console.log(`Cleaned up temp staging file: ${filePath}`);

        return null;

    } catch (error) {
        console.error(`Fatal Pipeline Error processing ${filename}:`, error);

        // Move to Errors folder so it can be retried later, instead of deleting it!
        try {
            await file.move(`Uploads/Errors/${filename}`);
            console.log(`Moved failed file to Uploads/Errors/${filename}`);
        } catch (errMove) {
            console.error('Could not move to errors folder:', errMove);
        }
        return null;
    }
});

exports.syncFromExcel = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const admin = require('firebase-admin');
        if (admin.apps.length === 0) admin.initializeApp();

        const data = req.body;
        if (!data || !data.productName) {
            return res.status(400).json({ error: 'Missing productName' });
        }

        const db = admin.firestore();
        const snapshot = await db.collection('Products').where('name', '==', data.productName).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const doc = snapshot.docs[0];
        const updates = {};
        if (data.price !== undefined) updates.price = parseInt(data.price) || 0;
        if (data.packing !== undefined) updates.packing = String(data.packing);

        if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
        }

        res.json({ success: true, docId: doc.id, updates });
    } catch (err) {
        console.error('syncFromExcel Error:', err);
        res.status(500).json({ error: err.message });
    }
});

exports.cleanupDuplicateJpgs = functions.https.onRequest(async (req, res) => {
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) admin.initializeApp();

    try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles();

        const jpgFiles = files.filter(file => {
            const name = file.name;
            const isGridOrZoom = name.includes('/Grid/') || name.includes('/Zoom/') || name.startsWith('Grid/') || name.startsWith('Zoom/');
            return isGridOrZoom && name.toLowerCase().endsWith('.jpg');
        });

        const webpFiles = new Set(files.filter(file => {
            const name = file.name;
            const isGridOrZoom = name.includes('/Grid/') || name.includes('/Zoom/') || name.startsWith('Grid/') || name.startsWith('Zoom/');
            return isGridOrZoom && name.toLowerCase().endsWith('.webp');
        }).map(file => file.name));

        const deletedFiles = [];
        const ignoredFiles = [];

        // Run deletions in batches of 10 to avoid hitting API rate limits
        for (let i = 0; i < jpgFiles.length; i += 10) {
            const batch = jpgFiles.slice(i, i + 10);
            await Promise.all(batch.map(async (file) => {
                const webpName = file.name.replace(/\.jpg$/i, '.webp');
                if (webpFiles.has(webpName)) {
                    await file.delete();
                    deletedFiles.push(file.name);
                } else {
                    ignoredFiles.push(file.name);
                }
            }));
        }

        res.json({
            success: true,
            message: `Cleanup Complete. Deleted ${deletedFiles.length} duplicate JPGs. Ignored ${ignoredFiles.length} solo JPGs.`,
            deletedFiles: deletedFiles,
            ignoredFiles: ignoredFiles
        });
    } catch (error) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ error: error.message });
    }
});

exports.getMasterCache = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        return res.status(204).send('');
    }

    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    const bucket = admin.storage().bucket();
    
    try {
        const [files] = await bucket.getFiles();
        const cache = {};
        
        files.forEach(file => {
            const path = file.name;
            // Only process Grid and App_Grid images
            if (!path.startsWith('Grid/') && !path.startsWith('App_Grid/')) return;
            if (!path.endsWith('.webp') && !path.endsWith('.jpg') && !path.endsWith('.png')) return;
            
            const parts = path.split('/');
            const filename = parts.pop();
            const folderPath = parts.join('/');
            
            // Remove extension to save space in the cache string (e.g., '01.webp' -> '01')
            const basename = filename.substring(0, filename.lastIndexOf('.'));
            
            if (!cache[folderPath]) {
                cache[folderPath] = [];
            }
            cache[folderPath].push(basename);
        });

        const compressedCache = {};
        for (const folder in cache) {
            compressedCache[folder] = cache[folder].join(',');
        }

        // Cache heavily on the CDN for 15 minutes (900 seconds)
        res.set('Cache-Control', 'public, max-age=900, s-maxage=900');
        res.json({ success: true, cache: compressedCache });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

