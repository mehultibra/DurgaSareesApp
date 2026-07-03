const functions = require('firebase-functions');
exports.processCameraImage = functions.storage.object().onFinalize(async (object) => {
    const admin = require('firebase-admin');
    const cloudinary = require('cloudinary').v2;
    const axios = require('axios');

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

    // Trigger strictly for files in Uploads/Raw/
    if (!filePath || !filePath.startsWith('Uploads/Raw/')) {
        return null;
    }

    const filename = filePath.split('/').pop();

    // Parse filename: [docId]___[designId]_[timestamp].jpg
    const parts = filename.replace('.jpg', '').split('___');
    if (parts.length < 2) {
        console.error("Invalid filename architecture:", filename);
        return null;
    }

    const docId = parts[0];
    const designIdAndTimestamp = parts[1].split('_');
    const designId = designIdAndTimestamp[0];

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

        // Upload raw buffer to Cloudinary to apply Chained Eager Transformations
        const file = bucket.file(filePath);
        const [buffer] = await file.download();

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
                folder: 'DurgaSareesTemp',
                eager: [
                    { transformation: [ { effect: 'auto_color' }, { effect: 'improve' }, { overlay: 'durga_watermark', gravity: 'south_east', x: 20, y: 20, opacity: 60 }, { width: 300, crop: 'fill', format: 'webp' } ] },
                    { transformation: [ { effect: 'auto_color' }, { effect: 'improve' }, { overlay: 'durga_watermark', gravity: 'south_east', x: 20, y: 20, opacity: 60 }, { width: 1024, crop: 'limit', format: 'webp' } ] }
                ],
                eager_async: false // Wait for transformations to complete
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
            uploadStream.end(buffer);
        });

        // Download BOTH VERSIONS from Cloudinary
        const gridUrlCloudinary = uploadResult.eager[0].secure_url;
        const zoomUrlCloudinary = uploadResult.eager[1].secure_url;

        const [gridResponse, zoomResponse] = await Promise.all([
            axios.get(gridUrlCloudinary, { responseType: 'arraybuffer' }),
            axios.get(zoomUrlCloudinary, { responseType: 'arraybuffer' })
        ]);

        const gridBuffer = Buffer.from(gridResponse.data, 'binary');
        const zoomBuffer = Buffer.from(zoomResponse.data, 'binary');

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
        await bucket.file(`${finalGridUrl}${destFileName}`).save(gridBuffer, { metadata: { contentType: 'image/webp' } });
        
        // Save Zoom Buffer to Firebase
        await bucket.file(`${finalZoomUrl}${destFileName}`).save(zoomBuffer, { metadata: { contentType: 'image/webp' } });

        console.log(`Success: Generated ${destFileName} at ${finalGridUrl} and ${finalZoomUrl}`);

        // Delete the original raw upload to keep storage optimized
        await file.delete();
        console.log(`Cleaned up original raw file: ${filePath}`);

        return null;

    } catch (error) {
        console.error(`Fatal Pipeline Error processing ${filename}:`, error);
        return null;
    }
});
