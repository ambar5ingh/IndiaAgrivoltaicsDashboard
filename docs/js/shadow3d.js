// 3D view of the array with real-time sun shadows (three.js). Axes: x = east, y = up, z = south.
let THREE = null, OrbitControls = null;
let renderer, scene, camera, controls, sunLight, hemi, arrayGroup, groundMat, host, geomKey = '';

async function load() {
  if (THREE) return true;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('../vendor/three/OrbitControls.js'));
    return true;
  } catch (e) { return false; }
}

export async function mount3D(el) {
  if (!(await load())) { el.innerHTML = '<div class="fallback">3D view needs WebGL and ES modules, which this browser does not support.</div>'; return false; }
  if (host === el && renderer) return true;
  host = el;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { el.innerHTML = '<div class="fallback">WebGL is not available, so the 3D view is off. The 2D cross-section shows the same shadows.</div>'; return false; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.innerHTML = '';
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(-26, 18, 26);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0);
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.addEventListener('change', draw);
  hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a5a, 0.55);
  scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xfff4dc, 2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 200;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight); scene.add(sunLight.target);
  groundMat = new THREE.MeshLambertMaterial({ color: 0xc9b48a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // compass labels
  for (const [t, x, z] of [['N', 0, -40], ['S', 0, 40], ['E', 40, 0], ['W', -40, 0]]) scene.add(label(t, x, z));
  arrayGroup = new THREE.Group(); scene.add(arrayGroup);
  new ResizeObserver(resize).observe(el);
  resize();
  return true;
}
function label(text, x, z) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#13322c'; g.font = 'bold 44px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  s.position.set(x, 1.5, z); s.scale.set(3, 3, 3); return s;
}
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || 600, h = host.clientHeight || 420;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); draw();
}
function draw() { if (renderer) renderer.render(scene, camera); }

const panelMat = () => new THREE.MeshStandardMaterial({ color: 0x1f3663, metalness: 0.3, roughness: 0.35 });
const postMat = () => new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.5 });

function build(G) {
  arrayGroup.clear();
  const rows = Math.max(3, Math.min(9, Math.floor(56 / G.P)));
  const len = 36, pm = panelMat(), postM = postMat();
  const crop = new THREE.MeshLambertMaterial({ color: 0x4f9a52 });
  const cropGeo = new THREE.ConeGeometry(0.22, 0.55, 6);
  const cropPos = [];
  for (let k = -Math.floor(rows / 2); k <= Math.floor(rows / 2); k++) {
    const row = new THREE.Group();
    row.userData.k = k;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(G.nsRows ? 0.06 : len, G.nsRows ? (G.key === 'vertical' ? G.W : 0.06) : 0.06, G.nsRows ? len : G.W), pm);
    if (!G.nsRows) panel.geometry = new THREE.BoxGeometry(len, 0.06, G.W);
    if (G.key === 'tracker') panel.geometry = new THREE.BoxGeometry(G.W, 0.06, len);
    panel.castShadow = true; panel.receiveShadow = true;
    panel.name = 'panel';
    row.add(panel);
    if (G.nsRows) {
      row.position.set(k * G.P, 0, 0);
      if (G.key === 'vertical') panel.position.set(0, G.low + G.W / 2, 0);
      else panel.position.set(0, G.hub, 0);
      for (let z = -len / 2; z <= len / 2; z += 6) {
        const h = G.key === 'vertical' ? G.low + G.W : G.hub;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 6), postM); p.position.set(0, h / 2, z); p.castShadow = true; row.add(p);
      }
    } else {
      const b = G.tilt * Math.PI / 180;
      const yc = G.low + G.W / 2 * Math.sin(b);
      row.position.set(0, 0, -k * G.P);
      panel.position.set(0, yc, 0);
      panel.rotation.x = b; // normal tilts toward the south (+z), south edge lowest
      const zLow = G.W / 2 * Math.cos(b), zHigh = -G.W / 2 * Math.cos(b);
      for (let x = -len / 2; x <= len / 2; x += 6) {
        for (const [z, h] of [[zLow, G.low], [zHigh, G.low + G.W * Math.sin(b)]]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 6), postM); p.position.set(x, h / 2, z * 0.92); p.castShadow = true; row.add(p);
        }
      }
    }
    arrayGroup.add(row);
    // crop rows: under and between the panels
    const lanes = Math.max(2, Math.round(G.P / 0.9));
    for (let i = 0; i < lanes; i++) {
      const off = (i + 0.5) * G.P / lanes - G.P / 2;
      if (G.key !== 'elevated' && G.key !== 'greenhouse' && Math.abs(off) < 0.45 + (G.key === 'vertical' ? 0.2 : G.W / 2 * 0.6)) continue; // strip under ground-mounted rows
      for (let t = -len / 2 + 0.5; t < len / 2; t += 1.0) cropPos.push(G.nsRows ? [k * G.P + off, t] : [t, -k * G.P + off]);
    }
  }
  const inst = new THREE.InstancedMesh(cropGeo, crop, cropPos.length);
  const m = new THREE.Matrix4();
  cropPos.forEach(([x, z], i) => { m.makeTranslation(x, 0.28, z); inst.setMatrixAt(i, m); });
  inst.receiveShadow = true; inst.castShadow = false;
  arrayGroup.add(inst);
}

// sun: {east, north, up}; G: geometry
export function update3D(G, sun) {
  if (!renderer) return;
  const key = [G.key, G.W, G.P.toFixed(2), G.low, G.tilt].join('|');
  if (key !== geomKey) { build(G); geomKey = key; }
  if (G.key === 'tracker') {
    let th = sun.up > 0 ? Math.atan2(sun.east, sun.up) : 0;
    th = Math.max(-55 * Math.PI / 180, Math.min(55 * Math.PI / 180, th));
    arrayGroup.children.forEach(r => { const p = r.getObjectByName && r.getObjectByName('panel'); if (p) p.rotation.z = -th; });
  }
  const up = Math.max(0.0, sun.up);
  const dir = new THREE.Vector3(sun.east, up, -sun.north).normalize();
  sunLight.position.copy(dir.clone().multiplyScalar(80));
  sunLight.target.position.set(0, 0, 0);
  sunLight.intensity = up > 0.02 ? 0.6 + 2.0 * Math.min(1, up * 1.6) : 0;
  hemi.intensity = 0.25 + 0.45 * Math.min(1, up * 2);
  const day = new THREE.Color(0x9fd0f0), dusk = new THREE.Color(0xf3c38b), night = new THREE.Color(0x1d2b45);
  scene.background = up <= 0.02 ? night : dusk.clone().lerp(day, Math.min(1, up * 2.5));
  draw();
}
