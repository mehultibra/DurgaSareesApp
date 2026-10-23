// ==========================================
// 🌸 DURGA SAREES: PDF ENGINE (V7 - CART PDF + WIX LINKS)
// ==========================================

function checkStock(p, fname) {
    if (typeof window !== 'undefined' && typeof window.isDesignInStock === 'function') {
        return window.isDesignInStock(p, fname);
    }
    return true;
}

async function getActualDesignsForProduct(p, shareType, action) {
    if (shareType === 'cover') return []; // Force caller to use cover fallback block
    if (shareType !== 'full' && shareType !== 'ready') return [];

    var isCurrentProductPage = (typeof curProduct !== 'undefined' && curProduct && (curProduct.id === p.id || curProduct.docId === p.docId));
    var deck = isCurrentProductPage ? (document.getElementById('dtDesigns') || document.getElementById('detailDeck')) : null;
    var rawFiles = [];

    // 1. FASTEST: If on Product Page and swipe deck already has cards, use them immediately!
    if (deck) {
        var cards = deck.querySelectorAll('.swipe-card');
        if (cards && cards.length > 0) {
            cards.forEach(card => {
                if (card.querySelector('video')) return; // Skip videos for image/PDF share
                var dName = card.getAttribute('data-design');
                var cleanDName = (dName || '').replace(/\.[^/.]+$/, '').trim();
                var isCoverCard = (!cleanDName || cleanDName.toUpperCase() === 'DIRECT' || cleanDName.toLowerCase().startsWith('cover'));
                if (isCoverCard) {
                    if (cards.length === 1) {
                        var dsFallbackMap = {};
                        try { dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}"); } catch(e){}
                        var cFile = p.coverDesignId || dsFallbackMap[p.gridUrl] || dsFallbackMap[p.zoomUrl] || 'cover.webp';
                        rawFiles.push(cFile.includes('.') ? cFile : cFile + '.webp');
                    }
                    return;
                }
                var fileName = dName.includes('.') ? dName : dName + '.webp';
                if (!rawFiles.includes(fileName)) rawFiles.push(fileName);
            });
        }
    }

    // 2. CACHE & NETWORK DISCOVERY (Used when DOM cards not available or incomplete)
    if (rawFiles.length === 0) {
        var bucket = "durga-sarees.firebasestorage.app";
        var cleanGrid = p.gridUrl ? String(p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/' : '';
        var gridListUrl = cleanGrid ? ("https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + cleanGrid + "&delimiter=/") : '';
        
        var cleanZoom = (p.zoomUrl && p.zoomUrl !== "None") ? String(p.zoomUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/' : cleanGrid;
        var zoomListUrl = cleanZoom ? ("https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + cleanZoom + "&delimiter=/") : '';

        var items = [];
        if (!window.dsFolderCache) {
            try { window.dsFolderCache = JSON.parse(localStorage.getItem("dsFolderCache")) || {}; } catch(e) { window.dsFolderCache = {}; }
        }

        // Check cache with gridListUrl (standard) or zoomListUrl
        if (gridListUrl && window.dsFolderCache && window.dsFolderCache[gridListUrl]) {
            items = window.dsFolderCache[gridListUrl];
        } else if (zoomListUrl && window.dsFolderCache && window.dsFolderCache[zoomListUrl]) {
            items = window.dsFolderCache[zoomListUrl];
        } else {
            // Fetch from Firebase Storage (grid first, then zoom)
            try {
                var targetListUrl = gridListUrl || zoomListUrl;
                if (targetListUrl) {
                    var res = await (window.fetchWithRetry ? window.fetchWithRetry(targetListUrl, {}, 1) : fetch(targetListUrl));
                    if (res.ok) {
                        var data = await res.json();
                        items = data.items || [];
                        if (!window.dsFolderCache) window.dsFolderCache = {};
                        window.dsFolderCache[targetListUrl] = items;
                    }
                }
            } catch (e) { }
        }

        // Check master cache
        if ((!items || items.length === 0) && window.dsMasterCache) {
            var rawGridPath = p.gridUrl ? String(p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/') : '';
            var mStr = window.dsMasterCache[rawGridPath] || window.dsMasterCache[p.gridUrl];
            if (mStr) {
                var mDesigns = String(mStr).split(',').map(s => s.trim()).filter(Boolean);
                items = mDesigns.map(d => ({ name: (cleanGrid || cleanZoom) + (d.includes('.') ? d : d + '.webp') }));
            }
        }

        // Offline Fallback: Synthesize from stock & ready keys
        if (!items || items.length === 0) {
            var knownKeys = [];
            if (p.stock) {
                Object.keys(p.stock).forEach(k => {
                    if (k !== 'DIRECT' && k !== 'FULLY_PACKED' && !k.toLowerCase().startsWith('cover')) knownKeys.push(k);
                });
            }
            if (p.ready) {
                var rList = window.getProductReadyDesigns ? window.getProductReadyDesigns(p.ready) : String(p.ready).split(',');
                rList.forEach(k => knownKeys.push(k.trim()));
            }
            var uniqueKeys = Array.from(new Set(knownKeys)).filter(Boolean);
            
            if (uniqueKeys.length > 0) {
                items = uniqueKeys.map(k => {
                    var fName = k.includes('.') ? k : k + ".webp";
                    return { name: (cleanGrid || cleanZoom) + fName };
                });
            } else {
                for (var i = 1; i <= 5; i++) {
                    var n = String(i).padStart(2, '0');
                    items.push({ name: (cleanGrid || cleanZoom) + n + ".webp" });
                }
            }
        }

        if (items && items.length > 0) {
            var validFiles = items
                .map(it => it.name.substring(it.name.lastIndexOf('/') + 1))
                .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));
            
            // Exclude explicit cover / cover1 images unless it's the only image
            var nonCoverFiles = validFiles.filter(f => !/^(cover|cover1)\.(webp|jpg|jpeg|png)$/i.test(f));
            rawFiles = (nonCoverFiles.length > 0) ? nonCoverFiles : validFiles;
        }
    }

    // 3. FILTER BY STOCK (Ready Designs)
    var filesToReturn = [...rawFiles];
    if (shareType === 'ready') {
        filesToReturn = filesToReturn.filter(f => checkStock(p, f));
        if (filesToReturn.length === 0 && (checkStock(p, 'Cover') || checkStock(p, 'DIRECT') || (p.totalStock && p.totalStock > 0))) {
            var dsFallbackMap = {};
            try { dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}"); } catch(e){}
            var coverFile = p.coverDesignId || dsFallbackMap[p.gridUrl] || dsFallbackMap[p.zoomUrl] || "cover.webp";
            filesToReturn = [coverFile.includes('.') ? coverFile : coverFile + ".webp"];
        }
    }

    // 4. ORDER WITH CHOSEN COVER FIRST, THEN NUMERICAL
    var dsFallbackMap = {};
    try { dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}"); } catch(e){}
    var chosenCover = p.coverDesignId || dsFallbackMap[p.gridUrl] || dsFallbackMap[p.zoomUrl];
    if (chosenCover) {
        var cleanCoverName = String(chosenCover).replace(/\.[^/.]+$/, "").trim().toLowerCase();
        filesToReturn.sort((a, b) => {
            var aClean = a.replace(/\.[^/.]+$/, "").trim().toLowerCase();
            var bClean = b.replace(/\.[^/.]+$/, "").trim().toLowerCase();
            if (aClean === cleanCoverName) return -1;
            if (bClean === cleanCoverName) return 1;
            return (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999);
        });
    } else {
        filesToReturn.sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999));
    }

    return filesToReturn;
}

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
 * ENGINE 2: CANVAS-BASED JPEG CONVERTER
 * Safely converts WebP/PNG into JPEG to fix WhatsApp attachment bugs.
 */
function blobToJpegForPDF(blob) {
    return new Promise(function(resolve) {
        if (!blob) { resolve(null); return; }
        if (blob.size === 0) { resolve(null); return; }
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

/**
 * ROUTING & DOWNGRADE INTERCEPTOR
 * forceJpeg = false -> Engine 1 (Sharing)
 * forceJpeg = true  -> Engine 2 (PDF / Native Share)
 */
function getBase64FromCache(cacheKey, forceJpeg = false) {
    if (!cacheKey) return Promise.resolve(null);
    var isCoverOrGarbage = false;
    var lowerKey = cacheKey.toLowerCase();
    if (lowerKey.includes('cover.webp') || lowerKey.includes('01.webp') || lowerKey.includes('cover1.webp') || lowerKey.includes('1.webp') || lowerKey.includes('direct.webp') || lowerKey.includes('direct')) {
        isCoverOrGarbage = true;
    }

    var isZoomRequest = cacheKey.includes('/Zoom%2F') || cacheKey.includes('/Zoom/');
    var matchingProd = (typeof curProduct !== 'undefined' && curProduct) ? curProduct : null;
    if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
        var found = allProducts.find(p => {
            if (p.zoomUrl && p.zoomUrl !== 'None' && cacheKey.includes(encodeURIComponent(p.zoomUrl.trim().replace(/\\/g, '/')))) return true;
            if (p.gridUrl && cacheKey.includes(encodeURIComponent(p.gridUrl.trim().replace(/\\/g, '/')))) return true;
            return false;
        });
        if (found) matchingProd = found;
    }

    if (!isZoomRequest && matchingProd && matchingProd.zoomUrl && matchingProd.zoomUrl !== "None") {
        var encZoom = encodeURIComponent(matchingProd.zoomUrl.trim().replace(/\\/g, '/'));
        if (cacheKey.includes(encZoom) || cacheKey.includes(matchingProd.zoomUrl)) {
            isZoomRequest = true;
        }
    }

    var zoomBaseKey = null;
    var gridBaseKey = null;

    if (isZoomRequest) {
        zoomBaseKey = cacheKey;
        gridBaseKey = cacheKey.replace(/\/Zoom(%2F|\/)/i, '/Grid$1');
        if (matchingProd && matchingProd.zoomUrl && matchingProd.gridUrl) {
            var encZoomStr = encodeURIComponent(matchingProd.zoomUrl.trim().replace(/\\/g, '/'));
            var encGridStr = encodeURIComponent(matchingProd.gridUrl.trim().replace(/\\/g, '/'));
            if (gridBaseKey.includes(encZoomStr)) {
                gridBaseKey = gridBaseKey.replace(encZoomStr, encGridStr);
            }
        }
    } else if (cacheKey.includes('/Grid%2F') || cacheKey.includes('/Grid/')) {
        gridBaseKey = cacheKey;
        zoomBaseKey = cacheKey.replace(/\/Grid(%2F|\/)/i, '/Zoom$1');
        if (matchingProd && matchingProd.zoomUrl && matchingProd.gridUrl) {
            var encZoomStr = encodeURIComponent(matchingProd.zoomUrl.trim().replace(/\\/g, '/'));
            var encGridStr = encodeURIComponent(matchingProd.gridUrl.trim().replace(/\\/g, '/'));
            if (zoomBaseKey.includes(encGridStr)) {
                zoomBaseKey = zoomBaseKey.replace(encGridStr, encZoomStr);
            }
        }
    } else {
        gridBaseKey = cacheKey;
    }

    function buildVariants(baseKey) {
        if (!baseKey) return [];
        var list = [baseKey];
        var lk = baseKey.toLowerCase();
        if (lk.includes('.webp?alt=media')) {
            list.push(baseKey.replace(/\.webp\?alt=media/i, '.jpg?alt=media'));
            list.push(baseKey.replace(/\.webp\?alt=media/i, '.jpeg?alt=media'));
            list.push(baseKey.replace(/\.webp\?alt=media/i, '.png?alt=media'));
        } else if (lk.includes('.jpg?alt=media')) {
            list.push(baseKey.replace(/\.jpg\?alt=media/i, '.webp?alt=media'));
            list.push(baseKey.replace(/\.jpg\?alt=media/i, '.jpeg?alt=media'));
            list.push(baseKey.replace(/\.jpg\?alt=media/i, '.png?alt=media'));
        }

        try {
            var decoded = decodeURIComponent(baseKey);
            if (decoded.includes('/o/')) {
                var afterO = decoded.split('/o/')[1].split('?')[0];
                var lastSlashPos = afterO.lastIndexOf('/');
                if (lastSlashPos > -1) {
                    var folderWithSlash = afterO.substring(0, lastSlashPos + 1);
                    var folderNoSlash = afterO.substring(0, lastSlashPos);
                    [folderWithSlash, folderNoSlash].forEach(function(f) {
                        if (f && !list.includes(f)) list.push(f);
                    });
                }
            }
        } catch(e){}

        if (isCoverOrGarbage) {
            var baseList = [...list];
            baseList.forEach(function(u) {
                if (typeof u === 'string' && u.includes('?alt=media')) {
                    var extIndex = u.indexOf('.webp?alt=media');
                    if (extIndex > -1) {
                        var lastSlash = Math.max(u.lastIndexOf('%2F'), u.lastIndexOf('/'));
                        if (lastSlash > -1 && lastSlash < extIndex) {
                            var folderUrl = u.substring(0, lastSlash + (u.charAt(lastSlash) === '%' ? 3 : 1));
                            ['cover.webp', 'cover1.webp', '01.webp', '1.webp'].forEach(function(cName) {
                                var tryUrl = folderUrl + cName + '?alt=media';
                                if (!list.includes(tryUrl)) list.push(tryUrl);
                            });
                        }
                    }
                }
            });
        }
        return list;
    }

    var zoomUrlsToTry = zoomBaseKey ? buildVariants(zoomBaseKey) : [];
    var gridUrlsToTry = gridBaseKey ? buildVariants(gridBaseKey) : [];

    // Helper: convert blob to base64 or JPEG
    function processBlob(blob) {
        if (!blob || blob.size === 0) return Promise.resolve(null);
        return (forceJpeg ? blobToJpegForPDF(blob) : blobToBase64Direct(blob));
    }

    // Helper: Try IDB for a list of keys
    function tryIDBList(keys, index) {
        if (index >= keys.length) return Promise.resolve(null);
        return getImageFromDB(keys[index]).then(function(blob) {
            if (blob && blob.size > 0) {
                return processBlob(blob).then(function(res) {
                    if (res) return res;
                    return tryIDBList(keys, index + 1);
                });
            }
            return tryIDBList(keys, index + 1);
        }).catch(function() {
            return tryIDBList(keys, index + 1);
        });
    }

    // Helper: Try DOM extraction for Zoom (high-res swipe card only)
    function tryZoomDOM() {
        try {
            var decoded = decodeURIComponent(zoomBaseKey || cacheKey);
            var filename = decoded.substring(decoded.lastIndexOf('/') + 1).split('?')[0].toLowerCase();
            var designNum = parseInt(filename.replace(/\D/g, ''), 10);

            var cards = document.querySelectorAll('.swipe-card');
            for (var i = 0; i < cards.length; i++) {
                var c = cards[i];
                var d = (c.getAttribute('data-design') || '').toLowerCase();
                var dNum = parseInt(d.replace(/\D/g, ''), 10);
                if (d === filename || d === filename.replace(/\.[^.]+$/, '') || (!isNaN(designNum) && !isNaN(dNum) && designNum === dNum)) {
                    var img = c.querySelector('img');
                    // ONLY extract from DOM if Zoom is CONFIRMED loaded and >= 600px!
                    if (img && img.getAttribute('data-loaded-zoom') === 'true' && img.naturalWidth >= 600) {
                        var canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        var dataUrl = canvas.toDataURL(forceJpeg ? 'image/jpeg' : 'image/webp', 0.92);
                        if (dataUrl && dataUrl.length > 100) return Promise.resolve(dataUrl);
                    }
                }
            }
        } catch(e){}
        return Promise.resolve(null);
    }

    // Helper: Try Network for a list of URLs
    function tryNetworkList(keys, index) {
        if (index >= keys.length) return Promise.resolve(null);
        var fetchUrl = keys[index];
        if (!fetchUrl || !fetchUrl.startsWith('http') || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
            return tryNetworkList(keys, index + 1);
        }

        var ctrlC = new AbortController();
        var tidC = setTimeout(function() { ctrlC.abort(); }, 12000);
        return (window.fetchWithRetry ? window.fetchWithRetry(fetchUrl, { signal: ctrlC.signal }, 0) : fetch(fetchUrl, { signal: ctrlC.signal }))
            .then(function(res) { 
                clearTimeout(tidC);
                if (res.ok) return res.blob();
                throw new Error("HTTP " + res.status);
            })
            .then(function(netBlob) { 
                if (netBlob.size === 0) throw new Error("Zero byte file");
                if (typeof saveImageToDB === 'function') {
                    saveImageToDB(fetchUrl, netBlob).catch(() => {});
                }
                if (window.sessionImageCache) {
                    try { window.sessionImageCache.set(fetchUrl, netBlob); } catch(e){}
                }
                return processBlob(netBlob); 
            })
            .then(function(res) {
                if (res) return res;
                return tryNetworkList(keys, index + 1);
            })
            .catch(function() {
                clearTimeout(tidC);
                return tryNetworkList(keys, index + 1); 
            });
    }

    // Emergency Fallback: Try Grid from IDB, DOM, Network, and Directory Scan
    function tryGridFallback() {
        if (gridUrlsToTry.length === 0) return Promise.resolve(null);

        // 1. Check IDB for Grid
        return tryIDBList(gridUrlsToTry, 0).then(function(idbRes) {
            if (idbRes) return idbRes;

            // 2. Check DOM for Grid
            try {
                var decoded = decodeURIComponent(gridBaseKey || cacheKey);
                var filename = decoded.substring(decoded.lastIndexOf('/') + 1).split('?')[0].toLowerCase();
                var designNum = parseInt(filename.replace(/\D/g, ''), 10);

                var cards = document.querySelectorAll('.swipe-card');
                for (var i = 0; i < cards.length; i++) {
                    var c = cards[i];
                    var d = (c.getAttribute('data-design') || '').toLowerCase();
                    var dNum = parseInt(d.replace(/\D/g, ''), 10);
                    if (d === filename || d === filename.replace(/\.[^.]+$/, '') || (!isNaN(designNum) && !isNaN(dNum) && designNum === dNum)) {
                        var img = c.querySelector('img');
                        if (img && img.naturalWidth > 0) {
                            var canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            var ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            var dataUrl = canvas.toDataURL(forceJpeg ? 'image/jpeg' : 'image/webp', 0.92);
                            if (dataUrl && dataUrl.length > 100) return dataUrl;
                        }
                    }
                }

                var gridImgs = document.querySelectorAll('img.ci-img');
                for (var j = 0; j < gridImgs.length; j++) {
                    var gImg = gridImgs[j];
                    if (gImg.src && (gImg.src.includes(filename) || (cacheKey.includes('/o/') && gImg.src.includes(cacheKey.split('/o/')[1].split('?')[0])))) {
                        if (gImg.naturalWidth > 0) {
                            var canvas2 = document.createElement('canvas');
                            canvas2.width = gImg.naturalWidth;
                            canvas2.height = gImg.naturalHeight;
                            var ctx2 = canvas2.getContext('2d');
                            ctx2.drawImage(gImg, 0, 0);
                            var dataUrl2 = canvas2.toDataURL(forceJpeg ? 'image/jpeg' : 'image/webp', 0.92);
                            if (dataUrl2 && dataUrl2.length > 100) return dataUrl2;
                        }
                    }
                }
            } catch(e){}

            // 3. Check Network for Grid
            return tryNetworkList(gridUrlsToTry, 0).then(function(netRes) {
                if (netRes) return netRes;

                // 4. Directory Scan for Covers
                if (isCoverOrGarbage) {
                    try {
                        var bucket = "durga-sarees.firebasestorage.app";
                        var urlObj = new URL(cacheKey);
                        var pathName = decodeURIComponent(urlObj.pathname.split('/o/')[1]); 
                        var fwdPath = pathName.substring(0, pathName.lastIndexOf('/'));
                        var listPrefix = fwdPath.split('/').map(function(s) { return encodeURIComponent(s); }).join('/') + '/';
                        var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";
                        
                        return (window.fetchWithRetry ? window.fetchWithRetry(listUrl, {}, 0) : fetch(listUrl))
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                var files = (data.items || [])
                                    .map(function(item) { return item.name.substring(item.name.lastIndexOf('/') + 1); })
                                    .filter(function(f) { return /\.(webp|jpg|jpeg|png)$/i.test(f); });
                                if (files.length > 0) {
                                    files.sort(function(a, b) { return (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999); });
                                    var finalUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/" + fwdPath.split('/').map(function(s) { return encodeURIComponent(s); }).join('%2F') + "%2F" + encodeURIComponent(files[0]) + "?alt=media";
                                    return (window.fetchWithRetry ? window.fetchWithRetry(finalUrl, {}, 0) : fetch(finalUrl)).then(function(r) { return r.ok ? r.blob() : null; }).then(function(b) { return b ? processBlob(b) : null; });
                                }
                                return null;
                            }).catch(function() { return null; });
                    } catch (e) { return null; }
                }
                return null;
            });
        });
    }

    // Pipeline:
    // If zoom requested:
    // 1. Try Zoom in IDB (only Zoom URLs)
    // 2. Try Zoom in DOM (only if data-loaded-zoom === 'true' and naturalWidth >= 600)
    // 3. Try Zoom from Network (full HD)
    // 4. Emergency fallback: Grid IDB -> Grid DOM -> Grid Network -> List Scan
    if (zoomUrlsToTry.length > 0) {
        return tryIDBList(zoomUrlsToTry, 0).then(function(idbRes) {
            if (idbRes) return idbRes;
            return tryZoomDOM().then(function(domRes) {
                if (domRes) return domRes;
                return tryNetworkList(zoomUrlsToTry, 0).then(function(netRes) {
                    if (netRes) return netRes;
                    return tryGridFallback();
                });
            });
        });
    }

    // If not a Zoom request (Grid URL requested explicitly):
    return tryGridFallback();
}
window.getBase64FromCache = getBase64FromCache;




// ==========================================
// Helper: Get Firebase URL for a design
// ==========================================

async function resolveCorrectUrl(p, dId, overrideFolder) {
    if (!p) return null;
    
    // 1. Check if the cover is explicitly remapped via dsFallbackMap
    var cleanDId = (dId || '').replace(/\.[^/.]+$/, '').trim();
    var isCover = (!cleanDId || cleanDId.toUpperCase() === 'DIRECT' || cleanDId.toLowerCase() === 'cover' || cleanDId.toLowerCase() === 'cover1');
    var dsFallbackMap = {};
    try { dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}"); } catch(e){}
    var fallbackFileName = p.coverDesignId || dsFallbackMap[p.gridUrl] || dsFallbackMap[p.zoomUrl];

    if (isCover && fallbackFileName) {
        dId = fallbackFileName;
        isCover = false; // treat as named design now
    }

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    
    // Always default to high-res zoomUrl for high-res sharing & PDF.
    // overrideFolder is only used if explicitly provided (e.g. PDF multi-item thumbnail grid)
    var folderPath = overrideFolder || ((p.zoomUrl && p.zoomUrl !== "None") ? p.zoomUrl : p.gridUrl);
    if (!folderPath) folderPath = p.zoomUrl || p.gridUrl || "";
    var encPath = folderPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    
    var fileName;
    if (isCover) {
        fileName = "cover.webp";
    } else if (dId && /\.(webp|jpg|jpeg|png)$/i.test(dId)) {
        fileName = dId;
    } else if (dId) {
        fileName = String(dId).trim() + ".webp";
    } else {
        fileName = "cover.webp";
    }

    return fbBase + encPath + "%2F" + encodeURIComponent(fileName) + "?alt=media";
}
window.resolveCorrectUrl = resolveCorrectUrl;



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
                // Force resolution from GRID url to ensure tiny PDF size (identical to July 3rd logic)
                var resolvedUrl = await resolveCorrectUrl(g.p, dId, g.p.gridUrl);
                
                var blob = null;
                var cacheKey = await window.findDesignKeyInCache(g.p.gridUrl, dId);
                if (cacheKey) blob = await getImageFromDB(cacheKey);

                if (!blob && resolvedUrl) {
                    try {
                        var res = await fetch(resolvedUrl);
                        if (res.ok) {
                            blob = await res.blob();
                        } else {
                            var jpgUrl = resolvedUrl.replace('.webp', '.jpg');
                            var res2 = await fetch(jpgUrl);
                            if (res2.ok) {
                                blob = await res2.blob();
                            } else {
                                var pngUrl = resolvedUrl.replace('.webp', '.png');
                                var res3 = await fetch(pngUrl);
                                if (res3.ok) {
                                    blob = await res3.blob();
                                }
                            }
                        }
                    } catch (e) { }
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
                            doc.addImage(item._pdfImgSrc, 'JPEG', imgX, imgY, drawW, drawH);
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

        var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        var fsPlugin = isNative ? (window.CapacitorFilesystem || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem)) : null;
        var sharePlugin = isNative ? (window.CapacitorShare || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share)) : null;
        var isCapacitor = !!(isNative && fsPlugin);

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
                writeResult = await fsPlugin.writeFile({
                    path: fileName,
                    data: pureBase64,
                    directory: "DOCUMENTS"
                });
            } catch(saveErr) {
                // Fallback to CACHE if DOCUMENTS fails (some devices need permission)
                try {
                    writeResult = await fsPlugin.writeFile({
                        path: fileName,
                        data: pureBase64,
                        directory: "CACHE"
                    });
                } catch(e2) { console.warn("PDF save failed", e2); }
            }

            if (writeResult && sharePlugin) {
                // 2. Open Share picker so PDF is attached
                await sharePlugin.share({
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
// SHARED PDF PAGE RENDERERS
// ==========================================
function renderPdfUnderline(doc, text, x, y, align) {
    var textWidth = doc.getTextWidth(text);
    var startX = x;
    if (align === "center") startX = x - textWidth / 2;
    else if (align === "right") startX = x - textWidth;
    doc.setDrawColor(255, 140, 0);
    doc.setLineWidth(0.75);
    doc.line(startX, y + 2, startX + textWidth, y + 2);
}

function renderProductCoverPage(doc, product, base64Img, wixUrl, pageWidth, imgYStart = 260) {
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
    renderPdfUnderline(doc, "(Click for Ready Designs)", pageWidth / 2, 122, "center");

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
        var imgY = imgYStart + ((targetH - finalH) / 2); // Center vertically in remaining space
        doc.setDrawColor(221, 221, 221);
        doc.setLineWidth(1);
        doc.rect(imgX, imgY, finalW, finalH, 'D');
        // Image links to product Wix page
        doc.link(imgX, imgY, finalW, finalH, { url: wixUrl });
        doc.addImage(base64Img, 'JPEG', imgX, imgY, finalW, finalH, undefined, 'FAST');
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 100, 200);
    var footerText = "Click On image to view all Ready Designs of this product";
    doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });
}

