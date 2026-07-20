/**
 * Open living world: snow, ice, desert, forest, caves.
 * Server sends RLE cell grid to clients (source of truth).
 */

const TILE = 64;
const MAP_TILES = 180;
const MAP_SIZE = TILE * MAP_TILES;
const HALF_MAP = MAP_SIZE / 2;

const CELL_FLOOR = 0;
const CELL_WALL = 1;

/** Floor biome → packed id (0..31). Walls use 0x80 | styleId. */
const BIOME_ID = {
  forest: 0,
  desert: 1,
  snow: 2,
  ice: 3,
  cave: 4,
  lava: 5,
  outdoor: 0, // alias grass/forest fringe
  grass: 0
};
const ID_BIOME = ["forest", "desert", "snow", "ice", "cave", "lava"];

const STYLE_ID = {
  steel: 0,
  dark: 1,
  brick: 2,
  concrete: 3,
  amber: 4,
  slate: 5,
  red: 6,
  desert: 7,
  snow: 8,
  ice: 9,
  forest: 10,
  lava: 11,
  gold: 12,
  cave: 1
};
const ID_STYLE = [
  "steel",
  "dark",
  "brick",
  "concrete",
  "amber",
  "slate",
  "red",
  "desert",
  "snow",
  "ice",
  "forest",
  "lava",
  "gold"
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  return (
    noise(x, y) * 0.55 +
    noise(x * 2.1, y * 2.1) * 0.28 +
    noise(x * 4.3, y * 4.3) * 0.17
  );
}

function fillWall(grid, meta, x0, y0, x1, y1, wallStyle) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) continue;
      grid[y][x] = CELL_WALL;
      meta[y][x] = { theme: "cave", wallStyle, block: true };
    }
  }
}

function setFloor(grid, meta, x, y, theme, wallStyle) {
  if (x < 1 || y < 1 || x >= MAP_TILES - 1 || y >= MAP_TILES - 1) return;
  grid[y][x] = CELL_FLOOR;
  meta[y][x] = { theme, wallStyle: wallStyle || "steel" };
}

function biomeAt(x, y) {
  const cx = (MAP_TILES - 1) / 2;
  const cy = (MAP_TILES - 1) / 2;
  const nx = (x - cx) / cx;
  const ny = (y - cy) / cy;
  // soft quadrant blend + noise
  const n = fbm(x * 0.045, y * 0.045);
  const n2 = fbm(x * 0.02 + 40, y * 0.02 - 10);

  // NW snow, N ice patches
  if (nx < -0.05 && ny < -0.05) {
    if (n2 > 0.62) return "ice";
    return "snow";
  }
  // NE forest
  if (nx > 0.05 && ny < -0.02) return "forest";
  // SW desert
  if (nx < -0.02 && ny > 0.08) return "desert";
  // SE mixed forest/desert fringe
  if (nx > 0.1 && ny > 0.1) return n > 0.5 ? "desert" : "forest";

  // center band
  if (n > 0.72) return "ice";
  if (nx + ny < -0.15) return "snow";
  if (nx - ny > 0.2) return "forest";
  if (ny - nx > 0.25) return "desert";
  return n > 0.45 ? "forest" : "desert";
}

function wallStyleForBiome(biome) {
  if (biome === "snow") return "snow";
  if (biome === "ice") return "ice";
  if (biome === "desert") return "desert";
  if (biome === "forest" || biome === "grass") return "forest";
  if (biome === "cave") return "dark";
  if (biome === "lava") return "lava";
  return "steel";
}

/** Circular red-gold lava arena at map center. */
function carveLavaArena(grid, meta, cx, cy, floorR, rimR) {
  for (let y = cy - rimR - 2; y <= cy + rimR + 2; y++) {
    for (let x = cx - rimR - 2; x <= cx + rimR + 2; x++) {
      if (x < 1 || y < 1 || x >= MAP_TILES - 1 || y >= MAP_TILES - 1) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d <= floorR) {
        setFloor(grid, meta, x, y, "lava", "lava");
        continue;
      }

      // gold rim ring (~2 tiles thick)
      if (d <= rimR && d > rimR - 2.2) {
        // four gate openings (N/E/S/W)
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        const gate = (ax <= 2 && ay >= rimR - 3) || (ay <= 2 && ax >= rimR - 3);
        if (gate) {
          setFloor(grid, meta, x, y, "lava", "gold");
        } else {
          grid[y][x] = CELL_WALL;
          meta[y][x] = { theme: "lava", wallStyle: "gold", block: true };
        }
        continue;
      }

      // short approach paths into gates
      if (d <= rimR + 3 && ((Math.abs(dx) <= 2 && Math.abs(dy) >= floorR) || (Math.abs(dy) <= 2 && Math.abs(dx) >= floorR))) {
        setFloor(grid, meta, x, y, "lava", "gold");
      }
    }
  }
}

