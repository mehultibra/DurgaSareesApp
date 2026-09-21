window.stickerLayout = {
    width: 440,
    height: 220,
    elements: [
        { id: "stkTitle", type: "text", visible: true, x: 118, y: 10, fontSize: 20, fontWeight: "bold", text: "DURGA SAREES" },
        { id: "stkProduct", type: "text", visible: true, x: 118, y: 35, fontSize: 15, fontWeight: "bold", field: "name" },
        { id: "stkFabric", type: "text", visible: true, x: 118, y: 55, fontSize: 12, field: "fabric" },
        { id: "stkCut", type: "text", visible: true, x: 118, y: 70, fontSize: 12, fontStyle: "italic", field: "cut" },
        { id: "stkPrice", type: "text", visible: true, x: 118, y: 130, fontSize: 18, fontWeight: "bold", field: "price", prefix: "₹" },
        { id: "stkDesign", type: "text", visible: true, x: 118, y: 150, fontSize: 60, fontWeight: "900", field: "design" },
        { id: "stkQRCode", type: "qr", visible: true, x: 320, y: 55, w: 110, h: 110 }
    ]
};

let selectedElementId = null;
let isDragging = false;
let isResizing = false;
let startX, startY, initialElemX, initialElemY, initialElemW, initialElemH;
window.stickerFormatsMap = { "55x25mm": { width: 440, height: 220, gap_mm: 3 } };
window.stickerLayoutsMap = { "Default": { formatId: "55x25mm", elements: window.stickerLayout.elements } };
window.currentTemplateName = "Default";
window.defaultTemplateName = "Default";

async function loadStickerLayout() {
    try {
        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) return;
        const doc = await firebase.firestore().collection('Settings').doc('StickerTemplate').get();
        if (doc.exists) {
            const data = doc.data();
            
            if (data.formats && data.layouts) {
                window.stickerFormatsMap = data.formats;
                window.stickerLayoutsMap = data.layouts;
                window.defaultTemplateName = data.defaultLayoutName || Object.keys(data.layouts)[0];
            } else if (data.layouts) {
                // Legacy Schema Migration
                let newFormats = {};
                let newLayouts = {};
                for (let k in data.layouts) {
                    let old = data.layouts[k];
                    let w_mm = Math.round((old.width || 440) / 8);
                    let h_mm = Math.round((old.height || 220) / 8);
                    let fmtName = w_mm + "x" + h_mm + "mm";
                    
                    if (!newFormats[fmtName]) {
                        newFormats[fmtName] = {
                            width: old.width || 440, height: old.height || 220, gap_mm: old.gap_mm || 0,
                            marginTop: old.marginTop || 0, marginRight: old.marginRight || 0,
                            marginBottom: old.marginBottom || 0, marginLeft: old.marginLeft || 0
                        };
                    }
                    newLayouts[k] = { formatId: fmtName, elements: old.elements || [] };
                }
                window.stickerFormatsMap = newFormats;
                window.stickerLayoutsMap = newLayouts;
                window.defaultTemplateName = data.defaultLayoutName || Object.keys(newLayouts)[0];
                saveStickerLayout(true); // Auto-save migrated schema
            } else if (data.layout) {
                // Ultra legacy migration
                let old = data.layout;
                let fmtName = Math.round((old.width || 440)/8) + "x" + Math.round((old.height || 220)/8) + "mm";
                window.stickerFormatsMap = { [fmtName]: { width: old.width||440, height: old.height||220, gap_mm: old.gap_mm||0 } };
                window.stickerLayoutsMap = { "Default": { formatId: fmtName, elements: old.elements || [] } };
                window.defaultTemplateName = "Default";
                saveStickerLayout(true);
            }
            
            window.currentTemplateName = window.defaultTemplateName;
            buildCurrentStickerLayout();
            populateTemplateDropdown();
            populateFormatDropdown();
        } else {
            buildCurrentStickerLayout();
        }
    } catch(e) { console.error("Failed to load sticker layout", e); }
}

function buildCurrentStickerLayout() {
    if (!window.stickerLayoutsMap || !window.stickerFormatsMap) return;
    const layout = window.stickerLayoutsMap[window.currentTemplateName];
    if (!layout) return;
    const format = window.stickerFormatsMap[layout.formatId];
    if (!format) return;
    
    // Combine them into a single window.stickerLayout object so the rest of the app doesn't break
    window.stickerLayout = {
        ...format,
        elements: JSON.parse(JSON.stringify(layout.elements))
    };
    
    const formatLbl = document.getElementById('editorFormatLabel');
    if (formatLbl) {
        formatLbl.innerText = "(Format: " + layout.formatId + ")";
    }
}

