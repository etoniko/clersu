/* global PIXI */
import { createTextures } from "./PixelAssets.js";
import { PlayerSprite } from "./PlayerSprite.js";
import { normalizeAngle } from "./CharacterFactory.js";
import { settings, saveSettings } from "../config/settings.js";

export class Application {
  constructor(core) {
    this.core = core;
    this.view = document.getElementById("view");
    this.canvas = this.view;
    this.playerRadius = 10;
    this.mapSize = 11520;
    this.tileSize = 64;
    this.world = null;
    this.mapReady = false;
    this.viewYScale = 1;
    this.zoomLimits = { min: 0.08, max: 2.8 };
    this.chunkRadius = 18;
    this._chunkKey = "";
    this.tileIndex = null;
    this.overviewGfx = null;
    this.zoomIntro = null;
    this.spawnZoomClose = 1.5;
    this.camX = 0;
    this.camY = 0;
    this.camReady = false;
    this.minimapSize = 200;
    this.minimapPad = 12;
    this.isMobile =
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) ||
      (navigator.maxTouchPoints || 0) > 0;
    if (this.isMobile) {
      this.minimapSize = 110;
      this.chunkRadius = 12;
      this.spawnZoomClose = 1.85;
    }
    const savedZoom = Number(settings.cameraZoom);
    if (Number.isFinite(savedZoom) && savedZoom > 0) {
      this.zoom = savedZoom;
      this.viewZoom = savedZoom;
    } else {
      this.zoom = this.spawnZoomClose;
      this.viewZoom = this.spawnZoomClose;
    }

    this.playerSprites = new Map();
    this.bulletSprites = new Map();
    this.pickupSprites = new Map();
    this.graveSprites = [];
    this._graveKeys = new Set();
    this._trackedPlayers = new Map(); // id -> {x,y}
    this._wasMeAlive = false;
    this.dirCues = [];
    this.impactDecals = [];
    this.particles = [];
    this.shakeAmp = 0;
    this.lastFrameAt = performance.now();

