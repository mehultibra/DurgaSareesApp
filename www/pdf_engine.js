// ==========================================
// 🌸 DURGA SAREES: PDF ENGINE (V7 - CART PDF + WIX LINKS)
// ==========================================

const WEBSITE_BASE = "https://www.durgasarees.com";
const WEBSITE_PRODUCT_BASE = "https://www.durgasarees.com/product-page/";

// Build Wix product URL from SKU and product name
function buildWixProductUrl(product) {
    var sku = (product.sku || "").trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    var nameSlug = (product.name || "").trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
    if (sku && nameSlug) {
        return WEBSITE_PRODUCT_BASE + sku + '-' + nameSlug;
    } else if (nameSlug) {
        return WEBSITE_PRODUCT_BASE + nameSlug;
    }
    return WEBSITE_BASE;
}

// ==========================================
// 🧠 IMAGE HELPER: Blob → base64 via FileReader
// ZERO canvas, ZERO compression — images are already small (10-20kb)
// Works with any format: WebP, JPEG, PNG
// ==========================================
/**
 * ENGINE 1: ZERO-CANVAS BLOB STREAMER (blobToBase64Direct)
 * Dedicated pipeline for multi-file native sharing (e.g., WhatsApp bundles).
 * Near 0MB memory overhead.
 */
function blobToBase64Direct(blob) {
    return new Promise(function(resolve) {
        if (!blob) { resolve(null); return; }
        if (blob.size === 0) {
            if (typeof window.logAppError === 'function') window.logAppError('Zero Byte Corrupt Image', 'PDF Engine Blob | Unknown');
            resolve(null);
            return;
        }
        var fr = new FileReader();
        fr.onload = function() { resolve(fr.result); };
        fr.onerror = function() { resolve(null); };
        fr.readAsDataURL(blob);
    });
}

/**
 * ENGINE 2: SINGLE-INSTANCE TRANSCODER (blobToJpegForPDF)
 * Dedicated pipeline for jsPDF multi-page document construction.
 * Downsamples heavy WebP to 0.70 quality JPEGs to fix the 3MB+ PDF bloat issue.
 */
function blobToJpegForPDF(blob) {
    return new Promise(function(resolve) {
        if (!blob) { resolve(null); return; }
        if (blob.size === 0) {
            if (typeof window.logAppError === 'function') window.logAppError('Zero Byte Corrupt Image', 'PDF Engine Blob | Unknown');
            resolve(null);
            return;
        }
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; // Solve alpha
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            var jpegData = canvas.toDataURL('image/jpeg', 0.70);
            URL.revokeObjectURL(url);
            resolve(jpegData);
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            // Fallback to FileReader if Image load fails
            var fr = new FileReader();
            fr.onload = function() { resolve(fr.result); };
            fr.onerror = function() { resolve(null); };
            fr.readAsDataURL(blob);
        };
        img.src = url;
    });
}

/**
 * ROUTING & DOWNGRADE INTERCEPTOR
 * forceJpeg = false -> Engine 1 (Sharing)
 * forceJpeg = true  -> Engine 2 (PDF)
 */
function getBase64FromCache(cacheKey, forceJpeg = false) {
    var isCoverOrGarbage = false;
    if (cacheKey) {
        if (cacheKey.includes('cover.webp')) isCoverOrGarbage = true;
        if (/(%2F|\/)[0-9]{5,}\.webp\?alt=media/i.test(cacheKey)) isCoverOrGarbage = true;
    }

    function networkFallback(url) {
        if (!url || !url.startsWith('http')) return Promise.resolve(null);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);
        
        var fallbacks = [url];
        if (isCoverOrGarbage) {
            var extIndex = url.indexOf('.webp?alt=media');
            if (extIndex > -1) {
                var lastSlash = Math.max(url.lastIndexOf('%2F'), url.lastIndexOf('/'));
                if (lastSlash > -1 && lastSlash < extIndex) {
                    var folderUrl = url.substring(0, lastSlash + (url.charAt(lastSlash) === '%' ? 3 : 1));
                    var c1 = folderUrl + 'cover1.webp?alt=media';
                    var c2 = folderUrl + '01.webp?alt=media';
                    var c3 = folderUrl + '1.webp?alt=media';
                    if (fallbacks.indexOf(c1) === -1) fallbacks.push(c1);
                    if (fallbacks.indexOf(c2) === -1) fallbacks.push(c2);
                    if (fallbacks.indexOf(c3) === -1) fallbacks.push(c3);
                }
            }
        }

        function tryNext(index) {
            if (index >= fallbacks.length) {
                // Ultimate Fallback: Query Firebase folder for ANY image
                if (isCoverOrGarbage) {
                    try {
                        var bucket = "durga-sarees.firebasestorage.app";
                        var urlObj = new URL(url);
                        var pathName = decodeURIComponent(urlObj.pathname.split('/o/')[1]); 
                        var fwdPath = pathName.substring(0, pathName.lastIndexOf('/'));
                        var listPrefix = fwdPath.split('/').map(function(s) { return encodeURIComponent(s); }).join('/') + '/';
                        var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";
                        
                        return window.fetchWithRetry(listUrl, {}, 0) // ZERO retries for faster offline failure
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                var files = (data.items || [])
                                    .map(function(item) { return item.name.substring(item.name.lastIndexOf('/') + 1); })
                                    .filter(function(f) { return /\.(webp|jpg|jpeg|png)$/i.test(f); });
                                if (files.length > 0) {
                                    files.sort(function(a, b) { return (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999); });
                                    var finalUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/" + fwdPath.split('/').map(function(s) { return encodeURIComponent(s); }).join('%2F') + "%2F" + encodeURIComponent(files[0]) + "?alt=media";
                                    return window.fetchWithRetry(finalUrl, {}, 0).then(function(r) { return r.ok ? r.blob() : null; }).then(function(b) { return b ? (forceJpeg ? blobToJpegForPDF(b) : blobToBase64Direct(b)) : null; });
                                }
                                return null;
                            }).catch(function() { return null; });
                    } catch (e) { return Promise.resolve(null); }
                }
                return Promise.resolve(null);
            }
            return window.fetchWithRetry(fallbacks[index], {}, 0) // ZERO retries to prevent 6s loop
                .then(function(res) { 
                    if (res.ok) return res.blob();
                    throw new Error("HTTP " + res.status);
                })
                .then(function(netBlob) { 
                    if (netBlob.size === 0) {
                        if (typeof window.logAppError === 'function') window.logAppError('Zero Byte Corrupt Image', fallbacks[index] + ' | PDF Generation');
                        throw new Error("Zero byte file");
                    }
                    return forceJpeg ? blobToJpegForPDF(netBlob) : blobToBase64Direct(netBlob); 
                })
                .catch(function(err) {
                    if (err && err.message && !err.message.includes("HTTP") && !err.message.includes("Zero byte")) {
                        // Network error (offline or CORS). Abort fallbacks instantly!
                        return Promise.resolve(null);
                    }
                    return tryNext(index + 1); 
                });
        }
        
        return tryNext(0);
    }

    return getImageFromDB(cacheKey).then(function(blob) {
        if (blob) return forceJpeg ? blobToJpegForPDF(blob) : blobToBase64Direct(blob);
        
        if (isCoverOrGarbage) {
            try {
                var urlObj = new URL(cacheKey);
                var pathName = decodeURIComponent(urlObj.pathname.split('/o/')[1]);
                var fwdPath = pathName.substring(0, pathName.lastIndexOf('/'));
                var backPath = fwdPath.replace(/\//g, '\\');
                
                return getImageFromDB(fwdPath).then(function(b1) {
                    if (b1) return forceJpeg ? blobToJpegForPDF(b1) : blobToBase64Direct(b1);
                    return getImageFromDB(backPath).then(function(b2) {
                        if (b2) return forceJpeg ? blobToJpegForPDF(b2) : blobToBase64Direct(b2);
                        return networkFallback(cacheKey);
                    });
                }).catch(function() { return networkFallback(cacheKey); });
            } catch (e) { }
        }
        
        return networkFallback(cacheKey);
    }).catch(function() { return networkFallback(cacheKey); });
}




