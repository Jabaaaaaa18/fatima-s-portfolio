// Real-time 3D educational objects shown beside the hero storytelling passages.
// Each object fits inside a unit sphere and is lit by the hero scene.
import * as THREE from 'three';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function materials() {
  return {
    roseGold: new THREE.MeshPhysicalMaterial({ color: '#eab3a3', metalness: 1, roughness: 0.22 }),
    roseGoldSatin: new THREE.MeshPhysicalMaterial({ color: '#d99a8c', metalness: 1, roughness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffe3ee', metalness: 0, roughness: 0.06, transmission: 1, thickness: 1.1, ior: 1.38,
      attenuationColor: new THREE.Color('#ff9ec7'), attenuationDistance: 2.4, specularIntensity: 1, envMapIntensity: 1.3,
    }),
    frosted: new THREE.MeshPhysicalMaterial({
      color: '#ffdce9', roughness: 0.38, transmission: 1, thickness: 0.2, ior: 1.45, side: THREE.DoubleSide,
    }),
    paper: new THREE.MeshPhysicalMaterial({
      color: '#f8ecf0', roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ffc5d9'), side: THREE.DoubleSide,
    }),
    leather: new THREE.MeshPhysicalMaterial({
      color: '#4a1838', roughness: 0.48, sheen: 0.8, sheenColor: new THREE.Color('#d47aa2'), clearcoat: 0.3, clearcoatRoughness: 0.4,
    }),
    satin: new THREE.MeshPhysicalMaterial({
      color: '#3a1230', roughness: 0.42, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#f08cb7'),
      side: THREE.DoubleSide,
    }),
    glow: new THREE.MeshStandardMaterial({ color: '#ffb3d2', emissive: '#ff5fa3', emissiveIntensity: 2.2 }),
    glowCore: new THREE.MeshStandardMaterial({ color: '#fff0f6', emissive: '#ffb8d6', emissiveIntensity: 3.2 }),
  };
}

function rod(a, b, r, mat, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.normalize());
  return m;
}

function finish(group, name) {
  group.name = name;
  const mats = new Set();
  group.traverse((o) => {
    if (o.isMesh) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => { m.fog = false; mats.add(m); });
    }
  });
  group.userData.materials = [...mats];
  group.userData.materials.forEach((m) => { m.userData.baseOpacity = m.opacity; m.transparent = true; });
  return group;
}

// ---------- 1. Floating glass globe: knowledge ----------
export function createGlobe() {
  const M = materials();
  const g = new THREE.Group();
  const globe = new THREE.Group();
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 48), M.glass));
  // Rose-gold latitude / longitude filigree just inside the glass.
  for (let i = -2; i <= 2; i++) {
    const lat = (i / 3) * (Math.PI / 2);
    const t = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(lat) * 0.6, 0.0045, 6, 120), M.roseGold);
    t.rotation.x = Math.PI / 2; t.position.y = Math.sin(lat) * 0.6;
    globe.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.0045, 6, 120), M.roseGold);
    t.rotation.y = (i / 6) * Math.PI;
    globe.add(t);
  }
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), M.glowCore));
  // A few glowing "ideas" orbiting inside.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 0.25 + (i % 3) * 0.09;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.glow);
    s.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.18, Math.sin(a) * r);
    globe.add(s);
  }
  globe.rotation.z = 0.41;
  globe.position.y = 0.12;
  globe.name = 'spin';
  g.add(globe);
  // Meridian arc + stand.
  // Semicircular meridian from pole to pole, tilted with the globe's axis.
  const TILT = 0.41, AR = 0.7;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(AR, 0.022, 12, 120, Math.PI), M.roseGold);
  arc.rotation.z = -Math.PI / 2 + TILT;
  arc.position.y = 0.12;
  g.add(arc);
  for (const s of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.roseGold);
    pin.position.set(-s * Math.sin(TILT) * AR, 0.12 + s * Math.cos(TILT) * AR, 0);
    g.add(pin);
  }
  g.add(rod(v3(Math.sin(TILT) * AR, 0.12 - Math.cos(TILT) * AR, 0), v3(0, -0.82, 0), 0.026, M.roseGold));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.07, 64), M.leather);
  base.position.y = -0.84; g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.012, 8, 80), M.roseGold);
  rim.rotation.x = Math.PI / 2; rim.position.y = -0.81; g.add(rim);
  return finish(g, 'globe');
}