function scatterRocks(grid, meta, biome, count, style) {
  for (let i = 0; i < count; i++) {
    const x = 2 + ((hash2(i * 17, biome.length * 9) * (MAP_TILES - 4)) | 0);
    const y = 2 + ((hash2(i * 31, 99) * (MAP_TILES - 4)) | 0);
    if (meta[y][x].theme !== biome) continue;
    if (grid[y][x] !== CELL_FLOOR) continue;
    // open cover — never seal
    const pattern = [
      [1, 0],
      [0, 1],
      [1, 1]
    ][i % 3];
    for (const [dx, dy] of [
      [0, 0],
      pattern
    ]) {
      const gx = x + dx;
      const gy = y + dy;
      if (gx < 1 || gy < 1 || gx >= MAP_TILES - 1 || gy >= MAP_TILES - 1) continue;
      if (meta[gy][gx].theme !== biome) continue;
      grid[gy][gx] = CELL_WALL;
      meta[gy][gx] = { theme: biome, wallStyle: style, block: true };
    }
  }
}

function carveCave(grid, meta, cx, cy, rw, rh) {
  const x0 = cx - rw;
  const y0 = cy - rh;
  const x1 = cx + rw;
  const y1 = cy + rh;
  // rock blob
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 2 || y < 2 || x >= MAP_TILES - 2 || y >= MAP_TILES - 2) continue;
      const dx = (x - cx) / rw;
      const dy = (y - cy) / rh;
      const d = dx * dx + dy * dy + (hash2(x, y) - 0.5) * 0.35;
      if (d < 1) {
        grid[y][x] = CELL_WALL;
        meta[y][x] = { theme: "cave", wallStyle: "dark", block: true };
      }
    }
  }
  // hollow interior
  const iw = Math.max(3, rw - 4);
  const ih = Math.max(3, rh - 4);
  for (let y = cy - ih; y <= cy + ih; y++) {
    for (let x = cx - iw; x <= cx + iw; x++) {
      if (x < 2 || y < 2 || x >= MAP_TILES - 2 || y >= MAP_TILES - 2) continue;
      const dx = (x - cx) / iw;
      const dy = (y - cy) / ih;
      if (dx * dx + dy * dy < 1) {
        setFloor(grid, meta, x, y, "cave", "dark");
      }
    }
  }
  // one mouth opening toward outside (east or south)
  const mouth = hash2(cx, cy) > 0.5 ? "e" : "s";
  if (mouth === "e") {
    for (let x = cx + iw - 1; x <= cx + rw + 2; x++) {
      for (let t = -2; t <= 2; t++) setFloor(grid, meta, x, cy + t, "cave", "dark");
    }
  } else {
    for (let y = cy + ih - 1; y <= cy + rh + 2; y++) {
      for (let t = -2; t <= 2; t++) setFloor(grid, meta, cx + t, y, "cave", "dark");
    }
  }
}