// ==========================================
// Helper: Get Firebase URL for a design
// ==========================================

async function resolveCorrectUrl(p, dId) {
    if (!p) return null;
    var cacheKey = null;
    if (typeof window.findDesignKeyInCache === 'function') {
        cacheKey = await window.findDesignKeyInCache(p.gridUrl, dId);
    }
    if (cacheKey) {

        return cacheKey;
    }
    
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null; 

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    var folderPath = p.gridUrl;
    if (!folderPath || folderPath === 'None') return null;
    var encGridPath = folderPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    var isCover = (!dId || dId === 'DIRECT' || dId === 'Cover');
    var dsFallbackMap = {};
    try { dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}"); } catch(e){}

    if (isCover && dsFallbackMap[folderPath]) {
        var fallbackFileName = dsFallbackMap[folderPath];
        var finalUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(fallbackFileName) + "?alt=media";

        return finalUrl;
    }

    var listPrefix = folderPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
    var listUrl = fbBase + "?prefix=" + listPrefix + "&delimiter=/";
    
    if (!window.folderListCache) window.folderListCache = {};
    var folderFiles = window.folderListCache[listUrl];

    if (!folderFiles) {
        try {
            var listRes = await window.fetchWithRetry(listUrl, {}, 1);
            if (listRes.ok) {
                var listData = await listRes.json();
                folderFiles = (listData.items || [])
                    .map(item => item.name.substring(item.name.lastIndexOf('/') + 1))
                    .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));
                window.folderListCache[listUrl] = folderFiles;
            } else {
                folderFiles = [];
            }
        } catch(e) {
            folderFiles = [];
        }
    }

    if (folderFiles.length === 0) return null;
    folderFiles.sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999));
    
    var targetFile = null;
    if (isCover) {
        targetFile = folderFiles[0];
        dsFallbackMap[folderPath] = targetFile;
        try { localStorage.setItem("dsFallbackMap", JSON.stringify(dsFallbackMap)); } catch (e) { }
    } else {
        var targetNum = parseInt(String(dId).replace(/\D/g, ''));
        if (!isNaN(targetNum)) {
            for (var i = 0; i < folderFiles.length; i++) {
                var f = folderFiles[i];
                var nameWithoutExt = f.substring(0, f.lastIndexOf('.'));
                if (parseInt(nameWithoutExt.replace(/\D/g, '')) === targetNum) {
                    targetFile = f;
                    break;
                }
            }
        }
        if (!targetFile) {
            for (var i = 0; i < folderFiles.length; i++) {
                var f = folderFiles[i];
                var nameWithoutExt = f.substring(0, f.lastIndexOf('.'));
                if (nameWithoutExt.toLowerCase() === String(dId).toLowerCase()) {
                    targetFile = f;
                    break;
                }
            }
        }
        if (!targetFile) targetFile = folderFiles[0];
    }

    if (!targetFile) return null;

    var finalUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(targetFile) + "?alt=media";

    return finalUrl;
}

function getDesignFirebaseUrl(folderPath, dId) {
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/";
    var encPath = folderPath.trim().replace(/\\/g, '/').split('/').filter(Boolean)
        .map(s => encodeURIComponent(s.trim())).join('%2F');
    var fileName = "01.webp";
    if (dId && dId !== 'DIRECT' && dId !== 'Cover') {
        var num = dId.replace(/\D/g, '');
        if (num.length === 1) num = "0" + num;
        if (num === "") num = dId;
        fileName = num + ".webp";
    }
    return fbBase + encPath + "%2F" + encodeURIComponent(fileName) + "?alt=media";
}

// ==========================================
// Helper: Get cached blob URL for an img element in DOM
// ==========================================
function getImgElementSrc(imgEl) {
    if (!imgEl) return null;
    var src = imgEl.src;
    if (src && !src.startsWith('data:') && src !== '') return src;
    return null;
}

// ==========================================
// LOGO LOADER — Loads logo.png from assets as base64 for PDF embedding
// ==========================================
var _cachedLogoBase64 = null;
function getLogoBase64() {
    if (_cachedLogoBase64) return Promise.resolve(_cachedLogoBase64);
    return new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                _cachedLogoBase64 = canvas.toDataURL('image/png');
                resolve(_cachedLogoBase64);
            } catch(e) { resolve(null); }
        };
        img.onerror = function() { resolve(null); };
        img.src = './logo.png';
    });
}

