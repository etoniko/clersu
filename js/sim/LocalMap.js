const TILE = 64;
const MAP_TILES = 44;
const MAP_SIZE = TILE * MAP_TILES;
const HALF_MAP = MAP_SIZE / 2;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(rng, items) {
  return items[(rng() * items.length) | 0];
}

function carveRect(grid, x, y, w, h, value = 0) {
  for (let gy = y; gy < y + h; gy++) {
    for (let gx = x; gx < x + w; gx++) {
      if (grid[gy]?.[gx] !== undefined) grid[gy][gx] = value;
    }
  }
}

function buildTileGrid(rng) {
  const grid = Array.from({ length: MAP_TILES }, () => Array(MAP_TILES).fill(1));
  const rooms = [];
  const roomCount = 12 + ((rng() * 6) | 0);

  for (let i = 0; i < roomCount; i++) {
    const w = 5 + ((rng() * 6) | 0);
    const h = 5 + ((rng() * 5) | 0);
    const x = 2 + ((rng() * (MAP_TILES - w - 4)) | 0);
    const y = 2 + ((rng() * (MAP_TILES - h - 4)) | 0);

    let overlap = false;
    for (const room of rooms) {
      if (
        x < room.x + room.w + 2 &&
        x + w + 2 > room.x &&
        y < room.y + room.h + 2 &&
        y + h + 2 > room.y
      ) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    const theme = choose(rng, ["office", "living", "service", "storage"]);
    rooms.push({ x, y, w, h, theme });
    carveRect(grid, x, y, w, h, 0);
  }

  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const ax = (a.x + a.w / 2) | 0;
    const ay = (a.y + a.h / 2) | 0;
    const bx = (b.x + b.w / 2) | 0;
    const by = (b.y + b.h / 2) | 0;

    if (rng() > 0.5) {
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        grid[ay][x] = 0;
        if (grid[ay + 1]?.[x] !== undefined) grid[ay + 1][x] = 0;
      }
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
        grid[y][bx] = 0;
        if (grid[y]?.[bx + 1] !== undefined) grid[y][bx + 1] = 0;
      }
    } else {
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
        grid[y][ax] = 0;
        if (grid[y]?.[ax + 1] !== undefined) grid[y][ax + 1] = 0;
      }
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        grid[by][x] = 0;
        if (grid[by + 1]?.[x] !== undefined) grid[by + 1][x] = 0;
      }
    }
  }

  for (let y = 1; y < MAP_TILES - 1; y++) {
    for (let x = 1; x < MAP_TILES - 1; x++) {
      if (grid[y][x] !== 0) continue;
      const roll = rng();
      if (roll < 0.03) grid[y][x] = 2;
      else if (roll < 0.042) grid[y][x] = 3;
      else if (roll < 0.052) grid[y][x] = 4;
    }
  }

  return { grid, rooms };
}

function detectFloorVariant(x, y, roomByCell) {
  const room = roomByCell.get(`${x}:${y}`);
  if (!room) return "hall";
  return room.theme;
}

function rectForTile(gx, gy, inset = 0) {
  return {
    x: gx * TILE - HALF_MAP + inset,
    y: gy * TILE - HALF_MAP + inset,
    w: TILE - inset * 2,
    h: TILE - inset * 2
  };
}

