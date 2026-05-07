/* ══ MODAL ══════════════════════════════════════ */
const modalOverlay = document.getElementById('modal-overlay');
const modalCta     = document.getElementById('modal-cta');

function closeModal() { modalOverlay.classList.add('hidden'); }

modalCta.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.getElementById('help-btn').addEventListener('click', () => {
    modalOverlay.classList.remove('hidden');
});

/* ══ STATE ═══════════════════════════════════════ */
const state = {
    exposure: 0, brightness: 0, contrast: 0,
    wb: 0, hue: 0, sat: 0, sharp: 0, noise: 0,
    lumR: 0, lumG: 0, lumB: 0
};

/* ══ DOM ═════════════════════════════════════════ */
const canvas     = document.getElementById('preview-canvas');
const ctx        = canvas.getContext('2d');
const dropZone   = document.getElementById('drop-zone');
const canvasArea = document.getElementById('canvas-area');
const fileInput  = document.getElementById('file-input');
const exportBtn  = document.getElementById('btn-export');
const resetBtn   = document.getElementById('btn-reset');
const toast      = document.getElementById('toast');
const fileMeta   = document.getElementById('file-meta');

const controls = {
    exposure:   document.getElementById('ctrl-exposure'),
    brightness: document.getElementById('ctrl-brightness'),
    contrast:   document.getElementById('ctrl-contrast'),
    wb:         document.getElementById('ctrl-wb'),
    hue:        document.getElementById('ctrl-hue'),
    sat:        document.getElementById('ctrl-sat'),
    sharp:      document.getElementById('ctrl-sharp'),
    noise:      document.getElementById('ctrl-noise'),
    lumR:       document.getElementById('ctrl-lumR'),
    lumG:       document.getElementById('ctrl-lumG'),
    lumB:       document.getElementById('ctrl-lumB'),
};

const valueLabels = {
    exposure:   document.getElementById('val-exposure'),
    brightness: document.getElementById('val-brightness'),
    contrast:   document.getElementById('val-contrast'),
    wb:         document.getElementById('val-wb'),
    hue:        document.getElementById('val-hue'),
    sat:        document.getElementById('val-sat'),
    sharp:      document.getElementById('val-sharp'),
    noise:      document.getElementById('val-noise'),
    lumR:       document.getElementById('val-lumR'),
    lumG:       document.getElementById('val-lumG'),
    lumB:       document.getElementById('val-lumB'),
};

let originalImage = null;
let fileName      = 'instafix-export';

/* ══ MOBILE TABS ════════════════════════════════ */
const tabNav   = document.getElementById('tab-nav');
const sections = {
    luz:         document.getElementById('sec-luz'),
    color:       document.getElementById('sec-color'),
    detalle:     document.getElementById('sec-detalle'),
    luminosidad: document.getElementById('sec-luminosidad'),
};

tabNav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    tabNav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(sections).forEach(([key, sec]) => {
    sec.classList.toggle('tab-active', key === tab);
    });
});

/* ══ SLIDER FILL ════════════════════════════════ */
function updateSliderFill(input) {
    const pct = (parseFloat(input.value) - parseFloat(input.min))
            / (parseFloat(input.max)   - parseFloat(input.min)) * 100;
    input.style.setProperty('--pct', pct + '%');
}

