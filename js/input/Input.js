import { settings } from "../config/settings.js";

function isTouchPreferred() {
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}

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
    this.weapon = 0;
    this.weaponDirty = true;

    this.touchMode = isTouchPreferred();
    this.touchMove = { x: 0, y: 0 };
    this.touchAimActive = false;
    this.touchAimAngle = 0;
    this._movePtr = null;
    this._aimPtr = null;
    this._pinch = null;

    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.shootHeld = false;
      this.resetTouchAxes();
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.shootHeld = false;
    });

    const canvas = core.app.view;
    canvas.addEventListener("mousemove", (e) => {
      if (this.touchMode && this.touchAimActive) return;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.core.ui?.isPaused()) return;
      if (this.touchMode) return;
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

    // Pinch zoom on canvas (mobile)
    canvas.addEventListener("touchstart", (e) => this.onCanvasPinchStart(e), { passive: false });
    canvas.addEventListener("touchmove", (e) => this.onCanvasPinchMove(e), { passive: false });
    canvas.addEventListener("touchend", (e) => this.onCanvasPinchEnd(e), { passive: false });
    canvas.addEventListener("touchcancel", (e) => this.onCanvasPinchEnd(e), { passive: false });

    this.bindTouchControls();
    this.bindWeaponSlots();
  }

  resetTouchAxes() {
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchAimActive = false;
    this._movePtr = null;
    this._aimPtr = null;
    this._pinch = null;
    this.updateStickVisual("move", 0, 0);
    this.updateStickVisual("aim", 0, 0);
  }

  bindWeaponSlots() {
    const pistol = document.getElementById("wpn-pistol");
    const rifle = document.getElementById("wpn-rifle");
    pistol?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setWeapon(0);
    });
    rifle?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setWeapon(1);
    });
  }

  bindTouchControls() {
    const root = document.getElementById("touch-controls");
    if (!root) return;

    const movePad = document.getElementById("touch-move");
    const aimPad = document.getElementById("touch-aim");
    const fireBtn = document.getElementById("touch-fire");
    const dashBtn = document.getElementById("touch-dash");
    const meleeBtn = document.getElementById("touch-melee");
    const reloadBtn = document.getElementById("touch-reload");

    const bindStick = (el, kind) => {
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        if (this.core.ui?.isPaused()) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        if (kind === "move") this._movePtr = e.pointerId;
        else this._aimPtr = e.pointerId;
        this.updateStickFromEvent(el, kind, e);
      });
      el.addEventListener("pointermove", (e) => {
        const id = kind === "move" ? this._movePtr : this._aimPtr;
        if (id !== e.pointerId) return;
        e.preventDefault();
        this.updateStickFromEvent(el, kind, e);
      });
      const end = (e) => {
        const id = kind === "move" ? this._movePtr : this._aimPtr;
        if (id !== e.pointerId) return;
        e.preventDefault();
        if (kind === "move") {
          this._movePtr = null;
          this.touchMove.x = 0;
          this.touchMove.y = 0;
        } else {
          this._aimPtr = null;
          this.touchAimActive = false;
        }
        this.updateStickVisual(kind, 0, 0);
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    };

    bindStick(movePad, "move");
    bindStick(aimPad, "aim");

    const bindHold = (el, onDown, onUp) => {
      if (!el) return;
      const down = (e) => {
        if (this.core.ui?.isPaused()) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add("active");
        onDown?.(e);
      };
      const up = (e) => {
        e.preventDefault();
        el.classList.remove("active");
        onUp?.(e);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };

    bindHold(
      fireBtn,
      () => {
        this.shootHeld = true;
        this.shootQueued = true;
      },
      () => {
        this.shootHeld = false;
      }
    );
    bindHold(dashBtn, () => {
      this.dashQueued = true;
    });
    bindHold(meleeBtn, () => {
      this.meleeQueued = true;
    });
    bindHold(reloadBtn, () => {
      this.reloadQueued = true;
    });
  }

  updateStickFromEvent(el, kind, e) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const maxR = Math.min(rect.width, rect.height) * 0.38;
    const len = Math.hypot(dx, dy) || 1;
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    const nx = dx / maxR;
    const ny = dy / maxR;
    this.updateStickVisual(kind, nx, ny);

    if (kind === "move") {
      const dead = 0.18;
      this.touchMove.x = Math.abs(nx) < dead ? 0 : nx;
      this.touchMove.y = Math.abs(ny) < dead ? 0 : ny;
    } else {
      const dead = 0.12;
      if (Math.hypot(nx, ny) < dead) {
        this.touchAimActive = false;
        return;
      }
      this.touchAimActive = true;
      // Match world aim: canvas Y may be scaled
      const vs = this.core.app?.viewYScale || 1;
      this.touchAimAngle = Math.atan2(ny / vs, nx);

      // Keep mouse in sync for any code reading cursor
      const canvas = this.core.app.view;
      const cr = canvas.getBoundingClientRect();
      const mx = (cr.width || canvas.width) / 2;
      const my = (cr.height || canvas.height) / 2;
      const reach = Math.min(mx, my) * 0.45;
      this.mouse.x = mx + Math.cos(this.touchAimAngle) * reach;
      this.mouse.y = my + Math.sin(this.touchAimAngle) * vs * reach;
    }
  }

  updateStickVisual(kind, nx, ny) {
    const knob = document.getElementById(kind === "move" ? "touch-move-knob" : "touch-aim-knob");
    if (!knob) return;
    const pad = knob.parentElement;
    const r = pad ? Math.min(pad.clientWidth, pad.clientHeight) * 0.38 : 40;
    knob.style.transform = `translate(calc(-50% + ${nx * r}px), calc(-50% + ${ny * r}px))`;
  }

  onCanvasPinchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = e.touches;
      this._pinch = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      };
    }
  }

  onCanvasPinchMove(e) {
    if (!this._pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const prev = this._pinch.dist || dist;
    if (prev > 1) {
      const factor = dist / prev;
      this.core.app.adjustZoom(factor);
    }
    this._pinch.dist = dist;
  }

  onCanvasPinchEnd(e) {
    if (e.touches.length < 2) this._pinch = null;
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
    if (!e.repeat && e.code === "KeyR") {
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

    // Touch stick overrides / blends when active
    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) {
      x = this.touchMove.x;
      y = this.touchMove.y;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  getAimAngle(canvas, viewYScale = 1) {
    if (this.touchAimActive) return this.touchAimAngle;
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
