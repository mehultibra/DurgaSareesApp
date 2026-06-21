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

window.addEventListener('DOMContentLoaded', function () {
    try {
        try { activeUser = localStorage.getItem("dsUserToken"); } catch (e) { }
        try { cart = JSON.parse(localStorage.getItem("dsCart")) || {}; } catch (e) { }
        try { favorites = JSON.parse(localStorage.getItem("dsFavs")) || {}; } catch (e) { }

        var loginScreen = document.getElementById('loginScreen');
        var appBody = document.getElementById('appBody');

        // Bypass login for debugging
        if (loginScreen && appBody) {
            loginScreen.style.display = 'none';
            appBody.style.display = 'flex';
            activeUser = "debug_user";
            setTimeout(initApp, 100);
        }
        setupEditableFields();
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
        })
        .catch(err => alert("Firebase Load Error: " + err.message));
}

// ==========================================
// 🚀 FAST PROGRESSIVE IMAGE LOADER (GRID -> ZOOM)
// ==========================================
// 🛡️ THE FIX: Loads the low-res Grid image instantly, then quietly upgrades to Zoom!
// ==========================================
// 📦 INDEXEDDB CACHE DATABASE FOR IMAGES
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
            reject(e.target.error);
        };
    });
}

function saveImageToDB(key, blob) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            var tx = db.transaction(storeName, "readwrite");
            var store = tx.objectStore(storeName);
            var req = store.put(blob, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }).catch(e => {
        console.error("IndexedDB write failed", e);
        return false;
    });
}

function getImageFromDB(key) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            var tx = db.transaction(storeName, "readonly");
            var store = tx.objectStore(storeName);
            var req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }).catch(e => {
        console.error("IndexedDB read failed", e);
        return null;
    });
}

function getCachedImageBlob(url) {
    return getImageFromDB(url).then(blob => {
        if (blob) return blob;
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
            return { src: "", isZoom: false };
        });
    });
}

