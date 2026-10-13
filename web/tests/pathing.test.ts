import assert from "node:assert/strict";
import test from "node:test";
import { createNavigator, type GroundPoint, type Footprint } from "../src/pathing";

const headquarters: Footprint = { minX: -18, maxX: -10.75, minZ: 4.5, maxZ: 9.5 };
// Independent sampling checks the body clearance along every segment, not only
// the end points or the planner's own segment-intersection predicate.
function checkPath(start: GroundPoint, path: GroundPoint[], solids: Footprint[]) {
  assert.ok(path.length, "a reachable destination must produce a route");
  for (const end of path) {
    for (let step = 0; step <= 100; step++) {
      const x = start.x + (end.x - start.x) * step / 100;
      const z = start.z + (end.z - start.z) * step / 100;
      assert.ok(x >= -24 && x <= 24 && z >= -18 && z <= 18);
      for (const r of solids) {
        assert.ok(!(x > r.minX - 1.4 && x < r.maxX + 1.4 && z > r.minZ - 1.4 && z < r.maxZ + 1.4),
          `Pepe body intersects scenery at ${x}, ${z}`);
      }
    }
    start = end;
  }
}

test("Headquarters clicks stop at the perimeter; crossing orders route around the entire base", () => {
  const nav = createNavigator([headquarters]), start = { x: -7, z: 9 };
  const center = nav.route(start, { x: -15, z: 7 });
  checkPath(start, center, [headquarters]);
  assert.ok(Math.hypot(center.at(-1)!.x + 15, center.at(-1)!.z - 7) > 3);
  const crossing = nav.route(start, { x: -22, z: 7 });
  assert.ok(crossing.length > 1, "crossing the base must require a detour");
  checkPath(start, crossing, [headquarters]);
  assert.deepEqual(crossing.at(-1), { x: -22, z: 7 });
});

test("Overlapping rock footprints and new construction preserve safe, ordered waypoints", () => {
  const solids = [headquarters,
    { minX: -3, maxX: 0, minZ: -3, maxZ: 2 },
    { minX: -1, maxX: 3, minZ: -1, maxZ: 4 },
    { minX: 9, maxX: 13, minZ: -9, maxZ: -5 }];
  const nav = createNavigator(solids);
  let position = { x: -8, z: -5 };
  for (const destination of [{ x: 5, z: 5 }, { x: 15, z: -7 }, { x: -22, z: 7 }]) {
    const route = nav.route(position, destination);
    checkPath(position, route, solids);
    assert.deepEqual(route.at(-1), destination);
    position = destination;
  }
  const coveredByConstruction = { x: 11, z: -7 };
  const projected = nav.project(coveredByConstruction);
  assert.ok(nav.walkable(projected));
  checkPath(projected, nav.route(projected, { x: 20, z: 0 }), solids);
  assert.ok(nav.walkable(nav.project({ x: 100, z: -100 })));
});

test("An unreachable order is rejected instead of taking a segment through a solid wall", () => {
  const nav = createNavigator([{ minX: -1, maxX: 1, minZ: -21, maxZ: 21 }]);
  assert.deepEqual(nav.route({ x: -5, z: 0 }, { x: 5, z: 0 }), []);
});