// ==========================================
// CART ORDER PDF — LIGHTNING FAST FROM CACHE
// Mirrors the visual layout of the Cart panel
// ==========================================
async function generateCartOrderPDF(actionType) {
    var bootScreen = document.getElementById('boot');
    var bootMsg = document.getElementById('bootMsg');
    if (bootScreen) { bootScreen.style.display = 'flex'; }
    if (bootMsg) bootMsg.innerText = "Generating Order PDF...";

    try {
        const { jsPDF } = window.jspdf;

        // ── Collect cart data ──────────────────────────────
        var cartKeys = Object.keys(cart);
        if (cartKeys.length === 0) {
            if (bootScreen) bootScreen.style.display = 'none';
            alert("Your cart is empty!");
            return;
        }

        // Group by product (same as cart UI)
        var groups = {};
        for (var k in cart) {
            var item = cart[k];
            if (!item || !item.p || !item.p.id) continue;
            if (!groups[item.p.id]) groups[item.p.id] = { p: item.p, items: [] };
            groups[item.p.id].items.push(item);
        }

        var groupArr = Object.values(groups);
        if (groupArr.length === 0) {
            if (bootScreen) bootScreen.style.display = 'none';
            alert("Cart is empty!");
            return;
        }

        // ── Fetch all needed images from cache ─────────────
        var totalCount = 0;
        var totalQtyAll = 0;
        for (var g of groupArr) {
            for (var item of g.items) totalQtyAll += parseInt(item.qty) || 0;
        }

        if (bootMsg) bootMsg.innerText = "Loading images from cache...";

        // ── Strictly Offline Image Resolution (Lightning Fast) ──
        for (var g of groupArr) {
            for (var item of g.items) {
                var dId = item.design || 'DIRECT';
                var resolvedUrl = await resolveCorrectUrl(g.p, dId);
                var blob = null;
                
                if (resolvedUrl) {
                    // Downgrade to Grid Image for lightning-fast cart PDF generation
                    if (g.p.zoomUrl && g.p.zoomUrl !== "None" && g.p.zoomUrl !== g.p.gridUrl) {
                        var cleanGrid = String(g.p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                        var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');
                        var cleanZoom = String(g.p.zoomUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                        var encZoomPath = cleanZoom.split('/').map(s => encodeURIComponent(s)).join('%2F');
                        resolvedUrl = resolvedUrl.replace(encZoomPath, encGridPath);
                    }
                    
                    // STRICT OFFLINE: Only pull from IndexedDB directly. No network fallbacks.
                    blob = await getImageFromDB(resolvedUrl);
                    
                    if (!blob && window.findDesignKeyInCache) {
                        var altKey = await window.findDesignKeyInCache(g.p.gridUrl, dId);
                        if (altKey) blob = await getImageFromDB(altKey);
                    }
                }
                
                if (blob) {
                    item._pdfImgSrc = await blobToBase64Direct(blob);
                } else {
                    item._pdfImgSrc = null;
                    item._pdfFailReason = (dId === 'DIRECT' || dId === 'Cover') ? 'Cover not synced' : 'Design not synced';
                }
            }
        }

        if (bootMsg) bootMsg.innerText = "Building PDF...";

        // ── PDF Setup ──────────────────────────────────────
        var doc = new jsPDF('p', 'pt', 'a4');
        var PW = 595, PH = 842;
        var margin = 24;
        var y = margin;

        // ── Load logo ──────────────────────────────────────
        var logoBase64 = await getLogoBase64();

        // ── PAGE HEADER ────────────────────────────────────
        var LOGO_H = 38;
        if (logoBase64) {
            try {
                var logoProp = doc.getImageProperties(logoBase64);
                var logoW = LOGO_H * (logoProp.width / logoProp.height);
                logoW = Math.min(logoW, 140); // cap width
                // Clickable logo image → website
                doc.link(margin, y, logoW, LOGO_H, { url: WEBSITE_BASE });
                doc.addImage(logoBase64, 'PNG', margin, y, logoW, LOGO_H);
            } catch(e) {
                // Fallback text logo
                doc.setFillColor(139, 0, 0);
                doc.rect(margin, y, 110, LOGO_H, 'F');
                doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
                doc.textWithLink("DURGA SAREES", margin + 8, y + 24, { url: WEBSITE_BASE });
            }
        } else {
            doc.setFillColor(139, 0, 0);
            doc.rect(margin, y, 110, LOGO_H, 'F');
            doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
            doc.textWithLink("DURGA SAREES", margin + 8, y + 24, { url: WEBSITE_BASE });
        }

        // Title and Date/Time
        var today = new Date();
        var dateStr = ("0" + today.getDate()).slice(-2) + "/" + ("0" + (today.getMonth() + 1)).slice(-2) + "/" + today.getFullYear();
        var timeStr = ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2);

        // Date right aligned in bold
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("Order Date: " + dateStr + "  " + timeStr, PW - margin, y + 14, { align: "right" });

        // Title centered above the line
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("ORDER SUMMARY", PW / 2, y + 24, { align: "center" });

        y += LOGO_H + 4;

        // Divider
        doc.setDrawColor(139, 0, 0);
        doc.setLineWidth(1.5);
        doc.line(margin, y, PW - margin, y);
        y += 14;

        // ── CUSTOMER DETAILS ───────────────────────────────
        var dsCustomer = null;
        try {
            var dsCustomerStr = localStorage.getItem("dsCustomerDetails");
            if (dsCustomerStr) {
                dsCustomer = JSON.parse(dsCustomerStr);
                if (dsCustomer.name) {
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(139, 0, 0);
                    doc.text("Customer Details:", margin, y);
                    y += 14;
                    
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(40, 40, 40);
                    
                    var leftCol = [];
                    leftCol.push("Name: " + dsCustomer.name);
                    if (dsCustomer.firm) leftCol.push("Firm: " + dsCustomer.firm);
                    leftCol.push("Phone: " + (dsCustomer.phone || ""));
                    
                    var rightCol = [];
                    rightCol.push("Station: " + dsCustomer.station);
                    rightCol.push("State: " + dsCustomer.state);
                    
                    var lineY = y;
                    for(var i=0; i<Math.max(leftCol.length, rightCol.length); i++) {
                        if (leftCol[i]) doc.text(leftCol[i], margin, lineY);
                        if (rightCol[i]) doc.text(rightCol[i], PW / 2 + 30, lineY);
                        lineY += 12;
                    }
                    
                    y = lineY + 8;
                    
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.5);
                    doc.line(margin, y, PW - margin, y);
                    y += 14;
                }
            }
        } catch(e) {}

        // ── PRODUCT BLOCKS ─────────────────────────────────
        var THUMB_SIZE = 80;
        var DESIGN_COLS = 5;
        var THUMB_GAP = 6;
        var CELL_W = (PW - (margin * 2)) / DESIGN_COLS;

        for (var gi = 0; gi < groupArr.length; gi++) {
            var g = groupArr[gi];
            var p = g.p;
            var pTotalQty = g.items.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);

            // ── Check if enough space for header AND first row of images ──
            var blockHeaderH = 44;
            var firstRowH = THUMB_SIZE + 22;
            if (y + blockHeaderH + firstRowH > PH - margin) {
                doc.addPage();
                y = margin;
            }

            // ── Product Header ─────────────────────────────
            var wixUrl = buildWixProductUrl(p);
            doc.setFillColor(245, 245, 246);
            doc.roundedRect(margin, y, PW - margin * 2, blockHeaderH, 4, 4, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, y, PW - margin * 2, blockHeaderH, 4, 4, 'D');

            // Product name — clickable link to Wix product page
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(139, 0, 0);
            var nameText = p.name || "Unknown";
            doc.textWithLink(nameText, margin + 10, y + 16, { url: wixUrl });

            // Underline the name
            var nameW = doc.getTextWidth(nameText);
            doc.setDrawColor(139, 0, 0);
            doc.setLineWidth(0.5);
            doc.line(margin + 10, y + 18, margin + 10 + nameW, y + 18);

            // SKU | Rate | Packing | Total Qty
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 80);
            var infoLine = [];
            if (p.sku) infoLine.push("SKU: " + p.sku);
            if (p.price) infoLine.push("Rate: Rs." + p.price);
            if (p.packing) infoLine.push("Packing: " + p.packing);
            infoLine.push("Total: " + pTotalQty + " pcs");
            doc.text(infoLine.join("   |   "), margin + 10, y + 34);

            y += blockHeaderH + 6;

            // ── Design Thumbnails Row ──────────────────────
            // Split items into rows of DESIGN_COLS
            var items = g.items;
            for (var row = 0; row < Math.ceil(items.length / DESIGN_COLS); row++) {
                var rowItems = items.slice(row * DESIGN_COLS, (row + 1) * DESIGN_COLS);
                var rowH = THUMB_SIZE + 22;

                if (y + rowH > PH - margin) {
                    doc.addPage();
                    y = margin;
                }

                for (var ci = 0; ci < rowItems.length; ci++) {
                    var item = rowItems[ci];
                    var cellX = margin + ci * CELL_W;
                    var dId = item.design || 'DIRECT';
                    var dLabel = (dId === 'DIRECT') ? 'Cover' : dId;

                    // Thumbnail image — clickable link to Wix product page
                    if (item._pdfImgSrc) {
                        try {
                            var imgProps = doc.getImageProperties(item._pdfImgSrc);
                            var iW = CELL_W - THUMB_GAP;
                            var iH = THUMB_SIZE;
                            var imgRatio = imgProps.width / imgProps.height;
                            var drawW = iH * imgRatio;
                            var drawH = iH;
                            if (drawW > iW) { drawW = iW; drawH = iW / imgRatio; }
                            var imgX = cellX + ((CELL_W - THUMB_GAP - drawW) / 2);
                            var imgY = y;
                            doc.addImage(item._pdfImgSrc, imgX, imgY, drawW, drawH);
                            // Make the thumbnail image a clickable link
                            doc.link(imgX, imgY, drawW, drawH, { url: wixUrl });
                        } catch(e) {
                            // Render error placeholder with reason
                            var errMsg = item._pdfFailReason || 'Render error';
                            doc.setFillColor(240, 240, 240);
                            doc.rect(cellX + 3, y, CELL_W - THUMB_GAP - 6, THUMB_SIZE, 'F');
                            doc.setFontSize(6);
                            doc.setTextColor(150, 150, 150);
                            doc.text(errMsg, cellX + (CELL_W - THUMB_GAP) / 2, y + THUMB_SIZE / 2, { align: 'center', maxWidth: CELL_W - THUMB_GAP - 6 });
                        }
                    } else {
                        // No image in cache — draw grey block + short reason
                        var reason = item._pdfFailReason || 'Not synced';
                        doc.setFillColor(240, 240, 240);
                        doc.rect(cellX + 3, y, CELL_W - THUMB_GAP - 6, THUMB_SIZE, 'F');
                        doc.setFontSize(6);
                        doc.setTextColor(150, 150, 150);
                        doc.text(reason, cellX + (CELL_W - THUMB_GAP) / 2, y + THUMB_SIZE / 2, { align: 'center', maxWidth: CELL_W - THUMB_GAP - 6 });
                    }

                    // Single row Design Label + Qty
                    doc.setFontSize(8.5);
                    doc.setFont("helvetica", "bold");
                    var labelX = cellX + (CELL_W - THUMB_GAP) / 2;
                    var dLabelText = dLabel + " * ";
                    var qtyText = (item.qty || 0) + " pcs";
                    
                    var dLabelW = doc.getTextWidth(dLabelText);
                    var qtyW = doc.getTextWidth(qtyText);
                    var totalW = dLabelW + qtyW;
                    var startX = labelX - (totalW / 2);
                    
                    doc.setTextColor(40, 40, 40);
                    doc.text(dLabelText, startX, y + THUMB_SIZE + 14);
                    doc.setTextColor(255, 63, 108);
                    doc.text(qtyText, startX + dLabelW, y + THUMB_SIZE + 14);
                }

                y += rowH + 6;
            }

            y += 8; // Space between product blocks
        }

        // ── FOOTER ─────────────────────────────────────────
        if (y + 110 > PH - margin) {
            doc.addPage();
            y = margin;
        }

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, y, PW - margin, y);
        y += 20;

        // "Thank you"
        doc.setFontSize(13);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(139, 0, 0);
        doc.text("Thank you for shopping with us!", PW / 2, y, { align: "center" });
        y += 20;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        
        var t1 = "Total Items: " + totalQtyAll + " pcs  |  Products: " + groupArr.length + "  |  ";
        var t2 = "WhatsApp: +91 99982 32380";
        var w1 = doc.getTextWidth(t1);
        var w2 = doc.getTextWidth(t2);
        var tTotalW = w1 + w2;
        var tStartX = (PW - tTotalW) / 2;

        doc.text(t1, tStartX, y);
        doc.setTextColor(37, 211, 102); // WhatsApp green
        doc.textWithLink(t2, tStartX + w1, y, { url: "https://wa.me/919998232380" });
        y += 14;

        doc.setFontSize(8);
        doc.setTextColor(0, 100, 200);
        doc.textWithLink("www.durgasarees.com", PW / 2, y, { url: WEBSITE_BASE, align: "center" });

        // Brand logo below text
        if (logoBase64) {
            try {
                var logoProp = doc.getImageProperties(logoBase64);
                var fLogoH = 34;
                var fLogoW = fLogoH * (logoProp.width / logoProp.height);
                fLogoW = Math.min(fLogoW, 120);
                var fLogoX = (PW - fLogoW) / 2;
                var fLogoY = y + 10;
                doc.link(fLogoX, fLogoY, fLogoW, fLogoH, { url: WEBSITE_BASE });
                doc.addImage(logoBase64, 'PNG', fLogoX, fLogoY, fLogoW, fLogoH);
            } catch(e) {}
        }

        // ── OUTPUT ──────────────────────────────────────────
        var fileName = "DurgaSarees_Order_" + dateStr.replace(/\//g, '-') + ".pdf";

        // Build plain-text order summary for WhatsApp message
        var waText = "Order from Durga Sarees\n\n";
        if (dsCustomer && dsCustomer.name) {
            waText += "*Customer Details:*\n";
            waText += "Name: " + dsCustomer.name + "\n";
            if (dsCustomer.firm) waText += "Firm: " + dsCustomer.firm + "\n";
            waText += "Phone: " + (dsCustomer.phone || "") + "\n";
            waText += "Station: " + dsCustomer.station + " (" + dsCustomer.state + ")\n\n";
        }
        for (var gi2 = 0; gi2 < groupArr.length; gi2++) {
            var gg = groupArr[gi2];
            waText += "*" + gg.p.name + "*";
            if (gg.p.sku) waText += " (SKU: " + gg.p.sku + ")";
            waText += "\n";
            gg.items.forEach(function(item) {
                var dName = (item.design === 'DIRECT') ? 'Cover' : item.design;
                waText += "  - " + dName + ": " + item.qty + " pcs\n";
            });
            waText += "\n";
        }
        waText += "*Total: " + totalQtyAll + " pcs*\n";
        waText += "www.durgasarees.com";

        if (bootScreen) bootScreen.style.display = 'none';

        var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem);

        if (actionType === 'print') {
            if (isCapacitor && window.CapacitorPrinter) {
                // Use native printer plugin
                var base64Data = doc.output('datauristring'); // data:application/pdf;filename=generated.pdf;base64,...
                window.CapacitorPrinter.print({ content: "base64:" + base64Data }).catch(e => alert("Print error: " + e));
            } else {
                // Fallback for Web
                doc.autoPrint();
                var blobUrl = URL.createObjectURL(doc.output('blob'));
                window.open(blobUrl, '_blank');
            }
            if (bootScreen) bootScreen.style.display = 'none';
            return;
        }

        if (isCapacitor) {
            // 1. Save PDF to device
            var pureBase64 = doc.output('datauristring').split(',')[1];
            var writeResult = null;
            try {
                writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                    path: fileName,
                    data: pureBase64,
                    directory: "DOCUMENTS"
                });
            } catch(saveErr) {
                // Fallback to CACHE if DOCUMENTS fails (some devices need permission)
                try {
                    writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                        path: fileName,
                        data: pureBase64,
                        directory: "CACHE"
                    });
                } catch(e2) { console.warn("PDF save failed", e2); }
            }

            if (writeResult) {
                // 2. Open Share picker so PDF is attached
                await window.Capacitor.Plugins.Share.share({
                    title: "Durga Sarees Order",
                    files: [writeResult.uri]
                });
            }

        } else {
            // Web fallback: download the PDF
            doc.save(fileName);
            // Also try to open WhatsApp web
            var encodedMsg = encodeURIComponent(waText);
            window.open("https://web.whatsapp.com/send?phone=919998232380&text=" + encodedMsg, '_blank');
        }

    } catch (error) {
        if (typeof window.logAppError === 'function') window.logAppError('AUDITOR: generateOrderPDF', error.message);
        if (bootScreen) bootScreen.style.display = 'none';
        alert("Order PDF Error: " + error.message);
    }
}

