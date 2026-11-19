/* Wartabiye TV Games: the shared 3D toolkit. Bundled with esbuild into games/vendor/w3d.js (see games/src/build.sh).
   It holds the parts of three.js the 3D games use, plus small helpers: a renderer that fills the game stage and
   follows its size, realistic lighting (image-based reflections from a generated room), canvas textures, swipe input,
   and a few reusable original models (a runner, a car, a ball). Loaded only when a 3D game is opened. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, InstancedMesh, Object3D, Color, Fog, FogExp2, Vector2, Vector3, Quaternion, Euler, Matrix4,
  Raycaster, Plane, Box3, Sphere as MathSphere, MathUtils, Clock,
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, TorusGeometry, CapsuleGeometry, CircleGeometry, RingGeometry, LatheGeometry, ExtrudeGeometry, TubeGeometry, Shape, Path, CatmullRomCurve3, BufferGeometry, Float32BufferAttribute, EdgesGeometry,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, MeshLambertMaterial, LineBasicMaterial, ShadowMaterial, SpriteMaterial, Sprite, PointsMaterial, Points, LineSegments,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight, SpotLight,
  CanvasTexture, RepeatWrapping, ClampToEdgeWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, DoubleSide, BackSide, FrontSide, AdditiveBlending, NearestFilter, LinearMipmapLinearFilter,
  PMREMGenerator
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const T = {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, InstancedMesh, Object3D, Color, Fog, FogExp2, Vector2, Vector3, Quaternion, Euler, Matrix4,
  Raycaster, Plane, Box3, MathSphere, MathUtils, Clock,
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, TorusGeometry, CapsuleGeometry, CircleGeometry, RingGeometry, LatheGeometry, ExtrudeGeometry, TubeGeometry, Shape, Path, CatmullRomCurve3, BufferGeometry, Float32BufferAttribute, EdgesGeometry,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, MeshLambertMaterial, LineBasicMaterial, ShadowMaterial, SpriteMaterial, Sprite, PointsMaterial, Points, LineSegments,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight, SpotLight,
  CanvasTexture, RepeatWrapping, ClampToEdgeWrapping, SRGBColorSpace, DoubleSide, BackSide, FrontSide, AdditiveBlending, NearestFilter,
  RoundedBoxGeometry, mergeGeometries
};

export const mobile = matchMedia('(pointer:coarse)').matches || Math.min(screen.width, screen.height) < 600;

export function webgl() {
  try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

/* A 3D view inside the game stage.
   o.fov, o.near, o.far: camera; o.shadows (default true); o.bg: background colour or gradient [top, bottom];
   o.aspect: fixed aspect ratio (width / height) or null to fill the stage; o.reserve: stage pixels kept for buttons. */
