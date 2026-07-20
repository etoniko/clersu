/* global PIXI */
import {
  angleLerp,
  normalizeAngle,
  getCharacterSet,
  getCharacterScale,
  getMuzzleOffset,
  pickCharacterIndex
} from "./CharacterFactory.js";
import { getMeleeKit } from "./PixelAssets.js";
import { settings } from "../config/settings.js";

function mix(a, b, t) {
  return a + (b - a) * t;
}

export class PlayerSprite extends PIXI.Container {
  constructor(renderer) {
    super();
    this.renderer = renderer;
    this.animTime = 0;
    this.walkPhase = 0;
    this.walkStrength = 0;
    this.lastSyncAt = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.renderX = 0;
    this.renderY = 0;
    this.velX = 0;
    this.velY = 0;
    this._lastVx = 0;
    this._lastVy = 0;
    this.lastAim = Math.PI / 2;
    this.renderAim = Math.PI / 2;
    this.currentVariant = -1;
    this.currentWeapon = -1;
    this.currentFrame = "";
    this.lastMuzzleFlash = false;
    this.isLocal = false;
    this.spriteScale = getCharacterScale();
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 100;
    this.maxArmor = 100;
    this.stamina = 100;
    this.maxStamina = 100;

    // rig rotates smoothly; status bars stay screen-upright
    this.rig = new PIXI.Container();

    this.body = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.body.anchor.set(0.5, 0.5);
    this.body.scale.set(this.spriteScale);

    this.muzzle = new PIXI.Graphics();
    this.muzzle.visible = false;

    this.rig.addChild(this.body, this.muzzle);

    const kit = getMeleeKit(renderer);
    this.slash = new PIXI.Sprite(kit.slash);
    this.slash.anchor.set(0.5);
    this.slash.visible = false;
    this.slash.blendMode = PIXI.BLEND_MODES.ADD;

    this.knife = new PIXI.Sprite(kit.knife);
    this.knife.anchor.set(0.5, 0.78);
    this.knife.visible = false;
    this.knife.width = 34;
    this.knife.height = 34;

    this.meleeAnim = 0;
    this.meleeActive = false;
    this._wasMelee = false;

    this.dashAnim = 0;
    this.dashActive = false;
    this._wasDash = false;
    this.reloadAnim = 0;
    this.reloadActive = false;
    this.reloadDuration = 1;
    this._wasReload = false;
    this.recoil = 0;
    this.recoilKick = 0;
    this.muzzleFlashT = 0;
    this._lastShotAt = 0;
    this._wasMuzzle = false;
    this.dashTrail = new PIXI.Graphics();
    this.dashTrail.visible = false;
    this.dashTrail.blendMode = PIXI.BLEND_MODES.ADD;

    this.status = new PIXI.Container();
    this.status.y = 42;
    this.barBg = new PIXI.Graphics();
    this.hpFill = new PIXI.Graphics();
    this.armorFill = new PIXI.Graphics();
    this.staminaFill = new PIXI.Graphics();
    this.nameText = new PIXI.Text("", {
      fontFamily: "Arial, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: 0xe8f0ff,
      stroke: 0x000000,
      strokeThickness: 1.25,
      align: "center"
    });
    this.nameText.anchor.set(0.5, 1);
    this.hpText = new PIXI.Text("100", {
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1.25,
      align: "center"
    });
    this.hpText.anchor.set(0.5, 0.5);
    this.status.addChild(this.nameText, this.barBg, this.hpFill, this.armorFill, this.staminaFill, this.hpText);

    this.addChild(this.dashTrail, this.rig, this.slash, this.knife, this.status);
    this.displayName = "";
  }

  drawMuzzleFlash(weapon = 0, intensity = 1) {
    const rifle = weapon === 1;
    const s = (rifle ? 1.15 : 1) * intensity;
    this.muzzle.clear();
    // blast cone along +Y (barrel forward)
    this.muzzle.beginFill(0xfff8d0, 0.95 * intensity);
    this.muzzle.drawEllipse(0, 2 * s, 4.5 * s, 7 * s);
    this.muzzle.endFill();
    this.muzzle.beginFill(0xffb040, 0.85 * intensity);
    this.muzzle.drawEllipse(0, 5 * s, 3.2 * s, 6 * s);
    this.muzzle.endFill();
    this.muzzle.beginFill(0xffffff, 0.95);
    this.muzzle.drawCircle(0, 1.5 * s, 2.2 * s);
    this.muzzle.endFill();
    for (let i = 0; i < (rifle ? 6 : 5); i++) {
      const a = -0.9 + (i / (rifle ? 5 : 4)) * 1.8;
      const d = (rifle ? 11 : 9) * s;
      this.muzzle.beginFill(0xffe066, 0.75 * intensity);
      this.muzzle.drawCircle(Math.sin(a) * d * 0.45, Math.cos(a) * d, 1.4 * s);
      this.muzzle.endFill();
    }
  }