function buildMegamap() {
  const grid = Array.from({ length: MAP_TILES }, () => Array(MAP_TILES).fill(CELL_WALL));
  const meta = Array.from({ length: MAP_TILES }, () =>
    Array.from({ length: MAP_TILES }, () => ({ theme: "forest", wallStyle: "forest", block: true }))
  );
  const rooms = [];

  // paint biomes across open world
  for (let y = 1; y < MAP_TILES - 1; y++) {
    for (let x = 1; x < MAP_TILES - 1; x++) {
      const biome = biomeAt(x, y);
      setFloor(grid, meta, x, y, biome, wallStyleForBiome(biome));
    }
  }

  // ice lakes in snow region
  for (let i = 0; i < 7; i++) {
    const cx = 18 + ((hash2(i, 3) * 55) | 0);
    const cy = 16 + ((hash2(i, 7) * 50) | 0);
    const r = 5 + ((hash2(i, 11) * 6) | 0);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 1 || y < 1 || x >= MAP_TILES - 1 || y >= MAP_TILES - 1) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) setFloor(grid, meta, x, y, "ice", "ice");
      }
    }
  }

  // desert dunes as soft sand ridges (floor only — livable open)
  for (let i = 0; i < 40; i++) {
    const x = 8 + ((hash2(i, 21) * (MAP_TILES / 2 - 10)) | 0);
    const y = MAP_TILES / 2 + ((hash2(i, 22) * (MAP_TILES / 2 - 12)) | 0);
    if (meta[y | 0][x | 0]?.theme === "desert") {
      setFloor(grid, meta, x | 0, y | 0, "desert", "desert");
    }
  }

  // scatter cover rocks / ice shards / dunes / trunks (open patterns)
  // укрытия — ТОЛЬКО тёмные блоки (не цвет биома, иначе «невидимые стены»)
  scatterRocks(grid, meta, "snow", 35, "dark");
  scatterRocks(grid, meta, "ice", 15, "dark");
  scatterRocks(grid, meta, "desert", 30, "dark");
  scatterRocks(grid, meta, "forest", 40, "dark");

  // cave systems
  const caves = [
    [40, 95, 14, 11],
    [120, 40, 12, 10],
    [95, 130, 16, 12],
    [55, 55, 11, 9],
    [140, 110, 13, 10]
  ];
  for (const [cx, cy, rw, rh] of caves) {
    carveCave(grid, meta, cx, cy, rw, rh);
    rooms.push({
      x: cx - rw + 4,
      y: cy - rh + 4,
      w: rw * 2 - 6,
      h: rh * 2 - 6,
      theme: "cave",
      wallStyle: "dark",
      name: "Cave"
    });
  }

  // cross-world trails (stop short of center arena)
  const mid = (MAP_TILES / 2) | 0;
  const arenaClear = 22;
  for (let x = 8; x < MAP_TILES - 8; x++) {
    for (let t = -1; t <= 1; t++) {
      const y = mid + t;
      if (Math.abs(x - mid) < arenaClear) continue;
      if (grid[y][x] === CELL_FLOOR) setFloor(grid, meta, x, y, meta[y][x].theme, "steel");
    }
  }
  for (let y = 8; y < MAP_TILES - 8; y++) {
    for (let t = -1; t <= 1; t++) {
      const x = mid + t;
      if (Math.abs(y - mid) < arenaClear) continue;
      if (grid[y][x] === CELL_FLOOR) setFloor(grid, meta, x, y, meta[y][x].theme, "steel");
    }
  }

  // center: circular red-gold lava arena
  carveLavaArena(grid, meta, mid, mid, 14, 17);
  rooms.push({
    x: mid - 14,
    y: mid - 14,
    w: 28,
    h: 28,
    theme: "lava",
    wallStyle: "gold",
    name: "Lava Arena"
  });

  // border cliffs
  fillWall(grid, meta, 0, 0, MAP_TILES - 1, 0, "slate");
  fillWall(grid, meta, 0, MAP_TILES - 1, MAP_TILES - 1, MAP_TILES - 1, "slate");
  fillWall(grid, meta, 0, 0, 0, MAP_TILES - 1, "slate");
  fillWall(grid, meta, MAP_TILES - 1, 0, MAP_TILES - 1, MAP_TILES - 1, "slate");

  // spawn points across biomes (arena edge, not dead center)
  const spawnSpots = [
    [30, 30, "snow"],
    [140, 30, "forest"],
    [30, 140, "desert"],
    [140, 140, "forest"],
    [mid, mid - 20, "lava"],
    [mid, mid + 20, "lava"],
    [50, 100, "cave"],
    [125, 45, "cave"]
  ];
  for (const [sx, sy, theme] of spawnSpots) {
    // clear spawn pad
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFloor(grid, meta, sx + dx, sy + dy, theme === "cave" ? "cave" : theme, wallStyleForBiome(theme));
      }
    }
    rooms.push({ x: sx - 2, y: sy - 2, w: 5, h: 5, theme, wallStyle: wallStyleForBiome(theme), name: theme });
  }

  return { grid, meta, rooms, exit: null };
}