export function setup(api, o) {
  o = o || {};
  const wrap = api.h('div', { class: 'w3d', style: { position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' } });
  const box = api.h('div', { class: 'w3d-box', style: { position: 'relative', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,.45)', touchAction: 'none', flex: '0 0 auto' } });
  // graphics quality from the player's settings: low = sharp enough and fast, high = full resolution
  const gfx = api.gfx || 'auto';
  if (gfx === 'low') o.shadows = false;
  const renderer = new WebGLRenderer({ antialias: gfx !== 'low' && (!mobile || devicePixelRatio < 2 || gfx === 'high'), powerPreference: 'high-performance', preserveDrawingBuffer: !!o.keep });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, gfx === 'low' ? 1 : gfx === 'high' ? 2.5 : mobile ? 1.75 : 2));
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure || 1.05;
  if (o.shadows !== false) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap; }
  const cv = renderer.domElement; cv.style.display = 'block'; cv.style.width = '100%'; cv.style.height = '100%'; cv.setAttribute('aria-label', o.label || '3D game');
  box.append(cv); wrap.append(box);
  const hud = api.h('div', { class: 'w3d-hud', style: { position: 'absolute', inset: '0', pointerEvents: 'none', fontFamily: 'Archivo,system-ui,sans-serif', color: '#fff' } });
  box.append(hud);
  api.el.append(wrap);
  const scene = new Scene();
  if (Array.isArray(o.bg)) scene.background = gradientTex(o.bg); else if (o.bg) scene.background = new Color(o.bg);
  const camera = new PerspectiveCamera(o.fov || 55, 1, o.near || 0.1, o.far || 400);
  const pm = new PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env; pm.dispose();
  scene.environmentIntensity = o.envIntensity == null ? 0.55 : o.envIntensity;
  let W = 0, H = 0;
  function size() {
    const r = api.el.getBoundingClientRect(); const avW = Math.max(100, r.width - 16), avH = Math.max(100, r.height - 16 - (o.reserve || 0));
    let w = avW, hh = avH; if (o.aspect) { if (w / hh > o.aspect) w = hh * o.aspect; else hh = w / o.aspect; }
    w = Math.floor(w); hh = Math.floor(hh); if (w === W && hh === H) return;
    W = w; H = hh; box.style.width = w + 'px'; box.style.height = hh + 'px'; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
    if (ctx.onResize) ctx.onResize(w, hh); render();
  }
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(api.el); else addEventListener('resize', size);
  function render() { if (W) renderer.render(scene, camera); }
  const disposables = [];
  const ctx = {
    T, renderer, scene, camera, cv, box, hud, wrap, render, size, mobile,
    get W() { return W; }, get H() { return H; },
    track(x) { disposables.push(x); return x; },
    // the point on screen (in canvas pixels, 0..W) of a 3D position
    toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; },
    ndc(e) { const r = cv.getBoundingClientRect(); const p = e.touches ? (e.touches[0] || e.changedTouches[0]) : e; return new Vector2(((p.clientX - r.left) / r.width) * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1); },
    dispose() {
      if (ro) ro.disconnect(); else removeEventListener('resize', size);
      scene.traverse(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(function (x) { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); });
      disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
      env.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
    }
  };
  requestAnimationFrame(size); size();
  return ctx;
}

// a sun with soft shadows that follows a target (so a long track keeps sharp shadows)
export function sun(scene, o) {
  o = o || {};
  const hemi = new HemisphereLight(o.sky || 0xcfe8ff, o.ground || 0x4a3b2a, o.hemi == null ? 0.75 : o.hemi); scene.add(hemi);
  const d = new DirectionalLight(o.color || 0xfff1dc, o.intensity == null ? 2.2 : o.intensity);
  const off = o.offset || new Vector3(6, 14, 8); d.position.copy(off); d.castShadow = o.shadows !== false;
  const s = o.size || 14, ms = mobile ? 1024 : 2048;
  Object.assign(d.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 80 }); d.shadow.mapSize.set(ms, ms); d.shadow.bias = -0.0004; d.shadow.normalBias = 0.02;
  scene.add(d); scene.add(d.target);
  return { light: d, hemi, follow(v) { d.position.copy(v).add(off); d.target.position.copy(v); } };
}

// a texture painted with the 2D canvas API: draw(ctx, w, h)
export function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export function gradientTex(stops) {
  return canvasTex(4, 256, function (x, w, h) { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(function (c, i) { g.addColorStop(i / (stops.length - 1), c); }); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}
export function noise(x, w, h, amt, alpha) { for (let i = 0; i < amt; i++) { x.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (alpha || 0.05) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }

export const mat = (color, o) => new MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0 }, o || {}));
export function shadowy(m, cast, receive) { m.traverse(function (c) { if (c.isMesh) { c.castShadow = cast !== false; c.receiveShadow = !!receive; } }); return m; }