// 🚀 FAST PROGRESSIVE IMAGE LOADER (GRID -> ZOOM)
// ==========================================
// 🛡️ THE FIX: Loads the low-res Grid image instantly, then quietly upgrades to Zoom!
window.renderWebpFromFolder = function (imgElement, gridPath, zoomPath, targetFile) {
    if (!gridPath || gridPath.trim() === "" || gridPath.toLowerCase() === "none") {
        imgElement.src = "https://placehold.co/300x300/f0f0f0/a0a0a0?text=No+Image";
        return;
    }

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

    // File target (e.g., "01.webp", "cover.webp")
    var fileToFetch = targetFile ? targetFile : "01.webp";

    var encGridPath = gridPath.split('/').map(encodeURIComponent).join('%2F');
    var lowResUrl = fbBase + encGridPath + "%2F" + fileToFetch + "?alt=media";

    if (fileToFetch === "01.webp") {
        getImageFromDB(gridPath).then(function (blob) {
            if (blob) {
                var objectUrl = URL.createObjectURL(blob);
                imgElement.src = objectUrl;

                imgElement.onerror = function () {
                    loadFromNetwork();
                };
            } else {
                loadFromNetwork();
            }
        }).catch(function (err) {
            loadFromNetwork();
        });
    } else {
        loadFromNetwork();
    }

    function loadFromNetwork() {
        imgElement.src = lowResUrl;

        // Fallback if 01.webp fails on Grid
        imgElement.onerror = function () {
            if (fileToFetch === "01.webp") {
                imgElement.src = fbBase + encGridPath + "%2Fcover.webp?alt=media";
                imgElement.onerror = function () {
                    imgElement.src = fbBase + encGridPath + "%2F1.webp?alt=media";
                    if (typeof updateBottomQtyFromActiveDesign === 'function') updateBottomQtyFromActiveDesign();
                }
            } else {
                if (typeof updateBottomQtyFromActiveDesign === 'function') updateBottomQtyFromActiveDesign();
            }
        };
    }

    // 2. Background Load High-Res Zoom Image (if applicable)
    if (zoomPath && zoomPath.trim() !== "" && zoomPath.toLowerCase() !== "none") {
        var encZoomPath = zoomPath.split('/').map(encodeURIComponent).join('%2F');
        var highResUrl = fbBase + encZoomPath + "%2F" + fileToFetch + "?alt=media";

        var hdImage = new Image();
        hdImage.onload = function () {
            // Swap to HD image silently once downloaded
            imgElement.src = highResUrl;
        };
        hdImage.src = highResUrl;
    }
};

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
    h.push('<div class="fav-btn-inline" style="flex-shrink:0; padding-left:0;" onclick="toggleFav(\'' + p.id + '\', event)"><i class="' + favClass + '"></i></div>');
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
        h.push('<div class="add-btn-clean" onclick="chgMainRow(\'' + p.id + '\', 1); event.stopPropagation();">ADD</div>');
    } else {
        h.push('<div class="qty-clean" onclick="event.stopPropagation()">');
        h.push('<button onclick="chgMainRow(\'' + p.id + '\', -1)">−</button>');
        h.push('<input type="number" id="mqty-' + p.id + '" value="' + coverQty + '" readonly>');
        h.push('<button onclick="chgMainRow(\'' + p.id + '\', 1)">+</button>');
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

    // Sort products primarily by category (alphabetically), and secondarily by the active sort rule
    var sorted = [...products].sort((a, b) => {
        var catA = (a.cat || "Uncategorized").toLowerCase();
        var catB = (b.cat || "Uncategorized").toLowerCase();

        // Primary sort: Category name alphabetically
        if (catA < catB) return -1;
        if (catA > catB) return 1;

        // Secondary sort: Selected sorting rule
        if (currentSort === 'priceAsc') {
            return a.price - b.price;
        } else if (currentSort === 'priceDesc') {
            return b.price - a.price;
        } else {
            return 0;
        }
    });

    let htmlBuffer = [];
    sorted.forEach((p) => {
        let imgElementId = "img_" + p.id;
        var totalQty = 0;
        for (var k in cart) { if (cart[k].p.id === p.id) totalQty += parseInt(cart[k].qty) || 0; }
        var bHtml = totalQty > 0 ? `<div class="item-qty-badge" id="badge-${p.id}">${totalQty} in cart</div>` : `<div class="item-qty-badge" id="badge-${p.id}" style="display:none;"></div>`;

        htmlBuffer.push(`
        <div class="card" id="card-${p.id}">
            <div class="thumb" onclick="openDetail('${p.id}')">
                ${bHtml}
                <img id="${imgElementId}" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="${esc(p.name)}">
            </div>
            <div class="ci" id="detail-wrap-${p.id}" style="padding: 8px 0 0 0;">
                ${buildCardDetails(p)}
            </div>
        </div>
        `);

        setTimeout(() => {
            let imgEl = document.getElementById(imgElementId);
            if (imgEl) window.renderWebpFromFolder(imgEl, p.gridUrl, null, "01.webp"); // Only needs Grid for main page
        }, 0);
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
    var cacheKey = url;

    // Check if we are already in the process of retrying
    var isRetry = imgEl.dataset.retrying === "true";

    getImageFromDB(cacheKey).then(blob => {
        if (blob) {
            // Found in cache!
            imgEl.src = URL.createObjectURL(blob);
            imgEl.dataset.loadedZoom = "true";
            imgEl.dataset.retrying = "";
            
            // Live update FS modal if open on this design
            if (typeof fsDesignId !== 'undefined' && fsDesignId === fileName && curProduct && curProduct.id === productId) {
                var fsImg = document.getElementById('fsImg');
                if (fsImg && fsImg.style.display !== 'none') {
                    fsImg.src = imgEl.src;
                }
            }
        } else {
            // If it's not a retry, let's load grid image from IndexedDB cache if our src is empty or uses constructed firebase URL
            if (!isRetry) {
                if (designGridUrl) {
                    getCachedImageBlob(designGridUrl).then(gridBlob => {
                        if (gridBlob && imgEl && !imgEl.dataset.loadedZoom) {
                            imgEl.src = URL.createObjectURL(gridBlob);
                        }
                    }).catch(e => {
                        console.warn("Error getting design grid image blob from cache", e);
                    });
                }
            }

            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.blob();
                })
                .then(newBlob => {
                    saveImageToDB(cacheKey, newBlob);
                    var zoomObjectUrl = URL.createObjectURL(newBlob);
                    imgEl.src = zoomObjectUrl;
                    imgEl.dataset.loadedZoom = "true";
                    imgEl.dataset.retrying = "";

                    // Live update FS modal if open on this design
                    if (typeof fsDesignId !== 'undefined' && fsDesignId === fileName && curProduct && curProduct.id === productId) {
                        var fsImg = document.getElementById('fsImg');
                        if (fsImg && fsImg.style.display !== 'none') {
                            fsImg.src = zoomObjectUrl;
                        }
                    }
                })
                .catch(err => {
                    console.error("Network fetch failed for design image, trying fallback", err);
                    if (url.includes('%2F0')) {
                        var fallbackUrl = url.replace('%2F0', '%2F');
                        imgEl.dataset.retrying = "true";
                        loadAndCacheDesignImage(imgEl, fallbackUrl, designGridUrl, productId, fileName);
                    } else {
                        imgEl.dataset.retrying = "";
                        imgEl.onerror = null;
                        imgEl.src = missingDesignSvg;
                    }
                });
        }
    }).catch(err => {
        console.error("Cache read failed, loading directly", err);
        // Fallback: load directly from url
        imgEl.onerror = function() {
            if (url.includes('%2F0')) {
                var fallbackUrl = url.replace('%2F0', '%2F');
                loadAndCacheDesignImage(imgEl, fallbackUrl, designGridUrl, productId, fileName);
            } else {
                imgEl.onerror = null;
                imgEl.src = missingDesignSvg;
            }
        };
        imgEl.src = url;
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

    // 1. Render fallback list instantly so the UI loads immediately
    useFallbackDesignList();

    // 2. Fetch actual folder files in background to update/upgrade the swipe deck only if p.ready is empty
    var hasReadyList = p.ready && String(p.ready).trim() !== "";
    if (!hasReadyList) {
        fetch(listUrl)
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                var items = data.items || [];
                var validFiles = [];

                items.forEach(item => {
                    var fullPath = item.name;
                    var filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
                    var lowerName = filename.toLowerCase();

                    // Filter out cover images
                    if (lowerName === "01.webp" || lowerName === "1.webp" || lowerName === "cover.webp") {
                        return;
                    }

                    var ext = lowerName.substring(lowerName.lastIndexOf('.'));
                    var isVideo = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".3gp", ".ogg"].includes(ext);
                    var isImage = [".webp", ".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);

                    if (isVideo || isImage) {
                        var gridEncName = fullPath.replace(zoomPath, gridPath).split('/').map(encodeURIComponent).join('%2F');
                        var zoomEncName = fullPath.replace(gridPath, zoomPath).split('/').map(encodeURIComponent).join('%2F');
                        
                        var gridUrl = fbBase + gridEncName + "?alt=media";
                        var zoomUrl = fbBase + zoomEncName + "?alt=media";
                        var designName = filename.substring(0, filename.lastIndexOf('.'));

                        validFiles.push({
                            name: designName,
                            gridUrl: gridUrl,
                            url: zoomUrl,
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
                                if (res.src) {
                                    file.cachedUrl = res.src;
                                    file.isZoom = res.isZoom;
                                }
                            }).catch(() => {});
                        })).then(() => {
                            if (renderedFilesJson !== newJson) {
                                renderSwipeDeck(validFiles);
                            }
                        });
                    }
                } else {
                    // Firebase Storage folder is empty: Clear fallback cards and show only the cover image
                    var gridImgEl = document.getElementById("img_" + p.id);
                    var coverSrc = (gridImgEl && gridImgEl.src && !gridImgEl.src.startsWith("data:")) ? gridImgEl.src : "";
                    if (!coverSrc && p.gridUrl && p.gridUrl !== "None") {
                        var encGridPath = p.gridUrl.split('/').map(encodeURIComponent).join('%2F');
                        coverSrc = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/" + encGridPath + "%2F01.webp?alt=media";
                    }
                    deck.innerHTML = `
                    <div class="swipe-card" data-design="DIRECT">
                        <img src="${coverSrc || ''}" style="width: 100%; height: calc(100% - 40px); object-fit: cover;">
                        <div class="swipe-card-bot" onclick="event.stopPropagation()">
                            <div style="font-weight:bold; font-size:12px; color:var(--text-main);">Cover</div>
                            <div class="qty-clean">
                                <button onclick="changeQty('${p.id}', 'DIRECT', -1)">−</button>
                                <input type="number" id="qty_${p.id}_DIRECT" value="${cart[p.id + '_DIRECT'] ? cart[p.id + '_DIRECT'].qty : 0}" readonly>
                                <button onclick="changeQty('${p.id}', 'DIRECT', 1)">+</button>
                            </div>
                        </div>
                    </div>`;
                    setTimeout(updateBottomQtyFromActiveDesign, 50);
                    updateLiveDetailHeader();
                }
            })
            .catch(err => {
                console.warn("Background folder list load failed", err);
            });
    }

    function renderSwipeDeck(files) {
        renderedFilesJson = JSON.stringify(files);

        // Get the grid/cover image source synchronously for instant placeholder rendering
        // Only use it if it's already a local Blob URL to avoid making duplicate network requests
        var gridImgEl = document.getElementById("img_" + p.id);
        var initialSrc = (gridImgEl && gridImgEl.src && gridImgEl.src.startsWith("blob:")) ? gridImgEl.src : "";

        var html = '';
        files.forEach((file, idx) => {
            var dKey = p.id + '_' + file.name;
            if (file.isVideo) {
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx}, '${file.name}')">
                    <video src="${file.url}" controls playsinline style="width: 100%; height: calc(100% - 40px); object-fit: cover;" onclick="event.stopPropagation()"></video>
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
                var imgId = "design_img_" + p.id + "_" + idx;
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx}, '${file.name}')">
                    <img id="${imgId}" src="${file.cachedUrl || file.gridUrl || ''}" data-loaded-zoom="${file.isZoom ? 'true' : 'false'}">
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

        // Trigger load and cache for all image files in parallel
        files.forEach((file, idx) => {
            if (!file.isVideo) {
                var imgId = "design_img_" + p.id + "_" + idx;
                var imgEl = document.getElementById(imgId);
                if (imgEl) {
                    loadAndCacheDesignImage(imgEl, file.url, file.gridUrl, p.id, file.name);
                }
            }
        });

        setTimeout(updateBottomQtyFromActiveDesign, 50);
        updateLiveDetailHeader();
    }

    function useFallbackDesignList() {
        var encGridPath = gridPath.split('/').map(encodeURIComponent).join('%2F');
        var encZoomPath = zoomPath.split('/').map(encodeURIComponent).join('%2F');
        var rawDesigns = String(p.ready || "").split(',').map(d => d.trim()).filter(Boolean);
        var validDesigns = [];
        rawDesigns.forEach(d => {
            var cleanNum = d.replace(/\D/g, '');
            if (d.length <= 10 && cleanNum !== "") {
                var numVal = parseInt(cleanNum);
                if (numVal >= 2 && numVal <= 99) {
                    validDesigns.push({
                        name: d,
                        numStr: cleanNum.length === 1 ? "0" + cleanNum : cleanNum
                    });
                }
            }
        });

        var fallbackFiles = [];
        if (validDesigns.length > 0) {
            validDesigns.forEach(dObj => {
                var gridUrl = fbBase + encGridPath + "%2F" + dObj.numStr + ".webp?alt=media";
                var zoomUrl = fbBase + encZoomPath + "%2F" + dObj.numStr + ".webp?alt=media";
                fallbackFiles.push({
                    name: dObj.name,
                    gridUrl: gridUrl,
                    url: zoomUrl,
                    isVideo: false,
                    isImage: true
                });
            });
            Promise.all(fallbackFiles.map(file => {
                return getCachedDesignUrl(file.url, file.gridUrl).then(res => {
                    if (res.src) {
                        file.cachedUrl = res.src;
                        file.isZoom = res.isZoom;
                    }
                }).catch(() => {});
            })).then(() => {
                renderSwipeDeck(fallbackFiles);
            });
        } else {
            // Render a single cover card initially
            var gridImgEl = document.getElementById("img_" + p.id);
            var coverSrc = (gridImgEl && gridImgEl.src && !gridImgEl.src.startsWith("data:")) ? gridImgEl.src : "";
            if (!coverSrc && p.gridUrl && p.gridUrl !== "None") {
                var encGridPath = p.gridUrl.split('/').map(encodeURIComponent).join('%2F');
                coverSrc = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/" + encGridPath + "%2F01.webp?alt=media";
            }
            deck.innerHTML = `
            <div class="swipe-card" data-design="DIRECT">
                <img src="${coverSrc || ''}" style="width: 100%; height: calc(100% - 40px); object-fit: cover;">
                <div class="swipe-card-bot" onclick="event.stopPropagation()">
                    <div style="font-weight:bold; font-size:12px; color:var(--text-main);">Cover</div>
                    <div class="qty-clean">
                        <button onclick="changeQty('${p.id}', 'DIRECT', -1)">−</button>
                        <input type="number" id="qty_${p.id}_DIRECT" value="${cart[p.id + '_DIRECT'] ? cart[p.id + '_DIRECT'].qty : 0}" readonly>
                        <button onclick="changeQty('${p.id}', 'DIRECT', 1)">+</button>
                    </div>
                </div>
            </div>`;
            setTimeout(updateBottomQtyFromActiveDesign, 50);
            updateLiveDetailHeader();
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

    // 1. Update Swipe Card Input
    var input = document.getElementById('qty_' + pid + '_' + designId);
    if (input) input.value = newQ;

    // 2. 🛡️ THE FIX: Update Full Screen Bottom Row instantly if it's open
    if (typeof fsDesignId !== 'undefined' && fsDesignId === designId) {
        var fsInp = document.getElementById('fsQty');
        if (fsInp) fsInp.innerText = newQ;
    }

    try { localStorage.setItem("dsCart", JSON.stringify(cart)); } catch (e) { }
    refreshCardUI(pid);
    updateLiveDetailHeader(); // Updates the total Master Qty at bottom!
    updateBottomQtyFromActiveDesign(); // 🛡️ Keep bottom row selection updated
};

function updateLiveDetailHeader() {
    if (!curProduct) return;
    var totalQty = 0;
    for (var k in cart) { if (cart[k].p.id === curProduct.id) totalQty += cart[k].qty; }

    // Top Header Badge
    var dtTotTop = document.getElementById('dtTotalQtyTop');
    if (dtTotTop) dtTotTop.innerText = totalQty > 0 ? totalQty : "0";

    // Display live total quantity next to product name
    var dtNameTop = document.getElementById('dtNameTop');
    if (dtNameTop) {
        dtNameTop.innerHTML = esc(curProduct.name) + ' <span style="color: var(--myntra-pink); font-weight: bold; font-size: 14px;">(' + totalQty + ' pcs)</span>';
    }
}

function closeDetail() {
    var panel = document.getElementById('detailPanel');
    if (panel) panel.classList.remove('open');
    history.back(); // Standard browser back to trigger popstate
}

// ====================================
// 🔍 5. FULL SCREEN MODAL & LIVE BOTTOM ROW
// ====================================
var fsIndex = 0;
var fsDesignId = '';

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

    // 📱 Filter to only visible cards (images/videos that successfully loaded and aren't hidden)
    var cards = Array.from(deck.querySelectorAll('.swipe-card')).filter(card => card.style.display !== 'none');

    if (dId) {
        var foundIdx = cards.findIndex(card => {
            var inputField = card.querySelector('input[type="number"]');
            var cardDId = inputField ? inputField.id.replace("qty_" + pId + "_", "") : 'DIRECT';
            return cardDId === dId;
        });
        if (foundIdx !== -1) {
            index = foundIdx;
        }
    }

    if (cards.length === 0) return;
    if (index < 0) index = cards.length - 1;
    if (index >= cards.length) index = 0;

    var targetCard = cards[index];
    if (!targetCard) return;

    // Keep detail panel swipe deck scrolled to align with full screen active card
    targetCard.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });

    var inputField = targetCard.querySelector('input[type="number"]');
    dId = inputField ? inputField.id.replace("qty_" + pId + "_", "") : 'DIRECT';

    fsIndex = index;
    fsDesignId = dId;

    var dName = dId === 'DIRECT' ? "Cover" : dId;
    document.getElementById('fsTitle').innerText = curProduct.name + " - " + dName;

    var videoEl = targetCard.querySelector('video');
    var imgEl = targetCard.querySelector('img');
    var fsImg = document.getElementById('fsImg');
    var fsVideo = document.getElementById('fsVideo');

    if (!fsVideo && fsImg) {
        fsVideo = document.createElement('video');
        fsVideo.id = 'fsVideo';
        fsVideo.style.maxWidth = '100%';
        fsVideo.style.maxHeight = '100%';
        fsVideo.style.objectFit = 'contain';
        fsVideo.controls = true;
        fsVideo.playsInline = true;
        fsImg.parentNode.appendChild(fsVideo);
    }

    if (videoEl) {
        if (fsImg) fsImg.style.display = 'none';
        if (fsVideo) {
            fsVideo.style.display = 'block';
            fsVideo.src = videoEl.src;
        }
    } else {
        if (fsVideo) {
            fsVideo.style.display = 'none';
            fsVideo.src = '';
        }
        if (fsImg) {
            fsImg.style.display = 'block';
            fsImg.src = imgEl ? imgEl.src : '';
        }
    }

    var key = pId + '_' + fsDesignId;
    document.getElementById('fsQty').innerText = cart[key] ? cart[key].qty : 0;

    var fsModal = document.getElementById('fsModal');
    if (fsModal.style.display !== 'flex') {
        fsModal.style.display = 'flex';
        pushHistoryState('fs'); // 🛡️ TRAPS BACK BUTTON
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
        cb.innerHTML = '';
        var count = 0;
        var grouped = {};

        function safeText(str) { return str ? String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

        // 🛡️ INTERNAL CACHE LOADING
        for (var k in cart) {
            var c = cart[k];
            if (!c || !c.p || !c.p.id) { delete cart[k]; continue; }
            var safeDesign = c.design || 'DIRECT';
            count += (parseInt(c.qty) || 0);
            if (!grouped[c.p.id]) grouped[c.p.id] = { p: c.p, items: [] };
            grouped[c.p.id].items.push(c);
        }

        var cHtml = [];
        for (var r in grouped) {
            var g = grouped[r];
            var pTot = 0;
            g.items.forEach(function (i) { pTot += (parseInt(i.qty) || 0); });

            cHtml.push('<div style="margin-bottom: 20px; border: 1px solid var(--border); border-radius: 8px; overflow:hidden;">');
            cHtml.push('<div style="background:#f5f5f6; padding:10px; border-bottom:1px solid var(--border); cursor:pointer;" onclick="closeCart(true); setTimeout(()=>{openDetail(\'' + g.p.id + '\');},100);">');
            cHtml.push('<div style="font-weight:bold; font-size:15px; color:var(--myntra-pink); text-decoration:underline;">' + safeText(g.p.name) + ' <i class="fas fa-external-link-alt" style="font-size:12px;"></i></div>');
            cHtml.push('<div style="font-size:12px; color:var(--text-light); margin-top:4px;">SKU: ' + safeText(g.p.sku) + ' | Rate: ₹' + g.p.price + ' | Packing: ' + safeText(g.p.packing) + ' | Total Qty: ' + pTot + ' pcs</div>');
            cHtml.push('</div><div style="display:flex; flex-wrap:wrap; gap:10px; padding:10px;">');

            g.items.forEach(function (item) {
                var safeDesignLabel = item.design || 'DIRECT';
                var dLabel = safeDesignLabel === 'DIRECT' ? 'Cover' : safeDesignLabel;
                var imgId = "cart_img_" + g.p.id + "_" + safeDesignLabel.replace(/[^a-zA-Z0-9]/g, '');

                cHtml.push('<div style="width: 80px; text-align: center;">');
                cHtml.push('<img id="' + imgId + '" src="https://placehold.co/300x300/f0f0f0/a0a0a0?text=..." style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); cursor: pointer;">');
                cHtml.push('<div style="font-size: 11px; margin-top: 4px; color:var(--text-light);">' + dLabel + '</div>');
                cHtml.push('<div style="font-size: 12px; font-weight: bold; color: var(--myntra-pink);">' + (item.qty || 0) + ' pcs</div>');
                cHtml.push('</div>');
            });
            cHtml.push('</div></div>');
        }

        if (count === 0) {
            cb.innerHTML = '<div style="text-align:center; padding:40px 20px; color:var(--text-light); font-weight:bold;">Your Cart is empty.</div>';
        } else {
            cb.innerHTML = cHtml.join('');

            // Progressive load Cart images
            setTimeout(() => {
                for (var r in grouped) {
                    grouped[r].items.forEach(function (item) {
                        var safeDesignLabel = item.design || 'DIRECT';
                        var imgId = "cart_img_" + grouped[r].p.id + "_" + safeDesignLabel.replace(/[^a-zA-Z0-9]/g, '');
                        var imgEl = document.getElementById(imgId);
                        if (imgEl) {
                            var gridPath = grouped[r].p.gridUrl;
                            var zoomPath = grouped[r].p.zoomUrl;

                            var targetFile = "01.webp";
                            if (safeDesignLabel !== 'DIRECT') {
                                var cleanNum = safeDesignLabel.replace(/\D/g, '');
                                if (cleanNum.length === 1) cleanNum = "0" + cleanNum;
                                if (cleanNum === "") cleanNum = "02";
                                targetFile = cleanNum + ".webp";
                            }
                            window.renderWebpFromFolder(imgEl, gridPath, zoomPath, targetFile);
                        }
                    });
                }
            }, 50);
        }

        var headerCount = document.getElementById('cartCountHeader');
        if (headerCount) headerCount.innerText = count;
        var footerQty = document.getElementById('cartTotalQty');
        if (footerQty) footerQty.innerText = count + " pcs";

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
        renderProductGrid(displayList); // Reload main screen inputs
    }
}

