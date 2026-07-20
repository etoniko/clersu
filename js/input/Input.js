import { settings } from "../config/settings.js";

export class Input {
  constructor(core) {
    this.core = core;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.shootQueued = false;
    this.shootHeld = false;
    this.dashQueued = false;
    this.meleeQueued = false;
    this.reloadQueued = false;
    this.weapon = 0; // 0 pistol, 1 rifle
    this.weaponDirty = true;

    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.shootHeld = false;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.shootHeld = false;
    });

    const canvas = core.app.view;
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.core.ui?.isPaused()) return;
      if (e.button === 0) {
        this.shootHeld = true;
        this.shootQueued = true;
      }
      if (e.button === 2) this.meleeQueued = true;
    });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.shootHeld = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const steps = ((e.deltaY || 0) / 120) * ((settings.zoomSpeed || 100) / 100);
        this.core.app.adjustZoom(Math.pow(0.9, steps));
      },
      { passive: false }
    );
  }

  onKeyDown(e) {
    if (e.code === "Escape") return;
    if (this.core.ui?.isPaused()) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "Space" && !e.repeat) {
      this.dashQueued = true;
    }
    if (!e.repeat && (e.code === "KeyR")) {
      e.preventDefault();
      this.reloadQueued = true;
    }
    if (!e.repeat && (e.code === "Digit1" || e.code === "Numpad1")) {
      this.setWeapon(0);
    }
    if (!e.repeat && (e.code === "Digit2" || e.code === "Numpad2")) {
      this.setWeapon(1);
    }
    this.keys.add(e.code);
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  setWeapon(id) {
    const next = id === 1 ? 1 : 0;
    if (this.weapon === next) return;
    this.weapon = next;
    this.weaponDirty = true;
  }

  movementVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    return { x, y };
  }

  getAimAngle(canvas, viewYScale = 1) {
    const cx = (canvas.clientWidth || canvas.width) / 2;
    const cy = (canvas.clientHeight || canvas.height) / 2;
    const dx = this.mouse.x - cx;
    const dy = (this.mouse.y - cy) / viewYScale;
    return Math.atan2(dy, dx);
  }

  isShootHeld() {
    return this.shootHeld;
  }

  consumeShoot() {
    const v = this.shootQueued;
    this.shootQueued = false;
    return v;
  }

  consumeWeaponChange() {
    if (!this.weaponDirty) return null;
    this.weaponDirty = false;
    return this.weapon;
  }

  consumeDash() {
    const v = this.dashQueued;
    this.dashQueued = false;
    return v;
  }

  consumeMelee() {
    const v = this.meleeQueued;
    this.meleeQueued = false;
    return v;
  }

  consumeReload() {
    const v = this.reloadQueued;
    this.reloadQueued = false;
    return v;
  }
}