/* swipe and tap on an element: cb('l'|'r'|'u'|'d'|'tap', event, info) */
export function swipe(el, cb, o) {
  o = o || {}; let sx = 0, sy = 0, st = 0, on = false, done = false;
  function down(e) { on = true; done = false; sx = e.clientX; sy = e.clientY; st = performance.now(); if (o.capture !== false && el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (x) {} }
  function move(e) {
    if (!on || done) return; const dx = e.clientX - sx, dy = e.clientY - sy, m = o.min || 28;
    if (Math.abs(dx) > m || Math.abs(dy) > m) { done = true; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'), e, { dx, dy, t: performance.now() - st }); }
  }
  function up(e) { if (on && !done) cb('tap', e, { dx: e.clientX - sx, dy: e.clientY - sy, t: performance.now() - st }); on = false; }
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', function () { on = false; });
}

// ------------------------------------------------------------------ original models
/* a runner/athlete: returns {g, parts:{body, head, armL, armR, legL, legR}, pose(t, mode)} . Height ≈ 1.8 */
export function person(o) {
  o = o || {};
  const skin = mat(o.skin || 0x8d5524, { roughness: 0.55 }), shirt = mat(o.shirt || 0x037bdc, { roughness: 0.7 }), pants = mat(o.pants || 0x1e293b, { roughness: 0.8 }), shoe = mat(o.shoe || 0xf8fafc, { roughness: 0.4 }), hair = mat(o.hair || 0x111111, { roughness: 0.9 });
  const g = new Group(), body = new Group(); g.add(body);
  const torso = new Mesh(new CapsuleGeometry(0.27, 0.42, 6, 14), shirt); torso.position.y = 1.18; body.add(torso);
  if (o.number) { const n = new Mesh(new PlaneGeometry(0.3, 0.3), new MeshStandardMaterial({ map: canvasTex(64, 64, function (x) { x.fillStyle = '#fff'; x.font = 'bold 44px Archivo,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(o.number), 32, 34); }), transparent: true })); n.position.set(0, 1.22, -0.275); n.rotation.y = Math.PI; body.add(n); }
  const head = new Group(); head.position.y = 1.72; body.add(head);
  head.add(new Mesh(new SphereGeometry(0.2, 24, 18), skin));
  const hr = new Mesh(new SphereGeometry(0.205, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair); hr.rotation.x = -0.25; head.add(hr);
  if (o.cap) { const c = new Mesh(new CylinderGeometry(0.21, 0.22, 0.1, 20), mat(o.cap)); c.position.y = 0.13; head.add(c); }
  const neck = new Mesh(new CylinderGeometry(0.08, 0.09, 0.12, 10), skin); neck.position.y = 1.52; body.add(neck);
  function limb(len, r, m1, m2, foot) {
    const top = new Group(), up = new Mesh(new CapsuleGeometry(r, len * 0.5, 4, 10), m1); up.position.y = -len * 0.35; top.add(up);
    const knee = new Group(); knee.position.y = -len * 0.62; top.add(knee);
    const lo = new Mesh(new CapsuleGeometry(r * 0.85, len * 0.48, 4, 10), m2); lo.position.y = -len * 0.3; knee.add(lo);
    if (foot) { const f = new Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.3, 2, 0.04), foot); f.position.set(0, -len * 0.62, -0.06); knee.add(f); }
    else { const hnd = new Mesh(new SphereGeometry(r * 1.05, 10, 8), m2); hnd.position.y = -len * 0.6; knee.add(hnd); }
    top.userData.knee = knee; return top;
  }
  const armL = limb(0.62, 0.075, shirt, skin), armR = limb(0.62, 0.075, shirt, skin); armL.position.set(-0.36, 1.48, 0); armR.position.set(0.36, 1.48, 0); body.add(armL, armR);
  const legL = limb(0.86, 0.1, pants, o.bareLegs ? skin : pants, shoe), legR = limb(0.86, 0.1, pants, o.bareLegs ? skin : pants, shoe); legL.position.set(-0.15, 0.9, 0); legR.position.set(0.15, 0.9, 0); body.add(legL, legR);
  shadowy(g);
  const parts = { body, head, armL, armR, legL, legR };
  function pose(t, mode) {
    const k = mode === 'idle' ? 0.12 : 1, s = Math.sin(t), c = Math.cos(t);
    if (mode === 'jump') { legL.rotation.x = -0.9; legR.rotation.x = 0.2; legL.userData.knee.rotation.x = 1.2; legR.userData.knee.rotation.x = 0.5; armL.rotation.x = 0.9; armR.rotation.x = -0.6; body.rotation.x = 0.05; return; }
    if (mode === 'slide') { legL.rotation.x = -1.35; legR.rotation.x = -1.2; legL.userData.knee.rotation.x = 0.2; legR.userData.knee.rotation.x = 0.4; armL.rotation.x = -1.1; armR.rotation.x = -1.1; body.rotation.x = -0.9; return; }
    body.rotation.x = mode === 'idle' ? 0 : -0.12;
    legL.rotation.x = s * 0.9 * k; legR.rotation.x = -s * 0.9 * k;
    legL.userData.knee.rotation.x = Math.max(0, -c) * 1.3 * k + 0.05; legR.userData.knee.rotation.x = Math.max(0, c) * 1.3 * k + 0.05;
    armL.rotation.x = -s * 0.8 * k; armR.rotation.x = s * 0.8 * k; armL.userData.knee.rotation.x = -0.6 * k; armR.userData.knee.rotation.x = -0.6 * k;
    body.position.y = Math.abs(s) * 0.07 * k;
  }
  pose(0, 'idle');
  return { g, parts, pose };
}

/* a modern hatchback/sedan facing -Z. Length ≈ 4.2. o.color, o.taxi, o.police */
export function car(o) {
  o = o || {};
  const g = new Group();
  const paint = new MeshPhysicalMaterial({ color: o.color || 0xd90429, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new MeshPhysicalMaterial({ color: 0x0b1220, metalness: 0.2, roughness: 0.05, transmission: 0, opacity: 0.92, transparent: true, clearcoat: 1 });
  const black = mat(0x0f172a, { roughness: 0.7 }), chrome = mat(0xe2e8f0, { metalness: 1, roughness: 0.2 });
  const L = o.long || 4.2, Wd = 1.8;
  const body = new Mesh(new RoundedBoxGeometry(Wd, 0.62, L, 3, 0.18), paint); body.position.y = 0.62; g.add(body);
  const cab = new Mesh(new RoundedBoxGeometry(Wd * 0.86, 0.55, L * 0.5, 3, 0.2), glass); cab.position.set(0, 1.12, 0.15); g.add(cab);
  const roof = new Mesh(new RoundedBoxGeometry(Wd * 0.84, 0.08, L * 0.38, 2, 0.04), paint); roof.position.set(0, 1.41, 0.2); g.add(roof);
  const wheelG = new CylinderGeometry(0.36, 0.36, 0.26, 22); wheelG.rotateZ(Math.PI / 2); const rimG = new CylinderGeometry(0.22, 0.22, 0.27, 12); rimG.rotateZ(Math.PI / 2);
  const wheels = [];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { const w = new Group(); w.add(new Mesh(wheelG, black), new Mesh(rimG, chrome)); w.position.set(p[0] * (Wd / 2 - 0.08), 0.36, p[1] * L * 0.32); g.add(w); wheels.push(w); });
  const hl = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d5, emissiveIntensity: 1.2 }), tl = new MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xff1a1a, emissiveIntensity: 0.9 });
  [-1, 1].forEach(function (s) { const a = new Mesh(new RoundedBoxGeometry(0.42, 0.14, 0.06, 2, 0.03), hl); a.position.set(s * 0.6, 0.74, -L / 2); g.add(a); const b = new Mesh(new RoundedBoxGeometry(0.42, 0.12, 0.06, 2, 0.03), tl); b.position.set(s * 0.6, 0.76, L / 2); g.add(b); });
  const grill = new Mesh(new BoxGeometry(0.8, 0.14, 0.04), black); grill.position.set(0, 0.55, -L / 2 - 0.005); g.add(grill);
  if (o.taxi) { const s = new Mesh(new RoundedBoxGeometry(0.5, 0.16, 0.25, 2, 0.04), mat(0xffd60a, { emissive: 0x4a3b00 })); s.position.set(0, 1.53, 0.2); g.add(s); }
  if (o.police) { [-1, 1].forEach(function (s) { const b = new Mesh(new BoxGeometry(0.32, 0.12, 0.2), new MeshStandardMaterial({ color: s < 0 ? 0x1d4ed8 : 0xdc2626, emissive: s < 0 ? 0x1d4ed8 : 0xdc2626, emissiveIntensity: 1.5 })); b.position.set(s * 0.2, 1.52, 0.2); g.add(b); }); }
  shadowy(g);
  g.userData.wheels = wheels;
  return g;
}

export function truck(o) {
  o = o || {}; const g = new Group();
  const cabM = new MeshPhysicalMaterial({ color: o.color || 0x1d4ed8, metalness: 0.4, roughness: 0.35, clearcoat: 0.8 });
  const cab = new Mesh(new RoundedBoxGeometry(2.1, 1.9, 1.8, 3, 0.15), cabM); cab.position.set(0, 1.35, -3.1); g.add(cab);
  const win = new Mesh(new BoxGeometry(1.8, 0.6, 0.05), mat(0x0b1220, { metalness: 0.3, roughness: 0.05 })); win.position.set(0, 1.85, -4.02); g.add(win);
  const box = new Mesh(new RoundedBoxGeometry(2.3, 2.5, 5.2, 2, 0.08), mat(o.box || 0xf1f5f9, { roughness: 0.5 })); box.position.set(0, 1.75, 0.5); g.add(box);
  const stripe = new Mesh(new BoxGeometry(2.32, 0.3, 5.0), mat(o.stripe || 0xf2060a)); stripe.position.set(0, 1.4, 0.5); g.add(stripe);
  const wg = new CylinderGeometry(0.48, 0.48, 0.36, 18); wg.rotateZ(Math.PI / 2); const wm = mat(0x0f172a, { roughness: 0.8 });
  [[-1, -3.1], [1, -3.1], [-1, 1.8], [1, 1.8], [-1, 0.6], [1, 0.6]].forEach(function (p) { const w = new Mesh(wg, wm); w.position.set(p[0] * 1.02, 0.48, p[1]); g.add(w); });
  shadowy(g); return g;
}

// a ball with a painted pattern: 'football' | 'basket' | 'plain'
export function ball(kind, r) {
  r = r || 0.11;
  const tex = canvasTex(512, 256, function (x, w, h) {
    if (kind === 'basket') {
      x.fillStyle = '#e8661f'; x.fillRect(0, 0, w, h); noise(x, w, h, 6000, 0.08);
      x.strokeStyle = '#2a1206'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
      [w * 0.25, w * 0.75].forEach(function (cx) { x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, h); x.stroke(); });
      x.beginPath(); for (let i = 0; i <= w; i += 4) x.lineTo(i, h / 2 + Math.sin(i / w * Math.PI * 4) * h * 0.32); x.stroke();
    } else if (kind === 'football') {
      x.fillStyle = '#f8fafc'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0f172a';
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
        const cx = (i + (row % 2) * 0.5) * w / 6, cy = h * (0.18 + row * 0.32), rr = row === 1 ? 26 : 20;
        x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9); } x.fill();
      }
      x.strokeStyle = 'rgba(15,23,42,.35)'; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(i * w / 12, 0); x.lineTo(i * w / 12 + 20, h); x.stroke(); }
    } else { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
  });
  const m = new Mesh(new SphereGeometry(r, 32, 24), new MeshStandardMaterial({ map: tex, roughness: kind === 'basket' ? 0.75 : 0.45 }));
  m.castShadow = true; return m;
}

