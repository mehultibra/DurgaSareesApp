// ==========================================
// ðŸŒ¸ DURGA SAREES - FIXED APP.JS v3 (RESTORED UI)
// ==========================================

const FIRESTORE_PRODUCTS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products?pageSize=1000";
const FIRESTORE_USERS_URL = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Users?pageSize=100";

history.replaceState({ modal: 'main' }, '');

// --- ADMIN MODE GLOBALS ---
window.isAdminMode = false;
window.adminTapCount = 0;
window.isSuperAdmin = localStorage.getItem('dsIsAdmin') === 'true';
window.DS_APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx89H5yDUi-60Q2Rk12PH1TH34Nt-BncrMRhYSewu1LdLOj_GCWGKKz1Qmx2OmeGwlL/exec";

window.dsMissingImage = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="100%" height="100%" fill="#f5f5f6"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#6c757d">Image Error</text>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#adb5bd">Network or 404</text>
</svg>
`);

// --- ERROR LOGGING ---
window.globalErrorLog = JSON.parse(localStorage.getItem('dsGlobalErrors') || '[]');
window.logAppError = function (context, message) {
    window.globalErrorLog.push({ ts: new Date().getTime(), src: context, msg: message });
    if (window.globalErrorLog.length > 50) window.globalErrorLog.shift();
    setTimeout(() => localStorage.setItem('dsGlobalErrors', JSON.stringify(window.globalErrorLog)), 0);

    if (window.syncReportResults && window.syncReportResults.length > 0) {
        var parts = message.split(' | ');
        if (parts.length > 1) {
            var pName = parts[parts.length - 1].trim();
            var target = window.syncReportResults.find(r => r.name === pName);
            if (target) {
                target.status = 'error';
                target.error = (target.error ? target.error + ', ' : '') + context;
                if (typeof renderSyncReportPartial === 'function') {
                    renderSyncReportPartial();
                    var btnResync = document.getElementById('btnResyncErrors');
                    if (btnResync) btnResync.style.display = 'inline-block';
                }
            }
        }
    }
};

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
    s1.onload = function () {
        var s2 = document.createElement('script');
        s2.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
        s2.onload = function () {
            firebase.initializeApp(firebaseConfig);
            try {
                window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    'size': 'invisible'
                });
            } catch (e) { console.error(e); }
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

window.sessionImageCache = new Map();
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
                // Enable transparent status bar (overlaps webview)
                window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true });
                // Use light icons for the pink/red gradient background
                window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
            } catch (e) { }
        }



        // Header scroll effect
        var gridWrap = document.getElementById('gridWrapper');
        if (gridWrap) {
            gridWrap.addEventListener('scroll', function () {
                var hdr = document.querySelector('.hdr');
                if (!hdr) return;
                if (this.scrollTop > 20) {
                    hdr.style.backgroundColor = '#ffffff';
                    hdr.style.borderBottom = '1px solid #eee';
                } else {
                    hdr.style.backgroundColor = 'transparent';
                    hdr.style.borderBottom = 'none';
                }
            });
        }

        try { activeUser = localStorage.getItem("dsUserToken"); } catch (e) { }
        try { cart = JSON.parse(localStorage.getItem("dsCart")) || {}; } catch (e) { }
        try { favorites = JSON.parse(localStorage.getItem("dsFavs")) || {}; } catch (e) { }

        var loginScreen = document.getElementById('loginScreen');
        var appBody = document.getElementById('appBody');

        var logoImg = document.getElementById('appLogoImg');
        if (logoImg) {
            var tapTimeout = null;
            logoImg.addEventListener('click', function () {
                window.adminTapCount++;
                clearTimeout(tapTimeout);
                tapTimeout = setTimeout(() => { window.adminTapCount = 0; }, 1500);
                if (window.adminTapCount === 3) {
                    window.adminTapCount = 0;
                    if (window.isSuperAdmin) {
                        window.isAdminMode = !window.isAdminMode;
                        document.getElementById('appLogoImg').style.border = window.isAdminMode ? '2px solid red' : 'none';
                        document.getElementById('appLogoImg').style.borderRadius = '4px';
                        alert("Admin Mode: " + (window.isAdminMode ? "ON" : "OFF"));
                        if (typeof applyFilter === 'function') applyFilter();
                    } else {
                        alert("Access Denied: Not an Administrator.");
                    }
                }
            });
        }

        if (activeUser && activeUser !== "null" && activeUser !== "undefined") {
            if (loginScreen && appBody) {
                loginScreen.style.display = 'none';
                appBody.style.display = 'flex';
                checkAdminStatus(activeUser);
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

                        checkUserInFirestore(phoneStr).then(function (exists) {
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
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
            try { window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady(); } catch (e) { }
        }

        // Check for updates on ALL platforms (Native & Web)
        setTimeout(checkForOTAUpdates, 2000);
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
    } catch (e) {
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

        checkUserInFirestore(phoneStr).then(function (exists) {
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
    } catch (e) {
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
        if (err) err.innerText = "";
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
    } catch (e) {
        err.innerText = "Network error.";
        document.getElementById('btnSaveProfile').innerText = "SAVE & CONTINUE";
    }
}

async function checkAdminStatus(phone) {
    try {
        var query = {
            structuredQuery: {
                from: [{ collectionId: "Users" }],
                where: { fieldFilter: { field: { fieldPath: "phone" }, op: "EQUAL", value: { stringValue: phone } } },
                limit: 1
            }
        };
        // Securely route through fetchWithRetry to append authorization context
        var res = await window.fetchWithRetry("https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents:runQuery", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(query)
        });
        var data = await res.json();
        if (data && data.length > 0 && data[0].document) {
            var f = data[0].document.fields;
            if (f.isAdmin && f.isAdmin.booleanValue === true) {
                localStorage.setItem('dsIsAdmin', 'true');
                window.isSuperAdmin = true;
            } else {
                localStorage.setItem('dsIsAdmin', 'false');
                window.isSuperAdmin = false;
            }
        }
    } catch (e) {
        if (typeof window.logAppError === 'function') window.logAppError("checkAdminStatus", e.message);
    }
}

function completeLogin(phoneStr) {
    try { localStorage.setItem("dsUserToken", phoneStr); } catch (e) { }
    activeUser = phoneStr;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appBody').style.display = 'flex';
    checkAdminStatus(phoneStr);
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
    if (typeof window.processCameraOutbox === 'function') window.processCameraOutbox();

    function processProducts(docs) {
        var validCounter = 0;
        allProducts = [];

        docs.forEach(d => {
            var f = d.fields || {};
            var name = f.name ? f.name.stringValue : "";
            var isWix = JSON.stringify(f).toLowerCase().includes("wix import");

            if (name && name.toLowerCase() !== "temp" && name.toLowerCase() !== "unnamed" && !isWix) {
                var finalPrice = f.price ? (f.price.doubleValue || f.price.integerValue || 0) : 0;
                var finalPacking = f.packing ? (f.packing.stringValue || (f.packing.integerValue !== undefined ? String(f.packing.integerValue) : "") || (f.packing.doubleValue !== undefined ? String(f.packing.doubleValue) : "") || "1") : "1";

                // --- ADMIN & INVENTORY PARSING ---
                var actualDocId = d.name ? d.name.split('/').pop() : "";
                var stockMap = {};
                if (f.stock && f.stock.mapValue && f.stock.mapValue.fields) {
                    for (var k in f.stock.mapValue.fields) {
                        var vObj = f.stock.mapValue.fields[k];
                        stockMap[k] = parseInt(vObj.integerValue || vObj.doubleValue || vObj.stringValue || 0);
                    }
                }
                var tStock = 999;
                if (f.stock) {
                    var designKeys = Object.keys(stockMap).filter(k => k !== 'FULLY_PACKED');
                    var designSum = designKeys.reduce((a, k) => a + stockMap[k], 0);

                    if (designKeys.length > 0) {
                        tStock = designSum > 0 ? designSum : 0;
                    } else {
                        tStock = stockMap['FULLY_PACKED'] === 1 ? 0 : 999;
                    }
                }

                allProducts.push({
                    docId: actualDocId,
                    stock: stockMap,
                    totalStock: tStock,
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

    // ── STEP 1: Instantly render from cache (zero wait time) ──────────────
    var loadedFromCache = false;
    try {
        var cachedDocs = JSON.parse(localStorage.getItem("dsOfflineProducts"));
        if (cachedDocs && cachedDocs.length > 0) {
            if (bootScreen) bootScreen.style.display = 'none';
            processProducts(cachedDocs);
            loadedFromCache = true;
        }
    } catch (e) {}

    // Show boot screen only if we have nothing cached
    if (!loadedFromCache && bootScreen) bootScreen.style.display = 'flex';

    // ── STEP 2: Fetch fresh data in background with 5s timeout ────────────
    var fetchPromise = window.fetchWithRetry(FIRESTORE_PRODUCTS_URL, {}, 2);
    var timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Boot timeout")), 5000));

    Promise.race([fetchPromise, timeoutPromise])
        .then(res => res.json())
        .then(data => {
            var docs = data.documents || [];
            if (docs.length > 0) {
                // Only save to cache if we got valid data
                try { localStorage.setItem("dsOfflineProducts", JSON.stringify(docs)); } catch (e) {}
            }
            if (bootScreen) bootScreen.style.display = 'none';
            // Only re-render if we did NOT already render from cache (avoid double render)
            if (!loadedFromCache) {
                processProducts(docs);
            }
            setTimeout(() => syncImages(true), 2000);
        })
        .catch(err => {
            console.log("Offline or fetch failed:", err);
            if (bootScreen) bootScreen.style.display = 'none';
            // If we already rendered from cache, do nothing - grid is already showing
            if (!loadedFromCache) {
                try {
                    var cachedDocs2 = JSON.parse(localStorage.getItem("dsOfflineProducts"));
                    if (cachedDocs2 && cachedDocs2.length > 0) {
                        processProducts(cachedDocs2);
                        return;
                    }
                } catch (e) {}
                processProducts([]);
            }
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
        var request = indexedDB.open(dbName, 2);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
            if (!db.objectStoreNames.contains("outbox")) {
                db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
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
    window.sessionImageCache.set(key, blob);
    if (window.sessionImageCache.size > 300) {
        window.sessionImageCache.delete(window.sessionImageCache.keys().next().value);
    }

    if (window.designKeyPrefixCache && typeof key === 'string' && key.includes('%2F')) {
        var prefix = key.substring(0, key.lastIndexOf('%2F') + 3);
        if (window.designKeyPrefixCache[prefix]) delete window.designKeyPrefixCache[prefix];
    }
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
    window.sessionImageCache.delete(key);

    if (window.designKeyPrefixCache && typeof key === 'string' && key.includes('%2F')) {
        var prefix = key.substring(0, key.lastIndexOf('%2F') + 3);
        if (window.designKeyPrefixCache[prefix]) delete window.designKeyPrefixCache[prefix];
    }
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
            var keys = [];
            // OPTIMIZATION: Use IDBKeyRange to instantly jump to prefix, preventing full DB scan
            var range = IDBKeyRange.bound(prefix, prefix + '\uffff');
            var req = store.openKeyCursor(range);
            req.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    keys.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve(keys);
                }
            };
            req.onerror = () => resolve([]);
        });
    }).catch(() => []);
}

async function manageProductHDCache(product, action) {
    if (!product) return;
    var zoomUrl = (product.zoomUrl && product.zoomUrl.toLowerCase() !== "none") ? product.zoomUrl : product.gridUrl;

    if (action === 'CACHE') {
        try {
            var bucket = "durga-sarees.firebasestorage.app";
            var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
            var encPath = zoomUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/');
            var listUrl = fbBase + "?prefix=" + encPath + "/&delimiter=/";

            window.fetchWithRetry(listUrl).then(res => res.json()).then(data => {
                if (data && data.items) {
                    async function processCache() {
                        for (const item of data.items) {
                            var fullUrl = fbBase + encodeURIComponent(item.name) + "?alt=media";
                            var blob = await getImageFromDB(fullUrl);
                            if (!blob) {
                                try {
                                    var r = await fetch(fullUrl);
                                    if (r.ok) {
                                        var newBlob = await r.blob();
                                        await saveImageToDB(fullUrl, newBlob);

                                        // 🟢 LIVE UI INJECTION: Update swipe deck instantly
                                        var liveImgs = document.querySelectorAll('img[data-zoom-url="' + fullUrl + '"]');
                                        if (liveImgs.length > 0) {
                                            var objUrl = URL.createObjectURL(newBlob);
                                            liveImgs.forEach(img => {
                                                if (img.dataset.tempBlobUrl) URL.revokeObjectURL(img.dataset.tempBlobUrl);
                                                img.dataset.tempBlobUrl = objUrl;
                                                img.src = objUrl;
                                                img.dataset.loadedZoom = 'true';
                                            });
                                        }

                                        // 🟢 LIVE FULLSCREEN INJECTION: Update if user is currently zoomed in
                                        var fsImg = document.getElementById('fsImg');
                                        var fsModal = document.getElementById('fsModal');
                                        if (fsImg && fsModal && fsModal.style.display === 'flex') {
                                            var filename = decodeURIComponent(fullUrl.split('%2F').pop().split('?')[0]);
                                            var dName = filename.substring(0, filename.lastIndexOf('.'));
                                            if (typeof fsDesignId !== 'undefined') {
                                                var isCoverMatch = (fsDesignId === 'DIRECT' || fsDesignId === 'Cover') && /^(01|1|cover)$/i.test(dName);
                                                if (fsDesignId === dName || isCoverMatch) {
                                                    fsImg.src = URL.createObjectURL(newBlob);
                                                }
                                            }
                                        }
                                    }
                                } catch (e) { console.warn("Background fetch skipped:", e); }
                            }
                        }
                    }
                    processCache();
                }
            }).catch(e => { console.warn("HD Cache Fetch aborted (Offline/Network Error):", e); return; });
        } catch (e) { console.warn("HD Cache Fetch aborted (Offline/Network Error):", e); return; }
    } else if (action === 'DELETE') {
        if (favorites[product.id] === true) return;
        var totalQty = 0;
        for (var k in cart) {
            if (k.startsWith(product.id + '_')) totalQty += cart[k].qty;
        }
        if (totalQty > 0) return;

        if (!product.zoomUrl || product.zoomUrl === product.gridUrl || product.zoomUrl.toLowerCase() === "none") return;

        var cleanZoom = zoomUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
        var encZoomPath = cleanZoom.split('/').map(s => encodeURIComponent(s)).join('%2F');
        var bucket = "durga-sarees.firebasestorage.app";
        var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
        var prefix = fbBase + encZoomPath + "%2F";

        var keys = await listDBKeysForPrefix(prefix);
        for (var i = 0; i < keys.length; i++) {
            await deleteImageFromDB(keys[i]);
        }
    }
}

// 🧠 CORE FIX: Resolves the exact IndexedDB cache key for a given design label
// It ignores file extensions (.jpg vs .webp) and padding (2 vs 02) to guarantee a match
window.findDesignKeyInCache = async function (gridUrl, designLabel) {
    if (!gridUrl || gridUrl.startsWith('http')) return null;

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
    if (window.sessionImageCache.has(key)) return Promise.resolve(window.sessionImageCache.get(key));
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            var tx = db.transaction(storeName, "readonly");
            var store = tx.objectStore(storeName);
            var req = store.get(key);
            req.onsuccess = () => {
                var blob = req.result;
                if (blob) {
                    if (blob.size === 0) {
                        resolve(null);
                        return;
                    }
                    window.sessionImageCache.set(key, blob);
                    if (window.sessionImageCache.size > 300) {
                        window.sessionImageCache.delete(window.sessionImageCache.keys().next().value);
                    }
                }
                resolve(blob || null);
            };
            req.onerror = () => reject(req.error);
        });
    }).catch(e => {
        console.error("IndexedDB read failed", e);
        return null;
    });
}

function checkImageInDB(key) {
    if (window.sessionImageCache.has(key)) return Promise.resolve(true);
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction(storeName, "readonly");
            var store = tx.objectStore(storeName);
            var req = store.get(key);
            req.onsuccess = () => {
                var blob = req.result;
                if (blob && blob.size > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            req.onerror = () => resolve(false);
        });
    }).catch(e => {
        return false;
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



// 🚀 FAST PROGRESSIVE IMAGE LOADER (GRID -> ZOOM)
// ==========================================
// 🛡️ THE FIX: Loads the low-res Grid image instantly, then quietly upgrades to Zoom!
window.renderWebpFromFolder = function (imgElement, gridPath, zoomPath, targetFile) {
    if (!gridPath || gridPath.trim() === "" || gridPath.toLowerCase() === "none") {
        imgElement.src = window.dsMissingImage;
        return;
    }

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";
    var encGridPath = gridPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
    var encZoomPath = (zoomPath && zoomPath !== "None") ? zoomPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F') : encGridPath;

    var fileToFetch = targetFile ? targetFile : "cover.webp"; // Main grid: always try cover.webp first

    // If cache confirms cover is missing, jump straight to fallback map
    if ((fileToFetch === "cover.webp" || fileToFetch === "cover1.webp") && coverExistsMap[gridPath] === false) {
        if (dsFallbackMap[gridPath]) {
            fileToFetch = dsFallbackMap[gridPath];
        } else {
            tryFolderListFallback();
            return;
        }
    }

    var lowResUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(fileToFetch) + "?alt=media";

    function showPlaceholder(err) {
        imgElement.src = window.dsMissingImage;
        imgElement.onerror = null;
        window.brokenImagesMap = window.brokenImagesMap || {};
        window.brokenImagesMap[gridPath] = true;
        var reason = (err && err.message) ? err.message : 'Unknown HTTP/Network Error';
        if (typeof window.logAppError === 'function') {
            window.logAppError('Image Load Failed', 'Grid: ' + gridPath + ' | Reason: ' + reason);
        }
    }

    // Strip Excel 'ready' logic - always discover files from Firebase folder listing
    function tryToLoadLatestReadyDesign() {
        tryFolderListFallback();
    }

    // 🔄 LAST RESORT: Call Firebase list API to discover actual filenames
    function tryFolderListFallback() {
        // Check if we already cached the fallback filename — try IDB first
        if (dsFallbackMap[gridPath]) {
            var cachedFile = dsFallbackMap[gridPath];
            var cachedUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(cachedFile) + "?alt=media";
            getImageFromDB(cachedUrl).then(function(blob) {
                if (blob) {
                    var objUrl = URL.createObjectURL(blob);
                    imgElement.src = objUrl;
                    imgElement.dataset.tempBlobUrl = objUrl;
                } else {
                    imgElement.src = cachedUrl;
                    imgElement.onerror = function () { showPlaceholder(new Error("Cached fallback onerror triggered")); };
                }
            });
            return;
        }

        var listPrefix = gridPath.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';
        var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";

        window.fetchWithRetry(listUrl)
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
                    var firstUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(firstFile) + "?alt=media";
                    // Try IDB first, then network
                    getImageFromDB(firstUrl).then(function(blob) {
                        if (blob) {
                            var objUrl = URL.createObjectURL(blob);
                            imgElement.src = objUrl;
                            imgElement.dataset.tempBlobUrl = objUrl;
                        } else {
                            imgElement.src = firstUrl;
                            imgElement.onerror = function () { showPlaceholder(new Error("Image element onload onerror triggered")); };
                        }
                    });
                } else {
                    showPlaceholder(new Error("Folder list empty"));
                }
            })
            .catch(function (err) { showPlaceholder(err); });
    }


    function loadFromNetwork() {
        // Priority queue: try cover.webp first, then cover1.webp, then fall back to folder listing
        var fallbackQueue = [];
        if (targetFile && targetFile !== "cover.webp" && targetFile !== "cover1.webp") fallbackQueue.push(targetFile);
        if (!fallbackQueue.includes("cover.webp")) fallbackQueue.push("cover.webp");
        if (!fallbackQueue.includes("cover1.webp")) fallbackQueue.push("cover1.webp");

        var queueIndex = fallbackQueue.indexOf(fileToFetch) !== -1 ? fallbackQueue.indexOf(fileToFetch) : 0;

        async function fetchImageSecurely(targetUrl) {
            try {
                var res = await window.fetchWithRetry(targetUrl);
                if (res.ok) {
                    var blob = await res.blob();
                    await saveImageToDB(cacheKey, blob);
                    if (imgElement.dataset.tempBlobUrl) URL.revokeObjectURL(imgElement.dataset.tempBlobUrl);
                    var objUrl = URL.createObjectURL(blob);
                    imgElement.dataset.tempBlobUrl = objUrl;
                    imgElement.src = objUrl;

                } else {
                    throw new Error("HTTP Status " + res.status);
                }
            } catch (err) {
                queueIndex++;
                if (queueIndex < fallbackQueue.length) {
                    var nextUrl = fbBase + encGridPath + "%2F" + fallbackQueue[queueIndex] + "?alt=media";
                    fetchImageSecurely(nextUrl);
                } else {
                    // Final fallback sequence using token validation
                    var finalZoomUrl = fbBase + encZoomPath + "%2Fcover.webp?alt=media";
                    try {
                        var zRes = await window.fetchWithRetry(finalZoomUrl);
                        if (zRes.ok) {
                            var zBlob = await zRes.blob();
                            if (zBlob.size === 0) throw new Error("Zero byte cover");
                            if (imgElement.dataset.tempBlobUrl) URL.revokeObjectURL(imgElement.dataset.tempBlobUrl);
                            var zObj = URL.createObjectURL(zBlob);
                            imgElement.dataset.tempBlobUrl = zObj;
                            imgElement.src = zObj;
                        } else {
                            coverExistsMap[gridPath] = false;
                            saveCoverExistsMap();
                            tryToLoadLatestReadyDesign();
                        }
                    } catch (e) {
                        coverExistsMap[gridPath] = false;
                        saveCoverExistsMap();
                        tryToLoadLatestReadyDesign();
                    }
                }
            }
        }
        fetchImageSecurely(lowResUrl);
    }

    var cacheKey = (fileToFetch === "cover.webp" || fileToFetch === "cover1.webp") ? gridPath : lowResUrl;

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
        getImageFromDB(highResUrl).then(function (existingBlob) {
            if (!existingBlob) {
                fetch(highResUrl)
                    .then(function (res) { return res.ok ? res.blob() : null; })
                    .then(function (blob) {
                        if (blob && blob.size > 0) {
                            if (imgElement.dataset.tempBlobUrl) {
                                URL.revokeObjectURL(imgElement.dataset.tempBlobUrl);
                            }
                            var objUrl = URL.createObjectURL(blob);
                            imgElement.dataset.tempBlobUrl = objUrl;
                            imgElement.src = objUrl;
                        }
                    })
                    .catch(function () { });
            } else {
                if (imgElement.dataset.tempBlobUrl) {
                    URL.revokeObjectURL(imgElement.dataset.tempBlobUrl);
                }
                var objUrl = URL.createObjectURL(existingBlob);
                imgElement.dataset.tempBlobUrl = objUrl;
                imgElement.src = objUrl;
            }
        }).catch(function () {
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
    h.push('<div class="ci-brand" style="flex:1 1 0; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:clip; margin:0;">' + esc(p.name) + '</div>');

    var packLen = String(p.packing || "1").length;
    var displayLen = Math.min(packLen, 8);
    h.push('<input type="text" class="pack-input-inline" value="' + esc(p.packing) + '" readonly onclick="event.stopPropagation()" style="flex-shrink:0; text-align:right; width:' + (displayLen + 0.5) + 'ch !important; min-width:1ch !important; max-width:7.5ch !important; font-size:11px !important; padding:0; margin:0;">');
    h.push('<div class="fav-btn-inline" style="flex-shrink:0; padding-left:0;" onclick="toggleFav(\'' + p.id + '\', event)"><i class="' + favClass + '"></i></div>');
    h.push('</div>');

    h.push('<div class="ci-fabric" style="margin-top:0;">' + esc(p.fabric) + '</div>');
    h.push('<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0; width:100%;">');
    h.push('<div style="display:flex; align-items:center; gap:4px; overflow:hidden; flex-wrap:nowrap;">');
    h.push('<span style="font-weight:700; font-size:14px; color:#282c3f;">₹<input type="number" class="price-input-inline" value="' + parsedPrice + '" readonly onclick="event.stopPropagation()"></span>');
    if (displayMrp > 0) h.push('<span style="font-size:11px; color:#94969f; text-decoration:line-through; white-space:nowrap;">₹' + displayMrp + '</span>');
    if (offPercent > 0) h.push('<span style="font-size:11px; color:#ff905a; font-weight:700; white-space:nowrap;">' + offPercent + '% OFF</span>');
    h.push('</div>');

    h.push('<div style="flex-shrink:0;">');
    if (!window.isAdminMode && p.totalStock === 0) {
        h.push('<div style="background: red; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">PACKED</div>');
    } else if (coverQty === 0 || isNaN(coverQty)) {
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
        // --- ADMIN & INVENTORY: OUT OF STOCK TO BOTTOM ---
        if (a.totalStock === 0 && b.totalStock > 0) return 1;
        if (b.totalStock === 0 && a.totalStock > 0) return -1;

        // --- BROKEN IMAGES: JUST ABOVE OUT OF STOCK ---
        window.brokenImagesMap = window.brokenImagesMap || {};
        var aNoImg = (!a.gridUrl || String(a.gridUrl).trim() === "" || String(a.gridUrl).toLowerCase() === "none");
        var bNoImg = (!b.gridUrl || String(b.gridUrl).trim() === "" || String(b.gridUrl).toLowerCase() === "none");
        var aBroken = window.brokenImagesMap[a.gridUrl] === true || aNoImg;
        var bBroken = window.brokenImagesMap[b.gridUrl] === true || bNoImg;
        if (aBroken && !bBroken) return 1;
        if (!aBroken && bBroken) return -1;

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
            <div class="ci" id="detail-wrap-${p.id}">
                ${buildCardDetails(p)}
            </div>
        </div>
        `);

        setTimeout(() => {
            let imgEl = document.getElementById(imgElementId);
            if (imgEl) window.renderWebpFromFolder(imgEl, p.gridUrl, null, null); // First file from folder listing
        }, 0);
    });

    gridEl.innerHTML = htmlBuffer.join('');
}

