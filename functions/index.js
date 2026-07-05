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

        const productName = product.name || 'Durga Sarees';
        const dsNum = parseInt(designId.replace(/\D/g, ''));
        const formattedDesignId = (isNaN(dsNum) ? designId : String(dsNum).padStart(2, '0'));

        // Upload raw buffer to Cloudinary to apply Chained Eager Transformations
        const file = bucket.file(filePath);
        const [buffer] = await file.download();

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
                folder: 'DurgaSareesTemp',
                eager: [
                    { transformation: [
                        { effect: 'auto_color' }, 
                        { width: 360, height: 450, crop: 'fill', gravity: 'auto' }, 
                        { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.19, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                        { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'white', effect: 'shadow:40' },
                        { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'white', effect: 'shadow:40' },
                        { fetch_format: 'webp' }
                    ] },
                    { transformation: [
                        { effect: 'auto_color' }, 
                        { width: 1080, height: 1350, crop: 'fill', gravity: 'auto' }, 
                        { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.19, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                        { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'white', effect: 'shadow:40' },
                        { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'white', effect: 'shadow:40' },
                        { fetch_format: 'webp' }
                    ] },
                    { transformation: [{ effect: 'auto_color' }, { effect: 'improve' }, { fetch_format: 'jpg' }] },
                    { transformation: [
                        { effect: 'auto_color' }, 
                        { width: 1024, crop: 'scale' }, 
                        { overlay: 'durga_watermark.png', effect: 'make_transparent:10', width: 0.19, flags: 'relative', gravity: 'north_west', x: 20, y: 20 },
                        { overlay: { font_family: 'Playfair Display', font_size: 50, font_weight: 'bold', text: productName }, gravity: 'north', y: 60, color: 'white', effect: 'shadow:40' },
                        { overlay: { font_family: 'Arial', font_size: 34, font_weight: 'bold', text: 'Vol ' + formattedDesignId }, gravity: 'north', y: 140, color: 'white', effect: 'shadow:40' },
                        { fetch_format: 'jpg' }
                    ] }
                ],
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

        // Save Share JPG Buffer to Firebase alongside Grid
        const shareDestName = designId.toLowerCase() === 'cover' ? 'cover.jpg' : `${designId}.jpg`;
        await bucket.file(`${finalGridUrl}${shareDestName}`).save(shareBuffer, { metadata: { contentType: 'image/jpeg', metadata: { source: '888' } } });

        // Save Master Buffer to NAS input path mirroring Grid path
        const masterDestName = designId.toLowerCase() === 'cover' ? 'cover.jpg' : `${designId}.jpg`;
        const masterInputPath = finalGridUrl.replace(/^(Grid|Zoom)\//i, 'Input/') + masterDestName;
        await bucket.file(masterInputPath).save(masterBuffer, { metadata: { contentType: 'image/jpeg', metadata: { source: '888' } } });

        console.log(`Success: Generated ${destFileName} at ${finalGridUrl} and ${finalZoomUrl}. Master saved to ${masterInputPath}`);
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
