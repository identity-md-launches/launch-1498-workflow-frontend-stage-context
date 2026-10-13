import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { Battle } from "./rules";

export type SceneHandle = {
  selectAll: () => void;
  home: () => void;
  zoom: (direction: number) => void;
  pan: (x: number, z: number) => void;
};
type Props = {
  battle: Battle | null;
  paused: boolean;
  active: boolean;
  touchMode: "select" | "move";
  onOrder: (command: number, arg: number) => void;
  onSelection: (text: string) => void;
};
type Unit = {
  id: number;
  rank: number;
  mesh: THREE.Group;
  ring: THREE.Mesh;
  target: THREE.Vector3[];
  selected: boolean;
  enemy: boolean;
};
const CYAN = 0x58e3d6,
  PINK = 0xf08cab;
function material(color: number, glow = false) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.88,
    metalness: 0.12,
    emissive: glow ? color : 0x000000,
    emissiveIntensity: glow ? 0.65 : 0,
  });
}
function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  glow = false,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material(color, glow),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function orb(radius: number, color: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 1),
    material(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function pepe(rank: number, enemy: boolean) {
  const g = new THREE.Group(),
    accent = enemy ? PINK : CYAN,
    green = enemy ? 0x5d8f45 : 0x7cab50;
  const body = box(0.72, 0.7, 0.46, 0x35463e, 0, 0.6, 0);
  g.add(body);
  const head = orb(0.52, green, 0, 1.25, 0);
  head.scale.set(1.12, 0.8, 0.8);
  g.add(head);
  for (const x of [-0.25, 0.25]) {
    g.add(orb(0.21, green, x, 1.55, 0.13));
    g.add(orb(0.135, 0xe8efc4, x, 1.54, 0.27));
    g.add(orb(0.068, 0x07130e, x + 0.025, 1.54, 0.385));
    g.add(box(0.22, 0.36, 0.36, 0x202e29, x, 0.2, 0.05));
  }
  g.add(box(0.65, 0.09, 0.12, 0x3e5732, 0, 1.1, 0.4));
  g.add(box(0.4, 0.06, 0.06, 0xa3c571, 0, 1.12, 0.465));
  g.add(box(0.95, 0.13, 0.69, enemy ? 0x523c52 : 0x30433f, 0, 1.61, -0.02));
  g.add(box(0.6, 0.19, 0.46, 0x33433a, 0, 1.72, -0.03));
  for (let i = 0; i < Math.min(3, rank + 1); i++)
    g.add(box(0.1, 0.1, 0.04, accent, -0.19 + i * 0.15, 0.77, 0.255, true));
  if (rank === 1) {
    g.add(box(1.5, 0.52, 1.7, 0x394a44, 0, 0.26, 0));
    for (const x of [-0.75, 0.75])
      g.add(box(0.28, 0.45, 1.9, 0x142421, x, 0.22, 0));
    g.add(box(0.17, 0.17, 1.5, 0x364841, 0, 0.86, 0.7));
  } else if (rank === 3) {
    g.add(box(0.6, 0.7, 0.6, 0x8b8b43, 0, 0.65, -0.5));
    g.add(box(0.14, 0.9, 0.14, 0xadb690, 0.64, 0.8, 0.22));
    g.add(box(0.62, 0.12, 0.18, accent, 0.64, 1.28, 0.22, true));
  } else if (rank === 4) {
    g.add(box(0.45, 0.55, 0.5, 0x395d68, 0, 0.65, -0.48));
    g.add(box(0.18, 0.65, 0.14, 0x949c87, 0.6, 0.7, 0.35));
  } else {
    g.add(box(0.14, 0.18, 0.8, 0x152622, 0.55, 0.8, 0.4));
    g.add(box(0.25, 0.17, 0.3, green, 0.51, 0.85, 0.06));
  }
  if (rank === 2) g.add(box(0.83, 0.14, 0.12, accent, 0, 1.49, 0.4, true));
  return g;
}
function building(level: number, enemy: boolean) {
  const g = new THREE.Group(),
    c = enemy ? PINK : CYAN;
  g.add(box(6, 0.4, 5, 0x202f30, 0, 0.2, 0));
  g.add(box(4.5, 2.7, 3.5, enemy ? 0x3e343f : 0x3b5050, 0, 1.65, 0));
  g.add(box(4.8, 0.3, 3.8, 0x1d3030, 0, 3.12, 0));
  g.add(box(4.9, 0.09, 3.9, c, 0, 2.98, 0, true));
  g.add(box(1.8, 1.1, 1.5, 0x536663, 0, 3.8, -0.3));
  g.add(box(1.25, 1.5, 0.1, 0x102627, 0, 1.4, 1.79));
  for (let i = -1; i <= 1; i++)
    g.add(box(0.55, 0.3, 0.08, c, i * 1.3, 2.2, 1.8, true));
  g.add(box(0.12, 3.4, 0.12, 0x617776, -1.5, 4, -1));
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.15, 0.24, 8),
    material(0x758b79),
  );
  dish.position.set(-1.5, 5, -1);
  dish.rotation.z = 0.55;
  g.add(dish);
  if (level > 0) {
    g.add(box(1.2, 3.8, 1.2, 0x526260, 3.6, 2, -0.5));
    g.add(box(1.3, 0.3, 1.3, c, 3.6, 3.65, -0.5, true));
  }
  return g;
}
export const Scene = forwardRef<SceneHandle, Props>(function Scene(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    data = useRef(props),
    api = useRef<SceneHandle>({
      selectAll() {},
      home() {},
      zoom() {},
      pan() {},
    });
  const [failed, setFailed] = useState(false);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  data.current = props;
  useImperativeHandle(
    ref,
    () => ({
      selectAll: () => api.current.selectAll(),
      home: () => api.current.home(),
      zoom: (n) => api.current.zoom(n),
      pan: (x, z) => api.current.pan(x, z),
    }),
    [],
  );
  useEffect(() => {
    const parent = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x101f22);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    parent.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Isometric battlefield. Select Pepes or use the command buttons.",
    );
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x102126, 55, 105);
    scene.add(new THREE.HemisphereLight(0xb2e8e2, 0x1b2028, 2.4));
    const light = new THREE.DirectionalLight(0xc8dfc4, 3);
    light.position.set(-12, 30, 14);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -35;
    light.shadow.camera.right = 35;
    light.shadow.camera.top = 30;
    light.shadow.camera.bottom = -30;
    light.shadow.bias = -0.001;
    scene.add(light);
    const camera = new THREE.OrthographicCamera(-32, 32, 24, -24, 0.1, 180);
    const target = new THREE.Vector3(0, 0, 0);
    let zoom = 1;
    let dirty = true;
    const updateCamera = () => {
      dirty = true;
      camera.position.copy(target).add(new THREE.Vector3(26, 35, 33));
      camera.lookAt(target);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };
    updateCamera();
    scene.add(box(54, 1.3, 42, 0x243d3b, 0, -0.72, 0));
    scene.add(box(55, 0.35, 43, 0x101d20, 0, -1.5, 0));
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(53, 41),
      material(0x263c36),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);
    // Original miniature terrain, geometry only: no remote textures or models.
    let seed = 14578;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 110; i++) {
      const x = random() * 51 - 25,
        z = random() * 39 - 19;
      const m = box(
        0.15 + random() * 1.2,
        0.03,
        0.2 + random(),
        [0x324940, 0x1d332d, 0x3a493c][i % 3],
        x,
        0.02,
        z,
      );
      m.rotation.y = random() * 3;
      scene.add(m);
    }
    scene.add(box(42, 0.04, 3.7, 0x344442, 0, 0.035, 1));
    scene.add(box(3.7, 0.04, 34, 0x344442, -3, 0.04, 0));
    for (let x = -23; x < 25; x += 2)
      scene.add(box(0.8, 0.05, 0.1, 0x777d56, x, 0.08, 1));
    for (const [x, z] of [
      [-23, -14],
      [23, 14],
      [-20, 15],
      [20, -15],
    ]) {
      for (let i = 0; i < 5; i++) {
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.4 + random() * 1.6, 0),
          material(0x304842),
        );
        rock.position.set(x + random() * 3, random() * 0.6, z + random() * 3);
        rock.scale.set(1, 0.7 + random(), 1);
        rock.castShadow = true;
        scene.add(rock);
      }
    }
    const friendly = building(1, false);
    friendly.position.set(-15, 0, 7);
    scene.add(friendly);
    const enemy = building(1, true);
    enemy.position.set(15, 0, -9);
    enemy.rotation.y = Math.PI;
    scene.add(enemy);
    const infrastructure: THREE.Group[] = [];
    for (let i = 1; i <= 4; i++) {
      const g = new THREE.Group();
      g.add(box(2.8, 1 + i * 0.3, 2.4, 0x485b55, 0, 0.7, 0));
      g.add(box(2.9, 0.12, 2.5, CYAN, 0, 1.2 + i * 0.3, 0, true));
      g.add(box(0.5, 1.8, 0.5, 0x66756b, -0.7, 2, 0));
      g.position.set(-20 + (i % 2) * 5, 0, -2 - Math.floor((i - 1) / 2) * 5);
      scene.add(g);
      infrastructure.push(g);
    }
    const crystals: THREE.Mesh[] = [];
    for (const [cx, cz] of [
      [0, 6],
      [-8, -9],
      [18, 10],
    ]) {
      scene.add(box(6, 0.08, 5, 0x1b4635, cx, 0.08, cz));
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7 + random() * 0.5, 0),
          material(i % 2 ? 0x8ce278 : 0x46b987, true),
        );
        m.scale.y = 2 + random();
        m.position.set(cx + (random() - 0.5) * 4, 1, cz + (random() - 0.5) * 3);
        m.rotation.z = (random() - 0.5) * 0.5;
        m.castShadow = true;
        scene.add(m);
        crystals.push(m);
      }
      const glow = new THREE.PointLight(0x68f5a2, 8, 10);
      glow.position.set(cx, 2, cz);
      scene.add(glow);
    }
    const point = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3, 0.18, 8),
      material(0x263b3e),
    );
    point.position.set(5, 0.13, -2);
    scene.add(point);
    const pointRing = new THREE.Mesh(
      new THREE.RingGeometry(2.7, 2.8, 32),
      material(CYAN, true),
    );
    pointRing.rotation.x = -Math.PI / 2;
    pointRing.position.set(5, 0.25, -2);
    scene.add(pointRing);
    scene.add(box(0.14, 4, 0.14, 0x9bada0, 5, 2, -2));
    scene.add(box(1.5, 0.75, 0.08, 0xa8c8ae, 5.7, 3.55, -2));
    for (const [x, z, c] of [
      [-20, 10, CYAN],
      [-10, 10, CYAN],
      [11, -12, PINK],
      [20, -7, PINK],
    ]) {
      scene.add(box(0.18, 5, 0.18, 0x5f7165, x, 2.5, z));
      scene.add(box(0.6, 0.25, 0.4, c, x, 5, z, true));
      const l = new THREE.PointLight(c, 10, 12);
      l.position.set(x, 4, z);
      scene.add(l);
    }
    for (let i = 0; i < 8; i++) {
      const x = -7 + i * 2;
      scene.add(box(1.3, 0.65, 0.9, 0x596354, x, 0.32, -14));
    }
    const units: Unit[] = [];
    let lastArmy = "";
    let nextID = 0;
    function addUnit(rank: number, enemyUnit: boolean, index: number) {
      const mesh = pepe(rank, enemyUnit);
      mesh.scale.setScalar(rank === 1 ? 1.3 : 1.6);
      mesh.position.set(
        enemyUnit ? 10 + (index % 3) * 2 : -11 + (index % 4) * 2,
        0,
        enemyUnit
          ? -5 - Math.floor(index / 3) * 2
          : 9 + Math.floor(index / 4) * 2,
      );
      mesh.rotation.y = enemyUnit ? -1 : 1;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.83, 0.9, 32),
        new THREE.MeshBasicMaterial({
          color: enemyUnit ? PINK : CYAN,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.07;
      mesh.add(ring);
      ring.visible = false;
      scene.add(mesh);
      units.push({
        id: nextID++,
        rank,
        mesh,
        ring,
        target: [],
        selected: false,
        enemy: enemyUnit,
      });
    }
    for (let i = 0; i < 7; i++) addUnit(i === 5 ? 1 : 0, true, i);
    const select = (selected: Unit[]) => {
      dirty = true;
      for (const u of units) {
        u.selected = selected.includes(u);
        u.ring.visible = u.selected;
      }
      data.current.onSelection(
        selected.length
          ? `${selected.length} Pepe${selected.length === 1 ? "" : "s"} selected`
          : "No Pepes selected",
      );
    };
    const pan = (x: number, z: number) => {
      target.x = THREE.MathUtils.clamp(target.x + x, -20, 20);
      target.z = THREE.MathUtils.clamp(target.z + z, -16, 16);
      updateCamera();
    };
    api.current = {
      selectAll: () => select(units.filter((u) => !u.enemy)),
      home: () => {
        target.set(0, 0, 0);
        zoom = 1;
        updateCamera();
      },
      zoom: (n) => {
        zoom = THREE.MathUtils.clamp(zoom + n * 0.15, 0.75, 2.6);
        updateCamera();
      },
      pan,
    };
    const resize = () => {
      const w = parent.clientWidth,
        h = parent.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.left = -25 * aspect;
      camera.right = 25 * aspect;
      camera.top = 25;
      camera.bottom = -25;
      updateCamera();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    function locate(e: PointerEvent | MouseEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      ray.ray.intersectPlane(plane, hit);
      return hit.clone();
    }
    const project = (u: Unit) => {
      const v = u.mesh.position
        .clone()
        .add(new THREE.Vector3(0, 1, 0))
        .project(camera);
      return {
        x: ((v.x + 1) * parent.clientWidth) / 2,
        y: ((1 - v.y) * parent.clientHeight) / 2,
      };
    };
    let down: { x: number; y: number; button: number } | null = null;
    let mouse: { x: number; y: number } | null = null;
    const commandMove = (point: THREE.Vector3, queue: boolean) => {
      const selected = units.filter((u) => u.selected);
      selected.forEach((u, i) => {
        const p = point
          .clone()
          .add(new THREE.Vector3((i % 3) * 1.8, 0, Math.floor(i / 3) * 1.8));
        p.x = THREE.MathUtils.clamp(p.x, -24, 24);
        p.z = THREE.MathUtils.clamp(p.z, -18, 18);
        if (!queue) u.target = [];
        if (u.target.length < 8) u.target.push(p);
      });
    };
    const pDown = (e: PointerEvent) => {
      if (!data.current.active || data.current.paused) return;
      renderer.domElement.focus();
      const r = parent.getBoundingClientRect();
      down = { x: e.clientX - r.left, y: e.clientY - r.top, button: e.button };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const pMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      mouse = e.pointerType === "mouse" ? { x, y } : null;
      if (
        down &&
        down.button === 0 &&
        data.current.touchMode === "select" &&
        Math.hypot(x - down.x, y - down.y) > 6
      )
        setDrag({
          x: Math.min(x, down.x),
          y: Math.min(y, down.y),
          w: Math.abs(x - down.x),
          h: Math.abs(y - down.y),
        });
    };
    const pUp = (e: PointerEvent) => {
      if (!down) return;
      const r = parent.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      const start = down;
      down = null;
      setDrag(null);
      if (data.current.paused) return;
      if (start.button === 2 || data.current.touchMode === "move") {
        const p = locate(e);
        commandMove(p, e.shiftKey);
        if (p.distanceTo(new THREE.Vector3(15, 0, -9)) < 5)
          data.current.onOrder(4, 0);
        else if (p.distanceTo(new THREE.Vector3(0, 0, 6)) < 4)
          data.current.onOrder(1, 0);
        else if (p.distanceTo(new THREE.Vector3(5, 0, -2)) < 3)
          data.current.onOrder(5, 0);
        return;
      }
      const boxDrag = Math.hypot(x - start.x, y - start.y) > 8;
      const found = units.filter((u) => {
        if (u.enemy) return false;
        const p = project(u);
        return boxDrag
          ? p.x >= Math.min(x, start.x) &&
              p.x <= Math.max(x, start.x) &&
              p.y >= Math.min(y, start.y) &&
              p.y <= Math.max(y, start.y)
          : Math.hypot(p.x - x, p.y - y) < 27;
      });
      select(
        e.shiftKey
          ? [...units.filter((u) => u.selected), ...found]
          : boxDrag
            ? found
            : found.slice(0, 1),
      );
    };
    const dbl = (e: MouseEvent) => {
      const r = parent.getBoundingClientRect();
      const u = units.find(
        (u) =>
          !u.enemy &&
          Math.hypot(
            project(u).x - e.clientX + r.left,
            project(u).y - e.clientY + r.top,
          ) < 30,
      );
      if (u) select(units.filter((v) => !v.enemy && v.rank === u.rank));
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      api.current.zoom(e.deltaY > 0 ? -1 : 1);
    };
    const groups = new Map<string, number[]>();
    const key = (e: KeyboardEvent) => {
      if (e.target !== parent && e.target !== renderer.domElement) return;
      const k = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "q",
          "+",
          "-",
          "1",
          "2",
          "3",
          "4",
          "5",
        ].includes(k)
      )
        e.preventDefault();
      if (k === "w" || k === "arrowup") pan(-1.5, -1.5);
      if (k === "s" || k === "arrowdown") pan(1.5, 1.5);
      if (k === "a" || k === "arrowleft") pan(-1.5, 1.5);
      if (k === "d" || k === "arrowright") pan(1.5, -1.5);
      if (k === "q") api.current.selectAll();
      if (k === "+") api.current.zoom(1);
      if (k === "-") api.current.zoom(-1);
      if (/^[1-5]$/.test(k)) {
        if (e.ctrlKey || e.metaKey)
          groups.set(
            k,
            units.filter((u) => u.selected).map((u) => u.id),
          );
        else select(units.filter((u) => groups.get(k)?.includes(u.id)));
      }
    };
    const context = (e: Event) => e.preventDefault();
    const leave = () => {
      mouse = null;
    };
    parent.addEventListener("keydown", key);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.addEventListener("pointerdown", pDown);
    renderer.domElement.addEventListener("pointermove", pMove);
    renderer.domElement.addEventListener("pointerup", pUp);
    renderer.domElement.addEventListener("dblclick", dbl);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", context);
    renderer.domElement.addEventListener("pointerleave", leave);
    let frame = 0,
      last = 0,
      lastTurn = -1,
      lastStatus = -1;
    let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      motion = () => {
        reduced = media.matches;
      };
    media.addEventListener("change", motion);
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (time - last < 32) return;
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      const b = data.current.battle;
      if (b && (b.turn !== lastTurn || b.status !== lastStatus)) {
        dirty = true;
        lastTurn = b.turn;
        lastStatus = b.status;
      }
      const counts = b ? [b.recruits, b.tanks, b.commandos] : [3, 1, 1];
      const signature = counts.join(",") + String(b?.id ?? "preview");
      if (signature !== lastArmy) {
        for (let i = units.length - 1; i >= 0; i--)
          if (!units[i].enemy) {
            scene.remove(units[i].mesh);
            dispose(units[i].mesh);
            units.splice(i, 1);
          }
        let index = 0;
        counts.forEach((n, rank) => {
          for (let i = 0; i < n; i++) addUnit(rank, false, index++);
        });
        addUnit(3, false, index++);
        addUnit(4, false, index);
        lastArmy = signature;
        select([]);
        dirty = true;
      }
      infrastructure.forEach((g, i) => (g.visible = b ? b.tech > i : i < 2));
      enemy.scale.y = b?.enemyHP === 0 ? 0.18 : 1;
      if (!data.current.paused && !document.hidden) {
        for (const u of units) {
          if (u.target[0]) {
            const p = u.target[0],
              delta = p.clone().sub(u.mesh.position);
            if (delta.length() < 0.15) u.target.shift();
            else {
              u.mesh.rotation.y = Math.atan2(delta.x, delta.z);
              u.mesh.position.add(
                delta.normalize().multiplyScalar(dt * (u.rank === 1 ? 3 : 4)),
              );
            }
          } else if (u.rank === 3 && !reduced) {
            const t = time * 0.00035;
            u.mesh.position.x = -8 + Math.sin(t) * 7;
            u.mesh.position.z = 7 + Math.cos(t) * 2;
            u.mesh.rotation.y = Math.cos(t) > 0 ? 1.5 : -1.5;
          }
          u.mesh.position.y =
            reduced || u.rank === 1 ? 0 : Math.sin(time * 0.003 + u.id) * 0.04;
        }
        if (!reduced)
          crystals.forEach((m, i) => {
            (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
              0.55 + Math.sin(time * 0.0015 + i) * 0.17;
          });
        if (data.current.active && mouse && !down) {
          const speed = dt * 7;
          if (mouse.x < 12) pan(-speed, speed);
          if (mouse.x > parent.clientWidth - 12) pan(speed, -speed);
          if (mouse.y < 12) pan(-speed, -speed);
          if (mouse.y > parent.clientHeight - 12) pan(speed, speed);
        }
      }
      if (
        dirty ||
        (!data.current.paused &&
          data.current.active &&
          !document.hidden &&
          (!reduced || units.some((unit) => unit.target.length > 0)))
      ) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    frame = requestAnimationFrame(loop);
    function dispose(group: THREE.Object3D) {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", motion);
      parent.removeEventListener("keydown", key);
      renderer.domElement.remove();
      dispose(scene);
      renderer.dispose();
    };
  }, []);
  return (
    <div className="scene" ref={host} tabIndex={-1} data-testid="battlefield">
      {failed && (
        <div className="scene-fallback">
          <img
            src="./cover.svg"
            alt="Pepe squads advance through crystal fields"
          />
          <p>
            WebGL is unavailable. All strategic orders still work using the
            controls below.
          </p>
        </div>
      )}
      {drag && (
        <div
          className="selection-box"
          style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
        />
      )}
    </div>
  );
});