// ====================================
// CORE FUNCTIONS
// ====================================
function chgMainRow(pid, dir) {
    var p = allProducts.find(x => x.id === pid); if (!p) return;
    if (!window.isAdminMode && p.totalStock === 0) return; // Cart Protection
    var key = p.id + '_DIRECT';
    var curQ = cart[key] ? cart[key].qty : 0;
    var newQ = Math.max(0, curQ + (dir * (p.mult || 1)));

    if (newQ === 0 || isNaN(newQ)) delete cart[key];
    else cart[key] = { p: p, design: 'DIRECT', qty: newQ };

    try { localStorage.setItem("dsCart", JSON.stringify(cart)); } catch (e) { }
    refreshCardUI(pid);

    var totalQty = 0;
    for (var k in cart) { if (k.startsWith(pid + '_')) totalQty += cart[k].qty; }
    manageProductHDCache(p, totalQty > 0 ? 'CACHE' : 'DELETE');
}

function toggleFav(pid, event) {
    if (event) event.stopPropagation();
    if (favorites[pid]) delete favorites[pid]; else favorites[pid] = true;
    try { localStorage.setItem("dsFavs", JSON.stringify(favorites)); } catch (err) { }
    refreshCardUI(pid);

    var p = allProducts.find(x => x.id === pid);
    if (p) manageProductHDCache(p, favorites[pid] ? 'CACHE' : 'DELETE');
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

function loadAndCacheDesignImage(imgEl, url, designGridUrl, productId, fileName, folderPath, isCover, zoomFolderPath, isInStock) {
    if (imgEl.getAttribute('data-loaded-zoom') === 'true') return;
    setTimeout(async function () {
        try {
            // STEP 1: IDB direct hit for zoom (Fastest)
            var zoomBlob = await getImageFromDB(url);
            if (zoomBlob) {
                console.log('[ZOOM] IDB HIT:', fileName);
                // RAM FIX: Revoke old grid placeholder and assign new temp URL
                if (imgEl.dataset.tempBlobUrl) URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                var objUrl = URL.createObjectURL(zoomBlob);
                imgEl.dataset.tempBlobUrl = objUrl;
                imgEl.src = objUrl;
                imgEl.dataset.loadedZoom = 'true';
                return;
            }

            // STEP 2: Show grid placeholder from IDB instantly
            var gridBlob = null;
            if (designGridUrl) gridBlob = await getImageFromDB(designGridUrl);
            if (!gridBlob && folderPath) gridBlob = await getImageFromDB(folderPath);
            if (gridBlob && imgEl.dataset.loadedZoom !== 'true') {
                if (imgEl.dataset.tempBlobUrl) URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                var gridObjUrl = URL.createObjectURL(gridBlob);
                imgEl.dataset.tempBlobUrl = gridObjUrl;
                imgEl.src = gridObjUrl;
            }

            // STEP 3: No distinct zoom? Mark done.
            if (!url || url === designGridUrl) {
                imgEl.dataset.loadedZoom = 'true';
                return;
            }

            // STEP 4: Fetch zoom from network (RAM ONLY - NO permanent storage bloat)
            console.log('[ZOOM] Network fetch:', fileName);
            var r = await window.fetchWithRetry(url);
            if (r.ok) {
                var blob = await r.blob();
                if (blob.size === 0) throw new Error("Zero byte blob");
                if (isInStock) {
                    saveImageToDB(url, blob);
                    console.log('[ZOOM] Persisted to IDB Storage:', fileName);
                } else {
                    console.log('[ZOOM] Retained in transient RAM Only (PACKED Item):', fileName);
                }
                if (imgEl.dataset.loadedZoom !== 'true') {
                    if (imgEl.dataset.tempBlobUrl) URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                    var oUrl = URL.createObjectURL(blob);
                    imgEl.dataset.tempBlobUrl = oUrl;
                    imgEl.src = oUrl;
                    imgEl.dataset.loadedZoom = 'true';
                }
                console.log('[ZOOM] Loaded into RAM:', fileName);
            } else if (r.status === 404 || r.status === 403) {
                // STEP 5: Extension fallback (.webp <-> .jpg)
                var fbUrl = null, lu = url.toLowerCase();
                if (lu.includes('.webp?alt=media')) fbUrl = url.replace(/\.webp\?alt=media/i, '.jpg?alt=media');
                else if (lu.includes('.jpg?alt=media')) fbUrl = url.replace(/\.jpg\?alt=media/i, '.webp?alt=media');
                else if (lu.includes('.jpeg?alt=media')) fbUrl = url.replace(/\.jpeg\?alt=media/i, '.jpg?alt=media');
                else if (lu.includes('.png?alt=media')) fbUrl = url.replace(/\.png\?alt=media/i, '.webp?alt=media');
                if (fbUrl) {
                    if (typeof window.logAppError === 'function') {
                        window.logAppError('AUDITOR: Fallback Swap', `Swapped ${url} to ${fbUrl} for ${fileName} | HTTP ${r.status}`);
                    }
                    var r2 = await window.fetchWithRetry(fbUrl);
                    if (r2.ok) {
                        var b2 = await r2.blob();
                        if (isInStock) {
                            saveImageToDB(fbUrl, b2);
                            console.log('[ZOOM] Persisted to IDB Storage (Fallback):', fileName);
                        } else {
                            console.log('[ZOOM] Retained in transient RAM Only (Fallback):', fileName);
                        }
                        if (imgEl.dataset.loadedZoom !== 'true') {
                            if (imgEl.dataset.tempBlobUrl) URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                            var u2 = URL.createObjectURL(b2);
                            imgEl.dataset.tempBlobUrl = u2;
                            imgEl.src = u2;
                            imgEl.dataset.loadedZoom = 'true';
                        }
                    } else {
                        var errText = await r2.text().catch(() => "No text");
                        if (typeof window.logAppError === 'function') {
                            window.logAppError('AUDITOR: Fallback Failed', `HTTP ${r2.status} on fallback | ${errText.substring(0, 100)}`);
                        }
                        imgEl.dataset.loadedZoom = 'true'; // Stop trying, leave grid image
                    }
                }
            } else {
                var errTextOrig = await r.text().catch(() => "No text");
                if (typeof window.logAppError === 'function') {
                    window.logAppError('AUDITOR: Zoom Fetch Error', `HTTP ${r.status} | ${errTextOrig.substring(0, 100)}`);
                }
                imgEl.dataset.loadedZoom = 'true';
            }
        } catch (e) {
            console.error('[ZOOM] Error for', fileName, ':', e.message);
            var prod = window.allProducts && window.allProducts.find(x => x.id === productId);
            var pName = prod ? prod.name : productId;
            if (typeof window.logAppError === 'function') {
                window.logAppError('Zoom Image Error', e.message + " | " + pName);
            }
        }
    }, 0);
}

function fetchZoomNatively(zoomUrl, imgEl) {
    if (!zoomUrl) return;
    var tempImg = new Image();
    tempImg.onload = function () {
        if (imgEl.dataset.loadedZoom !== 'true') {
            if (imgEl.dataset.tempBlobUrl) {
                URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                imgEl.removeAttribute('data-temp-blob-url');
            }
            imgEl.src = zoomUrl;
            imgEl.dataset.loadedZoom = "true";
        }
    };
    tempImg.onerror = function () {
        if (imgEl.dataset.loadedZoom === "true") return;
        var newZoomUrl = null;
        var lowerUrl = zoomUrl.toLowerCase();
        var extMatch = zoomUrl.match(/\/([^/?]+)\?alt=media/i);
        var filename = extMatch ? extMatch[1] : zoomUrl;
        var extChangeMsg = "";

        if (lowerUrl.includes('.webp?alt=media')) { newZoomUrl = zoomUrl.replace(/\.webp\?alt=media/i, '.jpg?alt=media'); extChangeMsg = ".webp -> .jpg"; }
        else if (lowerUrl.includes('.jpg?alt=media')) { newZoomUrl = zoomUrl.replace(/\.jpg\?alt=media/i, '.webp?alt=media'); extChangeMsg = ".jpg -> .webp"; }
        else if (lowerUrl.includes('.jpeg?alt=media')) { newZoomUrl = zoomUrl.replace(/\.jpeg\?alt=media/i, '.jpg?alt=media'); extChangeMsg = ".jpeg -> .jpg"; }
        else if (lowerUrl.includes('.png?alt=media')) { newZoomUrl = zoomUrl.replace(/\.png\?alt=media/i, '.webp?alt=media'); extChangeMsg = ".png -> .webp"; }

        if (typeof window.logAppError === 'function') {
            window.logAppError('AUDITOR: Image Fallback Triggered', `Failed to load ${filename}. Trying ${extChangeMsg}`);
        }

        if (newZoomUrl) {
            var fallbackImg = new Image();
            fallbackImg.onload = function () {
                if (imgEl.dataset.loadedZoom !== 'true') {
                    if (imgEl.dataset.tempBlobUrl) {
                        URL.revokeObjectURL(imgEl.dataset.tempBlobUrl);
                        imgEl.removeAttribute('data-temp-blob-url');
                    }
                    imgEl.src = newZoomUrl;
                    imgEl.dataset.loadedZoom = "true";
                }
            };
            fallbackImg.onerror = function () {
                if (typeof window.logAppError === 'function') {
                    var newFilename = newZoomUrl.match(/\/([^/?]+)\?alt=media/i);
                    newFilename = newFilename ? newFilename[1] : newZoomUrl;
                    window.logAppError('AUDITOR: Image Fallback Failed (404)', `Both original and fallback missing. Failed on ${newFilename}`);
                }
            };
            fallbackImg.src = newZoomUrl;
        }
    };
    tempImg.src = zoomUrl;
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

    // 🚀 NEW: LIVE SYNC FETCH WHEN OPENING PRODUCT PAGE
    if (p.docId) {
        var docUrl = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + p.docId;
        window.fetchWithRetry(docUrl, { method: 'GET' }, 1)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.fields) {
                    var f = data.fields;
                    var livePrice = f.price ? (f.price.doubleValue || f.price.integerValue || 0) : 0;
                    var livePacking = f.packing ? (f.packing.stringValue || (f.packing.integerValue !== undefined ? String(f.packing.integerValue) : "") || (f.packing.doubleValue !== undefined ? String(f.packing.doubleValue) : "") || "1") : "1";
                    
                    p.price = livePrice;
                    p.packing = livePacking;
                    
                    if (curProduct && curProduct.id === p.id) {
                        document.getElementById('dtPriceBot').innerText = p.price || '0';
                        document.getElementById('dtPackBot').innerText = (p.packing && p.packing !== "") ? p.packing : "-";
                    }
                    refreshCardUI(p.id);
                }
            }).catch(e => {});
    }

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

    if (window.brokenImagesMap) {
        delete window.brokenImagesMap[gridPath];
        delete window.brokenImagesMap[zoomPath];
    }

    var cleanGridPath = gridPath ? String(gridPath).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/') : "";
    var cleanZoomPath = zoomPath && zoomPath !== "None" ? String(zoomPath).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/') : cleanGridPath;

    if (!cleanGridPath || cleanGridPath === "" || cleanGridPath.toLowerCase() === "none") {
        deck.innerHTML = '<div class="swipe-card" data-design="DIRECT"><img src="' + window.dsMissingImage + '"></div>';
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
        // Update main grid image using first discovered file from folder listing
        var mainGridImg = document.getElementById("img_" + p.id);
        if (mainGridImg && items.length > 0) {
            delete window.brokenImagesMap[gridPath];
            window.renderWebpFromFolder(mainGridImg, p.gridUrl, null, null);
        }

        var validFiles = [];

        items.forEach(item => {
            var fullPath = item.name; // item.name is from Grid bucket
            var filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
            var lowerName = filename.toLowerCase();

            // Define isCoverImg (we will filter them out later if there are other designs)
            var isCoverImg = /^(cover|cover1)\.(webp|jpg|jpeg|png)$/i.test(lowerName);

            var ext = lowerName.substring(lowerName.lastIndexOf('.'));
            var isVideo = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".3gp", ".ogg"].includes(ext);
            var isImage = [".webp", ".jpg", ".jpeg", ".png", ".gif"].includes(ext);

            if (isVideo || isImage) {
                // Grid path: item.name already IS the Grid path
                var gridEncName = fullPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
                // Zoom path: replace Grid folder prefix with Zoom folder prefix
                // Strictly append the filename to the zoom folder path, bypassing case-sensitive .replace() errors
                var zoomEncName = cleanZoomPath.split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F') + '%2F' + encodeURIComponent(filename);

                var gridUrl = fbBase + gridEncName + "?alt=media";
                var zoomUrl = fbBase + zoomEncName + "?alt=media";
                var designName = filename.substring(0, filename.lastIndexOf('.'));

                validFiles.push({
                    name: designName,
                    gridUrl: gridUrl,
                    url: zoomUrl,
                    isVideo: isVideo,
                    isImage: isImage,
                    isCoverImg: isCoverImg
                });
            }
        });

        // Hide cover/cover1 images from product page — they are only used for the main grid thumbnail
        var hasOtherDesigns = validFiles.some(f => !f.isCoverImg);
        if (hasOtherDesigns) {
            validFiles = validFiles.filter(f => !f.isCoverImg);
        }

        // 🛡️ SORT LATEST DESIGNS FIRST (DESCENDING NUMERICAL) WITH HIGHEST STOCK FIRST
        validFiles.sort((a, b) => {
            var stockA = p.stock && p.stock[a.name] !== undefined ? p.stock[a.name] : 999;
            var stockB = p.stock && p.stock[b.name] !== undefined ? p.stock[b.name] : 999;
            if (stockA !== stockB) {
                return stockB - stockA; // Highest stock first
            }
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
            var curStock = p.stock && p.stock['DIRECT'] !== undefined ? p.stock['DIRECT'] : 999;
            var adminCheckboxHtml = '';
            var qtyHtml = '';
            if (window.isAdminMode) {
                adminCheckboxHtml = `<input type="checkbox" class="admin-bulk-check" data-did="DIRECT" data-docid="${p.docId}" data-pid="${p.id}" onclick="event.stopPropagation()" style="position:absolute; top:8px; left:8px; z-index:10; transform:scale(1.5); box-shadow: 0 0 5px rgba(255,255,255,0.8);">`;
                qtyHtml = `
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                        <span style="font-size:11px; font-weight:bold; color:var(--text-main);">Stock:</span>
                        <input type="number" class="admin-stock-input" value="${curStock}" onblur="window.updateAdminStock(this, '${p.docId}', '${p.id}', 'DIRECT')" onkeyup="if(event.key === 'Enter') this.blur();" style="width: 60px; text-align: center; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                `;
            } else if (curStock === 0) {
                qtyHtml = '<div style="color:white; background:red; padding:4px 12px; font-weight:bold; border-radius:4px; margin-top:4px;">PACKED</div>';
            } else {
                qtyHtml = `
                    <div class="qty-clean">
                        <button onclick="changeQty('${p.id}', 'DIRECT', -1)">−</button>
                        <input type="number" id="qty_${p.id}_DIRECT" value="${cart[p.id + '_DIRECT'] ? cart[p.id + '_DIRECT'].qty : 0}" onchange="setExactQty('${p.id}', 'DIRECT', this.value)">
                        <button onclick="changeQty('${p.id}', 'DIRECT', 1)">+</button>
                    </div>
                `;
            }
            deck.innerHTML = `
            <div class="swipe-card" data-design="DIRECT" onclick="openFs('${p.id}', 0, 'Cover')" style="position:relative;">
                ${adminCheckboxHtml}
                <img id="design_img_${p.id}_DIRECT" src="${coverSrc || ''}" data-loaded-zoom="false" style="width: 100%; object-fit: cover;" onerror="if(typeof window.logAppError === 'function') window.logAppError('Image Load Error', 'Fallback Cover Image Missing (404) | ${p.name}'); this.onerror=null; this.src=window.dsMissingImage;">
                <div class="swipe-card-bot" onclick="event.stopPropagation()">
                    <div style="font-weight:bold; font-size:12px; color:var(--text-main);">Cover</div>
                    ${qtyHtml}
                </div>
            </div>`;
            setTimeout(updateBottomQtyFromActiveDesign, 50);
            updateLiveDetailHeader();
            var imgEl = document.getElementById("design_img_" + p.id + "_DIRECT");
            if (imgEl && fallbackZoomUrl) {
                var curStockCover = p.stock && p.stock['Cover'] !== undefined ? p.stock['Cover'] : 999;
                loadAndCacheDesignImage(imgEl, fallbackZoomUrl, fallbackGridUrl, p.id, 'Cover', p.gridUrl, true, cleanZoomPath, curStockCover > 0);
            }
        }
    }

    if (window.dsFolderCache && window.dsFolderCache[listUrl]) {
        processFolderItems(window.dsFolderCache[listUrl]);
    }
    
    // ALWAYS fetch from network to sync any newly uploaded admin images
    fetch(listUrl + "&_t=" + new Date().getTime(), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            return res.json();
        })
        .then(data => {
            var items = data.items || [];
            if (!window.dsFolderCache) window.dsFolderCache = {};
            
            var oldItemsStr = JSON.stringify(window.dsFolderCache[listUrl] || []);
            var newItemsStr = JSON.stringify(items);
            
            window.dsFolderCache[listUrl] = items;
            try { localStorage.setItem("dsFolderCache", JSON.stringify(window.dsFolderCache)); } catch (e) { }
            
            if (oldItemsStr !== newItemsStr) {
                processFolderItems(items);
            }
        })
        .catch(err => {
            console.warn("Background folder list load failed", err);
            if (!window.dsFolderCache || !window.dsFolderCache[listUrl]) {
                var fallbackItems = [];
                for (var i = 1; i <= 5; i++) {
                    var n = String(i).padStart(2, '0');
                    fallbackItems.push({ name: cleanGridPath + '/' + n + ".webp" });
                }
                processFolderItems(fallbackItems);
            }
        });

    async function renderSwipeDeck(files) {
        renderedFilesJson = JSON.stringify(files);
        window.lastRenderedDesignNames = files.map(f => String(f.name).toLowerCase()).join(',');

        var placeholderSVG = window.dsMissingImage;

        // 🚀 PRE-FETCH CACHED BLOBS BEFORE RENDERING HTML (Zero Flicker!)
        try {
            await Promise.all(files.map(async (file, idx) => {
                if (!file.isVideo) {
                    var isCover = false; // All images are treated equally

                    // 1. Try HD Zoom First
                    var targetBlob = await getImageFromDB(file.url);
                    if (targetBlob) {
                        file.isZoomLoaded = true;
                    } else {
                        // 2. Fallback to Grid
                        if (!targetBlob && file.gridUrl) targetBlob = await getImageFromDB(file.gridUrl);
                        if (!targetBlob && window.findDesignKeyInCache) {
                            var altKey = await window.findDesignKeyInCache(p.gridUrl, file.name);
                            if (altKey) targetBlob = await getImageFromDB(altKey);
                        }
                    }

                    if (targetBlob) file.cachedObjectUrl = URL.createObjectURL(targetBlob);
                }
            }));
        } catch (fetchErr) {
            console.warn("Failed to prefetch blobs, continuing with network fallback", fetchErr);
        }

        var html = '';
        files.forEach((file, idx) => {
            var dKey = p.id + '_' + file.name;
            var curStock = p.stock && p.stock[file.name] !== undefined ? p.stock[file.name] : 999;

            var qtyHtml = '';
            if (window.isAdminMode) {
                qtyHtml = `<input type="number" class="admin-stock-input" value="${curStock}" onblur="window.updateAdminStock(this, '${p.docId}', '${p.id}', '${file.name}')" onkeyup="if(event.key === 'Enter') this.blur();" style="width: 60px; text-align: center; border: 1px solid #ccc; border-radius: 4px;">`;
            } else if (curStock === 0) {
                qtyHtml = `<div style="background: red; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">PACKED</div>`;
            } else {
                qtyHtml = `
                    <div class="qty-clean">
                        <button onclick="changeQty('${p.id}', '${file.name}', -1)">−</button>
                        <input type="number" id="qty_${p.id}_${file.name}" value="${cart[dKey] ? cart[dKey].qty : 0}" onchange="setExactQty('${p.id}', '${file.name}', this.value)">
                        <button onclick="changeQty('${p.id}', '${file.name}', 1)">+</button>
                    </div>`;
            }

            var adminCheckboxHtml = '';
            if (window.isAdminMode) {
                adminCheckboxHtml = `<input type="checkbox" class="admin-bulk-check" data-did="${file.name}" data-docid="${p.docId}" data-pid="${p.id}" onclick="event.stopPropagation()" style="position:absolute; top:8px; left:8px; z-index:10; transform:scale(1.5); box-shadow: 0 0 5px rgba(255,255,255,0.8);">`;
            }

            if (file.isVideo) {
                html += `
                <div class="swipe-card" data-design="${file.name}" onclick="openFs('${p.id}', ${idx}, '${file.name}')" style="position:relative;">
                    ${adminCheckboxHtml}
                    <video src="${file.url}" controls playsinline style="width: 100%; object-fit: cover;" onclick="event.stopPropagation()"></video>
                    <div class="swipe-card-bot" onclick="event.stopPropagation()">
                        <div style="font-weight:bold; font-size:12px; color:var(--text-main);">${file.name}</div>
                        ${qtyHtml}
                    </div>
                </div>`;
            } else {
                var imgId = "design_img_" + p.id + "_" + idx;
                var loadedZoomAttr = file.isZoomLoaded ? 'data-loaded-zoom="true"' : 'data-loaded-zoom="false"';
                var imgSrc = file.cachedObjectUrl ? file.cachedObjectUrl : placeholderSVG;
                var tempUrlAttr = file.cachedObjectUrl ? 'data-temp-blob-url="' + file.cachedObjectUrl + '"' : '';
                html += `
                <div class="swipe-card" data-design="${file.name}" onclick="openFs('${p.id}', ${idx}, '${file.name}')" style="position:relative;">
                    ${adminCheckboxHtml}
                    <img id="${imgId}" src="${imgSrc}" ${loadedZoomAttr} data-zoom-url="${file.url}" ${tempUrlAttr}>
                    <div class="swipe-card-bot" onclick="event.stopPropagation()">
                        <div style="font-weight:bold; font-size:12px; color:var(--text-main);">${file.name}</div>
                        ${qtyHtml}
                    </div>
                </div>`;
            }
        });
        deck.innerHTML = html;

        // Trigger loadAndCacheDesignImage to fetch the ZOOM images in the background, or fallback to network if not cached
        files.forEach((file, idx) => {
            if (!file.isVideo) {
                var imgId = "design_img_" + p.id + "_" + idx;
                var imgEl = document.getElementById(imgId);
                if (imgEl) {
                    var currentStock = p.stock && p.stock[file.name] !== undefined ? p.stock[file.name] : 999;
                    loadAndCacheDesignImage(imgEl, file.url, file.gridUrl, p.id, file.name, p.gridUrl, /^(cover|cover1)$/i.test(file.name), cleanZoomPath, currentStock > 0);
                }
            }
        });

        setTimeout(updateBottomQtyFromActiveDesign, 50);
        updateLiveDetailHeader();
    }

}

