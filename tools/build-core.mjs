// Builds the "Knowledge Core" sculpture as real 3D geometry and exports it to
// assets/models/knowledge-core.glb (PBR materials: rose-gold metal, frosted glass,
// polished plum, paper, emissive pink light paths).
//
// Node names used by the site at runtime:
//   KnowledgeCore (root) · Rings · Lattice · Panels · Book · Paths · Base · Motes
//   Materials starting with "Glow" are pulsed when section content appears.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// --- Node shims for GLTFExporter ---------------------------------------------
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

// --- deterministic randomness so rebuilds are identical -----------------------
let seed = 20261101;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + (b - a) * rand();

// --- materials ----------------------------------------------------------------
const M = {
  roseGold: new THREE.MeshPhysicalMaterial({ name: 'RoseGold', color: '#eab3a3', metalness: 1, roughness: 0.2 }),
  roseGoldSatin: new THREE.MeshPhysicalMaterial({ name: 'RoseGoldSatin', color: '#d99a8c', metalness: 1, roughness: 0.42 }),
  mauveMetal: new THREE.MeshPhysicalMaterial({ name: 'MauveMetal', color: '#b07592', metalness: 1, roughness: 0.3 }),
  plum: new THREE.MeshPhysicalMaterial({
    name: 'PlumPolished', color: '#2a0e24', metalness: 0.25, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    name: 'FrostedGlass', color: '#ffe0ec', metalness: 0, roughness: 0.36, transmission: 1, thickness: 0.06,
    ior: 1.45, attenuationColor: new THREE.Color('#ff9dc6'), attenuationDistance: 1.4, side: THREE.DoubleSide,
  }),
  paper: new THREE.MeshPhysicalMaterial({
    name: 'Paper', color: '#f7eaee', roughness: 0.62, sheen: 0.5, sheenColor: new THREE.Color('#ffc9dc'), sheenRoughness: 0.6,
    side: THREE.DoubleSide,
  }),
  ribbon: new THREE.MeshPhysicalMaterial({
    name: 'Ribbon', color: '#c76f92', roughness: 0.32, sheen: 1, sheenColor: new THREE.Color('#ffb3cf'), side: THREE.DoubleSide,
  }),
  glow: new THREE.MeshStandardMaterial({ name: 'GlowPath', color: '#ff9cc6', emissive: '#ff4f9b', emissiveIntensity: 2.4 }),
  glowSoft: new THREE.MeshStandardMaterial({ name: 'GlowDiagram', color: '#ffb0d0', emissive: '#ff6fac', emissiveIntensity: 1.6 }),
  glowCore: new THREE.MeshStandardMaterial({ name: 'GlowCore', color: '#ffe3ef', emissive: '#ffb3d3', emissiveIntensity: 4.5 }),
};

// --- geometry helpers ---------------------------------------------------------
// Merge mixed indexed / non-indexed geometries, keeping only position + normal.
function merge(geos) {
  const prepared = geos.map((g) => {
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    const count = g.getAttribute('position').count;
    out.setIndex(g.index ? Array.from(g.index.array) : [...Array(count).keys()]);
    return out;
  });
  const merged = mergeGeometries(prepared, false);
  merged.computeBoundingSphere();
  return merged;
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Cylinder from a to b (used for lattice edges, ticks, diagram strokes).
function rod(a, b, r, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function ball(p, r, seg = 12) {
  return new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75)).translate(p.x, p.y, p.z);
}
function tube(points, r, segs = 80, radial = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, r, radial, false);
}

// Wireframe-with-nodes version of a polyhedron.
function strutFrame(baseGeo, edgeR, nodeR) {
  const edges = new THREE.EdgesGeometry(baseGeo);
  const pos = edges.getAttribute('position');
  const rods = [];
  const nodes = new Map();
  for (let i = 0; i < pos.count; i += 2) {
    const a = v3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = v3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    rods.push(rod(a, b, edgeR, 8));
    for (const p of [a, b]) nodes.set(p.toArray().map((n) => n.toFixed(4)).join(','), p);
  }
  return { rods, nodes: [...nodes.values()].map((p) => ball(p, nodeR, 14)), vertices: [...nodes.values()] };
}

