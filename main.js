// Theme and UI state
const app = document.getElementById('app');
const dim = document.getElementById('dim');
const popupSettings = document.getElementById('popup-settings');
const popupEraser = document.getElementById('popup-eraser');
const popupCase = document.getElementById('popup-case');

const btnSettings = document.getElementById('btn-settings');
const btnEraser = document.getElementById('btn-eraser');
const btnCase = document.getElementById('btn-case');

const segBtns = document.querySelectorAll('.seg-btn');
const colorRow = document.getElementById('colorRow');
const colorChips = document.querySelectorAll('.color-chip');

// Map and markers
const viewport = document.getElementById('viewport');
const mapContainer = document.getElementById('mapContainer');
const markerCanvas = document.getElementById('markerCanvas');
const ctx = markerCanvas.getContext('2d', { alpha: true });

// Resize canvas to match viewport
function resizeCanvas() {
  markerCanvas.width = viewport.clientWidth;
  markerCanvas.height = viewport.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Simple marker storage (viewport coordinates)
let markers = [];
let markerColor = '#e53935';

// Draw markers (keeps size constant in screen space)
function drawMarkers() {
  ctx.clearRect(0, 0, markerCanvas.width, markerCanvas.height);
  ctx.fillStyle = markerColor;
  for (const m of markers) {
    // Doodle-style dot
    ctx.beginPath();
    ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // Tiny outline for contrast
    ctx.lineWidth = 2;
    ctx.strokeStyle = app.classList.contains('night-theme') ? '#000' : '#fff';
    ctx.stroke();
  }
}
drawMarkers();

// Open/close helpers
function openPopup(el) {
  el.classList.add('open');
  dim.classList.add('open');
}
function closePopup(el) {
  el.classList.remove('open');
  dim.classList.remove('open');
}

// Buttons
btnSettings.addEventListener('click', () => openPopup(popupSettings));
btnEraser.addEventListener('click', () => openPopup(popupEraser));
btnCase.addEventListener('click', () => openPopup(popupCase));

// Popup close buttons and dim
document.querySelectorAll('.popup-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = btn.closest('.popup');
    closePopup(p);
  });
});
dim.addEventListener('click', () => {
  [popupSettings, popupEraser, popupCase].forEach(p => p.classList.remove('open'));
  dim.classList.remove('open');
});

// Eraser actions
popupEraser.querySelector('[data-action="cancel"]').addEventListener('click', () => closePopup(popupEraser));
popupEraser.querySelector('[data-action="confirm"]').addEventListener('click', () => {
  markers = [];
  drawMarkers();
  closePopup(popupEraser);
});

// Theme segmented control
function setTheme(theme) {
  app.classList.toggle('day-theme', theme === 'day');
  app.classList.toggle('night-theme', theme === 'night');
  segBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  drawMarkers(); // refresh marker outlines for contrast
}
segBtns.forEach(b => {
  b.addEventListener('click', () => setTheme(b.dataset.theme));
});
// default day
setTheme('day');

// Color chips
function setMarkerColor(hex) {
  markerColor = hex;
  colorChips.forEach(c => c.classList.toggle('active', c.dataset.color === hex));
  drawMarkers();
}
colorChips.forEach(c => {
  c.style.color = c.dataset.color;
  c.addEventListener('click', () => setMarkerColor(c.dataset.color));
});
setMarkerColor('#e53935');

// Gesture state
let scale = 1;
let posX = 0, posY = 0;
const minScale = 0.5;
const maxScale = 4.0;

let pointers = new Map(); // id -> {x,y}
let lastMid = null;
let base = { scale: 1, posX: 0, posY: 0 }; // snapshot at gesture start

function updateTransform() {
  mapContainer.style.transform =
    `translate(-50%, -50%) translate(${posX}px, ${posY}px) scale(${scale})`;
}