window.changeQty = function (pid, designId, amount) {
    var p = allProducts.find(x => x.id === pid); if (!p) return;
    if (!window.isAdminMode && p.stock && p.stock[designId] === 0) return; // Cart Protection
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

    var totalQty = 0;
    for (var k in cart) { if (k.startsWith(pid + '_')) totalQty += cart[k].qty; }
    manageProductHDCache(p, totalQty > 0 ? 'CACHE' : 'DELETE');

    // 3. Update Cart Live if it's open in the background!
    var cartPanel = document.getElementById('cartPanel');
    if (cartPanel && cartPanel.classList.contains('open')) {
        var isEditingAny = false;
        if (window.cartEditingMap) {
            for (var ed in window.cartEditingMap) {
                if (window.cartEditingMap[ed]) isEditingAny = true;
            }
        }
        if (!isEditingAny) openCart();
    }
};

window.setExactQty = function (pid, designId, value) {
    var p = allProducts.find(x => x.id === pid); if (!p) return;
    var key = pid + '_' + designId;
    var newQ = parseInt(value) || 0;
    if (newQ < 0) newQ = 0;

    var mult = p.mult || 1;
    if (newQ % mult !== 0) {
        newQ = Math.round(newQ / mult) * mult;
    }

    if (newQ === 0) delete cart[key];
    else cart[key] = { p: p, design: designId, qty: newQ };

    var input = document.getElementById('qty_' + pid + '_' + designId);
    if (input) input.value = newQ;

    if (designId === 'DIRECT') {
        var topInput = document.getElementById('dtQtyDirect');
        if (topInput) topInput.value = newQ;
    }

    if (typeof fsDesignId !== 'undefined' && fsDesignId === designId) {
        var fsInp = document.getElementById('fsQty');
        if (fsInp) fsInp.innerText = newQ;
    }

    try { localStorage.setItem("dsCart", JSON.stringify(cart)); } catch (e) { }
    refreshCardUI(pid);
    updateLiveDetailHeader();
    updateBottomQtyFromActiveDesign();

    var totalQty = 0;
    for (var k in cart) { if (k.startsWith(pid + '_')) totalQty += cart[k].qty; }
    manageProductHDCache(p, totalQty > 0 ? 'CACHE' : 'DELETE');

    var cartPanel = document.getElementById('cartPanel');
    if (cartPanel && cartPanel.classList.contains('open')) {
        var isEditingAny = false;
        if (window.cartEditingMap) {
            for (var ed in window.cartEditingMap) {
                if (window.cartEditingMap[ed]) isEditingAny = true;
            }
        }
        if (!isEditingAny) openCart();
    }
};

