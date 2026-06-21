// ==========================================
// 🌸 DURGA SAREES - FIXED APP.JS v3 (RESTORED UI)
// ==========================================

const FIRESTORE_PRODUCTS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products?pageSize=1000";
const FIRESTORE_USERS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users?pageSize=100";

history.replaceState({ modal: 'main' }, '');

var allProducts = [];
var displayList = [];
var cart = {};
var favorites = {};
var activeUser = null;
var activeCategories = [];
var activePriceFilters = [];
var currentSort = 'new';
var curProduct = null;
var cameFromDetail = false;
var searchingTransition = false;

// Escapes text safely
function esc(s) { return (!s) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ==========================================
// 🚀 NEW IMAGE URL HELPERS
// ==========================================
function getFirebaseImageUrl(path, targetFile) {
    if (!path || path.trim() === "" || path.toLowerCase() === "none") {
        return "https://placehold.co/300x300/f0f0f0/a0a0a0?text=No+Image";
    }
    const bucket = "durga-sarees.firebasestorage.app";
    const fbBase = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
    const fileToFetch = targetFile || "01.webp";
    const encPath = path.split('/').map(encodeURIComponent).join('%2F');
    return `${fbBase}${encPath}%2F${fileToFetch}?alt=media`;
}

function handleImgError(imgElement, gridPath) {
    const bucket = "durga-sarees.firebasestorage.app";
    const fbBase = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
    const encGridPath = gridPath ? gridPath.split('/').map(encodeURIComponent).join('%2F') : null;

    if (!encGridPath) {
        imgElement.src = "https://placehold.co/300x300/f0f0f0/a0a0a0?text=No+Image";
        imgElement.onerror = null;
        return;
    }

    const src = imgElement.src;
    if (src.includes('01.webp')) {
        imgElement.src = `${fbBase}${encGridPath}%2Fcover.webp?alt=media`;
    } else if (src.includes('cover.webp')) {
        imgElement.src = `${fbBase}${encGridPath}%2F1.webp?alt=media`;
    } else {
        imgElement.src = "https://placehold.co/300x300/f0f0f0/a0a0a0?text=No+Image";
        imgElement.onerror = null;
    }
}

window.addEventListener('DOMContentLoaded', function () {
    try {
        try { activeUser = localStorage.getItem("dsUserToken"); } catch (e) { }
        try { cart = JSON.parse(localStorage.getItem("dsCart")) || {}; } catch (e) { }
        try { favorites = JSON.parse(localStorage.getItem("dsFavs")) || {}; } catch (e) { }

        var loginScreen = document.getElementById('loginScreen');
        var appBody = document.getElementById('appBody');

        if (activeUser) {
            if (loginScreen) loginScreen.style.display = 'none';
            if (appBody) appBody.style.display = 'flex';
            initApp();
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appBody) appBody.style.display = 'none';
        }

        setupEditableFields();
        setupFsGestures();
    } catch (err) { console.error("Init error:", err); }
});

function doLogin() {
    var userEl = document.getElementById('lUser');
    var passEl = document.getElementById('lPass');
    var errEl = document.getElementById('lErr');
    if (!userEl || !passEl) return;

    var user = userEl.value.trim().toLowerCase();
    var pass = passEl.value.trim();
    if (!user || !pass) { if (errEl) errEl.innerText = "Enter username and password"; return; }

    var btn = document.getElementById('btnLogin');
    if (btn) btn.innerText = "Checking...";
    if (errEl) errEl.innerText = "Connecting...";

    fetch(FIRESTORE_USERS_URL)
        .then(res => res.json())
        .then(data => {
            var docs = data.documents || [];
            var isValid = false;

            for (var i = 0; i < docs.length; i++) {
                var f = docs[i].fields;
                if (f && f.username && f.password && f.status) {
                    if (f.username.stringValue.trim().toLowerCase() === user && f.password.stringValue.trim() === pass && f.status.stringValue.trim().toLowerCase() === 'active') {
                        isValid = true; break;
                    }
                }
            }

            if (isValid) {
                try { localStorage.setItem("dsUserToken", user); } catch (e) { }
                activeUser = user;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('appBody').style.display = 'flex';
                initApp();
            } else {
                if (errEl) errEl.innerText = "❌ Invalid credentials.";
                if (btn) btn.innerText = "LOGIN";
            }
        }).catch(err => {
            if (errEl) errEl.innerText = "❌ Network error.";
            if (btn) btn.innerText = "LOGIN";
        });
}

function initApp() {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) bootScreen.style.display = 'flex';

    fetch(FIRESTORE_PRODUCTS_URL)
        .then(res => res.json())
        .then(data => {
            var docs = data.documents || [];
            console.log("DATABASE PRODUCTS SAMPLE:", docs.slice(0, 20).map(d => ({
                name: d.fields?.name?.stringValue,
                packing: d.fields?.packing
            })));
            var validCounter = 0;
            allProducts = [];

            var edited = {};
            try { edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {}; } catch (e) { }

            docs.forEach(d => {
                var f = d.fields || {};
                var name = f.name ? f.name.stringValue : "";

                if (name && name.toLowerCase() !== "temp" && name.toLowerCase() !== "unnamed") {
                    var finalPrice = f.price ? (f.price.doubleValue || f.price.integerValue || 0) : 0;
                    var finalPacking = f.packing ? (f.packing.stringValue || (f.packing.integerValue !== undefined ? String(f.packing.integerValue) : "") || (f.packing.doubleValue !== undefined ? String(f.packing.doubleValue) : "") || "1") : "1";

                    if (edited[name]) {
                        if (edited[name].price !== undefined) finalPrice = edited[name].price;
                        if (edited[name].packing !== undefined) finalPacking = edited[name].packing;
                    }

                    allProducts.push({
                        id: "p_" + validCounter,
                        name: name,
                        sku: f.sku ? f.sku.stringValue : "",
                        price: finalPrice,
                        cat: f.cat ? f.cat.stringValue : "Uncategorized",
                        gridUrl: f.gridUrl ? f.gridUrl.stringValue : "",
                        zoomUrl: f.zoomUrl ? f.zoomUrl.stringValue : "",
                        mrp: f.mrp ? (f.mrp.doubleValue || f.mrp.integerValue || 0) : 0,
                        fabric: f.fabric ? f.fabric.stringValue : "",
                        packing: finalPacking,
                        mult: f.mult ? (f.mult.integerValue || 8) : 8,
                        ready: f.ready ? f.ready.stringValue : ""
                    });
                    validCounter++;
                }
            });

            if (bootScreen) bootScreen.style.display = 'none';
            displayList = [...allProducts];

            // Map stale cart IDs to current session IDs to prevent cross-session product mismatch bugs
            try {
                var updatedCart = {};
                for (var k in cart) {
                    var c = cart[k];
                    if (c && c.p) {
                        var match = allProducts.find(x => (c.p.sku && x.sku === c.p.sku) || (x.name === c.p.name));
                        if (match) {
                            c.p = match;
                            var newKey = match.id + '_' + c.design;
                            updatedCart[newKey] = c;
                        } else {
                            updatedCart[k] = c;
                        }
                    }
                }
                cart = updatedCart;
                localStorage.setItem("dsCart", JSON.stringify(cart));
            } catch (e) { console.error("Cart sync error:", e); }

            if (typeof populateCategories === "function") populateCategories();
            renderProductGrid(displayList);
            updateCartHeader();
            
            // Start silent background pre-fetching of all grid images
            setTimeout(startImagePrefetch, 1500);
        })
        .catch(err => alert("Firebase Load Error: " + err.message));
}

