import {
  getCharacterRoster,
  getSelectedCharacterIndex,
  setSelectedCharacterIndex,
  paintCharacterPreview
} from "../game/CharacterFactory.js";
import { settings, saveSettings } from "../config/settings.js";

const WEAPON_ICONS = {
  0: `<svg viewBox="0 0 48 16" aria-hidden="true"><path d="M2 8h6l2-3h14l3 3h8v3h-3l-1 3H18l-2-3H8l-2 2H2V8zm28 0h6v2h-4l-1 2h-3l2-4z"/></svg>`,
  1: `<svg viewBox="0 0 48 16" aria-hidden="true"><path d="M1 9h4l1-2h28l2 2h8v2h-6l-1 2H18l-1-2H8v2H4l-1-2H1V9zm34-1h5v1h-5V8zM12 11h8v1h-8v-1z"/></svg>`,
  2: `<svg viewBox="0 0 48 16" aria-hidden="true"><path d="M4 10h10l22-6 2 2-20 8H8l-2 2H4v-6zm12 2h4v1h-4v-1z"/></svg>`
};

export class UserInterface {
  constructor(core) {
    this.core = core;
    this.menu = document.getElementById("user-interface");
    this.nickInput = document.getElementById("name");
    this.leaderboardEl = document.getElementById("leaderboard-list");
    this.leaderboardRoot = document.getElementById("leaderboard");
    this.leaderboardTitle = document.getElementById("leaderboard-title");
    this.deathPanel = document.getElementById("death-panel");
    this.deathInfo = document.getElementById("death-info");
    this.killfeedEl = document.getElementById("killfeed");
    this.previewCanvas = document.getElementById("char-preview");
    this.homeBtn = document.getElementById("menu-home");
    this.playBtn = document.getElementById("play");
    this.statsEl = document.getElementById("player-stats");
    this.statHp = document.getElementById("stat-hp");
    this.statArmor = document.getElementById("stat-armor");
    this.statStam = document.getElementById("stat-stam");
    this.statHpVal = document.getElementById("stat-hp-val");
    this.statArmorVal = document.getElementById("stat-armor-val");
    this.statStamVal = document.getElementById("stat-stam-val");
    this.wpnPistol = document.getElementById("wpn-pistol");
    this.wpnRifle = document.getElementById("wpn-rifle");
    this.ammoPistolEl = document.getElementById("ammo-pistol");
    this.ammoRifleEl = document.getElementById("ammo-rifle");
    this._reloadStartedAt = 0;
    this._reloadWeapon = 0;
    this._reloadDuration = 0.5;
    this.howtoPanel = document.getElementById("howto-panel");
    this.howtoBtn = document.getElementById("btn-howto");
    this.settingsPanel = document.getElementById("settings-panel");
    this.settingsBtn = document.getElementById("btn-settings");

    this._feedTimers = new Map();
    this._feedMax = 6;
    this._statusHint = "";

    this.roster = getCharacterRoster();
    this.charIndex = getSelectedCharacterIndex();
    this.previewFrame = 0;
    this.previewTimer = 0;
    this.inGame = false;

    this.playBtn.addEventListener("click", () => this.onPlay());
    document.getElementById("respawn").addEventListener("click", () => this.startMission());
    document.getElementById("char-prev").addEventListener("click", () => this.shiftCharacter(-1));
    document.getElementById("char-next").addEventListener("click", () => this.shiftCharacter(1));
    this.homeBtn.addEventListener("click", () => this.showMenu());
    this.howtoBtn?.addEventListener("click", () => this.openHowTo());
    document.getElementById("howto-close")?.addEventListener("click", () => this.closeHowTo());
    this.howtoPanel?.addEventListener("click", (e) => {
      if (e.target === this.howtoPanel) this.closeHowTo();
    });
    this.settingsBtn?.addEventListener("click", () => this.openSettings());
    document.getElementById("settings-close")?.addEventListener("click", () => this.closeSettings());
    this.settingsPanel?.addEventListener("click", (e) => {
      if (e.target === this.settingsPanel) this.closeSettings();
    });
    this.bindSettingsControls();
    window.addEventListener("keydown", (e) => this.onGlobalKey(e));
    window.addEventListener("resize", () => this.layoutKillFeed());

    const saved = localStorage.getItem("cler_su_nick") || localStorage.getItem("bulletecho_nick");
    if (saved) this.nickInput.value = saved;

    this.buildCharacterDots();
    this.renderCharacterPicker();
    this.startPreviewAnim();
    this.syncHomeButton();
    this.syncLeaderboardMode();
    this.layoutKillFeed();
    this.setWeaponHud({ weapon: 0, ammoPistol: 14, reservePistol: 128, ammoRifle: 32, reserveRifle: 256 });
    this.syncSettingsForm();
  }