function renderDesignPageContent(doc, titleText, base64Img, wixUrl, pageWidth) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 0, 0);
    doc.textWithLink(titleText, pageWidth / 2, 35, { url: wixUrl, align: "center" });

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
        doc.addImage(base64Img, 'JPEG', xPos, yPos, finalW, finalH, undefined, 'FAST');
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 100, 200);
    var footerText = "Click On image to view all Ready Designs of this product";
    doc.textWithLink(footerText, pageWidth / 2, 805, { url: wixUrl, align: "center" });
}

function renderFooterLogo(doc, logoBase64, pageWidth) {
    if (!logoBase64) return;
    try {
        var logoProp = doc.getImageProperties(logoBase64);
        var logoH = 26;
        var logoW = logoH * (logoProp.width / logoProp.height);
        logoW = Math.min(logoW, 100);
        var logoX = pageWidth - 40 - logoW;
        var logoY = 810 - logoH + 6;
        doc.link(logoX, logoY, logoW, logoH, { url: WEBSITE_BASE });
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
    } catch (e) { }
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
            var base64Img = await getBase64FromCache(imageUrlsArray[i]);

            if (i === 0) {
                renderProductCoverPage(doc, product, base64Img, wixUrl, pageWidth, 260);
            } else {
                renderDesignPageContent(doc, product.name + " — Design " + i, base64Img, wixUrl, pageWidth);
            }
            
            // Add Logo to bottom right of all pages
            var logoBase64 = await getLogoBase64();
            renderFooterLogo(doc, logoBase64, pageWidth);
        }

        var fileName = product.name.replace(/[^a-zA-Z0-9]/g, "_") + "_Catalog.pdf";

        if (actionType === 'preview') {
            doc.output('dataurlnewwindow');
        } else if (actionType === 'wa' || actionType === 'print') {
            var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            var fsPlugin = isNative ? (window.CapacitorFilesystem || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem)) : null;
            var sharePlugin = isNative ? (window.CapacitorShare || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share)) : null;
            var isCapacitor = !!(isNative && fsPlugin && sharePlugin);

            if (isCapacitor) {
                var pureBase64 = doc.output('datauristring').split(',')[1];
                var writeResult = await fsPlugin.writeFile({
                    path: fileName,
                    data: pureBase64,
                    directory: "CACHE"
                });
                
                var copyText = null;
                if (typeof window.generateShareMessage === 'function') {
                    copyText = window.generateShareMessage(product);
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyText);
                        else {
                            var ta = document.createElement("textarea"); ta.value = copyText; document.body.appendChild(ta);
                            ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        }
                        var toastId = 'copyToast_' + Date.now();
                        var toastHtml = `<div id="${toastId}" style="position:fixed; top:40%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); color:#fff; padding:16px 24px; border-radius:8px; font-size:16px; font-weight:bold; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:10000; display:flex; flex-direction:column; gap:8px; pointer-events:none;">
                            <i class="fas fa-check-circle" style="font-size:28px; color:#4caf50;"></i>
                            <span>Text Copied!</span>
                            <span style="font-size:13px; font-weight:normal; color:#ddd;">Please paste it into WhatsApp<br>along with the PDF.</span>
                        </div>`;
                        document.body.insertAdjacentHTML('beforeend', toastHtml);
                        setTimeout(() => { var t = document.getElementById(toastId); if(t) t.remove(); }, 5000);
                    } catch(e) {}
                }
                
                await sharePlugin.share({
                    title: product.name + ' Catalog',
                    text: copyText,
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
            var dArr = await getActualDesignsForProduct(product, shareType, actionType);
            
            var coverUrl;
            if (dArr.length > 0) {
                var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
                var fallbackFile = product.coverDesignId || dsFallbackMap[product.gridUrl] || dsFallbackMap[product.zoomUrl];
                if (fallbackFile) {
                    coverUrl = await resolveCorrectUrl(product, fallbackFile);
                } else if (dArr.length > 0) {
                    coverUrl = await resolveCorrectUrl(product, dArr[0]);
                } else {
                    coverUrl = await resolveCorrectUrl(product, 'DIRECT');
                }
            } else {
                if (shareType === 'ready') {
                    continue; // Skip products with 0 ready stock in favorites PDF
                }
                var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
                var fallbackFile = product.coverDesignId || dsFallbackMap[product.gridUrl] || dsFallbackMap[product.zoomUrl];
                var readyFallback = (product.ready) ? (window.getProductReadyDesigns ? window.getProductReadyDesigns(product.ready) : String(product.ready).split(',')).map(d => d.trim()).filter(d => d && checkStock(product, d)) : [];
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
            renderProductCoverPage(doc, product, coverBase64, wixUrl, pageWidth, 280);

            // Logo
            if (logoBase64) {
                renderFooterLogo(doc, logoBase64, pageWidth);
            }
            
            // --- DRAW DESIGN PAGES IF REQUIRED ---
            if (dArr.length > 0 && shareType !== 'cover') {
                for (var j = 1; j < dArr.length; j++) {
                    var dId = dArr[j];
                    var dUrl = await resolveCorrectUrl(product, dId);
                    var dBase64 = await getBase64FromCache(dUrl, true);
                    
                    doc.addPage();
                    renderDesignPageContent(doc, product.name + " — " + dId, dBase64, wixUrl, pageWidth);

                    if (logoBase64) {
                        renderFooterLogo(doc, logoBase64, pageWidth);
                    }
                }
            }
        } // End loop over products

        if (isFirstPage) {
            if (bootScreen) bootScreen.style.display = 'none';
            alert("No ready designs currently in stock for the selected favorite items.");
            return;
        }
        
        var fileName = "Favorite_Items_Catalog.pdf";
        if (actionType === 'preview') {
            doc.output('dataurlnewwindow');
        } else if (actionType === 'wa' || actionType === 'print') {
            var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            var fsPlugin = isNative ? (window.CapacitorFilesystem || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem)) : null;
            var sharePlugin = isNative ? (window.CapacitorShare || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share)) : null;
            var isCapacitor = !!(isNative && fsPlugin && sharePlugin);
            if (isCapacitor) {
                var pureBase64 = doc.output('datauristring').split(',')[1];
                var writeResult = await fsPlugin.writeFile({
                    path: fileName, data: pureBase64, directory: "CACHE"
                });
                await sharePlugin.share({
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

async function shareNativeImages(productName, productPrice, imageUrlsArray, deepLink) {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) {
        bootScreen.style.display = 'flex';
        document.getElementById('bootMsg').innerText = "Preparing Images...";
    }
    
    window.isSharing = true;

    try {
        var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        var fsPlugin = isNative ? (window.CapacitorFilesystem || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem)) : null;
        var sharePlugin = isNative ? (window.CapacitorShare || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share)) : null;
        var isCapacitor = !!(isNative && fsPlugin && sharePlugin);
        var nativeSuccess = false;

        if (isCapacitor) {
            try {
                // Fetch all base64 images concurrently for instant performance (Force JPEG for WhatsApp compatibility)
                var base64Results = await Promise.all(imageUrlsArray.map(url => getBase64FromCache(url, true)));
                
                var failedUrls = [];
                var writePromises = [];
                for (var i = 0; i < base64Results.length; i++) {
                    var base64Img = base64Results[i];
                    if (base64Img) {
                        var pureBase64 = base64Img.includes(',') ? base64Img.split(',')[1] : base64Img;
                        var ext = 'jpg';
                        var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + "_" + Date.now() + "." + ext;
                        writePromises.push(
                            fsPlugin.writeFile({
                                path: fileName,
                                data: pureBase64,
                                directory: "CACHE"
                            }).then(r => r.uri).catch(err => {
                                console.warn("Failed writing image to cache:", err);
                                return null;
                            })
                        );
                    } else {
                        failedUrls.push(imageUrlsArray[i]);
                    }
                }
                var uriArray = (await Promise.all(writePromises)).filter(Boolean);

                if (failedUrls.length > 0) {
                    var errMsg = "Failed to fetch " + failedUrls.length + " images. URLs: " + failedUrls.join(', ');
                    console.error("Share Images Error:", errMsg);
                    if (typeof window.logAppError === 'function') window.logAppError("Share Images", errMsg);
                    
                    if (uriArray.length > 0) {
                        var confirmMsg = "⚠️ " + failedUrls.length + " image(s) could not be downloaded and will be skipped.\n\nContinue sharing the rest (" + uriArray.length + " images)?";
                        if (!confirm(confirmMsg)) {
                            if (bootScreen) bootScreen.style.display = 'none';
                            return;
                        }
                    }
                }

                if (uriArray.length === 0) {
                    if (bootScreen) bootScreen.style.display = 'none';
                    alert("Could not prepare images for sharing. Please check your internet connection.");
                    return;
                }

                let shareTitle = productName;
                if (productPrice) shareTitle += " — ₹" + productPrice;
                
                let shareOptions = {
                    title: shareTitle,
                    files: uriArray
                };
                
                if (deepLink) {
                    var copyText = "Check out this design at Durga Sarees:\n\n" + deepLink;
                    if (typeof window.generateShareMessage === 'function' && window.curProduct) {
                        copyText = window.generateShareMessage(window.curProduct);
                    }
                    if (uriArray.length > 1) {
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyText);
                            else {
                                var ta = document.createElement("textarea"); ta.value = copyText; document.body.appendChild(ta);
                                ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                            }
                            
                            var toastId = 'copyToast_' + Date.now();
                            var toastHtml = `<div id="${toastId}" style="position:fixed; top:40%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); color:#fff; padding:16px 24px; border-radius:8px; font-size:16px; font-weight:bold; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:10000; display:flex; flex-direction:column; gap:8px; pointer-events:none;">
                                <i class="fas fa-check-circle" style="font-size:28px; color:#4caf50;"></i>
                                <span>Link Copied!</span>
                                <span style="font-size:13px; font-weight:normal; color:#ddd;">Please paste it into WhatsApp<br>after images appear.</span>
                            </div>`;
                            document.body.insertAdjacentHTML('beforeend', toastHtml);
                            setTimeout(() => { var t = document.getElementById(toastId); if(t) t.remove(); }, 5000);
                        } catch(e) {}
                    } else {
                        shareOptions.text = copyText;
                    }
                }

                await sharePlugin.share(shareOptions);
                nativeSuccess = true;
            } catch (nativeErr) {
                var errStr = String(nativeErr && nativeErr.message ? nativeErr.message : nativeErr).toLowerCase();
                if (errStr.includes("cancel") || errStr.includes("dismiss")) {
                    nativeSuccess = true; // User cancelled, prevent fallback
                } else {
                    console.warn("Native share failed, attempting web fallback:", nativeErr);
                    if (typeof window.logAppError === 'function') window.logAppError("Native Share", errStr);
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
                    var ext = base64Img.split(';')[0].split('/')[1];
                    if (ext === 'jpeg') ext = 'jpg';
                    if (ext === 'octet-stream' || !ext) ext = 'webp';
                    var fileName = productName.replace(/[^a-zA-Z0-9]/g, "_") + "_Design_" + i + "." + ext;
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

            if (filesArray.length === 0) {
                if (bootScreen) bootScreen.style.display = 'none';
                alert("Could not load images to share. Please check your internet connection.");
                return;
            }

            var webShareSupported = (typeof navigator.share === 'function');
            var canShareFiles = webShareSupported && (typeof navigator.canShare === 'function' ? navigator.canShare({ files: filesArray }) : true);

            if (webShareSupported && canShareFiles) {
                if (deepLink) {
                    var copyText = "Check out this design at Durga Sarees:\n\n" + deepLink;
                    if (typeof window.generateShareMessage === 'function' && window.curProduct) {
                        copyText = window.generateShareMessage(window.curProduct);
                    }
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyText);
                        else {
                            var ta = document.createElement("textarea"); ta.value = copyText; document.body.appendChild(ta);
                            ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        }
                        
                        var toastId = 'copyToast_' + Date.now();
                        var toastHtml = `<div id="${toastId}" style="position:fixed; top:40%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); color:#fff; padding:16px 24px; border-radius:8px; font-size:16px; font-weight:bold; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:10000; display:flex; flex-direction:column; gap:8px; pointer-events:none;">
                            <i class="fas fa-check-circle" style="font-size:28px; color:#4caf50;"></i>
                            <span>Link Copied!</span>
                            <span style="font-size:13px; font-weight:normal; color:#ddd;">Please paste it into WhatsApp<br>after images appear.</span>
                        </div>`;
                        document.body.insertAdjacentHTML('beforeend', toastHtml);
                        setTimeout(() => { var t = document.getElementById(toastId); if(t) t.remove(); }, 5000);
                    } catch(e) {}
                }

                try {
                    await navigator.share({
                        title: "🛍️ " + productName + " — ₹" + productPrice,
                        files: filesArray
                    });
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError' || (shareErr.message && shareErr.message.toLowerCase().includes('cancel'))) {
                        if (bootScreen) bootScreen.style.display = 'none';
                        return; // User cancelled
                    }
                    console.error("Web Share API failed:", shareErr);
                }
            } else {
                var waText = "Check out this design at Durga Sarees:\n\n" + (deepLink || WEBSITE_BASE);
                if (typeof window.generateShareMessage === 'function' && window.curProduct) {
                    waText = window.generateShareMessage(window.curProduct);
                }

                if (confirm("Direct multi-image sharing is only supported in the Mobile App.\n\nWould you like to download the images and open WhatsApp?")) {
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
                    window.open("https://wa.me/?text=" + encodeURIComponent(waText), '_blank');
                }
            }
        }
    } catch (error) {
        if (typeof window.logAppError === 'function') window.logAppError('AUDITOR: shareImages', error.message);
        alert("Image Sharing Error: " + error.message);
    }

    window.isSharing = false;
    if (bootScreen) bootScreen.style.display = 'none';
}


