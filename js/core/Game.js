import { Application } from "../game/Application.js";
import { UserInterface } from "../ui/UserInterface.js";
import { Input } from "../input/Input.js";
import { Network } from "../net/Network.js";
import { Sound } from "../audio/Sound.js";
import { settings } from "../config/settings.js";

export class Game {
  constructor() {
    this.app = new Application(this);
    this.ui = new UserInterface(this);
    this.input = new Input(this);
    this.net = new Network(this);
    this.sound = new Sound();
    this.settings = settings;
    this.applySettings();

    const unlock = () => {
      this.sound.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    this.startInputLoop();
    console.log("cler.su FFA ready");
  }

  applySettings() {
    const s = this.settings || settings;
    this.sound.setEnabled(s.soundOn !== false);
    this.sound.setMaster((s.volume ?? 42) / 100);
    this.sound.muteWalk = s.walkSfx === false;
  }

  startInputLoop() {
    setInterval(() => {
      if (!this.net.connected) return;
      if (this.ui.isPaused()) return;

      const move = this.input.movementVector();
      const aim = this.input.getAimAngle(this.app.view, this.app.viewYScale);
      this.net.sendInput(move, aim, true);

      const weapon = this.input.consumeWeaponChange();
      if (weapon !== null) {
        this.net.sendWeapon(weapon);
      }

      // sounds play from animations (PlayerSprite), not from keypress
      if (this.input.isShootHeld() || this.input.consumeShoot()) {
        const me = this.net.me;
        if (!me?.reload) {
          const w = this.input.weapon | 0;
          const ammo = w === 1 ? me?.ammoRifle | 0 : me?.ammoPistol | 0;
          if (ammo > 0) {
            this.net.sendShoot(aim);
            this.app.tryLocalShot(w);
          }
        }
      }

      {
        const me = this.net.me;
        if (me && !me.reload) {
          const w = this.input.weapon | 0;
          const ammo = w === 1 ? me.ammoRifle | 0 : me.ammoPistol | 0;
          const reserve = w === 1 ? me.reserveRifle | 0 : me.reservePistol | 0;
          if (ammo <= 0 && reserve > 0) this.net.sendReload();
        }
      }
      if (this.input.consumeDash()) {
        this.net.sendDash(aim, move);
      }
      if (this.input.consumeMelee()) {
        this.net.sendMelee(aim);
      }
      if (this.input.consumeReload()) {
        this.net.sendReload();
      }
    }, 1000 / 30);
  }
}