  bindSettingsControls() {
    const vol = document.getElementById("set-volume");
    const mute = document.getElementById("set-mute");
    const walk = document.getElementById("set-walk-sfx");
    const names = document.getElementById("set-names");
    const zoom = document.getElementById("set-zoom");
    vol?.addEventListener("input", () => this.onSettingsChange());
    mute?.addEventListener("change", () => this.onSettingsChange());
    walk?.addEventListener("change", () => this.onSettingsChange());
    names?.addEventListener("change", () => this.onSettingsChange());
    zoom?.addEventListener("input", () => this.onSettingsChange());
  }

  syncSettingsForm() {
    const s = settings;
    const mute = document.getElementById("set-mute");
    const vol = document.getElementById("set-volume");
    const volVal = document.getElementById("set-volume-val");
    const walk = document.getElementById("set-walk-sfx");
    const names = document.getElementById("set-names");
    const zoom = document.getElementById("set-zoom");
    const zoomVal = document.getElementById("set-zoom-val");
    if (mute) mute.checked = s.soundOn !== false;
    if (vol) vol.value = String(s.volume ?? 42);
    if (volVal) volVal.textContent = `${s.volume ?? 42}%`;
    if (walk) walk.checked = s.walkSfx !== false;
    if (names) names.checked = s.showNames !== false;
    if (zoom) zoom.value = String(s.zoomSpeed ?? 100);
    if (zoomVal) zoomVal.textContent = `${s.zoomSpeed ?? 100}%`;
  }

  onSettingsChange() {
    const mute = document.getElementById("set-mute");
    const vol = document.getElementById("set-volume");
    const walk = document.getElementById("set-walk-sfx");
    const names = document.getElementById("set-names");
    const zoom = document.getElementById("set-zoom");
    settings.soundOn = Boolean(mute?.checked);
    settings.volume = Math.max(0, Math.min(100, Number(vol?.value) || 0));
    settings.walkSfx = Boolean(walk?.checked);
    settings.showNames = Boolean(names?.checked);
    settings.zoomSpeed = Math.max(50, Math.min(200, Number(zoom?.value) || 100));
    const volVal = document.getElementById("set-volume-val");
    const zoomVal = document.getElementById("set-zoom-val");
    if (volVal) volVal.textContent = `${settings.volume}%`;
    if (zoomVal) zoomVal.textContent = `${settings.zoomSpeed}%`;
    saveSettings(settings);
    this.core.applySettings?.();
  }

  onGlobalKey(e) {
    if (e.code !== "Escape") return;
    e.preventDefault();
    if (this.settingsPanel && !this.settingsPanel.hidden) {
      this.closeSettings();
      return;
    }
    if (this.howtoPanel && !this.howtoPanel.hidden) {
      this.closeHowTo();
      return;
    }
    if (this.isMenuOpen()) {
      if (this.inGame) this.resumeGame();
      return;
    }
    if (this.inGame) this.showMenu();
  }

  openHowTo() {
    if (!this.howtoPanel) return;
    this.closeSettings();
    this.howtoPanel.hidden = false;
    this.keysClear();
  }

  closeHowTo() {
    if (!this.howtoPanel) return;
    this.howtoPanel.hidden = true;
  }

  openSettings() {
    if (!this.settingsPanel) return;
    this.closeHowTo();
    this.syncSettingsForm();
    this.settingsPanel.hidden = false;
    this.keysClear();
  }

  closeSettings() {
    if (!this.settingsPanel) return;
    this.settingsPanel.hidden = true;
  }

  isMenuOpen() {
    return !this.menu.hidden;
  }

  isPaused() {
    return (
      this.inGame &&
      (this.isMenuOpen() ||
        (this.howtoPanel && !this.howtoPanel.hidden) ||
        (this.settingsPanel && !this.settingsPanel.hidden))
    );
  }

  showMenu() {
    this.menu.hidden = false;
    this.deathPanel.hidden = true;
    this.closeHowTo();
    this.closeSettings();
    this.playBtn.textContent = this.inGame ? "ПРОДОЛЖИТЬ" : "ИГРАТЬ";
    this.syncHomeButton();
    this.syncLeaderboardMode();
    this.keysClear();
  }

  hideMenu() {
    this.menu.hidden = true;
    this.closeHowTo();
    this.closeSettings();
    this.syncHomeButton();
    this.syncLeaderboardMode();
  }

  syncLeaderboardMode() {
    const menuOpen = this.isMenuOpen();
    this.leaderboardRoot?.classList.toggle("menu-mode", menuOpen);
    if (this.leaderboardTitle) {
      this.leaderboardTitle.textContent = menuOpen ? "Лучшие игроки" : "РЕЙТИНГ";
    }
    this.layoutKillFeed();
  }

  syncHomeButton() {
    this.homeBtn.classList.toggle("visible", this.inGame && !this.isMenuOpen());
  }

