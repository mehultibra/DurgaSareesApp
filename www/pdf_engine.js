// ==========================================
// 🌸 DURGA SAREES: NATIVE PDF ENGINE
// Lightning Fast Client-Side Generation
// ==========================================

const { jsPDF } = window.jspdf;

// 🧠 HELPER: Converts an image URL into a Base64 string for the PDF
// It uses crossOrigin to bypass security blocks and utilizes the browser cache!
function getBase64ImageFromUrl(imageUrl) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.crossOrigin = "Anonymous"; // Required for Firebase Storage images
        img.onload = function () {
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            // Compresses to JPEG to keep the PDF file size small and fast
            var dataURL = canvas.toDataURL("image/jpeg", 0.7);
            resolve(dataURL);
        };
        img.onerror = function () {
            // If the image fails, return a blank placeholder so the PDF doesn't crash
            resolve(null);
        };
        img.src = imageUrl;
    });
}

// 🚀 MASTER FUNCTION: Generates the Catalog PDF
async function generateNativePDF(productName, productPrice, imageUrlsArray, actionType) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Generating PDF...";
    }

    try {
        var doc = new jsPDF('l', 'pt', [960, 540]);

        for (var i = 0; i < imageUrlsArray.length; i++) {
            if (i > 0) doc.addPage();

            var base64Img = await getBase64ImageFromUrl(imageUrlsArray[i]);

            if (base64Img) {
                var targetHeight = 450;
                var targetWidth = 337; 
                var xPos = (960 - targetWidth) / 2; 
                var yPos = 70; 

                doc.addImage(base64Img, 'JPEG', xPos, yPos, targetWidth, targetHeight);
            } else {
                doc.text("Image not loaded properly", 480, 270, { align: "center" });
            }

            // Text Formatting
            doc.setFontSize(28);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(226, 27, 112); 
            var titleText = productName + (i === 0 ? " (Cover)" : " (Design " + i + ")");
            doc.text(titleText, 480, 45, { align: "center" });

            doc.setFontSize(20);
            doc.setTextColor(0, 0, 0);
            doc.text("Wholesale Rate: ₹" + productPrice, 480, 520, { align: "center" });
        }

        var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Catalog.pdf";

        // 🧠 THE NATIVE SHARE MAGIC
        if (actionType === 'wa' || actionType === 'print') {
            // Converts the PDF to a proper File Object
            var pdfBlob = doc.output('blob');
            var file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // If the phone supports Native Sharing (Android Chrome/Safari does!)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: productName + ' Catalog',
                    text: 'Check out the ' + productName + ' Catalog!',
                    files: [file]
                });
            } else {
                // Fallback for PC/Old Phones
                doc.save(fileName);
                if (actionType === 'wa') alert("PDF downloaded! Please attach it to WhatsApp manually.");
            }
        } else {
            // Standard Download (Action: 'pdf')
            doc.save(fileName);
        }

    } catch (error) {
        alert("PDF Generation Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}