  /** Local predictive shot FX (cooldown-matched). */
  tryPlayShot(weapon = 0) {
    const cd = weapon === 1 ? 0.095 : 0.3;
    const now = performance.now() / 1000;
    if (now - this._lastShotAt < cd) return false;
    this._lastShotAt = now;
    this.playShotFx(weapon);
    return true;
  }

  /** Fired when combat/walk animation actually starts (not on keypress). */
  emitAction(kind) {
    if (typeof this.onAction !== "function") return;
    this.onAction(kind, this.x, this.y, {
      weapon: this.currentWeapon | 0,
      aim: this.renderAim,
      isLocal: this.isLocal
    });
  }

  playShotFx(weapon = 0) {
    const rifle = weapon === 1;
    this.recoil = 1;
    this.recoilKick = rifle ? 5.5 : 9;
    this.muzzleFlashT = rifle ? 0.055 : 0.09;
    this.currentWeapon = rifle ? 1 : this.currentWeapon;
    this.emitAction("shot");
  }

  setAppearance(player, isMe) {
    const variantIndex = pickCharacterIndex(player, isMe);
    const weapon = (player.weapon | 0) === 1 ? 1 : 0;
    if (variantIndex === this.currentVariant && weapon === this.currentWeapon) return;

    this.currentVariant = variantIndex;
    this.currentWeapon = weapon;
    this.characterSet = getCharacterSet(this.renderer, variantIndex, weapon);
    this.currentFrame = "";
    this.setFrame(0);
  }

  setFrame(frameIndex) {
    const key = `w-${frameIndex}`;
    if (this.currentFrame === key || !this.characterSet) return;
    this.currentFrame = key;
    const tex = this.characterSet.frames.walk[frameIndex];
    if (tex) this.body.texture = tex;
  }

  setMeleeFrame(frameIndex) {
    const key = `m-${frameIndex}`;
    if (this.currentFrame === key || !this.characterSet) return;
    this.currentFrame = key;
    const tex = this.characterSet.frames.melee?.[frameIndex] || this.characterSet.frames.walk[0];
    if (tex) this.body.texture = tex;
  }

  setDashFrame(frameIndex) {
    const key = `d-${frameIndex}`;
    if (this.currentFrame === key || !this.characterSet) return;
    this.currentFrame = key;
    const tex = this.characterSet.frames.dash?.[frameIndex] || this.characterSet.frames.walk[0];
    if (tex) this.body.texture = tex;
  }

  setReloadFrame(frameIndex) {
    const key = `r-${frameIndex}`;
    if (this.currentFrame === key || !this.characterSet) return;
    this.currentFrame = key;
    const tex = this.characterSet.frames.reload?.[frameIndex] || this.characterSet.frames.walk[0];
    if (tex) this.body.texture = tex;
  }

  updateMeleeVisual(bob, dt) {
    if (!this.meleeActive) {
      if (!this.dashActive) {
        this.knife.visible = false;
        this.slash.visible = false;
      }
      return;
    }

    this.meleeAnim += dt / 0.3;
    const raw = Math.max(0, Math.min(1, this.meleeAnim));
    const frameIndex = Math.min(3, Math.floor(raw * 4));
    this.setMeleeFrame(frameIndex);

    this.knife.visible = false;
    this.slash.tint = 0xffffff;
    this.slash.visible = raw > 0.15 && raw < 0.85;
    if (this.slash.visible) {
      const flash = Math.sin(((raw - 0.15) / 0.7) * Math.PI);
      const aim = this.renderAim;
      this.slash.rotation = aim;
      this.slash.x = Math.cos(aim) * 14;
      this.slash.y = Math.sin(aim) * 14 + bob;
      this.slash.alpha = flash * 0.45;
      this.slash.scale.set((0.7 + flash * 0.35) * this.spriteScale);
    }

    if (raw >= 1) {
      this.meleeActive = false;
      this.meleeAnim = 0;
      this.slash.visible = false;
      this.knife.visible = false;
      this.currentFrame = "";
      this.setFrame(0);
    }
  }