// Utilities
function getDistance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function getMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Pointer events for touch + mouse
viewport.addEventListener('pointerdown', (e) => {
  viewport.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    // Start pan
    base.posX = posX;
    base.posY = posY;
    base.start = { x: e.clientX, y: e.clientY };
  } else if (pointers.size === 2) {
    // Start pinch
    const [p1, p2] = [...pointers.values()];
    base.scale = scale;
    base.dist = getDistance(p1, p2);
    lastMid = getMidpoint(p1, p2);
    base.posX = posX;
    base.posY = posY;
  }

  e.preventDefault();
});

viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    const p = [...pointers.values()][0];
    const dx = p.x - base.start.x;
    const dy = p.y - base.start.y;
    posX = base.posX + dx;
    posY = base.posY + dy;
    updateTransform();
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const dist = getDistance(p1, p2);
    const mid = getMidpoint(p1, p2);

    // Scale relative to start pinch
    let nextScale = base.scale * (dist / base.dist);
    nextScale = Math.max(minScale, Math.min(maxScale, nextScale));

    // Keep midpoint under fingers by adjusting translation
    // Move pos by delta of midpoint (screen space), damped by scale
    const mdx = mid.x - lastMid.x;
    const mdy = mid.y - lastMid.y;

    scale = nextScale;
    posX = base.posX + mdx;
    posY = base.posY + mdy;

    updateTransform();
    lastMid = mid;
  }

  e.preventDefault();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    lastMid = null;
  }
}
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('pointerleave', endPointer);

// Double-tap to reset view
let lastTap = 0;
viewport.addEventListener('pointerdown', (e) => {
  const now = Date.now();
  if (now - lastTap < 250) {
    scale = 1; posX = 0; posY = 0; updateTransform();
  }
  lastTap = now;
}, { passive: true });

// Add marker on long-press (600ms)
let pressTimer = null;
viewport.addEventListener('pointerdown', (e) => {
  // ignore when two fingers (pinch)
  if (pointers.size > 1) return;
  clearTimeout(pressTimer);
  const startX = e.clientX, startY = e.clientY;
  pressTimer = setTimeout(() => {
    // Add marker at screen coordinates
    markers.push({ x: startX, y: startY });
    drawMarkers();
  }, 600);
});
viewport.addEventListener('pointerup', () => clearTimeout(pressTimer));
viewport.addEventListener('pointercancel', () => clearTimeout(pressTimer));
viewport.addEventListener('pointermove', () => clearTimeout(pressTimer));

// Keyboard zoom (optional on desktop)
document.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=') { scale = Math.min(maxScale, scale * 1.1); updateTransform(); }
  if (e.key === '-' || e.key === '_') { scale = Math.max(minScale, scale / 1.1); updateTransform(); }
});

// Initial transform
updateTransform();// Popup close buttons and dim
document.querySelectorAll('.popup-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = btn.closest('.popup');
    closePopup(p);
  });
});
dim.addEventListener('click', () => {
  [popupSettings, popupEraser, popupCase].forEach(p => p.classList.remove('open'));
  dim.classList.remove('open');
});

// Eraser actions
popupEraser.querySelector('[data-action="cancel"]').addEventListener('click', () => closePopup(popupEraser));
popupEraser.querySelector('[data-action="confirm"]').addEventListener('click', () => {
  markers = [];
  drawMarkers();
  closePopup(popupEraser);
});

// Theme segmented control
function setTheme(theme) {
  app.classList.toggle('day-theme', theme === 'day');
  app.classList.toggle('night-theme', theme === 'night');
  segBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  drawMarkers(); // refresh marker outlines for contrast
}
segBtns.forEach(b => {
  b.addEventListener('click', () => setTheme(b.dataset.theme));
});
// default day
setTheme('day');

// Color chips
function setMarkerColor(hex) {
  markerColor = hex;
  colorChips.forEach(c => c.classList.toggle('active', c.dataset.color === hex));
  drawMarkers();
}
colorChips.forEach(c => {
  c.style.color = c.dataset.color;
  c.addEventListener('click', () => setMarkerColor(c.dataset.color));
});
setMarkerColor('#e53935');

