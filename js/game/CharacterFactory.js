/* global PIXI */

/** Art is drawn facing +Y; runtime rotates the sprite for smooth aim. */
export function dirFromAngle(angle) {
  return angle;
}

/** Keep angle in (-PI, PI] — avoids unbounded drift while spinning. */
export function normalizeAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function angleLerp(from, to, t) {
  return normalizeAngle(from + angleDelta(from, to) * t);
}

export { angleLerp, angleDelta };

/**
 * Diverse top-down cast: soldiers + cute pink girls + stylish variants.
 * style: "soldier" | "girl" | "tech"
 */
const PALETTES = [
  // hero soldiers
  {
    id: "olive_soldier",
    style: "soldier",
    armor: 0x5a7a42,
    armorMid: 0x74a05a,
    armorDark: 0x3a522c,
    armorDeep: 0x2a3a22,
    pack: 0x4ecf5a,
    packMid: 0x36b048,
    packDark: 0x248034,
    hair: 0x5a3a22,
    hairHi: 0x7a5030,
    skin: 0xe8b888,
    skinDark: 0xc99462,
    accent: 0x8aaa62,
    accentDark: 0x5a7a42,
    helm: 0x3a4840,
    helmMid: 0x5a6c62,
    helmHi: 0x7e9086,
    glove: 0x1e2228,
    gun: 0x2a3038,
    gunDark: 0x14181e,
    gunHi: 0x4a5560,
    outline: 0x0a0c10,
    detail: 0xe04040
  },
  {
    id: "steel_soldier",
    style: "soldier",
    armor: 0x4a5c6e,
    armorMid: 0x6284a0,
    armorDark: 0x334050,
    armorDeep: 0x222c38,
    pack: 0x4a9adf,
    packMid: 0x3a7abb,
    packDark: 0x2a5a88,
    hair: 0x2a2a30,
    hairHi: 0x404048,
    skin: 0xe8b888,
    skinDark: 0xc99462,
    accent: 0x7a90a8,
    accentDark: 0x4a6078,
    helm: 0x3a4654,
    helmMid: 0x5a6c78,
    helmHi: 0x7e909c,
    glove: 0x1e2228,
    gun: 0x2a3038,
    gunDark: 0x14181e,
    gunHi: 0x4a5560,
    outline: 0x0a0c10,
    detail: 0xe04040
  },
  // cute pink girls
  {
    id: "pink_girl",
    style: "girl",
    armor: 0xff7ab8,
    armorMid: 0xff9ad0,
    armorDark: 0xe05098,
    armorDeep: 0xb03878,
    pack: 0xffb0e0,
    packMid: 0xff8ac8,
    packDark: 0xe068b0,
    hair: 0xff6eb4,
    hairHi: 0xffa0d0,
    skin: 0xffd2b8,
    skinDark: 0xf0b090,
    accent: 0xffffff,
    accentDark: 0xffd0ea,
    helm: 0xff8ac8,
    helmMid: 0xffa8d8,
    helmHi: 0xffc8ea,
    glove: 0xffffff,
    gun: 0x5a4a60,
    gunDark: 0x2a2030,
    gunHi: 0x8a7a90,
    outline: 0x3a2040,
    detail: 0xff4da6,
    bow: 0xff4da6
  },
  {
    id: "rose_girl",
    style: "girl",
    armor: 0xf06090,
    armorMid: 0xff80b0,
    armorDark: 0xc04070,
    armorDeep: 0x902850,
    pack: 0xff90c0,
    packMid: 0xff70a8,
    packDark: 0xd05088,
    hair: 0xc04080,
    hairHi: 0xe070a8,
    skin: 0xffd0b8,
    skinDark: 0xe8b090,
    accent: 0xffe0f0,
    accentDark: 0xffb0d0,
    helm: 0xe06098,
    helmMid: 0xf080b0,
    helmHi: 0xffa8d0,
    glove: 0xffe8f4,
    gun: 0x4a3a50,
    gunDark: 0x241828,
    gunHi: 0x7a6a80,
    outline: 0x301828,
    detail: 0xff66aa,
    bow: 0xffffff
  },
  {
    id: "sakura_girl",
    style: "girl",
    armor: 0xff9ac8,
    armorMid: 0xffbddc,
    armorDark: 0xe878b0,
    armorDeep: 0xc05890,
    pack: 0xffcce8,
    packMid: 0xffa8d4,
    packDark: 0xf080c0,
    hair: 0xff8ad0,
    hairHi: 0xffb8e8,
    skin: 0xffe0cc,
    skinDark: 0xf0c0a0,
    accent: 0xffffff,
    accentDark: 0xffe8f4,
    helm: 0xffa0d4,
    helmMid: 0xffbce4,
    helmHi: 0xffdaf0,
    glove: 0xffffff,
    gun: 0x6a5a72,
    gunDark: 0x322838,
    gunHi: 0x9a8aa2,
    outline: 0x402838,
    detail: 0xff79c0,
    bow: 0xff79c0
  },
  {
    id: "lavender_girl",
    style: "girl",
    armor: 0xd080e8,
    armorMid: 0xe8a8ff,
    armorDark: 0xa858c8,
    armorDeep: 0x784098,
    pack: 0xf0c0ff,
    packMid: 0xd890f0,
    packDark: 0xb068d0,
    hair: 0xb868e0,
    hairHi: 0xd898f8,
    skin: 0xffd8c8,
    skinDark: 0xf0b8a0,
    accent: 0xffffff,
    accentDark: 0xf0d8ff,
    helm: 0xc878e8,
    helmMid: 0xd898f8,
    helmHi: 0xe8b8ff,
    glove: 0xffffff,
    gun: 0x504060,
    gunDark: 0x281830,
    gunHi: 0x807090,
    outline: 0x302040,
    detail: 0xc060ff,
    bow: 0xffffff
  },
  // stylish / tech
  {
    id: "cyan_tech",
    style: "tech",
    armor: 0x3a8aaa,
    armorMid: 0x5ab0d0,
    armorDark: 0x286878,
    armorDeep: 0x1a4858,
    pack: 0x40e0ff,
    packMid: 0x28c0e0,
    packDark: 0x1890b0,
    hair: 0x1a3040,
    hairHi: 0x3a5060,
    skin: 0xe8b888,
    skinDark: 0xc99462,
    accent: 0xa0f0ff,
    accentDark: 0x50c0e0,
    helm: 0x2a5060,
    helmMid: 0x3a7080,
    helmHi: 0x5a98a8,
    glove: 0x1e3038,
    gun: 0x2a3840,
    gunDark: 0x101820,
    gunHi: 0x4a6068,
    outline: 0x0a1820,
    detail: 0x40e0ff
  },
  {
    id: "gold_merc",
    style: "soldier",
    armor: 0xb89440,
    armorMid: 0xd4b058,
    armorDark: 0x806828,
    armorDeep: 0x584818,
    pack: 0xffd24a,
    packMid: 0xe0b030,
    packDark: 0xa88020,
    hair: 0x6b4228,
    hairHi: 0x8a5a38,
    skin: 0xe8b888,
    skinDark: 0xc99462,
    accent: 0xffe090,
    accentDark: 0xc0a040,
    helm: 0x6a5830,
    helmMid: 0x8a7848,
    helmHi: 0xb0a068,
    glove: 0x2a2418,
    gun: 0x3a3428,
    gunDark: 0x1a1810,
    gunHi: 0x5a5440,
    outline: 0x18140a,
    detail: 0xff4d4d
  },
  {
    id: "mint_girl",
    style: "girl",
    armor: 0x6ad8b0,
    armorMid: 0x8aecc8,
    armorDark: 0x40b088,
    armorDeep: 0x288068,
    pack: 0xa0f0d0,
    packMid: 0x70d8b0,
    packDark: 0x48b090,
    hair: 0x40c8a0,
    hairHi: 0x70e0c0,
    skin: 0xffd8c4,
    skinDark: 0xf0b8a0,
    accent: 0xffffff,
    accentDark: 0xd8fff0,
    helm: 0x58d0a8,
    helmMid: 0x78e4c0,
    helmHi: 0xa0f4d8,
    glove: 0xffffff,
    gun: 0x3a5050,
    gunDark: 0x182828,
    gunHi: 0x6a8080,
    outline: 0x183830,
    detail: 0x40e0b0,
    bow: 0xffffff
  },
  {
    id: "noir_ops",
    style: "tech",
    armor: 0x3a3a48,
    armorMid: 0x585868,
    armorDark: 0x282834,
    armorDeep: 0x181820,
    pack: 0x6a6a80,
    packMid: 0x505068,
    packDark: 0x383850,
    hair: 0x1a1a22,
    hairHi: 0x303040,
    skin: 0xd9a878,
    skinDark: 0xc09060,
    accent: 0x90a0c0,
    accentDark: 0x506080,
    helm: 0x2a2a38,
    helmMid: 0x404050,
    helmHi: 0x606078,
    glove: 0x121218,
    gun: 0x222230,
    gunDark: 0x0a0a10,
    gunHi: 0x404050,
    outline: 0x000000,
    detail: 0xff4050
  }
];

