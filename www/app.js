// ==========================================
// 🌸 DURGA SAREES - FIXED APP.JS v3 (RESTORED UI)
// ==========================================

const FIRESTORE_PRODUCTS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products?pageSize=1000";
const FIRESTORE_USERS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users?pageSize=100";

history.replaceState({ modal: 'main' }, '');

// Initialize Web Firebase Fallback Config
const firebaseConfig = {
  apiKey: "AIzaSyA3Za-dZ8OWWF7ZJdneKGd7A2t8xm_7IZQ",
  authDomain: window.location.hostname.includes("durga-sarees") ? window.location.hostname : "durga-sarees.firebaseapp.com",
  projectId: "durga-sarees"
};
var webConfirmationResult = null;

function initFirebaseWebFallback() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
    if (typeof firebase !== 'undefined') return;
    
    var s1 = document.createElement('script');
    s1.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
    s1.onload = function() {
        var s2 = document.createElement('script');
        s2.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
        s2.onload = function() {
            firebase.initializeApp(firebaseConfig);
            try {
                window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    'size': 'invisible'
                });
            } catch(e) { console.error(e); }
        };
        document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
}

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

var coverExistsMap = {};
try {
    coverExistsMap = JSON.parse(localStorage.getItem("dsCoverExists")) || {};
} catch (e) {
    console.error("Error reading dsCoverExists", e);
}

function saveCoverExistsMap() {
    try {
        localStorage.setItem("dsCoverExists", JSON.stringify(coverExistsMap));
    } catch (e) {
        console.error("Error saving dsCoverExists", e);
    }
}

var dsFallbackMap = {};
try {
    dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap")) || {};
} catch (e) {
    console.error("Error reading dsFallbackMap", e);
}

function saveFallbackMap() {
    try {
        localStorage.setItem("dsFallbackMap", JSON.stringify(dsFallbackMap));
    } catch (e) {
        console.error("Error saving dsFallbackMap", e);
    }
}

window.dsFolderCache = {};
try {
    var _cacheVer = localStorage.getItem("dsFolderCacheVer");
    if (_cacheVer === "v2") {
        window.dsFolderCache = JSON.parse(localStorage.getItem("dsFolderCache")) || {};
    } else {
        // Clear old cache - URL format changed (now uses Grid path + delimiter=/)
        localStorage.removeItem("dsFolderCache");
        localStorage.setItem("dsFolderCacheVer", "v2");
        console.log("Cleared stale folder cache (format upgrade to v2)");
    }
} catch (e) {
    console.error("Error reading dsFolderCache", e);
}

window.addEventListener('DOMContentLoaded', function () {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
            try {
                window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
                window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#ffffff' });
            } catch(e) {}
        }
        
        try { activeUser = localStorage.getItem("dsUserToken"); } catch (e) { }
        try { cart = JSON.parse(localStorage.getItem("dsCart")) || {}; } catch (e) { }
        try { favorites = JSON.parse(localStorage.getItem("dsFavs")) || {}; } catch (e) { }

        var loginScreen = document.getElementById('loginScreen');
        var appBody = document.getElementById('appBody');

        if (activeUser && activeUser !== "null" && activeUser !== "undefined") {
            if (loginScreen && appBody) {
                loginScreen.style.display = 'none';
                appBody.style.display = 'flex';
                setTimeout(initApp, 100);
            }
        } else {
            if (loginScreen && appBody) {
                loginScreen.style.display = 'flex';
                appBody.style.display = 'none';
                initFirebaseWebFallback();
            }
        }
        
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            if (window.CapacitorFirebaseAuthentication) {
                window.CapacitorFirebaseAuthentication.addListener('authStateChange', (user) => {
                    if (user && user.phoneNumber) {
                        try { localStorage.setItem("dsUserToken", user.phoneNumber); } catch (e) { }
                        activeUser = user.phoneNumber;
                        if (loginScreen && appBody && loginScreen.style.display !== 'none') {
                            loginScreen.style.display = 'none';
                            appBody.style.display = 'flex';
                            initApp();
                        }
                    }
                });

                window.CapacitorFirebaseAuthentication.addListener('phoneCodeSent', (event) => {
                    dsVerificationId = event.verificationId;
                    document.getElementById('loginBoxPhone').style.display = 'none';
                    document.getElementById('loginBoxOtp').style.display = 'block';
                    var btn = document.getElementById('btnSendOtp');
                    if (btn) btn.innerText = "SEND OTP";
                });

                window.CapacitorFirebaseAuthentication.addListener('phoneVerificationCompleted', (result) => {
                    const user = result.user;
                    if (user) {
                        var inputPhone = document.getElementById('lPhone').value.trim();
                        var countryCode = document.getElementById('lCountry') ? document.getElementById('lCountry').value.trim() : "+91";
                        var phoneStr = user.phoneNumber || (inputPhone.startsWith('+') ? inputPhone : countryCode + inputPhone);
                        
                        checkUserInFirestore(phoneStr).then(function(exists) {
                            if (exists) {
                                completeLogin(phoneStr);
                            } else {
                                document.getElementById('loginBoxOtp').style.display = 'none';
                                document.getElementById('loginBoxRegister').style.display = 'block';
                                window.pendingUserPhone = phoneStr;
                            }
                        });
                    }
                });

                window.CapacitorFirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
                    var errEl = document.getElementById('lErr');
                    if (errEl) errEl.innerText = "❌ Verification Failed: " + event.message;
                    var errElOtp = document.getElementById('lErrOtp');
                    if (errElOtp) errElOtp.innerText = "❌ " + event.message;
                    var btn = document.getElementById('btnSendOtp');
                    if (btn) btn.innerText = "SEND OTP";
                });
            }
        } else {
            // Handled by initFirebaseWebFallback
        }

        setupEditableFields();
        setupFsGestures();
        
        // 🚀 Initialize Capgo OTA Updater
        if (window.Capacitor && window.Capacitor.Plugins.CapacitorUpdater) {
            window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
            checkForOTAUpdates();
        }
    } catch (err) { console.error("Init error:", err); }
});

async function checkForOTAUpdates() {
    try {
        var response = await fetch("https://durga-sarees.web.app/version.json?t=" + new Date().getTime());
        if (!response.ok) return; // version.json missing = no update available
        var data = await response.json();
        var latestVersion = data.version;
        var updateUrl = data.url;

        var currentVersion = localStorage.getItem("dsOtaVersion") || "builtin";

        if (latestVersion && latestVersion !== currentVersion) {
            console.log("OTA update available:", latestVersion);
            if (window.Capacitor && window.Capacitor.Plugins.CapacitorUpdater && updateUrl) {
                // Native APK: use CapacitorUpdater
                var versionData = await window.Capacitor.Plugins.CapacitorUpdater.download({
                    url: updateUrl,
                    version: latestVersion
                });
                localStorage.setItem("dsOtaVersion", latestVersion);
                await window.Capacitor.Plugins.CapacitorUpdater.set(versionData);
            } else {
                // Web / WebView with server.url: force a hard reload to pick up new JS/HTML
                localStorage.setItem("dsOtaVersion", latestVersion);
                location.reload(true);
            }
        }
    } catch(e) {
        console.log("OTA check skipped:", e.message);
    }
}

var dsVerificationId = null;

async function sendOtp() {
    var phoneEl = document.getElementById('lPhone');
    var errEl = document.getElementById('lErr');
    if (!phoneEl) return;

    var phone = phoneEl.value.trim();
    var countryCode = document.getElementById('lCountry') ? document.getElementById('lCountry').value.trim() : "+91";
    if (!phone) { if (errEl) errEl.innerText = "Enter phone number"; return; }
    
    if (!phone.startsWith('+')) {
        phone = countryCode + phone;
    }

    var btn = document.getElementById('btnSendOtp');
    if (btn) btn.innerText = "Sending...";
    if (errEl) errEl.innerText = "";

    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            if (!window.CapacitorFirebaseAuthentication) throw new Error("Firebase Auth Plugin missing");
            await window.CapacitorFirebaseAuthentication.signInWithPhoneNumber({
                phoneNumber: phone
            });
            // Note: The UI will transition to the OTP screen when the 'phoneCodeSent' event fires
        } else {
            // Web fallback
            if (typeof firebase === 'undefined') throw new Error("Firebase Web SDK missing");
            webConfirmationResult = await firebase.auth().signInWithPhoneNumber(phone, window.recaptchaVerifier);
            document.getElementById('loginBoxPhone').style.display = 'none';
            document.getElementById('loginBoxOtp').style.display = 'block';
            if (btn) btn.innerText = "SEND OTP";
        }
    } catch (err) {
        if (errEl) errEl.innerText = "❌ " + (err.message || "Failed to send OTP");
        if (btn) btn.innerText = "SEND OTP";
    }
}

async function verifyOtp() {
    var otpEl = document.getElementById('lOtp');
    var errEl = document.getElementById('lErrOtp');
    if (!otpEl) return;

    var code = otpEl.value.trim();
    if (!code) { if (errEl) errEl.innerText = "Enter OTP code"; return; }

    var btn = document.getElementById('btnVerifyOtp');
    if (btn) btn.innerText = "Verifying...";
    if (errEl) errEl.innerText = "";

    try {
        let phoneStr = "";
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            await window.CapacitorFirebaseAuthentication.confirmVerificationCode({
                verificationId: dsVerificationId,
                verificationCode: code
            });
        } else {
            // Web fallback
            if (!webConfirmationResult) throw new Error("No OTP requested");
            await webConfirmationResult.confirm(code);
        }
        
        var inputPhone = document.getElementById('lPhone').value.trim();
        var countryCode = document.getElementById('lCountry') ? document.getElementById('lCountry').value.trim() : "+91";
        phoneStr = inputPhone.startsWith('+') ? inputPhone : countryCode + inputPhone;
        
        checkUserInFirestore(phoneStr).then(function(exists) {
            if (exists) {
                completeLogin(phoneStr);
            } else {
                document.getElementById('loginBoxOtp').style.display = 'none';
                document.getElementById('loginBoxRegister').style.display = 'block';
                window.pendingUserPhone = phoneStr;
            }
        });
    } catch (err) {
        if (errEl) errEl.innerText = "❌ Invalid OTP or Error: " + (err.message || "");
        if (btn) btn.innerText = "VERIFY";
    }
}