// Gesture state
let scale = 1;
let posX = 0, posY = 0;
const minScale = 0.5;
const maxScale = 4.0;

let pointers = new Map(); // id -> {x,y}
let lastMid = null;
let base = { scale: 1, posX: 0, posY: 0 }; // snapshot at gesture start

function updateTransform() {
  mapContainer.style.transform =
    `translate(-50%, -50%) translate(${posX}px, ${posY}px) scale(${scale})`;
}

// Utilities
function getDistance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function getMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Pointer events for touch + mouse
viewport.addEventListener('pointerdown', (e) => {
  viewport.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    // Start pan
    base.posX = posX;
    base.posY = posY;
    base.start = { x: e.clientX, y: e.clientY };
  } else if (pointers.size === 2) {
    // Start pinch
    const [p1, p2] = [...pointers.values()];
    base.scale = scale;
    base.dist = getDistance(p1, p2);
    lastMid = getMidpoint(p1, p2);
    base.posX = posX;
    base.posY = posY;
  }

  e.preventDefault();
});

viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    const p = [...pointers.values()][0];
    const dx = p.x - base.start.x;
    const dy = p.y - base.start.y;
    posX = base.posX + dx;
    posY = base.posY + dy;
    updateTransform();
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const dist = getDistance(p1, p2);
    const mid = getMidpoint(p1, p2);

    // Scale relative to start pinch
    let nextScale = base.scale * (dist / base.dist);
    nextScale = Math.max(minScale, Math.min(maxScale, nextScale));

    // Keep midpoint under fingers by adjusting translation
    // Move pos by delta of midpoint (screen space), damped by scale
    const mdx = mid.x - lastMid.x;
    const mdy = mid.y - lastMid.y;

    scale = nextScale;
    posX = base.posX + mdx;
    posY = base.posY + mdy;

    updateTransform();
    lastMid = mid;
  }

  e.preventDefault();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    lastMid = null;
  }
}
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('pointerleave', endPointer);

// Double-tap to reset view
let lastTap = 0;
viewport.addEventListener('pointerdown', (e) => {
  const now = Date.now();
  if (now - lastTap < 250) {
    scale = 1; posX = 0; posY = 0; updateTransform();
  }
  lastTap = now;
}, { passive: true });

// Add marker on long-press (600ms)
let pressTimer = null;
viewport.addEventListener('pointerdown', (e) => {
  // ignore when two fingers (pinch)
  if (pointers.size > 1) return;
  clearTimeout(pressTimer);
  const startX = e.clientX, startY = e.clientY;
  pressTimer = setTimeout(() => {
    // Add marker at screen coordinates
    markers.push({ x: startX, y: startY });
    drawMarkers();
  }, 600);
});
viewport.addEventListener('pointerup', () => clearTimeout(pressTimer));
viewport.addEventListener('pointercancel', () => clearTimeout(pressTimer));
viewport.addEventListener('pointermove', () => clearTimeout(pressTimer));

// Keyboard zoom (optional on desktop)
document.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=') { scale = Math.min(maxScale, scale * 1.1); updateTransform(); }
  if (e.key === '-' || e.key === '_') { scale = Math.max(minScale, scale / 1.1); updateTransform(); }
});