  updateDashVisual(bob, dt) {
    if (!this.dashActive || this.meleeActive) {
      if (!this.dashActive) this.dashTrail.visible = false;
      return;
    }

    this.dashAnim += dt / 0.28;
    const raw = Math.max(0, Math.min(1, this.dashAnim));
    const frameIndex = Math.min(3, Math.floor(raw * 4));
    this.setDashFrame(frameIndex);

    const flash = Math.sin(raw * Math.PI);
    const aim = this.renderAim;
    this.slash.tint = 0x7ec8ff;
    this.slash.visible = raw > 0.05 && raw < 0.95;
    if (this.slash.visible) {
      this.slash.rotation = aim;
      this.slash.x = Math.cos(aim) * 10;
      this.slash.y = Math.sin(aim) * 10 + bob;
      this.slash.alpha = flash * 0.55;
      this.slash.scale.set((0.85 + flash * 0.45) * this.spriteScale);
    }

    const bx = -Math.cos(aim);
    const by = -Math.sin(aim);
    this.dashTrail.clear();
    this.dashTrail.visible = true;
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 4;
      const dist = 18 + t * 36 * flash;
      const a = (1 - t) * flash * 0.35;
      this.dashTrail.beginFill(0xa8dcff, a);
      this.dashTrail.drawEllipse(bx * dist, by * dist + bob, 10 - t * 4, 14 - t * 5);
      this.dashTrail.endFill();
    }