function updateLiveDetailHeader() {
    if (!curProduct) return;
    var totalQty = 0;
    for (var k in cart) { if (cart[k].p && cart[k].p.id === curProduct.id) totalQty += cart[k].qty; }

    // Top Header Badge
    var dtTotTop = document.getElementById('dtTotalQtyTop');
    if (dtTotTop) dtTotTop.innerText = totalQty > 0 ? totalQty : "0";

    // Display live total quantity next to product name
    var dtNameTop = document.getElementById('dtNameTop');
    if (dtNameTop) {
        dtNameTop.innerHTML = esc(curProduct.name) + ' <span style="color: var(--myntra-pink); font-weight: bold; font-size: 14px;">(' + totalQty + ' pcs)</span>';
    }

    // Admin Bulk Actions Bar Toggle
    var adminBar = document.getElementById('adminBulkBar');
    if (adminBar) {
        adminBar.style.display = window.isAdminMode ? 'flex' : 'none';
        var checkAll = document.getElementById('adminBulkCheckAll');
        if (checkAll) checkAll.checked = false; // reset state
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

    var oldFab = document.getElementById('adminCamFab');
    if (oldFab) oldFab.remove();

    if (window.isAdminMode) {
        var panel = document.getElementById('detailPanel');
        panel.insertAdjacentHTML('beforeend', `<div id="adminCamFab" onclick="window.triggerAdminCamera('${curProduct.docId}', '${curProduct.id}')" style="position:fixed; bottom:95px; right:20px; background:var(--myntra-pink); color:white; width:55px; height:55px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:2500; cursor:pointer;"><i class="fas fa-camera"></i></div>`);
    }
}

function closeDetail() {
    var fab = document.getElementById('adminCamFab'); if (fab) fab.remove();
    var panel = document.getElementById('detailPanel');
    if (panel) {
        panel.classList.remove('open');
        var videos = panel.querySelectorAll('video');
        videos.forEach(function (v) {
            v.pause();
        });
        var imgs = panel.querySelectorAll('img');
        imgs.forEach(function (img) {
            if (img.dataset.tempBlobUrl) {
                URL.revokeObjectURL(img.dataset.tempBlobUrl);
                img.removeAttribute('data-temp-blob-url');
            }
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
// 🧠 5. FULL SCREEN MODAL & LIVE BOTTOM ROW
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
        if (window.fsIsStandalone) return;
        var threshold = 50;
        if (Math.abs(diffX) > threshold) {
            // Find current index based on fsDesignId to ensure sync when swiping from Cart!
            var deck = document.getElementById('dtDesigns');
            if (deck && typeof fsDesignId !== 'undefined') {
                var cards = Array.from(deck.querySelectorAll('.swipe-card')).filter(c => c.style.display !== 'none');
                var foundIdx = cards.findIndex(card => {
                    var cardDId = card.getAttribute('data-design') || 'DIRECT';
                    return cardDId === fsDesignId;
                });
                if (foundIdx !== -1) fsIndex = foundIdx;
            }

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
        window.fsIsStandalone = false; // THE FIX: Allow swiping from Cart!
        fsDesignId = dId;

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

        var curStock = pItem && pItem.stock && pItem.stock[dId] !== undefined ? pItem.stock[dId] : 999;
        var fsControls = document.querySelector('.fs-controls');
        if (fsControls) {
            if (!window.isAdminMode && curStock === 0) {
                fsControls.innerHTML = '<span style="background: red; color: white; padding: 6px 16px; border-radius: 4px; font-weight: bold; font-size: 16px;">PACKED</span>';
            } else {
                fsControls.innerHTML = '<button onclick="fsChg(-1)">−</button><span id="fsQty" style="font-size:36px; color:#fff; min-width:50px; text-align:center;">' + (cart[keyCart] ? cart[keyCart].qty : 0) + '</span><button onclick="fsChg(1)">+</button>';
            }
        }

        document.querySelectorAll('.fs-nav').forEach(n => n.style.display = 'none');

        fsModal.style.display = 'flex';
        pushHistoryState('fs');
        return;
    }

    window.fsIsStandalone = false;
    document.querySelectorAll('.fs-nav').forEach(n => n.style.display = 'block');

    var deck = document.getElementById('dtDesigns');
    if (!deck) return;

    // 📱 Filter to only visible cards (images/videos that successfully loaded and aren't hidden)
    var cards = Array.from(deck.querySelectorAll('.swipe-card')).filter(card => card.style.display !== 'none');

    if (dId) {
        var foundIdx = cards.findIndex(card => {
            var cardDId = card.getAttribute('data-design') || 'DIRECT';
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

    dId = targetCard.getAttribute('data-design') || 'DIRECT';

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

    var curStock = window.curProduct && window.curProduct.stock && window.curProduct.stock[fsDesignId] !== undefined ? window.curProduct.stock[fsDesignId] : 999;
    var fsControls = document.querySelector('.fs-controls');
    if (fsControls) {
        if (!window.isAdminMode && curStock === 0) {
            fsControls.innerHTML = '<span style="background: red; color: white; padding: 6px 16px; border-radius: 4px; font-weight: bold; font-size: 16px;">PACKED</span>';
        } else {
            fsControls.innerHTML = '<button onclick="fsChg(-1)">−</button><span id="fsQty" style="font-size:36px; color:#fff; min-width:50px; text-align:center;">' + (cart[key] ? cart[key].qty : 0) + '</span><button onclick="fsChg(1)">+</button>';
        }
    }

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
                    ' | Rate: ₹<input type="number" id="ie_rate_' + g.p.id + '" value="' + g.p.price + '" onchange="saveCartInlineEdit(\'' + g.p.id + '\', false)" style="width:60px; padding:2px 4px; border:1px solid #ccc; border-radius:4px; margin-right:4px;">' +
                    ' | Packing: <input type="text" id="ie_pack_' + g.p.id + '" value="' + safeText(g.p.packing || 1) + '" onchange="saveCartInlineEdit(\'' + g.p.id + '\', false)" style="width:40px; padding:2px 4px; border:1px solid #ccc; border-radius:4px;"></div>');
                cHtml.push('</div>');
                cHtml.push('<div style="display:flex; gap:8px; padding:10px; align-items:center;">');
                cHtml.push('<i class="fas fa-trash" onclick="deleteCartProduct(\'' + g.p.id + '\')" style="cursor:pointer; color:red; font-size:18px;" title="Delete Product"></i>');
                cHtml.push('<i class="fas fa-check-circle" onclick="saveCartInlineEdit(\'' + g.p.id + '\', true)" style="cursor:pointer; color:green; font-size:22px;" title="Done"></i>');
                cHtml.push('</div>');
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
                cHtml.push('<img id="' + imgId + '" src="' + window.dsMissingImage + '" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); ' + (!isEditing ? 'cursor: pointer;' : '') + '">');
                cHtml.push('<div style="font-size: 11px; margin-top: 4px; color:var(--text-light);">' + dLabel + '</div>');

                if (isEditing) {
                    cHtml.push('<input type="number" id="ie_qty_' + g.p.id + '_' + safeDesignLabel + '" value="' + (item.qty || 0) + '" onchange="saveCartInlineEdit(\'' + g.p.id + '\', false)" style="width:60px; padding:4px; border:1px solid var(--myntra-pink); border-radius:4px; text-align:center; font-size:12px; font-weight:bold; color:var(--text-main); margin-top:2px;">');
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
                    (function (group) {
                        group.items.forEach(function (item) {
                            var safeDesignLabel = item.design || 'DIRECT';
                            var imgId = "cart_img_" + group.p.id + "_" + safeDesignLabel.replace(/[^a-zA-Z0-9]/g, '');
                            var imgEl = document.getElementById(imgId);
                            if (!imgEl || !group.p.gridUrl) return;

                            var cleanGrid = group.p.gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                            var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');

                            window.findDesignKeyInCache(group.p.gridUrl, safeDesignLabel).then(function (cacheKey) {
                                var fallbackSVG = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#999">Design Not Found</text></svg>');

                                if (!cacheKey) {
                                    // Not found in cache. Try network guess as a last resort!
                                    var cleanNum2 = safeDesignLabel.replace(/\D/g, '');
                                    if (cleanNum2.length === 1) cleanNum2 = "0" + cleanNum2;
                                    if (!cleanNum2) cleanNum2 = safeDesignLabel;
                                    var fallbackUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(cleanNum2 + ".webp") + "?alt=media";

                                    fetch(fallbackUrl).then(function (res) {
                                        if (res.ok) return res.blob();
                                        throw new Error('Network failed');
                                    }).then(function (blob) {
                                        imgEl.src = URL.createObjectURL(blob);
                                        saveImageToDB(fallbackUrl, blob); // Cache it for future!
                                    }).catch(function () {
                                        imgEl.src = fallbackSVG;
                                    });
                                    return;
                                }

                                getImageFromDB(cacheKey).then(function (blob) {
                                    if (blob) {
                                        imgEl.src = URL.createObjectURL(blob);
                                    } else {
                                        imgEl.src = fallbackSVG;
                                    }
                                }).catch(function () {
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
    var fileName = "cover.webp"; // Default to cover.webp
    try {
        if (dId === 'DIRECT' || dId === 'Cover') {
            var fMap = JSON.parse(localStorage.getItem("dsFallbackMap") || "{}");
            if (fMap[folderPath]) fileName = fMap[folderPath];
        }
    } catch (e) { }
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
// ðŸ“¦ 2. MODAL & SHARE LOGIC (MULTI-IMAGE UPGRADE)
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
            if (allHighResUrls.length > 100) {
                alert("⚠ ï¸ WhatsApp limits sharing to 100 images at a time. Only the first 100 items will be sent successfully.");
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

window.openCartFs = function (productId, designId, cartImgSrc) {
    var actualProductId = curProduct ? curProduct.id : productId;

    // THE FIX: Pre-load the swipe deck in the background so swiping works correctly!
    openDetail(actualProductId, true, true);

    // Open full screen viewer instantly with the clicked cart image
    openFs(actualProductId, 0, designId, cartImgSrc);
};

// ðŸš€ Cart fullscreen: loads image from IndexedDB using exact cache key, then opens FS
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

        // THE FIX: Sync design ID and preload product images so they can SWIPE!
        fsDesignId = designId;
        window.fsIsStandalone = false;
        openDetail(productId, true, true);
    }

    window.findDesignKeyInCache(gridUrl, designId).then(async function (gridCacheKey) {
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
            if (typeof window.logAppError === 'function') {
                window.logAppError('AUDITOR: Cart Cache Miss', `CRITICAL: Cart item missing from storage. | Product: ${pItem ? pItem.name : productId} - Design: ${designId}`);
            }
            // Professional visual fallback for the user:
            showInFullscreen(window.dsMissingImage);
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
window.fetchWithRetry = async function (url, options = {}, retries = 3) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error("Device is offline");
    }
    if (typeof url === 'string' && (url.includes('firebasestorage.googleapis.com') || url.includes('firestore.googleapis.com'))) {
        try {
            var token = "";
            if (window.CapacitorFirebaseAuthentication) {
                var tRes = await window.CapacitorFirebaseAuthentication.getIdToken();
                if (tRes && tRes.token) token = tRes.token;
            } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                token = await firebase.auth().currentUser.getIdToken();
            }
            if (token) {
                options.headers = options.headers || {};
                if (!options.headers['Authorization']) options.headers['Authorization'] = 'Bearer ' + token;
            }
        } catch (e) { }
    }
    for (let i = 0; i < retries; i++) {
        try {
            var res = await fetch(url, options);
            if (res.ok) return res;
            if (res.status === 404) return res; // Don't retry true 404s
            throw new Error("HTTP " + res.status);
        } catch (err) {
            if (i === retries - 1) {
                if (err.message.includes("HTTP")) return res; // Return the failed response on last try
                throw err; // Throw network errors
            }
            await new Promise(r => setTimeout(r, 1000 + (i * 1000))); // Backoff
        }
    }
    return fetch(url, options); // Last ditch
};

window.isSyncing = false;
async function syncImages(silent = false) {
    var bootScreen = document.getElementById('boot');
    var bootMsg = document.getElementById('bootMsg');
    var syncIcon = document.querySelector('.fa-sync-alt');

    if (window.isSyncing) {
        if (bootScreen && !silent) bootScreen.style.display = 'flex';
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
        const res = await window.fetchWithRetry(FIRESTORE_PRODUCTS_URL);
        const data = await res.json();
        var docs = data.documents || [];

        var productsToSync = [];
        docs.forEach(d => {
            var f = d.fields || {};
            var name = f.name ? f.name.stringValue : "";
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

        var total = productsToSync.length;
        var count = 0;
        var failed = 0;
        var failedList = [];
        var bucket = "durga-sarees.firebasestorage.app";
        var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

        if (bootMsg) bootMsg.innerText = "Smart syncing 0 / " + total + "...";

        // ðŸ›¡ï¸  BATCH LIMIT: Process 1 folder at a time, but fetch its inner images in parallel (Max 5 concurrent).
        // This guarantees we never hit Samsung/Android OS TCP socket connection limits (ERR_INSUFFICIENT_RESOURCES).
        var batchSize = 40;
        for (var i = 0; i < productsToSync.length; i += batchSize) {
            var batch = productsToSync.slice(i, i + batchSize);
            await Promise.all(batch.map(async (p) => {
                var cleanGrid = p.gridUrl.trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.trim()).join('/');
                var encGridPath = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('%2F');
                var listPrefix = cleanGrid.split('/').map(s => encodeURIComponent(s)).join('/') + '/';
                var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + listPrefix + "&delimiter=/";
                var lastFailReason = "";
                var downloaded = false;

                // â”€â”€ 1. Fetch Firebase folder listing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                var folderFiles = []; // filenames only (e.g. "01.webp", "02.webp")
                var listSuccess = false;
                try {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 30000);
                    // ðŸ›¡ï¸ CRITICAL FIX: Bulletproof retry for "failed to fetch"
                    var listRes = await window.fetchWithRetry(listUrl, { signal: ctrl.signal }, 3);
                    clearTimeout(tid);
                    if (listRes.ok) {
                        var listData = await listRes.json();
                        if (!window.dsFolderCache) window.dsFolderCache = {};
                        window.dsFolderCache[listUrl] = listData.items || [];
                        try { localStorage.setItem("dsFolderCache", JSON.stringify(window.dsFolderCache)); } catch (e) { }

                        folderFiles = (listData.items || [])
                            .map(item => item.name.substring(item.name.lastIndexOf('/') + 1))
                            .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));
                        listSuccess = true;
                    } else {
                        lastFailReason = "List HTTP " + listRes.status;
                    }
                } catch (e) {
                    lastFailReason = "List failed: " + (e.name === 'AbortError' ? 'Timeout (15s)' : e.message);
                    window.logAppError('syncImages List', lastFailReason + " | " + p.name);
                }

                if (!listSuccess) {
                    // Offline / error â€” keep existing cache, log error
                    var existingCover = await checkImageInDB(p.gridUrl);
                    if (existingCover) downloaded = true;
                    else lastFailReason = lastFailReason || "Offline & no local cache";

                } else if (folderFiles.length === 0) {
                    // Firebase folder is EMPTY â€” keep existing cover, do NOT delete
                    downloaded = true;
                    console.log("[SYNC] Folder empty for", p.name, "- keeping cached cover.");

                } else {
                    // Sort files: 01.webp first, then 02, 03...
                    folderFiles.sort((a, b) =>
                        (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999));

                    // Build the full Firebase URL keys that should exist in DB
                    // Cover = first file, key stored as gridUrl (bare folder path)
                    // Designs = each file, key stored as full Firebase URL
                    var coverFile = folderFiles[0];
                    var coverUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(coverFile) + "?alt=media";
                    var designKeys = {}; // key â†’ url map for all files
                    folderFiles.forEach(f => {
                        var key = fbBase + encGridPath + "%2F" + encodeURIComponent(f) + "?alt=media";
                        designKeys[key] = key;
                    });

                    // â”€â”€ 2. Cleanup: Delete from DB keys NOT in Firebase anymore â”€â”€
                    // Scan DB for all keys that belong to this product's folder
                    var dbKeyPrefix = fbBase + encGridPath + "%2F";
                    var cachedKeys = await listDBKeysForPrefix(dbKeyPrefix);
                    for (var ck of cachedKeys) {
                        if (!designKeys[ck]) {
                            await deleteImageFromDB(ck);
                            console.log("[SYNC] Deleted stale cache:", ck);
                        }
                    }

                    // ——— 3. Download the COVER file —————————————————————————————————
                    var coverUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(coverFile) + "?alt=media";
                    var existingCover = await checkImageInDB(p.gridUrl);

                    if (existingCover) {
                        downloaded = true;
                    } else {
                        try {
                            const ctrl2 = new AbortController();
                            const tid2 = setTimeout(() => ctrl2.abort(), 30000);
                            // 🛡️ CRITICAL FIX: Bulletproof retry for cover image
                            var coverRes = await window.fetchWithRetry(coverUrl, { signal: ctrl2.signal }, 3);
                            clearTimeout(tid2);

                            if (coverRes.ok) {
                                var coverBlob = await coverRes.blob();
                                if (coverBlob.size === 0) {
                                    lastFailReason = "Cover image is 0 bytes (corrupted)";
                                    if (typeof window.logAppError === 'function') window.logAppError('Sync Corrupt Image', coverFile + " | " + p.name);
                                    downloaded = false;
                                } else {
                                    await saveImageToDB(p.gridUrl, coverBlob); // key = folder path string
                                    await saveImageToDB(coverUrl, coverBlob);  // 🛡️ CRITICAL: Also save under its full URL!
                                    downloaded = true;
                                }
                            } else {
                                lastFailReason = "Cover HTTP " + coverRes.status;
                            }
                        } catch (e) {
                            lastFailReason = "Cover fetch: " + (e.name === 'AbortError' ? 'Timeout (30s)' : e.message);
                        }
                    }

                    // ——— 4. Download remaining design files (FAST PARALLEL BATCHING) ——————————————————
                    if (downloaded) {
                        var innerBatchSize = 2; // Download 2 inner images concurrently!
                        var remainingFiles = folderFiles.filter(f => f !== coverFile);
                        for (var fIdx = 0; fIdx < remainingFiles.length; fIdx += innerBatchSize) {
                            var fBatch = remainingFiles.slice(fIdx, fIdx + innerBatchSize);
                            await Promise.all(fBatch.map(async (fname) => {
                                var designUrl = fbBase + encGridPath + "%2F" + encodeURIComponent(fname) + "?alt=media";
                                var existing = await checkImageInDB(designUrl);
                                if (existing) return; // already in cache
                                try {
                                    const ctrl3 = new AbortController();
                                    const tid3 = setTimeout(() => ctrl3.abort(), 30000);
                                    // 🛡️ CRITICAL FIX: Bulletproof retry for inner images
                                    var dRes = await window.fetchWithRetry(designUrl, { signal: ctrl3.signal }, 3);
                                    clearTimeout(tid3);
                                    if (dRes.ok) {
                                        var dBlob = await dRes.blob();
                                        if (dBlob.size === 0) {
                                            if (typeof window.logAppError === 'function') window.logAppError('Sync Corrupt Image', fname + " | " + p.name);
                                            downloaded = false;
                                            lastFailReason = (lastFailReason ? lastFailReason + ", " : "Corrupted: ") + fname;
                                        } else {
                                            await saveImageToDB(designUrl, dBlob);
                                        }
                                    } else {
                                        window.logAppError('AUDITOR: Sync Engine Failure', `Missing File: HTTP ${dRes.status} | ${fname} | ${p.name}`);
                                    }
                                } catch (e) {
                                    console.warn("[SYNC] Fast design fetch failed:", fname, e.message); if (typeof window.logAppError === 'function') window.logAppError('Sync Inner Image', e.message + " | " + p.name);
                                }
                            }));
                        }
                    }
                }

                // â”€â”€ 5. Track errors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (!downloaded) {
                    failed++;
                    failedList.push({ name: p.name, path: p.gridUrl, reason: lastFailReason });
                    console.error("âŒ SYNC FAILED:", p.name, "|", lastFailReason);
                    if (!window.syncReportResults) window.syncReportResults = [];
                    var syncErrKey = p.gridUrl;
                    var existing2 = window.syncReportResults.find(r => r._gridUrl === syncErrKey);
                    if (existing2) {
                        existing2.error = "Sync Failed: " + lastFailReason;
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

            if (silent) {
                await new Promise(resolve => setTimeout(resolve, 350));
            }
        }

        if (bootScreen && !silent) bootScreen.style.display = 'none';
        window.isSyncing = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');

        if (silent) {
            // Background sync update: update main screen layout with newly localized grid imagery
            renderProductGrid(displayList);
            return;
        }

        if (failed > 0) {
            var elSum = document.getElementById('syncReportSummary');
            var elDet = document.getElementById('syncReportDetails');
            if (elSum && elDet) {
                elSum.innerText = "Sync done: " + (total - failed) + " OK, " + failed + " failed.";
                elSum.style.color = "var(--myntra-pink)";
                var html = "";
                failedList.forEach(f => {
                    html += `<div style="margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px;">
                                <span style="font-weight: bold;">${f.name}</span><br>
                                <span style="color: red;">Error: ${f.reason}</span>
                             </div>`;
                });
                elDet.innerHTML = html;
                openModal('syncResultsModal');
            } else {
                alert("Sync done. " + failed + " failed. (UI missing)");
            }
        } else {
            var elSum = document.getElementById('syncReportSummary');
            var elDet = document.getElementById('syncReportDetails');
            if (elSum && elDet) {
                elSum.innerText = "✅ Sync complete!";
                elSum.style.color = "#25D366";
                elDet.innerHTML = "<div style='text-align:center; padding: 20px;'>All " + total + " products synced successfully!</div>";
                openModal('syncResultsModal');
            } else {
                alert("✅ Sync complete! All " + total + " products synced.");
            }
        }

        initApp();

    } catch (err) {
        window.isSyncing = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');
        if (bootScreen && !silent) bootScreen.style.display = 'none';
        if (!silent) alert("Sync error: " + err.message);
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

function showDevLog(msg, isErr) {
    var d = document.createElement('div');
    d.style.position = 'fixed'; d.style.bottom = '20px'; d.style.left = '10px'; d.style.right = '10px';
    d.style.background = isErr ? '#c62828' : '#2e7d32'; d.style.color = '#fff';
    d.style.padding = '12px'; d.style.borderRadius = '8px'; d.style.zIndex = '999999';
    d.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)'; d.style.fontSize = '14px';
    d.innerText = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 7000);
}

function saveProductEdit(p) {
    if (!window.isSuperAdmin) {
        console.warn("Unauthorized edit attempt blocked.");
        return;
    }
    try {
        // 🚀 NEW: 2-WAY SYNC FROM PRODUCT PAGE - FIREBASE & EXCEL WEBHOOK
        if (p && p.docId) {
            showDevLog("Syncing Page: " + p.name + " -> Rate: " + p.price + " Pack: " + p.packing, false);
            
            var fbUpdateUrl = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + p.docId + "?updateMask.fieldPaths=price&updateMask.fieldPaths=packing";
            var payload = {
                fields: {
                    price: { integerValue: p.price },
                    packing: { stringValue: p.packing }
                }
            };

            window.fetchWithRetry(fbUpdateUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 1).then(res => {
                if (res.ok) showDevLog("✅ Firebase Updated: " + p.name, false);
                else showDevLog("❌ FB Err " + res.status + " - No Admin Perms?", true);
            }).catch(err => showDevLog("FB Net Err: " + err.message, true));

            if (window.DS_APP_SCRIPT_URL) {
                fetch(window.DS_APP_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'updateProductDetails',
                        productName: p.name,
                        price: p.price,
                        packing: p.packing
                    })
                }).then(r => r.json())
                  .then(data => {
                     if (!data.success) showDevLog("❌ Excel Err: " + data.msg, true);
                     else showDevLog("✅ Excel Updated: " + p.name, false);
                  }).catch(e => showDevLog("Excel Net Err: " + e.message, true));
            } else {
                showDevLog("❌ DS_APP_SCRIPT_URL is missing!", true);
            }
        } else {
            showDevLog("❌ p or docId missing for " + (p ? p.name : "unknown"), true);
        }
    } catch (e) { console.error("Error saving product edit:", e); }
}

function setupEditableFields() {
    var priceBot = document.getElementById('dtPriceBot');
    var packBot = document.getElementById('dtPackBot');

    // SECURITY: Remove contenteditable for non-admins
    if (!window.isSuperAdmin) {
        if (priceBot) priceBot.removeAttribute('contenteditable');
        if (packBot) packBot.removeAttribute('contenteditable');
        return;
    }

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

// ðŸ“± Listen to hybrid app native backbutton event to prevent app minimization and handle stack back transition
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
// ðŸ” SEARCH, SORT, FILTER & FAVORITES ENGINE
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

// ðŸ“± Listen to popstate to handle history back/forward navigation and close/open modals accordingly
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

function toggleHdrMenu(event) {
    if (event) event.stopPropagation();
    var menu = document.getElementById('hdrMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

['click', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, function (e) {
        var menu = document.getElementById('hdrMenu');
        if (menu && menu.style.display === 'block') {
            if (!menu.contains(e.target) && (!e.target.closest || !e.target.closest('.fa-ellipsis-v'))) {
                menu.style.display = 'none';
            }
        }
    })
);

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
// ðŸ›’ CART CUSTOMER DETAILS & EDIT MODALS
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
    } catch (e) { console.error(e); }
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
        } catch (e) { }
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
    if (!container) return;
    var primaryName = d.firm ? d.firm : d.name;
    var html = esc(primaryName) + (d.station ? ", " + esc(d.station) : "");
    container.innerHTML = html;
}

async function openCustomerDetailsModal() {
    var d = null;
    var stored = localStorage.getItem("dsCustomerDetails");
    if (stored) {
        try { d = JSON.parse(stored); } catch (e) { }
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

    if (!name || !station || !state) {
        err.innerText = "Please fill all required fields.";
        return;
    }

    btn.innerText = "Saving...";
    var d = { name: name, firm: firm, phone: phone, station: station, state: state };
    var stored = localStorage.getItem("dsCustomerDetails");
    var docId = null;
    if (stored) {
        try { docId = JSON.parse(stored).docId; } catch (e) { }
    }
    if (docId) d.docId = docId;

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
            if (data.name) {
                d.docId = data.name.split('/').pop();
                localStorage.setItem("dsCustomerDetails", JSON.stringify(d));
            }
        }
    } catch (e) { console.error("Firestore save err", e); }

    btn.innerText = "SAVE DETAILS";
    closeModals();
}

function toggleCartInlineEdit(productId) {
    window.cartEditingMap = window.cartEditingMap || {};
    window.cartEditingMap[productId] = true;
    openCart(); // Re-render to show input fields
}

function saveCartInlineEdit(productId, closeEdit = true) {
    if (!window.isSuperAdmin) {
        console.warn("Unauthorized cart edit attempt blocked.");
        return;
    }
    
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

    var productName = items.length > 0 ? items[0].p.name : "";

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

    // Save to edited memory so changes persist across cart wipes
    if (items.length > 0) {
        var edited = {};
        try { edited = JSON.parse(localStorage.getItem("dsEditedProducts")) || {}; } catch (e) { }
        edited[items[0].p.name] = { price: newRate, packing: newPacking };
        localStorage.setItem("dsEditedProducts", JSON.stringify(edited));
    }

    var matchP = allProducts.find(x => x.id === productId);
    if (matchP) {
        matchP.price = newRate;
        matchP.packing = newPacking;
    }

    localStorage.setItem("dsCart", JSON.stringify(cart));

    if (closeEdit) window.cartEditingMap[productId] = false;
    updateCartHeader();
    openCart(); // Re-render to show updated static text

    // 🚀 NEW: 2-WAY SYNC - FIREBASE & EXCEL WEBHOOK
    if (matchP && matchP.docId) {
        showDevLog("Syncing: " + matchP.name + " -> Rate: " + newRate + " Pack: " + newPacking, false);
        // Firebase Live DB Update
        var fbUpdateUrl = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + matchP.docId + "?updateMask.fieldPaths=price&updateMask.fieldPaths=packing";
        var payload = {
            fields: {
                price: { integerValue: newRate },
                packing: { stringValue: newPacking }
            }
        };

        window.fetchWithRetry(fbUpdateUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 1).then(res => {
            if (res.ok) showDevLog("✅ Firebase Updated: " + matchP.name, false);
            else showDevLog("❌ FB Err " + res.status + " - No Admin Perms?", true);
        }).catch(err => showDevLog("FB Net Err: " + err.message, true));

        // Excel Webhook Sync via Apps Script
        if (window.DS_APP_SCRIPT_URL) {
            fetch(window.DS_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'updateProductDetails',
                    productName: matchP.name,
                    price: newRate,
                    packing: newPacking
                })
            }).then(r => r.json())
              .then(data => {
                 if (!data.success) showDevLog("❌ Excel Err: " + data.msg, true);
                 else showDevLog("✅ Excel Updated: " + matchP.name, false);
              })
              .catch(e => showDevLog("Excel Net Err: " + e.message, true));
        } else {
             showDevLog("❌ DS_APP_SCRIPT_URL is missing!", true);
        }
    } else {
        showDevLog("❌ matchP or docId missing for " + productId, true);
    }
}

window.deleteCartProduct = function (productId) {
    var deletedAny = false;
    for (var k in cart) {
        if (cart[k].p && cart[k].p.id === productId) {
            delete cart[k];
            deletedAny = true;
        }
    }
    if (deletedAny) {
        var p = allProducts.find(x => x.id === productId);
        if (p) manageProductHDCache(p, 'DELETE');

        if (window.cartEditingMap) delete window.cartEditingMap[productId];
        updateCartHeader();
        localStorage.setItem("dsCart", JSON.stringify(cart));
        openCart();
    }
};

function printCartPdf() {
    var keys = Object.keys(cart);
    if (keys.length === 0) return alert("Your cart is empty!");
    if (typeof generateCartOrderPDF === 'function') {
        generateCartOrderPDF('print');
    } else {
        alert("PDF Engine not loaded!");
    }
}

// ====================================
// ðŸ” SYNC REPORT LOGIC
// ====================================

function openSyncReportModal() {
    closeModals();
    openModal('syncReportModal');
    window.showGlobalErrorLogs();
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

    var productsToScan = window.allProducts.filter(p => {
        var isWix = JSON.stringify(p).toLowerCase().includes("wix import");
        return p.name && p.name.toLowerCase() !== "temp" && p.name.toLowerCase() !== "unnamed" && !isWix;
    });
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
        status.innerText = "Scanning " + (i + 1) + " of " + total + ": " + p.name;

        var result = {
            id: p.id,
            name: p.name,
            sku: p.sku || '-',
            error: null,
            imageCount: 0,
            status: 'completed'
        };

        if (!p.gridUrl || String(p.gridUrl).trim() === "" || String(p.gridUrl).toLowerCase() === "none") {
            result.error = "No Grid Folder assigned";
            result.status = 'error';
            window.syncReportResults.push(result);
            renderSyncReportPartial();
            continue;
        }

        var cleanGridPath = String(p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('/') + '/';

        var listUrl = fbBase + cleanGridPath + "&delimiter=/";

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            // ðŸ›¡ï¸ Bulletproof Retry applied to Sync Report
            var res = await window.fetchWithRetry(listUrl, { signal: controller.signal }, 3);
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
        } catch (e) {
            result.error = "Failed: " + (e.name === 'AbortError' ? 'Connection Timeout (15s)' : e.message);
            result.status = 'error';
        }

        // Ensure grid image is in memory
        try {
            var isGridInMemory = await getImageFromDB(p.gridUrl);
            if (!isGridInMemory) {
                if (result.status !== 'error') {
                    result.error = "Grid missing from memory";
                    result.status = 'error';
                } else {
                    result.error += " | Grid missing";
                }
            }
        } catch (e) { }

        window.syncReportResults.push(result);
        renderSyncReportPartial();
    }

    bar.style.width = '100%';
    var errCount = window.syncReportResults.filter(r => r.status === 'error').length;
    status.innerText = "Scan complete! Found " + errCount + " errors.";
    btn.disabled = false;
    var btnResync = document.getElementById('btnResyncErrors');
    if (btnResync) btnResync.style.display = errCount > 0 ? 'inline-block' : 'none';
}

function renderSyncReportPartial() {
    var chkElement = document.getElementById('chkShowCompletedSync');
    var showCompleted = chkElement ? chkElement.checked : false;
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
    for (var c in catTotals) {
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

// ====================================
// RESYNC FAILED PRODUCTS LOGIC
// ====================================
async function resyncFailedProducts() {
    var errProducts = window.syncReportResults.filter(r => r.status === 'error');
    if (errProducts.length === 0) return;

    var btn = document.getElementById('btnRunSyncReport');
    var btnResync = document.getElementById('btnResyncErrors');
    var status = document.getElementById('syncReportStatus');
    var bar = document.getElementById('syncReportBar');
    var progress = document.getElementById('syncReportProgress');

    btn.disabled = true;
    btnResync.disabled = true;
    progress.style.display = 'block';
    bar.style.width = '0%';

    var bucket = "durga-sarees.firebasestorage.app";
    var fbBase = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/";

    for (var i = 0; i < errProducts.length; i++) {
        var result = errProducts[i];
        bar.style.width = ((i / errProducts.length) * 100) + '%';
        status.innerText = "Resyncing " + (i + 1) + " of " + errProducts.length + ": " + result.name;

        var p = window.allProducts.find(x => x.id === result.id);
        if (!p || !p.gridUrl || p.gridUrl === "None") {
            result.error = "Detailed: Product deleted or has no Grid Folder.";
            continue;
        }

        var cleanGridPath = String(p.gridUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            // 1. Fetch directory listing first
            var prefix = cleanGridPath + "/";
            var listUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o?prefix=" + prefix + "&delimiter=/";
            // ðŸ›¡ï¸ Bulletproof Retry applied to Resync
            var listRes = await window.fetchWithRetry(listUrl, { signal: controller.signal }, 3);

            if (!listRes.ok) {
                clearTimeout(timeoutId);
                result.error = "Detailed: List HTTP " + listRes.status + " (" + listRes.statusText + ")";
                continue;
            }

            var listData = await listRes.json();
            var folderFiles = (listData.items || [])
                .map(item => item.name.substring(item.name.lastIndexOf('/') + 1))
                .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));

            if (folderFiles.length === 0) {
                clearTimeout(timeoutId);
                result.error = "Detailed: No images found in Grid folder.";
                continue;
            }

            folderFiles.sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 999) - (parseInt(b.replace(/\D/g, '')) || 999));
            var coverFile = folderFiles[0];
            var gridImgUrl = fbBase + cleanGridPath + "%2F" + encodeURIComponent(coverFile) + "?alt=media";

            // 2. Fetch the actual cover image
            var res = await window.fetchWithRetry(gridImgUrl, { signal: controller.signal }, 3);
            clearTimeout(timeoutId);

            if (res.ok) {
                var blob = await res.blob();
                await saveImageToDB(gridImgUrl, blob);
                await saveImageToDB(p.gridUrl, blob); // ðŸ›¡ï¸ CRITICAL: Save using folder path key!

                // Update local cache mappings
                window.coverExistsMap = window.coverExistsMap || {};
                window.coverExistsMap[p.gridUrl] = true;
                saveCoverExistsMap();

                result.status = 'completed';
                result.error = "Resynced successfully (" + coverFile + ").";
                result.imageCount = 1;
            } else {
                result.error = "Detailed: HTTP " + res.status + " (" + res.statusText + ") for " + coverFile;
            }
        } catch (e) {
            result.error = "Detailed: " + (e.name === 'AbortError' ? 'Connection Timeout' : e.message);
        }

        renderSyncReportPartial();

        // Small delay to prevent connection overload
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    bar.style.width = '100%';
    var remainingErrCount = window.syncReportResults.filter(r => r.status === 'error').length;
    status.innerText = "Resync complete! " + remainingErrCount + " still failed.";
    btn.disabled = false;
    btnResync.disabled = false;
    if (remainingErrCount === 0) btnResync.style.display = 'none';
}


window.updateAdminStock = async function (element, docId, pid, dId, overrideVal = null) {
    if (element) element.style.backgroundColor = '#fff9c4'; // Yellow (Saving)
    try {
        var newVal = overrideVal !== null ? overrideVal : (parseInt(element.value) || 0);
        var url = "https://firestore.googleapis.com/v1/projects/durga-sarees/databases/(default)/documents/Products/" + docId + "?updateMask.fieldPaths=stock.%60" + dId + "%60";
        var payload = {
            fields: {
                stock: {
                    mapValue: {
                        fields: {
                            [dId]: { integerValue: newVal }
                        }
                    }
                }
            }
        };
        var res = await window.fetchWithRetry(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 1);
        if (res.ok) {
            if (element) element.style.backgroundColor = '#c8e6c9'; // Green (Success)
            var p = allProducts.find(x => x.id === pid);
            if (p) {
                if (!p.stock) p.stock = {};
                p.stock[dId] = newVal;

                var designKeys = Object.keys(p.stock).filter(k => k !== 'FULLY_PACKED');
                var designSum = designKeys.reduce((a, k) => a + p.stock[k], 0);

                if (designKeys.length > 0) {
                    p.totalStock = designSum > 0 ? designSum : 0;
                } else {
                    p.totalStock = p.stock['FULLY_PACKED'] === 1 ? 0 : 999;
                }
            }
            if (element) {
                setTimeout(() => { element.style.backgroundColor = ''; }, 1000);
            }
        } else {
            if (element) element.style.backgroundColor = '#ffcdd2'; // Red (Fail)
            if (typeof window.logAppError === 'function') window.logAppError('updateAdminStock', 'HTTP ' + res.status);
        }
    } catch (e) {
        if (element) element.style.backgroundColor = '#ffcdd2'; // Red (Fail)
        if (typeof window.logAppError === 'function') window.logAppError('updateAdminStock', e.message);
    }
};


window.toggleAllBulkCheckboxes = function (checked) {
    var boxes = document.querySelectorAll('.admin-bulk-check');
    boxes.forEach(box => box.checked = checked);
};

window.applyBulkAdminStock = async function () {
    var qtyInput = document.getElementById('adminBulkQtyInput');
    var boxes = document.querySelectorAll('.admin-bulk-check:checked');
    if (boxes.length === 0) { alert('No designs selected.'); return; }
    if (!qtyInput || qtyInput.value === '') { alert('Please enter a quantity.'); return; }

    var btn = event.currentTarget;
    btn.disabled = true;
    btn.innerText = 'UPDATING...';

    var allBoxes = document.querySelectorAll('.admin-bulk-check');
    var isPackingAll = (boxes.length === allBoxes.length && qtyInput.value === '0');

    // Process sequentially to avoid 409 Contention error
    for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        var did = box.getAttribute('data-did');
        var pid = box.getAttribute('data-pid');
        var docid = box.getAttribute('data-docid');

        // Find the input element associated with this design to pass to updateAdminStock
        // The input is right next to it in the DOM
        var stockInput = box.closest('.swipe-card').querySelector('.admin-stock-input');
        if (stockInput) {
            stockInput.value = qtyInput.value;
            // Await the update to prevent overloading firestore
            await window.updateAdminStock(stockInput, docid, pid, did);
        }
    }

    if (isPackingAll && boxes.length > 0) {
        var docid = boxes[0].getAttribute('data-docid');
        var pid = boxes[0].getAttribute('data-pid');
        await window.updateAdminStock(null, docid, pid, 'FULLY_PACKED', 1);
    } else if (boxes.length > 0) {
        var docid = boxes[0].getAttribute('data-docid');
        var pid = boxes[0].getAttribute('data-pid');
        await window.updateAdminStock(null, docid, pid, 'FULLY_PACKED', 0);
    }

    btn.disabled = false;
    btn.innerText = 'APPLY';
    // Uncheck all after applying
    document.getElementById('adminBulkCheckAll').checked = false;
    window.toggleAllBulkCheckboxes(false);
    qtyInput.value = '';
};

window.showGlobalErrorLogs = function () {
    var container = document.getElementById('syncReportBody');
    if (!container) return;

    var logs = window.globalErrorLog || [];

    if (logs.length === 0) {
        container.innerHTML = '<div style="padding:15px; color:#2e7d32; font-weight:bold; text-align:center; background:#e8f5e9; border-radius:6px;">✅ No anomalies detected. System is clean.</div>';
        return;
    }

    var html = '<div style="margin-bottom:10px; font-weight:bold; color:#d32f2f;">System Error Logs (Latest First)</div>';
    html += '<div style="margin-bottom:15px; display:flex; gap:10px;">';
    html += '<button onclick="window.globalErrorLog=[]; localStorage.setItem(\'dsGlobalErrors\',\'[]\'); window.showGlobalErrorLogs();" style="flex:1; background:#e53935; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Clear Logs</button>';
    html += '<button onclick="if(typeof resyncFailedProducts === \'function\') { resyncFailedProducts(); } else { alert(\'Sync report not available.\'); }" style="flex:2; background:#1976d2; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Log Resync Only</button>';
    html += '</div>';

    // Reverse loop to show the newest errors at the top
    for (var i = logs.length - 1; i >= 0; i--) {
        var log = logs[i];
        var dateStr = new Date(log.ts || new Date()).toLocaleTimeString();
        html += '<div style="margin-bottom:8px; padding:10px; border-radius:6px; background:#ffebee; border:1px solid #ffcdd2; font-size:12px; text-align:left;">';
        html += '<div style="color:#b71c1c; font-weight:bold; margin-bottom:4px; border-bottom:1px dashed #ef9a9a; padding-bottom:4px;">' + (log.src || 'AUDITOR') + ' <span style="float:right; color:#757575; font-weight:normal;">' + dateStr + '</span></div>';
        html += '<div style="color:#333; word-wrap:break-word;">' + (log.msg || log.message || JSON.stringify(log)) + '</div>';
        html += '</div>';
    }

    container.innerHTML = html;
};

// --- OUTBOX SYSTEM ---
window.saveToOutbox = function (docId, designId, fileUri, productName) {
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction("outbox", "readwrite");
            var req = tx.objectStore("outbox").put({ docId, designId, fileUri, productName, ts: Date.now(), processAfter: Date.now() + 5000 });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    });
};

window.getOutboxItems = function () {
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction("outbox", "readonly");
            var req = tx.objectStore("outbox").getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    });
};

window.deleteFromOutbox = function (keyId) {
    return getDB().then(db => {
        return new Promise((resolve) => {
            var tx = db.transaction("outbox", "readwrite");
            tx.objectStore("outbox").delete(keyId);
            tx.oncomplete = () => resolve(true);
        });
    });
};

window.tempCamDocId = null;
window.tempCamPhotoPath = null;
window.tempCamPid = null;

window.triggerAdminCamera = async function (docId, pid, productName = "Product Preview") {
    var defaultDesignId = "02";
    if (window.lastRenderedDesignNames) {
        var names = window.lastRenderedDesignNames.split(',');
        var maxNum = 1;
        names.forEach(n => {
            if (/^\d{1,4}$/.test(n)) {
                var num = parseInt(n, 10);
                if (num > maxNum) maxNum = num;
            }
        });
        defaultDesignId = (maxNum + 1).toString().padStart(2, '0');
    }

    try {
        // High Quality Native Camera
        var photo = await Capacitor.Plugins.Camera.getPhoto({ quality: 100, allowEditing: false, resultType: 'uri', source: 'CAMERA' });

        window.tempCamDocId = docId;
        window.tempCamPid = pid;
        window.tempCamPhotoPath = photo.path || photo.webPath;

        var modal = document.getElementById('adminCameraPreviewModal');
        var previewImg = document.getElementById('adminPreviewImg');
        var designInput = document.getElementById('adminDesignNumberInput');
        var nameLabel = document.getElementById('adminPreviewProductName');

        if (previewImg) previewImg.src = photo.webPath;
        if (designInput) designInput.value = defaultDesignId;

        // Grab product name dynamically if not passed cleanly
        var detailTitle = document.getElementById('detailTitle');
        if (nameLabel) {
            nameLabel.value = (detailTitle && detailTitle.innerText) ? detailTitle.innerText : productName;
        }

        if (modal) modal.style.display = 'flex';

    } catch (e) {
        window.logAppError('Camera Trigger', e.message);
    }
};

window.retakeAdminPhoto = function () {
    var modal = document.getElementById('adminCameraPreviewModal');
    if (modal) modal.style.display = 'none';
    window.triggerAdminCamera(window.tempCamDocId, window.tempCamPid);
};

window.confirmAdminUpload = async function () {
    var modal = document.getElementById('adminCameraPreviewModal');
    var designInput = document.getElementById('adminDesignNumberInput');
    var finalDesignId = (designInput && designInput.value) ? designInput.value.trim().toUpperCase() : "02";

    if (modal) modal.style.display = 'none';

    try {
        var outboxId = await window.saveToOutbox(window.tempCamDocId, finalDesignId, window.tempCamPhotoPath);
        if (outboxId) {
            var toastId = 'undoToast_' + Date.now();
            var toastHtml = `<div id="${toastId}" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#323232; color:#fff; padding:12px 20px; border-radius:4px; font-size:14px; box-shadow:0 3px 10px rgba(0,0,0,0.3); z-index:9999; display:flex; align-items:center; gap:15px;">
                <span>Photo Saved to Outbox.</span>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', toastHtml);

            setTimeout(() => {
                var toastEl = document.getElementById(toastId);
                if (toastEl) toastEl.remove();
                window.processCameraOutbox();
            }, 5000);
        }
    } catch (e) {
        window.logAppError('Confirm Upload', e.message);
    }
};

window.undoOutbox = async function (outboxId, toastId) {
    await window.deleteFromOutbox(outboxId);
    var toastEl = document.getElementById(toastId);
    if (toastEl) toastEl.remove();
    var feedbackHtml = `<div id="deletedToast" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#323232; color:#ff4081; padding:10px 20px; border-radius:4px; font-size:14px; z-index:9999;">Photo Upload Cancelled</div>`;
    document.body.insertAdjacentHTML('beforeend', feedbackHtml);
    setTimeout(() => {
        var el = document.getElementById('deletedToast');
        if (el) el.remove();
    }, 2000);
};

window.processCameraOutbox = async function () {
    if (window.isOutboxSyncing) return;
    window.isOutboxSyncing = true;
    var hasSkippedItems = false;
    try {
        var items = await window.getOutboxItems();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            // Time-lock check: skip if still within the 5-second UNDO window
            if (item.processAfter && Date.now() < item.processAfter) {
                hasSkippedItems = true;
                continue;
            }

            var safeName = item.productName ? encodeURIComponent(item.productName) : "NA";
            var filename = `${item.docId}___${item.designId}___${safeName}___${item.ts}.jpg`;
            try {
                var uploadStartTime = Date.now();
                var fileData = await Capacitor.Plugins.Filesystem.readFile({ path: item.fileUri });
                var res = await fetch(`data:image/jpeg;base64,${fileData.data}`);
                var blob = await res.blob();

                var uploadUrl = `https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o?name=Uploads%2FRaw%2F` + encodeURIComponent(filename);

                var uploadRes = await window.fetchWithRetry(uploadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: blob
                }, 1);

                if (uploadRes.ok) {
                    await window.deleteFromOutbox(item.id);
                    var uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
                    var totalJourney = ((Date.now() - item.ts) / 1000).toFixed(2);
                    window.logAppError('Upload Success', `File: ${filename} | Net Time: ${uploadDuration}s | Total Journey: ${totalJourney}s`);
                    console.log(`✅ Successfully uploaded: ${filename} in ${uploadDuration}s`);
                } else {
                    throw new Error(`Status ${uploadRes.status}`);
                }
            } catch (err) {
                window.logAppError('Outbox Uploader', 'Failed to upload ' + filename + ': ' + err.message);
            }
        }
    } catch (e) {
        console.error("Outbox process error", e);
    } finally {
        window.isOutboxSyncing = false;
        // If items were skipped due to time-lock while uploader was active, schedule a sweep
        if (hasSkippedItems) {
            setTimeout(window.processCameraOutbox, 2500);
        }
    }
};












// ==========================================
// 🖨️ NAS PRINT RELAY: HTML-TO-BITMAP TSPL ENGINE
// ==========================================

window.currentPrintType = null;
window.currentPrintCanvas = null;

function previewLabel(type) {
    if (!curProduct) return;
    window.currentPrintType = type;

    var typeLabels = { barcode: '(Barcode)', tag: '(Tag)', sticker: '(Sticker)' };
    document.getElementById('printTypeSpan').innerText = typeLabels[type] || '';

    var stickerContainer = document.getElementById('stickerPreviewContainer');
    var canvasContainer = document.getElementById('printPreviewCanvasContainer');
    var tagEditor = document.getElementById('tagEditorContainer');

    // Reset visibility
    stickerContainer.style.display = 'none';
    canvasContainer.style.display = 'block';
    tagEditor.style.display = 'none';
    window.currentPrintCanvas = null;

    var cdObj = JSON.parse(localStorage.getItem("dsCustomerDetails") || "{}");
    var firmName = cdObj.firm || "DURGA SAREES";

    if (type === 'sticker') {
        // ── LIVE EDITABLE STICKER MODE ─────────────────────────────────────
        stickerContainer.style.display = 'block';
        canvasContainer.style.display = 'none';

        // Pre-fill the editable fields with current product data
        document.getElementById('stkProduct').innerText = curProduct.name || 'Product Name';
        document.getElementById('stkPrice').innerText = '\u20b9' + (curProduct.price || '0');
        document.getElementById('stkDesign').innerText = '00';
        document.getElementById('stkFabric').innerText = curProduct.fabric || 'Standard Fabric';
        document.getElementById('stkCut').innerText = curProduct.cut || '6.30 Mtr';

        var prodImg = document.getElementById('img_' + curProduct.id);
        if (prodImg && prodImg.src) {
            document.getElementById('stkProductImg').src = prodImg.src;
        }

        // Generate QR code (encodes SKU so it can be scanned)
        var qrEl = document.getElementById('stkQRCode');
        qrEl.innerHTML = '';
        if (window.QRCode) {
            new QRCode(qrEl, {
                text: curProduct.sku || curProduct.name || 'DS',
                width: 100,
                height: 100,
                correctLevel: QRCode.CorrectLevel.M
            });
        }

        loadPrinters();
        openModal('printPreviewModal');
        return;
    }

    if (type === 'barcode') {
        document.getElementById('lbl_bc_firm').innerText = firmName;
        document.getElementById('lbl_bc_name').innerText = curProduct.name;
        document.getElementById('lbl_bc_price').innerText = curProduct.price || '0';
        document.getElementById('lbl_bc_pack').innerText = curProduct.packing || '1';

        var nameEl = document.getElementById('lbl_bc_name');
        nameEl.style.fontSize = '40px';
        if (curProduct.name.length > 20) nameEl.style.fontSize = '30px';
        if (curProduct.name.length > 30) nameEl.style.fontSize = '24px';

        JsBarcode("#lbl_bc_barcode", curProduct.sku || "00000", {
            format: "CODE128", width: 3, height: 100,
            displayValue: true, fontSize: 24, margin: 0
        });
    } else {
        tagEditor.style.display = 'block';

        document.getElementById('editTagDesc1').value = localStorage.getItem("dsTagDesc1") || "";
        document.getElementById('editTagDesc2').value = localStorage.getItem("dsTagDesc2") || "";
        document.getElementById('editTagCut').value = localStorage.getItem("dsTagCut") || "CUT 6 MTR + WTH BLOUSE";

        document.getElementById('lbl_tag_name').innerText = curProduct.name;
        document.getElementById('lbl_tag_desc1').innerText = document.getElementById('editTagDesc1').value;
        document.getElementById('lbl_tag_desc2').innerText = document.getElementById('editTagDesc2').value;
        document.getElementById('lbl_tag_cut').innerText = document.getElementById('editTagCut').value;
        document.getElementById('lbl_tag_sku').innerText = curProduct.sku || "-";

        var nameEl = document.getElementById('lbl_tag_name');
        nameEl.style.fontSize = '52px';
        if (curProduct.name.length > 15) nameEl.style.fontSize = '42px';
        if (curProduct.name.length > 22) nameEl.style.fontSize = '34px';
    }

    // Render barcode/tag via html2canvas
    var tplId = type === 'barcode' ? 'tpl_barcode' : 'tpl_tag';
    var tpl = document.getElementById(tplId);
    canvasContainer.innerHTML = 'Rendering...';

    loadPrinters();
    openModal('printPreviewModal');

    setTimeout(() => {
        html2canvas(tpl, { scale: 1 }).then(canvas => {
            window.currentPrintCanvas = canvas;
            var displayCanvas = document.createElement('canvas');
            var ctx = displayCanvas.getContext('2d');
            displayCanvas.width = canvas.width / 2;
            displayCanvas.height = canvas.height / 2;
            ctx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);
            displayCanvas.style.maxWidth = '100%';
            canvasContainer.innerHTML = '';
            canvasContainer.appendChild(displayCanvas);
        });
    }, 100);
}

// Called when typing in the editor inputs to live-update the canvas
function updateLiveLabel() {
    if (window.currentPrintType !== 'tag') return;
    
    var desc1 = document.getElementById('editTagDesc1').value;
    var desc2 = document.getElementById('editTagDesc2').value;
    var cut = document.getElementById('editTagCut').value;
    
    // Save defaults
    localStorage.setItem("dsTagDesc1", desc1);
    localStorage.setItem("dsTagDesc2", desc2);
    localStorage.setItem("dsTagCut", cut);
    
    // Update hidden HTML template
    document.getElementById('lbl_tag_desc1').innerText = desc1;
    document.getElementById('lbl_tag_desc2').innerText = desc2;
    document.getElementById('lbl_tag_cut').innerText = cut;
    
    // Re-render canvas
    var tpl = document.getElementById('tpl_tag');
    var container = document.getElementById('printPreviewCanvasContainer');
    
    html2canvas(tpl, { scale: 1 }).then(canvas => {
        window.currentPrintCanvas = canvas;
        var displayCanvas = document.createElement('canvas');
        var ctx = displayCanvas.getContext('2d');
        displayCanvas.width = canvas.width / 2;
        displayCanvas.height = canvas.height / 2;
        ctx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);
        displayCanvas.style.maxWidth = '100%';
        container.innerHTML = '';
        container.appendChild(displayCanvas);
    });
}

