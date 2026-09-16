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
let startX, startY, initialElemX, initialElemY;

async function loadStickerLayout() {
    try {
        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) return;
        const doc = await firebase.firestore().collection('Settings').doc('StickerTemplate').get();
        if (doc.exists) {
            const data = doc.data();
            if (data && data.layout) {
                window.stickerLayout = data.layout;
            }
        }
    } catch(e) { console.error("Failed to load sticker layout", e); }
}

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
            div.onmousedown = (e) => { e.preventDefault(); startDrag(e, el.id); };
            div.ontouchstart = (e) => { e.preventDefault(); startDrag(e.touches[0], el.id); };
        }

        if (el.type === 'text') {
            div.style.fontSize = el.fontSize + 'px';
            div.style.fontWeight = el.fontWeight || 'normal';
            div.style.fontStyle = el.fontStyle || 'normal';
            div.style.whiteSpace = 'nowrap';
            div.style.color = '#000';
            
            let val = el.text || '';
            if (el.field === 'name') val = window.curProduct?.name || 'Product Name';
            if (el.field === 'fabric') val = window.curProduct?.fabric || 'Fabric Details';
            if (el.field === 'cut') val = window.curProduct?.cut || 'Cut Details';
            if (el.field === 'price') val = (el.prefix||'') + (window.curProduct?.price || '000');
            if (el.field === 'design') val = '00';

            div.innerText = val;
            
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
}

// Drag & Drop
function startDrag(e, id) {
    selectedElementId = id;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const el = window.stickerLayout.elements.find(x => x.id === id);
    initialElemX = el.x;
    initialElemY = el.y;
    
    renderStickerTemplate('stickerEditorCanvas', true);
    updatePropertiesPanel();
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    updateElementPosition(dx, dy);
});

document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    updateElementPosition(dx, dy);
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        renderStickerTemplate('stickerEditorCanvas', true);
    }
});
document.addEventListener('touchend', () => {
    if (isDragging) {
        isDragging = false;
        renderStickerTemplate('stickerEditorCanvas', true);
    }
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

function openStickerEditor() {
    document.getElementById('stickerEditorModal').style.display = 'flex';
    document.getElementById('seCanvasW').value = window.stickerLayout.width;
    document.getElementById('seCanvasH').value = window.stickerLayout.height;
    
    selectedElementId = null;
    
    const toggles = document.getElementById('seElementToggles');
    toggles.innerHTML = '';
    window.stickerLayout.elements.forEach(el => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '5px';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = el.visible;
        cb.onchange = (e) => {
            el.visible = e.target.checked;
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        
        const lbl = document.createElement('span');
        lbl.innerText = el.id.replace('stk', '');
        
        div.appendChild(cb);
        div.appendChild(lbl);
        toggles.appendChild(div);
    });

    updatePropertiesPanel();
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
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        wrapper.appendChild(document.createTextNode('Font Size: '));
        wrapper.appendChild(range);
        
        if (el.text !== undefined) {
            const txt = document.createElement('input');
            txt.type = 'text';
            txt.value = el.text;
            txt.style.width = '100%';
            txt.style.padding = '4px';
            txt.style.marginTop = '4px';
            txt.oninput = (e) => {
                el.text = e.target.value;
                renderStickerTemplate('stickerEditorCanvas', true);
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
            renderStickerTemplate('stickerEditorCanvas', true);
        };
        
        const hInp = document.createElement('input');
        hInp.type = 'number';
        hInp.value = el.h;
        hInp.style.width = '100%';
        hInp.placeholder = 'H';
        hInp.oninput = (e) => {
            el.h = parseInt(e.target.value) || 10;
            renderStickerTemplate('stickerEditorCanvas', true);
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
        await firebase.firestore().collection('Settings').doc('StickerTemplate').set({
            layout: window.stickerLayout
        }, { merge: true });
        alert("Sticker Layout saved successfully!");
    } catch(e) {
        alert("Error saving: " + e.message);
    }
}

// Load lazily so it doesn't interrupt initial product fetching
setTimeout(() => {
    loadStickerLayout();
}, 3000);