function populateTemplateDropdown() {
    // Populate the dropdown in the Print Preview Modal
    const selPrint = document.getElementById('stickerTemplateSelect');
    // Populate the dropdown in the Sticker Editor
    const selEdit = document.getElementById('seActiveFormatSelect');
    
    const keys = Object.keys(window.stickerLayoutsMap);
    
    if (selPrint) {
        selPrint.innerHTML = '';
        keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            if (k === window.currentTemplateName) opt.selected = true;
            selPrint.appendChild(opt);
        });
        selPrint.style.display = keys.length > 0 ? 'block' : 'none';
    }
    
    if (selEdit) {
        selEdit.innerHTML = '';
        keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            if (k === window.currentTemplateName) opt.selected = true;
            selEdit.appendChild(opt);
        });
    }
}

function populateFormatDropdown() {
    const selFormat = document.getElementById('seActiveFormatIdSelect');
    if (!selFormat) return;
    
    selFormat.innerHTML = '';
    const keys = Object.keys(window.stickerFormatsMap);
    keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = k;
        // Select the format currently used by the active layout
        const currentLayout = window.stickerLayoutsMap[window.currentTemplateName];
        if (currentLayout && k === currentLayout.formatId) {
            opt.selected = true;
        }
        selFormat.appendChild(opt);
    });
}

window.changeStickerTemplate = function(name) {
    if (window.stickerLayoutsMap && window.stickerLayoutsMap[name]) {
        window.currentTemplateName = name;
        buildCurrentStickerLayout();
        
        // Sync the format dropdown to match the selected layout's format
        populateFormatDropdown();

        // If in Print Modal, update the format label and preview
        const pm = document.getElementById('printPreviewModal');
        if (pm && pm.style.display !== 'none') {
            const formatLbl = document.getElementById('printPreviewFormatLabel');
            if (formatLbl) {
                const layout = window.stickerLayoutsMap[name];
                formatLbl.innerText = layout ? "(Format: " + layout.formatId + ")" : "";
            }
            
            renderStickerTemplate('stickerTemplate', false);
            
            if (typeof updateStickerCanvasScale === 'function') {
                updateStickerCanvasScale('stickerTemplate');
            }
            
            if (typeof loadPrinters === 'function') {
                loadPrinters();
            }
        } else {
            // In editor mode
            renderStickerTemplate('stickerEditorCanvas', true);
            // Also sync the layout dropdown in the editor
            const selEdit = document.getElementById('seActiveFormatSelect');
            if (selEdit) selEdit.value = name;
        }
    }
};

window.changeStickerFormatSize = function(formatId) {
    if (window.stickerFormatsMap && window.stickerFormatsMap[formatId]) {
        // Update the current layout to use this new format size
        if (window.currentTemplateName && window.stickerLayoutsMap[window.currentTemplateName]) {
            window.stickerLayoutsMap[window.currentTemplateName].formatId = formatId;
            buildCurrentStickerLayout();
            
            // Re-render editor canvas to reflect the new size
            renderStickerTemplate('stickerEditorCanvas', true);
            
            // Also update the properties panel size inputs
            document.getElementById('seCanvasW_mm').value = Math.round(window.stickerLayout.width / 8);
            document.getElementById('seCanvasH_mm').value = Math.round(window.stickerLayout.height / 8);
            document.getElementById('seGap_mm').value = window.stickerLayout.gap_mm;
            document.getElementById('seMarginT_mm').value = Math.round(window.stickerLayout.marginTop / 8);
            document.getElementById('seMarginR_mm').value = Math.round(window.stickerLayout.marginRight / 8);
            document.getElementById('seMarginB_mm').value = Math.round(window.stickerLayout.marginBottom / 8);
            document.getElementById('seMarginL_mm').value = Math.round(window.stickerLayout.marginLeft / 8);
        }
    }
};