function confirmPrint() {
    var PRINTER_IP = document.getElementById('printerIpInput').value.trim();
    if (!PRINTER_IP) { alert("Please enter a Printer IP!"); return; }

    var qty = document.getElementById('printQtyInput').value;
    if (!qty || isNaN(qty) || parseInt(qty) < 1) return;

    var btn = document.getElementById('btnPrintConfirm');
    btn.innerText = "Rendering...";
    btn.disabled = true;

    var doSendCanvas = function(canvas) {
        var tsplPayload = generateTSPL(canvas, window.currentPrintType, parseInt(qty));
        var base64Payload = uint8ToBase64(tsplPayload);

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TcpSocket) {
            var TcpSocket = window.Capacitor.Plugins.TcpSocket;
            btn.innerText = "Connecting...";
            TcpSocket.connect({ ipAddress: PRINTER_IP, port: 9100 })
                .then(function(res) {
                    btn.innerText = "Sending...";
                    var clientId = res.client;
                    TcpSocket.send({ client: clientId, data: base64Payload, encoding: 'base64' })
                        .then(function() {
                            btn.innerText = "Sent ✅";
                            setTimeout(() => { TcpSocket.disconnect({ client: clientId }); }, 500);
                            setTimeout(() => { closeModals(); btn.innerText = "PRINT"; btn.disabled = false; }, 1500);
                        })
                        .catch(function(err) {
                            btn.innerText = "Send Error";
                            btn.disabled = false;
                            alert("Send failed: " + err.message);
                        });
                })
                .catch(function(err) {
                    btn.innerText = "Connect Error";
                    btn.disabled = false;
                    alert("TCP connect failed: " + err.message);
                });
        } else {
            btn.innerText = "No Printer Plugin";
            btn.disabled = false;
            alert("TcpSocket plugin not available.");
        }
    };

    if (window.currentPrintType === 'sticker') {
        // ── STICKER: render the live contenteditable template ─────────────
        var tpl = document.getElementById('stickerTemplate');

        // Temporarily hide the dashed preview border and focus indicators
        var origBorder = tpl.style.border;
        var origBoxShadow = tpl.style.boxShadow;
        tpl.style.border = 'none';
        tpl.style.boxShadow = 'none';
        // Also hide any active focus underlines on contenteditable fields
        ['stkProduct', 'stkPrice', 'stkDesign', 'stkFabric', 'stkCut'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.borderBottom = 'none';
        });

        setTimeout(function() {
            html2canvas(tpl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
                // Restore the preview styling
                tpl.style.border = origBorder;
                tpl.style.boxShadow = origBoxShadow;
                window.currentPrintCanvas = canvas;
                doSendCanvas(canvas);
            }).catch(function(err) {
                tpl.style.border = origBorder;
                tpl.style.boxShadow = origBoxShadow;
                btn.innerText = "Render Error";
                btn.disabled = false;
                alert("Could not render sticker: " + err.message);
            });
        }, 50);
    } else {
        // ── BARCODE / TAG: use the pre-rendered canvas ─────────────────────
        if (!window.currentPrintCanvas) { btn.innerText = "PRINT"; btn.disabled = false; return; }
        doSendCanvas(window.currentPrintCanvas);
    }
}