  keysClear() {
    this.core.input?.keys?.clear();
    if (this.core.input) {
      this.core.input.shootQueued = false;
      this.core.input.dashQueued = false;
      this.core.input.meleeQueued = false;
      this.core.input.reloadQueued = false;
    }
  }

  resumeGame() {
    localStorage.setItem("cler_su_nick", this.getNick());
    setSelectedCharacterIndex(this.charIndex);
    this.applyCharacterToSprites();
    this.hideMenu();
  }

  applyCharacterToSprites() {
    const sprites = this.core.app?.playerSprites;
    if (!sprites) return;
    for (const spr of sprites.values()) {
      spr.currentVariant = -1;
    }
  }

  buildCharacterDots() {
    const host = document.getElementById("char-dots");
    host.innerHTML = "";
    this.roster.forEach((ch, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "char-dot";
      dot.style.background = `#${ch.color.toString(16).padStart(6, "0")}`;
      dot.title = ch.name;
      dot.addEventListener("click", () => this.selectCharacter(i));
      host.appendChild(dot);
    });
  }

  shiftCharacter(delta) {
    this.selectCharacter(this.charIndex + delta);
  }

  selectCharacter(index) {
    this.charIndex = setSelectedCharacterIndex(index);
    this.previewFrame = 0;
    this.renderCharacterPicker();
  }

