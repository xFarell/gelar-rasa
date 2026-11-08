import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { layoutStations } from "./layout";
import { AirParticleSystem, createBoard, createBuildings, MonitoringStationObject, type StationVisual } from "./objects";

export interface SceneCallbacks {
  onHover: (code: string | null, e: { clientX: number; clientY: number } | null) => void;
  onSelect: (code: string) => void;
}
export interface LabelSpec { code: string; text: string; strong?: boolean }

const HOME_AZ = -0.62, HOME_POLAR = 0.98;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * City3DScene: diorama kota representatif. Satu render loop; berhenti saat tidak terlihat atau saat gerak dikurangi
 * (mode statis merender hanya ketika ada perubahan).
 */
export class City3DScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private stations = new Map<string, MonitoringStationObject>();
  private hitMeshes: THREE.Object3D[] = [];
  private buildings: THREE.InstancedMesh;
  private particles: AirParticleSystem;
  private links = new THREE.Group();
  private linkLines: { a: string; b: string; line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> }[] = [];
  private labels = new Map<string, HTMLDivElement>();
  private labelSpec: LabelSpec[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerEvent: PointerEvent | null = null;
  private hovered: string | null = null;
  private hoveredBuilding = -1;
  private selected: string | null = null;
  private raf = 0;
  private running = false;
  private visible = true;
  private dirty = true;
  private clock = new THREE.Clock();
  private t = 0;
  private tween: { from: THREE.Vector3; to: THREE.Vector3; r0: number; r1: number; t0: number; dur: number; p0?: THREE.Vector3; p1?: THREE.Vector3 } | null = null;
  private down: { x: number; y: number } | null = null;
  private home: { target: THREE.Vector3; radius: number };
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private W: number; private D: number;
  animate: boolean;

  constructor(private host: HTMLElement, overlay: HTMLElement, stations: { code: string; lat: number; lon: number }[],
    nn: [string, string][], private cb: SceneCallbacks, animate: boolean) {
    this.animate = animate;
    const { lots, width, depth } = layoutStations(stations);
    this.W = width + 4; this.D = depth + 4;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "city3d__canvas";
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.8, panSpeed: 0.7, screenSpacePanning: false,
      minPolarAngle: 0.5, maxPolarAngle: 1.22, minAzimuthAngle: HOME_AZ - 0.85, maxAzimuthAngle: HOME_AZ + 0.85, minDistance: 16, maxDistance: 140,
    });
    this.controls.addEventListener("change", () => { this.clampTarget(); this.dirty = true; });
    this.controls.addEventListener("start", () => { this.tween = null; });

    // Cahaya
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#cfdce8", 1.7));
    const sun = new THREE.DirectionalLight("#fffaf0", 2.1);
    sun.position.set(-22, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -this.W / 1.6; sc.right = this.W / 1.6; sc.top = this.D / 1.2; sc.bottom = -this.D / 1.2; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
    this.scene.add(sun);

    // Objek
    this.scene.add(createBoard(lots, width, depth));
    const deco = createBuildings(lots);
    this.buildings = deco.buildings;
    this.scene.add(deco.buildings, deco.crowns, deco.trunks);
    lots.forEach((l, i) => {
      const s = new MonitoringStationObject(l.code, l.x, l.z, (i * 0.137) % 1);
      this.stations.set(l.code, s);
      this.hitMeshes.push(s.hit);
      this.scene.add(s.group);
    });
    this.particles = new AirParticleSystem(this.W - 2, this.D - 2);
    this.scene.add(this.particles.points, this.particles.streaks);

    // Garis tetangga terdekat (jarak sebenarnya ada di tooltip)
    const seen = new Set<string>();
    for (const [a, b] of nn) {
      const k = [a, b].sort().join(); if (seen.has(k)) continue; seen.add(k);
      const A = this.stations.get(a), B = this.stations.get(b); if (!A || !B) continue;
      const mid = new THREE.Vector3((A.x + B.x) / 2, 2.5 + Math.hypot(A.x - B.x, A.z - B.z) * 0.18, (A.z + B.z) / 2);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(A.x, 0.55, A.z), mid, new THREE.Vector3(B.x, 0.55, B.z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)), new THREE.LineBasicMaterial({ color: "#2f8fa8", transparent: true, opacity: 0.22, depthWrite: false }));
      this.links.add(line);
      this.linkLines.push({ a, b, line });
    }
    this.scene.add(this.links);

    // Label HTML
    for (const code of this.stations.keys()) {
      const el = document.createElement("div");
      el.className = "city3d__label"; el.dataset.code = code; el.hidden = true;
      overlay.appendChild(el);
      this.labels.set(code, el);
    }

    this.home = { target: new THREE.Vector3(0, 0.5, 1), radius: 90 };
    this.resize();
    this.setCamera(this.home.target, this.home.radius);

    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    this.ro = new ResizeObserver(() => { this.resize(); this.dirty = true; this.kick(); });
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }, { threshold: 0.01 });
    this.io.observe(host);
    document.addEventListener("visibilitychange", this.onVis);
    this.kick();
  }

  // ------------------------------------------------------------- API
  setData(vis: StationVisual[]) {
    for (const v of vis) this.stations.get(v.code)?.apply(v);
    this.dirty = true; this.kick();
  }
  setSelected(code: string | null) {
    this.selected = code;
    this.updateLinks();
    this.dirty = true; this.kick();
  }
  setLabels(spec: LabelSpec[]) { this.labelSpec = spec; this.dirty = true; this.kick(); }
  setFlow(f: { x: number; z: number; speed: number } | null) { this.particles.setFlow(f); this.dirty = true; this.kick(); }
  setAnimate(a: boolean) { this.animate = a; this.dirty = true; this.kick(); }

  /** Fokus kamera pada sekumpulan stasiun (wilayah/stasiun); kosong = tampilan awal. */
  focus(codes: string[]) {
    if (!codes.length) { this.flyTo(this.home.target.clone(), this.home.radius); return; }
    const pts = codes.map((c) => this.stations.get(c)).filter(Boolean) as MonitoringStationObject[];
    if (!pts.length) return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    const spread = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    const h = pts.length === 1 ? pts[0].h : 1.5;
    this.flyTo(new THREE.Vector3(cx, Math.min(4, h * 0.5 + 0.6), cz), pts.length === 1 ? 44 : Math.max(40, spread * 3.2 + 34));
  }
  zoom(f: number) { this.flyTo(this.controls.target.clone(), THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) * f, 16, 140), 380); }
  reset() { this.flyTo(this.home.target.clone(), this.home.radius, 900, true); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onMove); el.removeEventListener("pointerleave", this.onLeave);
    el.removeEventListener("pointerdown", this.onDown); el.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.renderer.dispose();
    el.remove();
    this.labels.forEach((l) => l.remove());
  }

  // ------------------------------------------------------------- internal
  private setCamera(target: THREE.Vector3, radius: number, az = HOME_AZ, polar = HOME_POLAR) {
    this.controls.target.copy(target);
    const s = new THREE.Spherical(radius, polar, az);
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
    this.camera.lookAt(target);
    this.controls.update();
  }
  private flyTo(target: THREE.Vector3, radius: number, dur = 900, homeAngle = false) {
    if (homeAngle) {
      // kembali ke sudut awal juga
      const s = new THREE.Spherical(radius, HOME_POLAR, HOME_AZ);
      const endPos = target.clone().add(new THREE.Vector3().setFromSpherical(s));
      if (!this.animate) { this.setCamera(target, radius); this.dirty = true; this.kick(); return; }
      this.tween = { from: this.controls.target.clone(), to: target, r0: 0, r1: radius, t0: performance.now(), dur, p0: this.camera.position.clone(), p1: endPos };
      this.kick(); return;
    }
    const r0 = this.camera.position.distanceTo(this.controls.target);
    if (!this.animate) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.controls.target.copy(target);
      this.camera.position.copy(target).addScaledVector(dir, radius);
      this.controls.update(); this.dirty = true; this.kick(); return;
    }
    this.tween = { from: this.controls.target.clone(), to: target, r0, r1: radius, t0: performance.now(), dur };
    this.kick();
  }
  private stepTween(now: number) {
    const tw = this.tween; if (!tw) return;
    const p = Math.min(1, (now - tw.t0) / tw.dur), e = easeInOut(p);
    const tgt = tw.from.clone().lerp(tw.to, e);
    if (tw.p0 && tw.p1) {
      this.controls.target.copy(tgt);
      this.camera.position.copy(tw.p0.clone().lerp(tw.p1, e));
    } else {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.controls.target.copy(tgt);
      this.camera.position.copy(tgt).addScaledVector(dir, tw.r0 + (tw.r1 - tw.r0) * e);
    }
    this.camera.lookAt(this.controls.target);
    this.dirty = true;
    if (p >= 1) this.tween = null;
  }
  private clampTarget() {
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -this.W / 2, this.W / 2);
    t.z = THREE.MathUtils.clamp(t.z, -this.D / 2, this.D / 2);
    t.y = THREE.MathUtils.clamp(t.y, 0, 6);
  }
  /** Jarak kamera awal: seluruh alas diorama masuk bingkai (ruang di bawah untuk legenda). */
  private fitRadius(target: THREE.Vector3) {
    const corners: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-1.6, 0.4]) corners.push(new THREE.Vector3((sx * (this.W + 1.2)) / 2, y, (sz * (this.D + 1.2)) / 2));
    const off = new THREE.Vector3(), p = new THREE.Vector3();
    let lo = 10, hi = 420;
    for (let i = 0; i < 26; i++) {
      const r = (lo + hi) / 2;
      off.setFromSpherical(new THREE.Spherical(r, HOME_POLAR, HOME_AZ));
      this.camera.position.copy(target).add(off);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      const ok = corners.every((c) => { p.copy(c).project(this.camera); return Math.abs(p.x) <= 1.0 && p.y <= 0.9 && p.y >= -0.84; });
      if (ok) hi = r; else lo = r;
    }
    return hi;
  }
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, 0, h * 0.035, w, h);
    this.camera.updateProjectionMatrix();
    if (this.home) {
      const camPos = this.camera.position.clone();
      const r = this.fitRadius(this.home.target);
      this.camera.position.copy(camPos);
      const atHome = Math.abs(this.camera.position.distanceTo(this.controls.target) - this.home.radius) < 0.5 && this.controls.target.distanceTo(this.home.target) < 0.1;
      this.home.radius = r;
      this.controls.maxDistance = r * 1.35;
      if (atHome) this.setCamera(this.home.target, r); else this.camera.lookAt(this.controls.target);
    }
  }
  private updateLinks() {
    const focus = this.selected ?? this.hovered;
    for (const l of this.linkLines) {
      const on = focus && (l.a === focus || l.b === focus);
      l.line.material.opacity = on ? 0.95 : focus ? 0.1 : 0.22;
      l.line.material.color.set(on ? "#1d4e6f" : "#2f8fa8");
    }
  }
  private pick(e: { clientX: number; clientY: number }) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitMeshes, false)[0];
    if (hit) return { code: hit.object.userData.code as string, building: -1 };
    const b = this.raycaster.intersectObject(this.buildings, false)[0];
    return { code: null, building: b?.instanceId ?? -1 };
  }
  private onMove = (e: PointerEvent) => { this.pointerEvent = e; this.kick(); if (!this.running) this.handleHover(); };
  private onLeave = () => { this.pointerEvent = null; this.setHover(null, -1, null); };
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; };
  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) { this.down = null; return; }
    this.down = null;
    const p = this.pick(e);
    if (p.code) this.cb.onSelect(p.code);
  };
  private onVis = () => this.kick();
  private handleHover() {
    const e = this.pointerEvent; if (!e) return;
    const p = this.pick(e);
    this.setHover(p.code, p.building, e);
  }
  private setHover(code: string | null, building: number, e: PointerEvent | null) {
    if (building !== this.hoveredBuilding) {
      const base = this.buildings.userData.baseColors as THREE.Color[];
      if (this.hoveredBuilding >= 0) this.buildings.setColorAt(this.hoveredBuilding, base[this.hoveredBuilding]);
      if (building >= 0) this.buildings.setColorAt(building, base[building].clone().lerp(new THREE.Color("#d3e6f5"), 0.7));
      this.buildings.instanceColor!.needsUpdate = true;
      this.hoveredBuilding = building;
      this.dirty = true;
    }
    this.renderer.domElement.style.cursor = code ? "pointer" : "grab";
    if (code !== this.hovered) { this.hovered = code; this.updateLinks(); this.dirty = true; }
    this.cb.onHover(code, code && e ? e : null);
    this.kick();
  }
  private kick() {
    if (this.running) return;
    if (!this.visible || document.hidden) return;
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }
  private loop = (now: number) => {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.animate) this.t += dt;
    if (this.pointerEvent && this.dirtyPointer()) this.handleHover();
    this.stepTween(now);
    const damping = this.controls.update();
    let moving = !!this.tween || damping;
    for (const s of this.stations.values()) moving = s.step(dt, this.t, this.animate, s.code === this.hovered, s.code === this.selected) || moving;
    if (this.animate) this.particles.step(dt, this.t);
    if (this.dirty || moving || this.animate) { this.renderer.render(this.scene, this.camera); this.placeLabels(); this.dirty = false; }
    const keep = this.visible && !document.hidden && (this.animate || moving || !!this.tween);
    if (keep) this.raf = requestAnimationFrame(this.loop); else this.running = false;
  };
  private lastPointer = { x: -1, y: -1 };
  private dirtyPointer() {
    const e = this.pointerEvent!;
    if (e.clientX === this.lastPointer.x && e.clientY === this.lastPointer.y && !this.tween) return false;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    return true;
  }
  private placeLabels() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    const show = new Map(this.labelSpec.map((l) => [l.code, l]));
    if (this.hovered && !show.has(this.hovered)) show.set(this.hovered, { code: this.hovered, text: "" });
    for (const [code, el] of this.labels) {
      const spec = show.get(code);
      if (!spec) { if (!el.hidden) el.hidden = true; continue; }
      this.stations.get(code)!.top(v).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      el.hidden = v.z > 1;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${(y - 6).toFixed(1)}px)`;
      const txt = spec.text ? `${code} · ${spec.text}` : code;
      if (el.textContent !== txt) el.textContent = txt;
      el.dataset.strong = spec.strong || code === this.selected || code === this.hovered ? "1" : "";
    }
  }
}