// ==========================================
// MULTI-PRINTER UI LOGIC
// ==========================================
function loadPrinters() {
    var printers = JSON.parse(localStorage.getItem('dsPrinters') || "[]");
    var sel = document.getElementById('printerSelect');
    sel.innerHTML = '<option value="">-- Add New Printer --</option>';
    
    printers.forEach((p, i) => {
        var opt = document.createElement('option');
        opt.value = i;
        opt.innerText = p.name + " (" + p.ip + ")";
        sel.appendChild(opt);
    });

    // Auto-select the last used IP for this type
    var lastIp = window.currentPrintType === 'barcode' ? localStorage.getItem("dsBarcodePrinterIp") : localStorage.getItem("dsTagPrinterIp");
    
    if (lastIp) {
        var foundIdx = printers.findIndex(p => p.ip === lastIp);
        if (foundIdx !== -1) {
            sel.value = foundIdx;
            document.getElementById('printerNameInput').value = printers[foundIdx].name;
            document.getElementById('printerIpInput').value = printers[foundIdx].ip;
        } else {
            sel.value = "";
            document.getElementById('printerNameInput').value = "";
            document.getElementById('printerIpInput').value = lastIp;
        }
    } else {
        sel.value = "";
        document.getElementById('printerNameInput').value = "";
        document.getElementById('printerIpInput').value = "";
    }
}