function gridToWorld(grid, rooms, rng) {
  const walls = [];
  const floorTiles = [];
  const decor = [];
  const roomByCell = new Map();

  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        roomByCell.set(`${x}:${y}`, room);
      }
    }
  }

  let wallId = 1;
  let decorId = 1;

  for (let gy = 0; gy < MAP_TILES; gy++) {
    for (let gx = 0; gx < MAP_TILES; gx++) {
      const cell = grid[gy][gx];
      const floorKind = detectFloorVariant(gx, gy, roomByCell);
      const wx = gx * TILE - HALF_MAP;
      const wy = gy * TILE - HALF_MAP;

      if (cell === 0 || cell >= 2) {
        floorTiles.push({
          id: gy * MAP_TILES + gx,
          x: wx,
          y: wy,
          variant: floorKind,
          cornerMask: [
            grid[gy - 1]?.[gx] === 1 ? 1 : 0,
            grid[gy]?.[gx + 1] === 1 ? 1 : 0,
            grid[gy + 1]?.[gx] === 1 ? 1 : 0,
            grid[gy]?.[gx - 1] === 1 ? 1 : 0
          ]
        });
      }

      if (cell === 1) {
        walls.push({
          id: wallId++,
          ...rectForTile(gx, gy),
          kind: "wall",
          variant: (gx + gy) % 3
        });
      } else if (cell === 2) {
        const kind = rng() > 0.45 ? "crate" : "barrel";
        const obstacle = {
          id: wallId++,
          ...rectForTile(gx, gy, 10),
          kind,
          variant: (gx * 7 + gy * 11) % 3
        };
        walls.push(obstacle);
        decor.push({ id: decorId++, ...obstacle, layer: "decor" });
      } else if (cell === 3) {
        const desk = {
          id: wallId++,
          ...rectForTile(gx, gy, 6),
          kind: "desk",
          variant: gx % 2
        };
        walls.push(desk);
        decor.push({ id: decorId++, ...desk, layer: "decor" });
      } else if (cell === 4) {
        decor.push({
          id: decorId++,
          ...rectForTile(gx, gy, 8),
          kind: "plant",
          variant: (gx + gy) % 2,
          layer: "decor"
        });
      }
    }
  }

  const spawns = [];
  for (const room of rooms) {
    spawns.push({
      x: (room.x + room.w / 2) * TILE - HALF_MAP,
      y: (room.y + room.h / 2) * TILE - HALF_MAP,
      theme: room.theme
    });
  }

  return { walls, floorTiles, decor, spawns };
}

function circleRectCollides(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export class LocalMap {
  constructor(seed = 1337) {
    const rng = mulberry32(seed);
    const built = buildTileGrid(rng);
    const world = gridToWorld(built.grid, built.rooms, rng);
    this.seed = seed;
    this.tileSize = TILE;
    this.size = MAP_SIZE;
    this.half = HALF_MAP;
    this.grid = built.grid;
    this.rooms = built.rooms;
    this.walls = world.walls;
    this.floorTiles = world.floorTiles;
    this.decor = world.decor;
    this.spawns = world.spawns;
  }

  collides(x, y, radius) {
    for (const wall of this.walls) {
      if (circleRectCollides(x, y, radius, wall)) return true;
    }
    return false;
  }

  randomSpawn(radius, occupied = []) {
    const minDist = Math.max(radius * 10, 180);
    const pads = this.floorTiles?.length ? this.floorTiles : this.spawns;
    if (!pads?.length) return this.ejectFromWall(0, 0, radius);

    for (let attempt = 0; attempt < 100; attempt++) {
      const tile = pads[(Math.random() * pads.length) | 0];
      const px = this.floorTiles?.length ? tile.x + TILE * 0.5 : tile.x;
      const py = this.floorTiles?.length ? tile.y + TILE * 0.5 : tile.y;
      if (this.collides(px, py, radius + 2)) continue;
      let crowded = false;
      for (const unit of occupied) {
        if (!unit) continue;
        if (Math.hypot(unit.x - px, unit.y - py) < minDist) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      return { x: px, y: py };
    }
    return this.ejectFromWall(0, 0, radius);
  }

  ejectFromWall(x, y, radius) {
    if (!this.collides(x, y, radius)) return { x, y };
    for (let dist = TILE * 0.5; dist <= TILE * 48; dist += TILE * 0.5) {
      const steps = 12 + ((dist / TILE) | 0) * 4;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const nx = x + Math.cos(ang) * dist;
        const ny = y + Math.sin(ang) * dist;
        if (!this.collides(nx, ny, radius + 2)) return { x: nx, y: ny };
      }
    }
    if (this.floorTiles?.length) {
      for (let i = 0; i < 200; i++) {
        const tile = this.floorTiles[(Math.random() * this.floorTiles.length) | 0];
        const nx = tile.x + TILE * 0.5;
        const ny = tile.y + TILE * 0.5;
        if (!this.collides(nx, ny, radius + 2)) return { x: nx, y: ny };
      }
    }
    return { x: 0, y: 0 };
  }

  lineOfSight(x1, y1, x2, y2) {
    const steps = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (TILE / 3)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (this.collides(x, y, 4)) return false;
    }
    return true;
  }
}

export { MAP_SIZE, HALF_MAP, TILE, clamp, circleRectCollides };