function renderStickerTemplate(containerId, isEditor = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    container.style.width = window.stickerLayout.width + 'px';
    container.style.height = window.stickerLayout.height + 'px';
    container.style.position = 'relative';

    window.stickerLayout.elements.forEach(el => {
        if (!el.visible && !isEditor) return;
        if (!el.visible) return; // Hide completely in editor too

        const div = document.createElement('div');
        div.id = (isEditor ? 'editor_' : 'print_') + el.id;
        div.style.position = 'absolute';
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        // Scale padding if element uses padding
        if (el.padding) {
            div.style.padding = el.padding + 'px';
        }

        if (isEditor) {
            div.style.cursor = 'move';
            div.style.border = selectedElementId === el.id ? '2px solid blue' : '1px dashed transparent';
            div.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); startDrag(e, el.id); };
            div.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); startDrag(e.touches[0], el.id); };

            if (el.w) {
                const handle = document.createElement('div');
                handle.style.position = 'absolute';
                handle.style.right = '-5px';
                handle.style.bottom = '-5px';
                handle.style.width = '10px';
                handle.style.height = '10px';
                handle.style.background = 'blue';
                handle.style.cursor = 'se-resize';
                handle.style.display = selectedElementId === el.id ? 'block' : 'none';
                handle.id = 'resize_' + el.id;
                handle.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); startResize(e, el.id); };
                handle.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); startResize(e.touches[0], el.id); };
                div.appendChild(handle);
            }
        }

        if (el.type === 'text') {
            div.style.fontSize = el.fontSize + 'px';
            div.style.fontWeight = el.fontWeight || 'normal';
            div.style.fontStyle = el.fontStyle || 'normal';
            div.style.textDecoration = el.textDecoration || 'none';
            div.style.color = '#000';
            
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.textAlign = 'center';
            if (el.w) div.style.width = el.w + 'px';
            if (el.h) div.style.height = el.h + 'px';
            div.style.overflow = 'hidden';
            
            if (el.multiline) {
                div.style.whiteSpace = 'pre-wrap';
            } else {
                div.style.whiteSpace = 'nowrap';
            }
            
            let rawVal = el.text || '';
            let defVal = '';
            if (el.field === 'name') { rawVal = window.curProduct?.name; defVal = 'Product Name'; }
            if (el.field === 'fabric') { rawVal = window.curProduct?.fabric; defVal = 'Fabric Details'; }
            if (el.field === 'cut') { rawVal = window.curProduct?.cut; defVal = 'Cut Details'; }
            if (el.field === 'price') { rawVal = window.curProduct?.price; defVal = '000'; }
            if (el.field === 'design') { rawVal = window.curProduct?.sku || window.curProduct?.design; defVal = 'Design No'; }
            
            if (!rawVal && isEditor) rawVal = defVal; // fallback for editor preview
            
            if (rawVal && String(rawVal).trim() !== '') {
                div.innerText = (el.prefix || '') + rawVal + (el.suffix || '');
                div.style.display = 'block';
            } else {
                div.innerText = '';
                div.style.display = 'none'; // Hide completely if blank
            }
            if (!isEditor) {
                div.contentEditable = "true";
                div.style.outline = "none";
                div.id = el.id; 
            }
        } else if (el.type === 'image') {
            div.style.width = el.w + 'px';
            div.style.height = el.h + 'px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.background = '#f5f5f6';
            div.style.overflow = 'hidden';
            
            const img = document.createElement('img');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            if (isEditor) {
                img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                img.style.pointerEvents = 'none';
            } else {
                img.id = 'stkProductImg'; 
            }
            div.appendChild(img);
        } else if (el.type === 'qr') {
            div.style.width = el.w + 'px';
            div.style.height = el.h + 'px';
            if (isEditor) {
                div.style.background = '#ddd';
                div.innerText = 'QR Code';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
            } else {
                div.id = 'stkQRCode'; 
            }
        }

        container.appendChild(div);
        
        // Generate QR Code if it's the QR element and not in editor
        if (el.type === 'qr' && !isEditor && window.QRCode && window.curProduct) {
            const productUrl = "https://durga-sarees.web.app/?pid=" + encodeURIComponent(window.curProduct.docId || window.curProduct.id);
            new window.QRCode(div, {
                text: productUrl,
                width: el.w,
                height: el.h,
                correctLevel: window.QRCode.CorrectLevel.M
            });
        }
    });

    // Add margin overlay (corner crop marks)
    if (isEditor && (window.stickerLayout.marginTop || window.stickerLayout.marginRight || window.stickerLayout.marginBottom || window.stickerLayout.marginLeft)) {
        const marginOverlay = document.createElement('div');
        marginOverlay.style.position = 'absolute';
        marginOverlay.style.top = (window.stickerLayout.marginTop || 0) + 'px';
        marginOverlay.style.right = (window.stickerLayout.marginRight || 0) + 'px';
        marginOverlay.style.bottom = (window.stickerLayout.marginBottom || 0) + 'px';
        marginOverlay.style.left = (window.stickerLayout.marginLeft || 0) + 'px';
        marginOverlay.style.pointerEvents = 'none';
        marginOverlay.style.zIndex = '1000';
        
        const corners = [
            { top: '0', left: '0', borderTop: '2px solid red', borderLeft: '2px solid red' },
            { top: '0', right: '0', borderTop: '2px solid red', borderRight: '2px solid red' },
            { bottom: '0', left: '0', borderBottom: '2px solid red', borderLeft: '2px solid red' },
            { bottom: '0', right: '0', borderBottom: '2px solid red', borderRight: '2px solid red' }
        ];
        corners.forEach(c => {
            const corner = document.createElement('div');
            corner.style.position = 'absolute';
            corner.style.width = '15px';
            corner.style.height = '15px';
            Object.assign(corner.style, c);
            marginOverlay.appendChild(corner);
        });
        
        container.appendChild(marginOverlay);
    }

    // Auto Shrink-to-Fit (must run after appending to DOM for layout calculation)
    setTimeout(() => {
        const containerW = window.stickerLayout.width || 440;
        const containerH = window.stickerLayout.height || 220;
        
        window.stickerLayout.elements.forEach(el => {
            if (el.type !== 'text') return;
            
            // Compute effective width: use stored el.w, or derive from sticker canvas right edge.
            // This ensures even old elements with no explicit width get shrink-to-fit!
            const effectiveW = el.w || Math.max(50, containerW - el.x - 5);
            const effectiveH = el.h || Math.round(parseInt(el.fontSize, 10) * 1.4) || 24;
            const elWithBounds = Object.assign({}, el, { w: effectiveW, h: effectiveH });
            
            const divEdit = document.getElementById('editor_' + el.id);
            if (divEdit && divEdit.style.display !== 'none') autoFitTextElement(divEdit, elWithBounds);
            
            const divPrint = document.getElementById('print_' + el.id);
            if (divPrint && divPrint.style.display !== 'none') {
                autoFitTextElement(divPrint, elWithBounds);
                
                // Bind live auto-shrink for live editing in print preview!
                divPrint.removeEventListener('input', divPrint._fitHandler);
                divPrint._fitHandler = () => autoFitTextElement(divPrint, elWithBounds);
                divPrint.addEventListener('input', divPrint._fitHandler);
            }
        });
    }, 50);
}