// --- BOOK ---------------------------------------------------------------------
const BOOK_HALF_W = 0.74;
const BOOK_DEPTH = 1.0;
const BOOK_Y = -0.18;
// Open-book cross-section: low at the spine, rising quickly, easing toward the fore-edge.
const profile = (u) => Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.18)) * (1 - 0.16 * u * u);
function bendBook(geo, lift) {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const u = Math.min(1, Math.abs(x) / BOOK_HALF_W);
    p.setY(i, p.getY(i) + lift * profile(u));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBook() {
  const book = new THREE.Group();
  book.name = 'Book';

  // Cover board (rose-gold), slightly larger than the page block.
  const cover = new THREE.BoxGeometry(BOOK_HALF_W * 2 + 0.06, 0.026, BOOK_DEPTH + 0.07, 72, 1, 6);
  bendBook(cover, 0.1);
  book.add(new THREE.Mesh(cover, M.roseGoldSatin));

  // Page blocks (left and right), stacked on the cover.
  const pages = [];
  for (const side of [-1, 1]) {
    const w = BOOK_HALF_W - 0.02;
    const g = new THREE.BoxGeometry(w, 0.075, BOOK_DEPTH, 48, 2, 4);
    g.translate(side * (w / 2 + 0.018), 0.05, 0);
    bendBook(g, 0.12);
    pages.push(g);
  }
  // Page-edge striations: thin rose-gold lines along the fore-edges.
  const edgeLines = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const y = 0.022 + k * 0.013 + 0.12 * profile(1);
      const x = side * (BOOK_HALF_W + 0.0);
      edgeLines.push(rod(v3(x, y, -BOOK_DEPTH / 2 + 0.01), v3(x, y, BOOK_DEPTH / 2 - 0.01), 0.0022, 5));
    }
  }
  book.add(new THREE.Mesh(merge(pages), M.paper));
  book.add(new THREE.Mesh(merge(edgeLines), M.roseGold));

  // Spine (half-cylinder under the gutter).
  const spine = new THREE.CylinderGeometry(0.05, 0.05, BOOK_DEPTH + 0.07, 24, 1, false, Math.PI / 2, Math.PI);
  spine.rotateX(Math.PI / 2);
  spine.translate(0, -0.012, 0);
  book.add(new THREE.Mesh(spine, M.roseGold));

  // Turning pages: curved sheets lifting from the spine (two paper, one frosted glass).
  const spineTop = 0.09;
  const sheets = [
    { a0: 0.42, curl: 0.38, mat: M.paper },
    { a0: 0.95, curl: 0.42, mat: M.paper },
    { a0: 1.85, curl: -0.36, mat: M.glass },
  ];
  for (const s of sheets) {
    const w = BOOK_HALF_W - 0.06;
    const g = new THREE.PlaneGeometry(w, BOOK_DEPTH - 0.06, 40, 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + w / 2; // 0 .. w from the spine
      const t = x / w;
      const ang = s.a0 + s.curl * t * t;
      const z = p.getY(i);
      p.setXYZ(i, Math.cos(ang) * x, spineTop + Math.sin(ang) * x, z);
    }
    g.computeVertexNormals();
    book.add(new THREE.Mesh(g, s.mat));
  }

  // Satin bookmark ribbon falling from the spine over the front edge.
  const rib = new THREE.PlaneGeometry(0.045, 0.62, 1, 40);
  const rp = rib.getAttribute('position');
  for (let i = 0; i < rp.count; i++) {
    const t = (rp.getY(i) + 0.31) / 0.62; // 0 bottom .. 1 top
    const s = 1 - t; // distance travelled from spine
    const z = Math.min(s, 0.5) * 1.0 + 0.0;
    const y = spineTop + 0.005 - Math.max(0, s - 0.5) * 1.3 - Math.sin(Math.min(s, 0.5) * Math.PI) * 0.02;
    const x = rp.getX(i) + 0.03 + Math.sin(s * 5) * 0.015;
    rp.setXYZ(i, x, y, z);
  }
  rib.computeVertexNormals();
  book.add(new THREE.Mesh(rib, M.ribbon));

  book.position.y = BOOK_Y;
  return book;
}