// Initial transform
updateTransform();  };

  const LS_KEY = 'doodleMapState.final.v1';

  // Persistence
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(state, {
        theme: saved.theme ?? state.theme,
        color: saved.color ?? state.color,
        scale: saved.scale ?? state.scale,
        translation: saved.translation ?? state.translation,
        markers: saved.markers ?? state.markers,
      });
    } catch (e) {}
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      theme: state.theme,
      color: state.color,
      scale: state.scale,
      translation: state.translation,
      markers: state.markers,
    }));
  }

  // Canvas sizing
  function resizeCanvas() {
    canvas.width = viewport.clientWidth;
    canvas.height = viewport.clientHeight;
    redrawMarkers();
  }
  window.addEventListener('resize', () => {
    resizeCanvas();
    computeFitScale();
    clampScaleToBounds();
    applyTransform();
  });

  // Fit scale to show entire image centered
  function computeFitScale() {
    if (!state.imgNatural.w || !state.imgNatural.h) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const sw = vw / state.imgNatural.w;
    const sh = vh / state.imgNatural.h;
    state.minScale = Math.min(sw, sh);
  }
  function clampScaleToBounds() {
    state.scale = Math.max(state.minScale, Math.min(state.scale, state.maxScale));
  }

  // Transform application
  function applyTransform() {
    const { x, y } = state.translation;
    const s = state.scale;
    mapImage.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
    redrawMarkers();
    saveState();
  }

  // Coordinate conversions
  function screenToMapCoords(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const xMap = (clientX - cx - state.translation.x) / state.scale;
    const yMap = (clientY - cy - state.translation.y) / state.scale;
    return { xMap, yMap };
  }
  function mapToScreenCoords(xMap, yMap) {
    const rect = viewport.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = cx + state.translation.x + xMap * state.scale;
    const y = cy + state.translation.y + yMap * state.scale;
    return { x, y };
  }

  // Markers: constant screen size (never change with zoom)
  const MARKER_RADIUS_PX = 10;
  function drawMarker(m) {
    const { x, y } = mapToScreenCoords(m.xMap, m.yMap);
    const r = MARKER_RADIUS_PX;
    const points = 64;
    const jitter = 0.12;
    const seed = m.jitterSeed || 0;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = m.color;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wobble = (Math.sin(t * 3.1 + seed) + Math.cos(t * 2.7 + seed * 0.7)) * jitter * r;
      const px = x + Math.cos(t) * r + wobble;
      const py = y + Math.sin(t) * r + wobble;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  function redrawMarkers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of state.markers) drawMarker(m);
  }

  // Double-tap for add/remove markers
  const DOUBLE_TAP_MS = 280;
  const DOUBLE_TAP_DIST = 32;
  function maybeHandleDoubleTap(e) {
    const now = performance.now();
    const x = e.clientX, y = e.clientY;
    if (state.isPinching || state.pointerCache.size > 1) return;
    if (now - state.lastTap.time < DOUBLE_TAP_MS) {
      if (Math.hypot(x - state.lastTap.x, y - state.lastTap.y) < DOUBLE_TAP_DIST) {
        toggleMarkerAt(e);
        state.lastTap.time = 0;
        return;
      }
    }
    state.lastTap = { time: now, x, y };
  }
  function vibrateSoft() { try { navigator.vibrate(12); } catch (e) {} }
  function toggleMarkerAt(e) {
    const { xMap, yMap } = screenToMapCoords(e.clientX, e.clientY);
    const tol = 12 / state.scale;
    const idx = state.markers.findIndex(m => Math.hypot(m.xMap - xMap, m.yMap - yMap) <= tol);
    if (idx >= 0) {
      state.markers.splice(idx, 1);
    } else {
      state.markers.push({ xMap, yMap, color: state.color, jitterSeed: Math.random() * 1000 });
    }
    vibrateSoft();
    applyTransform();
  }

  // Gestures: pan + pinch-zoom
  viewport.addEventListener('pointerdown', (e) => {
    viewport.setPointerCapture(e.pointerId);
    state.pointerCache.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  viewport.addEventListener('pointermove', (e) => {
    const prev = state.pointerCache.get(e.pointerId);
    if (!prev) return;
    state.pointerCache.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointerCache.size === 2) {
      const [p1, p2] = Array.from(state.pointerCache.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (!state.isPinching) {
        state.isPinching = true;
        state.pinch.startDist = dist;
        state.pinch.startScale = state.scale;
        state.pinch.center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      } else {
        const factor = dist / state.pinch.startDist;
        const newScale = Math.max(state.minScale, Math.min(state.pinch.startScale * factor, state.maxScale));

        // Keep pinch center anchored
        const before = screenToMapCoords(state.pinch.center.x, state.pinch.center.y);
        state.scale = newScale;
        const after = screenToMapCoords(state.pinch.center.x, state.pinch.center.y);
        state.translation.x += (after.xMap - before.xMap) * state.scale;
        state.translation.y += (after.yMap - before.yMap) * state.scale;

        applyTransform();
      }
    } else if (state.pointerCache.size === 1 && !state.isPinching) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      state.translation.x += dx;
      state.translation.y += dy;
      applyTransform();
    }
  });
  viewport.addEventListener('pointerup', (e) => {
    viewport.releasePointerCapture(e.pointerId);
    state.pointerCache.delete(e.pointerId);
    if (state.pointerCache.size < 2) state.isPinching = false;
    maybeHandleDoubleTap(e);
  });
  viewport.addEventListener('pointercancel', (e) => {
    viewport.releasePointerCapture(e.pointerId);
    state.pointerCache.delete(e.pointerId);
    if (state.pointerCache.size < 2) state.isPinching = false;
  });
  viewport.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Popups
  function openPopup(el) { dim.classList.add('open'); el.classList.add('open'); }
  function closePopups() {
    dim.classList.remove('open');
    popupEraser.classList.remove('open');
    popupSettings.classList.remove('open');
    popupCase.classList.remove('open');
  }
  btnSettings.addEventListener('click', () => openPopup(popupSettings));
  btnEraser.addEventListener('click', () => openPopup(popupEraser));
  btnCase.addEventListener('click', () => openPopup(popupCase));
  dim.addEventListener('click', closePopups);
  document.querySelectorAll('.popup-close').forEach(b => b.addEventListener('click', closePopups));
  popupEraser.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    state.markers = [];
    vibrateSoft();
    applyTransform();
    closePopups();
  });
  popupEraser.querySelector('[data-action="cancel"]').addEventListener('click', closePopups);

  // Settings: theme + color
  function applyTheme(theme) {
    state.theme = theme;
    appEl.classList.toggle('day-theme', theme === 'day');
    appEl.classList.toggle('night-theme', theme === 'night');
    segButtons.forEach(s => s.classList.toggle('active', s.dataset.theme === theme));
    saveState();
  }
  segButtons.forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.theme));
  });
  function selectColor(hex) {
    state.color = hex;
    colorChips.forEach(c => c.classList.toggle('active', c.dataset.color === hex));
    saveState();
  }
  colorChips.forEach(c => {
    c.style.color = c.dataset.color;
    c.addEventListener('click', () => selectColor(c.dataset.color));
  });

  // Init: ensure first load is full-fit centered, not zoomed in
  function init() {
    loadState();
    mapImage.addEventListener('load', () => {
      state.imgNatural.w = mapImage.naturalWidth || mapImage.width;
      state.imgNatural.h = mapImage.naturalHeight || mapImage.height;

      computeFitScale();

      // First-time load => full-fit centered
      if (!localStorage.getItem(LS_KEY)) {
        state.scale = state.minScale;
        state.translation = { x: 0, y: 0 };
      } else {
        clampScaleToBounds();
      }

      resizeCanvas();
      applyTheme(state.theme);
      applyTransform();

      registerSW();
    });
    if (mapImage.complete) mapImage.dispatchEvent(new Event('load'));
  }

  // PWA
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();  function screenToMapCoords(x, y) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return {
      xMap: (x - cx - state.translation.x) / state.scale,
      yMap: (y - cy - state.translation.y) / state.scale
    };
  }

  function mapToScreenCoords(xMap, yMap) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return {
      x: cx + state.translation.x + xMap * state.scale,
      y: cy + state.translation.y + yMap * state.scale
    };
  }

  function drawMarker(m) {
    const { x, y } = mapToScreenCoords(m.xMap, m.yMap);
    const r = 10;
    const points = 64;
    const jitter = 0.12;
    const seed = m.jitterSeed || 0;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = m.color;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wobble = (Math.sin(t * 3.1 + seed) + Math.cos(t * 2.7 + seed * 0.7)) * jitter * r;
      const rx = Math.cos(t) * r + wobble;
      const ry = Math.sin(t) * r + wobble;
      const px = x + rx;
      const py = y + ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redrawMarkers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of state.markers) drawMarker(m);
  }

  function vibrateSoft() {
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function handleMarkerToggle(e) {
    const { xMap, yMap } = screenToMapCoords(e.clientX, e.clientY);
    const tolerance = 12 / state.scale;
    const hitIndex = state.markers.findIndex(m => Math.hypot(m.xMap - xMap, m.yMap - yMap) <= tolerance);
    if (hitIndex >= 0) {
      state.markers.splice(hitIndex, 1);
    } else {
      state.markers.push({ xMap, yMap, color: state.color, jitterSeed: Math.random() * 1000 });
    }
    vibrateSoft();
    applyTransform();
  }

  function maybeHandleDoubleTap(e) {
    const now = performance.now();
    const x = e.clientX;
    const y = e.clientY;
    if (state.isPinching || state.pointerCache.size > 1) return;
    if (now - state.lastTap.time < 280) {
      const dx = Math.abs(x - state.lastTap.x);
      const dy = Math.abs(y - state.lastTap.y);
      if (Math.hypot(dx, dy) < 32) {
        handleMarkerToggle(e);
        state.lastTap.time = 0;
        return;
      }
    }
    state.lastTap = { time: now, x, y };
  }

  function applyTheme(theme) {
    state.theme = theme;
    app.classList.toggle('day-theme', theme === 'day');
    app.classList.toggle('night-theme', theme === 'night');
    saveState();
  }

  function openPopup(popup) {
    dim.classList.add('open');
    popup.classList.add('open');
  }

  function closePopups() {
    dim.classList.remove('open');
    popupEraser.classList.remove('open');
    popupSettings.classList.remove('open');
    popupCase.classList.remove('open');
  }

  function init() {
    loadState();
    mapImage.addEventListener('load', () => {
      state.imgNatural.w = mapImage.naturalWidth;
      state.imgNatural.h = mapImage.naturalHeight;
      computeFitScale();
      if (!localStorage.getItem(LS_KEY)) {
        state.scale = state.minScale;
        state.translation = { x: 0, y: 0 };
      }
      resizeCanvas();
      applyTransform();
      applyTheme(state.theme);
    });
    if (mapImage.complete) mapImage.dispatchEvent(new Event('load'));
  }

  document.getElementById('btn-settings').onclick = () => openPopup(popupSettings);
  document.getElementById('btn-eraser').onclick = () => openPopup(popupEraser);
  document.getElementById('btn-case').onclick = () => openPopup(popupCase);
  dim.onclick = closePopups;
  document.querySelectorAll('.popup-close').forEach(btn => btn.onclick = closePopups);
  popupEraser.querySelector('[data-action="confirm"]').onclick = () => {
    state.markers = [];
    vibrateSoft();
    applyTransform();
    closePopups();
  };
  popupEraser.querySelector('[data-action="cancel"]').onclick = closePopups;
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.seg-btn').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      applyTheme(b.dataset.theme);
    };
  });
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.onclick = () => {
      state.color = chip.dataset.color;
      document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      saveState();
    };
  });
  document.querySelectorAll('.case-item').forEach(item => {
    item.onclick = () => closePopups();
  });

  const viewport = document.getElementById('viewport');
  viewport.addEventListener('pointerdown', e => {
    viewport.setPointerCapture(e.pointerId);
    state.pointerCache.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  viewport.addEventListener('pointermove', e => {
    const prev = state.pointerCache.get(e.pointerId);
    if (!prev) return;
    state.pointerCache.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointerCache.size === 2) {
      const [p1, p2] = Array.from(state.pointerCache.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (!state.isPinching) {
        state.isPinching = true;
        state.pinch.startDist = dist;
        state.pinch.startScale = state.scale;
        state.pinch.center = { x: (p1.x + p2.x) / 2,
