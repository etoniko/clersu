/* global PIXI */

/**
 * Natural top-down look: flat biome floors + soft natural props/walls.
 */

function hex(n) {
  return `#${(n >>> 0).toString(16).padStart(6, "0")}`;
}

function canvasTex(renderer, draw, size = 96, smooth = false) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: false });
  ctx.imageSmoothingEnabled = smooth;
  draw(ctx, size);

  // BaseTexture + явная ссылка на canvas — иначе GC ломает GPU-текстуру («invalid texture data»)
  const mode = smooth ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;
  const base = PIXI.BaseTexture.from(c, {
    scaleMode: mode,
    resolution: 1
  });
  base.scaleMode = mode;
  const tex = new PIXI.Texture(base);
  tex._keepCanvas = c;
  void renderer;
  return tex;
}

function fill(ctx, color, size) {
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, size, size);
}

function rgba(c, a) {
  const n = c >>> 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function softDisk(ctx, x, y, rx, ry, c0, c1, alpha = 1) {
  const r = Math.max(rx, ry, 0.5);
  const g = ctx.createRadialGradient(x - rx * 0.28, y - ry * 0.32, r * 0.1, x, y, r);
  g.addColorStop(0, rgba(c0, alpha));
  g.addColorStop(1, rgba(c1, alpha));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function solidWall(ctx, s, base, top, bot, pattern = "plain") {
  fill(ctx, base, s);
  ctx.fillStyle = hex(top);
  ctx.fillRect(4, 4, s - 8, 5);
  ctx.fillStyle = hex(bot);
  ctx.fillRect(4, s - 9, s - 8, 5);
  ctx.fillStyle = hex(bot);
  ctx.fillRect(4, 4, 5, s - 8);
  ctx.fillStyle = hex(top);
  ctx.fillRect(s - 9, 4, 5, s - 8);

  if (pattern === "brick") {
    ctx.strokeStyle = rgba(0x000000, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, s / 2);
    ctx.lineTo(s - 6, s / 2);
    ctx.moveTo(s / 2, 6);
    ctx.lineTo(s / 2, s / 2);
    ctx.moveTo(s / 4, s / 2);
    ctx.lineTo(s / 4, s - 6);
    ctx.moveTo((3 * s) / 4, s / 2);
    ctx.lineTo((3 * s) / 4, s - 6);
    ctx.stroke();
  } else if (pattern === "panel") {
    ctx.strokeStyle = rgba(0xffffff, 0.12);
    ctx.strokeRect(12, 12, s - 24, s - 24);
  } else if (pattern === "stripe") {
    ctx.fillStyle = rgba(0x000000, 0.2);
    ctx.fillRect(14, 6, 8, s - 12);
    ctx.fillRect(s - 22, 6, 8, s - 12);
  } else if (pattern === "check") {
    ctx.fillStyle = rgba(0x000000, 0.15);
    ctx.fillRect(6, 6, (s - 12) / 2, (s - 12) / 2);
    ctx.fillRect(6 + (s - 12) / 2, 6 + (s - 12) / 2, (s - 12) / 2, (s - 12) / 2);
  }

  // чёрные края блока
  ctx.fillStyle = hex(0x050508);
  ctx.fillRect(0, 0, s, 5);
  ctx.fillRect(0, s - 5, s, 5);
  ctx.fillRect(0, 0, 5, s);
  ctx.fillRect(s - 5, 0, 5, s);
  ctx.strokeStyle = rgba(0x000000, 0.95);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

const FLOOR_COLORS = {
  forest: 0x3a7a38,
  grass: 0x3a7a38,
  desert: 0xd4b878,
  snow: 0xd8e4f0,
  ice: 0x8ec8e8,
  cave: 0x2a2e34,
  lava: 0xd44018,
  outdoor: 0x3a7a38,
  hall: 0x2a2e34,
  gallery: 0x2a2e34,
  office: 0x3a7a38,
  living: 0xd4b878,
  service: 0x2a2e34,
  storage: 0x2a2e34,
  arena: 0xd44018,
  vault: 0x2a2e34,
  lab: 0x2a2e34,
  courtyard: 0x3a7a38,
  city: 0x3a7a38,
  oasis: 0x3a7a48
};

const WALL_STYLES = {
  steel: { base: 0x5a6068, top: 0x8a929c, bot: 0x3a4048, pattern: "panel" },
  brick: { base: 0x8a5a42, top: 0xaa7a5a, bot: 0x5a3a28, pattern: "brick" },
  concrete: { base: 0x707478, top: 0x909498, bot: 0x505458, pattern: "plain" },
  dark: { base: 0x2e3238, top: 0x4a5058, bot: 0x1a1e24, pattern: "stripe" },
  amber: { base: 0x8a7040, top: 0xaa9058, bot: 0x5a4828, pattern: "plain" },
  slate: { base: 0x4a5a6a, top: 0x6a7a8a, bot: 0x2a3a4a, pattern: "check" },
  red: { base: 0xc02828, top: 0xf06060, bot: 0x701414, pattern: "panel" },
  desert: { base: 0xb89050, top: 0xd4b078, bot: 0x7a6030, pattern: "plain" },
  snow: { base: 0x9aa8b4, top: 0xc8d4e0, bot: 0x6a7884, pattern: "plain" },
  ice: { base: 0x6ab0d0, top: 0xa8daf0, bot: 0x3a7088, pattern: "panel" },
  forest: { base: 0x4a6038, top: 0x6a8050, bot: 0x2a3820, pattern: "stripe" },
  lava: { base: 0xa02810, top: 0xff6030, bot: 0x501008, pattern: "panel" },
  gold: { base: 0xc9a227, top: 0xffe066, bot: 0x8a6a18, pattern: "panel" },
  city: { base: 0x5a6068, top: 0x8a929c, bot: 0x3a4048, pattern: "panel" },
  cave: { base: 0x2e3238, top: 0x4a5058, bot: 0x1a1e24, pattern: "stripe" }
};

/** Tileable grass / forest floor — orderly dots & dashes */
function drawGrassFloor(ctx, s) {
  fill(ctx, 0x2a522c, s);
  const step = 16;
  for (let y = step / 2; y < s; y += step) {
    for (let x = step / 2; x < s; x += step) {
      // symmetrical dots
      softDisk(ctx, x, y, 1.6, 1.6, 0x6a8a68, 0x4a6a48, 0.55);
      // short dashes alternating axes
      const odd = ((x / step) | 0) % 2 === ((y / step) | 0) % 2;
      ctx.strokeStyle = rgba(0x1a3018, 0.45);
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (odd) {
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
      } else {
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
      }
      ctx.stroke();
    }
  }
}

/** Tileable desert sand — dune tint + grey-gold marks */
function drawDesertFloor(ctx, s) {
  fill(ctx, 0xc8ae72, s);
  const step = 16;
  for (let y = step / 2; y < s; y += step) {
    for (let x = step / 2; x < s; x += step) {
      softDisk(ctx, x, y, 1.4, 1.4, 0x8a7a58, 0x6a5a40, 0.4);
      const odd = ((x / step) | 0) % 2 === ((y / step) | 0) % 2;
      ctx.strokeStyle = rgba(0x7a6840, 0.4);
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (odd) {
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
      } else {
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
      }
      ctx.stroke();
    }
  }
}

/** Red-gold molten lava floor */
function drawLavaFloor(ctx, s) {
  fill(ctx, 0x4a1008, s);
  // molten pools
  softDisk(ctx, s * 0.5, s * 0.5, 28, 26, 0xff6020, 0x8a1808, 1);
  softDisk(ctx, 22, 28, 14, 12, 0xffa030, 0xc02810, 0.95);
  softDisk(ctx, 46, 40, 16, 14, 0xffd060, 0xe04018, 0.85);
  softDisk(ctx, 30, 48, 12, 10, 0xff8040, 0xa02010, 0.9);
  // gold cracks / veins
  ctx.strokeStyle = rgba(0xffe066, 0.75);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, 20);
  ctx.quadraticCurveTo(24, 32, 18, 52);
  ctx.moveTo(40, 10);
  ctx.quadraticCurveTo(48, 30, 56, 50);
  ctx.moveTo(12, 48);
  ctx.quadraticCurveTo(32, 44, 54, 28);
  ctx.stroke();
  ctx.strokeStyle = rgba(0xff4020, 0.55);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(28, 8);
  ctx.lineTo(34, 56);
  ctx.moveTo(6, 36);
  ctx.lineTo(58, 40);
  ctx.stroke();
  // bright hot spots
  softDisk(ctx, 36, 30, 5, 4, 0xfff0a0, 0xffa040, 0.7);
  softDisk(ctx, 20, 42, 4, 3, 0xffe080, 0xff6020, 0.55);
}

/** Grey symmetrical dots & dashes on a tinted base (snow / ice / cave). */
function drawTintedBackdrop(ctx, s, base, mark) {
  fill(ctx, base, s);
  const step = 16;
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const cx = x + step / 2;
      const cy = y + step / 2;
      softDisk(ctx, cx, cy, 1.5, 1.5, mark, mark, 0.55);
      const odd = ((x / step) | 0) % 2 === ((y / step) | 0) % 2;
      ctx.strokeStyle = rgba(mark, 0.4);
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (odd) {
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
      } else {
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
      }
      ctx.stroke();
    }
  }
}