function onPrinterSelectChange() {
    var sel = document.getElementById('printerSelect');
    var printers = JSON.parse(localStorage.getItem('dsPrinters') || "[]");
    
    if (sel.value === "") {
        document.getElementById('printerNameInput').value = "";
        document.getElementById('printerIpInput').value = "";
    } else {
        var p = printers[sel.value];
        document.getElementById('printerNameInput').value = p.name;
        document.getElementById('printerIpInput').value = p.ip;
    }
}

function savePrinter() {
    var name = document.getElementById('printerNameInput').value.trim();
    var ip = document.getElementById('printerIpInput').value.trim();
    
    if (!name || !ip) {
        alert("Please enter both Name and IP Address!");
        return;
    }
    
    var printers = JSON.parse(localStorage.getItem('dsPrinters') || "[]");
    var sel = document.getElementById('printerSelect');
    
    if (sel.value === "") {
        // Add new
        printers.push({ name: name, ip: ip });
    } else {
        // Update existing
        printers[sel.value] = { name: name, ip: ip };
    }
    
    localStorage.setItem('dsPrinters', JSON.stringify(printers));
    
    // Set as default for this type
    if (window.currentPrintType === 'barcode') localStorage.setItem("dsBarcodePrinterIp", ip);
    else localStorage.setItem("dsTagPrinterIp", ip);
    
    loadPrinters();
    alert("Printer saved!");
}