async function checkUserInFirestore(phone) {
    try {
        var token = "";
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            token = await firebase.auth().currentUser.getIdToken();
        }
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        var query = {
            structuredQuery: {
                from: [{ collectionId: "Users" }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: "phone" },
                        op: "EQUAL",
                        value: { stringValue: phone }
                    }
                },
                limit: 1
            }
        };
        var res = await fetch("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents:runQuery", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(query)
        });
        var data = await res.json();
        if (data && data.length > 0 && data[0].document) {
            return true;
        }
        return false;
    } catch(e) {
        console.error(e);
        return false;
    }
}

async function saveProfile() {
    var nameEl = document.getElementById('rName');
    var stationEl = document.getElementById('rStation');
    var stateEl = document.getElementById('rState');
    var firm = document.getElementById('rFirm').value.trim();
    var err = document.getElementById('rErr');
    
    var name = nameEl.value.trim();
    var station = stationEl.value.trim();
    var state = stateEl.value.trim();

    var hasErr = false;

    if (!name) {
        nameEl.classList.add("error");
        nameEl.placeholder = "Name is Required *";
        hasErr = true;
    } else {
        nameEl.classList.remove("error");
        nameEl.placeholder = "Name *";
    }

    if (!station) {
        stationEl.classList.add("error");
        stationEl.placeholder = "Station is Required *";
        hasErr = true;
    } else {
        stationEl.classList.remove("error");
        stationEl.placeholder = "Station *";
    }

    if (!state) {
        stateEl.classList.add("error");
        stateEl.placeholder = "State is Required *";
        hasErr = true;
    } else {
        stateEl.classList.remove("error");
        stateEl.placeholder = "State *";
    }
    
    if (hasErr) {
        if(err) err.innerText = "";
        return;
    }
    
    var phone = window.pendingUserPhone;
    var doc = {
        fields: {
            name: { stringValue: name },
            firm: { stringValue: firm },
            station: { stringValue: station },
            state: { stringValue: state },
            phone: { stringValue: phone },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    };
    
    document.getElementById('btnSaveProfile').innerText = "Saving...";
    try {
        var token = "";
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            token = await firebase.auth().currentUser.getIdToken();
        }
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        var res = await fetch("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(doc)
        });
        if (res.ok) {
            completeLogin(phone);
        } else {
            err.innerText = "Error saving profile.";
            document.getElementById('btnSaveProfile').innerText = "SAVE & CONTINUE";
        }
    } catch(e) {
        err.innerText = "Network error.";
        document.getElementById('btnSaveProfile').innerText = "SAVE & CONTINUE";
    }
}

function completeLogin(phoneStr) {
    try { localStorage.setItem("dsUserToken", phoneStr); } catch (e) { }
    activeUser = phoneStr;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appBody').style.display = 'flex';
    initApp();
}

function backToPhone() {
    document.getElementById('loginBoxOtp').style.display = 'none';
    document.getElementById('loginBoxPhone').style.display = 'block';
    document.getElementById('lErr').innerText = "";
    document.getElementById('lErrOtp').innerText = "";
    document.getElementById('lOtp').value = "";
}

function initApp() {
    var bootScreen = document.getElementById('boot');
    if (bootScreen) bootScreen.style.display = 'flex';

function processProducts(docs) {
    var validCounter = 0;
    allProducts = [];
    var edited = {};
    try { edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {}; } catch (e) { }

    docs.forEach(d => {
        var f = d.fields || {};
        var name = f.name ? f.name.stringValue : "";
        var isWix = JSON.stringify(f).toLowerCase().includes("wix import");

        if (name && name.toLowerCase() !== "temp" && name.toLowerCase() !== "unnamed" && !isWix) {
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
                ready: f.ready ? f.ready.stringValue : "",
                jari: f.jari ? f.jari.stringValue : "",
                border: f.border ? f.border.stringValue : "",
                cut: f.cut ? f.cut.stringValue : "",
                pallu: f.pallu ? f.pallu.stringValue : "",
                blouse: f.blouse ? f.blouse.stringValue : ""
            });
            validCounter++;
        }
    });

    displayList = [...allProducts];

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
}

    fetch(FIRESTORE_PRODUCTS_URL)
        .then(res => res.json())
        .then(data => {
            var docs = data.documents || [];
            console.log("DATABASE PRODUCTS SAMPLE:", docs.slice(0, 20).map(d => ({
                name: d.fields?.name?.stringValue,
                packing: d.fields?.packing
            })));
            try { localStorage.setItem("dsOfflineProducts", JSON.stringify(docs)); } catch(e) {}
            var bootScreen = document.getElementById('boot');
            if (bootScreen) bootScreen.style.display = 'none';
            processProducts(docs);
        })
        .catch(err => {
            console.log("Offline or fetch failed, loading from cache...", err);
            try {
                var cachedDocs = JSON.parse(localStorage.getItem("dsOfflineProducts"));
                if (cachedDocs && cachedDocs.length > 0) {
                    var bootScreen = document.getElementById('boot');
                    if (bootScreen) bootScreen.style.display = 'none';
                    processProducts(cachedDocs);
                    return;
                }
            } catch(e) {}
            var bootScreen = document.getElementById('boot');
            if (bootScreen) bootScreen.style.display = 'none';
            processProducts([]);
        });
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

function deleteImageFromDB(key) {
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction(storeName, "readwrite");
            var store = tx.objectStore(storeName);
            var req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        });
    }).catch(() => false);
}

// List all IndexedDB keys that start with a given prefix string
function listDBKeysForPrefix(prefix) {
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction(storeName, "readonly");
            var store = tx.objectStore(storeName);
            var boundKeyRange = IDBKeyRange.bound(prefix, prefix + '\uffff');
            if (store.getAllKeys) {
                var req = store.getAllKeys(boundKeyRange);
                req.onsuccess = function(e) {
                    resolve(e.target.result || []);
                };
                req.onerror = () => resolve([]);
            } else {
                var keys = [];
                var req = store.openKeyCursor(boundKeyRange);
                req.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        keys.push(cursor.key);
                        cursor.continue();
                    } else {
                        resolve(keys);
                    }
                };
                req.onerror = () => resolve([]);
            }
        });
    }).catch(() => []);
}

// 🧠 CORE FIX: Resolves the exact IndexedDB cache key for a given design label
// It ignores file extensions (.jpg vs .webp) and padding (2 vs 02) to guarantee a match
window.findDesignKeyInCache = async function(gridUrl, designLabel) {
    if (!gridUrl) return null;
    if (designLabel === 'DIRECT' || designLabel === 'Cover') return gridUrl;
    
    var cleanGrid = gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
    var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');
    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    var prefix = fbBase + encGridPath + "%2F";
    
    if (!window.designKeyPrefixCache) window.designKeyPrefixCache = {};
    if (!window.designKeyPrefixCache[prefix]) {
        window.designKeyPrefixCache[prefix] = await listDBKeysForPrefix(prefix);
    }
    var keys = window.designKeyPrefixCache[prefix];
    if (!keys || keys.length === 0) return null;
    
    var targetNum = parseInt(String(designLabel).replace(/\D/g, ''));
    var bestKey = null;
    
    for (var k of keys) {
        var filenameEnc = k.replace(prefix, '').split('?')[0];
        var filename = decodeURIComponent(filenameEnc).toLowerCase();
        var nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        if (!nameWithoutExt) nameWithoutExt = filename;
        
        // 1. Exact Name Match (e.g. "Red")
        if (nameWithoutExt === String(designLabel).toLowerCase()) return k;
        
        // 2. Numeric Match (e.g. "2" == "02")
        if (!isNaN(targetNum)) {
            var fileNum = parseInt(nameWithoutExt.replace(/\D/g, ''));
            if (fileNum === targetNum) {
                bestKey = k; // Store it, but keep searching just in case there's an exact match
            }
        }
    }
    
    return bestKey;
};
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
    var encGridPath = gridPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    var encZoomPath = (zoomPath && zoomPath !== "None") ? zoomPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F') : encGridPath;

    var fileToFetch = targetFile ? targetFile : "01.webp";

    if (fileToFetch === "01.webp" && coverExistsMap[gridPath] === false) {
        if (dsFallbackMap[gridPath]) {
            fileToFetch = dsFallbackMap[gridPath];
        }
    }

    var lowResUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(fileToFetch) + "?alt=media";

    function showPlaceholder() {
        imgElement.src = "https://placehold.co/300x300/f0f0f0/a0a0a0?text=No+Image";
        imgElement.onerror = null;
    }

    // Strip Excel 'ready' logic - always discover files from Firebase folder listing
    function tryToLoadLatestReadyDesign() {
        tryFolderListFallback();
    }

        // 🔍 LAST RESORT: Call Firebase list API to discover actual filenames
        function tryFolderListFallback() {
            // Check if we already cached the fallback filename
            if (dsFallbackMap[gridPath]) {
                var cachedFile = dsFallbackMap[gridPath];
                imgElement.src = fbBase + encGridPath + "%2F" + encodeURIComponent(cachedFile) + "?alt=media";
                imgElement.onerror = function () { showPlaceholder(); };
                return;
            }

            var listPrefix = gridPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
            var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";

            fetch(listUrl)
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var files = (data.items || [])
                        .map(function (item) { return item.name.substring(item.name.lastIndexOf('/') + 1); })
                        .filter(function (f) { return /\.(webp|jpg|jpeg|png)$/i.test(f); });

                    if (files.length > 0) {
                        files.sort(function (a, b) {
                            return (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999);
                        });
                        var firstFile = files[0];
                        dsFallbackMap[gridPath] = firstFile;
                        saveFallbackMap();
                        imgElement.src = fbBase + encGridPath + "%2F" + encodeURIComponent(firstFile) + "?alt=media";
                        imgElement.onload = function () { coverExistsMap[gridPath] = true; saveCoverExistsMap(); };
                        imgElement.onerror = function () { showPlaceholder(); };
                    } else {
                        showPlaceholder();
                    }
                })
                .catch(function () { showPlaceholder(); });
        }


    function loadFromNetwork() {
        imgElement.src = lowResUrl;

        // Fallback if 01.webp fails on Grid
        imgElement.onerror = function () {
            if (fileToFetch === "01.webp") {
                imgElement.src = fbBase + encGridPath + "%2Fcover.webp?alt=media";
                imgElement.onerror = function () {
                    imgElement.src = fbBase + encGridPath + "%2F1.webp?alt=media";
                    imgElement.onerror = function () {
                        // Fallback to zoom bucket for cover images
                        imgElement.src = fbBase + encZoomPath + "%2F01.webp?alt=media";
                        imgElement.onerror = function () {
                            imgElement.src = fbBase + encZoomPath + "%2Fcover.webp?alt=media";
                            imgElement.onerror = function () {
                                coverExistsMap[gridPath] = false;
                                saveCoverExistsMap();
                                tryToLoadLatestReadyDesign();
                            };
                        };
                    };
                    if (typeof updateBottomQtyFromActiveDesign === 'function') updateBottomQtyFromActiveDesign();
                }
            } else if (fileToFetch === targetFile && targetFile !== "01.webp") {
                if (typeof updateBottomQtyFromActiveDesign === 'function') updateBottomQtyFromActiveDesign();
                showPlaceholder();
            } else {
                tryToLoadLatestReadyDesign();
            }
        };

        // Cache the result if load is successful
        imgElement.onload = function () {
            if (fileToFetch === "01.webp" && (imgElement.src.includes("01.webp") || imgElement.src.includes("cover.webp") || imgElement.src.includes("1.webp"))) {
                if (coverExistsMap[gridPath] !== true) {
                    coverExistsMap[gridPath] = true;
                    saveCoverExistsMap();
                }
            }
        };
    }

    var cacheKey = (fileToFetch === "01.webp") ? gridPath : lowResUrl;

    // ALWAYS check IndexedDB cache first for ALL images (Cover, Fallback, and Specific Cart Designs)
    getImageFromDB(cacheKey).then(function (blob) {
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

    // 2. Background Load High-Res Zoom Image (if applicable) — saved to IndexedDB for PDF speed
    if (zoomPath && zoomPath.trim() !== "" && zoomPath.toLowerCase() !== "none") {
        var encZoomPath = zoomPath.trim().replace(/\\/g, '/').split('/').map(encodeURIComponent).join('%2F');
        var highResUrl = fbBase + encZoomPath + "%2F" + encodeURIComponent(fileToFetch) + "?alt=media";

        // Check if already in IndexedDB before fetching
        getImageFromDB(highResUrl).then(function(existingBlob) {
            if (!existingBlob) {
                fetch(highResUrl)
                    .then(function(res) { return res.ok ? res.blob() : null; })
                    .then(function(blob) {
                        if (blob) {
                            saveImageToDB(highResUrl, blob);
                            imgElement.src = URL.createObjectURL(blob);
                        }
                    })
                    .catch(function() {});
            } else {
                imgElement.src = URL.createObjectURL(existingBlob);
            }
        }).catch(function() {
            var hdImage = new Image();
            hdImage.onload = function () { imgElement.src = highResUrl; };
            hdImage.src = highResUrl;
        });
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
    var els = document.querySelectorAll('.cart-badge-top, #cartCountHeader, #floatCartCount');
    els.forEach(e => e.innerText = count);
    var floatBtn = document.getElementById('placeOrderFloat');
    if (floatBtn) {
        floatBtn.style.display = count > 0 ? 'flex' : 'none';
    }
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
    
    getImageFromDB(url).then(async blob => {
        if (blob) {
            // Found ZOOM in cache!
            imgEl.src = URL.createObjectURL(blob);
            imgEl.dataset.loadedZoom = "true";
        } else {
            // Try to find the GRID image in cache using robust key resolution
            if (designGridUrl && window.findDesignKeyInCache) {
                var gridCacheKey = await window.findDesignKeyInCache(designGridUrl, fileName);
                if (gridCacheKey) {
                    var gridBlob = await getImageFromDB(gridCacheKey);
                    if (gridBlob && !imgEl.dataset.loadedZoom) {
                        imgEl.src = URL.createObjectURL(gridBlob);
                    }
                }
            }
            
            // Fetch high-res Zoom from network in background
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.blob();
                })
                .then(newBlob => {
                    saveImageToDB(url, newBlob);
                    var zoomObjectUrl = URL.createObjectURL(newBlob);
                    if (!imgEl.dataset.loadedZoom) {
                        imgEl.src = zoomObjectUrl;
                        imgEl.dataset.loadedZoom = "true";
                    }
                })
                .catch(err => {
                    // Fail silently if offline, grid image from cache remains visible
                });
        }
    });
}