// --- LATTICE (interlocking icosahedron + dodecahedron around a glowing heart) ----
const LATTICE_Y = 0.66;
function buildLattice() {
  const g = new THREE.Group();
  g.name = 'Lattice';
  const ico = strutFrame(new THREE.IcosahedronGeometry(0.36, 0), 0.0085, 0.024);
  const dodecaGeo = new THREE.DodecahedronGeometry(0.33, 0);
  dodecaGeo.rotateY(Math.PI / 10);
  dodecaGeo.rotateX(0.32);
  const dod = strutFrame(dodecaGeo, 0.0055, 0.014);
  g.add(new THREE.Mesh(merge([...ico.rods, ...ico.nodes]), M.roseGold));
  g.add(new THREE.Mesh(merge([...dod.rods, ...dod.nodes]), M.mauveMetal));

  const shell = new THREE.OctahedronGeometry(0.17, 0);
  shell.rotateY(Math.PI / 4);
  g.add(new THREE.Mesh(shell, M.glass));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), M.glowCore));

  // Fine light filaments from the heart to every icosahedron vertex.
  const rays = ico.vertices.map((p) => rod(v3(0, 0, 0), p.clone().multiplyScalar(0.93), 0.0024, 5));
  g.add(new THREE.Mesh(merge(rays), M.glowSoft));

  g.position.y = LATTICE_Y;
  g.userData.vertices = ico.vertices;
  return g;
}

// --- RINGS (gyroscope armature) ----------------------------------------------
const RING_CENTER = v3(0, 0.28, 0);
function buildRings() {
  const g = new THREE.Group();
  g.name = 'Rings';
  const specs = [
    { r: 1.16, t: 0.013, rot: [1.2, 0.0, 0.35], mat: M.roseGold, ticks: true },
    { r: 1.03, t: 0.009, rot: [0.25, 0.9, -0.2], mat: M.mauveMetal },
    { r: 0.94, t: 0.0115, rot: [1.62, 0.5, 1.1], mat: M.roseGold },
  ];
  specs.forEach((s, idx) => {
    const ring = new THREE.Group();
    ring.name = `Ring${idx + 1}`;
    const parts = [new THREE.TorusGeometry(s.r, s.t, 14, 220)];
    if (s.ticks) {
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * Math.PI * 2;
        const len = k % 6 === 0 ? 0.06 : 0.028;
        const dir = v3(Math.cos(a), Math.sin(a), 0);
        parts.push(rod(dir.clone().multiplyScalar(s.r + 0.012), dir.clone().multiplyScalar(s.r + 0.012 + len), 0.0028, 5));
      }
    }
    // Beads riding on the ring.
    const beads = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + idx;
      parts.push(ball(v3(Math.cos(a) * s.r, Math.sin(a) * s.r, 0), s.t * 2.6, 16));
      const b = a + 0.5;
      beads.push(ball(v3(Math.cos(b) * s.r, Math.sin(b) * s.r, 0), s.t * 1.7, 12));
    }
    ring.add(new THREE.Mesh(merge(parts), s.mat));
    ring.add(new THREE.Mesh(merge(beads), M.glowCore));
    ring.rotation.set(...s.rot);
    g.add(ring);
  });
  g.position.copy(RING_CENTER);
  return g;
}

// --- FROSTED-GLASS DIAGRAM PANELS ----------------------------------------------
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Abstract diagrams (no text): orbit model, node graph, wave, rising steps, geometry proof.
function diagram(type, w, h, z) {
  const S = Math.min(w, h);
  const L = 0.0032;
  const parts = [];
  const P = (x, y) => v3(x * w * 0.5, y * h * 0.5, z);
  if (type === 'orbit') {
    for (const [rad, tilt] of [[0.32, 0], [0.22, 0.6]]) {
      const t = new THREE.TorusGeometry(S * rad, L, 6, 90);
      t.scale(1.35, 1, 1); t.rotateZ(tilt); t.translate(0, 0, z);
      parts.push(t);
    }
    parts.push(ball(P(0, 0), S * 0.05));
    for (const a of [0.4, 2.2, 4.1]) parts.push(ball(v3(Math.cos(a) * S * 0.32 * 1.35, Math.sin(a) * S * 0.32, z), S * 0.025));
  } else if (type === 'graph') {
    const pts = [P(-0.6, -0.4), P(-0.2, 0.35), P(0.15, -0.15), P(0.55, 0.45), P(0.6, -0.5), P(-0.55, 0.5)];
    const links = [[0, 1], [1, 2], [2, 3], [2, 4], [1, 5], [0, 2], [3, 4]];
    for (const [a, b] of links) parts.push(rod(pts[a], pts[b], L, 5));
    pts.forEach((p, i) => parts.push(ball(p, S * (i === 2 ? 0.05 : 0.03))));
  } else if (type === 'wave') {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(P(-0.8 + 1.6 * t, Math.sin(t * Math.PI * 3) * 0.35 * (0.4 + t * 0.6))); }
    parts.push(tube(pts, L, 120, 5));
    parts.push(rod(P(-0.8, -0.62), P(0.8, -0.62), L * 0.7, 5));
    parts.push(rod(P(-0.8, -0.62), P(-0.8, 0.6), L * 0.7, 5));
  } else if (type === 'steps') {
    const hs = [0.25, 0.45, 0.62, 0.9];
    hs.forEach((v, i) => {
      const x = -0.55 + i * 0.37;
      parts.push(rod(P(x, -0.62), P(x, -0.62 + v * 1.2), L * 2.6, 6));
      parts.push(ball(P(x, -0.62 + v * 1.2 + 0.08), S * 0.028));
    });
    parts.push(tube([P(-0.55, -0.1), P(-0.18, 0.12), P(0.19, 0.3), P(0.56, 0.62)], L * 0.8, 60, 5));
  } else if (type === 'proof') {
    const A = P(-0.6, -0.55), B = P(0.65, -0.55), C = P(-0.1, 0.62);
    parts.push(rod(A, B, L, 5), rod(B, C, L, 5), rod(C, A, L, 5));
    const ic = new THREE.TorusGeometry(S * 0.2, L, 6, 80); ic.translate(-0.02 * w, -0.17 * h, z); parts.push(ic);
    for (const p of [A, B, C]) parts.push(ball(p, S * 0.03));
  }
  return merge(parts);
}