// ==========================================
// 🚀 IMAGE CACHING & PRE-FETCHING
// ==========================================
var dbName = "DurgaSareesCache";
var storeName = "images";
var cachedDB = null;

function getDB() {
    if (cachedDB) {
        return Promise.resolve(cachedDB);
    }
    return new Promise((resolve, reject) => {
        var request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = function (e) {
            cachedDB = e.target.result;
            resolve(cachedDB);
        };
        request.onerror = function (e) {
            console.error("IndexedDB error:", e.target.error);
            reject(e.target.error);
        };
    });
}

function saveImageToDB(key, blob) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            try {
                var tx = db.transaction(storeName, "readwrite");
                var store = tx.objectStore(storeName);
                var req = store.put(blob, key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            } catch (e) {
                console.error("IndexedDB save transaction failed", e);
                reject(e);
            }
        });
    }).catch(e => {
        console.error("IndexedDB save failed", e);
        return false;
    });
}

function getImageFromDB(key) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            try {
                var tx = db.transaction(storeName, "readonly");
                var store = tx.objectStore(storeName);
                var req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) {
                console.error("IndexedDB get transaction failed", e);
                reject(e);
            }
        });
    }).catch(e => {
        console.error("IndexedDB get failed", e);
        return null;
    });
}

function getCachedImageBlob(url) {
    return getImageFromDB(url).then(blob => {
        if (blob) return blob;
        // Fallback for older cache keys that had /0 in them
        if (url.includes('%2F0')) {
            var fallbackUrl = url.replace('%2F0', '%2F');
            return getImageFromDB(fallbackUrl);
        }
        return null;
    });
}

function getCachedDesignUrl(zoomUrl, gridUrl) {
    // 1. Check if the zoom image is cached
    return getCachedImageBlob(zoomUrl).then(zoomBlob => {
        if (zoomBlob) {
            return { src: URL.createObjectURL(zoomBlob), isZoom: true };
        }
        // 2. Check if the grid image is cached
        return getCachedImageBlob(gridUrl).then(gridBlob => {
            if (gridBlob) {
                return { src: URL.createObjectURL(gridBlob), isZoom: false };
            }
            // 3. If nothing is in IndexedDB, return the direct grid URL to be rendered
            return { src: gridUrl, isZoom: false };
        });
    });
}

// ====================================
// EXACT UI RESTORATION (MRP, PACKING, ADD BTN)
// ====================================
function buildCardDetails(p) {
    var totalQty = 0;
    for (var k in cart) { if (cart[k].p.id === p.id) totalQty += parseInt(cart[k].qty) || 0; }

    var coverKey = p.id + '_DIRECT';
    var coverQty = cart[coverKey] ? parseInt(cart[coverKey].qty) || 0 : 0;

    var parsedPrice = parseInt(p.price) || 0;
    var displayMrp = parseInt(p.mrp) || Math.round(parsedPrice / 0.70);
    var offPercent = displayMrp > parsedPrice ? Math.round(((displayMrp - parsedPrice) / displayMrp) * 100) : 30;
    var favClass = favorites[p.id] ? "fas fa-heart fav-active" : "far fa-heart fav-inactive";

    var h = [];
    h.push('<div style="display:flex; align-items:center; width:100%; gap:4px; overflow:hidden;">');
    h.push('<div class="ci-brand" style="flex:1 1 0; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">' + esc(p.name) + '</div>');

    var packLen = String(p.packing || "1").length;
    var displayLen = Math.min(packLen, 8);
    h.push('<input type="text" class="pack-input-inline" value="' + esc(p.packing) + '" readonly onclick="event.stopPropagation()" style="flex-shrink:0; text-align:right; width:' + (displayLen + 0.5) + 'ch !important; min-width:1ch !important; max-width:7.5ch !important; font-size:11px !important; padding:0; margin:0;">');
    h.push('<div class="fav-btn-inline" style="flex-shrink:0; padding-left:0;" onclick="toggleFav('' + p.id + '', event)"><i class="' + favClass + '"></i></div>');
    h.push('</div>');

    h.push('<div class="ci-fabric" style="margin-top:0;">' + esc(p.fabric) + '</div>');
    h.push('<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; width:100%;">');
    h.push('<div style="display:flex; align-items:baseline; gap:0; overflow:hidden;">');
    if (displayMrp > 0) h.push('<span class="mrp" style="font-size:11px; margin-right:4px;">₹' + displayMrp + '</span>');
    h.push('<span style="font-weight:bold; font-size:13px; display:flex; align-items:center;">₹<input type="number" class="price-input-inline" value="' + parsedPrice + '" readonly onclick="event.stopPropagation()"></span>');
    if (offPercent > 0) h.push('<span class="discount" style="font-size:10px; color:#ff905a; font-weight:bold; white-space:nowrap; margin-left: 2px;">' + offPercent + '% OFF</span>');
    h.push('</div>');

    h.push('<div style="flex-shrink:0;">');
    if (coverQty === 0 || isNaN(coverQty)) {
        h.push('<div class="add-btn-clean" onclick="chgMainRow('' + p.id + '', 1); event.stopPropagation();">ADD</div>');
    } else {
        h.push('<div class="qty-clean" onclick="event.stopPropagation()">');
        h.push('<button onclick="chgMainRow('' + p.id + '', -1)">−</button>');
        h.push('<input type="number" id="mqty-' + p.id + '" value="' + coverQty + '" readonly>');
        h.push('<button onclick="chgMainRow('' + p.id + '', 1)">+</button>');
        h.push('</div>');
    }
    h.push('</div></div>');
    return h.join('');
}

