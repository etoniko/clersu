export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function normalize(vx, vy) {
  const len = Math.hypot(vx, vy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: vx / len, y: vy / len };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