/** Screen / void backdrop — grey symmetrical dots & dashes */
function drawGrayBackdrop(ctx, s) {
  fill(ctx, 0x10161e, s);
  const step = 16;
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const cx = x + step / 2;
      const cy = y + step / 2;
      // center dot
      softDisk(ctx, cx, cy, 1.5, 1.5, 0x6a7480, 0x4a5460, 0.7);
      // mid-edge dots (symmetry)
      softDisk(ctx, x + step, cy, 1.1, 1.1, 0x4a5460, 0x3a4450, 0.35);
      softDisk(ctx, cx, y + step, 1.1, 1.1, 0x4a5460, 0x3a4450, 0.35);
      // alternating dashes
      const odd = ((x / step) | 0) % 2 === ((y / step) | 0) % 2;
      ctx.strokeStyle = rgba(0x7a8490, 0.38);
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (odd) {
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
      } else {
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
      }
      ctx.stroke();
    }
  }
}

/** Natural boulder from above — irregular soft mass */
function drawRock(ctx, s, v) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.52;
  const ink = 0x2a2824;
  const tones = [
    [0x7a7468, 0x5a5448],
    [0x8a8070, 0x6a6050],
    [0x6a655c, 0x4a453c]
  ][v % 3];

  softDisk(ctx, cx, cy, 28 + (v % 3) * 2, 22 + (v % 2) * 2, tones[0], tones[1]);
  softDisk(ctx, cx - 10, cy - 4, 14, 11, tones[0], tones[1], 0.9);
  softDisk(ctx, cx + 9, cy + 3, 12, 10, tones[1], 0x3a3830, 0.85);
  softDisk(ctx, cx - 4, cy - 8, 8, 5, 0xc8c0b0, tones[0], 0.35);

  ctx.strokeStyle = rgba(ink, 0.55);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 28 + (v % 3) * 2, 22 + (v % 2) * 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSnowRock(ctx, s, v) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.52;
  softDisk(ctx, cx, cy, 26 + v, 20 + v, 0xb0c0cc, 0x7a8894);
  softDisk(ctx, cx - 6, cy - 8, 16, 8, 0xffffff, 0xd0e0ec, 0.85);
  softDisk(ctx, cx + 8, cy + 4, 10, 8, 0x8a9aac, 0x6a7888, 0.7);
  ctx.strokeStyle = rgba(0x3a4a58, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 26 + v, 20 + v, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Top-down tree canopy */
function drawTree(ctx, s, v) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.5;
  softDisk(ctx, cx, cy + 2, 6, 6, 0x5a3a22, 0x3a2814);
  const r = 26 + (v % 3) * 3;
  softDisk(ctx, cx, cy, r, r * 0.92, 0x4a8a40, 0x2a5a28);
  softDisk(ctx, cx - 8, cy - 6, r * 0.42, r * 0.38, 0x6aaa58, 0x3a7a38, 0.8);
  softDisk(ctx, cx + 7, cy + 5, r * 0.36, r * 0.32, 0x2a5a28, 0x1a3a18, 0.55);
  softDisk(ctx, cx - 2, cy - 10, 7, 5, 0xffffff, 0x8aca70, 0.18);
}