// ====================================
// 💬 SMART WHATSAPP ROUTING (PC & Mobile)
// ====================================
function sendWhatsapp() {
    var keys = Object.keys(cart);
    if (keys.length === 0) return alert("Your cart is empty!");

    var msg = "🛍️ *New Order from Web App*\n\n";
    var totalQty = 0;
    var groups = {};

    for (var k in cart) {
        var item = cart[k];
        if (!groups[item.p.id]) groups[item.p.id] = { p: item.p, items: [] };
        groups[item.p.id].items.push(item);
    }

    for (var r in groups) {
        var g = groups[r];
        msg += "🏷️ *" + g.p.name + "* (SKU: " + g.p.sku + ")\n";
        g.items.forEach(function (item) {
            var dName = item.design === 'DIRECT' ? 'Cover' : item.design;
            msg += "  - " + dName + ": " + item.qty + " pcs\n";
            totalQty += item.qty;
        });
        msg += "\n";
    }
    msg += "📦 *Total Quantity:* " + totalQty + " pcs\n";

    var number = "919099887766"; // <<< REPLACE THIS WITH YOUR REAL WHATSAPP NUMBER
    var encodedMsg = encodeURIComponent(msg);

    // 🧠 Detects if you are on a PC or a Mobile phone
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Triggers the actual WhatsApp app on phones
        window.open("whatsapp://send?phone=" + number + "&text=" + encodedMsg, '_blank');
    } else {
        // Triggers WhatsApp Web on Desktop PCs
        window.open("https://web.whatsapp.com/send?phone=" + number + "&text=" + encodedMsg, '_blank');
    }
}

