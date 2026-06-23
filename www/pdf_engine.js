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

// ==========================================
// 🌸 DURGA SAREES: NATIVE PDF ENGINE (A4 CATALOG LAYOUT)
// Lightning Fast Client-Side Generation via Phone CPU
// ==========================================

async function generateNativePDF(product, imageUrlsArray, actionType) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Generating Formatted PDF...";
    }

    try {
        // 📏 CREATE A4 PORTRAIT DOCUMENT (Width: 595pt, Height: 842pt)
        var doc = new jsPDF('p', 'pt', 'a4');
        var pageWidth = 595;
        var pageHeight = 842;

        for (var i = 0; i < imageUrlsArray.length; i++) {
            if (i > 0) doc.addPage();

            // Fetch High-Res Zoom Image to RAM
            var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);

            // ==========================================================
            // 📑 PAGE 1: THE FORMATTED DATA COVER PAGE
            // ==========================================================
            if (i === 0) {
                // 1️⃣ TOP RIGHT: Date
                var today = new Date();
                var dateStr = ("0" + today.getDate()).slice(-2) + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + today.getFullYear();
                doc.setFontSize(12);
                doc.setTextColor(100, 100, 100);
                doc.text("Date: " + dateStr, pageWidth - 40, 40, { align: "right" });

                // 2️⃣ TOP CENTER: Headlines
                doc.setFontSize(28);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(226, 27, 112); // Myntra Pink
                doc.text("DURGA SAREES", pageWidth / 2, 70, { align: "center" });

                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 102, 204); // Blue Link
                doc.textWithLink("(Click for all variety)", pageWidth / 2, 90, { url: 'https://durgasarees.com', align: "center" });

                doc.setFontSize(22);
                doc.setTextColor(0, 0, 0); // Black
                doc.setFont("helvetica", "bold");
                doc.text(product.name, pageWidth / 2, 130, { align: "center" });

                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 102, 204);
                doc.text("(Click for Ready Designs)", pageWidth / 2, 150, { align: "center" });

                // 3️⃣ LEFT COLUMN: Data Attributes Table
                var startX = 40;   // Left margin
                var startY = 220;  // Pixels down from top
                var lineH = 32;    // Spacing between each row
                
                doc.setFontSize(14);
                
                // Helper function to draw rows perfectly aligned
                function drawRow(label, value, yPos) {
                    doc.setTextColor(0, 0, 0);
                    doc.setFont("helvetica", "bold");
                    doc.text(label, startX, yPos);
                    doc.setFont("helvetica", "normal");
                    doc.text(":   " + (value ? String(value) : "-"), startX + 80, yPos); // 80px gap for perfect column alignment
                }

                drawRow("Quality", product.fabric, startY);
                drawRow("Code", product.sku, startY + lineH);
                drawRow("D No", "₹ " + product.price, startY + lineH * 2);
                drawRow("Jari", product.jari, startY + lineH * 3);
                drawRow("Border", product.border, startY + lineH * 4);
                drawRow("Cut", product.cut, startY + lineH * 5);
                drawRow("Pallu", product.pallu, startY + lineH * 6);
                drawRow("Blouse", product.blouse, startY + lineH * 7);
                drawRow("Packing", product.packing, startY + lineH * 8);

                // 4️⃣ RIGHT COLUMN: Cover Image
                if (base64Img) {
                    var targetW = 260; // Max Image Width
                    var targetH = 380; // Max Image Height
                    var imgProps = doc.getImageProperties(base64Img);
                    var imgRatio = imgProps.width / imgProps.height;
                    
                    var finalW = targetH * imgRatio;
                    var finalH = targetH;
                    if (finalW > targetW) { finalW = targetW; finalH = targetW / imgRatio; }
                    
                    // Coordinates: X = 290 (Right side of page), Y = 190
                    doc.addImage(base64Img, 'JPEG', 290, 190, finalW, finalH);
                }

                // 5️⃣ BOTTOM CENTER: Footer Text
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(226, 27, 112); // Pink Warning
                doc.text("Click On image to view all Ready Designs of this product", pageWidth / 2, 780, { align: "center" });
            } 
            
            // ==========================================================
            // 📑 PAGE 2+: FULL SCREEN READY DESIGNS
            // ==========================================================
            else {
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(40, 44, 63);
                doc.text(product.name + " - Design " + i, pageWidth / 2, 40, { align: "center" });

                if (base64Img) {
                    var targetW = 500; 
                    var targetH = 720;  
                    var imgProps = doc.getImageProperties(base64Img);
                    var imgRatio = imgProps.width / imgProps.height;
                    
                    var finalW = targetH * imgRatio;
                    var finalH = targetH;
                    if (finalW > targetW) { finalW = targetW; finalH = targetW / imgRatio; }
                    
                    var xPos = (pageWidth - finalW) / 2;
                    var yPos = 60 + ((targetH - finalH) / 2); 
                    doc.addImage(base64Img, 'JPEG', xPos, yPos, finalW, finalH);
                }
            }
        }

        var fileName = product.name.replace(/[^a-zA-Z0-9]/g, "_") + "_Catalog.pdf";

        // 🧠 NATIVE ROUTING ENGINE (Including Visual Preview)
        if (actionType === 'preview') {
            // Opens the PDF visually right in the browser for testing!
            doc.output('dataurlnewwindow');
        } 
        else if (actionType === 'wa' || actionType === 'print') {
            var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem);
            
            if (isCapacitor) {
                var pureBase64 = doc.output('datauristring').split(',')[1];
                var writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                    path: fileName,
                    data: pureBase64,
                    directory: "CACHE"
                });
                await window.Capacitor.Plugins.Share.share({
                    title: product.name + ' Catalog',
                    files: [writeResult.uri]
                });
            } else {
                // WEB FALLBACK
                var pdfBlob = doc.output('blob');
                var file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (typeof navigator.share === 'function') {
                    try { await navigator.share({ title: product.name + ' Catalog', files: [file] }); } catch (e) { doc.save(fileName); }
                } else {
                    doc.save(fileName); 
                }
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
        var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem);
        var nativeSuccess = false;

        if (isCapacitor) {
            try {
                // ============================================
                // 🚀 CAPACITOR NATIVE ANDROID SHARE
                // ============================================
                var uriArray = [];
                for (var i = 0; i < imageUrlsArray.length; i++) {
                    var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);
                    if (base64Img) {
                        var pureBase64 = base64Img.split(',')[1];
                        var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + ".jpg";
                        var writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                            path: fileName,
                            data: pureBase64,
                            directory: "CACHE"
                        });
                        uriArray.push(writeResult.uri);
                    }
                }
                
                await window.Capacitor.Plugins.Share.share({
                    title: productName,
                    text: "🛍️ *" + productName + "*\n💰 Wholesale Rate: ₹" + productPrice,
                    files: uriArray
                });
                nativeSuccess = true;
            } catch (nativeErr) {
                console.warn("Native plugins not compiled in this APK. Falling back to web share.", nativeErr);
            }
        }
        
        if (!nativeSuccess) {
            // ============================================
            // 🌐 STANDARD WEB BROWSER FALLBACK
            // ============================================
            var filesArray = [];
            for (var i = 0; i < imageUrlsArray.length; i++) {
                var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);
                if (base64Img) {
                    var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + ".jpg";
                    filesArray.push(base64ToFile(base64Img, fileName));
                }
            }

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
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    URL.revokeObjectURL(objectUrl);
                }
            }
        }
    } catch (error) {
        alert("Image Sharing Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}