function drawBush(ctx, s, v) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.55;
  softDisk(ctx, cx, cy, 22 + v * 2, 16 + v, 0x4a9a48, 0x2a6a30);
  softDisk(ctx, cx - 10, cy - 4, 12, 10, 0x5aaa58, 0x3a8a40, 0.85);
  softDisk(ctx, cx + 9, cy - 2, 11, 9, 0x3a8a40, 0x2a5a28, 0.8);
  softDisk(ctx, cx, cy - 8, 8, 6, 0x7aca68, 0x5aaa50, 0.5);
}

function drawCactus(ctx, s, v) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.5;
  // top-down cactus: round pads
  softDisk(ctx, cx, cy, 14, 14, 0x4a9a58, 0x2a6a38);
  softDisk(ctx, cx - 14, cy + 2, 10, 10, 0x3a8a48, 0x2a5a30);
  if (v === 0) softDisk(ctx, cx + 13, cy - 4, 9, 9, 0x3a8a48, 0x2a5a30);
  softDisk(ctx, cx - 2, cy - 3, 5, 4, 0x7aca80, 0x4a9a58, 0.4);
}

function drawCrate(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  const x = 18;
  const y = 20;
  ctx.fillStyle = hex(0x7a4a22);
  ctx.fillRect(x + 3, y + 4, 42, 36);
  ctx.fillStyle = hex(0xb8743a);
  ctx.fillRect(x, y, 42, 36);
  ctx.strokeStyle = hex(0x5a3418);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, 40, 34);
  ctx.beginPath();
  ctx.moveTo(x + 21, y);
  ctx.lineTo(x + 21, y + 36);
  ctx.moveTo(x, y + 18);
  ctx.lineTo(x + 42, y + 18);
  ctx.stroke();
}

