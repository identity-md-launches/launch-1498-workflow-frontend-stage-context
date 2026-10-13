export type GroundPoint = { x: number; z: number };
export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number };
const bounds = { minX: -24, maxX: 24, minZ: -18, maxZ: 18 };
const gap = 0.01;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const inside = (p: GroundPoint, r: Footprint) =>
  p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;
const clamp = (p: GroundPoint): GroundPoint => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, p.x)),
  z: Math.max(bounds.minZ, Math.min(bounds.maxZ, p.z)),
});

// A small visibility graph suits this fixed miniature map. Inflate the actual
// scenery bounds by a Pepe's radius so its body, not only its center, stays clear.
export function createNavigator(solids: Footprint[], clearance = 1.4) {
  const obstacles = solids.map(r => ({
    minX: r.minX - clearance, maxX: r.maxX + clearance,
    minZ: r.minZ - clearance, maxZ: r.maxZ + clearance,
  }));
  const walkable = (p: GroundPoint) =>
    p.x >= bounds.minX && p.x <= bounds.maxX &&
    p.z >= bounds.minZ && p.z <= bounds.maxZ &&
    !obstacles.some(r => inside(p, r));
  const corners = obstacles.flatMap(r => [
    { x: r.minX - gap, z: r.minZ - gap },
    { x: r.minX - gap, z: r.maxZ + gap },
    { x: r.maxX + gap, z: r.minZ - gap },
    { x: r.maxX + gap, z: r.maxZ + gap },
  ]).filter(walkable);

  function project(point: GroundPoint): GroundPoint {
    const p = clamp(point);
    if (walkable(p)) return p;
    // Check edges as well as corners, including overlapping rock footprints.
    const candidates = [
      ...corners,
      ...obstacles.flatMap(r => [
        { x: r.minX - gap, z: p.z }, { x: r.maxX + gap, z: p.z },
        { x: p.x, z: r.minZ - gap }, { x: p.x, z: r.maxZ + gap },
      ]),
      ...[bounds.minX, bounds.maxX].flatMap(x =>
        [bounds.minZ, bounds.maxZ].map(z => ({ x, z }))),
    ].filter(walkable);
    return candidates.sort((a, b) => distance(a, p) - distance(b, p))[0] ?? p;
  }

  function clear(a: GroundPoint, b: GroundPoint) {
    if (!walkable(a) || !walkable(b)) return false;
    return !obstacles.some(r => {
      let enter = 0, exit = 1;
      for (const [start, delta, min, max] of [
        [a.x, b.x - a.x, r.minX, r.maxX],
        [a.z, b.z - a.z, r.minZ, r.maxZ],
      ]) {
        if (Math.abs(delta) < 1e-9) {
          if (start <= min || start >= max) return false;
        } else {
          const t1 = (min - start) / delta, t2 = (max - start) / delta;
          enter = Math.max(enter, Math.min(t1, t2));
          exit = Math.min(exit, Math.max(t1, t2));
          if (enter >= exit) return false;
        }
      }
      return enter < exit;
    });
  }

  function route(from: GroundPoint, destination: GroundPoint): GroundPoint[] {
    const end = project(destination);
    if (!walkable(from) || !walkable(end)) return [];
    if (clear(from, end)) return [end];
    const nodes = [from, end, ...corners];
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1);
    const visited = new Set<number>();
    costs[0] = 0;
    while (visited.size < nodes.length) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++)
        if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
      if (current < 0 || !Number.isFinite(costs[current])) return [];
      if (current === 1) {
        const path: GroundPoint[] = [];
        for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i]);
        return path;
      }
      visited.add(current);
      for (let i = 1; i < nodes.length; i++) {
        if (visited.has(i)) continue;
        const cost = costs[current] + distance(nodes[current], nodes[i]);
        if (cost < costs[i] && clear(nodes[current], nodes[i])) {
          costs[i] = cost;
          previous[i] = current;
        }
      }
    }
    return [];
  }
  return { project, route, walkable, clear };
}
