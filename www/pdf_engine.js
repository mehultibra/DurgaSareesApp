// ==========================================
// 🌸 DURGA SAREES: NATIVE PDF ENGINE (V6 - EDITABLE SLIDE REPLICA)
// Lightning Fast Client-Side Generation via Phone CPU
// ==========================================

const { jsPDF } = window.jspdf;

// 🧠 MEMORY HANDLER: Downloads High-Res Firebase Images to RAM
function getBase64ImageFromUrl(imageUrl) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.crossOrigin = "Anonymous"; // Crucial for Firebase Permissions
        
        img.onload = function () {
            var canvas = document.createElement("canvas");
            
            // ⚡ COMPRESSION: Compresses 4K Zoom files to 1200px.
            // This ensures the PDF generates in milliseconds and stays under WhatsApp's file limits.
            var maxDim = 1200;
            var w = img.width; 
            var h = img.height;
            if (w > maxDim || h > maxDim) {
                var r = Math.min(maxDim / w, maxDim / h);
                w = w * r; 
                h = h * r;
            }
            
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            
            // 0.75 JPEG Quality = Crisp Saree Details but tiny file size
            resolve(canvas.toDataURL("image/jpeg", 0.75)); 
        };
        
        img.onerror = function () { resolve(null); };
        img.src = imageUrl;
    });
}

// 🚀 MASTER FUNCTION: Generates the Catalog PDF
async function generateNativePDF(productName, productPrice, imageUrlsArray, actionType) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Creating PDF...";
    }

    try {
        // [960, 540] = EXACT Widescreen 16:9 Google Slide Dimensions in Points
        var doc = new jsPDF('l', 'pt', [960, 540]);

        for (var i = 0; i < imageUrlsArray.length; i++) {
            if (i > 0) doc.addPage();

            // Fetches instantly from RAM or downloads if missing
            var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);

            if (base64Img) {
                // 📏 DYNAMIC IMAGE SIZING (Prevents stretching)
                var targetHeight = 430; 
                var targetWidth = 900;  
                var imgProps = doc.getImageProperties(base64Img);
                var imgRatio = imgProps.width / imgProps.height;
                var finalW = targetHeight * imgRatio;
                var finalH = targetHeight;
                
                if (finalW > targetWidth) {
                    finalW = targetWidth;
                    finalH = targetWidth / imgRatio;
                }
                
                // Centers the image mathematically
                var xPos = (960 - finalW) / 2;
                var yPos = 70 + ((targetHeight - finalH) / 2); 

                doc.addImage(base64Img, 'JPEG', xPos, yPos, finalW, finalH);
            } else {
                doc.setFontSize(16); doc.setTextColor(150, 150, 150);
                doc.text("Image loading error", 480, 270, { align: "center" });
            }

            // ==========================================================
            // ✏️ TEMPLATE EDITOR (Change colors, sizes, and X/Y coords here!)
            // ==========================================================
            
            // 1️⃣ TOP TITLE TEXT
            doc.setFontSize(26);                  // Text Size
            doc.setFont("helvetica", "bold");     // Font Style
            doc.setTextColor(40, 44, 63);         // RGB Color (Dark Grey)
            var titleText = productName + (i === 0 ? " (Cover)" : " - Design " + i);
            // X: 480 (Center of 960 width), Y: 45 (Pixels down from Top)
            doc.text(titleText, 480, 45, { align: "center" });

            // 2️⃣ BOTTOM LEFT PRICE BADGE (The Pink Box)
            doc.setFillColor(226, 27, 112);       // RGB Color (Myntra Pink: #E21B70)
            // roundedRect(X, Y, Width, Height, CornerRadiusX, CornerRadiusY, 'F' = Fill)
            doc.roundedRect(30, 480, 200, 40, 10, 10, 'F'); 

            // 3️⃣ PRICE TEXT (Inside the Pink Box)
            doc.setFontSize(20);                  // Text Size
            doc.setTextColor(255, 255, 255);      // RGB Color (White Text)
            // X: 130 (Middle of the 200px box), Y: 508 (Middle of the height)
            doc.text("Rate: ₹" + productPrice, 130, 508, { align: "center" });
            
            // 4️⃣ BOTTOM RIGHT BRANDING
            doc.setFontSize(14);
            doc.setTextColor(150, 150, 150);      // RGB Color (Light Grey)
            doc.setFont("helvetica", "bolditalic");
            // X: 930 (Far Right), Y: 510 (Pixels down)
            doc.text("DURGA SAREES", 930, 510, { align: "right" });
            
            // ==========================================================
        }

        var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Catalog.pdf";

        // 🧠 NATIVE SHARE ROUTER
        if (actionType === 'wa' || actionType === 'print') {
            var pdfBlob = doc.output('blob');
            var file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: productName + ' Catalog',
                    files: [file]
                });
            } else {
                doc.save(fileName); // Fallback for PC
            }
        } else {
            doc.save(fileName);
        }

    } catch (error) {
        alert("PDF Generation Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}
// ==========================================
// ?? MULTI-IMAGE NATIVE SHARE ENGINE
// ==========================================

// Converts Base64 RAM data into native Android File Objects
function base64ToFile(base64Data, filename) {
    var arr = base64Data.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while(n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, {type: mime});
}

// ?? MASTER FUNCTION: Shares multiple images directly to WhatsApp
async function shareNativeImages(productName, productPrice, imageUrlsArray) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Preparing Images...";
    }

    try {
        var filesArray = [];
        
        // Loop through all images, fetch them, compress them, and turn them into Files
        for (var i = 0; i < imageUrlsArray.length; i++) {
            // Uses your existing lightning-fast memory fetcher/compressor
            var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);
            if (base64Img) {
                var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + ".jpg";
                filesArray.push(base64ToFile(base64Img, fileName));
            }
        }

        // 1. Ensure navigator.share actually exists (Requires HTTPS or localhost)
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: productName,
                    text: "🛍️ *" + productName + "*\n💰 Wholesale Rate: ₹" + productPrice,
                    files: filesArray
                });
            } catch (shareErr) {
                console.error("Share API failed:", shareErr);
                try {
                    await navigator.share({ files: filesArray });
                } catch (fallbackErr) {
                    alert("Your device's browser blocks native multi-image sharing. Error: " + fallbackErr.message);
                }
            }
        } else {
            // 2. Fallback: navigator.share is completely missing (HTTP environment or unsupported WebView)
            console.warn("navigator.share is not a function. Falling back to multi-file download.");
            alert("Native Share API is disabled (requires HTTPS or Native App). Downloading images to your device instead.");
            
            for (var j = 0; j < filesArray.length; j++) {
                var fileObj = filesArray[j];
                var objectUrl = URL.createObjectURL(fileObj);
                var a = document.createElement('a');
                a.href = objectUrl;
                a.download = fileObj.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Small delay to prevent browser from blocking rapid multi-downloads
                await new Promise(resolve => setTimeout(resolve, 300));
                URL.revokeObjectURL(objectUrl);
            }
        }
    } catch (error) {
        alert("Image Sharing Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}