// Utilities are defined at the bottom of the file

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

    // Grab all loaded images from the current Swipe Deck
    var deck = document.getElementById('dtDesigns');
    var imgArray = [];
    if (deck) {
        var imgs = deck.querySelectorAll('img');
        imgs.forEach(img => {
            // Only grab real images, not placeholders
            if (img.src && !img.src.includes('placehold.co') && !img.src.includes('data:image')) {
                imgArray.push(img.src);
            }
        });
    }

    // Deduplicate array
    imgArray = [...new Set(imgArray)];

    if (imgArray.length === 0) {
        alert("Images are still loading, please wait a second.");
        return;
    }

    // Calls your PDF Engine
    if (typeof generateNativePDF === 'function') {
        await generateNativePDF(curProduct.name, curProduct.price, imgArray, action);
    } else {
        alert("PDF Engine is not loaded!");
    }
}

function testPdfEngine() {
    if (!curProduct) {
        alert("Open a product first!");
        return;
    }

    // Grab the Firebase base URL
    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    var folderPath = (curProduct.zoomUrl && curProduct.zoomUrl !== "None") ? curProduct.zoomUrl : curProduct.gridUrl;
    var encPath = folderPath.split('/').map(encodeURIComponent).join('%2F');

    // Build an array of image URLs to put in the PDF (Cover + 2 designs for testing)
    var testImages = [
        fbBase + encPath + "%2F01.webp?alt=media",
        fbBase + encPath + "%2F02.webp?alt=media",
        fbBase + encPath + "%2F03.webp?alt=media"
    ];

    // Calls the engine in the new file!
    generateNativePDF(curProduct.name, curProduct.price, testImages);
}

