window.stickerLayout = {
    width: 440,
    height: 220,
    elements: [
        { id: "stkProductImg", type: "image", visible: true, x: 8, y: 10, w: 100, h: 200 },
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
window.stickerLayoutsMap = { "Default": window.stickerLayout };
window.currentTemplateName = "Default";
window.defaultTemplateName = "Default";

async function loadStickerLayout() {
    try {
        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) return;
        const doc = await firebase.firestore().collection('Settings').doc('StickerTemplate').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.layouts) {
                window.stickerLayoutsMap = data.layouts;
                window.defaultTemplateName = data.defaultLayoutName || Object.keys(data.layouts)[0];
                window.currentTemplateName = window.defaultTemplateName;
                window.stickerLayout = JSON.parse(JSON.stringify(window.stickerLayoutsMap[window.currentTemplateName]));
            } else if (data.layout) {
                window.stickerLayout = data.layout;
                window.stickerLayoutsMap = { "Default": data.layout };
                window.currentTemplateName = "Default";
            }
            populateTemplateDropdown();
        }
    } catch(e) { console.error("Failed to load sticker layout", e); }
}

function populateTemplateDropdown() {
    const sel = document.getElementById('stickerTemplateSelect');
    if (!sel) return;
    sel.innerHTML = '';
    const keys = Object.keys(window.stickerLayoutsMap);
    keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = k;
        if (k === window.currentTemplateName) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.style.display = keys.length > 0 ? 'block' : 'none';
}

window.changeStickerTemplate = function(name) {
    if (window.stickerLayoutsMap[name]) {
        window.currentTemplateName = name;
        window.stickerLayout = JSON.parse(JSON.stringify(window.stickerLayoutsMap[name]));
        renderStickerTemplate('stickerTemplate', false);
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

        const div = document.createElement('div');
        div.id = (isEditor ? 'editor_' : 'print_') + el.id;
        div.style.position = 'absolute';
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        if (!el.visible) div.style.opacity = '0.3';

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
            div.style.whiteSpace = 'nowrap';
            div.style.color = '#000';
            
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
    });

    // Auto Shrink-to-Fit (must run after appending to DOM for layout calculation)
    setTimeout(() => {
        window.stickerLayout.elements.forEach(el => {
            if (el.type !== 'text' || !el.w) return;
            
            const div = document.getElementById((isEditor ? 'editor_' : 'print_') + el.id);
            if (!div || div.style.display === 'none') return;
            
            // Constrain text to bounding box to prevent overlapping
            div.style.width = el.w + 'px';
            if (el.h) div.style.height = el.h + 'px';
            div.style.overflow = 'hidden';
            
            // Shrink font size if it overflows
            let currentFontSize = el.fontSize || 14;
            div.style.fontSize = currentFontSize + 'px'; // Reset to default
            
            while ((div.scrollWidth > el.w || (el.h && div.scrollHeight > el.h)) && currentFontSize > 6) {
                currentFontSize--;
                div.style.fontSize = currentFontSize + 'px';
            }
        });
    }, 10);
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
    document.getElementById('seCanvasW').value = window.stickerLayout.width;
    document.getElementById('seCanvasH').value = window.stickerLayout.height;
    
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
    renderStickerTemplate('stickerEditorCanvas', true);
}

function closeStickerEditor() {
    document.getElementById('stickerEditorModal').style.display = 'none';
    renderStickerTemplate('stickerTemplate', false);
}

function updateStickerCanvasSize() {
    window.stickerLayout.width = parseInt(document.getElementById('seCanvasW').value) || 440;
    window.stickerLayout.height = parseInt(document.getElementById('seCanvasH').value) || 220;
    renderStickerTemplate('stickerEditorCanvas', true);
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
    } else {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '5px';
        
        const wInp = document.createElement('input');
        wInp.type = 'number';
        wInp.value = el.w;
        wInp.style.width = '100%';
        wInp.placeholder = 'W';
        wInp.oninput = (e) => {
            el.w = parseInt(e.target.value) || 10;
            const domEl = document.getElementById('editor_' + el.id);
            if (domEl) domEl.style.width = el.w + 'px';
        };
        
        const hInp = document.createElement('input');
        hInp.type = 'number';
        hInp.value = el.h;
        hInp.style.width = '100%';
        hInp.placeholder = 'H';
        hInp.oninput = (e) => {
            el.h = parseInt(e.target.value) || 10;
            const domEl = document.getElementById('editor_' + el.id);
            if (domEl) domEl.style.height = el.h + 'px';
        };
        
        row.appendChild(wInp);
        row.appendChild(hInp);
        wrapper.appendChild(document.createTextNode('Size (W x H):'));
        wrapper.appendChild(row);
    }
    
    panel.appendChild(wrapper);
}

async function saveStickerLayout() {
    try {
        const nameInput = document.getElementById('seTemplateName');
        const defInput = document.getElementById('seTemplateDefault');
        let tplName = (nameInput && nameInput.value.trim() !== '') ? nameInput.value.trim() : "Default";
        
        window.stickerLayoutsMap[tplName] = JSON.parse(JSON.stringify(window.stickerLayout));
        window.currentTemplateName = tplName;
        
        if (defInput && defInput.checked) {
            window.defaultTemplateName = tplName;
        } else if (!window.defaultTemplateName) {
            window.defaultTemplateName = tplName;
        }

        await firebase.firestore().collection('Settings').doc('StickerTemplate').set({
            layouts: window.stickerLayoutsMap,
            defaultLayoutName: window.defaultTemplateName
        }, { merge: true });
        
        populateTemplateDropdown();
        alert("Sticker Layout '" + tplName + "' saved successfully!");
    } catch(e) {
        alert("Error saving: " + e.message);
    }
}

// Load lazily so it doesn't interrupt initial product fetching
setTimeout(() => {
    loadStickerLayout();
}, 3000);