function openDetail(productId, skipShow, keepSearchShown) {
    if (!skipShow) {
        cameFromDetail = false;

        // Always reset the product page's internal search UI when a new product is opened
        var dtInput = document.getElementById('dtSearchInput');
        var dtTitle = document.getElementById('dtNameTop');
        if (dtInput) {
            dtInput.style.display = 'none';
            dtInput.value = '';
        }
        if (dtTitle) dtTitle.style.display = 'block';

        var gridWrapper = document.getElementById('gridWrapper');
        if (gridWrapper && gridWrapper.parentNode !== document.getElementById('appBody')) {
            document.getElementById('appBody').appendChild(gridWrapper);
            gridWrapper.style.flex = "";
            gridWrapper.style.overflowY = "";
            gridWrapper.style.paddingBottom = "";
        }
        var detailPanel = document.getElementById('detailPanel');
        var slBody = detailPanel ? detailPanel.querySelector('.sl-body') : null;
        if (slBody) slBody.style.display = 'block';

        if (!keepSearchShown) {
            var input = document.getElementById('srchMainInput');
            var logo = document.getElementById('appLogoImg');
            if (input && input.style.display !== 'none') {
                input.style.display = 'none';
                input.value = '';
                if (logo) logo.style.display = 'block';
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
        var detailPanel = document.getElementById('detailPanel');
        var wasOpen = detailPanel && detailPanel.classList.contains('open');
        if (detailPanel) detailPanel.classList.add('open');

        if (!wasOpen) {
            pushHistoryState('detail');
        } else {
            // Already open, no need to push another identical state!
        }
    }

    var gridPath = p.gridUrl;
    var zoomPath = (p.zoomUrl && p.zoomUrl !== "None") ? p.zoomUrl : p.gridUrl;

    var cleanGridPath = gridPath ? String(gridPath).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/') : "";
    var cleanZoomPath = zoomPath && zoomPath !== "None" ? String(zoomPath).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/') : cleanGridPath;

    if (!cleanGridPath || cleanGridPath === "" || cleanGridPath.toLowerCase() === "none") {
        deck.innerHTML = '<div class="swipe-card" data-design="DIRECT"><img src="https://placehold.co/600x800/f0f0f0/a0a0a0?text=No+Image"></div>';
        return;
    }

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    // List files from Grid path (always has source images), then build Zoom URLs from filenames
    var prefix = cleanGridPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
    // delimiter=/ means only DIRECT children are returned, not recursive subfolders
    var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + prefix + "&delimiter=/";

    var renderedFilesJson = "";

    // 1. Render immediately if cached, otherwise wait for network
    window.lastRenderedDesignNames = "";
    
    // 2. Fetch actual folder files in background to update/upgrade the swipe deck
    function processFolderItems(items) {
        // Sync cover exists state from the actual directory items
        var coverFound = false;
        items.forEach(item => {
            var filename = item.name.substring(item.name.lastIndexOf('/') + 1).toLowerCase();
            if (/^(01|1|cover)\.(webp|jpg|jpeg|png)$/i.test(filename)) {
                coverFound = true;
            }
        });
        coverExistsMap[gridPath] = coverFound;
        saveCoverExistsMap();

        var validFiles = [];

        items.forEach(item => {
            var fullPath = item.name; // item.name is from Grid bucket
            var filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
            var lowerName = filename.toLowerCase();

            // Filter out cover images
            if (/^(cover)\.(webp|jpg|jpeg|png)$/i.test(lowerName)) {
                return;
            }

            var ext = lowerName.substring(lowerName.lastIndexOf('.'));
            var isVideo = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".3gp", ".ogg"].includes(ext);
            var isImage = [".webp", ".jpg", ".jpeg", ".png", ".gif"].includes(ext);

            if (isVideo || isImage) {
                // Grid path: item.name already IS the Grid path
                var gridEncName = fullPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
                // Zoom path: replace Grid folder prefix with Zoom folder prefix
                var zoomFullPath = fullPath.replace(cleanGridPath, cleanZoomPath);
                var zoomEncName = zoomFullPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');

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

        // 🛡️ SORT LATEST DESIGNS FIRST (DESCENDING NUMERICAL)
        validFiles.sort((a, b) => {
            var numA = parseInt(a.name.replace(/\D/g, ''));
            var numB = parseInt(b.name.replace(/\D/g, ''));
            if (isNaN(numA)) numA = 0;
            if (isNaN(numB)) numB = 0;
            return numB - numA;
        });

        if (validFiles.length > 0) {
            renderSwipeDeck(validFiles);

        } else {
            // Firebase Storage folder is empty: Clear fallback cards and show only the cover image
            var gridImgEl = document.getElementById("img_" + p.id);
            var coverSrc = (gridImgEl && gridImgEl.src && !gridImgEl.src.startsWith("data:")) ? gridImgEl.src : "";
            var fallbackGridUrl = "";
            var fallbackZoomUrl = "";
            if (p.gridUrl && p.gridUrl !== "None") {
                var encGridPath = cleanGridPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
                fallbackGridUrl = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/" + encGridPath + "%2F01.webp?alt=media";
                if (!coverSrc) coverSrc = fallbackGridUrl;
            }
            if (p.zoomUrl && p.zoomUrl !== "None") {
                var encZoomPath = cleanZoomPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
                fallbackZoomUrl = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/" + encZoomPath + "%2F01.webp?alt=media";
            } else {
                fallbackZoomUrl = fallbackGridUrl;
            }
            deck.innerHTML = `
            <div class="swipe-card" data-design="DIRECT" onclick="openFs('${p.id}', 0, 'Cover')">
                <img id="design_img_${p.id}_DIRECT" src="${coverSrc || ''}" data-loaded-zoom="false" style="width: 100%; object-fit: cover;">
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
            var imgEl = document.getElementById("design_img_" + p.id + "_DIRECT");
            if (imgEl && fallbackZoomUrl) {
                loadAndCacheDesignImage(imgEl, fallbackZoomUrl, fallbackGridUrl, p.id, 'Cover');
            }
        }
    }

    if (window.dsFolderCache && window.dsFolderCache[listUrl]) {
        processFolderItems(window.dsFolderCache[listUrl]);
    } else {
        fetch(listUrl)
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                var items = data.items || [];
                if (!window.dsFolderCache) window.dsFolderCache = {};
                window.dsFolderCache[listUrl] = items;
                try { localStorage.setItem("dsFolderCache", JSON.stringify(window.dsFolderCache)); } catch (e) { }
                processFolderItems(items);
            })
            .catch(err => {
                console.warn("Background folder list load failed", err);
                // 🛡️ OFFLINE FALLBACK: Generate dummy array from p.designs
                var fallbackItems = [];
                for (var i = 1; i <= totalCards; i++) {
                    var n = String(i);
                    if (n.length === 1) n = "0" + n;
                    fallbackItems.push({ name: listPrefix + n + ".webp" });
                }
                processFolderItems(fallbackItems);
            });
    }

    function renderSwipeDeck(files) {
        renderedFilesJson = JSON.stringify(files);
        window.lastRenderedDesignNames = files.map(f => String(f.name).toLowerCase()).join(',');

        var placeholderSVG = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="100%" height="100%" fill="#f9f9fa"/></svg>');

        var html = '';
        files.forEach((file, idx) => {
            var dKey = p.id + '_' + file.name;
            if (file.isVideo) {
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx}, '${file.name}')">
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
                var imgId = "design_img_" + p.id + "_" + idx;
                html += `
                <div class="swipe-card" onclick="openFs('${p.id}', ${idx}, '${file.name}')">
                    <img id="${imgId}" src="${placeholderSVG}" data-loaded-zoom="false">
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

    // Update design quantities summary in bottom row
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
        // Sort by design name naturally (e.g., D2, D3, D10)
        parts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        var displayParts = parts.map(p => p.name + '*' + p.qty);
        summaryEl.innerText = displayParts.length > 0 ? displayParts.join(' + ') : '';
    }
}

function closeDetail() {
    var panel = document.getElementById('detailPanel');
    if (panel) {
        panel.classList.remove('open');
        var videos = panel.querySelectorAll('video');
        videos.forEach(function (v) {
            v.pause();
        });
    }

    var dtTitle = document.getElementById('dtNameTop');
    var dtInput = document.getElementById('dtSearchInput');
    if (dtInput) {
        dtInput.style.display = 'none';
        dtInput.value = ''; // Just clear the local input box visuals, don't clear global doSearch so they can see results
    }
    if (dtTitle) dtTitle.style.display = 'block';

    var gridWrapper = document.getElementById('gridWrapper');
    if (gridWrapper && gridWrapper.parentNode !== document.getElementById('appBody')) {
        document.getElementById('appBody').appendChild(gridWrapper);
        gridWrapper.style.flex = "";
        gridWrapper.style.overflowY = "";
        gridWrapper.style.paddingBottom = "";
    }
    var slBody = panel ? panel.querySelector('.sl-body') : null;
    if (slBody) slBody.style.display = 'block';

    history.back(); // Standard browser back to trigger popstate
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

    // Pinch variables
    var initialPinchDistance = 0;
    var initialScale = 1;
    var isPinching = false;

    // Pan variables
    var startPanX = 0;
    var startPanY = 0;
    var isPanning = false;

    // Double tap variable
    var lastTapTime = 0;

    // Helper: calculate distance between two fingers
    function getDistance(t1, t2) {
        var dx = t1.clientX - t2.clientX;
        var dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Swipe navigation logic
    function handleSwipe(diffX) {
        var threshold = 50;
        if (Math.abs(diffX) > threshold) {
            if (diffX > 0) {
                // Swipe Right (Go to previous image)
                openFs(fsIndex - 1);
            } else {
                // Swipe Left (Go to next image)
                openFs(fsIndex + 1);
            }
        }
    }

    // Touch Start
    fsImg.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            // Potential pan, swipe, or double-tap
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
            // Pinch to zoom
            isPinching = true;
            isPanning = false;
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
            initialScale = fsScale;
        }
    }, { passive: true });

    // Touch Move
    fsImg.addEventListener('touchmove', function (e) {
        if (isPinching && e.touches.length === 2) {
            var newDistance = getDistance(e.touches[0], e.touches[1]);
            if (initialPinchDistance > 0) {
                var factor = newDistance / initialPinchDistance;
                fsScale = Math.max(1, Math.min(4, initialScale * factor));

                // If we zoom out to 1, reset offsets
                if (fsScale === 1) {
                    fsTranslateX = 0;
                    fsTranslateY = 0;
                }
                fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
            }
        } else if (isPanning && e.touches.length === 1 && fsScale > 1) {
            // Drag panning when zoomed
            fsTranslateX = e.touches[0].clientX - startPanX;
            fsTranslateY = e.touches[0].clientY - startPanY;

            // Constrain translation bounds based on scale
            var maxTranslateX = (fsScale - 1) * (fsImg.clientWidth / 2);
            var maxTranslateY = (fsScale - 1) * (fsImg.clientHeight / 2);
            fsTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, fsTranslateX));
            fsTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, fsTranslateY));

            fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
        }
    }, { passive: true });

    // Touch End
    fsImg.addEventListener('touchend', function (e) {
        if (isPinching) {
            isPinching = false;
        }
        if (isPanning) {
            isPanning = false;
        }

        // If it was a single finger and scale === 1, detect horizontal swipe
        if (e.touches.length === 0 && fsScale === 1) {
            var endX = e.changedTouches[0].clientX;
            var endY = e.changedTouches[0].clientY;
            var diffX = endX - startTouchX;
            var diffY = endY - startTouchY;

            // Ensure it is mostly horizontal swipe
            if (Math.abs(diffX) > Math.abs(diffY)) {
                handleSwipe(diffX);
            }
        }
    }, { passive: true });

    // Double Tap detection
    fsImg.addEventListener('click', function (e) {
        var now = new Date().getTime();
        var timespan = now - lastTapTime;
        if (timespan < 300 && timespan > 0) {
            // Double Tap!
            if (fsScale > 1) {
                // Reset zoom
                fsScale = 1;
                fsTranslateX = 0;
                fsTranslateY = 0;
            } else {
                // Zoom in to 2.5
                fsScale = 2.5;
                fsTranslateX = 0;
                fsTranslateY = 0;
            }
            fsImg.style.transition = 'transform 0.2s ease-out';
            fsImg.style.transform = `translate3d(${fsTranslateX}px, ${fsTranslateY}px, 0) scale(${fsScale})`;
            setTimeout(() => {
                fsImg.style.transition = '';
            }, 200);
            e.preventDefault();
        }
        lastTapTime = now;
    });
}