window.openCartFs = function (productId, designId, cartImgSrc) {
    // 1. Initialize detail view silently (renders the swipe deck in DOM)
    openDetail(productId, true);

    // Resolve current product ID to support cart items with stale IDs
    var actualProductId = curProduct ? curProduct.id : productId;

    var index = 0;
    var deck = document.getElementById('dtDesigns');
    if (deck) {
        var cards = Array.from(deck.querySelectorAll('.swipe-card'));

        // Match by input ID (direct check)
        var inputEl = document.getElementById('qty_' + actualProductId + '_' + designId);
        if (inputEl) {
            var cardEl = inputEl.closest('.swipe-card');
            var foundIdx = cards.indexOf(cardEl);
            if (foundIdx !== -1) {
                index = foundIdx;
            }
        } else {
            // Fallback: match card text label or input ID suffix case-insensitively
            var targetLabel = String(designId).trim().toLowerCase();
            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];

                // 1. Check if input element ID ends with _designId (e.g. _D2 or _02)
                var inp = card.querySelector('input[type="number"]');
                if (inp && (inp.id.toLowerCase().endsWith('_' + targetLabel) || inp.id.toLowerCase() === 'qty_' + actualProductId.toLowerCase() + '_' + targetLabel)) {
                    index = i;
                    break;
                }

                // 2. Check if text label in swipe-card-bot matches
                var botDiv = card.querySelector('.swipe-card-bot');
                if (botDiv) {
                    var firstChild = botDiv.firstElementChild;
                    if (firstChild) {
                        var cardLabel = firstChild.innerText.trim().toLowerCase();
                        // Handle "Cover" vs "DIRECT"
                        if ((cardLabel === 'cover' && targetLabel === 'direct') || cardLabel === targetLabel) {
                            index = i;
                            break;
                        }
                    }
                }
            }
        }
    }

    // 3. Open full screen viewer
    openFs(actualProductId, index, designId, cartImgSrc);
};