// ---------- 2. Elegant open book: learning ----------
export function createBook() {
  const M = materials();
  const g = new THREE.Group();
  const HW = 0.62, D = 0.86;
  const profile = (u) => Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.18)) * (1 - 0.16 * u * u);
  const bend = (geo, lift) => {
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + lift * profile(Math.min(1, Math.abs(p.getX(i)) / HW)));
    geo.computeVertexNormals();
    return geo;
  };
  g.add(new THREE.Mesh(bend(new THREE.BoxGeometry(HW * 2 + 0.06, 0.03, D + 0.06, 64, 1, 4), 0.09), M.leather));
  for (const s of [-1, 1]) {
    const w = HW - 0.02;
    const b = new THREE.BoxGeometry(w, 0.07, D, 40, 1, 2);
    b.translate(s * (w / 2 + 0.018), 0.05, 0);
    g.add(new THREE.Mesh(bend(b, 0.1), M.paper));
    // Rose-gold gilded fore-edge
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, D), M.roseGold);
    edge.position.set(s * HW, 0.05 + 0.1 * profile(1), 0);
    g.add(edge);
  }
  // Turning pages
  [[0.5, 0.35, M.paper], [1.05, 0.42, M.paper], [1.9, -0.3, M.frosted]].forEach(([a0, curl, mat]) => {
    const w = HW - 0.05;
    const p = new THREE.PlaneGeometry(w, D - 0.05, 32, 1);
    const pos = p.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + w / 2, t = x / w, a = a0 + curl * t * t;
      pos.setXYZ(i, Math.cos(a) * x, 0.08 + Math.sin(a) * x, pos.getY(i));
    }
    p.computeVertexNormals();
    g.add(new THREE.Mesh(p, mat));
  });
  // Rising motes of light (ideas leaving the page)
  const motes = new THREE.Group(); motes.name = 'motes';
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.01 + (i % 4) * 0.005, 10, 8), i % 3 ? M.glow : M.glowCore);
    const a = i * 2.4, r = 0.08 + (i / 26) * 0.35;
    m.position.set(Math.cos(a) * r, 0.2 + (i / 26) * 0.75, Math.sin(a) * r * 0.6);
    motes.add(m);
  }
  g.add(motes);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, D + 0.06, 20, 1, false, Math.PI / 2, Math.PI), M.roseGold);
  spine.rotation.x = Math.PI / 2; spine.position.y = -0.01;
  g.add(spine);
  g.position.y = -0.25;
  const wrap = new THREE.Group(); wrap.add(g); wrap.rotation.x = 0.42;
  return finish(wrap, 'book');
}