// ==========================================
// 🌸 DURGA SAREES: NATIVE PDF ENGINE (A4 CATALOG LAYOUT)
// ==========================================

window.generateNativePDF = async function (product, imageUrlsArray, actionType) {
    // Filter out video files to prevent blank PDF pages
    imageUrlsArray = imageUrlsArray.filter(url => !/\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(url));

    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Generating Catalog PDF...";
    }

    try {
        const { jsPDF } = window.jspdf;
        var doc = new jsPDF('p', 'pt', 'a4');
        var pageWidth = 595;
        var pageHeight = 842;
        var wixUrl = buildWixProductUrl(product);

        for (var i = 0; i < imageUrlsArray.length; i++) {
            if (i > 0) doc.addPage();

            // Try cache first for speed, then network
            var base64Img = await getBase64FromCache(imageUrlsArray[i], true);

            if (i === 0) {
                // ── COVER PAGE ─────────────────────────────
                function drawUnderline(text, x, y, size, align) {
                    var textWidth = doc.getTextWidth(text);
                    var startX = x;
                    if (align === "center") startX = x - textWidth / 2;
                    else if (align === "right") startX = x - textWidth;
                    doc.setDrawColor(255, 140, 0);
                    doc.setLineWidth(0.75);
                    doc.line(startX, y + 2, startX + textWidth, y + 2);
                }

                // Category — trim text so highlight box fits exactly
                var catText = (product.cat ? String(product.cat) : "Uncategorized").trim();
                doc.setFont("helvetica", "bold");
                doc.setFontSize(18);
                var catWidth = doc.getTextWidth(catText);
                doc.setFillColor(139, 0, 0);
                doc.rect(40, 40, catWidth + 20, 26, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text(catText, 50, 58);

                // Date
                var today = new Date();
                var dateStr = ("0" + today.getDate()).slice(-2) + "/" + ("0" + (today.getMonth() + 1)).slice(-2) + "/" + today.getFullYear();
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(51, 51, 51);
                doc.text("Date: " + dateStr, pageWidth - 40, 58, { align: "right" });

                // Product Title — trim text so highlight box fits exactly, no gap from category
                var titleText = (product.name ? String(product.name) : "").trim();
                doc.setFont("helvetica", "bold");
                doc.setFontSize(24);
                var titleWidth = doc.getTextWidth(titleText);
                var boxW = titleWidth + 30;
                var boxX = (pageWidth - boxW) / 2;
                doc.setFillColor(139, 0, 0);
                doc.rect(boxX, 76, boxW, 34, 'F');
                doc.setTextColor(255, 255, 255);
                doc.textWithLink(titleText, pageWidth / 2, 100, { url: wixUrl, align: "center" });

                // "Click for Ready Designs" link — right below title, no extra gap
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(255, 140, 0);
                doc.textWithLink("(Click for Ready Designs)", pageWidth / 2, 122, { url: wixUrl, align: "center" });
                drawUnderline("(Click for Ready Designs)", pageWidth / 2, 122, 10, "center");

                // 3-column specifications grid — tighter to the links above
                var startY = 148;
                var rowH = 22;
                var col1X = 40, col2X = 220, col3X = 400;
                doc.setFontSize(10);

                function drawSpec(label, value, colX, rowY) {
                    if (!value || String(value).trim() === '-' || String(value).trim() === '') return;
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(51, 136, 204);
                    doc.text(label, colX, rowY);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(51, 51, 51);
                    doc.text(":  " + String(value), colX + 55, rowY);
                }

                drawSpec("Quality", product.fabric, col1X, startY);
                drawSpec("Code", product.sku, col2X, startY);
                drawSpec("D No", product.price, col3X, startY);

                drawSpec("Jari", product.jari, col1X, startY + rowH);
                drawSpec("Border", product.border, col2X, startY + rowH);
                drawSpec("Cut", product.cut, col3X, startY + rowH);

                drawSpec("Pallu", product.pallu, col1X, startY + rowH * 2);
                drawSpec("Blouse", product.blouse, col2X, startY + rowH * 2);
                drawSpec("Packing", product.packing, col3X, startY + rowH * 2);

                // Product image
                if (base64Img) {
                    var targetW = 515, targetH = 500; // max safe height between table and footer
                    var imgProps = doc.getImageProperties(base64Img);
                    var imgRatio = imgProps.width / imgProps.height;
                    
                    var finalW = targetW;
                    var finalH = targetW / imgRatio;
                    if (finalH > targetH) {
                        finalH = targetH;
                        finalW = targetH * imgRatio;
                    }
                    
                    var imgX = (pageWidth - finalW) / 2;
                    var imgY = 260 + ((targetH - finalH) / 2); // Center vertically in remaining space
                    doc.setDrawColor(221, 221, 221);
                    doc.setLineWidth(1);
                    doc.rect(imgX, imgY, finalW, finalH, 'D');
                    // Image links to product Wix page
                    doc.link(imgX, imgY, finalW, finalH, { url: wixUrl });
                    doc.addImage(base64Img, imgX, imgY, finalW, finalH);
                }

                // Footer
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(0, 100, 200);
                var footerText = "Click On image to view all Ready Designs of this product";
                doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });
            } else {
                // ── DESIGN PAGES ───────────────────────────
                var designNum = i;
                // Design page header
                doc.setFontSize(13);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(139, 0, 0);
                doc.textWithLink(product.name + " — Design " + designNum, pageWidth / 2, 35, { url: wixUrl, align: "center" });

                if (base64Img) {
                    var targetW = 500, targetH = 710;
                    var imgProps = doc.getImageProperties(base64Img);
                    var imgRatio = imgProps.width / imgProps.height;
                    
                    var finalW = targetW;
                    var finalH = targetW / imgRatio;
                    if (finalH > targetH) {
                        finalH = targetH;
                        finalW = targetH * imgRatio;
                    }
                    
                    var xPos = (pageWidth - finalW) / 2;
                    var yPos = 65 + ((targetH - finalH) / 2);
                    doc.link(xPos, yPos, finalW, finalH, { url: wixUrl });
                    doc.addImage(base64Img, xPos, yPos, finalW, finalH);
                }

                // Footer
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(0, 100, 200);
                var footerText = "Click On image to view all Ready Designs of this product";
                doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });
            }
            
            // Add Logo to bottom right of all pages
            var logoBase64 = await getLogoBase64();
            if (logoBase64) {
                try {
                    var logoProp = doc.getImageProperties(logoBase64);
                    var logoH = 26;
                    var logoW = logoH * (logoProp.width / logoProp.height);
                    logoW = Math.min(logoW, 100);
                    var logoX = pageWidth - 40 - logoW;
                    var logoY = 810 - logoH + 6;
                    doc.link(logoX, logoY, logoW, logoH, { url: WEBSITE_BASE });
                    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
                } catch(e) {}
            }
        }

        var fileName = product.name.replace(/[^a-zA-Z0-9]/g, "_") + "_Catalog.pdf";

        if (actionType === 'preview') {
            doc.output('dataurlnewwindow');
        } else if (actionType === 'wa' || actionType === 'print') {
            var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins &&
                window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem);

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
                var pdfBlob = doc.output('blob');
                var file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (typeof navigator.share === 'function') {
                    try { await navigator.share({ title: product.name + ' Catalog', files: [file] }); }
                    catch (e) { doc.save(fileName); }
                } else {
                    doc.save(fileName);
                }
            }
        } else {
            doc.save(fileName);
        }

    } catch (error) {
        if (typeof window.logAppError === 'function') window.logAppError('AUDITOR: generateProductPDF', error.message);
        alert("PDF Generation Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}

window.generateFavoritesPDF = async function (favProducts, shareType, actionType) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Building Catalog...";
    }
    
    try {
        var { jsPDF } = window.jspdf;
        var doc = new jsPDF('p', 'pt', 'a4');
        var pageWidth = 595, pageHeight = 842;
        var logoBase64 = await getLogoBase64();
        var isFirstPage = true;

        for (var pIdx = 0; pIdx < favProducts.length; pIdx++) {
            var product = favProducts[pIdx];
            var wixUrl = buildWixProductUrl(product);
            
            var folderPath = (product.zoomUrl && product.zoomUrl !== "None") ? product.zoomUrl : product.gridUrl;
            var dArr = (shareType === 'full' && product.ready) ? String(product.ready).split(',').map(d => d.trim()).filter(d => d && !/\.(mp4|mov|avi|wmv|webm)$/i.test(d)) : [];
            
            var coverUrl;
            if (dArr.length > 0) {
                coverUrl = await resolveCorrectUrl(product, dArr[0]);
            } else {
                // Cover mode: Use dsFallbackMap first, then ready designs, then DIRECT
                var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
                var fallbackFile = dsFallbackMap[product.gridUrl] || dsFallbackMap[product.zoomUrl];
                var readyFallback = (product.ready) ? String(product.ready).split(',').map(d => d.trim()).filter(d => d && !/\.(mp4|mov|avi|wmv|webm)$/i.test(d)) : [];
                var coverDesignId = 'DIRECT';
                
                if (fallbackFile) {
                    coverDesignId = fallbackFile;
                } else if (readyFallback.length > 0) {
                    coverDesignId = readyFallback[0];
                }
                
                coverUrl = await resolveCorrectUrl(product, coverDesignId);
            }
            
            var coverBase64 = await getBase64FromCache(coverUrl, true);
            
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;
            
            // --- DRAW COVER PAGE FOR THIS PRODUCT ---
            function drawUnderline(text, x, y, size, align) {
                var textWidth = doc.getTextWidth(text);
                var startX = x;
                if (align === "center") startX = x - textWidth / 2;
                else if (align === "right") startX = x - textWidth;
                doc.setDrawColor(255, 140, 0);
                doc.setLineWidth(0.75);
                doc.line(startX, y + 2, startX + textWidth, y + 2);
            }

            var catText = (product.cat ? String(product.cat) : "Uncategorized").trim();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            var catWidth = doc.getTextWidth(catText);
            doc.setFillColor(139, 0, 0);
            doc.rect(40, 40, catWidth + 20, 26, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(catText, 50, 58);

            var today = new Date();
            var dateStr = ("0" + today.getDate()).slice(-2) + "/" + ("0" + (today.getMonth() + 1)).slice(-2) + "/" + today.getFullYear();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(51, 51, 51);
            doc.text("Date: " + dateStr, pageWidth - 40, 58, { align: "right" });

            var titleText = (product.name ? String(product.name) : "").trim();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            var titleWidth = doc.getTextWidth(titleText);
            var boxW = titleWidth + 30;
            var boxX = (pageWidth - boxW) / 2;
            doc.setFillColor(139, 0, 0);
            doc.rect(boxX, 76, boxW, 34, 'F');
            doc.setTextColor(255, 255, 255);
            doc.textWithLink(titleText, pageWidth / 2, 100, { url: wixUrl, align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(255, 140, 0);
            doc.textWithLink("(Click for Ready Designs)", pageWidth / 2, 122, { url: wixUrl, align: "center" });
            drawUnderline("(Click for Ready Designs)", pageWidth / 2, 122, 10, "center");

            // Specs
            var startY = 148;

            var rowH = 22;
            var col1X = 40, col2X = 220, col3X = 400;
            doc.setFontSize(10);

            function drawSpec(label, value, colX, rowY) {
                if (!value || String(value).trim() === '-' || String(value).trim() === '') return;
                doc.setFont("helvetica", "bold");
                doc.setTextColor(51, 136, 204);
                doc.text(label, colX, rowY);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(51, 51, 51);
                doc.text(":  " + String(value), colX + 55, rowY);
            }

            drawSpec("Quality", product.fabric, col1X, startY);
            drawSpec("Code", product.sku, col2X, startY);
            drawSpec("D No", product.price, col3X, startY);

            drawSpec("Jari", product.jari, col1X, startY + rowH);
            drawSpec("Border", product.border, col2X, startY + rowH);
            drawSpec("Cut", product.cut, col3X, startY + rowH);

            drawSpec("Pallu", product.pallu, col1X, startY + rowH * 2);
            drawSpec("Blouse", product.blouse, col2X, startY + rowH * 2);
            drawSpec("Packing", product.packing, col3X, startY + rowH * 2);
            
            // Image
            if (coverBase64) {
                var targetW = 515, targetH = 500;
                var imgProps = doc.getImageProperties(coverBase64);
                var imgRatio = imgProps.width / imgProps.height;
                var finalW = targetW;
                var finalH = targetW / imgRatio;
                if (finalH > targetH) { finalH = targetH; finalW = targetH * imgRatio; }
                
                var imgX = (pageWidth - finalW) / 2;
                var imgY = 280 + ((targetH - finalH) / 2);
                doc.setDrawColor(221, 221, 221);
                doc.setLineWidth(1);
                doc.rect(imgX, imgY, finalW, finalH, 'D');
                doc.link(imgX, imgY, finalW, finalH, { url: wixUrl });
                doc.addImage(coverBase64, imgX, imgY, finalW, finalH);
            }
            
            // Footer
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(0, 100, 200);
            var footerText = "Click On image to view all Ready Designs of this product";
            doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });

            // Logo
            if (logoBase64) {
                try {
                    var logoProp = doc.getImageProperties(logoBase64);
                    var logoH = 26;
                    var logoW = logoH * (logoProp.width / logoProp.height);
                    logoW = Math.min(logoW, 100);
                    var logoX = pageWidth - 40 - logoW;
                    var logoY = 810 - logoH + 6;
                    doc.link(logoX, logoY, logoW, logoH, { url: WEBSITE_BASE });
                    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
                } catch(e) {}
            }
            
            // --- DRAW DESIGN PAGES IF REQUIRED ---
            if (dArr.length > 0) {
                for (var j = 1; j < dArr.length; j++) {
                    var dId = dArr[j];
                    var dUrl = await resolveCorrectUrl(product, dId);
                    var dBase64 = await getBase64FromCache(dUrl, true);
                    
                    doc.addPage();
                    
                    doc.setFontSize(13);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(139, 0, 0);
                    doc.textWithLink(product.name + " — " + dId, pageWidth / 2, 35, { url: wixUrl, align: "center" });

                    if (dBase64) {
                        var targetW2 = 500, targetH2 = 710;
                        var imgProps2 = doc.getImageProperties(dBase64);
                        var imgRatio2 = imgProps2.width / imgProps2.height;
                        var finalW2 = targetW2;
                        var finalH2 = targetW2 / imgRatio2;
                        if (finalH2 > targetH2) { finalH2 = targetH2; finalW2 = targetH2 * imgRatio2; }
                        var xPos = (pageWidth - finalW2) / 2;
                        var yPos = 65 + ((targetH2 - finalH2) / 2);
                        doc.link(xPos, yPos, finalW2, finalH2, { url: wixUrl });
                        doc.addImage(dBase64, xPos, yPos, finalW2, finalH2);
                    }

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(0, 100, 200);
                    doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });

                    if (logoBase64) {
                        try {
                            doc.link(logoX, logoY, logoW, logoH, { url: WEBSITE_BASE });
                            doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
                        } catch(e) {}
                    }
                }
            }
        } // End loop over products
        
        var fileName = "Favorite_Items_Catalog.pdf";
        if (actionType === 'preview') {
            doc.output('dataurlnewwindow');
        } else if (actionType === 'wa' || actionType === 'print') {
            var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem);
            if (isCapacitor) {
                var pureBase64 = doc.output('datauristring').split(',')[1];
                var writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                    path: fileName, data: pureBase64, directory: "CACHE"
                });
                await window.Capacitor.Plugins.Share.share({
                    title: 'Favorite Items Catalog', files: [writeResult.uri]
                });
            } else {
                var pdfBlob = doc.output('blob');
                var file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (typeof navigator.share === 'function') {
                    try { await navigator.share({ title: 'Favorite Items Catalog', files: [file] }); }
                    catch (e) { doc.save(fileName); }
                } else {
                    doc.save(fileName);
                }
            }
        } else {
            doc.save(fileName);
        }
        
    } catch (err) {
        if (typeof window.logAppError === 'function') window.logAppError('AUDITOR: generateFavoritesPDF', err.message);
        alert("Favorites PDF Error: " + err.message);
    }
    if (bootScreen) bootScreen.style.display = 'none';
}