function deletePrinter() {
    var sel = document.getElementById('printerSelect');
    if (sel.value === "") return;
    
    if (!confirm("Delete this printer?")) return;
    
    var printers = JSON.parse(localStorage.getItem('dsPrinters') || "[]");
    printers.splice(sel.value, 1);
    localStorage.setItem('dsPrinters', JSON.stringify(printers));
    loadPrinters();
}

function generateTSPL(canvas, type, qty) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var imgData = ctx.getImageData(0, 0, w, h).data;

    var widthBytes = Math.ceil(w / 8);
    var bitmapLength = widthBytes * h;
    var bitmapData = new Uint8Array(bitmapLength);

    // Floyd-Steinberg or simple thresholding to 1-bit monochrome
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 4;
            
            var r = imgData[i];
            var g = imgData[i+1];
            var b = imgData[i+2];
            var a = imgData[i+3];
            
            // Treat transparent pixels as white (background)
            if (a < 128) {
                r = 255; g = 255; b = 255;
            }
            
            // RGB to Grayscale
            var gray = (r * 0.299 + g * 0.587 + b * 0.114);
            var isBlack = gray < 128; // Simple threshold
            
            if (isBlack) {
                var byteIndex = (y * widthBytes) + Math.floor(x / 8);
                var bitIndex = 7 - (x % 8);
                bitmapData[byteIndex] |= (1 << bitIndex);
            }
        }
    }

    // TSPL Commands
    var headerStr = "";
    if (type === 'barcode') {
        headerStr += "SIZE 72 mm, 48 mm\r\n";
        headerStr += "GAP 3 mm, 0 mm\r\n";
    } else {
        headerStr += "SIZE 78 mm, 57 mm\r\n";
        headerStr += "GAP 0 mm, 0 mm\r\n"; // Continuous tearable
    }
    headerStr += "DIRECTION 0\r\n";
    headerStr += "CLS\r\n";
    
    // BITMAP X,Y,width_bytes,height,mode,bitmap_data
    var bitmapCmdStr = "BITMAP 0,0," + widthBytes + "," + h + ",0,";
    
    var footerStr = "\r\nPRINT " + (qty || 1) + "\r\n";

    var headerBytes = new TextEncoder().encode(headerStr + bitmapCmdStr);
    var footerBytes = new TextEncoder().encode(footerStr);

    var finalPayload = new Uint8Array(headerBytes.length + bitmapData.length + footerBytes.length);
    finalPayload.set(headerBytes, 0);
    finalPayload.set(bitmapData, headerBytes.length);
    finalPayload.set(footerBytes, headerBytes.length + bitmapData.length);

    return finalPayload;
}

function uint8ToBase64(u8Arr) {
    var CHUNK_SIZE = 0x8000;
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    var slice;
    while (index < length) {
        slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}
