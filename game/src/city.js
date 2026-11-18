// Solmar itself: a grid of streets and blocks, built once from the seed. The city
// is a fixed 5x5 street grid (streets at -320..320, blocks between them), the sea
// along the south edge, and four landmarks the story uses: Rico's garage, the
// Plaza del Sol, the marina vault and Mara's safehouse. Everything the game
// needs to know about the ground — what is street, what is a wall — lives here.
import { CITY, PALETTE } from './config.js';

const HALF_BLOCK = CITY.block / 2;
const HALF_STREET = CITY.street / 2;
// Sidewalk strip between the road and the buildings.
const CURB = 8;

/** Is (x, z) on a road (inside a street band)? */
export function onStreet(city, x, z) {
  for (const s of city.streets) {
    if (Math.abs(x - s) <= HALF_STREET) return true;
    if (Math.abs(z - s) <= HALF_STREET) return true;
  }
  return false;
}

/** The nearest street coordinate to v (one axis). */
export function nearestStreet(city, v) {
  let best = city.streets[0];
  for (const s of city.streets) if (Math.abs(v - s) < Math.abs(v - best)) best = s;
  return best;
}

/** Clamp a point to the playable city (inside the beach, out of the sea). */
export function clampToCity(x, z, margin = 0) {
  const bound = CITY.half + 16 - margin;
  return {
    x: Math.max(-bound, Math.min(bound, x)),
    z: Math.max(-bound, Math.min(bound - 4, z)),
  };
}

/** Push a circle of radius r out of every building it overlaps; returns true on a hit. */
export function collideBuildings(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const hw = b.w / 2 + r;
    const hd = b.d / 2 + r;
    const dx = body.x - b.x;
    const dz = body.z - b.z;
    if (Math.abs(dx) >= hw || Math.abs(dz) >= hd) continue;
    hit = true;
    // Push out along the smaller penetration axis.
    if (hw - Math.abs(dx) < hd - Math.abs(dz)) body.x = b.x + (dx > 0 ? hw : -hw);
    else body.z = b.z + (dz > 0 ? hd : -hd);
  }
  return hit;
}

/** True when the circle overlaps any building. */
export function insideBuilding(city, x, z, r) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  return false;
}

/** A random point on a street, at least `clear` from (x, z). */
export function randomStreetPoint(rng, city, x, z, clear) {
  for (let tries = 0; tries < 40; tries += 1) {
    const street = rng.pick(city.streets);
    const along = rng.range(-CITY.half + 40, CITY.half - 40);
    const point = rng.chance(0.5)
      ? { x: street + rng.range(-9, 9), z: along }
      : { x: along, z: street + rng.range(-9, 9) };
    const dx = point.x - x;
    const dz = point.z - z;
    if (dx * dx + dz * dz > clear * clear) return point;
  }
  return { x: city.streets[0], z: -CITY.half + 60 };
}

export function createCity(rng) {
  const streets = [...CITY.streets];
  const buildings = [];
  const blockCentres = [-240, -80, 80, 240];

  function addBuilding(x, z, w, d, h, color, roof) {
    buildings.push({ x, z, w, d, h, color, roof });
  }

  // One block in four is a park; the rest hold one to four buildings.
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      if (bx === 0 && bz === 0) continue; // Plaza del Sol
      if (bx === -240 && bz === -240) continue; // Rico's garage stands alone
      if (bx === 240 && bz === 240) continue; // Mara's safehouse stands alone
      if (rng.chance(0.22)) continue; // park
      const kind = rng.int(1, 3);
      const inset = HALF_STREET + CURB;
      const span = CITY.block - inset * 2;
      if (kind === 1) {
        // One big building filling the block.
        addBuilding(bx, bz, span, span, rng.range(18, 55), rng.int(0, 7), rng.int(0, 3));
      } else if (kind === 2) {
        // Two side by side.
        const w = span / 2 - 6;
        addBuilding(bx - span / 4, bz, w, span, rng.range(12, 42), rng.int(0, 7), rng.int(0, 3));
        addBuilding(bx + span / 4, bz, w, span, rng.range(12, 42), rng.int(0, 7), rng.int(0, 3));
      } else {
        // Four small ones around a courtyard.
        const w = span / 2 - 8;
        for (const ox of [-1, 1]) {
          for (const oz of [-1, 1]) {
            addBuilding(bx + ox * span / 4, bz + oz * span / 4, w, w, rng.range(9, 30), rng.int(0, 7), rng.int(0, 3));
          }
        }
      }
    }
  }

  // Landmarks, placed on their own so the story can find them.
  const landmarks = {
    // Rico's garage: a low wide workshop on the north-west block.
    garage: { x: -240, z: -240, label: "Rico's Garage" },
    // Plaza del Sol: the open square at the city's heart.
    plaza: { x: 0, z: 0, label: 'Plaza del Sol' },
    // The marina: docks and the vault on the south shore.
    marina: { x: 160, z: 380, label: 'Marina' },
    vault: { x: 160, z: 352, label: 'Marina Vault' },
    // Mara's safehouse on the south-east block.
    safehouse: { x: 240, z: 240, label: 'Safehouse' },
  };
  // The vault is a squat strongbox of a building on the marina block.
  addBuilding(landmarks.vault.x, landmarks.vault.z, 46, 30, 14, 3, 1);
  // The garage is a wide low workshop.
  addBuilding(landmarks.garage.x, landmarks.garage.z, 70, 44, 10, 6, 0);
  // The safehouse is a small two-storey house.
  addBuilding(landmarks.safehouse.x, landmarks.safehouse.z, 34, 28, 12, 0, 2);

  return {
    streets,
    buildings,
    landmarks,
    // Palette indices resolved here so the renderer stays dumb.
    buildingColors: PALETTE.building,
    roofColors: PALETTE.roof,
  };
}