// ==========================================
// 📦 MULTI-IMAGE NATIVE SHARE ENGINE
// ==========================================

function base64ToFile(base64Data, filename) {
    var arr = base64Data.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, { type: mime });
}

async function shareNativeImages(productName, productPrice, imageUrlsArray) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Preparing Images...";
    }

    try {
        var isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins &&
            window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem);
        var nativeSuccess = false;

        if (isCapacitor) {
            try {
                // Fetch all base64 images concurrently for instant performance
                var base64Results = await Promise.all(imageUrlsArray.map(url => getBase64FromCache(url)));
                
                var failedUrls = [];
                var uriArray = [];
                for (var i = 0; i < base64Results.length; i++) {
                    var base64Img = base64Results[i];
                    if (base64Img) {
                        var pureBase64 = base64Img.split(',')[1];
                        var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + ".jpg";
                        var writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                            path: fileName,
                            data: pureBase64,
                            directory: "CACHE"
                        });
                        uriArray.push(writeResult.uri);
                    } else {
                        failedUrls.push(imageUrlsArray[i]);
                    }
                }

                if (failedUrls.length > 0) {
                    var errMsg = "Failed to fetch " + failedUrls.length + " images. URLs: " + failedUrls.join(', ');
                    console.error("Share Images Error:", errMsg);
                    if (typeof window.logAppError === 'function') window.logAppError("Share Images", errMsg);
                    
                    var confirmMsg = "⚠️ " + failedUrls.length + " image(s) could not be downloaded and will be skipped.\n\nContinue sharing the rest?";
                    if (!confirm(confirmMsg)) {
                        if (bootScreen) bootScreen.style.display = 'none';
                        return;
                    }
                }

                // ⚠️ IMPORTANT: On Android, passing both `files` AND `text` in a single share call
                // causes WhatsApp to receive ONLY the text and silently drop all the image files.
                // Fix: Share files-only so images arrive correctly in WhatsApp.
                await window.Capacitor.Plugins.Share.share({
                    title: "🛍️ " + productName + " — ₹" + productPrice,
                    files: uriArray
                });
                nativeSuccess = true;
            } catch (nativeErr) {
                if (nativeErr.message && nativeErr.message.toLowerCase().includes("cancel")) {
                    nativeSuccess = true; // User cancelled, prevent fallback
                } else {
                    console.warn("Native plugins not compiled in this APK or share failed. Falling back to web share.", nativeErr);
                }
            }
        }

        if (!nativeSuccess) {
            // Fetch all base64 images concurrently for web fallback
            var base64Results = await Promise.all(imageUrlsArray.map(url => getBase64FromCache(url)));
            var failedUrls = [];
            var filesArray = [];
            for (var i = 0; i < base64Results.length; i++) {
                var base64Img = base64Results[i];
                if (base64Img) {
                    var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + ".jpg";
                    filesArray.push(base64ToFile(base64Img, fileName));
                } else {
                    failedUrls.push(imageUrlsArray[i]);
                }
            }

            if (failedUrls.length > 0) {
                var errMsg = "Failed to fetch " + failedUrls.length + " images. URLs: " + failedUrls.join(', ');
                console.error("Share Images Error:", errMsg);
                if (typeof window.logAppError === 'function') window.logAppError("Share Images Web", errMsg);
                
                var confirmMsg = "⚠️ " + failedUrls.length + " image(s) could not be downloaded and will be skipped.\n\nContinue sharing the rest?";
                if (!confirm(confirmMsg)) {
                    if (bootScreen) bootScreen.style.display = 'none';
                    return;
                }
            }

            if (typeof navigator.share === 'function') {
                try {
                    // ⚠️ Same fix: don't mix `text` with `files` — WhatsApp drops images when both are present.
                    await navigator.share({
                        title: "🛍️ " + productName + " — ₹" + productPrice,
                        files: filesArray
                    });
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError' || (shareErr.message && shareErr.message.toLowerCase().includes('cancel'))) {
                        if (bootScreen) bootScreen.style.display = 'none';
                        return; // User cancelled
                    }
                    console.error("Share API failed:", shareErr);
                    try {
                        await navigator.share({ files: filesArray });
                    } catch (fallbackErr) {
                        if (fallbackErr.name !== 'AbortError' && !(fallbackErr.message && fallbackErr.message.toLowerCase().includes('cancel'))) {
                            alert("Your device's browser blocks native multi-image sharing. Error: " + fallbackErr.message);
                        }
                    }
                }
            } else {
                if (confirm("Native Share API is disabled (requires HTTPS or Native App). Do you want to download the images instead?")) {
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
        }
    } catch (error) {
        if (typeof window.logAppError === 'function') window.logAppError('AUDITOR: shareImages', error.message);
        alert("Image Sharing Error: " + error.message);
    }

    if (bootScreen) bootScreen.style.display = 'none';
}