function buildPanels() {
  const g = new THREE.Group();
  g.name = 'Panels';
  const specs = [
    { a: Math.PI + 0.05, rad: 0.86, y: 0.5, w: 0.62, type: 'orbit', tilt: -0.08 },
    { a: Math.PI - 0.62, rad: 0.98, y: 0.3, w: 0.46, type: 'graph', tilt: 0.12 },
    { a: Math.PI + 0.66, rad: 1.0, y: 0.72, w: 0.5, type: 'wave', tilt: -0.14 },
    { a: Math.PI - 1.22, rad: 1.08, y: 0.86, w: 0.38, type: 'steps', tilt: 0.18 },
    { a: Math.PI + 1.26, rad: 1.1, y: 0.22, w: 0.4, type: 'proof', tilt: -0.1 },
  ];
  const T = 0.014;
  specs.forEach((s, i) => {
    const panel = new THREE.Group();
    panel.name = `Panel${i + 1}`;
    const w = s.w, h = s.w * 0.7;
    const glassGeo = new THREE.ExtrudeGeometry(roundedRect(w, h, 0.035), {
      depth: T, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8,
    });
    glassGeo.translate(0, 0, -T / 2);
    panel.add(new THREE.Mesh(glassGeo, M.glass));
    // Rose-gold frame corners
    const corners = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = v3(sx * (w / 2 - 0.012), sy * (h / 2 - 0.012), T / 2 + 0.006);
      corners.push(rod(c, c.clone().add(v3(-sx * 0.07, 0, 0)), 0.0035, 6));
      corners.push(rod(c, c.clone().add(v3(0, -sy * 0.07, 0)), 0.0035, 6));
      corners.push(ball(c, 0.006, 8));
    }
    panel.add(new THREE.Mesh(merge(corners), M.roseGold));
    panel.add(new THREE.Mesh(diagram(s.type, w * 0.82, h * 0.78, T / 2 + 0.008), M.glowSoft));

    panel.position.set(Math.sin(s.a) * s.rad, s.y, Math.cos(s.a) * s.rad);
    panel.lookAt(0, s.y + 0.1, 0);
    panel.rotateY(Math.PI); // diagrams face outward
    panel.rotateZ(s.tilt);
    g.add(panel);
  });
  return g;
}