function drawBarrel(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  softDisk(ctx, 48, 50, 18, 22, 0x5a82a8, 0x3a5a78);
  softDisk(ctx, 48, 38, 14, 6, 0x8ab0d0, 0x5a82a8, 0.7);
  ctx.strokeStyle = hex(0x2a4058);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 44);
  ctx.lineTo(64, 44);
  ctx.moveTo(32, 56);
  ctx.lineTo(64, 56);
  ctx.stroke();
}

function drawGrass(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = hex(0x4a9a48);
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const blades = [
    [14, 28, 12, 10],
    [20, 28, 20, 8],
    [26, 28, 28, 12]
  ];
  for (const [x0, y0, x1, y1] of blades) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawPebble(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  softDisk(ctx, 16, 16, 7, 5, 0xa09888, 0x6a6050, 0.85);
}

function drawSnowPatch(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  softDisk(ctx, 16, 16, 11, 7, 0xffffff, 0xd8e4f0, 0.7);
}

function drawPickupBlock(ctx, s, base, top, bot, drawIcon) {
  // full tile block (как стена 64×64)
  fill(ctx, base, s);
  ctx.fillStyle = hex(top);
  ctx.fillRect(5, 5, s - 10, 6);
  ctx.fillStyle = hex(bot);
  ctx.fillRect(5, s - 11, s - 10, 6);
  ctx.fillStyle = hex(bot);
  ctx.fillRect(5, 5, 6, s - 10);
  ctx.fillStyle = hex(top);
  ctx.fillRect(s - 11, 5, 6, s - 10);
  // black rim
  ctx.fillStyle = hex(0x050508);
  ctx.fillRect(0, 0, s, 5);
  ctx.fillRect(0, s - 5, s, 5);
  ctx.fillRect(0, 0, 5, s);
  ctx.fillRect(s - 5, 0, 5, s);
  ctx.strokeStyle = rgba(0x000000, 0.95);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  // icon plate
  softDisk(ctx, s * 0.5, s * 0.5, 22, 22, 0xffffff, 0xe8e8e8, 0.92);
  softDisk(ctx, s * 0.5, s * 0.5, 18, 18, top, base, 1);
  drawIcon(ctx, s);
}

function drawPickupHealth(ctx, s) {
  drawPickupBlock(ctx, s, 0xc02828, 0xff6060, 0x701414, (c, size) => {
    const m = size * 0.5;
    c.fillStyle = hex(0xffffff);
    c.fillRect(m - 5, m - 16, 10, 32);
    c.fillRect(m - 16, m - 5, 32, 10);
  });
}

function drawPickupArmor(ctx, s) {
  drawPickupBlock(ctx, s, 0x2860a8, 0x6a9adf, 0x183060, (c, size) => {
    const m = size * 0.5;
    c.fillStyle = hex(0xf0f6ff);
    c.beginPath();
    c.moveTo(m, m - 15);
    c.lineTo(m + 14, m - 4);
    c.lineTo(m + 14, m + 6);
    c.quadraticCurveTo(m, m + 18, m - 14, m + 6);
    c.lineTo(m - 14, m - 4);
    c.closePath();
    c.fill();
  });
}

function drawPickupStamina(ctx, s) {
  drawPickupBlock(ctx, s, 0xb07810, 0xf0c040, 0x604010, (c, size) => {
    const m = size * 0.5;
    c.fillStyle = hex(0xffffff);
    c.beginPath();
    c.moveTo(m + 9, m - 16);
    c.lineTo(m - 11, m + 1);
    c.lineTo(m + 1, m + 1);
    c.lineTo(m - 9, m + 16);
    c.lineTo(m + 13, m - 2);
    c.lineTo(m + 1, m - 2);
    c.closePath();
    c.fill();
  });
}

function drawPickupAmmo(ctx, s) {
  drawPickupBlock(ctx, s, 0x3a8040, 0x6adf6a, 0x204828, (c, size) => {
    const m = size * 0.5;
    c.fillStyle = hex(0xf4ffe8);
    // ammo box
    c.fillRect(m - 12, m - 8, 24, 16);
    c.fillStyle = hex(0x1a4020);
    c.fillRect(m - 10, m - 5, 8, 10);
    c.fillRect(m + 2, m - 5, 8, 10);
    c.fillStyle = hex(0xffffff);
    c.fillRect(m - 8, m - 2, 4, 4);
    c.fillRect(m + 4, m - 2, 4, 4);
  });
}

/** Simple gray bullet — oriented along +X when rotated. */
function drawBulletTracer(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  const cy = s * 0.5;
  const cx = s * 0.55;
  // soft shadow
  ctx.fillStyle = rgba(0x000000, 0.2);
  ctx.beginPath();
  ctx.ellipse(cx + 1, cy + 1, s * 0.28, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // gray body
  ctx.fillStyle = "#7a8088";
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.28, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b0b6bc";
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 0.6, s * 0.16, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // tip
  ctx.fillStyle = "#d0d4d8";
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.18, cy, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawKnifeWeapon(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const cy = s * 0.72;
  softDisk(ctx, cx, cy - 2, 6, 18, 0x000000, 0x000000, 0.22);
  // handle
  softDisk(ctx, cx, cy + 6, 3.2, 7.5, 0x7a5230, 0x3a2414);
  ctx.fillStyle = hex(0x5a3a22);
  ctx.fillRect(cx - 3, cy - 1, 6, 14);
  // pommel
  softDisk(ctx, cx, cy + 14, 3.4, 2.4, 0x8a6040, 0x4a3018);
  // guard
  softDisk(ctx, cx, cy - 3.5, 8, 2.4, 0xe8d080, 0x8a7030);
  ctx.fillStyle = hex(0xc0a050);
  ctx.fillRect(cx - 7, cy - 5, 14, 3);
  // blade
  ctx.beginPath();
  ctx.moveTo(cx - 4.2, cy - 5);
  ctx.lineTo(cx - 3, cy - 28);
  ctx.quadraticCurveTo(cx, cy - 38, cx + 3, cy - 28);
  ctx.lineTo(cx + 4.2, cy - 5);
  ctx.closePath();
  const blade = ctx.createLinearGradient(cx - 6, cy - 20, cx + 6, cy - 20);
  blade.addColorStop(0, "#7a848c");
  blade.addColorStop(0.4, "#e8eef4");
  blade.addColorStop(0.55, "#ffffff");
  blade.addColorStop(1, "#5a646c");
  ctx.fillStyle = blade;
  ctx.fill();
  ctx.strokeStyle = rgba(0x12161c, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = rgba(0xffffff, 0.7);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - 1, cy - 8);
  ctx.lineTo(cx - 0.3, cy - 31);
  ctx.stroke();
}

function drawSlashArc(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  const c = s * 0.5;
  ctx.save();
  ctx.translate(c, c);
  // crescent slash
  for (let i = 0; i < 5; i++) {
    const a0 = -0.95 + i * 0.08;
    const a1 = 0.55 + i * 0.05;
    const r = 28 + i * 2.5;
    const alpha = 0.12 + (1 - i / 5) * 0.22;
    ctx.strokeStyle = rgba(0xffffff, alpha);
    ctx.lineWidth = 7 - i * 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(0xffe8a8, 0.55);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 34, -0.7, 0.55);
  ctx.stroke();
  ctx.strokeStyle = rgba(0xffffff, 0.85);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 36, -0.35, 0.35);
  ctx.stroke();
  ctx.restore();
}

/** Epic stone grave with weathered cross (client-side death marker). */
function drawGrave(ctx, s) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;

  // cracked earth ring
  softDisk(ctx, cx, s * 0.78, 28, 12, 0x2a2218, 0x12100c, 0.55);
  ctx.strokeStyle = rgba(0x1a140e, 0.45);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 8, s * 0.76 + Math.sin(a) * 3);
    ctx.lineTo(cx + Math.cos(a) * 24, s * 0.78 + Math.sin(a) * 9);
    ctx.stroke();
  }

  // burial mound
  softDisk(ctx, cx, s * 0.74, 24, 11, 0x4a3a28, 0x2a1e14, 0.98);
  softDisk(ctx, cx - 8, s * 0.72, 10, 6, 0x5a4a34, 0x3a2e1c, 0.55);
  softDisk(ctx, cx + 7, s * 0.73, 9, 5, 0x3a2e1c, 0x1a140e, 0.45);
  softDisk(ctx, cx + 2, s * 0.82, 18, 5, 0x000000, 0x000000, 0.22);

  // stone base slab
  ctx.fillStyle = hex(0x5a5e66);
  ctx.fillRect(cx - 16, s * 0.62, 32, 10);
  ctx.strokeStyle = rgba(0x12141a, 0.75);
  ctx.lineWidth = 1.8;
  ctx.strokeRect(cx - 16, s * 0.62, 32, 10);
  softDisk(ctx, cx - 4, s * 0.64, 8, 2.5, 0x8a8e96, 0x5a5e66, 0.35);

  // stone cross — vertical
  const postX = cx - 4.5;
  const postY = s * 0.12;
  ctx.fillStyle = hex(0x6a7078);
  ctx.fillRect(postX, postY, 9, s * 0.55);
  ctx.strokeStyle = rgba(0x101218, 0.8);
  ctx.lineWidth = 2;
  ctx.strokeRect(postX, postY, 9, s * 0.55);
  ctx.fillStyle = rgba(0xc8d0d8, 0.28);
  ctx.fillRect(cx - 2.5, postY + 4, 2.5, s * 0.42);
  ctx.strokeStyle = rgba(0x2a2e36, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 1, postY + 10);
  ctx.lineTo(cx + 0.5, postY + s * 0.4);
  ctx.stroke();

  // stone cross — horizontal beam
  ctx.fillStyle = hex(0x7a8088);
  ctx.fillRect(cx - 17, s * 0.26, 34, 9);
  ctx.strokeStyle = rgba(0x101218, 0.8);
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 17, s * 0.26, 34, 9);
  ctx.fillStyle = rgba(0xd0d6de, 0.3);
  ctx.fillRect(cx - 15, s * 0.275, 30, 2.5);

  // dark metal rivets
  for (const [rx, ry] of [
    [cx - 14, s * 0.305],
    [cx + 14, s * 0.305],
    [cx, s * 0.305],
    [cx, s * 0.55]
  ]) {
    softDisk(ctx, rx, ry, 1.6, 1.6, 0x2a2e34, 0x0a0c10, 0.95);
    softDisk(ctx, rx - 0.4, ry - 0.4, 0.6, 0.6, 0x8a9098, 0x4a5058, 0.5);
  }

  // faint spectral glow behind cross
  softDisk(ctx, cx, s * 0.38, 14, 18, 0x6a88aa, 0x203040, 0.16);
  softDisk(ctx, cx, s * 0.22, 6, 6, 0xa8c8e8, 0x406080, 0.12);

  // skull emblem at cross center
  softDisk(ctx, cx, s * 0.305, 4.2, 3.6, 0xd8d0c0, 0x8a8070, 0.95);
  softDisk(ctx, cx - 1.6, s * 0.3, 1.1, 1.2, 0x1a1410, 0x1a1410, 0.95);
  softDisk(ctx, cx + 1.6, s * 0.3, 1.1, 1.2, 0x1a1410, 0x1a1410, 0.95);
  softDisk(ctx, cx, s * 0.33, 1.4, 0.9, 0x1a1410, 0x1a1410, 0.7);

  // corner stones
  softDisk(ctx, cx - 18, s * 0.7, 5, 3.5, 0x5a5e66, 0x3a3e46, 0.9);
  softDisk(ctx, cx + 17, s * 0.71, 4.5, 3.2, 0x6a6e76, 0x4a4e56, 0.85);
  softDisk(ctx, cx + 12, s * 0.68, 3.5, 2.5, 0x4a4e56, 0x2a2e36, 0.7);
}

