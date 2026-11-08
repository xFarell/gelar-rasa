import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { seeded, type Lot } from "./layout";

// ---------------------------------------------------------------------
// BuildingObject: bangunan dan pohon dekoratif (InstancedMesh, satu draw call per jenis)
// ---------------------------------------------------------------------
const BUILDING_TINTS = ["#ffffff", "#f4f7f1", "#eef3ea", "#e2ece4", "#dfeaf0"].map((c) => new THREE.Color(c));
const TREE_TINTS = ["#7fae8a", "#5f9a70", "#497b5b", "#8fbf98"].map((c) => new THREE.Color(c));

export function createBuildings(lots: Lot[]) {
  const spots: { x: number; z: number; w: number; d: number; h: number; tint: THREE.Color }[] = [];
  const trees: { x: number; z: number; s: number; tint: THREE.Color }[] = [];
  const offs = [-2.25, 0, 2.25];
  for (const lot of lots) {
    const rnd = seeded(lot.code);
    for (const ox of offs) for (const oz of offs) {
      if (ox === 0 && oz === 0) continue; // tapak stasiun
      const r = rnd();
      const x = lot.x + ox + (rnd() - 0.5) * 0.3, z = lot.z + oz + (rnd() - 0.5) * 0.3;
      if (r < 0.58 && !(ox === 0 || oz === 0)) {
        spots.push({ x, z, w: 1.15 + rnd() * 0.55, d: 1.15 + rnd() * 0.55, h: 0.9 + rnd() * 2.6, tint: BUILDING_TINTS[Math.floor(rnd() * BUILDING_TINTS.length)] });
      } else if (r < 0.8 && (ox === 0 || oz === 0)) {
        spots.push({ x, z, w: 1.4, d: 0.9, h: 0.6 + rnd() * 0.7, tint: BUILDING_TINTS[Math.floor(rnd() * BUILDING_TINTS.length)] });
      } else {
        const n = 1 + Math.floor(rnd() * 3);
        for (let t = 0; t < n; t++) trees.push({ x: x + (rnd() - 0.5) * 1.2, z: z + (rnd() - 0.5) * 1.2, s: 0.55 + rnd() * 0.45, tint: TREE_TINTS[Math.floor(rnd() * TREE_TINTS.length)] });
      }
    }
  }
  const bGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  const buildings = new THREE.InstancedMesh(bGeo, bMat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, 0.3, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, s.h, s.d));
    buildings.setMatrixAt(i, m);
    buildings.setColorAt(i, s.tint);
  });
  buildings.castShadow = true; buildings.receiveShadow = true;
  buildings.userData.baseColors = spots.map((s) => s.tint.clone());

  const crownGeo = new THREE.IcosahedronGeometry(0.55, 0);
  crownGeo.translate(0, 0.95, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), trees.length);
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 6);
  trunkGeo.translate(0, 0.25, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#8a7a62", roughness: 1 }), trees.length);
  trees.forEach((t, i) => {
    m.compose(new THREE.Vector3(t.x, 0.3, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(t.s, t.s, t.s));
    crowns.setMatrixAt(i, m); trunks.setMatrixAt(i, m);
    crowns.setColorAt(i, t.tint);
  });
  crowns.castShadow = true; trunks.castShadow = true;
  return { buildings, crowns, trunks };
}

// ---------------------------------------------------------------------
// Tapak diorama: alas, blok kota, jalan
// ---------------------------------------------------------------------
export function createBoard(lots: Lot[], width: number, depth: number) {
  const g = new THREE.Group();
  const W = width + 4, D = depth + 4;
  const base = new THREE.Mesh(new RoundedBoxGeometry(W + 1.2, 1.4, D + 1.2, 4, 0.6), new THREE.MeshStandardMaterial({ color: "#497b5b", roughness: 0.9 }));
  base.position.y = -0.85;
  base.receiveShadow = true;
  const top = new THREE.Mesh(new RoundedBoxGeometry(W, 0.5, D, 4, 0.22), new THREE.MeshStandardMaterial({ color: "#f3f6ef", roughness: 0.95 }));
  top.position.y = -0.1;
  top.receiveShadow = true;
  g.add(base, top);
  const blockGeo = new RoundedBoxGeometry(6.2, 0.3, 6.2, 2, 0.12);
  const blockMat = new THREE.MeshStandardMaterial({ color: "#d6e9d8", roughness: 0.95 });
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, lots.length);
  const m = new THREE.Matrix4();
  lots.forEach((l, i) => { m.makeTranslation(l.x, 0.15, l.z); blocks.setMatrixAt(i, m); });
  blocks.receiveShadow = true;
  g.add(blocks);
  return g;
}

// ---------------------------------------------------------------------
// MonitoringStationObject: tapak + kolom data + cincin baku + denyut
// ---------------------------------------------------------------------
export interface StationVisual {
  code: string; value: number; height: number; color: string; dim: boolean; noData: boolean; limitHeight: number | null;
}