/* ══ LOAD IMAGE ═════════════════════════════════ */
function loadFile(file) {
    if (!file || !file.type.match(/image\/(jpeg|png|webp)/)) return;
    fileName = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = e => {
    const img = new Image();
    img.onload = () => {
        originalImage = img;
        const area  = canvasArea.getBoundingClientRect();
        const scale = Math.min((area.width - 32) / img.width, (area.height - 32) / img.height, 1);
        canvas.width  = img.width;
        canvas.height = img.height;
        canvas.style.width  = (img.width  * scale) + 'px';
        canvas.style.height = (img.height * scale) + 'px';
        dropZone.style.display = 'none';
        canvas.style.display   = 'block';
        exportBtn.disabled     = false;
        document.getElementById('meta-name').textContent = file.name;
        document.getElementById('meta-dims').textContent = `${img.width} × ${img.height} px`;
        fileMeta.style.display = 'block';
        applyAdjustments();
    };
    img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* ══ PIXEL HELPERS ══════════════════════════════ */
function clamp(v) { return Math.max(0, Math.min(1, v)); }

function rgbToHsl(r, g, b) {
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    let h;
    switch(max) {
    case r: h=((g-b)/d+(g<b?6:0))/6; break;
    case g: h=((b-r)/d+2)/6;          break;
    case b: h=((r-g)/d+4)/6;          break;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    if (s===0) return [l,l,l];
    const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    return [hue2rgb(p,q,h+1/3), hue2rgb(p,q,h), hue2rgb(p,q,h-1/3)];
}

function hue2rgb(p,q,t) {
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
}

/* ══ CORE PROCESSOR ═════════════════════════════ */
function processPixels(data) {
    const exposure    = state.exposure    / 100;
    const brightness  = state.brightness  / 100;
    const contrast    = state.contrast    / 100;
    const wb          = state.wb          / 100;
    const hueShift    = state.hue;
    const satFactor   = state.sat         / 100;
    const noiseFactor = state.noise       / 100;
    const contrastF   = contrast >= 0 ? 1 + contrast*1.5 : 1 + contrast;

    for (let i = 0; i < data.length; i += 4) {
    let r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;

    r=clamp(r+exposure*0.8);      g=clamp(g+exposure*0.8);      b=clamp(b+exposure*0.8);
    r=clamp(r+brightness*0.6);    g=clamp(g+brightness*0.6);    b=clamp(b+brightness*0.6);
    r=clamp((r-.5)*contrastF+.5); g=clamp((g-.5)*contrastF+.5); b=clamp((b-.5)*contrastF+.5);

    if (wb !== 0) { r=clamp(r+wb*0.18); g=clamp(g+wb*0.05); b=clamp(b-wb*0.18); }

    if (hueShift !== 0 || satFactor !== 0) {
        let [h,s,l] = rgbToHsl(r,g,b);
        h = (h + hueShift/360 + 1) % 1;
        s = clamp(s + satFactor*s + satFactor*0.15);
        [r,g,b] = hslToRgb(h,s,l);
    }

    if (noiseFactor > 0) {
        const grain = (((i*1664525+1013904223)>>>0)/0xffffffff - 0.5) * noiseFactor * 0.25;
        r=clamp(r+grain); g=clamp(g+grain); b=clamp(b+grain);
    }

    if (state.lumR !== 0) {
        const rw = r - Math.max(g, b);
        if (rw > 0) r = clamp(r + (state.lumR/100) * rw * 1.5);
    }
    if (state.lumG !== 0) {
        const gw = g - Math.max(r, b);
        if (gw > 0) g = clamp(g + (state.lumG/100) * gw * 1.5);
    }
    if (state.lumB !== 0) {
        const bw = b - Math.max(r, g);
        if (bw > 0) b = clamp(b + (state.lumB/100) * bw * 1.5);
    }

    data[i]=r*255; data[i+1]=g*255; data[i+2]=b*255;
    }
}

/* ══ APPLY (preview) ════════════════════════════ */
function applyAdjustments() {
    if (!originalImage) return;
    ctx.drawImage(originalImage, 0, 0);
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    processPixels(id.data);
    ctx.putImageData(id, 0, 0);
    const sharp = state.sharp / 100;
    canvas.style.filter = sharp > 0
    ? `contrast(${1+sharp*0.08}) saturate(${1+sharp*0.04})` : '';
}

/* ══ WIRE SLIDERS ═══════════════════════════════ */
Object.keys(controls).forEach(key => {
    const input = controls[key];
    updateSliderFill(input);
    input.addEventListener('input', () => {
    state[key] = parseFloat(input.value);
    updateSliderFill(input);
    valueLabels[key].textContent = key === 'hue' ? `${input.value}` : input.value;
    applyAdjustments();
    });
});

/* ══ DOUBLE-CLICK → reset individual slider ════ */
Object.keys(controls).forEach(key => {
    controls[key].addEventListener('dblclick', () => {
    controls[key].value = 0;
    state[key] = 0;
    updateSliderFill(controls[key]);
    valueLabels[key].textContent = key === 'hue' ? '0' : '0';
    applyAdjustments();
    });
});

/* ══ RESET ══════════════════════════════════════ */
resetBtn.addEventListener('click', () => {
    Object.keys(controls).forEach(key => {
    controls[key].value = 0; state[key] = 0;
    updateSliderFill(controls[key]);
    valueLabels[key].textContent = '0';
    });
    canvas.style.filter = '';
    applyAdjustments();
});

/* ══ EXPORT ═════════════════════════════════════ */
exportBtn.addEventListener('click', () => {
    if (!originalImage) return;
    const off = document.createElement('canvas');
    off.width = originalImage.width; off.height = originalImage.height;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(originalImage, 0, 0);
    const id = offCtx.getImageData(0, 0, off.width, off.height);
    processPixels(id.data);
    offCtx.putImageData(id, 0, 0);
    const a = document.createElement('a');
    a.download = `${fileName}_instafix.jpg`;
    a.href = off.toDataURL('image/jpeg', 0.92);
    a.click();
    showToast('¡Imagen exportada correctamente!');
});

/* ══ TOAST ══════════════════════════════════════ */
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ══ FILE INPUT / DRAG & DROP ═══════════════════ */
dropZone.addEventListener('click',   () => fileInput.click());
canvas.addEventListener('click',     () => fileInput.click());
fileInput.addEventListener('change',  e => loadFile(e.target.files[0]));

canvasArea.addEventListener('dragover',  e => { e.preventDefault(); canvasArea.style.outline='2px dashed var(--accent)'; });
canvasArea.addEventListener('dragleave', () => { canvasArea.style.outline=''; });
canvasArea.addEventListener('drop', e => {
    e.preventDefault(); canvasArea.style.outline=''; loadFile(e.dataTransfer.files[0]);
});