function refreshCardUI(pid) {
    var p = allProducts.find(x => x.id === pid);
    if (!p) return;
    var wrap = document.getElementById('detail-wrap-' + pid);
    if (wrap) wrap.innerHTML = buildCardDetails(p);

    var totalQty = 0;
    for (var k in cart) { if (cart[k].p.id === pid) totalQty += parseInt(cart[k].qty) || 0; }
    var badge = document.getElementById('badge-' + pid);
    if (badge) {
        if (totalQty > 0) { badge.innerText = totalQty + ' in cart'; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }
    }
    updateCartHeader();
}

function renderProductGrid(products) {
    const gridEl = document.getElementById("grid");
    if (!gridEl) return;

    if (!products || products.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align:center; width:100%;">No items available.</div>';
        return;
    }

    var sorted = [...products].sort((a, b) => {
        var catA = (a.cat || "Uncategorized").toLowerCase();
        var catB = (b.cat || "Uncategorized").toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        if (currentSort === 'priceAsc') return a.price - b.price;
        if (currentSort === 'priceDesc') return b.price - a.price;
        return 0;
    });

    let htmlBuffer = [];
    sorted.forEach((p) => {
        let imgElementId = "img_" + p.id;
        var totalQty = 0;
        for (var k in cart) { if (cart[k].p.id === p.id) totalQty += parseInt(cart[k].qty) || 0; }
        var bHtml = totalQty > 0 ? `<div class="item-qty-badge" id="badge-${p.id}">${totalQty} in cart</div>` : `<div class="item-qty-badge" id="badge-${p.id}" style="display:none;"></div>`;

        const gridImageUrl = getFirebaseImageUrl(p.gridUrl, "01.webp");

        htmlBuffer.push(`
        <div class="card" id="card-${p.id}">
            <div class="thumb" onclick="openDetail('${p.id}')">
                ${bHtml}
                <img id="${imgElementId}" src="${gridImageUrl}" alt="${esc(p.name)}" onerror="handleImgError(this, '${p.gridUrl}')">
            </div>
            <div class="ci" id="detail-wrap-${p.id}" style="padding: 8px 0 0 0;">
                ${buildCardDetails(p)}
            </div>
        </div>
        `);
    });

    gridEl.innerHTML = htmlBuffer.join('');
}

// ====================================
// CORE FUNCTIONS
// ====================================
function chgMainRow(pid, dir) {
    var p = allProducts.find(x => x.id === pid); if (!p) return;
    var key = p.id + '_DIRECT';
    var curQ = cart[key] ? cart[key].qty : 0;
    var newQ = Math.max(0, curQ + (dir * (p.mult || 1)));

    if (newQ === 0 || isNaN(newQ)) delete cart[key];
    else cart[key] = { p: p, design: 'DIRECT', qty: newQ };

    try { localStorage.setItem("dsCart", JSON.stringify(cart)); } catch (e) { }
    refreshCardUI(pid);
}

function toggleFav(pid, event) {
    if (event) event.stopPropagation();
    if (favorites[pid]) delete favorites[pid]; else favorites[pid] = true;
    try { localStorage.setItem("dsFavs", JSON.stringify(favorites)); } catch (err) { }
    refreshCardUI(pid);
}

function updateCartHeader() {
    var count = 0;
    for (var k in cart) {
        if (cart[k] && cart[k].qty) {
            count += parseInt(cart[k].qty) || 0;
        }
    }
    var els = document.querySelectorAll('.cart-badge-top, #cartCountHeader');
    els.forEach(e => e.innerText = count);
}