// ---------- 3. Interconnected geometric structure: collaboration ----------
export function createStructure() {
  const M = materials();
  const g = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(0.72, 0);
  const pos = ico.getAttribute('position');
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const p = v3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!verts.some((q) => q.distanceTo(p) < 1e-4)) verts.push(p);
  }
  // Frosted glass faces on alternating triangles ("shared surfaces").
  const faces = [];
  for (let i = 0; i < pos.count; i += 3) faces.push([v3(pos.getX(i), pos.getY(i), pos.getZ(i)), v3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)), v3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))]);
  faces.forEach((f, i) => {
    if (i % 3 !== 0) return;
    const geo = new THREE.BufferGeometry().setFromPoints(f.map((p) => p.clone().multiplyScalar(0.985)));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, M.frosted));
  });
  const edges = new THREE.EdgesGeometry(ico);
  const ep = edges.getAttribute('position');
  for (let i = 0; i < ep.count; i += 2) {
    const a = v3(ep.getX(i), ep.getY(i), ep.getZ(i)), b = v3(ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1));
    g.add(rod(a, b, 0.011, M.roseGold));
  }
  // Every node also links to the shared centre with a fine light thread.
  verts.forEach((p, i) => {
    const node = new THREE.Mesh(new THREE.SphereGeometry(i % 2 ? 0.055 : 0.075, 24, 16), i % 2 ? M.roseGold : M.glass);
    node.position.copy(p); g.add(node);
    g.add(rod(v3(0, 0, 0), p.clone().multiplyScalar(0.9), 0.003, M.glow, 5));
  });
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), M.glowCore);
  heart.name = 'heart';
  g.add(heart);
  // Outer orbit ring with satellites (the wider community).
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.006, 8, 160), M.roseGoldSatin);
  ring.rotation.x = Math.PI / 2.4; g.add(ring);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), M.glow);
    s.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95).applyAxisAngle(v3(1, 0, 0), Math.PI / 2.4 - Math.PI / 2);
    g.add(s);
  }
  g.scale.setScalar(0.92);
  return finish(g, 'structure');
}

// ---------- 4. Glowing graduation cap: achievement ----------
export function createCap() {
  const M = materials();
  const g = new THREE.Group();
  const S = 1.15;
  const board = new THREE.Mesh(new THREE.BoxGeometry(S, 0.045, S), M.satin);
  board.position.y = 0.18; g.add(board);
  // Rose-gold trim around the board
  const h = S / 2, y = 0.18;
  [[v3(-h, y, -h), v3(h, y, -h)], [v3(h, y, -h), v3(h, y, h)], [v3(h, y, h), v3(-h, y, h)], [v3(-h, y, h), v3(-h, y, -h)]]
    .forEach(([a, b]) => g.add(rod(a, b, 0.026, M.roseGold, 10)));
  // Skull cap
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.34, 64, 1, true), M.satin);
  skull.position.y = 0.0; g.add(skull);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.016, 10, 80), M.roseGold);
  band.rotation.x = Math.PI / 2; band.position.y = -0.17; g.add(band);
  // Button + glowing tassel
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 32), M.roseGold);
  btn.position.y = 0.215; g.add(btn);
  const cordPts = [v3(0, 0.225, 0), v3(0.22, 0.23, 0.18), v3(0.42, 0.215, 0.4), v3(0.57, 0.2, 0.56), v3(0.6, 0.02, 0.6), v3(0.6, -0.2, 0.6)];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 64, 0.011, 8), M.glow));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.roseGold);
  knot.position.set(0.6, -0.2, 0.6); g.add(knot);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r = 0.012 + (i % 3) * 0.009;
    const top = v3(0.6 + Math.cos(a) * r, -0.22, 0.6 + Math.sin(a) * r);
    const bot = v3(0.6 + Math.cos(a) * r * 2.6, -0.5 - (i % 4) * 0.012, 0.6 + Math.sin(a) * r * 2.6);
    g.add(rod(top, bot, 0.004, M.glow, 5));
  }
  // Halo of achievement
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.006, 8, 180), M.glowCore);
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.05; halo.name = 'halo'; g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.003, 6, 180), M.glow);
  halo2.rotation.x = Math.PI / 2; halo2.position.y = 0.05; g.add(halo2);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.018 + (i % 3) * 0.008, 0), M.glowCore);
    s.position.set(Math.cos(a) * 0.93, 0.05 + Math.sin(a * 3) * 0.06, Math.sin(a) * 0.93);
    g.add(s);
  }
  const wrap = new THREE.Group();
  g.rotation.set(0.38, 0.6, -0.12);
  g.position.y = 0.05;
  wrap.add(g);
  return finish(wrap, 'cap');
}

export const OBJECT_FACTORIES = { globe: createGlobe, book: createBook, structure: createStructure, cap: createCap };