// --- KNOWLEDGE PATHWAYS ---------------------------------------------------------
function buildPaths(lattice, panels) {
  const g = new THREE.Group();
  g.name = 'Paths';
  const tubes = [];
  const nodes = [];
  const pageTop = BOOK_Y + 0.12 + 0.09;
  const latticePts = lattice.userData.vertices.map((p) => p.clone().add(v3(0, LATTICE_Y, 0)));

  // From the open pages up into the lattice, arcing outward.
  const starts = [v3(-0.45, pageTop, 0.22), v3(0.4, pageTop, -0.18), v3(-0.3, pageTop, -0.3), v3(0.5, pageTop, 0.28), v3(0.12, pageTop - 0.05, 0.4)];
  starts.forEach((s, i) => {
    const end = latticePts[(i * 3) % latticePts.length];
    const mid = s.clone().lerp(end, 0.5).add(v3(s.x * 0.6, 0.05, s.z * 0.8));
    tubes.push(tube([s, mid, end], 0.0055, 72, 6));
    nodes.push(ball(s, 0.016));
  });

  // From the lattice out to each glass panel.
  panels.updateMatrixWorld(true);
  panels.children.forEach((panel, i) => {
    const end = panel.getWorldPosition(new THREE.Vector3());
    const start = latticePts[(i * 2 + 1) % latticePts.length];
    const mid = start.clone().lerp(end, 0.5).add(v3(0, 0.18 + (i % 2) * 0.1, 0));
    tubes.push(tube([start, mid, end.clone().lerp(start, 0.06)], 0.0042, 72, 6));
    nodes.push(ball(end.clone().lerp(start, 0.06), 0.013));
  });

  // Two sweeping orbital light streams around the whole sculpture.
  for (let k = 0; k < 2; k++) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const a = t * Math.PI * 2 * 1.25 + k * Math.PI;
      const r = 0.82 + 0.14 * Math.sin(t * Math.PI * 3 + k);
      pts.push(v3(Math.cos(a) * r, -0.12 + t * 1.15 + 0.05 * Math.sin(t * 9), Math.sin(a) * r));
    }
    tubes.push(tube(pts, 0.0032, 260, 5));
  }

  g.add(new THREE.Mesh(merge(tubes), M.glow));
  g.add(new THREE.Mesh(merge(nodes), M.glowCore));
  return g;
}

// --- BASE -----------------------------------------------------------------------
function buildBase() {
  const g = new THREE.Group();
  g.name = 'Base';
  const disc = new THREE.CylinderGeometry(0.9, 0.94, 0.045, 128, 1);
  g.add(new THREE.Mesh(disc, M.plum));
  const rim = new THREE.TorusGeometry(0.925, 0.014, 16, 200); rim.rotateX(Math.PI / 2);
  const ticks = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const r0 = 0.78, r1 = k % 8 === 0 ? 0.86 : 0.82;
    ticks.push(rod(v3(Math.cos(a) * r0, 0.025, Math.sin(a) * r0), v3(Math.cos(a) * r1, 0.025, Math.sin(a) * r1), 0.0026, 4));
  }
  g.add(new THREE.Mesh(merge([rim, ...ticks]), M.roseGold));
  const inner = [];
  for (const r of [0.62, 0.7]) { const t = new THREE.TorusGeometry(r, 0.0035, 6, 160); t.rotateX(Math.PI / 2); t.translate(0, 0.024, 0); inner.push(t); }
  g.add(new THREE.Mesh(merge(inner), M.glowSoft));
  g.position.y = -0.5;
  return g;
}

// --- MOTES ----------------------------------------------------------------------
function buildMotes() {
  const parts = [];
  for (let i = 0; i < 70; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, r = rr(0.95, 1.45);
    const s = Math.sqrt(1 - u * u);
    parts.push(ball(v3(Math.cos(th) * s * r, 0.3 + u * r * 0.75, Math.sin(th) * s * r), rr(0.005, 0.013), 8));
  }
  const m = new THREE.Mesh(merge(parts), M.glowCore);
  m.name = 'Motes';
  return m;
}

// --- assemble & export -------------------------------------------------------------
const root = new THREE.Group();
root.name = 'KnowledgeCore';
const lattice = buildLattice();
const panels = buildPanels();
root.add(buildBase(), buildBook(), lattice, buildRings(), panels, buildMotes());
root.add(buildPaths(lattice, panels));
// Centre the sculpture vertically around its visual mass.
root.position.y = -0.2;
const scene = new THREE.Scene();
scene.add(root);

let tris = 0;
root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3; });

const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const outDir = fileURLToPath(new URL('../assets/models/', import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(outDir + 'knowledge-core.glb', Buffer.from(glb));
let meshes = 0; root.traverse((o) => { if (o.isMesh) meshes++; });
console.log(`knowledge-core.glb written: ${meshes} meshes, ${Math.round(tris).toLocaleString()} triangles, ${(glb.byteLength / 1024).toFixed(0)} KB`);