    this.initRenderer();
    window.addEventListener("resize", () => this.resize());
    this.loop();
  }

  initRenderer() {
    const w = Math.max(1, window.innerWidth | 0);
    const h = Math.max(1, window.innerHeight | 0);
    const dprCap = this.isMobile ? 1.25 : 2;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), dprCap);

    if (PIXI.settings) {
      PIXI.settings.ROUND_PIXELS = false;
      PIXI.settings.RESOLUTION = dpr;
      if (PIXI.SCALE_MODES) {
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR;
      }
    }

    this.renderer = PIXI.autoDetectRenderer({
      view: this.view,
      width: w,
      height: h,
      antialias: !this.isMobile,
      resolution: dpr,
      autoDensity: true,
      powerPreference: this.isMobile ? "default" : "high-performance",
      backgroundColor: 0x000000,
      backgroundAlpha: 1
    });

    this.stage = new PIXI.Container();
    this.world = new PIXI.Container();
    this.floorLayer = new PIXI.Container();
    this.decorLayer = new PIXI.Container();
    this.wallLayer = new PIXI.Container();
    this.graveLayer = new PIXI.Container();
    this.graveLayer.sortableChildren = true;
    this.entityLayer = new PIXI.Container();
    this.entityLayer.sortableChildren = true;
    // Local player lives here — always above other players, no zIndex fight
    this.localLayer = new PIXI.Container();
    this.fxLayer = new PIXI.Container();
    this.fxLayer.sortableChildren = true;

    // graves always under players (own layer below entities)
    this.world.addChild(
      this.floorLayer,
      this.decorLayer,
      this.wallLayer,
      this.graveLayer,
      this.entityLayer,
      this.localLayer,
      this.fxLayer
    );

    this.textures = createTextures(this.renderer);

    // solid black void outside the map border
    this.bgPattern = null;
    this.stage.addChild(this.world);

    this.vignette = new PIXI.Graphics();
    this.stage.addChild(this.vignette);

    // screen-space gunfire cues at camera edge (only when off-screen)
    this.edgeCueLayer = new PIXI.Container();
    this.stage.addChild(this.edgeCueLayer);

    this.minimapRoot = new PIXI.Container();
    this.minimapRoot.visible = false;
    this.minimapBg = new PIXI.Graphics();
    this.minimapMap = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.minimapDots = new PIXI.Graphics();
    this.minimapRoot.addChild(this.minimapBg, this.minimapMap, this.minimapDots);
    this.stage.addChild(this.minimapRoot);

    this.damageFx = document.getElementById("damage-fx");
    this._damageIntensity = 0;

    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth | 0);
    const h = Math.max(1, window.innerHeight | 0);
    this.renderer.resize(w, h);
    if (this.bgPattern) {
      this.bgPattern.width = w;
      this.bgPattern.height = h;
    }
    this.drawVignette(w, h);
    this.layoutMinimap(w, h);
    if (this.mapReady) {
      this.zoomLimits.min = Math.min(this.fitMapZoom(), 0.12);
      if (this.zoom < this.zoomLimits.min) this.zoom = this.zoomLimits.min;
      this._chunkKey = "";
    }
  }

  layoutMinimap(w, h) {
    if (!this.minimapRoot) return;
    const size = this.minimapSize;
    const pad = this.minimapPad;
    this.minimapRoot.position.set(w - size - pad - 8, this.isMobile ? 52 : h - size - pad - 8);
    this.minimapBg.clear();
    this.minimapBg.beginFill(0x0c1218, 0.82);
    this.minimapBg.drawRoundedRect(-6, -6, size + 12, size + 12, 6);
    this.minimapBg.endFill();
    this.minimapBg.lineStyle(2, 0x9aa4b0, 0.9);
    this.minimapBg.drawRoundedRect(-6, -6, size + 12, size + 12, 6);
    if (this.minimapMap.texture && this.minimapMap.texture !== PIXI.Texture.EMPTY) {
      this.minimapMap.width = size;
      this.minimapMap.height = size;
    }
  }

  buildMinimap() {
    const map = this.core.net.map;
    if (!map?.grid) return;
    const tiles = map.tiles;
    const sample = Math.max(1, (tiles / 160) | 0);
    const out = Math.ceil(tiles / sample);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(out, out);
    const data = img.data;

    const hexToRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const floorRgb = (biome) => hexToRgb(this.biomeColor(biome === "gallery" ? "hall" : biome, false));
    const wallRgb = (style) => hexToRgb(this.biomeColor(style || "steel", true));

    for (let oy = 0; oy < out; oy++) {
      for (let ox = 0; ox < out; ox++) {
        const gx = Math.min(tiles - 1, ox * sample);
        const gy = Math.min(tiles - 1, oy * sample);
        const cell = map.grid[gy][gx];
        const m = map.meta?.[gy]?.[gx];
        let rgb;
        if (cell === 1) rgb = wallRgb(m?.wallStyle);
        else rgb = floorRgb(m?.theme || "hall");
        const i = (oy * out + ox) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const base = PIXI.BaseTexture.from(canvas, { scaleMode: PIXI.SCALE_MODES.NEAREST });
    const tex = new PIXI.Texture(base);
    tex._keepCanvas = canvas;
    this.minimapMap.texture = tex;
    this.minimapMap.width = this.minimapSize;
    this.minimapMap.height = this.minimapSize;
    this.minimapRoot.visible = true;
  }

  updateMinimap() {
    if (!this.minimapRoot?.visible || !this.gameWorld || !this.mapReady) return;
    const size = this.minimapSize;
    const half = this.mapSize / 2;
    const toMini = (x, y) => ({
      x: ((x + half) / this.mapSize) * size,
      y: ((y + half) / this.mapSize) * size
    });

    const g = this.minimapDots;
    g.clear();

    const drawDot = (x, y, color, r) => {
      const p = toMini(x, y);
      g.beginFill(color, 1);
      g.drawCircle(p.x, p.y, r);
      g.endFill();
    };

    for (const p of this.gameWorld.players || []) {
      drawDot(p.x, p.y, 0xe05050, 2.2);
    }

    const me = this.gameWorld.me;
    if (me) {
      drawDot(me.x, me.y, 0x4adf5a, 3.2);
      // view marker
      const p = toMini(me.x, me.y);
      g.lineStyle(1.2, 0xffffff, 0.85);
      g.drawCircle(p.x, p.y, 5);
    }
  }

  drawVignette(w, h) {
    this.vignette.clear();
  }

  spawnImpact(impact) {
    const count = impact.kind === "hit" ? 10 : 6;
    const color = impact.kind === "hit" ? 0xff6b6b : 0xffd166;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      this.particles.push({
        x: impact.x,
        y: impact.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.18 + Math.random() * 0.22,
        age: 0,
        size: 1.5 + Math.random() * 2.5,
        color
      });
    }
  }

  updateParticles(dt) {
    if (!this._particleGfx) {
      this._particleGfx = new PIXI.Graphics();
      this.fxLayer.addChild(this._particleGfx);
    }
    const g = this._particleGfx;
    g.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const t = 1 - p.age / p.life;
      g.beginFill(p.color, 0.25 + t * 0.7);
      g.drawCircle(p.x, p.y, p.size * t);
      g.endFill();
    }
  }

  fitMapZoom() {
    const w = this.renderer.width / this.renderer.resolution;
    const h = this.renderer.height / this.renderer.resolution;
    const tilt = this.viewYScale;
    const size = Math.max(1, this.mapSize);
    return Math.min(w / size, h / (size * tilt)) * 0.98;
  }

  /** Сразу игровой зум у персонажа (сохранённый пользователем, если есть). */
  startSpawnZoom() {
    this.zoomIntro = null;
    const z = this.getPreferredZoom();
    this.zoom = z;
    this.viewZoom = z;
    this._chunkKey = "";
  }

  getPreferredZoom() {
    const saved = Number(settings.cameraZoom);
    const base = Number.isFinite(saved) && saved > 0 ? saved : this.spawnZoomClose;
    this.zoomLimits.min = Math.min(this.fitMapZoom(), 0.12);
    return Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, base));
  }

  persistZoom() {
    settings.cameraZoom = this.zoom;
    saveSettings(settings);
  }

  easeOutQuint(t) {
    const u = Math.max(0, Math.min(1, t));
    return 1 - (1 - u) ** 5;
  }

  viewRange() {
    const w = this.view?.clientWidth || window.innerWidth;
    const h = this.view?.clientHeight || window.innerHeight;
    const ratio = Math.max(h / 1080, w / 1920);
    return ratio * this.zoom;
  }

  adjustZoom(factor) {
    this.zoomIntro = null;
    const fit = this.fitMapZoom();
    this.zoomLimits.min = Math.min(fit, 0.12);
    const next = this.zoom * factor;
    this.zoom = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, next));
    this.persistZoom();
  }

  onMapReady() {
    this.mapReady = true;
    this.mapSize = this.core.net.mapSize;
    this.tileSize = this.core.net.tileSize || 64;
    for (const spr of this.playerSprites.values()) {
      spr.parent?.removeChild(spr);
    }
    this.playerSprites.clear();
    for (const spr of this.graveSprites) {
      spr.parent?.removeChild(spr);
    }
    this.graveSprites = [];
    this._graveKeys.clear();
    this._trackedPlayers.clear();
    this._wasMeAlive = false;
    this.buildTileIndex();
    this._chunkKey = "";
    this.floorLayer.removeChildren();
    this.decorLayer.removeChildren();
    this.wallLayer.removeChildren();
    if (this.overviewGfx) {
      this.overviewGfx.clear();
      this.overviewGfx._builtFor = -1;
      if (this.overviewGfx.parent) this.overviewGfx.parent.removeChild(this.overviewGfx);
    }
    this.zoomLimits.min = Math.min(this.fitMapZoom(), 0.12);
    const preferred = this.getPreferredZoom();
    this.zoom = preferred;
    this.viewZoom = preferred;
    this.camReady = false;
    this.buildMinimap();
    this.startSpawnZoom();
    this.core.ui.hideMenu();
  }

  buildTileIndex() {
    const map = this.core.net.map;
    if (!map?.grid) {
      this.tileIndex = null;
      return;
    }
    const half = map.half;
    const t = map.tileSize || this.tileSize;
    const tiles = map.tiles;
    this.mapSize = map.size;
    this.tileSize = t;
    this.tileIndex = {
      floors: new Map(),
      walls: new Map(),
      decor: new Map(),
      half,
      t,
      tiles,
      grid: map.grid,
      meta: map.meta
    };
    const key = (x, y) => `${x},${y}`;
    for (let gy = 0; gy < tiles; gy++) {
      for (let gx = 0; gx < tiles; gx++) {
        const wx = gx * t - half;
        const wy = gy * t - half;
        const m = map.meta?.[gy]?.[gx] || {};
        if (map.grid[gy][gx] === 0) {
          this.tileIndex.floors.set(key(gx, gy), {
            x: wx,
            y: wy,
            biome: m.theme || "forest"
          });
        } else {
          this.tileIndex.walls.set(key(gx, gy), [
            {
              x: wx,
              y: wy,
              w: t,
              h: t,
              kind: "wall",
              style: m.wallStyle || "dark"
            }
          ]);
        }
      }
    }
    for (const item of this.core.net.decor || []) {
      const gx = ((item.x + half) / t) | 0;
      const gy = ((item.y + half) / t) | 0;
      if (!this.tileIndex.decor.has(key(gx, gy))) this.tileIndex.decor.set(key(gx, gy), []);
      this.tileIndex.decor.get(key(gx, gy)).push(item);
    }
  }

  floorTexture(tile) {
    const key = tile.biome || "forest";
    const entry = this.textures.floors?.[key];
    if (entry && typeof entry !== "number") return entry;
    if (typeof entry === "number") return entry;
    return this.biomeColor(key, false);
  }

  makeFloorSprite(tile, t) {
    const texOrColor = this.floorTexture(tile);
    const isTex = texOrColor && typeof texOrColor !== "number";
    const spr = new PIXI.Sprite(isTex ? texOrColor : PIXI.Texture.WHITE);
    spr.tint = isTex ? 0xffffff : texOrColor;
    spr.x = tile.x;
    spr.y = tile.y;
    spr.width = t;
    spr.height = t;
    return spr;
  }

  wallTexture(wall) {
    const style = wall.style || "steel";
    const set = this.textures.walls?.[style] || this.textures.walls?.steel;
    if (Array.isArray(set) && set[0]) return set[0];
    return this.textures.wall || PIXI.Texture.WHITE;
  }

  makeWallSprite(wall) {
    // всегда читаемая текстура блока (fallback dark)
    const style = wall.style || "dark";
    const set = this.textures.walls?.[style] || this.textures.walls?.dark || this.textures.walls?.steel;
    const tex = Array.isArray(set) && set[0] ? set[0] : this.textures.wall;
    const spr = new PIXI.Sprite(tex);
    spr.x = wall.x;
    spr.y = wall.y;
    spr.width = wall.w;
    spr.height = wall.h;
    return spr;
  }

  decorTexture(kind, id = 0) {
    const t = this.textures;
    const sheet = { barrel: t.barrel, desk: t.desk, plant: t.bush, bush: t.bush, crate: t.crate }[kind] || t.crate;
    if (Array.isArray(sheet)) return sheet[id % sheet.length];
    return sheet;
  }

  biomeColor(biome, isWall) {
    if (isWall) {
      const wallStyles = {
        steel: 0x5a6068,
        brick: 0x8a5a42,
        concrete: 0x707478,
        dark: 0x2e3238,
        amber: 0x8a7040,
        slate: 0x4a5a6a,
        red: 0xc02828,
        desert: 0xb89050,
        snow: 0x9aa8b4,
        ice: 0x6ab0d0,
        forest: 0x4a6038,
        lava: 0xa02810,
        gold: 0xc9a227,
        city: 0x5a6068,
        cave: 0x2e3238
      };
      return wallStyles[biome] || 0x5a6068;
    }
    const floors = {
      forest: 0x3a7a38,
      grass: 0x3a7a38,
      desert: 0xd4b878,
      snow: 0xd8e4f0,
      ice: 0x8ec8e8,
      cave: 0x2a2e34,
      lava: 0xd44018,
      outdoor: 0x3a7a38,
      hall: 0x2a2e34,
      arena: 0xd44018
    };
    return floors[biome] || 0x3a7a38;
  }

  drawOverviewMap() {
    if (!this.overviewGfx) {
      this.overviewGfx = new PIXI.Graphics();
    }
    if (this.overviewGfx._builtFor !== this.mapSize) {
      this.overviewGfx.clear();
      const half = this.mapSize / 2;
      const t = this.tileSize;
      const map = this.core.net.map;
      this.overviewGfx.beginFill(0x2f5a32);
      this.overviewGfx.drawRect(-half, -half, this.mapSize, this.mapSize);
      this.overviewGfx.endFill();

      if (map?.grid) {
        for (let gy = 0; gy < map.tiles; gy++) {
          for (let gx = 0; gx < map.tiles; gx++) {
            const wx = gx * t - half;
            const wy = gy * t - half;
            if (map.grid[gy][gx] === 0) {
              const biome = map.meta?.[gy]?.[gx]?.theme || "forest";
              if (biome === "forest") continue;
              this.overviewGfx.beginFill(this.biomeColor(biome, false));
              this.overviewGfx.drawRect(wx, wy, t, t);
              this.overviewGfx.endFill();
            } else {
              const style = map.meta?.[gy]?.[gx]?.wallStyle || "dark";
              this.overviewGfx.beginFill(this.biomeColor(style, true));
              this.overviewGfx.drawRect(wx, wy, t, t);
              this.overviewGfx.endFill();
            }
          }
        }
      }
      this.overviewGfx._builtFor = this.mapSize;
    }
    if (!this.overviewGfx.parent) {
      this.floorLayer.addChild(this.overviewGfx);
    }
  }

  refreshVisibleChunks(camX, camY) {
    if (!this.tileIndex) return;
    const t = this.tileSize;
    const half = this.tileIndex.half;
    const s = Math.max(0.0001, this.viewZoom);
    const screenW = this.renderer.width / this.renderer.resolution;
    const screenH = this.renderer.height / this.renderer.resolution;
    const worldW = screenW / s;
    const worldH = screenH / (s * this.viewYScale);
    const Rx = Math.ceil(worldW / (2 * t)) + 2;
    const Ry = Math.ceil(worldH / (2 * t)) + 2;
    const R = Math.max(Rx, Ry, 8);

    const cx = ((camX + half) / t) | 0;
    const cy = ((camY + half) / t) | 0;
    const key = `${cx},${cy},${R}`;
    if (key === this._chunkKey) return;
    this._chunkKey = key;

    this.floorLayer.removeChildren();
    this.decorLayer.removeChildren();
    this.wallLayer.removeChildren();

    // full-map overview: one graphics pass (весь обзор карты)
    if (R >= 60) {
      this.drawOverviewMap();
      return;
    }

    for (let gy = cy - Ry; gy <= cy + Ry; gy++) {
      for (let gx = cx - Rx; gx <= cx + Rx; gx++) {
        const k = `${gx},${gy}`;
        const floor = this.tileIndex.floors.get(k);
        if (floor) {
          this.floorLayer.addChild(this.makeFloorSprite(floor, t));
        }
        const walls = this.tileIndex.walls.get(k);
        if (walls) {
          for (const wall of walls) {
            if (wall.kind !== "wall") continue;
            this.wallLayer.addChild(this.makeWallSprite(wall));
          }
        }
        const decor = this.tileIndex.decor.get(k);
        if (decor) {
          for (const item of decor) {
            const spr = new PIXI.Sprite(this.decorTexture(item.kind, item.id ?? 0));
            spr.anchor.set(0.5);
            spr.width = item.w;
            spr.height = item.h;
            spr.x = item.x + item.w / 2;
            spr.y = item.y + item.h / 2;
            if (!["crate", "barrel"].includes(item.kind)) {
              spr.rotation = ((item.id ?? 0) % 8) * 0.12;
            }
            this.decorLayer.addChild(spr);
          }
        }
      }
    }
  }

  buildMap() {
    this.buildTileIndex();
    this._chunkKey = "";
  }

  onWorldUpdate(world) {
    this.gameWorld = world;
    if (world.impacts?.length) {
      for (const impact of world.impacts) this.spawnImpact(impact);
    }
  }

  spawnGrave(x, y) {
    if (!this.textures?.grave) return;
    const key = `${Math.round(x / 24)}_${Math.round(y / 24)}`;
    if (this._graveKeys.has(key)) return;
    this._graveKeys.add(key);

    const spr = new PIXI.Sprite(this.textures.grave);
    spr.anchor.set(0.5, 0.88);
    spr.width = 56;
    spr.height = 56;
    spr.x = x;
    spr.y = y;
    spr.zIndex = y;
    spr.alpha = 1;
    this.graveLayer.addChild(spr);
    this.graveSprites.push(spr);
  }

  tryLocalShot(weapon = 0) {
    const world = this.gameWorld;
    if (!world?.me) return false;
    const spr = this.playerSprites.get(world.me.id ?? "me");
    return Boolean(spr?.tryPlayShot(weapon === 1 ? 1 : 0));
  }

  listenerPos() {
    const me = this.gameWorld?.me;
    if (!me) return { x: this.camX, y: this.camY };
    const spr = this.playerSprites.get(me.id ?? "me");
    return { x: spr?.x ?? me.x, y: spr?.y ?? me.y };
  }

  /** Distance → volume (closer = louder). Others slightly quieter. */
  spatialGain(x, y, maxDist, isLocal) {
    const L = this.listenerPos();
    const dist = Math.hypot(x - L.x, y - L.y);
    const t = Math.min(1, dist / Math.max(1, maxDist));
    let g = Math.pow(1 - t, 1.55);
    if (!isLocal) g *= 0.55;
    return { gain: g, dist };
  }

  bindPlayerSound(spr) {
    spr.onAction = (kind, x, y, meta = {}) => this.onWorldAction(kind, x, y, meta);
  }

  onWorldAction(kind, x, y, meta = {}) {
    const sound = this.core?.sound;
    if (!sound) return;
    const isLocal = Boolean(meta.isLocal);
    const weapon = meta.weapon | 0;

    const ranges = { walk: 520, shot: 2400, dash: 1400, knife: 900 };
    const maxD = ranges[kind] || 1200;
    const { gain } = this.spatialGain(x, y, maxD, isLocal);

    if (kind === "shot") {
      // edge cue only if we'd actually hear it (not too far)
      if (gain >= 0.08) {
        this.spawnEdgeShotCue(x, y, gain);
      }
      if (gain < 0.035) return;
      if (weapon === 1) sound.rifle(gain);
      else sound.pistol(gain);
      return;
    }

    if (gain < 0.04) return;
    if (kind === "dash") sound.dash(gain);
    else if (kind === "knife") sound.knife(gain);
    else if (kind === "walk") sound.walk(gain);
  }

  screenSize() {
    return {
      w: this.renderer.width / this.renderer.resolution,
      h: this.renderer.height / this.renderer.resolution
    };
  }

  worldToScreen(wx, wy) {
    const { w, h } = this.screenSize();
    const s = this.viewZoom;
    const tilt = this.viewYScale;
    return {
      x: (wx - this.camX) * s + w * 0.5,
      y: (wy - this.camY) * s * tilt + h * 0.5
    };
  }

  isOnCamera(wx, wy, margin = 48) {
    const { w, h } = this.screenSize();
    const p = this.worldToScreen(wx, wy);
    return p.x > margin && p.x < w - margin && p.y > margin && p.y < h - margin;
  }

  /** Intersect ray from screen center with inset rectangle → edge point. */
  edgePointFromAngle(ang, pad = 26) {
    const { w, h } = this.screenSize();
    const cx = w * 0.5;
    const cy = h * 0.5;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const left = pad;
    const right = w - pad;
    const top = pad;
    const bottom = h - pad;
    let bestT = Infinity;
    let ex = cx;
    let ey = cy;

    const tryHit = (t, x, y) => {
      if (t > 0.001 && t < bestT) {
        bestT = t;
        ex = x;
        ey = y;
      }
    };

    if (Math.abs(dx) > 1e-6) {
      let t = (right - cx) / dx;
      let y = cy + t * dy;
      if (y >= top && y <= bottom) tryHit(t, right, y);
      t = (left - cx) / dx;
      y = cy + t * dy;
      if (y >= top && y <= bottom) tryHit(t, left, y);
    }
    if (Math.abs(dy) > 1e-6) {
      let t = (bottom - cy) / dy;
      let x = cx + t * dx;
      if (x >= left && x <= right) tryHit(t, x, bottom);
      t = (top - cy) / dy;
      x = cx + t * dx;
      if (x >= left && x <= right) tryHit(t, x, top);
    }
    return { x: ex, y: ey, ang };
  }

  /** One simple black arc on camera edge — only when shot is off-screen. */
  spawnEdgeShotCue(srcX, srcY, intensity = 0.5) {
    if (this.isOnCamera(srcX, srcY)) return;

    const s = this.viewZoom;
    const tilt = this.viewYScale;
    const dx = (srcX - this.camX) * s;
    const dy = (srcY - this.camY) * s * tilt;
    if (dx * dx + dy * dy < 4) return;
    const ang = Math.atan2(dy, dx);
    const edge = this.edgePointFromAngle(ang, 30);

    const g = new PIXI.Graphics();
    g.lineStyle(5, 0x000000, 0.5);
    g.arc(0, 0, 22, ang - 0.7, ang + 0.7);
    g.x = edge.x;
    g.y = edge.y;
    this.edgeCueLayer.addChild(g);
    this.dirCues.push({ g, life: 0.45, max: 0.45, ang, srcX, srcY });
  }

  updateShotFx(dt) {
    for (let i = this.dirCues.length - 1; i >= 0; i--) {
      const c = this.dirCues[i];
      c.life -= dt;
      // keep pinned to current camera edge toward source
      const s = this.viewZoom;
      const tilt = this.viewYScale;
      const dx = (c.srcX - this.camX) * s;
      const dy = (c.srcY - this.camY) * s * tilt;
      const ang = Math.atan2(dy, dx);
      const edge = this.edgePointFromAngle(ang, 30);
      c.g.x = edge.x;
      c.g.y = edge.y;
      c.g.alpha = Math.max(0, c.life / c.max);
      // hide if source scrolled into view
      if (this.isOnCamera(c.srcX, c.srcY) || c.life <= 0) {
        c.g.parent?.removeChild(c.g);
        c.g.destroy();
        this.dirCues.splice(i, 1);
      }
    }
  }

  syncEntitySprites(now) {
    const world = this.gameWorld;
    if (!world) return;

    const aliveIds = new Set();

    const upsertPlayer = (p, isMe) => {
      aliveIds.add(`p${p.id ?? "me"}`);
      let spr = this.playerSprites.get(p.id ?? "me");
      const layer = isMe ? this.localLayer : this.entityLayer;
      if (!spr) {
        spr = new PlayerSprite(this.renderer);
        layer.addChild(spr);
        this.playerSprites.set(p.id ?? "me", spr);
      } else if (spr.parent !== layer) {
        spr.parent?.removeChild(spr);
        layer.addChild(spr);
      }
      this.bindPlayerSound(spr);
      spr.sync(p, isMe, now);
      if (!isMe) {
        const z = p.y | 0;
        if (spr.zIndex !== z) spr.zIndex = z;
      }
    };

    upsertPlayer(world.me, true);
    // local aim follows mouse instantly (body still lerps smoothly)
    const meSpr = this.playerSprites.get(world.me.id ?? "me");
    if (meSpr && this.core?.input) {
      meSpr.lastAim = normalizeAngle(this.core.input.getAimAngle(this.view, this.viewYScale));
      const mv = this.core.input.movementVector();
      meSpr.driveWalk = Math.min(1, Math.hypot(mv.x, mv.y));
    }
    for (const p of world.players) {
      upsertPlayer(p, false);
    }

    // client-only graves: track last positions, spawn cross when someone vanishes (death)
    const seen = new Set();
    if (world.me.alive) {
      this._trackedPlayers.set(world.me.id ?? "me", { x: world.me.x, y: world.me.y });
      seen.add(world.me.id ?? "me");
    } else if (this._wasMeAlive) {
      const meSpr = this.playerSprites.get(world.me.id ?? "me");
      this.spawnGrave(meSpr?.x ?? world.me.x, meSpr?.y ?? world.me.y);
    }
    this._wasMeAlive = Boolean(world.me.alive);

    for (const p of world.players) {
      this._trackedPlayers.set(p.id, { x: p.x, y: p.y });
      seen.add(p.id);
    }
    for (const [id, pos] of this._trackedPlayers) {
      if (seen.has(id)) continue;
      if (id === world.me.id || id === "me") {
        this._trackedPlayers.delete(id);
        continue;
      }
      this.spawnGrave(pos.x, pos.y);
      this._trackedPlayers.delete(id);
    }

    const bulletIds = new Set();
    for (const b of world.bullets) {
      bulletIds.add(b.id);
      let spr = this.bulletSprites.get(b.id);
      if (!spr) {
        spr = new PIXI.Sprite(this.textures.bullet);
        spr.anchor.set(0.7, 0.5);
        spr.width = 18;
        spr.height = 6;
        this.fxLayer.addChild(spr);
        this.bulletSprites.set(b.id, spr);
      }
      const ang = typeof b.angle === "number" ? b.angle : spr.rotation;
      spr.rotation = ang;
      spr.x = b.x;
      spr.y = b.y;
      spr.zIndex = b.y + 20;
      spr.visible = true;
    }

    for (const [id, spr] of this.bulletSprites) {
      if (!bulletIds.has(id)) {
        spr.visible = false;
        // clean up legacy FX if any
        if (spr._trail) {
          spr._trail.destroy();
          spr._trail = null;
        }
        if (spr._glow) {
          spr._glow.destroy();
          spr._glow = null;
        }
        spr._hist = null;
      }
    }

    const pickupIds = new Set();
    const pickupTex = [
      this.textures.pickupHealth,
      this.textures.pickupArmor,
      this.textures.pickupStamina,
      this.textures.pickupAmmo
    ];
    for (const pk of world.pickups || []) {
      pickupIds.add(pk.id);
      let spr = this.pickupSprites.get(pk.id);
      if (!spr) {
        spr = new PIXI.Sprite(pickupTex[pk.type] || pickupTex[0]);
        spr.anchor.set(0.5);
        this.fxLayer.addChild(spr);
        this.pickupSprites.set(pk.id, spr);
      }
      const tex = pickupTex[pk.type] || pickupTex[0];
      if (spr.texture !== tex) spr.texture = tex;
      // размер как у блока тайла (64)
      const pulse = 1 + Math.sin(now / 320 + pk.id) * 0.04;
      spr.width = 64 * pulse;
      spr.height = 64 * pulse;
      spr.x = pk.x;
      spr.y = pk.y;
      spr.zIndex = pk.y - 2;
      spr.rotation = 0;
      spr.visible = true;
    }
    for (const [id, spr] of this.pickupSprites) {
      if (!pickupIds.has(id)) spr.visible = false;
    }

    for (const [id, spr] of this.playerSprites) {
      if (id === world.me.id || id === "me") continue;
      const numId = Number(id);
      if (!world.players.find((p) => p.id === numId)) {
        spr.visible = false;
      }
    }
  }

  updateCamera(dt = 0.016) {
    const me = this.gameWorld?.me;
    if (!me) return;

    const w = this.renderer.width / this.renderer.resolution;
    const h = this.renderer.height / this.renderer.resolution;
    const tilt = this.viewYScale;
    this.zoomLimits.min = Math.min(this.fitMapZoom(), 0.12);

    const targetZoom = this.viewRange();
    this.viewZoom = targetZoom;

    const heroSpr = this.playerSprites.get(me.id ?? "me");
    this.camX = heroSpr ? heroSpr.x : me.x;
    this.camY = heroSpr ? heroSpr.y : me.y;
    this.camReady = true;

    const s = this.viewZoom;
    let shakeX = 0;
    let shakeY = 0;
    const dmg = this._damageIntensity || 0;
    if (dmg > 0.02) {
      const now = performance.now();
      // Smooth, soft sway — not violent jitter
      const amp = 0.6 + dmg * 2.2;
      shakeX = Math.sin(now * 0.012) * amp + Math.sin(now * 0.027) * amp * 0.35;
      shakeY = Math.cos(now * 0.014) * amp * 0.85 + Math.cos(now * 0.023) * amp * 0.3;
    } else if (this.shakeAmp > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeAmp;
      shakeY = (Math.random() - 0.5) * this.shakeAmp;
      this.shakeAmp *= 0.88;
      if (this.shakeAmp < 0.15) this.shakeAmp = 0;
    }
    this.world.scale.set(s, s * tilt);
    this.world.position.set(
      w / 2 - this.camX * s + shakeX,
      h / 2 - this.camY * s * tilt + shakeY
    );
    if (this.bgPattern) {
      this.bgPattern.tilePosition.set(-this.camX * s * 0.22, -this.camY * s * tilt * 0.22);
    }
    this.refreshVisibleChunks(this.camX, this.camY);
  }

  updateDamageFx(dt = 0.016) {
    const el = this.damageFx || document.getElementById("damage-fx");
    if (!el) return;
    this.damageFx = el;
    const canvas = this.view;
    const me = this.gameWorld?.me;
    let t = 0;
    let critical = false;
    if (me) {
      const hp = Math.max(0, Math.min(100, me.health | 0));
      if (!me.alive) {
        t = 1;
        critical = true;
      } else if (hp <= 50) {
        t = (50 - hp) / 50;
        critical = hp <= 5;
      }
    }
    this._damageIntensity += (t - this._damageIntensity) * Math.min(1, dt * 10);
    if (t > this._damageIntensity) {
      this._damageIntensity = Math.min(t, this._damageIntensity + dt * 4);
    }
    const v = this._damageIntensity;

    this.core.sound?.setMuffle?.(critical ? Math.max(v, 0.85) : v);

    if (v < 0.015) {
      el.style.opacity = "0";
      el.classList.remove("active", "critical");
      el.style.removeProperty("--dmg");
      canvas?.classList.remove("dmg-bw");
      return;
    }
    el.classList.add("active");
    el.classList.toggle("critical", critical);
    el.style.opacity = "1";
    el.style.setProperty("--dmg", String(critical ? Math.max(v, 0.92) : v));
    el.style.setProperty("--dmg-blur", `${(1.5 + (critical ? 1 : v) * 8).toFixed(1)}px`);
    el.style.setProperty("--pulse-ms", `${Math.round(critical ? 320 : 900 - v * 520)}ms`);

    // ≤5% HP / dead: entire game world black & white
    if (critical) canvas?.classList.add("dmg-bw");
    else canvas?.classList.remove("dmg-bw");
  }

  drawDeathOverlay() {
    const me = this.gameWorld?.me;
    if (!me || me.alive) return;

    const w = this.renderer.width / this.renderer.resolution;
    const h = this.renderer.height / this.renderer.resolution;
    const g = this._deathGfx || (this._deathGfx = new PIXI.Graphics());
    if (!g.parent) this.stage.addChild(g);

    g.clear();
    g.beginFill(0x000000, 0.45);
    g.drawRect(0, 0, w, h);
    g.endFill();
  }

  clearDeathOverlay() {
    if (this._deathGfx?.parent) {
      this._deathGfx.parent.removeChild(this._deathGfx);
      this._deathGfx.clear();
    }
  }

  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    if (this.mapReady && this.gameWorld) {
      this.syncEntitySprites(now);
      for (const spr of this.playerSprites.values()) spr.tick(dt);
      this.updateShotFx(dt);
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateMinimap();
      this.updateDamageFx(dt);
      if (this.gameWorld.me.alive) {
        this.clearDeathOverlay();
      } else {
        this.drawDeathOverlay();
      }
    } else {
      this.updateDamageFx(dt);
    }
    this.renderer.render(this.stage);
    requestAnimationFrame(() => this.loop());
  }
}