// ====================================
// UTILS & HELPERS
// ====================================
window.goToHome = function () {
    cameFromDetail = false;
    var detail = document.getElementById('detailPanel');
    var cart = document.getElementById('cartPanel');
    if (detail && detail.classList.contains('open')) closeDetail();
    if (cart && cart.classList.contains('open')) { cart.classList.remove('open'); history.back(); }
    document.querySelectorAll('.action-modal').forEach(m => m.style.display = 'none');
};
async function syncImages() {
    var bootScreen = document.getElementById('boot');
    var bootMsg = document.getElementById('bootMsg');

    if (bootScreen) bootScreen.style.display = 'flex';
    if (bootMsg) bootMsg.innerText = "Fetching latest product list...";

    try {
        const res = await fetch(FIRESTORE_PRODUCTS_URL);
        const data = await res.json();
        var docs = data.documents || [];

        var productsToDownload = [];
        docs.forEach(d => {
            var f = d.fields || {};
            var name = f.name ? f.name.stringValue : "";
            var gridUrl = f.gridUrl ? f.gridUrl.stringValue : "";
            var ready = f.ready ? f.ready.stringValue : "";
            if (name && name.toLowerCase() !== "temp" && name.toLowerCase() !== "unnamed" && gridUrl && gridUrl.trim() !== "" && gridUrl.toLowerCase() !== "none") {
                productsToDownload.push({
                    name: name,
                    gridUrl: gridUrl,
                    ready: ready
                });
            }
        });

        if (productsToDownload.length === 0) {
            if (bootScreen) bootScreen.style.display = 'none';
            alert("No images found to sync.");
            initApp();
            return;
        }

        var total = productsToDownload.length;
        if (bootMsg) bootMsg.innerText = "Syncing 0 / " + total + " images...";

        var count = 0;
        var failed = 0;
        var bucket = "durga-sarees.firebasestorage.app";
        var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

        // Download in batches of 5
        var batchSize = 5;
        for (var i = 0; i < productsToDownload.length; i += batchSize) {
            var batch = productsToDownload.slice(i, i + batchSize);
            await Promise.all(batch.map(async (p) => {
                var encGridPath = p.gridUrl.split('/').map(encodeURIComponent).join('%2F');
                var urlsToTry = [
                    fbBase + encGridPath + "%2F01.webp?alt=media",
                    fbBase + encGridPath + "%2Fcover.webp?alt=media",
                    fbBase + encGridPath + "%2F1.webp?alt=media"
                ];

                var downloaded = false;
                for (var u = 0; u < urlsToTry.length; u++) {
                    try {
                        const response = await fetch(urlsToTry[u]);
                        if (response.ok) {
                            const blob = await response.blob();
                            var saved = await saveImageToDB(p.gridUrl, blob);
                            if (saved) {
                                downloaded = true;
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn("Attempt " + u + " failed for url: " + urlsToTry[u], err);
                    }
                }
                if (!downloaded) {
                    failed++;
                }

                // Download ready design grid images
                if (p.ready && p.ready.trim() !== "") {
                    var rawDesigns = String(p.ready).split(',').map(d => d.trim()).filter(Boolean);
                    var validDesigns = [];
                    rawDesigns.forEach(d => {
                        var cleanNum = d.replace(/\D/g, '');
                        if (d.length <= 10 && cleanNum !== "") {
                            var numVal = parseInt(cleanNum);
                            if (numVal >= 2 && numVal <= 99) {
                                validDesigns.push({
                                    name: d,
                                    numStr: cleanNum.length === 1 ? "0" + cleanNum : cleanNum,
                                    cleanNum: cleanNum
                                });
                            }
                        }
                    });

                    for (var d = 0; d < validDesigns.length; d++) {
                        var dObj = validDesigns[d];
                        var designKey = fbBase + encGridPath + "%2F" + dObj.numStr + ".webp?alt=media";
                        var designUrlsToTry = [
                            designKey,
                            fbBase + encGridPath + "%2F" + dObj.cleanNum + ".webp?alt=media"
                        ];

                        for (var u = 0; u < designUrlsToTry.length; u++) {
                            try {
                                const response = await fetch(designUrlsToTry[u]);
                                if (response.ok) {
                                    const blob = await response.blob();
                                    var saved = await saveImageToDB(designKey, blob);
                                    if (saved) {
                                        break;
                                    }
                                }
                            } catch (err) {
                                console.warn("Attempt " + u + " failed for design url: " + designUrlsToTry[u], err);
                            }
                        }
                    }
                }

                count++;
            }));

            if (bootMsg) {
                bootMsg.innerText = "Syncing " + count + " / " + total + " images...";
            }
        }

        if (bootScreen) bootScreen.style.display = 'none';

        if (failed > 0) {
            alert("Sync completed. Successfully saved " + (total - failed) + " images to local storage. (" + failed + " failed)");
        } else {
            alert("Success! All " + total + " catalog images saved to local storage.");
        }

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
        edited[p.name] = {
            price: p.price,
            packing: p.packing
        };
        localStorage.setItem("dsEditedProducts", JSON.stringify(edited));
    } catch (e) { console.error("Error saving product edit:", e); }
}

function setupEditableFields() {
    var priceBot = document.getElementById('dtPriceBot');
    var packBot = document.getElementById('dtPackBot');

    if (priceBot) {
        priceBot.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                priceBot.blur();
            }
        });
        priceBot.addEventListener('blur', function () {
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
        packBot.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                packBot.blur();
            }
        });
        packBot.addEventListener('blur', function () {
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
    if (dtQtyInput) {
        dtQtyInput.value = qty;
    }

    var btnMinus = document.getElementById('dtQtyBotMinus');
    var btnPlus = document.getElementById('dtQtyBotPlus');

    if (btnMinus) {
        btnMinus.onclick = function () {
            changeQty(curProduct.id, 'DIRECT', -1);
        };
    }
    if (btnPlus) {
        btnPlus.onclick = function () {
            changeQty(curProduct.id, 'DIRECT', 1);
        };
    }
}

// 📱 Listen to hybrid app native backbutton event to prevent app minimization and handle stack back transition
document.addEventListener("backbutton", function (e) {
    var hasActiveModal = false;

    var detailPanel = document.getElementById('detailPanel');
    var cartPanel = document.getElementById('cartPanel');
    var fsModal = document.getElementById('fsModal');

    if (fsModal && fsModal.style.display === 'flex') {
        hasActiveModal = true;
    } else if (cartPanel && cartPanel.classList.contains('open')) {
        hasActiveModal = true;
    } else if (detailPanel && detailPanel.classList.contains('open')) {
        hasActiveModal = true;
    } else {
        var actionModals = document.querySelectorAll('.action-modal');
        for (var i = 0; i < actionModals.length; i++) {
            if (actionModals[i].style.display === 'flex') {
                hasActiveModal = true;
                break;
            }
        }
    }

    if (hasActiveModal) {
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

    var trimmedVal = val.trim();
    if (trimmedVal !== "") {
        var detailPanel = document.getElementById('detailPanel');
        if (detailPanel && detailPanel.classList.contains('open')) {
            cameFromDetail = true;
            searchingTransition = true;
            closeDetail();
        }
    } else {
        if (cameFromDetail && curProduct) {
            openDetail(curProduct.id, false, true);
            cameFromDetail = false;
        }
    }
};

window.populateCategories = function () {
    var catListEl = document.getElementById('categoryList');
    if (!catListEl) return;

    var cats = {};
    allProducts.forEach(p => {
        if (p.cat) cats[p.cat] = true;
    });
    var sortedCats = Object.keys(cats).sort();

    var html = '';
    sortedCats.forEach(cat => {
        var activeClass = activeCategories.includes(cat) ? 'active' : '';
        html += `<div class="filter-row ${activeClass}" onclick="toggleCategoryFilter(this, '${esc(cat)}')">${esc(cat)}</div>`;
    });
    catListEl.innerHTML = html;
};

window.toggleCategoryFilter = function (element, cat) {
    cameFromDetail = false;
    var idx = activeCategories.indexOf(cat);
    if (idx === -1) {
        activeCategories.push(cat);
        if (element) element.classList.add('active');
    } else {
        activeCategories.splice(idx, 1);
        if (element) element.classList.remove('active');
    }
    applyFilter();
};

window.togglePriceFilter = function (element, min, max) {
    cameFromDetail = false;
    var filterStr = min + '-' + max;
    var idx = activePriceFilters.indexOf(filterStr);
    if (idx === -1) {
        activePriceFilters.push(filterStr);
        if (element) element.classList.add('active');
    } else {
        activePriceFilters.splice(idx, 1);
        if (element) element.classList.remove('active');
    }
    applyFilter();
};

window.clearPriceFilters = function () {
    cameFromDetail = false;
    activePriceFilters = [];
    var modal = document.getElementById('filterModal');
    if (modal) {
        var rows = modal.querySelectorAll('.filter-row');
        rows.forEach(r => r.classList.remove('active'));
    }
    applyFilter();
};

window.toggleSearch = function () {
    var container = document.getElementById('searchContainerMain');
    if (container) {
        if (container.style.display === 'none' || container.style.display === '') {
            container.style.display = 'block';
            var input = container.querySelector('input');
            if (input) input.focus();
        } else {
            container.style.display = 'none';
            var input = container.querySelector('input');
            if (input) {
                input.value = '';
                doSearch('');
            }
        }
    }
};

window.toggleFavView = function () {
    cameFromDetail = false;
    showOnlyFavs = !showOnlyFavs;
    var favIcon = document.getElementById('favTopIcon');
    if (favIcon) {
        if (showOnlyFavs) {
            favIcon.classList.remove('far');
            favIcon.classList.add('fas');
            favIcon.style.color = 'var(--myntra-pink)';
        } else {
            favIcon.classList.remove('fas');
            favIcon.classList.add('far');
            favIcon.style.color = '';
        }
    }
    applyFilter();
};

window.setSort = function (type, element) {
    cameFromDetail = false;
    currentSort = type;

    var modal = document.getElementById('sortModal');
    if (modal) {
        var rows = modal.querySelectorAll('.filter-row');
        rows.forEach(r => r.classList.remove('active'));
    }
    if (element) {
        element.classList.add('active');
    }

    applyFilter();
    closeModals();
};

window.applyFilter = function () {
    var srch = document.getElementById('srch');
    var query = srch ? srch.value.trim().toLowerCase() : '';

    var filtered = allProducts.filter(p => {
        // 1. Search Query
        if (query !== "") {
            var nameMatch = p.name && p.name.toLowerCase().includes(query);
            var skuMatch = p.sku && p.sku.toLowerCase().includes(query);
            var fabricMatch = p.fabric && p.fabric.toLowerCase().includes(query);
            if (!nameMatch && !skuMatch && !fabricMatch) return false;
        }

        // 2. Category
        if (activeCategories.length > 0) {
            if (!activeCategories.includes(p.cat)) return false;
        }

        // 3. Price
        if (activePriceFilters.length > 0) {
            var matchPrice = false;
            activePriceFilters.forEach(f => {
                var parts = f.split('-');
                var min = parseFloat(parts[0]);
                var max = parseFloat(parts[1]);
                if (p.price >= min && p.price <= max) {
                    matchPrice = true;
                }
            });
            if (!matchPrice) return false;
        }

        // 4. Favorites
        if (showOnlyFavs) {
            if (!favorites[p.id]) return false;
        }

        return true;
    });

    // 5. Sorting
    if (currentSort === 'priceAsc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'priceDesc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'new') {
        // Default loading order
    }

    displayList = filtered;
    renderProductGrid(displayList);
};

// 📱 Listen to popstate to handle history back/forward navigation and close/open modals accordingly
function applyModalState(modal) {
    var detailPanel = document.getElementById('detailPanel');
    var cartPanel = document.getElementById('cartPanel');
    var fsModal = document.getElementById('fsModal');
    var actionModals = document.querySelectorAll('.action-modal');

    // 1. Sync Full Screen Modal
    if (modal === 'fs') {
        if (fsModal) fsModal.style.display = 'flex';
    } else {
        if (fsModal) fsModal.style.display = 'none';
    }

    // 2. Sync Detail Panel
    if (modal === 'detail' || modal === 'fs') {
        if (detailPanel && !detailPanel.classList.contains('open')) {
            detailPanel.classList.add('open');
        }
    } else {
        if (detailPanel) {
            detailPanel.classList.remove('open');
        }
    }

    // 3. Sync Cart Panel
    if (modal === 'cart') {
        if (cartPanel && !cartPanel.classList.contains('open')) {
            cartPanel.classList.add('open');
        }
    } else {
        if (cartPanel) {
            cartPanel.classList.remove('open');
        }
    }

    // 4. Sync Action Modals (categoryModal, sortModal, filterModal, shareModal, waModal)
    actionModals.forEach(function (m) {
        if (m.id === modal) {
            m.style.display = 'flex';
        } else {
            m.style.display = 'none';
        }
    });
}

window.addEventListener('popstate', function (e) {
    var state = e.state || {};
    applyModalState(state.modal);

    if (searchingTransition) {
        searchingTransition = false;
    } else {
        cameFromDetail = false;
    }
});