function askShareTypeAsync() {
    return new Promise((resolve) => {
        var overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

        var box = document.createElement('div');
        box.style.backgroundColor = '#fff'; box.style.padding = '20px'; box.style.borderRadius = '12px';
        box.style.width = '300px'; box.style.textAlign = 'center';

        var title = document.createElement('h3');
        title.innerText = 'Select Share Type';
        title.style.marginTop = '0'; title.style.color = '#333';

        var resolved = false;
        var onPopState = function () {
            if (!resolved) {
                resolved = true;
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
                window.removeEventListener('popstate', onPopState);
                resolve(null);
            }
        };
        window.addEventListener('popstate', onPopState);

        var close = function (val) {
            if (!resolved) {
                resolved = true;
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
                window.removeEventListener('popstate', onPopState);
                history.back(); // Pop the state we pushed
                resolve(val);
            }
        };

        var btnCover = document.createElement('button');
        btnCover.innerText = 'Product Catalouge';
        btnCover.style.width = '100%'; btnCover.style.padding = '12px'; btnCover.style.marginBottom = '10px';
        btnCover.style.backgroundColor = 'var(--myntra-pink)'; btnCover.style.color = '#fff';
        btnCover.style.border = 'none'; btnCover.style.borderRadius = '6px'; btnCover.style.fontSize = '14px';
        btnCover.onclick = function () { close('cover'); };

        var btnReady = document.createElement('button');
        btnReady.innerText = 'With Ready Designs';
        btnReady.style.width = '100%'; btnReady.style.padding = '12px'; btnReady.style.marginBottom = '10px';
        btnReady.style.backgroundColor = '#333'; btnReady.style.color = '#fff';
        btnReady.style.border = 'none'; btnReady.style.borderRadius = '6px'; btnReady.style.fontSize = '14px';
        btnReady.onclick = function () { close('full'); };

        var btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancel';
        btnCancel.style.width = '100%'; btnCancel.style.padding = '12px';
        btnCancel.style.backgroundColor = '#eee'; btnCancel.style.color = '#333';
        btnCancel.style.border = 'none'; btnCancel.style.borderRadius = '6px'; btnCancel.style.fontSize = '14px';
        btnCancel.onclick = function () { close(null); };

        box.appendChild(title); box.appendChild(btnCover); box.appendChild(btnReady); box.appendChild(btnCancel);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Replace shareModal state with askShareType so back button works perfectly
        history.replaceState({ modal: 'askShareType' }, '');
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AndroidBackBridge) {
            window.Capacitor.Plugins.AndroidBackBridge.setCanGoBack({ canGoBack: true });
        }
    });
}