const PAD_GEO = new THREE.CylinderGeometry(1.0, 1.1, 0.18, 32);
const COL_GEO = (() => { const g = new THREE.CylinderGeometry(0.42, 0.42, 1, 28); g.translate(0, 0.5, 0); return g; })();
const CAP_GEO = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 28);
const LIMIT_GEO = new THREE.TorusGeometry(0.58, 0.03, 8, 40);
const SLEEVE_GEO = (() => { const g = new THREE.CylinderGeometry(0.58, 0.58, 1, 28, 1, true); g.translate(0, 0.5, 0); return g; })();
const PULSE_GEO = new THREE.RingGeometry(1.15, 1.32, 48);
const HALO_GEO = new THREE.RingGeometry(1.42, 1.6, 48);
const HIT_GEO = (() => { const g = new THREE.CylinderGeometry(1.25, 1.25, 1, 12); g.translate(0, 0.5, 0); return g; })();

export class MonitoringStationObject {
  group = new THREE.Group();
  lift = new THREE.Group();
  column: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  cap: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  limit: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  sleeve: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  pulse: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  hit: THREE.Mesh;
  h = 0.2; targetH = 0.2; liftY = 0; targetLift = 0; phase: number;
  vis: StationVisual | null = null;

  constructor(public code: string, public x: number, public z: number, phase: number) {
    this.phase = phase;
    this.group.position.set(x, 0.3, z);
    const pad = new THREE.Mesh(PAD_GEO, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }));
    pad.position.y = 0.09; pad.receiveShadow = true; pad.castShadow = true;
    this.column = new THREE.Mesh(COL_GEO, new THREE.MeshStandardMaterial({ color: "#c9d0c8", roughness: 0.42, metalness: 0.05, transparent: true }));
    this.column.position.y = 0.18; this.column.castShadow = true;
    this.cap = new THREE.Mesh(CAP_GEO, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0 }));
    this.cap.castShadow = true;
    // Baku 24 jam: selubung kaca setinggi baku + cincin di puncaknya (kolom yang menembus selubung = di atas baku)
    this.limit = new THREE.Mesh(LIMIT_GEO, new THREE.MeshBasicMaterial({ color: "#5b6a60", transparent: true, opacity: 0.75 }));
    this.limit.rotation.x = Math.PI / 2;
    this.sleeve = new THREE.Mesh(SLEEVE_GEO, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.BackSide }));
    this.sleeve.position.y = 0.18;
    this.pulse = new THREE.Mesh(PULSE_GEO, new THREE.MeshBasicMaterial({ color: "#497b5b", transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    this.pulse.rotation.x = -Math.PI / 2; this.pulse.position.y = 0.02;
    this.halo = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: "#285440", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = 0.03;
    this.hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    this.hit.userData.code = code;
    this.lift.add(pad, this.column, this.cap, this.limit, this.sleeve);
    this.group.add(this.lift, this.pulse, this.halo, this.hit);
  }

  apply(v: StationVisual) {
    this.vis = v;
    this.targetH = v.noData ? 0.25 : Math.max(0.3, v.height);
    const mat = this.column.material;
    mat.color.set(v.noData ? "#c9d0c8" : v.color);
    mat.opacity = v.dim ? 0.28 : 1;
    mat.depthWrite = !v.dim;
    this.cap.material.opacity = v.dim ? 0.4 : 1;
    this.cap.material.transparent = v.dim;
    this.pulse.material.color.set(v.noData ? "#c9d0c8" : v.color);
    this.pulse.visible = !v.dim && !v.noData;
    this.limit.visible = this.sleeve.visible = v.limitHeight !== null && !v.noData && !v.dim;
    if (v.limitHeight !== null) { this.limit.position.y = 0.18 + v.limitHeight; this.sleeve.scale.y = v.limitHeight; }
  }

  /** dt dalam detik; mengembalikan true bila masih bergerak. */
  step(dt: number, t: number, animate: boolean, hovered: boolean, selected: boolean) {
    this.targetLift = hovered || selected ? 0.45 : 0;
    const k = animate ? 1 - Math.exp(-dt * 9) : 1;
    this.h += (this.targetH - this.h) * k;
    this.liftY += (this.targetLift - this.liftY) * k;
    this.column.scale.y = this.h;
    this.cap.position.y = 0.18 + this.h + 0.05;
    this.lift.position.y = this.liftY;
    this.hit.scale.y = this.h + 1.6;
    this.cap.material.emissiveIntensity = hovered ? 0.35 : 0;
    this.halo.material.opacity = selected ? 0.85 : hovered ? 0.35 : 0;
    if (animate && this.pulse.visible) {
      const p = ((t * 0.45 + this.phase) % 1);
      this.pulse.scale.setScalar(1 + p * 0.9);
      this.pulse.material.opacity = 0.5 * (1 - p);
    } else { this.pulse.scale.setScalar(1); this.pulse.material.opacity = this.pulse.visible ? 0.35 : 0; }
    return Math.abs(this.targetH - this.h) > 0.002 || Math.abs(this.targetLift - this.liftY) > 0.002;
  }

  /** Titik atas kolom (untuk label dan fokus kamera). */
  top(out: THREE.Vector3) { return out.set(this.x, 0.3 + this.liftY + 0.18 + this.h + 0.2, this.z); }
}

// ---------------------------------------------------------------------
// AirParticleSystem: partikel dekoratif. Arah gerak = arah angin dominan bila tersedia; bukan simulasi dispersi.
// ---------------------------------------------------------------------
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.45, "rgba(255,255,255,0.7)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class AirParticleSystem {
  points: THREE.Points;
  streaks: THREE.InstancedMesh;
  private pos: Float32Array;
  private seed: Float32Array;
  private streakPos: Float32Array;
  flow = { x: 0, z: 0, speed: 0 };
  constructor(private W: number, private D: number, n = 520, nStreak = 36) {
    this.pos = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const tints = ["#368c85", "#7fae8a", "#5e93ab", "#497b5b"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * W;
      this.pos[i * 3 + 1] = 0.8 + Math.random() * 9;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * D;
      this.seed[i] = Math.random() * Math.PI * 2;
      const c = tints[i % tints.length]; col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }));

    const sGeo = new THREE.BoxGeometry(1.6, 0.035, 0.035);
    this.streaks = new THREE.InstancedMesh(sGeo, new THREE.MeshBasicMaterial({ color: "#368c85", transparent: true, opacity: 0.32, depthWrite: false }), nStreak);
    this.streakPos = new Float32Array(nStreak * 3);
    for (let i = 0; i < nStreak; i++) {
      this.streakPos[i * 3] = (Math.random() - 0.5) * W;
      this.streakPos[i * 3 + 1] = 1.2 + Math.random() * 5.5;
      this.streakPos[i * 3 + 2] = (Math.random() - 0.5) * D;
    }
    this.streaks.visible = false;
  }

  setFlow(f: { x: number; z: number; speed: number } | null) {
    this.flow = f ?? { x: 0, z: 0, speed: 0 };
    this.streaks.visible = !!f && f.speed > 0;
    this.layoutStreaks(0);
  }

  private layoutStreaks(fade: number) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-this.flow.z, this.flow.x));
    const n = this.streaks.count;
    for (let i = 0; i < n; i++) {
      const x = this.streakPos[i * 3], z = this.streakPos[i * 3 + 2];
      const edge = Math.min(1, (this.W / 2 - Math.abs(x)) / 3, (this.D / 2 - Math.abs(z)) / 3);
      const s = Math.max(0.05, edge) * (fade || 1);
      m.compose(new THREE.Vector3(x, this.streakPos[i * 3 + 1], z), q, new THREE.Vector3(s, 1, 1));
      this.streaks.setMatrixAt(i, m);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
  }

  step(dt: number, t: number) {
    const { W, D } = this, p = this.pos, n = this.seed.length;
    const v = 0.6 + this.flow.speed * 1.1;
    const fx = this.flow.x * v, fz = this.flow.z * v;
    for (let i = 0; i < n; i++) {
      const s = this.seed[i];
      p[i * 3] += (fx + Math.sin(t * 0.4 + s) * 0.12) * dt;
      p[i * 3 + 1] += (Math.sin(t * 0.6 + s * 2) * 0.08 + (this.flow.speed ? 0 : 0.12)) * dt;
      p[i * 3 + 2] += (fz + Math.cos(t * 0.35 + s) * 0.12) * dt;
      if (p[i * 3] > W / 2) p[i * 3] -= W; else if (p[i * 3] < -W / 2) p[i * 3] += W;
      if (p[i * 3 + 2] > D / 2) p[i * 3 + 2] -= D; else if (p[i * 3 + 2] < -D / 2) p[i * 3 + 2] += D;
      if (p[i * 3 + 1] > 10) p[i * 3 + 1] = 0.8;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (this.streaks.visible) {
      const sp = this.streakPos, ns = this.streaks.count;
      for (let i = 0; i < ns; i++) {
        sp[i * 3] += fx * 2.2 * dt; sp[i * 3 + 2] += fz * 2.2 * dt;
        if (sp[i * 3] > W / 2) sp[i * 3] -= W; else if (sp[i * 3] < -W / 2) sp[i * 3] += W;
        if (sp[i * 3 + 2] > D / 2) sp[i * 3 + 2] -= D; else if (sp[i * 3 + 2] < -D / 2) sp[i * 3 + 2] += D;
      }
      this.layoutStreaks(1);
    }
  }
}