  renderCharacterPicker() {
    const ch = this.roster[this.charIndex] || this.roster[0];
    document.getElementById("char-name").textContent = ch.name;
    document.getElementById("char-style").textContent = ch.style;
    paintCharacterPreview(this.previewCanvas, this.charIndex, this.previewFrame, 1.35);
    document.querySelectorAll(".char-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === this.charIndex);
    });
  }

  startPreviewAnim() {
    const tick = (t) => {
      this._previewRaf = requestAnimationFrame(tick);
      if (this.menu.hidden) return;
      if (!this.previewTimer) this.previewTimer = t;
      if (t - this.previewTimer < 180) return;
      this.previewTimer = t;
      this.previewFrame = (this.previewFrame + 1) % 4;
      paintCharacterPreview(this.previewCanvas, this.charIndex, this.previewFrame, 1.35);
    };
    this._previewRaf = requestAnimationFrame(tick);
  }

  getNick() {
    return (this.nickInput.value || "Игрок").trim().slice(0, 15);
  }

  onPlay() {
    this.core.sound?.unlock();
    if (this.inGame && this.deathPanel.hidden) {
      this.resumeGame();
      return;
    }
    this.startMission();
  }

  startMission() {
    this.core.sound?.unlock();
    localStorage.setItem("cler_su_nick", this.getNick());
    setSelectedCharacterIndex(this.charIndex);
    this.deathPanel.hidden = true;
    if (!this.core.net.connected) {
      this.core.net.connect();
    } else {
      this.core.net.spawn(this.getNick());
    }
  }

  setStatus(text) {
    this._statusHint = text || "";
  }

  onSpawn() {
    this.inGame = true;
    this.hideMenu();
    this.deathPanel.hidden = true;
    this.playBtn.textContent = "ПРОДОЛЖИТЬ";
    if (this.statsEl) this.statsEl.hidden = false;
    if (this.core.app.mapReady) {
      this.core.app.startSpawnZoom();
    }
    this.layoutKillFeed();
  }

  onWorld(me) {
    this.updatePlayerStats(me);
    this.setWeaponHud(me);
    this.updateReloadHud(me);
  }

  updateReloadHud(me) {
    const reloading = Boolean(me?.reload);
    const weapon = (me?.weapon | 0) === 1 ? 1 : 0;
    if (reloading && !this._reloadStartedAt) {
      this._reloadStartedAt = performance.now();
      this._reloadWeapon = weapon;
      this._reloadDuration = weapon === 1 ? 1 : 0.5;
      this._tickReloadClock();
    }
    if (!reloading) {
      this._reloadStartedAt = 0;
      if (this._reloadRaf) {
        cancelAnimationFrame(this._reloadRaf);
        this._reloadRaf = 0;
      }
      this.wpnPistol?.classList.remove("reloading");
      this.wpnRifle?.classList.remove("reloading");
      this._setReloadProgress(0);
      return;
    }
    this._reloadWeapon = weapon;
    this.wpnPistol?.classList.toggle("reloading", weapon === 0);
    this.wpnRifle?.classList.toggle("reloading", weapon === 1);
  }

  _setReloadProgress(p) {
    const clocks = document.querySelectorAll("[data-reload-clock]");
    clocks.forEach((el) => el.style.setProperty("--p", String(p)));
  }

  _tickReloadClock() {
    if (!this._reloadStartedAt) return;
    const weapon = this._reloadWeapon | 0;
    this.wpnPistol?.classList.toggle("reloading", weapon === 0);
    this.wpnRifle?.classList.toggle("reloading", weapon === 1);
    const dur = this._reloadDuration || (weapon === 1 ? 1 : 0.5);
    const elapsed = (performance.now() - this._reloadStartedAt) / 1000;
    const t = Math.max(0, Math.min(1, elapsed / dur));
    this._setReloadProgress(Math.round(t * 100));
    if (t < 1) {
      this._reloadRaf = requestAnimationFrame(() => this._tickReloadClock());
    }
  }

  updateScore() {}

  updatePlayerStats(me) {
    if (!me || !this.statsEl) return;
    this.statsEl.hidden = false;
    this.setBar(this.statHp, this.statHpVal, Math.max(0, me.health | 0), 100);
    this.setBar(this.statArmor, this.statArmorVal, Math.max(0, me.armor | 0), 100);
    this.setBar(this.statStam, this.statStamVal, Math.max(0, me.stamina | 0), 100);
  }

  setBar(fillEl, valEl, value, max) {
    if (!fillEl) return;
    const t = Math.max(0, Math.min(1, value / Math.max(1, max)));
    fillEl.style.transform = `scaleX(${t})`;
    if (valEl) valEl.textContent = String(Math.round(value));
  }

  setWeaponHud(meOrWeapon = 0) {
    const me = typeof meOrWeapon === "object" && meOrWeapon ? meOrWeapon : null;
    const rifle = (me ? me.weapon | 0 : meOrWeapon | 0) === 1;
    this.wpnPistol?.classList.toggle("active", !rifle);
    this.wpnRifle?.classList.toggle("active", rifle);
    if (this.ammoPistolEl) {
      this.ammoPistolEl.textContent = `${me?.ammoPistol ?? 14}/${me?.reservePistol ?? 128}`;
    }
    if (this.ammoRifleEl) {
      this.ammoRifleEl.textContent = `${me?.ammoRifle ?? 32}/${me?.reserveRifle ?? 256}`;
    }
  }

  updateLeaderboard(items, myId) {
    if (!this.leaderboardEl) return;
    if (!items.length) {
      this.leaderboardEl.innerHTML = '<div class="lb-empty">Пока никого нет</div>';
    } else {
      this.leaderboardEl.innerHTML = items
        .map((item, i) => {
          const me = item.id === myId ? " lb-me" : "";
          const top = i === 0 ? " lb-top1" : "";
          const kills = item.kills ?? item.score ?? 0;
          const deaths = item.deaths ?? 0;
          const kd = (kills / Math.max(1, deaths)).toFixed(1);
          return `<div class="lb-row${me}${top}">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name">${escapeHtml(item.name)}</span>
          <span class="lb-score" title="${kills}/${deaths}">${kd}</span>
        </div>`;
        })
        .join("");
    }
    this.layoutKillFeed();
  }

  layoutKillFeed() {
    if (!this.killfeedEl || !this.leaderboardRoot) return;
    const rect = this.leaderboardRoot.getBoundingClientRect();
    this.killfeedEl.style.top = `${Math.round(rect.bottom + 8)}px`;
    this.killfeedEl.style.right = "12px";
  }

  pushKillFeed(entry) {
    if (!this.killfeedEl) return;
    this.layoutKillFeed();
    const row = document.createElement("div");
    row.className = "kf-row";
    if (entry.isMeKiller || entry.isMeVictim) row.classList.add("kf-mine");
    const weapon = Math.max(0, Math.min(2, entry.weapon | 0));
    row.innerHTML = `
      <span class="kf-killer">${escapeHtml(entry.killerName || "???")}</span>
      <span class="kf-weapon">${WEAPON_ICONS[weapon] || WEAPON_ICONS[0]}</span>
      <span class="kf-victim">${escapeHtml(entry.victimName || "???")}</span>
    `;
    this.killfeedEl.prepend(row);
    while (this.killfeedEl.children.length > this._feedMax) {
      this.removeFeedRow(this.killfeedEl.lastElementChild, true);
    }
    this._feedTimers.set(row, setTimeout(() => this.removeFeedRow(row), 5200));
  }

  removeFeedRow(row, instant = false) {
    if (!row || !row.parentNode) return;
    const t = this._feedTimers.get(row);
    if (t) clearTimeout(t);
    this._feedTimers.delete(row);
    if (instant) {
      row.remove();
      return;
    }
    row.classList.add("kf-out");
    setTimeout(() => row.remove(), 360);
  }

  onDeath(killer, score) {
    this.core.sound?.death();
    this.deathPanel.hidden = false;
    this.syncHomeButton();
    this.deathInfo.textContent = killer
      ? `Вас убил: ${killer}. Убийств: ${score}`
      : `Вы погибли. Убийств: ${score}`;
  }

  onKill() {
    this.core.sound?.kill();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