function autoFitTextElement(div, el) {
    try {
    if (!div) return;
    const text = div.innerText || div.textContent || '';
    if (!text.trim()) return;

    // Effective target box dimensions
    const targetW = el.w || Math.max(50, (window.stickerLayout?.width || 440) - el.x - 5);
    const targetH = el.h || Math.round(parseInt(el.fontSize, 10) * 1.4) || 24;
    let fontSize = parseInt(el.fontSize, 10) || 14;
    const minFontSize = 6;
    const isMultiline = !!el.multiline;

    // Phase 1: Give div a fixed size with overflow:hidden
    // scrollWidth reports full content width when overflow is NOT visible
    div.style.position = 'absolute';
    div.style.left = el.x + 'px';
    div.style.top  = el.y + 'px';
    div.style.width = targetW + 'px';
    div.style.height = isMultiline ? '' : targetH + 'px'; // auto height for multiline to measure scrollHeight accurately
    div.style.overflow = 'hidden';
    div.style.whiteSpace = isMultiline ? 'pre-wrap' : 'nowrap';
    div.style.display = 'block';
    div.style.transform = 'none';
    div.style.fontSize = fontSize + 'px';

    // Phase 2: Shrink font pixel by pixel until text fits
    // For single line, we care about scrollWidth > targetW
    // For multiline, we care about scrollHeight > targetH (and scrollWidth > targetW)
    while ((div.scrollWidth > targetW || (isMultiline && div.scrollHeight > targetH)) && fontSize > minFontSize) {
        fontSize--;
        div.style.fontSize = fontSize + 'px';
    }

    // Phase 3: Scale fallback if browser font clamping stopped shrinking
    // (Android WebView won't go below ~8px regardless of CSS)
    let scaleX = div.scrollWidth > targetW ? (targetW / div.scrollWidth) : 1;
    let scaleY = div.scrollHeight > targetH ? (targetH / div.scrollHeight) : 1;
    let scale = Math.min(scaleX, scaleY, 1);

    // Phase 4: Apply final display styles — keep overflow:hidden to prevent bleeding
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = isMultiline ? 'flex-start' : 'center';
    div.style.textAlign = isMultiline ? 'left' : 'center';
    div.style.overflow = 'hidden';     // Always hidden — text must not bleed outside box!
    div.style.whiteSpace = isMultiline ? 'pre-wrap' : 'nowrap';
    div.style.width = targetW + 'px';
    div.style.height = targetH + 'px';

    if (scale < 0.99) {
        div.style.transform = 'scale(' + scale + ')';
        div.style.transformOrigin = isMultiline ? 'left center' : 'center center';
    } else {
        div.style.transform = 'none';
    }

    } catch(e) { console.error('[autoFitTextElement]', e, el?.id); }
}




function startDrag(e, id) {
    selectedElementId = id;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const el = window.stickerLayout.elements.find(x => x.id === id);
    initialElemX = el.x;
    initialElemY = el.y;
    
    // Manually update borders instead of re-rendering the whole canvas
    window.stickerLayout.elements.forEach(x => {
        const div = document.getElementById('editor_' + x.id);
        const handle = document.getElementById('resize_' + x.id);
        if (div) div.style.border = x.id === id ? '2px solid blue' : '1px dashed transparent';
        if (handle) handle.style.display = x.id === id ? 'block' : 'none';
    });
    
    updatePropertiesPanel();
}