// ====================================
// 4. PRODUCT DETAIL (SWIPE DECK)
// ====================================
var missingDesignSvg = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="100%" height="100%" fill="#f5f5f6"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#6c757d">Design Image</text>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#adb5bd">Not Found on Server</text>
</svg>
`);

function loadAndCacheDesignImage(imgEl, url, designGridUrl, productId, fileName) {
    if (imgEl.getAttribute('data-loaded-zoom') === 'true') {
        return; // Already loaded zoom image from cache!
    }
    var cacheKey = url; // Zoom URL is the key

    // 1. Check for high-res (zoom) image in cache
    getImageFromDB(cacheKey).then(blob => {
        if (blob) {
            // Found in cache! Use it.
            imgEl.src = URL.createObjectURL(blob);
            imgEl.setAttribute('data-loaded-zoom', 'true');
        } else {
            // 2. Not in cache, so fetch from network
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.blob();
                })
                .then(newBlob => {
                    // 3. Save to cache for next time
                    saveImageToDB(cacheKey, newBlob);
                    // 4. Display the newly fetched high-res image
                    imgEl.src = URL.createObjectURL(newBlob);
                    imgEl.setAttribute('data-loaded-zoom', 'true');
                })
                .catch(err => {
                    // 5. If network fails, show missing image placeholder
                    console.error("Network fetch failed for design image, no fallback available.", err);
                    imgEl.src = missingDesignSvg;
                });
        }
    }).catch(err => {
        console.error("Cache read failed for zoom image", err);
        imgEl.src = missingDesignSvg;
    });
}

function openDetail(productId, skipShow, keepSearchShown) {
    if (!skipShow) {
        cameFromDetail = false;
        if (!keepSearchShown) {
            var container = document.getElementById('searchContainerMain');
            if (container) {
                container.style.display = 'none';
                var input = container.querySelector('input');
                if (input) {
                    input.value = '';
                }
            }
            var srch = document.getElementById('srch');
            if (srch) {
                srch.value = '';
            }
            applyFilter();
        }
    }
    var p = allProducts.find(x => x.id === productId);
    if (!p) return;
    curProduct = p;

    document.getElementById('dtNameTop').innerText = p.name;
    document.getElementById('dtPriceBot').innerText = p.price || '0';
    document.getElementById('dtPackBot').innerText = (p.packing && p.packing !== "") ? p.packing : "-";

    var deck = document.getElementById('dtDesigns');
    if (deck) deck.innerHTML = '';

    if (!skipShow) {
        document.getElementById('detailPanel').classList.add('open');
        pushHistoryState('detail');
    }

    var gridPath = p.gridUrl;
    var zoomPath = (p.zoomUrl && p.zoomUrl !== "None") ? p.zoomUrl : p.gridUrl;

    if (!gridPath || gridPath === "" || gridPath === "None") {
        deck.innerHTML = '<div class="swipe-card" data-design="DIRECT"><img src="https://placehold.co/600x800/f0f0f0/a0a0a0?text=No+Image"></div>';
        return;
    }

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    var prefix = encodeURIComponent(zoomPath + "/");
    var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + prefix;

    var renderedFilesJson = "";

    useFallbackDesignList();

    var hasReadyList = p.ready && String(p.ready).trim() !== "";
    if (!hasReadyList) {
        fetch(listUrl)
            .then(res => res.json())
            .then(data => {
                var items = data.items || [];
                var validFiles = [];

                items.forEach(item => {
                    var fullPath = item.name;
                    var filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
                    var lowerName = filename.toLowerCase();

                    if (lowerName === "01.webp" || lowerName === "1.webp" || lowerName === "cover.webp") return;

                    var ext = lowerName.substring(lowerName.lastIndexOf('.'));
                    var isVideo = [".mp4", ".mov", ".webm"].includes(ext);
                    var isImage = [".webp", ".jpg", ".jpeg", ".png", ".gif"].includes(ext);

                    if (isVideo || isImage) {
                        var gridEncName = fullPath.replace(zoomPath, gridPath).split('/').map(encodeURIComponent).join('%2F');
                        var zoomEncName = fullPath.replace(gridPath, zoomPath).split('/').map(encodeURIComponent).join('%2F');
                        var designName = filename.substring(0, filename.lastIndexOf('.'));

                        validFiles.push({
                            name: designName,
                            gridUrl: fbBase + gridEncName + "?alt=media",
                            url: fbBase + zoomEncName + "?alt=media",
                            isVideo: isVideo,
                            isImage: isImage
                        });
                    }
                });

                if (validFiles.length > 0) {
                    var newJson = JSON.stringify(validFiles);
                    if (renderedFilesJson !== newJson) {
                        Promise.all(validFiles.map(file => {
                            if (file.isVideo) return Promise.resolve();
                            return getCachedDesignUrl(file.url, file.gridUrl).then(res => {
                                file.cachedUrl = res.src;
                                file.isZoom = res.isZoom;
                            }).catch(() => { });
                        })).then(() => {
                            if (renderedFilesJson !== newJson) {
                                renderSwipeDeck(validFiles);
                            }
                        });
                    }
                } else {
                    renderSwipeDeck([]); // Render empty to show cover only
                }
            })
            .catch(err => {
                console.warn("Background folder list load failed", err);
            });
    }

    function renderSwipeDeck(files) {
        renderedFilesJson = JSON.stringify(files);

        var coverSrc = getFirebaseImageUrl(p.gridUrl, "01.webp");
        var coverKey = p.id + '_DIRECT';
        var coverQty = cart[coverKey] ? cart[coverKey].qty : 0;

        var html = `
        <div class="swipe-card" data-design="DIRECT">
            <img src="${coverSrc}" style="width: 100%; object-fit: cover;" onerror="handleImgError(this, '${p.gridUrl}')">
            <div class="swipe-card-bot" onclick="event.stopPropagation()">
                <div style="font-weight:bold; font-size:12px; color:var(--text-main);">Cover</div>
                <div class="qty-clean">
                    <button onclick="changeQty('${p.id}', 'DIRECT', -1)">−</button>
                    <input type="number" id="qty_${p.id}_DIRECT" value="${coverQty}" readonly>
                    <button onclick="changeQty('${p.id}', 'DIRECT', 1)">+</button>
                </div>
            </div>
        </div>`;

        files.forEach((file, idx) => {
            var dKey = p.id + '_' + file.name;
            if (file.isVideo) {
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx + 1}, '${file.name}')">
                    <video src="${file.url}" controls playsinline style="width: 100%; object-fit: cover;" onclick="event.stopPropagation()"></video>
                    <div class="swipe-card-bot" onclick="event.stopPropagation()">
                        <div style="font-weight:bold; font-size:12px; color:var(--text-main);">${file.name}</div>
                        <div class="qty-clean">
                            <button onclick="changeQty('${p.id}', '${file.name}', -1)">−</button>
                            <input type="number" id="qty_${p.id}_${file.name}" value="${cart[dKey] ? cart[dKey].qty : 0}" readonly>
                            <button onclick="changeQty('${p.id}', '${file.name}', 1)">+</button>
                        </div>
                    </div>
                </div>`;
            } else {
                var imgId = `design_img_${p.id}_${idx}`;
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx + 1}, '${file.name}')">
                    <img id="${imgId}" src="${file.cachedUrl || file.gridUrl}" data-loaded-zoom="${file.isZoom ? 'true' : 'false'}" onerror="this.onerror=null; this.src=missingDesignSvg;">
                    <div class="swipe-card-bot" onclick="event.stopPropagation()">
                        <div style="font-weight:bold; font-size:12px; color:var(--text-main);">${file.name}</div>
                        <div class="qty-clean">
                            <button onclick="changeQty('${p.id}', '${file.name}', -1)">−</button>
                            <input type="number" id="qty_${p.id}_${file.name}" value="${cart[dKey] ? cart[dKey].qty : 0}" readonly>
                            <button onclick="changeQty('${p.id}', '${file.name}', 1)">+</button>
                        </div>
                    </div>
                </div>`;
            }
        });
        deck.innerHTML = html;

        files.forEach((file, idx) => {
            if (file.isImage) {
                var imgEl = document.getElementById(`design_img_${p.id}_${idx}`);
                if (imgEl && !file.isZoom) { // Only load zoom if we are not already showing it from cache
                    loadAndCacheDesignImage(imgEl, file.url, file.gridUrl, p.id, file.name);
                }
            }
        });

        setTimeout(updateBottomQtyFromActiveDesign, 50);
        updateLiveDetailHeader();
    }

    function useFallbackDesignList() {
        var rawDesigns = String(p.ready || "").split(',').map(d => d.trim()).filter(Boolean);
        var validDesigns = [];
        rawDesigns.forEach(d => {
            var cleanNum = d.replace(/\D/g, '');
            if (d.length <= 10 && cleanNum !== "") {
                var numVal = parseInt(cleanNum);
                if (numVal >= 2 && numVal <= 99) {
                    validDesigns.push({ name: d, numStr: cleanNum.length === 1 ? "0" + cleanNum : cleanNum });
                }
            }
        });

        var fallbackFiles = [];
        if (validDesigns.length > 0) {
            validDesigns.forEach(dObj => {
                var gridImgUrl = getFirebaseImageUrl(gridPath, dObj.numStr + ".webp");
                var zoomImgUrl = getFirebaseImageUrl(zoomPath, dObj.numStr + ".webp");
                fallbackFiles.push({ name: dObj.name, gridUrl: gridImgUrl, url: zoomImgUrl, isVideo: false, isImage: true });
            });
            Promise.all(fallbackFiles.map(file => {
                return getCachedDesignUrl(file.url, file.gridUrl).then(res => {
                    file.cachedUrl = res.src;
                    file.isZoom = res.isZoom;
                });
            })).then(() => renderSwipeDeck(fallbackFiles));
        } else {
            renderSwipeDeck([]);
        }
    }
}

window.changeQty = function (pid, designId, amount) {
    var p = allProducts.find(x => x.id === pid); if (!p) return;
    var key = pid + '_' + designId;
    var curQ = cart[key] ? cart[key].qty : 0;
    var newQ = Math.max(0, curQ + (amount * (p.mult || 1)));

    if (newQ === 0 || isNaN(newQ)) delete cart[key];
    else cart[key] = { p: p, design: designId, qty: newQ };

    var input = document.getElementById('qty_' + pid + '_' + designId);
    if (input) input.value = newQ;

    if (typeof fsDesignId !== 'undefined' && fsDesignId === designId) {
        var fsInp = document.getElementById('fsQty');
        if (fsInp) fsInp.innerText = newQ;
    }

    try { localStorage.setItem("dsCart", JSON.stringify(cart)); } catch (e) { }
    refreshCardUI(pid);
    updateLiveDetailHeader();
    updateBottomQtyFromActiveDesign();
};

function updateLiveDetailHeader() {
    if (!curProduct) return;
    var totalQty = 0;
    for (var k in cart) { if (cart[k].p.id === curProduct.id) totalQty += cart[k].qty; }

    var dtTotTop = document.getElementById('dtTotalQtyTop');
    if (dtTotTop) dtTotTop.innerText = totalQty > 0 ? totalQty : "0";

    var dtNameTop = document.getElementById('dtNameTop');
    if (dtNameTop) {
        dtNameTop.innerHTML = esc(curProduct.name) + ' <span style="color: var(--myntra-pink); font-weight: bold; font-size: 14px;">(' + totalQty + ' pcs)</span>';
    }

    var summaryEl = document.getElementById('dtDesignsSummary');
    if (summaryEl) {
        var parts = [];
        for (var k in cart) {
            var c = cart[k];
            if (c && c.p && c.p.id === curProduct.id && c.qty > 0) {
                var dName = c.design || 'DIRECT';
                if (dName !== 'DIRECT') {
                    parts.push({ name: dName, qty: c.qty });
                }
            }
        }
        parts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        var displayParts = parts.map(p => p.name + '*' + p.qty);
        summaryEl.innerText = displayParts.length > 0 ? displayParts.join(' + ') : '';
    }
}

function closeDetail() {
    var panel = document.getElementById('detailPanel');
    if (panel) panel.classList.remove('open');
    history.back();
}

// ====================================
// 🔍 5. FULL SCREEN MODAL & LIVE BOTTOM ROW
// ====================================
var fsIndex = 0;
var fsDesignId = '';
var fsScale = 1;
var fsTranslateX = 0;
var fsTranslateY = 0;

function setupFsGestures() {
    var fsModal = document.getElementById('fsModal');
    var fsImg = document.getElementById('fsImg');
    if (!fsModal || !fsImg) return;

    var startTouchX = 0;
    var startTouchY = 0;
    var initialPinchDistance = 0;
    var initialScale = 1;
    var isPinching = false;
    var startPanX = 0;
    var startPanY = 0;
    var isPanning = false;
    var lastTapTime = 0;

    function getDistance(t1, t2) {
        var dx = t1.clientX - t2.clientX;
        var dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function handleSwipe(diffX) {
        if (Math.abs(diffX) > 50) {
            openFs(diffX > 0 ? fsIndex - 1 : fsIndex + 1);
        }
    }

    fsImg.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            isPanning = false;
            isPinching = false;
            startTouchX = e.touches[0].clientX;
            startTouchY = e.touches[0].clientY;
            if (fsScale > 1) {
                isPanning = true;
                startPanX = e.touches[0].clientX - fsTranslateX;
                startPanY = e.touches[0].clientY - fsTranslateY;
            }
        } else if (e.touches.length === 2) {
            isPinching = true;
            isPanning = false;
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
            initialScale = fsScale;
        }
    }, { passive: true });

    fsImg.addEventListener('touchmove', function (e) {
        if (isPinching && e.touches.length === 2) {
            var newDistance = getDistance(e.touches[0], e.touches[1]);
            if (initialPinchDistance > 0) {
                var factor = newDistance / initialPinchDistance;
                fsScale = Math.max(1, Math.min(4, initialScale * factor));
                if (fsScale === 1) {
                    fsTranslateX = 0;
                    fsTranslateY = 0;
                }
                fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
            }
        } else if (isPanning && e.touches.length === 1 && fsScale > 1) {
            fsTranslateX = e.touches[0].clientX - startPanX;
            fsTranslateY = e.touches[0].clientY - startPanY;
            var maxTranslateX = (fsScale - 1) * (fsImg.clientWidth / 2);
            var maxTranslateY = (fsScale - 1) * (fsImg.clientHeight / 2);
            fsTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, fsTranslateX));
            fsTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, fsTranslateY));
            fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
        }
    }, { passive: true });

    fsImg.addEventListener('touchend', function (e) {
        isPinching = false;
        isPanning = false;
        if (e.touches.length === 0 && fsScale === 1) {
            var diffX = e.changedTouches[0].clientX - startTouchX;
            var diffY = e.changedTouches[0].clientY - startTouchY;
            if (Math.abs(diffX) > Math.abs(diffY)) {
                handleSwipe(diffX);
            }
        }
    }, { passive: true });

    fsImg.addEventListener('click', function (e) {
        var now = new Date().getTime();
        if (now - lastTapTime < 300) {
            fsScale = (fsScale > 1) ? 1 : 2.5;
            fsTranslateX = 0;
            fsTranslateY = 0;
            fsImg.style.transition = 'transform 0.2s ease-out';
            fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
            setTimeout(() => { fsImg.style.transition = ''; }, 200);
            e.preventDefault();
        }
        lastTapTime = now;
    });
}

function openFs(arg1, arg2, arg3) {
    var pId, index, dId;
    if (arguments.length === 1 && typeof arg1 === 'number') {
        if (!curProduct) return;
        pId = curProduct.id; index = arg1;
    } else {
        pId = arg1; index = arg2; dId = arg3;
    }

    var deck = document.getElementById('dtDesigns');
    if (!deck) return;

    var cards = Array.from(deck.querySelectorAll('.swipe-card')).filter(card => card.style.display !== 'none');

    if (dId) {
        var foundIdx = cards.findIndex(card => (card.dataset.design || '') === dId);
        if (foundIdx !== -1) index = foundIdx;
    }

    if (cards.length === 0) return;
    if (index < 0) index = cards.length - 1;
    if (index >= cards.length) index = 0;

    var targetCard = cards[index];
    if (!targetCard) return;

    targetCard.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });

    dId = targetCard.dataset.design || 'DIRECT';
    fsIndex = index;
    fsDesignId = dId;

    var dName = dId === 'DIRECT' ? "Cover" : dId;
    document.getElementById('fsTitle').innerText = curProduct.name + " - " + dName + " (" + (fsIndex + 1) + "/" + cards.length + ")";

    var videoEl = targetCard.querySelector('video');
    var imgEl = targetCard.querySelector('img');
    var fsImg = document.getElementById('fsImg');
    var fsVideo = document.getElementById('fsVideo');

    if (!fsVideo) {
        fsVideo = document.createElement('video');
        fsVideo.id = 'fsVideo';
        fsVideo.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
        fsVideo.controls = true;
        fsVideo.playsInline = true;
        fsImg.parentNode.appendChild(fsVideo);
    }

    if (videoEl) {
        fsImg.style.display = 'none';
        fsVideo.style.display = 'block';
        fsVideo.src = videoEl.src;
    } else {
        fsVideo.style.display = 'none';
        fsVideo.src = '';
        fsImg.style.display = 'block';
        fsImg.style.transition = '';
        fsImg.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        fsScale = 1;
        fsTranslateX = 0;
        fsTranslateY = 0;
        fsImg.src = imgEl ? imgEl.src : '';
    }

    var key = pId + '_' + fsDesignId;
    document.getElementById('fsQty').innerText = cart[key] ? cart[key].qty : 0;

    var fsModal = document.getElementById('fsModal');
    if (fsModal.style.display !== 'flex') {
        fsModal.style.display = 'flex';
        pushHistoryState('fs');
    }
}

function closeFs() {
    document.getElementById('fsModal').style.display = 'none';
    var fsVideo = document.getElementById('fsVideo');
    if (fsVideo) {
        fsVideo.pause();
        fsVideo.src = '';
    }
    history.back();
}

function fsChg(amt) {
    if (!curProduct) return;
    changeQty(curProduct.id, fsDesignId, amt);
}

// ====================================
// 🛒 CART MODAL
// ====================================
function openCart() {
    cameFromDetail = false;
    try {
        var cb = document.getElementById('cartBody');
        if (!cb) return;
        var count = 0, grouped = {};

        for (var k in cart) {
            var c = cart[k];
            if (!c || !c.p || !c.p.id) { delete cart[k]; continue; }
            count += (parseInt(c.qty) || 0);
            if (!grouped[c.p.id]) grouped[c.p.id] = { p: c.p, items: [] };
            grouped[c.p.id].items.push(c);
        }

        var cHtml = [];
        for (var r in grouped) {
            var g = grouped[r];
            var pTot = g.items.reduce((sum, i) => sum + (parseInt(i.qty) || 0), 0);

            cHtml.push('<div style="margin-bottom: 20px; border: 1px solid var(--border); border-radius: 8px; overflow:hidden;">');
            cHtml.push('<div style="background:#f5f5f6; padding:10px; border-bottom:1px solid var(--border); cursor:pointer;" onclick="closeCart(true); setTimeout(() => openDetail(\'' + g.p.id + '\'), 100);">');
            cHtml.push('<div style="font-weight:bold; font-size:15px; color:var(--myntra-pink); text-decoration:underline;">' + esc(g.p.name) + ' <i class="fas fa-external-link-alt" style="font-size:12px;"></i></div>');
            cHtml.push('<div style="font-size:12px; color:var(--text-light); margin-top:4px;">SKU: ' + esc(g.p.sku) + ' | Rate: ₹' + g.p.price + ' | Packing: ' + esc(g.p.packing) + ' | Total: ' + pTot + ' pcs</div>');
            cHtml.push('</div><div style="display:flex; flex-wrap:wrap; gap:10px; padding:10px;">');

            g.items.forEach(item => {
                var safeDesignLabel = item.design || 'DIRECT';
                var dLabel = safeDesignLabel === 'DIRECT' ? 'Cover' : safeDesignLabel;
                var targetFile = (safeDesignLabel === 'DIRECT') ? "01.webp" : (safeDesignLabel.replace(/\D/g, '').padStart(2, '0') + ".webp");
                const cartImgUrl = getFirebaseImageUrl(g.p.gridUrl, targetFile);

                cHtml.push('<div style="width: 80px; text-align: center;">');
                cHtml.push(`<img src="${cartImgUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);" onerror="this.onerror=null; this.src='https://placehold.co/80x80/f0f0f0/a0a0a0?text=...';">`);
                cHtml.push('<div style="font-size: 11px; margin-top: 4px; color:var(--text-light);">' + esc(dLabel) + '</div>');
                cHtml.push('<div style="font-size: 12px; font-weight: bold; color: var(--myntra-pink);">' + (item.qty || 0) + ' pcs</div>');
                cHtml.push('</div>');
            });
            cHtml.push('</div></div>');
        }

        cb.innerHTML = (count === 0) ? '<div style="text-align:center; padding:40px 20px; color:var(--text-light); font-weight:bold;">Your Cart is empty.</div>' : cHtml.join('');

        document.getElementById('cartCountHeader').innerText = count;
        document.getElementById('cartTotalQty').innerText = count + " pcs";

        localStorage.setItem("dsCart", JSON.stringify(cart));

        var panel = document.getElementById('cartPanel');
        if (panel && !panel.classList.contains('open')) {
            panel.classList.add('open');
            pushHistoryState('cart');
        }

    } catch (err) {
        console.error("Cart Error: ", err);
        alert("Cart encountered an error and was reset.");
        cart = {};
        localStorage.removeItem("dsCart");
    }
}

function closeCart(skipHistory) {
    var panel = document.getElementById('cartPanel');
    if (panel) panel.classList.remove('open');
    if (!skipHistory) history.back();
}

function clearCart() {
    if (confirm("Are you sure you want to empty your cart?")) {
        cart = {};
        try { localStorage.removeItem("dsCart"); } catch (e) { }
        closeCart();
        updateCartHeader();
        renderProductGrid(displayList);
    }
}

function sendWhatsapp() {
    if (Object.keys(cart).length === 0) return alert("Your cart is empty!");

    var msg = "🛍️ *New Order from Web App*\n\n";
    var totalQty = 0, groups = {};

    for (var k in cart) {
        var item = cart[k];
        if (!groups[item.p.id]) groups[item.p.id] = { p: item.p, items: [] };
        groups[item.p.id].items.push(item);
    }

    for (var r in groups) {
        var g = groups[r];
        msg += "🏷️ *" + g.p.name + "* (SKU: " + g.p.sku + ")\n";
        g.items.forEach(item => {
            var dName = item.design === 'DIRECT' ? 'Cover' : item.design;
            msg += "  - " + dName + ": " + item.qty + " pcs\n";
            totalQty += item.qty;
        });
        msg += "\n";
    }
    msg += "📦 *Total Quantity:* " + totalQty + " pcs\n";

    var number = "919099887766";
    var encodedMsg = encodeURIComponent(msg);
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    window.open((isMobile ? "whatsapp://send?phone=" : "https://web.whatsapp.com/send?phone=") + number + "&text=" + encodedMsg, '_blank');
}

// ====================================
// UTILS & HELPERS
// ====================================

async function triggerShare(action) {
    closeModals();

    if (action === 'copy' || action === 'link') {
        alert("Web links are coming in the next update!");
        return;
    }

    if (!curProduct && action !== 'cart') {
        alert("Please open a product first to share its catalog.");
        return;
    }

    var deck = document.getElementById('dtDesigns');
    var imgArray = [];
    if (deck) {
        var imgs = deck.querySelectorAll('img');
        imgs.forEach(img => {
            if (img.src && !img.src.includes('placehold.co') && !img.src.includes('data:image')) {
                imgArray.push(img.src);
            }
        });
    }

    imgArray = [...new Set(imgArray)];

    if (imgArray.length === 0) {
        alert("Images are still loading, please wait a second.");
        return;
    }

    if (typeof generateNativePDF === 'function') {
        await generateNativePDF(curProduct.name, curProduct.price, imgArray, action);
    } else {
        alert("PDF Engine is not loaded!");
    }
}

window.goToHome = function () {
    cameFromDetail = false;
    closeDetail();
    closeCart();
    document.querySelectorAll('.action-modal').forEach(m => m.style.display = 'none');
};

async function startImagePrefetch() {
    console.log("Starting background image pre-fetch...");
    if (!allProducts || allProducts.length === 0) return;

    const productsToDownload = allProducts.filter(p => p.gridUrl && p.gridUrl.trim() !== "" && p.gridUrl.toLowerCase() !== "none");
    if (productsToDownload.length === 0) return;

    const urlsToFetch = new Map();

    productsToDownload.forEach(p => {
        // Key for main grid image is the gridUrl folder path
        urlsToFetch.set(p.gridUrl, getFirebaseImageUrl(p.gridUrl, "01.webp"));

        if (p.ready && p.ready.trim() !== "") {
            const rawDesigns = String(p.ready).split(',').map(d => d.trim()).filter(Boolean);
            rawDesigns.forEach(d => {
                const cleanNum = d.replace(/\D/g, '');
                if (d.length <= 10 && cleanNum !== "" && parseInt(cleanNum) >= 2 && parseInt(cleanNum) <= 99) {
                    const numStr = cleanNum.length === 1 ? "0" + cleanNum : cleanNum;
                    const designUrl = getFirebaseImageUrl(p.gridUrl, numStr + ".webp");
                    urlsToFetch.set(designUrl, designUrl); // Key is the full URL itself
                }
            });
        }
    });

    const urlArray = Array.from(urlsToFetch.entries());
    const batchSize = 5;
    for (let i = 0; i < urlArray.length; i += batchSize) {
        const batch = urlArray.slice(i, i + batchSize);
        await Promise.all(batch.map(async ([key, url]) => {
            try {
                const isCached = await getImageFromDB(key).then(blob => !!blob);
                if (!isCached) {
                    const response = await fetch(url);
                    if (response.ok) {
                        const blob = await response.blob();
                        await saveImageToDB(key, blob);
                    }
                }
            } catch (err) {
                // Silently fail and continue
            }
        }));
    }
    console.log("Background image pre-fetch finished.");
}

async function syncImages() {
    var bootScreen = document.getElementById('boot');
    var bootMsg = document.getElementById('bootMsg');

    if (bootScreen) bootScreen.style.display = 'flex';
    if (bootMsg) bootMsg.innerText = "Fetching latest product list...";

    try {
        const res = await fetch(FIRESTORE_PRODUCTS_URL);
        const data = await res.json();
        var docs = data.documents || [];

        var productsToDownload = docs.map(d => d.fields).filter(f => f.name && f.name.stringValue && f.gridUrl && f.gridUrl.stringValue);

        if (productsToDownload.length === 0) {
            if (bootScreen) bootScreen.style.display = 'none';
            alert("No images found to sync.");
            return initApp();
        }

        let total = 0, count = 0, failed = 0;
        const urlsToSync = new Map();
        productsToDownload.forEach(f => {
            const gridUrl = f.gridUrl.stringValue;
            urlsToSync.set(gridUrl, getFirebaseImageUrl(gridUrl, "01.webp"));
            if (f.ready && f.ready.stringValue) {
                 String(f.ready.stringValue).split(',').map(d => d.trim()).filter(Boolean).forEach(d => {
                    const cleanNum = d.replace(/\D/g, '');
                    if (cleanNum !== "" && parseInt(cleanNum) >= 2 && parseInt(cleanNum) <= 99) {
                        const numStr = cleanNum.length === 1 ? "0" + cleanNum : cleanNum;
                        const designUrl = getFirebaseImageUrl(gridUrl, numStr + ".webp");
                        urlsToSync.set(designUrl, designUrl);
                    }
                });
            }
        });
        
        total = urlsToSync.size;
        if (bootMsg) bootMsg.innerText = `Syncing 0 / ${total} images...`;

        const urlArray = Array.from(urlsToSync.entries());
        const batchSize = 5;
        for (let i = 0; i < urlArray.length; i += batchSize) {
            const batch = urlArray.slice(i, i + batchSize);
            await Promise.all(batch.map(async ([key, url]) => {
                let downloaded = false;
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const blob = await response.blob();
                        if (await saveImageToDB(key, blob)) {
                            downloaded = true;
                        }
                    }
                } catch (err) { /* fail */ }
                if(!downloaded) failed++;
            }));
            count += batch.length;
            if (bootMsg) bootMsg.innerText = `Syncing ${Math.min(count, total)} / ${total} images...`;
        }

        if (bootScreen) bootScreen.style.display = 'none';
        alert(failed > 0 ? `Sync completed. Saved ${total - failed} images. (${failed} failed)` : `Success! All ${total} catalog images saved.`);
        initApp();

    } catch (err) {
        if (bootScreen) bootScreen.style.display = 'none';
        alert("Sync failed: " + err.message);
        initApp();
    }
}
function openModal(id) {
    cameFromDetail = false;
    var m = document.getElementById(id);
    if (m) { m.style.display = 'flex'; pushHistoryState(id); }
}
function closeModals(fromHistory) {
    document.querySelectorAll('.action-modal').forEach(m => m.style.display = 'none');
    if (!fromHistory) history.back();
}

function pushHistoryState(modal) {
    history.pushState({ modal: modal }, '', '#' + modal);
}

function saveProductEdit(p) {
    try {
        var edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {};
        edited[p.name] = { price: p.price, packing: p.packing };
        localStorage.setItem("dsEditedProducts", JSON.stringify(edited));
    } catch (e) { console.error("Error saving product edit:", e); }
}

function setupEditableFields() {
    var priceBot = document.getElementById('dtPriceBot');
    var packBot = document.getElementById('dtPackBot');

    if (priceBot) {
        priceBot.addEventListener('blur', () => {
            if (!curProduct) return;
            var val = parseFloat(priceBot.innerText.replace(/[^0-9.]/g, '').trim());
            if (!isNaN(val) && val >= 0) {
                curProduct.price = val;
                priceBot.innerText = val;
                saveProductEdit(curProduct);
                refreshCardUI(curProduct.id);
            } else {
                priceBot.innerText = curProduct.price || 0;
            }
        });
    }

    if (packBot) {
        packBot.addEventListener('blur', () => {
            if (!curProduct) return;
            var val = packBot.innerText.trim();
            if (val !== "") {
                curProduct.packing = val;
                packBot.innerText = val;
                saveProductEdit(curProduct);
                refreshCardUI(curProduct.id);
            } else {
                packBot.innerText = curProduct.packing || "-";
            }
        });
    }
}

function updateBottomQtyFromActiveDesign() {
    if (!curProduct) return;
    var dKey = curProduct.id + '_DIRECT';
    var qty = cart[dKey] ? cart[dKey].qty : 0;
    var dtQtyInput = document.getElementById('dtQtyDirect');
    if (dtQtyInput) dtQtyInput.value = qty;
    var btnMinus = document.getElementById('dtQtyBotMinus');
    var btnPlus = document.getElementById('dtQtyBotPlus');
    if (btnMinus) btnMinus.onclick = () => changeQty(curProduct.id, 'DIRECT', -1);
    if (btnPlus) btnPlus.onclick = () => changeQty(curProduct.id, 'DIRECT', 1);
}

document.addEventListener("backbutton", function (e) {
    if (document.querySelector('#fsModal[style*="display: flex"], .panel.open, .action-modal[style*="display: flex"]')) {
        e.preventDefault();
        history.back();
    }
}, false);

// ====================================
// 🔍 SEARCH, SORT, FILTER & FAVORITES ENGINE
// ====================================
var showOnlyFavs = false;

window.doSearch = function (val) {
    var srch = document.getElementById('srch');
    if (srch) srch.value = val;
    applyFilter();

    if (val.trim() !== "" && document.getElementById('detailPanel')?.classList.contains('open')) {
        cameFromDetail = true;
        searchingTransition = true;
        closeDetail();
    } else if (cameFromDetail && curProduct) {
        openDetail(curProduct.id, false, true);
        cameFromDetail = false;
    }
};

window.populateCategories = function () {
    var catListEl = document.getElementById('categoryList');
    if (!catListEl) return;
    var cats = [...new Set(allProducts.map(p => p.cat || "Uncategorized"))].sort();
    catListEl.innerHTML = cats.map(cat => {
        var activeClass = activeCategories.includes(cat) ? 'active' : '';
        return `<div class="filter-row ${activeClass}" onclick="toggleCategoryFilter(this, '${esc(cat)}')">${esc(cat)}</div>`;
    }).join('');
};

window.toggleCategoryFilter = function (element, cat) {
    cameFromDetail = false;
    const idx = activeCategories.indexOf(cat);
    if (idx === -1) {
        activeCategories.push(cat);
        element?.classList.add('active');
    } else {
        activeCategories.splice(idx, 1);
        element?.classList.remove('active');
    }
    applyFilter();
};

window.togglePriceFilter = function (element, min, max) {
    cameFromDetail = false;
    var filterStr = `${min}-${max}`;
    const idx = activePriceFilters.indexOf(filterStr);
    if (idx === -1) {
        activePriceFilters.push(filterStr);
        element?.classList.add('active');
    } else {
        activePriceFilters.splice(idx, 1);
        element?.classList.remove('active');
    }
    applyFilter();
};

window.clearPriceFilters = function () {
    cameFromDetail = false;
    activePriceFilters = [];
    document.querySelectorAll('#filterModal .filter-row').forEach(r => r.classList.remove('active'));
    applyFilter();
};

window.toggleSearch = function () {
    var container = document.getElementById('searchContainerMain');
    if (container) {
        const isHidden = container.style.display === 'none' || container.style.display === '';
        container.style.display = isHidden ? 'block' : 'none';
        var input = container.querySelector('input');
        if (isHidden) input.focus();
        else if (input.value) { input.value = ''; doSearch(''); }
    }
};

window.toggleFavView = function () {
    cameFromDetail = false;
    showOnlyFavs = !showOnlyFavs;
    var favIcon = document.getElementById('favTopIcon');
    if (favIcon) {
        favIcon.classList.toggle('far', !showOnlyFavs);
        favIcon.classList.toggle('fas', showOnlyFavs);
        favIcon.style.color = showOnlyFavs ? 'var(--myntra-pink)' : '';
    }
    applyFilter();
};

window.setSort = function (type, element) {
    cameFromDetail = false;
    currentSort = type;
    document.querySelectorAll('#sortModal .filter-row').forEach(r => r.classList.remove('active'));
    element?.classList.add('active');
    applyFilter();
    closeModals();
};

window.applyFilter = function () {
    var query = document.getElementById('srch')?.value.trim().toLowerCase() || '';
    
    displayList = allProducts.filter(p => {
        if (query && !(p.name?.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query) || p.fabric?.toLowerCase().includes(query))) return false;
        if (activeCategories.length > 0 && !activeCategories.includes(p.cat)) return false;
        if (showOnlyFavs && !favorites[p.id]) return false;
        if (activePriceFilters.length > 0 && !activePriceFilters.some(f => {
            const [min, max] = f.split('-').map(parseFloat);
            return p.price >= min && p.price <= max;
        })) return false;
        return true;
    });

    renderProductGrid(displayList);
};

function applyModalState(modal) {
    document.getElementById('fsModal').style.display = (modal === 'fs') ? 'flex' : 'none';
    document.getElementById('detailPanel').classList.toggle('open', modal === 'detail' || modal === 'fs');
    document.getElementById('cartPanel').classList.toggle('open', modal === 'cart');
    document.querySelectorAll('.action-modal').forEach(m => m.style.display = (m.id === modal) ? 'flex' : 'none');
}

window.addEventListener('popstate', function (e) {
    applyModalState(e.state?.modal);
    if (!searchingTransition) cameFromDetail = false;
    searchingTransition = false;
});