function circleRectCollides(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function buildWorld(grid, meta, rooms) {
  const tiles = grid.length;
  const half = (tiles * TILE) / 2;
  const walls = [];
  const floorTiles = [];
  let wallId = 1;

  for (let gy = 0; gy < tiles; gy++) {
    for (let gx = 0; gx < tiles; gx++) {
      const m = meta[gy][gx];
      const wx = gx * TILE - half;
      const wy = gy * TILE - half;
      if (grid[gy][gx] === CELL_FLOOR) {
        floorTiles.push({
          id: gy * tiles + gx,
          x: wx,
          y: wy,
          variant: 0,
          biome: m.theme || "forest"
        });
      } else {
        walls.push({
          id: wallId++,
          x: wx,
          y: wy,
          w: TILE,
          h: TILE,
          kind: "wall",
          biome: "city",
          style: m.wallStyle || "dark"
        });
      }
    }
  }

  const spawns = rooms
    .filter((r) => r.w >= 4 && r.h >= 4)
    .map((room) => ({
      x: (room.x + room.w / 2) * TILE - half,
      y: (room.y + room.h / 2) * TILE - half,
      theme: room.theme,
      name: room.name
    }));

  return { walls, floorTiles, decor: [], spawns };
}

function encodeCells(grid, meta) {
  const n = MAP_TILES * MAP_TILES;
  const codes = new Uint8Array(n);
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      const i = y * MAP_TILES + x;
      const m = meta[y][x] || {};
      if (grid[y][x] === CELL_FLOOR) {
        codes[i] = BIOME_ID[m.theme] ?? 0;
      } else {
        codes[i] = 0x80 | (STYLE_ID[m.wallStyle] ?? 1);
      }
    }
  }
  return codes;
}

function rleEncode(codes) {
  const out = [];
  let i = 0;
  while (i < codes.length) {
    const v = codes[i];
    let run = 1;
    while (i + run < codes.length && codes[i + run] === v && run < 65535) run++;
    out.push(run & 255, (run >> 8) & 255, v);
    i += run;
  }
  return new Uint8Array(out);
}

function rleDecode(bytes, expectedLen) {
  const codes = new Uint8Array(expectedLen);
  let oi = 0;
  let i = 0;
  while (i + 2 < bytes.length && oi < expectedLen) {
    const run = bytes[i] | (bytes[i + 1] << 8);
    const v = bytes[i + 2];
    i += 3;
    for (let r = 0; r < run && oi < expectedLen; r++) codes[oi++] = v;
  }
  return codes;
}

function mapFromCellCodes(codes, tiles = MAP_TILES) {
  const grid = Array.from({ length: tiles }, () => Array(tiles).fill(CELL_WALL));
  const meta = Array.from({ length: tiles }, () =>
    Array.from({ length: tiles }, () => ({ theme: "forest", wallStyle: "dark", block: true }))
  );
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const c = codes[y * tiles + x] || 0;
      if (c & 0x80) {
        grid[y][x] = CELL_WALL;
        meta[y][x] = { theme: "cave", wallStyle: ID_STYLE[c & 0x7f] || "dark", block: true };
      } else {
        grid[y][x] = CELL_FLOOR;
        const theme = ID_BIOME[c] || "forest";
        meta[y][x] = { theme, wallStyle: wallStyleForBiome(theme) };
      }
    }
  }
  const world = buildWorld(grid, meta, []);
  const half = (tiles * TILE) / 2;
  const spawns = [];
  const step = Math.max(10, (tiles / 8) | 0);
  for (let y = step; y < tiles - step; y += step) {
    for (let x = step; x < tiles - step; x += step) {
      if (grid[y][x] !== CELL_FLOOR) continue;
      spawns.push({
        x: x * TILE - half + TILE / 2,
        y: y * TILE - half + TILE / 2,
        theme: meta[y][x].theme,
        name: meta[y][x].theme
      });
    }
  }
  if (!spawns.length) spawns.push({ x: 0, y: 0, theme: "forest", name: "Center" });
  world.spawns = spawns;
  return { grid, meta, rooms: [], ...world, tiles, size: tiles * TILE, half };
}

const BUILT = buildMegamap();
const FIXED_WORLD = buildWorld(BUILT.grid, BUILT.meta, BUILT.rooms);
const CELL_CODES = encodeCells(BUILT.grid, BUILT.meta);
const CELL_RLE = rleEncode(CELL_CODES);

class FfaMap {
  constructor(_seed = 424242) {
    this.seed = _seed >>> 0;
    this.tileSize = TILE;
    this.tiles = MAP_TILES;
    this.size = MAP_SIZE;
    this.half = HALF_MAP;
    this.grid = BUILT.grid;
    this.meta = BUILT.meta;
    this.rooms = BUILT.rooms;
    this.walls = FIXED_WORLD.walls;
    this.floorTiles = FIXED_WORLD.floorTiles;
    this.decor = FIXED_WORLD.decor;
    this.spawns = FIXED_WORLD.spawns;
    this.paths = [];
    this.exit = BUILT.exit;
    this.cellRle = CELL_RLE;
  }