window.triggerShare = async function (action) {
    if (action === 'copy') {
        alert("Web links are coming in the next update!");
        return;
    }

    // Visually hide shareModal but DO NOT closeModals() since we will replace its history state
    document.querySelectorAll('.action-modal').forEach(m => m.style.display = 'none');

    var isDetailOpen = document.getElementById('detailPanel') && document.getElementById('detailPanel').classList.contains('open');

    if (!isDetailOpen) {
        // --- MAIN PAGE SHARE (Favorites) ---
        var favProducts = allProducts.filter(p => favorites[p.id]);
        if (favProducts.length === 0) {
            return alert("No favorite items to share. Please mark some products as favorites first.");
        }

        var shareType = await askShareTypeAsync();
        if (!shareType) return;

        var allHighResUrls = [];
        var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");

        for (var i = 0; i < favProducts.length; i++) {
            var fp = favProducts[i];
            var folderPath = (fp.zoomUrl && fp.zoomUrl !== "None") ? fp.zoomUrl : fp.gridUrl;

            var dArr = (shareType === 'full' && fp.ready) ? String(fp.ready).split(',').map(d => d.trim()).filter(d => d && (!fp.stock || fp.stock[d] !== 0)) : [];
            if (dArr.length > 0) {
                for (var j = 0; j < dArr.length; j++) {
                    allHighResUrls.push(await resolveCorrectUrl(fp, dArr[j]));
                }
            } else {
                // Cover mode: Use dsFallbackMap first, then ready designs, then DIRECT
                var fallbackFile = dsFallbackMap[fp.gridUrl] || dsFallbackMap[fp.zoomUrl];
                var readyDesigns = (fp.ready) ? String(fp.ready).split(',').map(d => d.trim()).filter(d => d && (!fp.stock || fp.stock[d] !== 0)) : [];
                var coverDesignId = 'DIRECT';

                if (fallbackFile) {
                    coverDesignId = fallbackFile;
                } else if (readyDesigns.length > 0) {
                    coverDesignId = readyDesigns[0];
                }

                allHighResUrls.push(await resolveCorrectUrl(fp, coverDesignId));
            }
        }

        if (action === 'images') {
            if (allHighResUrls.length > 100) {
                alert("⚠ ️ WhatsApp limits sharing to 100 images at a time. Only the first 100 items will be sent successfully.");
                allHighResUrls = allHighResUrls.slice(0, 100);
            }
            if (typeof shareNativeImages === 'function') {
                await shareNativeImages("Favorite Items", "", allHighResUrls);
            }
        } else if (action === 'wa') {
            if (typeof generateFavoritesPDF === 'function') {
                await generateFavoritesPDF(favProducts, shareType, action);
            }
        }
        return;
    }

    // --- EXISTING SINGLE PRODUCT SHARE ---
    if (!curProduct) return;

    var shareType = await askShareTypeAsync();
    if (!shareType) return;

    var highResUrls = [];
    var folderPath = (curProduct.zoomUrl && curProduct.zoomUrl !== "None") ? curProduct.zoomUrl : curProduct.gridUrl;
    var dArr = (shareType === 'full' && curProduct.ready) ? String(curProduct.ready).split(',').map(d => d.trim()).filter(d => d && (!curProduct.stock || curProduct.stock[d] !== 0)) : [];

    if (dArr.length > 0) {
        for (var j = 0; j < dArr.length; j++) {
            highResUrls.push(await resolveCorrectUrl(curProduct, dArr[j]));
        }
    } else {
        // Cover mode: Use dsFallbackMap first, then ready designs, then DIRECT
        var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
        var fallbackFile = dsFallbackMap[curProduct.gridUrl] || dsFallbackMap[curProduct.zoomUrl];
        var readyDesigns = (curProduct.ready) ? String(curProduct.ready).split(',').map(d => d.trim()).filter(d => d && (!curProduct.stock || curProduct.stock[d] !== 0)) : [];
        var coverDesignId = 'DIRECT';

        if (fallbackFile) {
            coverDesignId = fallbackFile;
        } else if (readyDesigns.length > 0) {
            coverDesignId = readyDesigns[0];
        }

        highResUrls.push(await resolveCorrectUrl(curProduct, coverDesignId));
    }

    if (highResUrls.length === 0) {
        alert("Images are still loading. Please wait a second.");
        return;
    }

    if (action === 'images') {
        if (highResUrls.length > 100) {
            alert("WhatsApp limit is 100 images. You are trying to share " + highResUrls.length + " images. Please share as PDF.");
            return;
        }
        if (typeof shareNativeImages === 'function') {
            await shareNativeImages(curProduct.name, curProduct.price, highResUrls);
        }
    } else {
        if (typeof generateNativePDF === 'function') {
            await generateNativePDF(curProduct, highResUrls, action);
        }
    }
}