function openFs(arg1, arg2, arg3, arg4) {
    var pId, index, dId, cartImgSrc;
    if (arguments.length === 1 && typeof arg1 === 'number') {
        if (!curProduct) return;
        pId = curProduct.id; index = arg1;
    } else if (arguments.length === 4) {
        pId = arg1; index = arg2; dId = arg3; cartImgSrc = arg4;
    } else {
        pId = arg1; index = arg2; dId = arg3;
    }

    if (cartImgSrc) {
        var fsModal = document.getElementById('fsModal');
        var fsImg = document.getElementById('fsImg');
        var fsVideo = document.getElementById('fsVideo');
        if (fsVideo) fsVideo.style.display = 'none';
        
        fsImg.style.display = 'block';
        fsImg.src = cartImgSrc;
        fsImg.style.transition = '';
        fsImg.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        fsScale = 1; fsTranslateX = 0; fsTranslateY = 0;
        
        var pItem = allProducts.find(x => x.id === pId);
        document.getElementById('fsTitle').innerText = (pItem ? pItem.name : pId) + " - " + (dId === 'DIRECT' ? "Cover" : dId);
        
        var keyCart = pId + '_' + dId;
        document.getElementById('fsQty').innerText = cart[keyCart] ? cart[keyCart].qty : 0;
        
        document.querySelectorAll('.fs-nav').forEach(n => n.style.display = 'none');
        
        fsModal.style.display = 'flex';
        pushHistoryState('fs');
        return;
    }

    document.querySelectorAll('.fs-nav').forEach(n => n.style.display = 'block');

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
    document.getElementById('fsTitle').innerText = curProduct.name + " - " + dName + " (" + (fsIndex + 1) + "/" + cards.length + ")";

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
            fsImg.style.transition = '';
            fsImg.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
            fsScale = 1;
            fsTranslateX = 0;
            fsTranslateY = 0;
            
            var chosenSrc = imgEl ? imgEl.src : '';
            // If the swipe card is still showing the missing SVG placeholder, use the cart image
            if (chosenSrc.includes("data:image/svg+xml") && cartImgSrc) {
                chosenSrc = cartImgSrc;
            }
            fsImg.src = chosenSrc;
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

        var customerHTML = `
            <div style="margin-bottom: 20px; border: 1px solid var(--border); border-radius: 8px; overflow:hidden; background:#fff; display:flex; justify-content:space-between; align-items:center; padding:10px;">
                <div style="display:flex; flex-direction:column; gap:4px; max-width:85%;">
                    <div id="cartCustomerDetailsBody" style="font-size:14px; color:var(--text-main); font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        Loading...
                    </div>
                </div>
                <i class="fas fa-edit" onclick="openCustomerDetailsModal()" style="cursor:pointer; color:var(--myntra-pink); font-size:16px; padding:10px;"></i>
            </div>
        `;
        cHtml.push(customerHTML);

        window.cartEditingMap = window.cartEditingMap || {};
        for (var r in grouped) {
            var g = grouped[r];
            var pTot = 0;
            g.items.forEach(function (i) { pTot += (parseInt(i.qty) || 0); });
            var isEditing = window.cartEditingMap[g.p.id];

            cHtml.push('<div style="margin-bottom: 20px; border: 1px solid var(--border); border-radius: 8px; overflow:hidden;">');
            cHtml.push('<div style="background:#f5f5f6; padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">');
            cHtml.push('<div style="' + (!isEditing ? 'cursor:pointer;' : '') + ' flex:1;" ' + (!isEditing ? 'onclick="closeCart(true); setTimeout(()=>{openDetail(\'' + g.p.id + '\');},100);"' : '') + '>');
            cHtml.push('<div style="font-weight:bold; font-size:15px; color:var(--myntra-pink); text-decoration:underline;">' + safeText(g.p.name) + ' <i class="fas fa-external-link-alt" style="font-size:12px;"></i></div>');
            
            if (isEditing) {
                cHtml.push('<div style="font-size:12px; color:var(--text-light); margin-top:4px;">SKU: ' + safeText(g.p.sku) + 
                           ' | Rate: ₹<input type="number" id="ie_rate_' + g.p.id + '" value="' + g.p.price + '" style="width:60px; padding:2px 4px; border:1px solid #ccc; border-radius:4px; margin-right:4px;">' +
                           ' | Packing: <input type="text" id="ie_pack_' + g.p.id + '" value="' + safeText(g.p.packing || 1) + '" style="width:40px; padding:2px 4px; border:1px solid #ccc; border-radius:4px;"></div>');
                cHtml.push('</div>');
                cHtml.push('<i class="fas fa-check-circle" onclick="saveCartInlineEdit(\'' + g.p.id + '\')" style="cursor:pointer; color:green; font-size:22px; padding: 10px;" title="Save"></i>');
            } else {
                cHtml.push('<div style="font-size:12px; color:var(--text-light); margin-top:4px;">SKU: ' + safeText(g.p.sku) + ' | Rate: ₹' + g.p.price + ' | Packing: ' + safeText(g.p.packing) + ' | Total Qty: ' + pTot + ' pcs</div>');
                cHtml.push('</div>');
                cHtml.push('<i class="fas fa-edit" onclick="toggleCartInlineEdit(\'' + g.p.id + '\')" style="cursor:pointer; color:var(--myntra-pink); font-size:18px; padding: 10px;"></i>');
            }
            
            cHtml.push('</div><div style="display:flex; flex-wrap:wrap; gap:10px; padding:10px;">');

            g.items.forEach(function (item) {
                var safeDesignLabel = item.design || 'DIRECT';
                var dLabel = safeDesignLabel === 'DIRECT' ? 'Cover' : safeDesignLabel;
                var imgId = "cart_img_" + g.p.id + "_" + safeDesignLabel.replace(/[^a-zA-Z0-9]/g, '');

                var onClickAction = safeDesignLabel === 'DIRECT' ? 
                    "closeCart(true); setTimeout(()=>{openDetail('" + g.p.id + "');},100);" : 
                    "openCartFsFromCache('" + g.p.id + "', '" + safeDesignLabel + "', '" + g.p.gridUrl + "')";

                cHtml.push('<div style="width: 80px; text-align: center;" ' + (!isEditing ? 'onclick="' + onClickAction + '"' : '') + '>');
                cHtml.push('<img id="' + imgId + '" src="https://placehold.co/300x300/f0f0f0/a0a0a0?text=..." style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); ' + (!isEditing ? 'cursor: pointer;' : '') + '">');
                cHtml.push('<div style="font-size: 11px; margin-top: 4px; color:var(--text-light);">' + dLabel + '</div>');
                
                if (isEditing) {
                    cHtml.push('<input type="number" id="ie_qty_' + g.p.id + '_' + safeDesignLabel + '" value="' + (item.qty || 0) + '" style="width:60px; padding:4px; border:1px solid var(--myntra-pink); border-radius:4px; text-align:center; font-size:12px; font-weight:bold; color:var(--text-main); margin-top:2px;">');
                } else {
                    cHtml.push('<div style="font-size: 12px; font-weight: bold; color: var(--myntra-pink);">' + (item.qty || 0) + ' pcs</div>');
                }
                cHtml.push('</div>');
            });
            cHtml.push('</div></div>');
        }

        if (count === 0) {
            cb.innerHTML = '<div style="text-align:center; padding:40px 20px; color:var(--text-light); font-weight:bold;">Your Cart is empty.</div>';
        } else {
            cb.innerHTML = cHtml.join('');
            loadCartCustomerDetails();

            // Load Grid Images for Cart Items from IndexedDB cache directly
            setTimeout(() => {
                var bucket = "durga-sarees.firebasestorage.app";
                var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
                for (var r in grouped) {
                    (function(group) {
                        group.items.forEach(function (item) {
                            var safeDesignLabel = item.design || 'DIRECT';
                            var imgId = "cart_img_" + group.p.id + "_" + safeDesignLabel.replace(/[^a-zA-Z0-9]/g, '');
                            var imgEl = document.getElementById(imgId);
                            if (!imgEl || !group.p.gridUrl) return;

                            var cleanGrid = group.p.gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                            var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');

                            window.findDesignKeyInCache(group.p.gridUrl, safeDesignLabel).then(function(cacheKey) {
                                var fallbackSVG = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#999">Design Not Found</text></svg>');

                                if (!cacheKey) {
                                    // Not found in cache. Try network guess as a last resort!
                                    var cleanNum2 = safeDesignLabel.replace(/\D/g, '');
                                    if (cleanNum2.length === 1) cleanNum2 = "0" + cleanNum2;
                                    if (!cleanNum2) cleanNum2 = safeDesignLabel;
                                    var fallbackUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(cleanNum2 + ".webp") + "?alt=media";
                                    
                                    fetch(fallbackUrl).then(function(res) {
                                        if (res.ok) return res.blob();
                                        throw new Error('Network failed');
                                    }).then(function(blob) {
                                        imgEl.src = URL.createObjectURL(blob);
                                        saveImageToDB(fallbackUrl, blob); // Cache it for future!
                                    }).catch(function() {
                                        imgEl.src = fallbackSVG;
                                    });
                                    return;
                                }

                                getImageFromDB(cacheKey).then(function(blob) {
                                    if (blob) {
                                        imgEl.src = URL.createObjectURL(blob);
                                    } else {
                                        imgEl.src = fallbackSVG;
                                    }
                                }).catch(function() {
                                    imgEl.src = fallbackSVG;
                                });
                            });
                        });
                    })(grouped[r]);
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
// 📄 SAVE ORDER — GENERATES CART PDF (Lightning Fast from Cache)
// ====================================
function sendWhatsapp() {
    var keys = Object.keys(cart);
    if (keys.length === 0) return alert("Your cart is empty!");

    // Generate the cart PDF and share it natively
    if (typeof generateCartOrderPDF === 'function') {
        generateCartOrderPDF('share');
    } else {
        alert("PDF Engine not loaded!");
    }
}

// ====================================
// 💬 WHATSAPP TEXT ORDER (Legacy — PC & Mobile)
// ====================================
function sendWhatsappText() {
    var keys = Object.keys(cart);
    if (keys.length === 0) return alert("Your cart is empty!");

    var msg = "🛍️ *New Order from Durga Sarees App*\n\n";
    var totalQty = 0;
    var groups = {};

    for (var k in cart) {
        var item = cart[k];
        if (!item || !item.p) continue;
        if (!groups[item.p.id]) groups[item.p.id] = { p: item.p, items: [] };
        groups[item.p.id].items.push(item);
    }

    for (var r in groups) {
        var g = groups[r];
        msg += "🏷️ *" + g.p.name + "* (SKU: " + (g.p.sku || "-") + ")\n";
        g.items.forEach(function (item) {
            var dName = item.design === 'DIRECT' ? 'Cover' : item.design;
            msg += "  - " + dName + ": " + item.qty + " pcs\n";
            totalQty += (parseInt(item.qty) || 0);
        });
        msg += "\n";
    }
    msg += "📦 *Total Quantity:* " + totalQty + " pcs\n";
    msg += "🌐 www.durgasarees.com\n";

    var number = "919998232380";
    var encodedMsg = encodeURIComponent(msg);
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        window.open("whatsapp://send?phone=" + number + "&text=" + encodedMsg, '_blank');
    } else {
        window.open("https://web.whatsapp.com/send?phone=" + number + "&text=" + encodedMsg, '_blank');
    }
}

// Utilities are defined at the bottom of the file

function getExactFirebaseUrl(folderPath, dId) {
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/";
    var encPath = folderPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    var fileName = "01.webp";
    if (dId !== 'DIRECT' && dId !== 'Cover') {
        if (/\.(webp|jpg|jpeg|png)$/i.test(dId)) {
            fileName = dId;
        } else {
            var num = dId.replace(/\D/g, '');
            if (num.length === 1) num = "0" + num;
            if (num === "") num = dId;
            fileName = num + ".webp";
        }
    }
    return fbBase + encPath + "%2F" + encodeURIComponent(fileName) + "?alt=media";
}

// ====================================
// 📦 2. MODAL & SHARE LOGIC (MULTI-IMAGE UPGRADE)
// ====================================
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
        var onPopState = function() {
            if (!resolved) {
                resolved = true;
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
                window.removeEventListener('popstate', onPopState);
                resolve(null);
            }
        };
        window.addEventListener('popstate', onPopState);

        var close = function(val) {
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
        btnCover.onclick = function() { close('cover'); };
        
        var btnReady = document.createElement('button');
        btnReady.innerText = 'With Ready Designs';
        btnReady.style.width = '100%'; btnReady.style.padding = '12px'; btnReady.style.marginBottom = '10px';
        btnReady.style.backgroundColor = '#333'; btnReady.style.color = '#fff';
        btnReady.style.border = 'none'; btnReady.style.borderRadius = '6px'; btnReady.style.fontSize = '14px';
        btnReady.onclick = function() { close('full'); };
        
        var btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancel';
        btnCancel.style.width = '100%'; btnCancel.style.padding = '12px';
        btnCancel.style.backgroundColor = '#eee'; btnCancel.style.color = '#333';
        btnCancel.style.border = 'none'; btnCancel.style.borderRadius = '6px'; btnCancel.style.fontSize = '14px';
        btnCancel.onclick = function() { close(null); };
        
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
            
            var dArr = (shareType === 'full' && fp.ready) ? String(fp.ready).split(',').map(d => d.trim()).filter(d => d) : [];
            if (dArr.length > 0) {
                for (var j = 0; j < dArr.length; j++) {
                    allHighResUrls.push(getExactFirebaseUrl(folderPath, dArr[j]));
                }
            } else {
                // Cover mode: Use dsFallbackMap first, then ready designs, then DIRECT
                var fallbackFile = dsFallbackMap[fp.gridUrl] || dsFallbackMap[fp.zoomUrl];
                var readyDesigns = (fp.ready) ? String(fp.ready).split(',').map(d => d.trim()).filter(d => d) : [];
                var coverDesignId = 'DIRECT';
                
                if (fallbackFile) {
                    coverDesignId = fallbackFile;
                } else if (readyDesigns.length > 0) {
                    coverDesignId = readyDesigns[0];
                }
                
                allHighResUrls.push(getExactFirebaseUrl(folderPath, coverDesignId));
            }
        }

        if (action === 'images') {
            if (allHighResUrls.length > 30) {
                alert("WhatsApp limit is 30 images. You are trying to share " + allHighResUrls.length + " images.\nPlease un-favorite some products or share as a PDF instead.");
                return;
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
    var dArr = (shareType === 'full' && curProduct.ready) ? String(curProduct.ready).split(',').map(d => d.trim()).filter(d => d) : [];
    
    if (dArr.length > 0) {
        for (var j = 0; j < dArr.length; j++) {
            highResUrls.push(getExactFirebaseUrl(folderPath, dArr[j]));
        }
    } else {
        // Cover mode: Use dsFallbackMap first, then ready designs, then DIRECT
        var dsFallbackMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
        var fallbackFile = dsFallbackMap[curProduct.gridUrl] || dsFallbackMap[curProduct.zoomUrl];
        var readyDesigns = (curProduct.ready) ? String(curProduct.ready).split(',').map(d => d.trim()).filter(d => d) : [];
        var coverDesignId = 'DIRECT';
        
        if (fallbackFile) {
            coverDesignId = fallbackFile;
        } else if (readyDesigns.length > 0) {
            coverDesignId = readyDesigns[0];
        }
        
        highResUrls.push(getExactFirebaseUrl(folderPath, coverDesignId));
    }

    if (highResUrls.length === 0) {
        alert("Images are still loading. Please wait a second.");
        return;
    }

    if (action === 'images') {
        if (highResUrls.length > 30) {
            alert("WhatsApp limit is 30 images. You are trying to share " + highResUrls.length + " images. Please share as PDF.");
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

window.openCartFs = function (productId, designId, cartImgSrc) {
    var actualProductId = curProduct ? curProduct.id : productId;
    // Open full screen viewer instantly with the clicked cart image
    openFs(actualProductId, 0, designId, cartImgSrc);
};

// 🚀 Cart fullscreen: loads image from IndexedDB using exact cache key, then opens FS
window.openCartFsFromCache = function (productId, designId, gridUrl) {
    var pItem = allProducts.find(x => x.id === productId);
    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

    var cleanGrid = gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
    var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');

    function showInFullscreen(src) {
        var fsModal = document.getElementById('fsModal');
        var fsImg = document.getElementById('fsImg');
        var fsVideo = document.getElementById('fsVideo');
        if (fsVideo) fsVideo.style.display = 'none';
        fsImg.style.display = 'block';
        fsImg.src = src;
        fsImg.style.transition = '';
        fsImg.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        fsScale = 1; fsTranslateX = 0; fsTranslateY = 0;
        document.getElementById('fsTitle').innerText = (pItem ? pItem.name : productId) + " - " + (designId === 'DIRECT' ? "Cover" : designId);
        var keyCart = productId + '_' + designId;
        document.getElementById('fsQty').innerText = cart[keyCart] ? cart[keyCart].qty : 0;
        document.querySelectorAll('.fs-nav').forEach(n => n.style.display = 'none');
        fsModal.style.display = 'flex';
        pushHistoryState('fs');
    }

    window.findDesignKeyInCache(gridUrl, designId).then(async function(gridCacheKey) {
        var blobToUse = null;

        // Try Zoom cache first
        if (gridCacheKey && pItem && pItem.zoomUrl && pItem.zoomUrl !== "None") {
            var cleanZoom = pItem.zoomUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
            var encZoomPath = cleanZoom.split('/').map(s => encodeURIComponent(s)).join('%2F');
            var zoomCacheKey = gridCacheKey.replace(encGridPath, encZoomPath);
            blobToUse = await getImageFromDB(zoomCacheKey);
        }

        // Try Grid cache if zoom isn't found
        if (!blobToUse && gridCacheKey) {
            blobToUse = await getImageFromDB(gridCacheKey);
        }

        if (blobToUse) {
            showInFullscreen(URL.createObjectURL(blobToUse));
        } else {
            // Fallback to Network if completely missing from cache
            var cleanNum2 = designId.replace(/\D/g, '');
            if (cleanNum2.length === 1) cleanNum2 = "0" + cleanNum2;
            if (!cleanNum2) cleanNum2 = designId;
            var fallbackUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(cleanNum2 + ".webp") + "?alt=media";
            
            fetch(fallbackUrl).then(function(res) {
                if (res.ok) return res.blob();
                throw new Error('Network failed');
            }).then(function(blob) {
                showInFullscreen(URL.createObjectURL(blob));
                saveImageToDB(fallbackUrl, blob); // Cache it for future!
            }).catch(function() {
                showInFullscreen("https://placehold.co/600x800/f0f0f0/a0a0a0?text=Not+Synced");
            });
        }
    });
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
window.isSyncing = false;
async function syncImages() {
    var bootScreen = document.getElementById('boot');
    var bootMsg = document.getElementById('bootMsg');
    var syncIcon = document.querySelector('.fa-sync-alt');

    if (window.isSyncing) {
        if (bootScreen) bootScreen.style.display = 'flex';
        return;
    }

    window.isSyncing = true;
    if (syncIcon) syncIcon.classList.add('fa-spin');

    // Reset per-sync caches
    coverExistsMap = {};
    try { localStorage.removeItem("dsCoverExists"); } catch (e) { }
    window.dsFolderCache = {};
    try { localStorage.removeItem("dsFolderCache"); } catch (e) { }
    window.syncReportResults = [];

    if (bootMsg) bootMsg.innerText = "Fetching latest product list...";

    try {
        const res = await fetch(FIRESTORE_PRODUCTS_URL);
        const data = await res.json();
        var docs = data.documents || [];

        var productsToSync = [];
        docs.forEach(d => {
            var f = d.fields || {};
            var name    = f.name    ? f.name.stringValue    : "";
            var gridUrl = f.gridUrl ? f.gridUrl.stringValue : "";
            var isWix = JSON.stringify(f).toLowerCase().includes("wix import");
            if (name && name.toLowerCase() !== "temp" && name.toLowerCase() !== "unnamed"
                && !isWix && gridUrl && gridUrl.trim() !== "" && gridUrl.toLowerCase() !== "none") {
                productsToSync.push({ name, gridUrl });
            }
        });

        if (productsToSync.length === 0) {
            window.isSyncing = false;
            if (syncIcon) syncIcon.classList.remove('fa-spin');
            if (bootScreen) bootScreen.style.display = 'none';
            alert("No products found to sync.");
            initApp();
            return;
        }

        var total    = productsToSync.length;
        var count    = 0;
        var failed   = 0;
        var failedList = [];
        var bucket   = "durga-sarees.firebasestorage.app";
        var fbBase   = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

        if (bootMsg) bootMsg.innerText = "Smart syncing 0 / " + total + "...";

        // Batch of 8 in parallel
        var batchSize = 8;
        for (var i = 0; i < productsToSync.length; i += batchSize) {
            var batch = productsToSync.slice(i, i + batchSize);
            await Promise.all(batch.map(async (p) => {
                var cleanGrid  = p.gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');
                var listPrefix  = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('/') + '/';
                var listUrl     = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";
                var lastFailReason = "";
                var downloaded = false;

                // ── 1. Fetch Firebase folder listing ──────────────────────────
                var folderFiles = []; // filenames only (e.g. "01.webp", "02.webp")
                var listSuccess = false;
                try {
                    const ctrl = new AbortController();
                    const tid  = setTimeout(() => ctrl.abort(), 15000);
                    var listRes = await fetch(listUrl, { signal: ctrl.signal });
                    clearTimeout(tid);
                    if (listRes.ok) {
                        var listData  = await listRes.json();
                        if (!window.dsFolderCache) window.dsFolderCache = {};
                        window.dsFolderCache[listUrl] = listData.items || [];
                        try { localStorage.setItem("dsFolderCache", JSON.stringify(window.dsFolderCache)); } catch (e) { }
                        
                        folderFiles   = (listData.items || [])
                            .map(item => item.name.substring(item.name.lastIndexOf('/') + 1))
                            .filter(f  => /\.(webp|jpg|jpeg|png)$/i.test(f));
                        listSuccess = true;
                    } else {
                        lastFailReason = "List HTTP " + listRes.status;
                    }
                } catch(e) {
                    lastFailReason = "List failed: " + (e.name === 'AbortError' ? 'Timeout (15s)' : e.message);
                }

                if (!listSuccess) {
                    // Offline / error — keep existing cache, log error
                    var existingCover = await getImageFromDB(p.gridUrl);
                    if (existingCover) downloaded = true;
                    else lastFailReason = lastFailReason || "Offline & no local cache";

                } else if (folderFiles.length === 0) {
                    // Firebase folder is EMPTY — keep existing cover, do NOT delete
                    downloaded = true;
                    console.log("[SYNC] Folder empty for", p.name, "- keeping cached cover.");

                } else {
                    // Sort files: 01.webp first, then 02, 03...
                    folderFiles.sort((a, b) =>
                        (parseInt(a.replace(/\D/g,'')) || 999) - (parseInt(b.replace(/\D/g,'')) || 999));

                    // Build the full Firebase URL keys that should exist in DB
                    // Cover = first file, key stored as gridUrl (bare folder path)
                    // Designs = each file, key stored as full Firebase URL
                    var coverFile  = folderFiles[0];
                    var coverUrl   = fbBase + encGridPath + "%2F" + encodeURIComponent(coverFile) + "?alt=media";
                    var designKeys = {}; // key → url map for all files
                    folderFiles.forEach(f => {
                        var key = fbBase + encGridPath + "%2F" + encodeURIComponent(f) + "?alt=media";
                        designKeys[key] = key;
                    });

                    // ── 2. Cleanup: Delete from DB keys NOT in Firebase anymore ──
                    // Scan DB for all keys that belong to this product's folder
                    var dbKeyPrefix = fbBase + encGridPath + "%2F";
                    var cachedKeys  = await listDBKeysForPrefix(dbKeyPrefix);
                    for (var ck of cachedKeys) {
                        if (!designKeys[ck]) {
                            await deleteImageFromDB(ck);
                            console.log("[SYNC] Deleted stale cache:", ck);
                        }
                    }

                    // ── 3. Download cover → store under gridUrl key ──────────
                    try {
                        const ctrl2 = new AbortController();
                        const tid2  = setTimeout(() => ctrl2.abort(), 30000);
                        var coverRes = await fetch(coverUrl, { signal: ctrl2.signal });
                        clearTimeout(tid2);
                        if (coverRes.ok) {
                            var coverBlob = await coverRes.blob();
                            await saveImageToDB(p.gridUrl, coverBlob); // key = folder path string
                            downloaded = true;
                        } else {
                            lastFailReason = "Cover HTTP " + coverRes.status;
                        }
                    } catch(e) {
                        lastFailReason = "Cover fetch: " + (e.name === 'AbortError' ? 'Timeout (30s)' : e.message);
                    }

                    // ── 4. Download remaining design files if not already cached ──
                    if (downloaded) {
                        for (var fi = 0; fi < folderFiles.length; fi++) {
                            var fname    = folderFiles[fi];
                            if (fname === coverFile) continue; // already downloaded above
                            var designUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(fname) + "?alt=media";
                            var existing  = await getImageFromDB(designUrl);
                            if (existing) continue; // already in cache
                            try {
                                const ctrl3 = new AbortController();
                                const tid3  = setTimeout(() => ctrl3.abort(), 30000);
                                var dRes = await fetch(designUrl, { signal: ctrl3.signal });
                                clearTimeout(tid3);
                                if (dRes.ok) {
                                    await saveImageToDB(designUrl, await dRes.blob());
                                }
                            } catch(e) {
                                console.warn("[SYNC] Design fetch failed:", fname, e.message);
                            }
                        }
                    }
                }

                // ── 5. Track errors ───────────────────────────────────────────
                if (!downloaded) {
                    failed++;
                    failedList.push({ name: p.name, path: p.gridUrl, reason: lastFailReason });
                    console.error("❌ SYNC FAILED:", p.name, "|", lastFailReason);
                    if (!window.syncReportResults) window.syncReportResults = [];
                    var syncErrKey = p.gridUrl;
                    var existing2  = window.syncReportResults.find(r => r._gridUrl === syncErrKey);
                    if (existing2) {
                        existing2.error  = "Sync Failed: " + lastFailReason;
                        existing2.status = 'error';
                    } else {
                        window.syncReportResults.push({
                            id: null, _gridUrl: syncErrKey,
                            name: p.name, sku: p.sku || '-',
                            error: "Sync Failed: " + lastFailReason,
                            imageCount: 0, status: 'error'
                        });
                    }
                }

                count++;
            }));

            if (bootMsg) bootMsg.innerText = "Smart syncing " + count + " / " + total + "...";
        }

        if (bootScreen) bootScreen.style.display = 'none';
        window.isSyncing = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');

        if (failed > 0) {
            var failMsg = "Sync done: " + (total - failed) + " OK, " + failed + " failed.\n\nFailed:\n";
            failedList.slice(0, 15).forEach(f => {
                failMsg += "\n• " + f.name + "  [" + f.reason + "]";
            });
            if (failedList.length > 15) failMsg += "\n...and " + (failedList.length - 15) + " more.";
            console.table(failedList);
            alert(failMsg);
        } else {
            alert("✅ Sync complete! All " + total + " products synced.");
        }

        initApp();

    } catch (err) {
        window.isSyncing = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');
        if (bootScreen) bootScreen.style.display = 'none';
        alert("Sync error: " + err.message);
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
    updateAndroidBackState();
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

    var detailPanel = document.getElementById('detailPanel');
    var gridWrapper = document.getElementById('gridWrapper');
    var slBody = detailPanel ? detailPanel.querySelector('.sl-body') : null;
    var dtSearchInput = document.getElementById('dtSearchInput');

    if (detailPanel && detailPanel.classList.contains('open') && dtSearchInput && dtSearchInput.style.display !== 'none' && val.trim() !== '') {
        if (slBody) slBody.style.display = 'none';
        if (gridWrapper.parentNode !== detailPanel) {
            detailPanel.insertBefore(gridWrapper, document.getElementById('detailBottomRow'));
            gridWrapper.style.flex = "1";
            gridWrapper.style.overflowY = "auto";
            gridWrapper.style.paddingBottom = "100px";
        }
    } else {
        if (slBody) slBody.style.display = 'block';
        if (gridWrapper && gridWrapper.parentNode !== document.getElementById('appBody')) {
            document.getElementById('appBody').appendChild(gridWrapper);
            gridWrapper.style.flex = "";
            gridWrapper.style.overflowY = "";
            gridWrapper.style.paddingBottom = "";
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
    var input = document.getElementById('srchMainInput');
    if (input) {
        if (input.style.display === 'none' || input.style.display === '') {
            pushHistoryState('search');
            applyModalState('search');
        } else {
            history.back(); // This will trigger popstate which closes search
        }
    }
};

window.toggleDetailSearch = function () {
    var title = document.getElementById('dtNameTop');
    var input = document.getElementById('dtSearchInput');
    if (input.style.display === 'none') {
        title.style.display = 'none';
        input.style.display = 'block';
        input.focus();
    } else {
        input.style.display = 'none';
        title.style.display = 'block';
        input.value = '';
        doSearch('');
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
        if (query === "" && activeCategories.length > 0) {
            if (!activeCategories.includes(p.cat)) return false;
        }

        // 3. Price
        if (query === "" && activePriceFilters.length > 0) {
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
        if (query === "" && showOnlyFavs) {
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
        if (fsModal) {
            fsModal.style.display = 'none';
            var fsVideo = document.getElementById('fsVideo');
            if (fsVideo) {
                fsVideo.pause();
            }
        }
    }

    // 2. Sync Detail Panel
    if (modal === 'detail' || modal === 'fs') {
        if (detailPanel && !detailPanel.classList.contains('open')) {
            detailPanel.classList.add('open');
        }
    } else {
        if (detailPanel) {
            detailPanel.classList.remove('open');
            var videos = detailPanel.querySelectorAll('video');
            videos.forEach(function (v) {
                v.pause();
            });
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

    // 4. Sync Search
    var input = document.getElementById('srchMainInput');
    var logo = document.getElementById('appLogoImg');
    if (modal === 'search') {
        if (input && input.style.display !== 'block') {
            if (logo) logo.style.display = 'none';
            input.style.display = 'block';
            input.focus();
        }
    } else {
        if (input && input.style.display === 'block') {
            input.style.display = 'none';
            if (logo) logo.style.display = 'block';
            input.value = '';
            doSearch('');
        }
    }

    // 5. Sync Action Modals (categoryModal, sortModal, filterModal, shareModal, waModal)
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
    updateAndroidBackState();
});

function updateAndroidBackState() {
    try {
        var detailPanel = document.getElementById('detailPanel');
        var cartPanel = document.getElementById('cartPanel');
        var fsModal = document.getElementById('fsModal');

        var hasOpenModal = false;

        if (detailPanel && detailPanel.classList.contains('open')) {
            hasOpenModal = true;
        } else if (cartPanel && cartPanel.classList.contains('open')) {
            hasOpenModal = true;
        } else if (fsModal && fsModal.style.display === 'flex') {
            hasOpenModal = true;
        } else {
            var actionModals = document.querySelectorAll('.action-modal');
            for (var i = 0; i < actionModals.length; i++) {
                if (actionModals[i].style.display === 'flex') {
                    hasOpenModal = true;
                    break;
                }
            }
        }

        var input = document.getElementById('srchMainInput');
        if (input && input.style.display === 'block') {
            hasOpenModal = true;
        }

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AndroidBackBridge) {
            window.Capacitor.Plugins.AndroidBackBridge.setCanGoBack({ canGoBack: hasOpenModal });
        }
    } catch (e) {
        console.error("Error updating Android bridge back state:", e);
    }
}

// Sync back state on initial script load
updateAndroidBackState();

function toggleHdrMenu() {
    var menu = document.getElementById('hdrMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

async function logout() {
    if (typeof toggleHdrMenu === 'function') toggleHdrMenu();
    if (!confirm('Are you sure you want to logout?')) return;
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            if (window.CapacitorFirebaseAuthentication) {
                await window.CapacitorFirebaseAuthentication.signOut();
            }
        } else {
            if (typeof firebase !== 'undefined') {
                await firebase.auth().signOut();
            }
        }
        localStorage.removeItem('dsUserToken');
        document.getElementById("appBody").style.display = "none";
        document.getElementById("loginScreen").style.display = "flex";
        document.getElementById("loginBoxPhone").style.display = "block";
        document.getElementById("loginBoxOtp").style.display = "none";
        document.getElementById("lPhone").value = "";
    } catch (err) {
        console.error("Logout failed", err);
        alert("Logout failed: " + err.message);
    }
}

// ====================================
// 🛒 CART CUSTOMER DETAILS & EDIT MODALS
// ====================================

var _currentEditProductId = null;

async function fetchCustomerDetailsFromDB() {
    if (!activeUser) return null;
    try {
        var token = "";
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            token = await firebase.auth().currentUser.getIdToken();
        }
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        var query = {
            structuredQuery: {
                from: [{ collectionId: "Users" }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: "phone" },
                        op: "EQUAL",
                        value: { stringValue: activeUser }
                    }
                },
                limit: 1
            }
        };
        var res = await fetch("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents:runQuery", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(query)
        });
        var data = await res.json();
        if (data && data.length > 0 && data[0].document) {
            var f = data[0].document.fields;
            var d = {
                name: f.name ? f.name.stringValue : "",
                firm: f.firm ? f.firm.stringValue : "",
                station: f.station ? f.station.stringValue : "",
                state: f.state ? f.state.stringValue : "",
                phone: f.phone ? f.phone.stringValue : "",
                docId: data[0].document.name.split('/').pop()
            };
            localStorage.setItem("dsCustomerDetails", JSON.stringify(d));
            return d;
        }
    } catch(e) { console.error(e); }
    return null;
}

function loadCartCustomerDetails() {
    var detailsBody = document.getElementById('cartCustomerDetailsBody');
    if (!detailsBody) return;
    
    var stored = localStorage.getItem("dsCustomerDetails");
    if (stored) {
        try {
            var d = JSON.parse(stored);
            renderCustomerDetails(d, detailsBody);
        } catch(e) {}
    } else {
        detailsBody.innerText = "Fetching details...";
        fetchCustomerDetailsFromDB().then(d => {
            if (d) {
                renderCustomerDetails(d, detailsBody);
            } else {
                detailsBody.innerHTML = "<i>No details found. Please edit.</i>";
            }
        });
    }
}

function renderCustomerDetails(d, container) {
    if(!container) return;
    var primaryName = d.firm ? d.firm : d.name;
    var html = esc(primaryName) + (d.station ? ", " + esc(d.station) : "");
    container.innerHTML = html;
}

async function openCustomerDetailsModal() {
    var d = null;
    var stored = localStorage.getItem("dsCustomerDetails");
    if (stored) {
        try { d = JSON.parse(stored); } catch(e) {}
    }
    if (!d) {
        d = await fetchCustomerDetailsFromDB();
    }
    
    document.getElementById('cdName').value = d ? d.name : "";
    document.getElementById('cdFirm').value = d ? d.firm : "";
    document.getElementById('cdPhone').value = (d && d.phone) ? d.phone : (activeUser || "");
    document.getElementById('cdStation').value = d ? d.station : "";
    document.getElementById('cdState').value = d ? d.state : "";
    document.getElementById('cdErr').innerText = "";
    
    openModal('customerDetailsModal');
}

async function saveCustomerDetails() {
    var btn = document.getElementById('btnSaveCustomerDetails');
    var err = document.getElementById('cdErr');
    var name = document.getElementById('cdName').value.trim();
    var firm = document.getElementById('cdFirm').value.trim();
    var phone = document.getElementById('cdPhone').value.trim() || activeUser;
    var station = document.getElementById('cdStation').value.trim();
    var state = document.getElementById('cdState').value.trim();
    
    if(!name || !station || !state) {
        err.innerText = "Please fill all required fields.";
        return;
    }
    
    btn.innerText = "Saving...";
    var d = { name: name, firm: firm, phone: phone, station: station, state: state };
    var stored = localStorage.getItem("dsCustomerDetails");
    var docId = null;
    if (stored) {
        try { docId = JSON.parse(stored).docId; } catch(e) {}
    }
    if(docId) d.docId = docId;
    
    // Save locally immediately for fast UI
    localStorage.setItem("dsCustomerDetails", JSON.stringify(d));
    loadCartCustomerDetails();
    
    // Save to Firestore
    try {
        var token = "";
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            token = await firebase.auth().currentUser.getIdToken();
        }
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        var doc = {
            fields: {
                name: { stringValue: name },
                firm: { stringValue: firm },
                station: { stringValue: station },
                state: { stringValue: state },
                phone: { stringValue: phone }
            }
        };
        
        if (docId) {
            // Update existing
            await fetch("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users/" + docId + "?updateMask.fieldPaths=name&updateMask.fieldPaths=firm&updateMask.fieldPaths=station&updateMask.fieldPaths=state&updateMask.fieldPaths=phone", {
                method: "PATCH",
                headers: headers,
                body: JSON.stringify(doc)
            });
        } else {
            // Create new
            doc.fields.createdAt = { timestampValue: new Date().toISOString() };
            var res = await fetch("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users", {
                method: "POST",
                headers: headers,
                body: JSON.stringify(doc)
            });
            var data = await res.json();
            if(data.name) {
                d.docId = data.name.split('/').pop();
                localStorage.setItem("dsCustomerDetails", JSON.stringify(d));
            }
        }
    } catch(e) { console.error("Firestore save err", e); }
    
    btn.innerText = "SAVE DETAILS";
    closeModals();
}

function toggleCartInlineEdit(productId) {
    window.cartEditingMap = window.cartEditingMap || {};
    window.cartEditingMap[productId] = true;
    openCart(); // Re-render to show input fields
}

function saveCartInlineEdit(productId) {
    var rateInput = document.getElementById('ie_rate_' + productId);
    var packInput = document.getElementById('ie_pack_' + productId);
    
    var newRate = rateInput ? parseInt(rateInput.value) || 0 : 0;
    var newPacking = packInput ? packInput.value.trim() || "1" : "1";
    
    var items = [];
    for (var k in cart) {
        if (cart[k].p && cart[k].p.id === productId) {
            items.push(cart[k]);
        }
    }
    
    items.forEach(item => {
        var safeDesignLabel = item.design || 'DIRECT';
        var qtyInput = document.getElementById('ie_qty_' + productId + '_' + safeDesignLabel);
        if (qtyInput) {
            var newQty = parseInt(qtyInput.value) || 0;
            if (newQty <= 0) {
                delete cart[productId + "_" + item.design];
            } else {
                item.qty = newQty;
                item.p.price = newRate;
                item.p.packing = newPacking;
                cart[productId + "_" + item.design] = item;
            }
        }
    });
    
    // Save to edited memory so changes persist across cart wipes?
    if (items.length > 0) {
        var edited = {};
        try { edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {}; } catch(e){}
        edited[items[0].p.name] = { price: newRate, packing: newPacking };
        localStorage.setItem("dsEditedProducts", JSON.stringify(edited));
    }
    
    var matchP = allProducts.find(x => x.id === productId);
    if(matchP) {
        matchP.price = newRate;
        matchP.packing = newPacking;
    }
    
    localStorage.setItem("dsCart", JSON.stringify(cart));
    
    window.cartEditingMap[productId] = false;
    openCart(); // Re-render to show updated static text
}

// ====================================
// 🔍 SYNC REPORT LOGIC
// ====================================

function openSyncReportModal() {
    closeModals();
    openModal('syncReportModal');
    if (!window.syncReportResults || window.syncReportResults.length === 0) {
        document.getElementById('syncReportBody').innerHTML = '';
        document.getElementById('syncReportStatus').innerText = 'Ready to scan.';
        document.getElementById('syncReportProgress').style.display = 'none';
        document.getElementById('btnRunSyncReport').disabled = false;
        document.getElementById('chkShowCompletedSync').checked = false;
    } else {
        // Resolve any entries whose id was null (sync happened before allProducts loaded)
        if (window.allProducts && window.allProducts.length > 0) {
            window.syncReportResults.forEach(function(r) {
                if (!r.id && r._gridUrl) {
                    var pMatch = window.allProducts.find(x => x.gridUrl === r._gridUrl);
                    if (pMatch) {
                        r.id = pMatch.id;
                        r.sku = pMatch.sku || '-';
                    }
                }
            });
        }
        document.getElementById('syncReportStatus').innerText = 'Showing last sync errors (' + window.syncReportResults.filter(r => r.status === 'error').length + ' errors). Run report for full scan.';
        renderSyncReportPartial();
    }
}

window.syncReportResults = [];

async function runSyncReport() {
    var btn = document.getElementById('btnRunSyncReport');
    var status = document.getElementById('syncReportStatus');
    var bar = document.getElementById('syncReportBar');
    var progress = document.getElementById('syncReportProgress');
    
    btn.disabled = true;
    progress.style.display = 'block';
    bar.style.width = '0%';
    window.syncReportResults = [];
    
    var productsToScan = window.allProducts.filter(p => p.gridUrl && p.gridUrl !== "None");
    var total = productsToScan.length;
    
    if (total === 0) {
        status.innerText = "No products found to scan.";
        btn.disabled = false;
        return;
    }
    
    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=";
    
    for (var i = 0; i < total; i++) {
        var p = productsToScan[i];
        bar.style.width = ((i / total) * 100) + '%';
        status.innerText = "Scanning " + (i+1) + " of " + total + ": " + p.name;
        
        var cleanGridPath = String(p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
        var listUrl = fbBase + cleanGridPath + "&delimiter=/";
        
        var result = {
            id: p.id,
            name: p.name,
            sku: p.sku || '-',
            error: null,
            imageCount: 0,
            status: 'completed'
        };
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            var res = await fetch(listUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                result.error = "HTTP Error " + res.status;
                result.status = 'error';
            } else {
                var data = await res.json();
                var items = data.items || [];
                var imgCount = items.filter(it => /\.(webp|jpg|jpeg|png)$/i.test(it.name)).length;
                result.imageCount = imgCount;
                if (imgCount === 0) {
                    result.error = "Empty folder / No images found";
                    result.status = 'error';
                }
            }
        } catch(e) {
            result.error = "Failed: " + (e.name === 'AbortError' ? 'Connection Timeout (15s)' : e.message);
            result.status = 'error';
        }
        
        window.syncReportResults.push(result);
        renderSyncReportPartial();
    }
    
    bar.style.width = '100%';
    status.innerText = "Scan complete! Found " + window.syncReportResults.filter(r => r.status === 'error').length + " errors.";
    btn.disabled = false;
}

function renderSyncReportPartial() {
    var showCompleted = document.getElementById('chkShowCompletedSync').checked;
    var container = document.getElementById('syncReportBody');
    
    var html = '';
    var errorCount = 0;
    
    // Category Wise Tally
    var catTotals = {};
    for (var i = 0; i < window.syncReportResults.length; i++) {
        var r = window.syncReportResults[i];
        if (r.status === 'error') errorCount++;
        
        var pMatch = window.allProducts.find(p => p.id === r.id);
        var cat = (pMatch && pMatch.cat) ? pMatch.cat : 'Uncategorized';
        if (!catTotals[cat]) catTotals[cat] = { total: 0, error: 0, ok: 0, images: 0 };
        catTotals[cat].total++;
        if (r.status === 'error') catTotals[cat].error++;
        else {
            catTotals[cat].ok++;
            catTotals[cat].images += (r.imageCount || 0);
        }
    }
    
    var summaryHtml = '<div style="margin-bottom:15px; padding:10px; background:#e3f2fd; border:1px solid #bbdefb; border-radius:6px;">';
    summaryHtml += '<div style="font-weight:bold; color:#1565c0; margin-bottom:8px; font-size:14px;">Category Wise Tally</div>';
    for(var c in catTotals) {
        summaryHtml += `<div style="font-size:12px; color:#0d47a1; display:flex; justify-content:space-between; margin-bottom:4px; padding-bottom:4px; border-bottom:1px dashed #bbdefb;">
            <span><b>${c}</b></span>
            <span>Total: ${catTotals[c].total} | OK: ${catTotals[c].ok} | Err: ${catTotals[c].error} | Imgs: ${catTotals[c].images}</span>
        </div>`;
    }
    summaryHtml += '</div>';
    html += summaryHtml;
    
    for (var i = 0; i < window.syncReportResults.length; i++) {
        var r = window.syncReportResults[i];
        
        if (r.status === 'completed' && !showCompleted) continue;
        
        var bg = r.status === 'error' ? '#fff3f3' : '#f5fbf5';
        var border = r.status === 'error' ? '#ffcdd2' : '#c8e6c9';
        var iconColor = r.status === 'error' ? '#e53935' : '#4caf50';
        var iconCls = r.status === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle';
        
        html += `
        <div style="background:${bg}; border:1px solid ${border}; border-radius:6px; padding:10px; display:flex; align-items:flex-start; gap:10px;">
            <i class="fas ${iconCls}" style="color:${iconColor}; margin-top:2px;"></i>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:13px; color:var(--text-main);">${r.name}</div>
                <div style="font-size:11px; color:var(--text-light); margin-bottom:4px;">SKU: ${r.sku}</div>
                ${r.status === 'error' ? `<div style="font-size:12px; color:#c62828; font-weight:bold;">Error: ${r.error}</div>` : `<div style="font-size:12px; color:#2e7d32;">Found ${r.imageCount} images</div>`}
            </div>
        </div>
        `;
    }
    
    if (html === '' && window.syncReportResults.length > 0) {
        html = '<div style="text-align:center; padding:20px; color:var(--text-light); font-size:13px;">No errors to show!</div>';
    }
    
    container.innerHTML = html;
}

window.filterSyncReport = renderSyncReportPartial;