    if (raw >= 1) {
      this.dashActive = false;
      this.dashAnim = 0;
      this.slash.visible = false;
      this.slash.tint = 0xffffff;
      this.dashTrail.visible = false;
      this.dashTrail.clear();
      this.currentFrame = "";
      this.setFrame(0);
    }
  }

  updateReloadVisual(dt) {
    if (!this.reloadActive || this.meleeActive || this.dashActive) return;

    const dur = this.reloadDuration || 1;
    this.reloadAnim += dt / dur;
    const raw = Math.max(0, Math.min(0.999, this.reloadAnim));
    const frameIndex = Math.min(3, Math.floor(raw * 4));
    this.setReloadFrame(frameIndex);
  }

  drawStatusBars() {
    const barW = 48;
    const barH = 7;
    const armorH = 5;
    const stamH = this.isLocal ? 4 : 0;
    const gap = 2;
    const x = -barW / 2;
    const hpRatio = Math.max(0, Math.min(1, this.health / Math.max(1, this.maxHealth)));
    const armorRatio = Math.max(0, Math.min(1, this.armor / Math.max(1, this.maxArmor)));
    const stamRatio = Math.max(0, Math.min(1, this.stamina / Math.max(1, this.maxStamina)));
    const hpColor = this.isLocal ? 0x4adf5a : 0xe04040;
    const armorColor = 0x6a9adf;
    const stamColor = 0xf0c040;
    const totalH = barH + gap + armorH + (stamH ? gap + stamH : 0);

    const showNames = settings.showNames !== false;
    const nick = this.isLocal || !showNames ? "" : (this.displayName || "").slice(0, 15);
    this.nameText.text = nick;
    this.nameText.visible = Boolean(nick);
    this.nameText.style.fill = 0xe8f0ff;
    this.nameText.y = -4;

    // своё HP/броня — в HUD слева сверху; на спрайте только чужие
    if (this.isLocal) {
      this.status.visible = false;
      return;
    }
    this.status.visible = true;

    this.barBg.clear();
    this.barBg.beginFill(0x10161e, 0.9);
    this.barBg.drawRect(x - 2, -2, barW + 4, totalH + 4);
    this.barBg.endFill();
    this.barBg.lineStyle(0);
    this.barBg.beginFill(0x2a3038, 1);
    this.barBg.drawRect(x, 0, barW, barH);
    this.barBg.endFill();
    this.barBg.beginFill(0x2a3038, 1);
    this.barBg.drawRect(x, barH + gap, barW, armorH);
    this.barBg.endFill();
    if (stamH) {
      this.barBg.beginFill(0x2a3038, 1);
      this.barBg.drawRect(x, barH + gap + armorH + gap, barW, stamH);
      this.barBg.endFill();
    }

    this.hpFill.clear();
    this.hpFill.beginFill(hpColor, 1);
    this.hpFill.drawRect(x, 0, Math.max(0, barW * hpRatio), barH);
    this.hpFill.endFill();
    if (hpRatio > 0.02) {
      this.hpFill.beginFill(0xffffff, 0.18);
      this.hpFill.drawRect(x, 0, Math.max(0, barW * hpRatio), 2);
      this.hpFill.endFill();
    }

    this.armorFill.clear();
    this.armorFill.beginFill(armorColor, 1);
    this.armorFill.drawRect(x, barH + gap, Math.max(0, barW * armorRatio), armorH);
    this.armorFill.endFill();

    this.staminaFill.clear();
    if (stamH) {
      this.staminaFill.beginFill(stamColor, 1);
      this.staminaFill.drawRect(x, barH + gap + armorH + gap, Math.max(0, barW * stamRatio), stamH);
      this.staminaFill.endFill();
    }

    this.hpText.text = String(Math.max(0, Math.round(this.health)));
    this.hpText.y = barH / 2;
  }

  sync(player, isMe, now) {
    this.setAppearance(player, isMe);
    this.isLocal = isMe;
    this.spriteScale = getCharacterScale();
    this.body.scale.set(this.spriteScale);

    if (typeof player.name === "string" && player.name) {
      this.displayName = player.name;
    }

    this.health = player.health ?? 100;
    this.maxHealth = player.maxHealth ?? 100;
    this.armor = player.armor ?? 0;
    this.maxArmor = player.maxArmor ?? 100;
    this.stamina = player.stamina ?? 100;
    this.maxStamina = player.maxStamina ?? 100;
    this.drawStatusBars();

    this.velX = player.vx || 0;
    this.velY = player.vy || 0;

    const px = player.x;
    const py = player.y;
    const syncDt = this.lastSyncAt ? Math.max(0.02, (now - this.lastSyncAt) / 1000) : 0.05;
    const dx = px - this.targetX;
    const dy = py - this.targetY;
    if (!player.vx && !player.vy && this.lastSyncAt) {
      this.velX = dx / syncDt;
      this.velY = dy / syncDt;
    }
    const speed = Math.hypot(this.velX, this.velY);
    this.walkStrength = mix(this.walkStrength, Math.min(1, speed / 180), isMe ? 0.55 : 0.35);

    const moved =
      this.lastSyncAt === 0 ||
      Math.abs(dx) > 0.01 ||
      Math.abs(dy) > 0.01 ||
      Math.abs((player.vx || 0) - this._lastVx) > 0.01 ||
      Math.abs((player.vy || 0) - this._lastVy) > 0.01;

    this.targetX = px;
    this.targetY = py;
    this._lastVx = this.velX;
    this._lastVy = this.velY;

    if (this.lastSyncAt === 0) {
      this.renderX = px;
      this.renderY = py;
      this.x = px;
      this.y = py;
    }

    if (moved) this.lastSyncAt = now;

    this.lastAim = normalizeAngle(player.aimAngle);
    if (!this._aimInited) {
      this.renderAim = this.lastAim;
      this._aimInited = true;
    }
    this.hitFlash = Boolean(player.hitFlash);

    const muzzle = Boolean(player.muzzle);
    // remote: start flash/recoil when server muzzle anim flag rises
    if (muzzle && !this._wasMuzzle && !this.isLocal) {
      this.playShotFx((player.weapon | 0) === 1 ? 1 : 0);
    }
    this._wasMuzzle = muzzle;

    this.lastMuzzleFlash = muzzle || this.muzzleFlashT > 0;
    const melee = Boolean(player.melee);
    // rising edge only; ignore flag flicker while swing already playing
    if (melee && !this._wasMelee && !this.meleeActive) {
      this.meleeAnim = 0;
      this.meleeActive = true;
      this.emitAction("knife");
    }
    this._wasMelee = melee;

    const dash = Boolean(player.dash);
    if (dash && !this._wasDash) {
      this.dashAnim = 0;
      this.dashActive = true;
      this.emitAction("dash");
    }
    this._wasDash = dash;

    const reloading = Boolean(player.reload);
    if (reloading && !this._wasReload && !this.reloadActive) {
      this.reloadAnim = 0;
      this.reloadActive = true;
      this.reloadDuration = (player.weapon | 0) === 1 ? 1 : 0.5;
    }
    if (!reloading && this._wasReload) {
      // server finished — snap anim done
      this.reloadActive = false;
      this.reloadAnim = 0;
      this.currentFrame = "";
      this.setFrame(0);
    }
    this._wasReload = reloading;

    this.alpha = isMe ? 1 : 0.98;
    this.visible = true;
  }

  tick(dt) {
    if (!this.visible || !this.characterSet) return;

    // dead reckoning + lerp — убирает дёрганье между сетевыми пакетами
    const lag = Math.min(0.08, Math.max(0, (performance.now() - this.lastSyncAt) / 1000));
    const aimX = this.targetX + this.velX * lag;
    const aimY = this.targetY + this.velY * lag;
    const follow = 1 - Math.pow(this.isLocal ? 0.00002 : 0.00012, dt);
    this.renderX += (aimX - this.renderX) * follow;
    this.renderY += (aimY - this.renderY) * follow;
    this.x = this.renderX;
    this.y = this.renderY;

    // local: snap to mouse (no catch-up spin). remote: short smooth turn
    if (this.isLocal) {
      this.renderAim = normalizeAngle(this.lastAim);
    } else {
      const turn = Math.min(1, dt * 18);
      this.renderAim = angleLerp(this.renderAim, this.lastAim, turn);
    }
    this.rig.rotation = this.renderAim - Math.PI / 2;

    this.animTime += dt;
    // local: drive walk from WASD immediately; remote: from position delta
    if (this.isLocal && typeof this.driveWalk === "number") {
      this.walkStrength = mix(this.walkStrength, this.driveWalk, Math.min(1, dt * 14));
    }
    const moving = this.walkStrength > 0.08;

    const actionLock = this.meleeActive || this.dashActive || this.reloadActive;
    if (!actionLock) {
      if (moving) {
        this.walkPhase += dt * (4.2 + this.walkStrength * 2.2);
        // ×2 so leg frames keep up with body bob (1 bob ≈ 2 frames)
        const fi = Math.floor(this.walkPhase * 2) % 4;
        if ((fi === 1 || fi === 3) && fi !== this._lastWalkFrame) {
          this.emitAction("walk");
        }
        this._lastWalkFrame = fi;
        this.setFrame(fi);
      } else {
        this.walkPhase = mix(this.walkPhase, 0, dt * 6);
        this.setFrame(0);
        this.walkStrength = mix(this.walkStrength, 0, dt * 4);
        this._lastWalkFrame = -1;
      }
    }

    // moderate hop + slight squash
    const bob = moving && !actionLock ? Math.sin(this.walkPhase * Math.PI * 2) * 1.2 : 0;
    const squash = moving && !actionLock ? 1 + Math.sin(this.walkPhase * Math.PI * 2) * 0.02 : 1;

    // recoil: kick body back (−Y local) and ease out
    if (this.recoil > 0) {
      const decay = this.currentWeapon === 1 ? 14 : 10;
      this.recoil = Math.max(0, this.recoil - dt * decay);
    }
    const recoilOff = this.recoil * this.recoilKick;
    this.body.y = -recoilOff;
    this.rig.y = bob;
    this.body.scale.set(
      this.spriteScale * (2 - squash) * (1 + this.recoil * 0.03),
      this.spriteScale * squash * (1 - this.recoil * 0.06)
    );

    if (this.muzzleFlashT > 0) {
      this.muzzleFlashT = Math.max(0, this.muzzleFlashT - dt);
    }

    const mz = getMuzzleOffset(this.renderAim, this.spriteScale, this.currentWeapon);
    this.muzzle.x = 0;
    this.muzzle.y = mz.localY - recoilOff * 0.35;
    this.muzzle.rotation = 0;
    if (this.muzzleFlashT > 0 && !actionLock) {
      const fade = Math.min(1, this.muzzleFlashT / 0.04);
      this.drawMuzzleFlash(this.currentWeapon, fade);
      this.muzzle.visible = true;
      this.muzzle.alpha = fade;
    } else {
      this.muzzle.visible = false;
      this.muzzle.alpha = 1;
    }

    this.updateMeleeVisual(bob, dt);
    this.updateDashVisual(bob, dt);
    this.updateReloadVisual(dt);

    this.body.tint = this.hitFlash ? 0xffb0b0 : this.dashActive ? 0xc8e8ff : 0xffffff;
  }
}