const W = 128;
const H = 128;

function hexCss(c) {
  return `#${(c >>> 0).toString(16).padStart(6, "0")}`;
}

function rgba(c, a) {
  const n = c >>> 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function softDisk(ctx, x, y, rx, ry, c0, c1, alpha = 1) {
  const r = Math.max(rx, ry, 0.5);
  const g = ctx.createRadialGradient(x - rx * 0.25, y - ry * 0.3, r * 0.08, x, y, r);
  g.addColorStop(0, rgba(c0, alpha));
  g.addColorStop(0.7, rgba(c1, alpha));
  g.addColorStop(1, rgba(c1, alpha));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokeEllipse(ctx, x, y, rx, ry, color, lw = 2.4) {
  ctx.strokeStyle = hexCss(color);
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function fillCapsule(ctx, x0, y0, x1, y1, radius, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.fillStyle = hexCss(color);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * radius, y0 + ny * radius);
  ctx.arc(x0, y0, radius, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
  ctx.lineTo(x1 - nx * radius, y1 - ny * radius);
  ctx.arc(x1, y1, radius, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
  ctx.closePath();
  ctx.fill();
}

function strokeCapsule(ctx, x0, y0, x1, y1, radius, color, lw = 2.2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.strokeStyle = hexCss(color);
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0 + nx * radius, y0 + ny * radius);
  ctx.arc(x0, y0, radius, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
  ctx.lineTo(x1 - nx * radius, y1 - ny * radius);
  ctx.arc(x1, y1, radius, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
  ctx.closePath();
  ctx.stroke();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Human top-down cast:
 * man  — broad shoulders, short hair + cap, thicker arms
 * woman — narrower shoulders, long hair, softer body, slim arms
 * Head = crown only. Legs at the back (no backpack — so steps read clearly).
 */
function drawCharacterCanvas(ctx, pal, frame, opts = {}) {
  const action = opts.melee || opts.dash || opts.reload;
  const bob = action ? 0 : frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const sway = action ? 0 : [0, 1, 0, -1][frame % 4];
  const cx = 64 + sway;
  const cy = 58 + bob;
  const woman = pal.style === "girl";
  const tech = pal.style === "tech";
  const ink = pal.outline || 0x0a0c10;

  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ---- LEGS (under torso, below head; drawn first so body sits on top) ----
  const pant = pal.pants || pal.armorDark;
  const boot = pal.boot || pal.armorDeep || 0x1a1c22;
  const bootHi = pal.bootHi || pal.armorDark || 0x2a2e36;
  const legSpread = woman ? 12 : 14;
  const legStride = action ? 0 : [0, 8, 0, -8][frame % 4];
  // below head (hy≈cy-2): sit under torso toward +Y, peek at sides
  const legBaseY = cy + 10;
  const rearLegs = [
    { x: cx - legSpread, y: legBaseY - legStride, kick: -legStride },
    { x: cx + legSpread, y: legBaseY + legStride, kick: legStride }
  ];
  for (const leg of rearLegs) {
    softDisk(ctx, leg.x, leg.y, woman ? 5 : 6, woman ? 6.5 : 7.5, pant, ink, 0.95);
    strokeEllipse(ctx, leg.x, leg.y, woman ? 5 : 6, woman ? 6.5 : 7.5, ink, 1.5);
    // boot a bit further back (−Y) but still under the head
    const by = leg.y - 4 + leg.kick * 0.35;
    softDisk(ctx, leg.x, by, woman ? 4.4 : 5.4, woman ? 5.4 : 6.4, bootHi, boot);
    strokeEllipse(ctx, leg.x, by, woman ? 4.4 : 5.4, woman ? 5.4 : 6.4, ink, 1.6);
    softDisk(ctx, leg.x - 0.6, by - 1.2, 1.6, 2, 0xffffff, bootHi, 0.2);
  }

  // ---- TORSO (no backpack) ----
  const shoulderRx = woman ? 19.5 : 24.5;
  const shoulderRy = woman ? 13 : 15.5;
  strokeEllipse(ctx, cx, cy + 2, shoulderRx + 0.7, shoulderRy + 0.7, ink, 2.7);
  softDisk(ctx, cx, cy + 2, shoulderRx, shoulderRy, pal.armorMid, pal.armorDark);
  softDisk(ctx, cx, cy + 1, shoulderRx - 4.5, shoulderRy - 3.5, pal.armor, pal.armorDark);
  softDisk(ctx, cx + 3, cy - 2, 7, 5, 0xffffff, pal.armorMid, 0.11);

  // neck
  softDisk(ctx, cx, cy - 6, woman ? 4.2 : 5, 3.2, pal.skin, pal.skinDark);
  strokeEllipse(ctx, cx, cy - 6, woman ? 4.2 : 5, 3.2, ink, 1.4);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, shoulderRx, shoulderRy, 0, 0, Math.PI * 2);
  ctx.clip();
  if (woman) {
    // soft blouse / vest
    softDisk(ctx, cx, cy + 1, 8, 7, pal.accent, pal.accentDark, 0.4);
    ctx.strokeStyle = rgba(pal.accentDark, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 2);
    ctx.quadraticCurveTo(cx, cy + 6, cx + 6, cy + 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = rgba(ink, 0.35);
    ctx.lineWidth = 1.25;
    ctx.strokeRect(cx - 19, cy - 2, 7, 5);
    ctx.strokeRect(cx + 12, cy - 2, 7, 5);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();
    if (tech) softDisk(ctx, cx, cy + 4, 3.5, 2.8, pal.detail, pal.accent, 0.85);
  }
  ctx.restore();

  // ---- HEAD ----
  const hx = cx;
  const hy = cy - 2;

  if (woman) {
    // long hair halo first (behind head), human woman cue
    softDisk(ctx, hx, hy - 1, 14, 12, pal.hair, pal.hair, 0.95);
    softDisk(ctx, hx - 11, hy + 4, 5, 8, pal.hairHi, pal.hair);
    softDisk(ctx, hx + 11, hy + 4, 5, 8, pal.hairHi, pal.hair);
    softDisk(ctx, hx - 9, hy + 10, 4, 6, pal.hair, pal.hairHi, 0.9);
    softDisk(ctx, hx + 9, hy + 10, 4, 6, pal.hair, pal.hairHi, 0.9);
    // shorter back hair so rear boots stay visible
    softDisk(ctx, hx, hy - 5, 5, 3, pal.hairHi, pal.hair, 0.75);
    strokeEllipse(ctx, hx, hy - 1, 14, 12, ink, 2.2);

    // skull / crown
    strokeEllipse(ctx, hx, hy, 9.5, 8.8, ink, 2.3);
    softDisk(ctx, hx, hy, 8.8, 8.1, pal.skin, pal.skinDark);
    // hair top with parting
    softDisk(ctx, hx, hy - 1.5, 8.6, 7.2, pal.hairHi, pal.hair);
    softDisk(ctx, hx - 3, hy - 3, 3.5, 2.5, pal.hairHi, pal.hair, 0.85);
    softDisk(ctx, hx + 3, hy - 3, 3.5, 2.5, pal.hairHi, pal.hair, 0.85);
    ctx.strokeStyle = rgba(ink, 0.35);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 7);
    ctx.lineTo(hx, hy - 1);
    ctx.stroke();
    // ears
    softDisk(ctx, hx - 9, hy + 1, 2.1, 2.5, pal.skin, pal.skinDark);
    softDisk(ctx, hx + 9, hy + 1, 2.1, 2.5, pal.skin, pal.skinDark);
    strokeEllipse(ctx, hx - 9, hy + 1, 2.1, 2.5, ink, 1.3);
    strokeEllipse(ctx, hx + 9, hy + 1, 2.1, 2.5, ink, 1.3);
    // small bow / clip
    const bow = pal.bow || pal.detail;
    softDisk(ctx, hx + 5, hy - 7, 2.4, 1.5, bow, ink, 0.95);
    softDisk(ctx, hx + 5, hy - 7, 1.2, 0.8, pal.accent, bow);
  } else {
    // short hair ring under / around cap
    softDisk(ctx, hx, hy + 1, 11, 9.5, pal.hair, pal.hairHi, 0.95);
    strokeEllipse(ctx, hx, hy + 1, 11, 9.5, ink, 1.8);

    // male head / cap
    strokeEllipse(ctx, hx, hy, 10, 9, ink, 2.4);
    softDisk(ctx, hx, hy, 9.2, 8.2, pal.helmMid, pal.helm);
    softDisk(ctx, hx, hy - 2.2, 5.8, 4.2, pal.helmHi, pal.helmMid, 0.88);
    softDisk(ctx, hx - 1, hy - 3.2, 2.8, 1.8, 0xffffff, pal.helmHi, 0.14);
    // short hair peek at sides under cap
    softDisk(ctx, hx - 7, hy + 3, 2.5, 2, pal.hair, pal.hairHi);
    softDisk(ctx, hx + 7, hy + 3, 2.5, 2, pal.hair, pal.hairHi);
    // forward brim
    ctx.beginPath();
    ctx.ellipse(hx, hy + 5.2, 6.8, 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = hexCss(pal.helm);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ears
    softDisk(ctx, hx - 10, hy + 1.2, 2.3, 2.7, pal.skin, pal.skinDark);
    softDisk(ctx, hx + 10, hy + 1.2, 2.3, 2.7, pal.skin, pal.skinDark);
    strokeEllipse(ctx, hx - 10, hy + 1.2, 2.3, 2.7, ink, 1.35);
    strokeEllipse(ctx, hx + 10, hy + 1.2, 2.3, 2.7, ink, 1.35);
    if (tech) softDisk(ctx, hx, hy, 2, 1.4, pal.detail, pal.accent, 0.75);
  }

  // ---- ARMS ----
  const handY = cy + 26;
  const armSpread = woman ? 15.5 : 18.5;
  const armW = woman ? 3.6 : 5.1;
  const sleeveColor = pal.armor;
  const sleeveDark = pal.armorDark;
  const skinArm = woman || tech;
  const handFill = woman ? pal.skin : pal.glove;
  const handShade = woman ? pal.skinDark : ink;

  let leftShoulder = { x: cx - armSpread, y: cy + 5 };
  let rightShoulder = { x: cx + armSpread, y: cy + 5 };
  let leftElbow = { x: cx - (woman ? 10 : 12), y: cy + 15 };
  let rightElbow = { x: cx + (woman ? 10 : 12), y: cy + 15 };
  let leftHand = { x: cx - 4, y: handY };
  let rightHand = { x: cx + 4, y: handY };
  let knifeAng = Math.PI / 2; // +Y forward in base pose
  let showKnife = false;
  let holdGunAt = null; // { x, y, ang } when gun follows hands

  if (opts.melee) {
    // slash poses: wind-up → swing → impact → follow-through (forward = +Y)
    const mf = opts.meleeFrame | 0;
    const poses = [
      // 0 wind-up: knife back-right
      { re: { x: cx + 22, y: cy + 2 }, rh: { x: cx + 28, y: cy - 4 }, le: { x: cx - 8, y: cy + 18 }, lh: { x: cx - 2, y: cy + 24 }, k: -0.35 },
      // 1 start cut: coming across
      { re: { x: cx + 18, y: cy + 14 }, rh: { x: cx + 24, y: cy + 22 }, le: { x: cx - 10, y: cy + 16 }, lh: { x: cx - 6, y: cy + 22 }, k: 0.55 },
      // 2 impact: arm stretched forward with knife
      { re: { x: cx + 6, y: cy + 18 }, rh: { x: cx + 2, y: cy + 34 }, le: { x: cx - 14, y: cy + 12 }, lh: { x: cx - 10, y: cy + 20 }, k: 1.15 },
      // 3 follow-through: left-forward
      { re: { x: cx - 4, y: cy + 16 }, rh: { x: cx - 18, y: cy + 28 }, le: { x: cx - 16, y: cy + 10 }, lh: { x: cx - 14, y: cy + 18 }, k: 2.35 }
    ];
    const p = poses[Math.max(0, Math.min(3, mf))];
    rightElbow = p.re;
    rightHand = p.rh;
    leftElbow = p.le;
    leftHand = p.lh;
    knifeAng = p.k;
    showKnife = true;
    leftShoulder.x += mf >= 2 ? -2 : 1;
    rightShoulder.x += mf >= 2 ? -1 : 2;
  } else if (opts.dash) {
    // dash poses: crouch → launch → stretch → land (forward = +Y)
    const df = opts.dashFrame | 0;
    const poses = [
      { re: { x: cx + 14, y: cy + 10 }, rh: { x: cx + 10, y: cy + 22 }, le: { x: cx - 14, y: cy + 10 }, lh: { x: cx - 6, y: cy + 20 } },
      { re: { x: cx + 16, y: cy + 8 }, rh: { x: cx + 8, y: cy + 26 }, le: { x: cx - 16, y: cy + 6 }, lh: { x: cx - 4, y: cy + 22 } },
      { re: { x: cx + 10, y: cy + 16 }, rh: { x: cx + 4, y: cy + 32 }, le: { x: cx - 10, y: cy + 14 }, lh: { x: cx - 2, y: cy + 28 } },
      { re: { x: cx + 12, y: cy + 12 }, rh: { x: cx + 6, y: cy + 24 }, le: { x: cx - 12, y: cy + 10 }, lh: { x: cx - 4, y: cy + 22 } }
    ];
    const p = poses[Math.max(0, Math.min(3, df))];
    rightElbow = p.re;
    rightHand = p.rh;
    leftElbow = p.le;
    leftHand = p.lh;
    leftShoulder.y += df === 2 ? 2 : 0;
    rightShoulder.y += df === 2 ? 2 : 0;
    // two-hand grip: gun between hands, muzzle forward (+Y)
    holdGunAt = {
      x: (leftHand.x + rightHand.x) * 0.5,
      y: (leftHand.y + rightHand.y) * 0.5 + 2,
      ang: Math.PI / 2
    };
    // speed lines behind (toward -Y)
    ctx.strokeStyle = rgba(0xffffff, 0.35 + df * 0.08);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const lx = cx - 16 + i * 8;
      const ly0 = cy - 8 - df * 3;
      ctx.beginPath();
      ctx.moveTo(lx, ly0);
      ctx.lineTo(lx - 2, ly0 - 14 - df * 4);
      ctx.stroke();
    }
  } else if (opts.reload) {
    // reload: tilt gun, hands to mag well
    const rf = opts.reloadFrame | 0;
    const poses = [
      { re: { x: cx + 10, y: cy + 12 }, rh: { x: cx + 6, y: cy + 22 }, le: { x: cx - 6, y: cy + 14 }, lh: { x: cx + 2, y: cy + 20 }, ang: 0.95 },
      { re: { x: cx + 12, y: cy + 10 }, rh: { x: cx + 8, y: cy + 18 }, le: { x: cx - 2, y: cy + 16 }, lh: { x: cx + 8, y: cy + 16 }, ang: 0.7 },
      { re: { x: cx + 11, y: cy + 11 }, rh: { x: cx + 7, y: cy + 19 }, le: { x: cx + 0, y: cy + 15 }, lh: { x: cx + 10, y: cy + 14 }, ang: 0.55 },
      { re: { x: cx + 10, y: cy + 12 }, rh: { x: cx + 5, y: cy + 24 }, le: { x: cx - 4, y: cy + 14 }, lh: { x: cx + 2, y: cy + 22 }, ang: 1.05 }
    ];
    const p = poses[Math.max(0, Math.min(3, rf))];
    rightElbow = p.re;
    rightHand = p.rh;
    leftElbow = p.le;
    leftHand = p.lh;
    holdGunAt = {
      x: (leftHand.x + rightHand.x) * 0.5,
      y: (leftHand.y + rightHand.y) * 0.5,
      ang: p.ang
    };
  }
  // walk: arms stay on the gun — legs carry the cycle (drawn above)

  for (const [a, b, useSkin] of [
    [leftShoulder, leftElbow, false],
    [leftElbow, leftHand, skinArm],
    [rightShoulder, rightElbow, false],
    [rightElbow, rightHand, skinArm]
  ]) {
    const fill = useSkin ? pal.skin : sleeveColor;
    const shade = useSkin ? pal.skinDark : sleeveDark;
    strokeCapsule(ctx, a.x, a.y, b.x, b.y, armW + 0.85, ink, 2.1);
    fillCapsule(ctx, a.x, a.y, b.x, b.y, armW, fill);
    fillCapsule(ctx, a.x + 0.5, a.y + 0.35, b.x + 0.35, b.y + 0.35, armW * 0.42, shade);
  }
  if (!skinArm) {
    fillCapsule(ctx, leftElbow.x - 0.4, leftElbow.y, leftHand.x, leftHand.y - 1, armW * 0.32, pal.armorMid);
    fillCapsule(ctx, rightElbow.x + 0.4, rightElbow.y, rightHand.x, rightHand.y - 1, armW * 0.32, pal.armorMid);
  }

  softDisk(ctx, leftHand.x, leftHand.y, woman ? 3.1 : 3.5, woman ? 2.9 : 3.3, handFill, handShade, 0.98);
  softDisk(ctx, rightHand.x, rightHand.y, woman ? 3.1 : 3.5, woman ? 2.9 : 3.3, handFill, handShade, 0.98);
  strokeEllipse(ctx, leftHand.x, leftHand.y, woman ? 3.1 : 3.5, woman ? 2.9 : 3.3, ink, 1.7);
  strokeEllipse(ctx, rightHand.x, rightHand.y, woman ? 3.1 : 3.5, woman ? 2.9 : 3.3, ink, 1.7);
  softDisk(ctx, leftHand.x - 0.5, leftHand.y - 0.6, 1.1, 0.8, 0xffffff, handFill, 0.2);
  softDisk(ctx, rightHand.x + 0.5, rightHand.y - 0.6, 1.1, 0.8, 0xffffff, handFill, 0.2);

  if (showKnife) {
    drawHeldKnife(ctx, rightHand.x, rightHand.y, knifeAng, ink);
  } else if (!opts.hideGun) {
    const gunId = (opts.weapon | 0) === 1 ? 1 : 0;
    if (holdGunAt) {
      drawHeldGun(ctx, holdGunAt.x, holdGunAt.y, holdGunAt.ang, pal, ink, gunId);
    } else {
      drawHeldGun(ctx, cx, handY + 2, Math.PI / 2, pal, ink, gunId);
    }
  }
}

function drawHeldGun(ctx, hx, hy, ang, pal, ink, weapon = 0) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang - Math.PI / 2);
  const gx = 0;
  const gy = 0;
  const rifle = weapon === 1;

  if (rifle) {
    // receiver
    ctx.beginPath();
    roundRectPath(ctx, gx - 4.2, gy - 5.5, 8.4, 11, 2);
    ctx.fillStyle = hexCss(pal.gun);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 2;
    ctx.stroke();
    softDisk(ctx, gx - 1.2, gy - 2, 2, 2.4, pal.gunHi, pal.gun, 0.7);
    // magazine
    ctx.beginPath();
    roundRectPath(ctx, gx - 2.2, gy + 2, 4.4, 7, 1.2);
    ctx.fillStyle = hexCss(pal.gunDark);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // long barrel
    ctx.beginPath();
    roundRectPath(ctx, gx - 2.2, gy + 5, 4.4, 22, 1.4);
    ctx.fillStyle = hexCss(pal.gunDark);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 1.7;
    ctx.stroke();
    softDisk(ctx, gx, gy + 12, 1, 7, pal.gunHi, pal.gunDark, 0.45);
    softDisk(ctx, gx, gy + 26, 1.4, 1.1, 0x0a0a0a, pal.gunDark);
    // stock hint
    ctx.beginPath();
    roundRectPath(ctx, gx - 2.5, gy - 11, 5, 6, 1.5);
    ctx.fillStyle = hexCss(pal.gun);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // pistol
    ctx.beginPath();
    roundRectPath(ctx, gx - 3.8, gy - 4.5, 7.6, 8.5, 2);
    ctx.fillStyle = hexCss(pal.gun);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 2;
    ctx.stroke();
    softDisk(ctx, gx - 1, gy - 1.5, 1.8, 2.2, pal.gunHi, pal.gun, 0.7);
    ctx.beginPath();
    roundRectPath(ctx, gx - 2, gy + 3, 4, 13, 1.4);
    ctx.fillStyle = hexCss(pal.gunDark);
    ctx.fill();
    ctx.strokeStyle = hexCss(ink);
    ctx.lineWidth = 1.7;
    ctx.stroke();
    softDisk(ctx, gx, gy + 7.5, 0.9, 4.5, pal.gunHi, pal.gunDark, 0.5);
    softDisk(ctx, gx, gy + 16, 1.2, 1, 0x0a0a0a, pal.gunDark);
  }
  ctx.restore();
}

function drawHeldKnife(ctx, hx, hy, ang, ink) {
  const tx = hx + Math.cos(ang) * 20;
  const ty = hy + Math.sin(ang) * 20;
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  // handle
  softDisk(ctx, hx - Math.cos(ang) * 2, hy - Math.sin(ang) * 2, 2.4, 2.4, 0x6a4220, 0x3a2410);
  // guard
  softDisk(ctx, hx + Math.cos(ang) * 2, hy + Math.sin(ang) * 2, 3.5, 1.6, 0xd4b060, 0x8a6828);
  // blade
  ctx.beginPath();
  ctx.moveTo(hx + px * 2.4, hy + py * 2.4);
  ctx.lineTo(tx, ty);
  ctx.lineTo(hx - px * 2.4, hy - py * 2.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(hx - px * 3, hy - py * 3, hx + px * 3, hy + py * 3);
  g.addColorStop(0, "#6a747c");
  g.addColorStop(0.45, "#ffffff");
  g.addColorStop(1, "#8a949c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hexCss(ink);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = rgba(0xffffff, 0.65);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(ang) * 14, hy + Math.sin(ang) * 14);
  ctx.stroke();
}

function makeCharacterCanvas(pal, frame, opts = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  drawCharacterCanvas(canvas.getContext("2d"), pal, frame, opts);
  return canvas;
}

function rotateCanvas(src, angleRad) {
  if (Math.abs(angleRad) < 1e-4) return src;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(src, -W / 2, -H / 2);
  return out;
}

function canvasToTexture(renderer, canvas) {
  const tex = PIXI.Texture.from(canvas);
  if (tex.baseTexture) {
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
  }
  return tex;
}

function drawFrame(renderer, palette, frame, opts = {}) {
  // single facing (+Y); PlayerSprite rotates continuously toward aim
  const base = makeCharacterCanvas(palette, frame, opts);
  return canvasToTexture(renderer, base);
}

const cache = new Map();

export function getCharacterSet(renderer, variantIndex = 0, weapon = 0) {
  const palette = PALETTES[variantIndex % PALETTES.length];
  const wpn = weapon === 1 ? 1 : 0;
  const frames = { walk: [], melee: [], dash: [], reload: [] };
  for (let f = 0; f < 4; f++) {
    const walkKey = `human-spin-v9-w${wpn}-${variantIndex}-${f}`;
    if (!cache.has(walkKey)) {
      cache.set(walkKey, drawFrame(renderer, palette, f, { weapon: wpn }));
    }
    frames.walk.push(cache.get(walkKey));

    const meleeKey = `human-spin-melee-v7-${variantIndex}-${f}`;
    if (!cache.has(meleeKey)) {
      cache.set(meleeKey, drawFrame(renderer, palette, f, { melee: true, meleeFrame: f, hideGun: true }));
    }
    frames.melee.push(cache.get(meleeKey));

    const dashKey = `human-spin-dash-v7-w${wpn}-${variantIndex}-${f}`;
    if (!cache.has(dashKey)) {
      cache.set(dashKey, drawFrame(renderer, palette, f, { dash: true, dashFrame: f, weapon: wpn }));
    }
    frames.dash.push(cache.get(dashKey));

    const reloadKey = `human-spin-reload-v1-w${wpn}-${variantIndex}-${f}`;
    if (!cache.has(reloadKey)) {
      cache.set(reloadKey, drawFrame(renderer, palette, f, { reload: true, reloadFrame: f, weapon: wpn }));
    }
    frames.reload.push(cache.get(reloadKey));
  }
  return { frames, palette, weapon: wpn };
}

export function getCharacterScale() {
  // визуал ≈ коллизия ~12 (тело ~26px в артe × scale)
  return 1.05;
}

export function getMuzzleOffset(aimAngle, scale = getCharacterScale(), weapon = 0) {
  const tip = weapon === 1 ? 44 : 34;
  const len = tip * scale;
  return {
    x: Math.cos(aimAngle) * len,
    y: Math.sin(aimAngle) * len,
    rot: aimAngle,
    localY: len
  };
}

export function getCharacterRoster() {
  return PALETTES.map((p, index) => ({
    index,
    id: p.id,
    style: p.style === "girl" ? "женщина" : "мужчина",
    name: displayName(p),
    color: p.armorMid || p.armor,
    accent: p.packMid || p.pack
  }));
}

/** HQ preview for character select menu. */
export function paintCharacterPreview(canvas, index = 0, frame = 0, scale = 2) {
  if (!canvas) return;
  const palette = PALETTES[((index % PALETTES.length) + PALETTES.length) % PALETTES.length];
  const src = makeCharacterCanvas(palette, frame, { hideGun: true });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = Math.round(W * scale);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, size, size);
}

function displayName(p) {
  const map = {
    olive_soldier: "Оливер",
    steel_soldier: "Марк",
    pink_girl: "Мила",
    rose_girl: "Роза",
    sakura_girl: "Сакура",
    lavender_girl: "Лина",
    cyan_tech: "Леон",
    gold_merc: "Виктор",
    mint_girl: "Мята",
    noir_ops: "Рей"
  };
  return map[p.id] || p.id;
}

const STORAGE_KEY = "bulletecho_character";

export function getSelectedCharacterIndex() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const idx = Number(raw);
    if (!Number.isFinite(idx) || idx < 0) return 0;
    return idx % PALETTES.length;
  } catch {
    return 0;
  }
}

export function setSelectedCharacterIndex(index) {
  const safe = ((Number(index) % PALETTES.length) + PALETTES.length) % PALETTES.length;
  try {
    localStorage.setItem(STORAGE_KEY, String(safe));
  } catch {
    /* ignore */
  }
  return safe;
}

export function pickCharacterIndex(player, isMe) {
  // Prefer explicit skin on the player object (local tab sets me.skin; remotes get server skin).
  // Do NOT read live localStorage for isMe — two tabs would mirror each other.
  const skin = player?.skin;
  if (skin !== undefined && skin !== null && Number.isFinite(Number(skin))) {
    return ((Number(skin) % PALETTES.length) + PALETTES.length) % PALETTES.length;
  }
  if (isMe) return getSelectedCharacterIndex();
  return Number(player?.id || 0) % PALETTES.length;
}

export function getPaletteCount() {
  return PALETTES.length;
}