function askShareTypeAsync(isMainPage) {
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

        var btnReady = document.createElement('button');
        btnReady.innerText = 'Ready Designs';
        btnReady.style.width = '100%'; btnReady.style.padding = '12px'; btnReady.style.marginBottom = '10px';
        btnReady.style.backgroundColor = 'var(--myntra-pink)'; btnReady.style.color = '#fff';
        btnReady.style.border = 'none'; btnReady.style.borderRadius = '6px'; btnReady.style.fontSize = '14px';
        btnReady.onclick = function () { close('ready'); };

        var btnAll = document.createElement('button');
        btnAll.innerText = 'All Designs';
        btnAll.style.width = '100%'; btnAll.style.padding = '12px'; btnAll.style.marginBottom = '10px';
        btnAll.style.backgroundColor = '#007BFF'; btnAll.style.color = '#fff';
        btnAll.style.border = 'none'; btnAll.style.borderRadius = '6px'; btnAll.style.fontSize = '14px';
        btnAll.onclick = function () { close('full'); };

        var btnCover = document.createElement('button');
        btnCover.innerText = isMainPage ? 'Cover Images (1 pic per product)' : 'Cover Image Only';
        btnCover.style.width = '100%'; btnCover.style.padding = '12px'; btnCover.style.marginBottom = '10px';
        btnCover.style.backgroundColor = '#333'; btnCover.style.color = '#fff';
        btnCover.style.border = 'none'; btnCover.style.borderRadius = '6px'; btnCover.style.fontSize = '14px';
        btnCover.onclick = function () { close('cover'); };

        var btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancel';
        btnCancel.style.width = '100%'; btnCancel.style.padding = '12px';
        btnCancel.style.backgroundColor = '#eee'; btnCancel.style.color = '#333';
        btnCancel.style.border = 'none'; btnCancel.style.borderRadius = '6px'; btnCancel.style.fontSize = '14px';
        btnCancel.onclick = function () { close(null); };

        box.appendChild(title); box.appendChild(btnReady); box.appendChild(btnAll); box.appendChild(btnCover); box.appendChild(btnCancel);
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
        var rawFavs = allProducts.filter(p => favorites[p.id]);
        if (rawFavs.length === 0) {
            history.back(); // Pop the shareModal state we were hiding
            return alert("No favorite items to share. Please mark some products as favorites first.");
        }

        // Deduplicate favorite products by normalized name so duplicates never share multiple cards
        var favProducts = [];
        var seenFavNames = {};
        rawFavs.forEach(fp => {
            var nKey = (fp.name || '').trim().toLowerCase();
            if (!nKey || !seenFavNames[nKey]) {
                if (nKey) seenFavNames[nKey] = true;
                favProducts.push(fp);
            }
        });

        var shareType = await askShareTypeAsync(true);
        if (!shareType) return;

        var allHighResUrls = [];
        var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");

        if (shareType === 'cover') {
            // GUARANTEED: Exactly 1 cover image per unique favorite product
            for (var i = 0; i < favProducts.length; i++) {
                var fp = favProducts[i];
                var fallbackFile = fp.coverDesignId || dsFallbackMap[fp.gridUrl] || dsFallbackMap[fp.zoomUrl];
                var readyDesigns = (fp.ready) ? (window.getProductReadyDesigns ? window.getProductReadyDesigns(fp.ready) : String(fp.ready).split(',')).map(d => d.trim()).filter(d => d && checkStock(fp, d)) : [];
                var coverDesignId = 'DIRECT';

                if (fallbackFile) {
                    coverDesignId = fallbackFile;
                } else if (readyDesigns.length > 0) {
                    coverDesignId = readyDesigns[0];
                }

                var cUrl = await resolveCorrectUrl(fp, coverDesignId);
                if (cUrl) {
                    cUrl = cUrl.replace(/%2F%2F/g, '%2F');
                    if (!allHighResUrls.includes(cUrl)) {
                        allHighResUrls.push(cUrl);
                    }
                }
            }
        } else {
            // 'ready' or 'full' designs
            for (var i = 0; i < favProducts.length; i++) {
                var fp = favProducts[i];
                var dArr = await getActualDesignsForProduct(fp, shareType, action);
                if (dArr.length > 0) {
                    for (var j = 0; j < dArr.length; j++) {
                        var dUrl = await resolveCorrectUrl(fp, dArr[j]);
                        if (dUrl) {
                            dUrl = dUrl.replace(/%2F%2F/g, '%2F');
                            if (!allHighResUrls.includes(dUrl)) {
                                allHighResUrls.push(dUrl);
                            }
                        }
                    }
                } else if (shareType !== 'ready') {
                    var fallbackFile = fp.coverDesignId || dsFallbackMap[fp.gridUrl] || dsFallbackMap[fp.zoomUrl];
                    var readyDesigns = (fp.ready) ? (window.getProductReadyDesigns ? window.getProductReadyDesigns(fp.ready) : String(fp.ready).split(',')).map(d => d.trim()).filter(d => d && checkStock(fp, d)) : [];
                    var coverDesignId = fallbackFile || (readyDesigns.length > 0 ? readyDesigns[0] : 'DIRECT');
                    var cUrl = await resolveCorrectUrl(fp, coverDesignId);
                    if (cUrl) {
                        cUrl = cUrl.replace(/%2F%2F/g, '%2F');
                        if (!allHighResUrls.includes(cUrl)) {
                            allHighResUrls.push(cUrl);
                        }
                    }
                }
            }
        }

        if (action === 'images') {
            if (allHighResUrls.length === 0) {
                if (shareType === 'ready') {
                    alert("No ready designs currently in stock for the selected favorite items.");
                } else {
                    alert("No images found to share for the selected items.");
                }
                return;
            }
            if (allHighResUrls.length > 100) {
                alert("⚠ ️ WhatsApp limits sharing to 100 images at a time. Only the first 100 items will be sent successfully.");
                allHighResUrls = allHighResUrls.slice(0, 100);
            }
            if (typeof shareNativeImages === 'function') {
                await shareNativeImages("Favorite Items", "", allHighResUrls);
            }
        } else if (action === 'wa') {
            if (typeof window.generateFavoritesPDF === 'function') {
                await window.generateFavoritesPDF(favProducts, shareType, action);
            }
        }
        return;
    }

    // --- EXISTING SINGLE PRODUCT SHARE ---
    if (!curProduct) {
        history.back();
        return;
    }

    var shareType = await askShareTypeAsync(false);
    if (!shareType) return;

    var highResUrls = [];
    var folderPath = (curProduct.zoomUrl && curProduct.zoomUrl !== "None") ? curProduct.zoomUrl : curProduct.gridUrl;
    var dArr = await getActualDesignsForProduct(curProduct, shareType, action);

    if (dArr.length > 0) {
        for (var j = 0; j < dArr.length; j++) {
            var dUrl = await resolveCorrectUrl(curProduct, dArr[j]);
            if (dUrl && !highResUrls.includes(dUrl)) {
                highResUrls.push(dUrl);
            }
        }
    } else {
        if (shareType === 'ready') {
            alert("No ready designs currently in stock for this product.");
            return;
        }
        // Cover mode: Use curProduct.coverDesignId first, then dsFallbackMap, then ready designs, then DIRECT
        var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
        var fallbackFile = curProduct.coverDesignId || dsFallbackMap[curProduct.gridUrl] || dsFallbackMap[curProduct.zoomUrl];
        var readyDesigns = (curProduct.ready) ? (window.getProductReadyDesigns ? window.getProductReadyDesigns(curProduct.ready) : String(curProduct.ready).split(',')).map(d => d.trim()).filter(d => d && checkStock(curProduct, d)) : [];
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
            var pLink = "https://durga-sarees.web.app/?pid=" + encodeURIComponent(curProduct.docId || curProduct.id);
            await shareNativeImages(curProduct.name, curProduct.price, highResUrls, pLink);
        }
    } else {
        if (typeof generateNativePDF === 'function') {
            await generateNativePDF(curProduct, highResUrls, action);
        }
    }
}

