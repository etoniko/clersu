const KEY = "cler_su_settings";

const DEFAULTS = {
  soundOn: true,
  volume: 42,
  walkSfx: true,
  showNames: true,
  zoomSpeed: 100,
  cameraZoom: null
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Live settings object — mutated in place by UI. */
export const settings = loadSettings();