function startResize(e, id) {
    selectedElementId = id;
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const el = window.stickerLayout.elements.find(x => x.id === id);
    initialElemW = el.w || 100;
    initialElemH = el.h || 20;
    
    updatePropertiesPanel();
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging && !isResizing) return;
    const dx = (e.clientX - startX) / (window.stickerScale || 1);
    const dy = (e.clientY - startY) / (window.stickerScale || 1);
    if (isDragging) updateElementPosition(dx, dy);
    if (isResizing) updateElementSize(dx, dy);
});

document.addEventListener('touchmove', (e) => {
    if (!isDragging && !isResizing) return;
    const dx = (e.touches[0].clientX - startX) / (window.stickerScale || 1);
    const dy = (e.touches[0].clientY - startY) / (window.stickerScale || 1);
    if (isDragging) updateElementPosition(dx, dy);
    if (isResizing) updateElementSize(dx, dy);
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
});
document.addEventListener('touchend', () => {
    isDragging = false;
    isResizing = false;
});

function updateElementPosition(dx, dy) {
    const el = window.stickerLayout.elements.find(x => x.id === selectedElementId);
    if (el) {
        el.x = initialElemX + dx;
        el.y = initialElemY + dy;
        const domEl = document.getElementById('editor_' + el.id);
        if (domEl) {
            domEl.style.left = el.x + 'px';
            domEl.style.top = el.y + 'px';
        }
    }
}

function updateElementSize(dx, dy) {
    const el = window.stickerLayout.elements.find(x => x.id === selectedElementId);
    if (el) {
        el.w = Math.max(20, initialElemW + dx);
        if (el.h) el.h = Math.max(10, initialElemH + dy);
        
        const domEl = document.getElementById('editor_' + el.id);
        if (domEl) {
            domEl.style.width = el.w + 'px';
            if (el.h) domEl.style.height = el.h + 'px';
        }
        
        // Also update inputs in properties panel
        const wInp = document.getElementById('seSizeW_' + el.id);
        const hInp = document.getElementById('seSizeH_' + el.id);
        if (wInp) wInp.value = el.w;
        if (hInp && el.h) hInp.value = el.h;
    }
}

