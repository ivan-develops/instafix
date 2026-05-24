  /* ══ BEFORE / AFTER ════════════════════════════ */
  const beforeBtn    = document.getElementById('before-btn');
  const originalBadge = document.getElementById('original-badge');
  let showingOriginal = false;

  function showOriginal() {
    if (!originalImage || showingOriginal) return;
    showingOriginal = true;
    ctx.drawImage(originalImage, 0, 0);
    canvas.style.filter = '';
    beforeBtn.classList.add('active');
    originalBadge.style.display = 'block';
  }

  function showEdited() {
    if (!showingOriginal) return;
    showingOriginal = false;
    applyAdjustments();
    beforeBtn.classList.remove('active');
    originalBadge.style.display = 'none';
  }

  // Mouse
  beforeBtn.addEventListener('mousedown', e => { e.preventDefault(); showOriginal(); });
  document.addEventListener('mouseup', () => { if (showingOriginal) showEdited(); });

  // Touch
  beforeBtn.addEventListener('touchstart', e => { e.preventDefault(); showOriginal(); }, { passive: false });
  document.addEventListener('touchend', () => { if (showingOriginal) showEdited(); });

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
    wb: 0, hue: 0, sat: 0, sharp: 0,
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
        exportBtn.disabled = false;
        beforeBtn.style.display = 'flex';
        canvasArea.classList.add('has-image');
        resetZoomOnLoad();
        updateOriginalDesc();
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
    const wbShift     = state.wb / 3000; // 0 = neutro, <0 = cálido, >0 = frío
    const hueShift    = state.hue;
    const satFactor   = state.sat         / 100;
    const contrastF   = contrast >= 0 ? 1 + contrast*1.5 : 1 + contrast;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;

      r=clamp(r+exposure*0.8);      g=clamp(g+exposure*0.8);      b=clamp(b+exposure*0.8);
      r=clamp(r+brightness*0.6);    g=clamp(g+brightness*0.6);    b=clamp(b+brightness*0.6);
      r=clamp((r-.5)*contrastF+.5); g=clamp((g-.5)*contrastF+.5); b=clamp((b-.5)*contrastF+.5);

      // Temperatura: frío (>5500K) = más azul, menos rojo / cálido (<5500K) = más rojo, menos azul
      if (wbShift !== 0) {
        r = clamp(r - wbShift * 0.18);
        g = clamp(g - wbShift * 0.05);
        b = clamp(b + wbShift * 0.18);
      }

      if (hueShift !== 0 || satFactor !== 0) {
        let [h,s,l] = rgbToHsl(r,g,b);
        h = (h + hueShift/360 + 1) % 1;
        s = clamp(s + satFactor*s + satFactor*0.15);
        [r,g,b] = hslToRgb(h,s,l);
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
      valueLabels[key].textContent = key === 'hue' ? `${input.value}` : key === 'wb' ? `${input.value}K` : input.value;
      applyAdjustments();

      // Slide-in animation on value label
      const label = valueLabels[key];
      label.classList.remove('sliding');
      void label.offsetWidth;
      label.classList.add('sliding');

      // Bounce animation on slider thumb
      input.classList.remove('thumb-bounce');
      void input.offsetWidth;
      input.classList.add('thumb-bounce');
    });
  });

  /* ══ DOUBLE-CLICK → reset individual slider ════ */
  Object.keys(controls).forEach(key => {
    controls[key].addEventListener('dblclick', () => {
      const neutral                = key === 'wb' ? 0 : 0;
      controls[key].value          = neutral;
      state[key]                   = neutral;
      updateSliderFill(controls[key]);
      valueLabels[key].textContent = key === 'wb' ? '0K' : '0';
      applyAdjustments();
    });
  });

  /* ══ RESET ══════════════════════════════════════ */
  resetBtn.addEventListener('click', () => {
    Object.keys(controls).forEach(key => {
      const neutral                = key === 'wb' ? 0 : 0;
      controls[key].value          = neutral;
      state[key]                   = neutral;
      updateSliderFill(controls[key]);
      valueLabels[key].textContent = key === 'wb' ? '0K' : '0';
    });
    canvas.style.filter = '';
    applyAdjustments();
  });

  /* ══ EXPORT MENU ════════════════════════════════ */
  const exportMenu = document.getElementById('export-menu');
  const exportWrap = document.getElementById('export-wrap');

  // Toggle menu on button click
  exportBtn.addEventListener('click', () => {
    if (exportBtn.disabled) return;
    const isOpen = exportMenu.classList.contains('open');
    exportMenu.classList.toggle('open', !isOpen);
    exportBtn.querySelector('.chevron-icon').style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  // Close menu when clicking outside
  document.addEventListener('click', e => {
    if (!exportWrap.contains(e.target)) {
      exportMenu.classList.remove('open');
      exportBtn.querySelector('.chevron-icon').style.transform = '';
    }
  });

  // Show original dimensions in option desc once image loads
  function updateOriginalDesc() {
    if (!originalImage) return;
    document.getElementById('desc-original').textContent =
      `${originalImage.width} × ${originalImage.height} px`;
  }

  function scaleForMode(mode) {
    if (!originalImage) return { w: 0, h: 0 };
    const ow = originalImage.width;
    const oh = originalImage.height;

    if (mode === 'original') return { w: ow, h: oh };

    const maxW = mode === 'desktop' ? 1920 : 1080;
    const maxH = mode === 'desktop' ? 1080 : 1080;

    const ratio = Math.min(maxW / ow, maxH / oh, 1);
    return {
      w: Math.round(ow * ratio),
      h: Math.round(oh * ratio)
    };
  }

  function runExport(mode) {
    if (!originalImage) return;
    const { w, h } = scaleForMode(mode);
    const off      = document.createElement('canvas');
    off.width      = w;
    off.height     = h;
    const offCtx   = off.getContext('2d');
    offCtx.drawImage(originalImage, 0, 0, w, h);
    const id = offCtx.getImageData(0, 0, w, h);
    processPixels(id.data);
    offCtx.putImageData(id, 0, 0);
    const a      = document.createElement('a');
    a.download   = `${fileName}_instafix.jpg`;
    a.href       = off.toDataURL('image/jpeg', 0.92);
    a.click();
    const labels = { original: 'Original', desktop: 'Escritorio', social: 'Redes sociales' };
    showToast(`${labels[mode]} — ${w} × ${h} px`);
    exportMenu.classList.remove('open');
    exportBtn.querySelector('.chevron-icon').style.transform = '';
  }

  document.querySelectorAll('.export-option').forEach(opt => {
    opt.addEventListener('click', () => runExport(opt.dataset.mode));
  });

  /* ══ TOAST ══════════════════════════════════════ */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  /* ══ ZOOM ════════════════════════════════════════ */
  const zoomBadge  = document.getElementById('zoom-badge');

  const zoom = {
    scale:   1,
    minScale: 1,
    maxScale: 8,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    badgeTimer: null,
  };

  function applyZoomTransform() {
    canvas.style.transform       = `translate(${zoom.offsetX}px, ${zoom.offsetY}px) scale(${zoom.scale})`;
    canvas.style.transformOrigin = 'center center';
  }

  function clampOffset() {
    if (!originalImage) return;
    const rect  = canvasArea.getBoundingClientRect();
    const cw    = parseFloat(canvas.style.width  || canvas.width);
    const ch    = parseFloat(canvas.style.height || canvas.height);
    const maxX  = Math.max(0, (cw  * zoom.scale - rect.width)  / 2);
    const maxY  = Math.max(0, (ch  * zoom.scale - rect.height) / 2);
    zoom.offsetX = Math.min(maxX, Math.max(-maxX, zoom.offsetX));
    zoom.offsetY = Math.min(maxY, Math.max(-maxY, zoom.offsetY));
  }

  function showZoomBadge() {
    zoomBadge.textContent   = `${Math.round(zoom.scale * 100)}%`;
    zoomBadge.style.display = 'block';
    zoomBadge.style.opacity = '1';
    clearTimeout(zoom.badgeTimer);
    zoom.badgeTimer = setTimeout(() => {
      zoomBadge.style.opacity = '0';
      setTimeout(() => { zoomBadge.style.display = 'none'; }, 300);
    }, 1200);
  }

  function resetZoom() {
    zoom.scale   = 1;
    zoom.offsetX = 0;
    zoom.offsetY = 0;
    applyZoomTransform();
    showZoomBadge();
  }

  function changeScale(delta, originX, originY) {
    if (!originalImage) return;
    const prevScale = zoom.scale;
    zoom.scale = Math.min(zoom.maxScale, Math.max(zoom.minScale, zoom.scale * delta));
    if (zoom.scale === prevScale) return;

    // Adjust offset so zoom feels anchored to pointer position
    const rect = canvasArea.getBoundingClientRect();
    const px   = originX - rect.left - rect.width  / 2;
    const py   = originY - rect.top  - rect.height / 2;
    zoom.offsetX = px - (px - zoom.offsetX) * (zoom.scale / prevScale);
    zoom.offsetY = py - (py - zoom.offsetY) * (zoom.scale / prevScale);

    if (zoom.scale === 1) { zoom.offsetX = 0; zoom.offsetY = 0; }
    clampOffset();
    applyZoomTransform();
    showZoomBadge();
  }

  /* ── Mouse wheel ── */
  canvasArea.addEventListener('wheel', e => {
    if (!originalImage) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    changeScale(delta, e.clientX, e.clientY);
  }, { passive: false });

  /* ── Mouse drag to pan ── */
  canvas.addEventListener('mousedown', e => {
    if (!originalImage || zoom.scale <= 1) return;
    e.preventDefault();
    zoom.dragging = true;
    zoom.lastX    = e.clientX;
    zoom.lastY    = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!zoom.dragging) return;
    zoom.offsetX += e.clientX - zoom.lastX;
    zoom.offsetY += e.clientY - zoom.lastY;
    zoom.lastX    = e.clientX;
    zoom.lastY    = e.clientY;
    clampOffset();
    applyZoomTransform();
  });

  document.addEventListener('mouseup', () => {
    if (!zoom.dragging) return;
    zoom.dragging       = false;
    canvas.style.cursor = zoom.scale > 1 ? 'grab' : 'pointer';
  });

  /* ── Double-click → reset zoom ── */
  canvas.addEventListener('dblclick', e => {
    if (!originalImage) return;
    e.stopPropagation();
    resetZoom();
  });

  /* ── Touch: pinch to zoom + pan ── */
  let lastTouchDist = null;
  let lastTouchMidX = 0;
  let lastTouchMidY = 0;
  let touchPanX = 0;
  let touchPanY = 0;

  canvasArea.addEventListener('touchstart', e => {
    if (!originalImage) return;
    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      lastTouchMidX = (t0.clientX + t1.clientX) / 2;
      lastTouchMidY = (t0.clientY + t1.clientY) / 2;
    } else if (e.touches.length === 1 && zoom.scale > 1) {
      touchPanX = e.touches[0].clientX;
      touchPanY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvasArea.addEventListener('touchmove', e => {
    if (!originalImage) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0   = e.touches[0];
      const t1   = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      if (lastTouchDist) {
        const delta = dist / lastTouchDist;
        changeScale(delta, midX, midY);
      }
      lastTouchDist = dist;
      lastTouchMidX = midX;
      lastTouchMidY = midY;
    } else if (e.touches.length === 1 && zoom.scale > 1) {
      e.preventDefault();
      zoom.offsetX += e.touches[0].clientX - touchPanX;
      zoom.offsetY += e.touches[0].clientY - touchPanY;
      touchPanX     = e.touches[0].clientX;
      touchPanY     = e.touches[0].clientY;
      clampOffset();
      applyZoomTransform();
    }
  }, { passive: false });

  canvasArea.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastTouchDist = null;
  });

  /* Reset zoom when new image loads */
  function resetZoomOnLoad() {
    zoom.scale   = 1;
    zoom.offsetX = 0;
    zoom.offsetY = 0;
    canvas.style.transform = '';
  }

  /* ══ FILE INPUT / DRAG & DROP ═══════════════════ */
  dropZone.addEventListener('click',   () => fileInput.click());
  canvas.addEventListener('click', e => {
    // Only open file picker when not zoomed in (avoid conflict with pan)
    if (zoom.scale <= 1) fileInput.click();
  });
  fileInput.addEventListener('change',  e => loadFile(e.target.files[0]));

  canvasArea.addEventListener('dragover',  e => { e.preventDefault(); canvasArea.style.outline='2px dashed var(--accent)'; });
  canvasArea.addEventListener('dragleave', () => { canvasArea.style.outline=''; });
  canvasArea.addEventListener('drop', e => {
    e.preventDefault(); canvasArea.style.outline=''; loadFile(e.dataTransfer.files[0]);
  });