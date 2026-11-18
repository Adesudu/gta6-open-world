// The city of Palmera Bay: seeded generation of roads, blocks,
// buildings, parks and the bay, plus the collision and road helpers
// every other system uses. Nothing here draws or reads input.
import { AVENUES, ROAD_W, STREETS, WORLD } from './config.js';

export const KIND_CASH = 'cash';
export const KIND_HEALTH = 'health';
export const KIND_AMMO = 'ammo';

const CAR_COLORS = ['#e8e4d8', '#5fb4d6', '#d6a45f', '#7fb069', '#c96a6a', '#9b7fd6', '#e8e4d8', '#4d7ea8'];
const CAR_NAMES = ['Comet', 'Sandpiper', 'Marlin', 'Dune Buggy', 'Pelican', 'Sunrunner', 'Coconut', 'Harbor'];
const BUILDING_COLORS = ['#c98f5f', '#8fa3b8', '#b8a58a', '#d6b48a', '#9a8fb0'];

/** True when the point is on a road (within the road width of an avenue or street). */
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

/** Nearest road centre line to a point, and whether it is a vertical avenue. */
export function nearestRoad(x, y) {
  let best = { axis: 'v', line: AVENUES[0], dist: Math.abs(x - AVENUES[0]) };
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < best.dist) best = { axis: 'v', line: ax, dist: d };
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < best.dist) best = { axis: 'h', line: sy, dist: d };
  }
  return best;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const pickups = [];
  const parkBlocks = new Set();

  // Pick a few blocks to be parks (never the block the player starts in).
  for (let i = 0; i < 5; i += 1) {
    const bx = random.int(0, AVENUES.length - 2);
    const by = random.int(0, STREETS.length - 2);
    if (bx === 1 && by === 1) continue;
    parkBlocks.add(`${bx},${by}`);
  }

  for (let bx = 0; bx < AVENUES.length - 1; bx += 1) {
    for (let by = 0; by < STREETS.length - 1; by += 1) {
      const x0 = AVENUES[bx] + ROAD_W / 2 + 24;
      const y0 = STREETS[by] + ROAD_W / 2 + 24;
      const x1 = AVENUES[bx + 1] - ROAD_W / 2 - 24;
      const y1 = STREETS[by + 1] - ROAD_W / 2 - 24;
      if (y0 > WORLD.bayY - 120) continue; // beach, not blocks
      if (parkBlocks.has(`${bx},${by}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: random.int(6, 12) });
        continue;
      }
      // One or two buildings per block, with a yard between them.
      const split = random.chance(0.5);
      const parts = split
        ? [{ x: x0, y: y0, w: (x1 - x0) * 0.45, h: y1 - y0 }, { x: x0 + (x1 - x0) * 0.55, y: y0, w: (x1 - x0) * 0.45, h: y1 - y0 }]
        : [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
      for (const p of parts) {
        const inset = random.range(8, 30);
        buildings.push({
          x: p.x + inset, y: p.y + inset,
          w: p.w - inset * 2, h: p.h - inset * 2,
          color: random.pick(BUILDING_COLORS),
          height: random.int(1, 4),
          windows: random.int(2, 5),
        });
      }
    }
  }

  // Cash, health and ammo pickups scattered on sidewalks near roads.
  for (let i = 0; i < 14; i += 1) {
    const road = random.pick(AVENUES);
    const along = random.range(200, WORLD.bayY - 200);
    pickups.push({ kind: KIND_CASH, x: road + (random.chance(0.5) ? 70 : -70), y: along, amount: random.pick([25, 50, 50, 100]), taken: false });
  }
  for (let i = 0; i < 4; i += 1) {
    pickups.push({ kind: KIND_HEALTH, x: random.pick(AVENUES) + 70, y: random.range(300, 3000), taken: false });
    pickups.push({ kind: KIND_AMMO, x: random.pick(STREETS), y: random.pick(AVENUES) + 70, taken: false });
  }

  // Named places the missions and the HUD point at.
  const places = {
    garage: { x: 1500, y: 900, name: 'Sunset Garage' },
    docks: { x: 4500, y: 3000, name: 'Harbor Docks' },
    club: { x: 900, y: 2100, name: 'Club Neon Palm' },
    diner: { x: 2700, y: 1500, name: 'Palm Diner' },
    mall: { x: 3300, y: 900, name: 'Bayfront Mall' },
    beach: { x: 2100, y: 3180, name: 'Palmera Beach' },
    airport: { x: 3900, y: 2700, name: 'Bay Airfield' },
  };

  function collidesBuilding(x, y, r) {
    for (const b of buildings) if (circleHitsRect(x, y, r, b)) return b;
    return null;
  }

  function pushOutOfBuildings(entity, r) {
    for (const b of buildings) {
      if (!circleHitsRect(entity.x, entity.y, r, b)) continue;
      const nx = Math.max(b.x, Math.min(entity.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(entity.y, b.y + b.h));
      let dx = entity.x - nx, dy = entity.y - ny;
      const d = Math.hypot(dx, dy);
      if (d === 0) { dx = 0; dy = -1; }
      else { dx /= d; dy /= d; }
      entity.x = nx + dx * (r + 1);
      entity.y = ny + dy * (r + 1);
    }
  }

  function randomCarColor() { return random.pick(CAR_COLORS); }
  function randomCarName() { return random.pick(CAR_NAMES); }

  return { buildings, parks, pickups, places, collidesBuilding, pushOutOfBuildings, randomCarColor, randomCarName };
}