// a soft round shadow (cheap, for objects in the air)
export function blob(r, op) {
  const t = canvasTex(128, 128, function (x) { const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,' + (op || 0.45) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const m = new Mesh(new PlaneGeometry(r * 2, r * 2), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m;
}

// a little particle burst (coins, goals): returns update(dt) → false when finished
export function burst(scene, pos, color, n) {
  n = n || 24; const geo = new BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z; v.push(new Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4)); }
  geo.setAttribute('position', new Float32BufferAttribute(p, 3));
  const m = new Points(geo, new PointsMaterial({ color: color || 0xffd166, size: 0.12, transparent: true, depthWrite: false, blending: AdditiveBlending })); scene.add(m);
  let life = 0.8;
  return function (dt) {
    life -= dt; const a = geo.attributes.position.array;
    for (let i = 0; i < n; i++) { v[i].y -= 9 * dt; a[i * 3] += v[i].x * dt; a[i * 3 + 1] += v[i].y * dt; a[i * 3 + 2] += v[i].z * dt; }
    geo.attributes.position.needsUpdate = true; m.material.opacity = Math.max(0, life / 0.8);
    if (life <= 0) { scene.remove(m); geo.dispose(); m.material.dispose(); return false; } return true;
  };
}

// on-screen buttons over the 3D view (bottom row). btns: [[label, aria, onDown, onUp?], ...]
export function pad(api, ctx, btns) {
  const row = api.h('div', { class: 'g-row w3d-pad', style: { marginTop: '0' } });
  btns.forEach(function (b) {
    const el = api.h('button', { type: 'button', class: 'g-btn', 'aria-label': b[1], text: b[0], style: { minWidth: '62px', minHeight: '52px', fontSize: '22px', touchAction: 'none' } });
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); if (!api.paused) b[2](); });
    if (b[3]) ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (k) { el.addEventListener(k, function () { b[3](); }); });
    row.append(el);
  });
  ctx.wrap.append(row); return row;
}
