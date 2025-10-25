(() => {
  const app = document.getElementById('app');
  const mapImage = document.getElementById('mapImage');
  const canvas = document.getElementById('markerCanvas');
  const ctx = canvas.getContext('2d');
  const dim = document.getElementById('dim');
  const popupEraser = document.getElementById('popup-eraser');
  const popupSettings = document.getElementById('popup-settings');
  const popupCase = document.getElementById('popup-case');

  const state = {
    theme: 'day',
    color: '#e53935',
    scale: 1,
    minScale: 1,
    maxScale: 5,
    translation: { x: 0, y: 0 },
    markers: [],
    pointerCache: new Map(),
    isPinching: false,
    pinch: {},
    lastTap: { time: 0, x: 0, y: 0 },
    imgNatural: { w: 0, h: 0 }
  };

  const LS_KEY = 'doodleMapState';

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      theme: state.theme,
      color: state.color,
      scale: state.scale,
      translation: state.translation,
      markers: state.markers
    }));
  }

  function loadState() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redrawMarkers();
  }

  function computeFitScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = vw / state.imgNatural.w;
    const sh = vh / state.imgNatural.h;
    state.minScale = Math.min(sw, sh);
  }

  function applyTransform() {
    const { x, y } = state.translation;
    mapImage.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${state.scale})`;
    redrawMarkers();
    saveState();
  }

  function screenToMapCoords(x, y) {
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