  static fromCellCodes(codes, tiles = MAP_TILES) {
    const data = mapFromCellCodes(codes, tiles);
    const map = Object.create(FfaMap.prototype);
    map.seed = 0;
    map.tileSize = TILE;
    map.tiles = tiles;
    map.size = tiles * TILE;
    map.half = map.size / 2;
    map.grid = data.grid;
    map.meta = data.meta;
    map.rooms = data.rooms;
    map.walls = data.walls;
    map.floorTiles = data.floorTiles;
    map.decor = data.decor;
    map.spawns = data.spawns;
    map.paths = [];
    map.exit = null;
    map.cellRle = null;
    return map;
  }

  tileAtWorld(x, y) {
    const gx = ((x + this.half) / TILE) | 0;
    const gy = ((y + this.half) / TILE) | 0;
    if (gx < 0 || gy < 0 || gx >= this.tiles || gy >= this.tiles) return CELL_WALL;
    return this.grid[gy][gx];
  }

  collides(x, y, radius) {
    const half = this.half;
    const tiles = this.tiles;
    const inset = 2; // почти вплотную к видимому блоку (чёрная обводка ~5px)
    const minGX = clamp(((x - radius + half) / TILE) | 0, 0, tiles - 1);
    const maxGX = clamp(((x + radius + half) / TILE) | 0, 0, tiles - 1);
    const minGY = clamp(((y - radius + half) / TILE) | 0, 0, tiles - 1);
    const maxGY = clamp(((y + radius + half) / TILE) | 0, 0, tiles - 1);
    for (let gy = minGY; gy <= maxGY; gy++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        if (this.grid[gy][gx] !== CELL_WALL) continue;
        const rect = {
          x: gx * TILE - half + inset,
          y: gy * TILE - half + inset,
          w: TILE - inset * 2,
          h: TILE - inset * 2
        };
        if (circleRectCollides(x, y, radius, rect)) return true;
      }
    }
    return false;
  }

  randomSpawn(radius, occupied = []) {
    const minDist = Math.max(radius * 10, 180);
    const pads = this.floorTiles;
    if (!pads.length) {
      return this.ejectFromWall(0, 0, radius);
    }

    for (let attempt = 0; attempt < 100; attempt++) {
      const tile = pads[(Math.random() * pads.length) | 0];
      const x = tile.x + TILE * 0.5;
      const y = tile.y + TILE * 0.5;
      if (this.collides(x, y, radius + 2)) continue;
      let crowded = false;
      for (const unit of occupied) {
        if (!unit) continue;
        if (Math.hypot(unit.x - x, unit.y - y) < minDist) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      return { x, y };
    }

    // fallback: any free floor, ignore crowding
    for (let attempt = 0; attempt < 60; attempt++) {
      const tile = pads[(Math.random() * pads.length) | 0];
      const x = tile.x + TILE * 0.5;
      const y = tile.y + TILE * 0.5;
      if (!this.collides(x, y, radius + 2)) return { x, y };
    }

    return this.ejectFromWall(0, 0, radius);
  }

  /** If stuck in a wall — push out to nearest walkable spot. */
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

    // last resort: sample floor tiles
    for (let i = 0; i < 200; i++) {
      const tile = this.floorTiles[(Math.random() * this.floorTiles.length) | 0];
      if (!tile) break;
      const nx = tile.x + TILE * 0.5;
      const ny = tile.y + TILE * 0.5;
      if (!this.collides(nx, ny, radius + 2)) return { x: nx, y: ny };
    }
    return { x: 0, y: 0 };
  }
}

function isWalkable(cell) {
  return cell === CELL_FLOOR;
}

function buildTileGrid() {
  return { grid: BUILT.grid, rooms: BUILT.rooms };
}

module.exports = {
  FfaMap,
  Map: FfaMap,
  TILE,
  MAP_TILES,
  MAP_SIZE,
  HALF_MAP,
  CELL_FLOOR,
  CELL_WALL,
  clamp,
  circleRectCollides,
  buildTileGrid,
  isWalkable,
  encodeCells,
  rleEncode,
  rleDecode,
  mapFromCellCodes,
  CELL_RLE,
  STYLE_ID,
  ID_STYLE,
  BIOME_ID,
  ID_BIOME
};