function openStickerEditor() {
    document.getElementById('stickerEditorModal').style.display = 'flex';
    
    // Populate dropdown
    const sel = document.getElementById('seActiveFormatSelect');
    if (sel && window.stickerLayoutsMap) {
        sel.innerHTML = '';
        Object.keys(window.stickerLayoutsMap).forEach(k => {
            var layout = window.stickerLayoutsMap[k];
            var w_mm = Math.round((layout.width || 440) / 8);
            var h_mm = Math.round((layout.height || 220) / 8);
            var opt = document.createElement('option');
            opt.value = k;
            opt.innerText = `${k} (${w_mm}x${h_mm}mm)`;
            if (k === (window.currentTemplateName || "Default")) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    document.getElementById('seCanvasW_mm').value = Math.round((window.stickerLayout.width || 440) / 8);
    document.getElementById('seCanvasH_mm').value = Math.round((window.stickerLayout.height || 220) / 8);
    
    document.getElementById('seMarginT_mm').value = Math.round((window.stickerLayout.marginTop || 0) / 8);
    document.getElementById('seMarginR_mm').value = Math.round((window.stickerLayout.marginRight || 0) / 8);
    document.getElementById('seMarginB_mm').value = Math.round((window.stickerLayout.marginBottom || 0) / 8);
    document.getElementById('seMarginL_mm').value = Math.round((window.stickerLayout.marginLeft || 0) / 8);
    
    const gapEl = document.getElementById('seGap_mm');
    if (gapEl) gapEl.value = window.stickerLayout.gap_mm || 0;
    
    const tplNameInput = document.getElementById('seTemplateName');
    const tplDefInput = document.getElementById('seTemplateDefault');
    if (tplNameInput) tplNameInput.value = window.currentTemplateName || "Default";
    if (tplDefInput) {
        // We need to know what the default is in the DB.
        // Actually, we store defaultLayoutName globally in loadStickerLayout? Wait, I didn't store it globally.
        // Let's store window.defaultTemplateName globally too.
        tplDefInput.checked = (window.currentTemplateName === window.defaultTemplateName);
    }
    
    selectedElementId = null;
    
    const toggles = document.getElementById('seElementToggles');
    toggles.innerHTML = '';
    window.stickerLayout.elements.forEach(el => {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '5px';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = el.visible;
        chk.onchange = (e) => {
            el.visible = e.target.checked;
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(el.id));
        toggles.appendChild(lbl);
    });
    
    updatePropertiesPanel();
    renderStickerTemplate('stickerEditorCanvas', true);
    
    setTimeout(() => {
        updateStickerCanvasScale('stickerEditorCanvas');
    }, 100);
}

function closeStickerEditor() {
    document.getElementById('stickerEditorModal').style.display = 'none';
    renderStickerTemplate('stickerTemplate', false);
}

window.stickerScale = 1;
function updateStickerCanvasScale(targetId) {
    const cid = targetId || 'stickerEditorCanvas';
    const canvas = document.getElementById(cid);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
        const availableWidth = parent.clientWidth - (cid === 'stickerEditorCanvas' ? 20 : 0); 
        if (window.stickerLayout.width > availableWidth) {
            window.stickerScale = availableWidth / window.stickerLayout.width;
        } else {
            window.stickerScale = 1;
        }
        canvas.style.transform = `scale(${window.stickerScale})`;
        canvas.style.transformOrigin = 'top left';
        
        if (cid === 'stickerEditorCanvas') {
            // Apply negative margins to shrink the DOM layout bounding box to the scaled size!
            // This prevents flexbox from overflowing and causing scroll bugs on mobile
            canvas.style.marginRight = (window.stickerLayout.width * (window.stickerScale - 1)) + 'px';
            canvas.style.marginBottom = (window.stickerLayout.height * (window.stickerScale - 1)) + 'px';
        } else {
            canvas.style.marginBottom = (window.stickerLayout.height * (window.stickerScale - 1)) + 'px';
        }
    }
}
window.addEventListener('resize', () => {
    updateStickerCanvasScale('stickerEditorCanvas');
    updateStickerCanvasScale('stickerTemplate');
});

function updateStickerCanvasSize() {
    // Only used to update the shared stickerLayout preview bounds before saving
    window.stickerLayout.width = Math.round((parseFloat(document.getElementById('seCanvasW_mm').value) || 55) * 8);
    window.stickerLayout.height = Math.round((parseFloat(document.getElementById('seCanvasH_mm').value) || 27.5) * 8);
    
    window.stickerLayout.marginTop = Math.round((parseFloat(document.getElementById('seMarginT_mm').value) || 0) * 8);
    window.stickerLayout.marginRight = Math.round((parseFloat(document.getElementById('seMarginR_mm').value) || 0) * 8);
    window.stickerLayout.marginBottom = Math.round((parseFloat(document.getElementById('seMarginB_mm').value) || 0) * 8);
    window.stickerLayout.marginLeft = Math.round((parseFloat(document.getElementById('seMarginL_mm').value) || 0) * 8);
    
    const gapEl = document.getElementById('seGap_mm');
    if (gapEl) window.stickerLayout.gap_mm = parseFloat(gapEl.value) || 0;
    
    buildCurrentStickerLayout();
    populateTemplateDropdown();
    populateFormatDropdown();
    renderStickerTemplate('stickerEditorCanvas', true);
    updateStickerCanvasScale('stickerEditorCanvas');
}

window.isEditingStickerSetup = false;
window.oldFormatName = "";

function addNewStickerFormat() {
    window.isEditingStickerSetup = false;
    document.getElementById('fmtModalTitle').innerText = "New Format Setup";
    document.getElementById('fmtModalBtn').innerText = "Create Format";
    document.getElementById('newFmtName').value = "";
    document.getElementById('newFmtName').readOnly = false;
    document.getElementById('newStickerFormatModal').style.display = 'flex';
}

function editStickerFormatSetup() {
    if (!window.stickerLayout || !window.currentTemplateName) return;
    window.isEditingStickerSetup = true;
    const curLayout = window.stickerLayoutsMap[window.currentTemplateName];
    if (!curLayout) return;
    window.oldFormatName = curLayout.formatId; // Format Name
    
    document.getElementById('fmtModalTitle').innerText = "Edit Format Size";
    document.getElementById('fmtModalBtn').innerText = "Update Format Size";
    
    document.getElementById('newFmtName').value = window.oldFormatName;
    document.getElementById('newFmtName').readOnly = false; 
    
    document.getElementById('newFmtW').value = Math.round((window.stickerLayout.width || 440) / 8);
    document.getElementById('newFmtH').value = Math.round((window.stickerLayout.height || 220) / 8);
    document.getElementById('newFmtGap').value = window.stickerLayout.gap_mm || 0;
    
    document.getElementById('newFmtMT').value = Math.round((window.stickerLayout.marginTop || 0) / 8);
    document.getElementById('newFmtMR').value = Math.round((window.stickerLayout.marginRight || 0) / 8);
    document.getElementById('newFmtMB').value = Math.round((window.stickerLayout.marginBottom || 0) / 8);
    document.getElementById('newFmtML').value = Math.round((window.stickerLayout.marginLeft || 0) / 8);
    
    document.getElementById('newStickerFormatModal').style.display = 'flex';
}

function deleteStickerFormat() {
    if (!window.stickerLayoutsMap || Object.keys(window.stickerLayoutsMap).length <= 1) {
        alert("Cannot delete the only layout.");
        return;
    }
    if (confirm("Delete layout '" + window.currentTemplateName + "'?")) {
        delete window.stickerLayoutsMap[window.currentTemplateName];
        const nextKey = Object.keys(window.stickerLayoutsMap)[0];
        changeStickerTemplate(nextKey);
        saveStickerLayout(true);
    }
}

function closeNewStickerFormatModal() {
    document.getElementById('newStickerFormatModal').style.display = 'none';
}

function saveNewStickerFormat() {
    const w = parseFloat(document.getElementById('newFmtW').value) || 50;
    const h = parseFloat(document.getElementById('newFmtH').value) || 25;
    const gap = parseFloat(document.getElementById('newFmtGap').value) || 3;
    const mt = parseFloat(document.getElementById('newFmtMT').value) || 0;
    const mr = parseFloat(document.getElementById('newFmtMR').value) || 0;
    const mb = parseFloat(document.getElementById('newFmtMB').value) || 0;
    const ml = parseFloat(document.getElementById('newFmtML').value) || 0;

    let formatName = document.getElementById('newFmtName').value.trim();
    if (!formatName) {
        formatName = w + "x" + h + "mm";
    }

    if (window.stickerFormatsMap && window.stickerFormatsMap[formatName]) {
        if (!window.isEditingStickerSetup || formatName !== window.oldFormatName) {
            alert("A format with this name already exists! Choose a different name.");
            return;
        }
    }

    const fmt = {
        width: Math.round(w * 8), height: Math.round(h * 8), gap_mm: gap,
        marginTop: Math.round(mt * 8), marginRight: Math.round(mr * 8),
        marginBottom: Math.round(mb * 8), marginLeft: Math.round(ml * 8)
    };

    if (!window.stickerFormatsMap) window.stickerFormatsMap = {};
    window.stickerFormatsMap[formatName] = fmt;
    
    // If they renamed an existing format, update all layouts that used the old name and delete the old name
    if (window.isEditingStickerSetup && formatName !== window.oldFormatName) {
        Object.keys(window.stickerLayoutsMap).forEach(layoutName => {
            if (window.stickerLayoutsMap[layoutName].formatId === window.oldFormatName) {
                window.stickerLayoutsMap[layoutName].formatId = formatName;
            }
        });
        delete window.stickerFormatsMap[window.oldFormatName];
    } else {
        // Just setting the current layout to use this new format (if creating new)
        if (!window.isEditingStickerSetup && window.currentTemplateName && window.stickerLayoutsMap[window.currentTemplateName]) {
            window.stickerLayoutsMap[window.currentTemplateName].formatId = formatName;
        }
    }

    closeNewStickerFormatModal();
    buildCurrentStickerLayout();
    populateFormatDropdown();
    renderStickerTemplate('stickerEditorCanvas', true);
    
    // Save to Firebase immediately
    saveStickerLayout(true);
}

function updatePropertiesPanel() {
    const panel = document.getElementById('seSelectedProps');
    panel.innerHTML = '';
    
    if (!selectedElementId) {
        panel.innerHTML = '<div style="color:#888; font-style:italic;">None selected</div>';
        return;
    }
    
    const el = window.stickerLayout.elements.find(x => x.id === selectedElementId);
    if (!el) return;
    
    const wrapper = document.createElement('div');
    
    const lbl = document.createElement('div');
    lbl.style.fontWeight = 'bold';
    lbl.innerText = el.id.replace('stk', '');
    wrapper.appendChild(lbl);

    if (el.type === 'text') {
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '8';
        range.max = '100';
        range.value = el.fontSize;
        range.style.width = '100%';
        range.oninput = (e) => {
            el.fontSize = parseInt(e.target.value);
            const domEl = document.getElementById('editor_' + el.id);
            if (domEl) {
                domEl.style.fontSize = el.fontSize + 'px';
            }
        };
        wrapper.appendChild(document.createTextNode('Font Size: '));
        wrapper.appendChild(range);
        
        // Formatting options
        const fmtRow = document.createElement('div');
        fmtRow.style.display = 'flex';
        fmtRow.style.gap = '10px';
        fmtRow.style.marginTop = '8px';
        fmtRow.style.marginBottom = '8px';
        
        const createToggle = (label, prop, trueVal, falseVal) => {
            const lbl = document.createElement('label');
            lbl.style.display = 'flex';
            lbl.style.alignItems = 'center';
            lbl.style.gap = '3px';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = el[prop] === trueVal;
            chk.onchange = (e) => {
                el[prop] = e.target.checked ? trueVal : falseVal;
                renderStickerTemplate('stickerEditorCanvas', true);
            };
            lbl.appendChild(chk);
            lbl.appendChild(document.createTextNode(label));
            return lbl;
        };
        
        fmtRow.appendChild(createToggle('B', 'fontWeight', 'bold', 'normal'));
        fmtRow.appendChild(createToggle('I', 'fontStyle', 'italic', 'normal'));
        fmtRow.appendChild(createToggle('U', 'textDecoration', 'underline', 'none'));
        fmtRow.appendChild(createToggle('M', 'multiline', true, false));
        wrapper.appendChild(fmtRow);
        
        const prefixInp = document.createElement('input');
        prefixInp.type = 'text';
        prefixInp.value = el.prefix || '';
        prefixInp.placeholder = 'Prefix (e.g. Rs. )';
        prefixInp.style.width = '100%';
        prefixInp.style.padding = '4px';
        prefixInp.style.marginTop = '4px';
        prefixInp.oninput = (e) => {
            el.prefix = e.target.value;
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        wrapper.appendChild(prefixInp);

        const suffixInp = document.createElement('input');
        suffixInp.type = 'text';
        suffixInp.value = el.suffix || '';
        suffixInp.placeholder = 'Suffix (e.g. /-)';
        suffixInp.style.width = '100%';
        suffixInp.style.padding = '4px';
        suffixInp.style.marginTop = '4px';
        suffixInp.oninput = (e) => {
            el.suffix = e.target.value;
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        wrapper.appendChild(suffixInp);
        
        if (el.text !== undefined) {
            const txt = document.createElement('input');
            txt.type = 'text';
            txt.value = el.text;
            txt.style.width = '100%';
            txt.style.padding = '4px';
            txt.style.marginTop = '4px';
            txt.oninput = (e) => {
                el.text = e.target.value;
                const domEl = document.getElementById('editor_' + el.id);
                if (domEl) domEl.innerText = el.text;
            };
            wrapper.appendChild(txt);
        }
    }
    
    // Width and Height inputs available for ALL elements
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '5px';
    row.style.marginTop = '8px';
    
    const wInp = document.createElement('input');
    wInp.type = 'number';
    wInp.value = el.w || '';
    wInp.style.width = '100%';
    wInp.placeholder = 'W';
    wInp.oninput = (e) => {
        el.w = parseInt(e.target.value) || 0;
        const domEl = document.getElementById('editor_' + el.id);
        if (domEl && el.w) domEl.style.width = el.w + 'px';
    };
    
    const hInp = document.createElement('input');
    hInp.type = 'number';
    hInp.value = el.h || '';
    hInp.style.width = '100%';
    hInp.placeholder = 'H';
    hInp.oninput = (e) => {
        el.h = parseInt(e.target.value) || 0;
        const domEl = document.getElementById('editor_' + el.id);
        if (domEl && el.h) domEl.style.height = el.h + 'px';
    };
    
    row.appendChild(wInp);
    row.appendChild(hInp);
    wrapper.appendChild(document.createTextNode('Size Box (W x H):'));
    wrapper.appendChild(row);
    
    panel.appendChild(wrapper);
}

async function saveStickerLayout(skipAlert = false) {
    try {
        const nameInput = document.getElementById('seTemplateName');
        const defInput = document.getElementById('seTemplateDefault');
        let tplName = (nameInput && nameInput.value.trim() !== '') ? nameInput.value.trim() : window.currentTemplateName;
        
        const formatSelect = document.getElementById('seActiveFormatIdSelect');
        const selectedFormatId = (formatSelect && formatSelect.value) ? formatSelect.value : 
            (window.stickerLayoutsMap[window.currentTemplateName]?.formatId || Object.keys(window.stickerFormatsMap)[0]);
        
        window.stickerLayoutsMap[tplName] = {
            formatId: selectedFormatId,
            elements: JSON.parse(JSON.stringify(window.stickerLayout.elements || []))
        };
        
        window.currentTemplateName = tplName;
        
        if (defInput && defInput.checked) {
            window.defaultTemplateName = tplName;
        } else if (!window.defaultTemplateName) {
            window.defaultTemplateName = tplName;
        }

        await firebase.firestore().collection('Settings').doc('StickerTemplate').set({
            formats: window.stickerFormatsMap,
            layouts: window.stickerLayoutsMap,
            defaultLayoutName: window.defaultTemplateName
        }, { merge: true });
        
        if (!skipAlert) alert("Layout Saved successfully!");
        populateTemplateDropdown();
    } catch(e) {
        console.error("Failed to save layout", e);
        if (!skipAlert) alert("Error saving layout!");
    }
}

// Load lazily so it doesn't interrupt initial product fetching
setTimeout(() => {
    loadStickerLayout();
}, 3000);