let _meleeKit = null;
export function getMeleeKit(renderer) {
  if (_meleeKit) return _meleeKit;
  _meleeKit = {
    knife: canvasTex(renderer, (ctx, s) => drawKnifeWeapon(ctx, s), 64, true),
    slash: canvasTex(renderer, (ctx, s) => drawSlashArc(ctx, s), 96, true)
  };
  return _meleeKit;
}

export function createTextures(renderer) {
  const patterned = {
    forest: drawGrassFloor,
    grass: drawGrassFloor,
    outdoor: drawGrassFloor,
    courtyard: drawGrassFloor,
    oasis: drawGrassFloor,
    desert: drawDesertFloor,
    living: drawDesertFloor,
    lava: drawLavaFloor,
    arena: drawLavaFloor,
    snow: (ctx, s) => drawTintedBackdrop(ctx, s, 0xc8d4e0, 0x8a98a8),
    ice: (ctx, s) => drawTintedBackdrop(ctx, s, 0x7ab8d8, 0x5a88a8),
    cave: (ctx, s) => drawTintedBackdrop(ctx, s, 0x222830, 0x6a7480),
    hall: (ctx, s) => drawTintedBackdrop(ctx, s, 0x222830, 0x6a7480)
  };

  const floors = {};
  for (const [name, color] of Object.entries(FLOOR_COLORS)) {
    if (patterned[name]) {
      floors[name] = canvasTex(renderer, (ctx, s) => patterned[name](ctx, s), 64);
    } else {
      floors[name] = color >>> 0;
    }
  }

  const walls = {};
  for (const [name, pal] of Object.entries(WALL_STYLES)) {
    walls[name] = [
      canvasTex(
        renderer,
        (ctx, s) => {
          solidWall(ctx, s, pal.base, pal.top, pal.bot, pal.pattern);
        },
        64
      )
    ];
  }

  const rock = [0, 1, 2].map((v) => canvasTex(renderer, (ctx, s) => drawRock(ctx, s, v)));
  const snowrock = [0, 1].map((v) => canvasTex(renderer, (ctx, s) => drawSnowRock(ctx, s, v)));
  const tree = [0, 1, 2].map((v) => canvasTex(renderer, (ctx, s) => drawTree(ctx, s, v)));
  const bush = [0, 1].map((v) => canvasTex(renderer, (ctx, s) => drawBush(ctx, s, v)));
  const cactus = [0, 1].map((v) => canvasTex(renderer, (ctx, s) => drawCactus(ctx, s, v)));
  const backdrop = canvasTex(renderer, (ctx, s) => drawGrayBackdrop(ctx, s), 64);

  return {
    floors,
    walls,
    backdrop,
    wall: walls.steel[0],
    wallCave: walls.dark[0],
    wallForest: walls.concrete[0],
    wallSnow: walls.slate[0],
    wallCity: walls.steel[0],
    rock,
    snowrock,
    tree,
    bush,
    plant: bush,
    cactus,
    crate: [canvasTex(renderer, (ctx, s) => drawCrate(ctx, s))],
    barrel: [canvasTex(renderer, (ctx, s) => drawBarrel(ctx, s))],
    desk: [canvasTex(renderer, (ctx, s) => drawCrate(ctx, s))],
    lamp: [canvasTex(renderer, (ctx, s) => drawBarrel(ctx, s))],
    stalagmite: rock,
    pebble: [canvasTex(renderer, (ctx, s) => drawPebble(ctx, s), 32)],
    grass: [canvasTex(renderer, (ctx, s) => drawGrass(ctx, s), 32)],
    snowpatch: [canvasTex(renderer, (ctx, s) => drawSnowPatch(ctx, s), 32)],
    pickupHealth: canvasTex(renderer, (ctx, s) => drawPickupHealth(ctx, s), 64),
    pickupArmor: canvasTex(renderer, (ctx, s) => drawPickupArmor(ctx, s), 64),
    pickupStamina: canvasTex(renderer, (ctx, s) => drawPickupStamina(ctx, s), 64),
    pickupAmmo: canvasTex(renderer, (ctx, s) => drawPickupAmmo(ctx, s), 64),
    bullet: canvasTex(renderer, (ctx, s) => drawBulletTracer(ctx, s), 24),
    grave: canvasTex(renderer, (ctx, s) => drawGrave(ctx, s), 96, true)
  };
}

export function createLightConeTexture(renderer, range, angle) {
  const g = new PIXI.Graphics();
  const half = angle / 2;
  g.beginFill(0xffe9a8, 0.22);
  g.moveTo(0, range);
  g.arc(0, range, range, -half, half);
  g.closePath();
  g.endFill();
  return renderer.generateTexture(g, {
    scaleMode: PIXI.SCALE_MODES.LINEAR,
    resolution: 1,
    region: new PIXI.Rectangle(-range, 0, range * 2, range * 2)
  });
}
