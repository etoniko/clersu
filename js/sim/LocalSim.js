import { LocalMap, HALF_MAP, clamp } from "./LocalMap.js";

function normalize(vx, vy) {
  const len = Math.hypot(vx, vy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: vx / len, y: vy / len };
}

function segmentCircleHitT(x1, y1, x2, y2, cx, cy, rad) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const r2 = rad * rad;
  if (a < 1e-10) return fx * fx + fy * fy <= r2 ? 0 : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r2;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const t0 = (-b - disc) / (2 * a);
  const t1 = (-b + disc) / (2 * a);
  if (t0 >= 0 && t0 <= 1) return t0;
  if (t0 < 0 && t1 >= 0) return 0;
  if (t1 >= 0 && t1 <= 1) return t1;
  return null;
}

function firstWallAlongSegment(map, x1, y1, x2, y2, radius) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(dist / 8));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (map.collides(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius)) return t;
  }
  return null;
}

function makeActor(id, name, color, kind = "enemy") {
  return {
    id,
    name,
    kind,
    x: 0,
    y: 0,
    aimAngle: 0,
    input: { x: 0, y: 0 },
    vx: 0,
    vy: 0,
    alive: true,
    health: 100,
    maxHealth: 100,
    armor: 100,
    maxArmor: 100,
    color,
    lastShootAt: 0,
    respawnAt: 0,
    patrolTarget: null,
    state: "patrol",
    aggroUntil: 0,
    suspectX: 0,
    suspectY: 0,
    kills: 0,
    deaths: 0,
    ammo: 14,
    ammoReserve: 128,
    ammoPistol: 14,
    reservePistol: 128,
    ammoRifle: 32,
    reserveRifle: 256,
    reloadUntil: 0,
    muzzleUntil: 0,
    hitUntil: 0
  };
}

export class LocalSim {
  constructor(core) {
    this.core = core;
    this.connected = false;
    this.ownerPlayerId = 1;
    this.map = null;
    this.mapSize = 0;
    this.tileSize = 64;
    this.floorTiles = [];
    this.walls = [];
    this.decor = [];
    this.leaderboard = [];
    this.world = null;
    this.bullets = [];
    this.entities = [];
    this.score = { kills: 0, deaths: 0 };
    this.config = {
      playerRadius: 10,
      playerSpeed: 280,
      bulletSpeed: 860,
      bulletLifeMs: 900,
      bulletDamage: 34,
      shootCooldownMs: 180
    };
    this.lastTickAt = performance.now();
    this.nextActorId = 2;
    this.nextBulletId = 1;
    this.pendingImpacts = [];
    this.shakeUntil = 0;
  }

  connect() {
    this.connected = true;
    this.core.ui.setStatus("Локальная миссия");
  }

  spawn(name) {
    if (!this.connected) this.connect();
    this.resetWorld(name || "Игрок");
    this.core.app.onMapReady();
    this.core.ui.onSpawn(this.me.health);
    this.publishWorld();
  }

  resetWorld(name) {
    this.map = new LocalMap((Date.now() / 10) | 0);
    this.mapSize = this.map.size;
    this.tileSize = this.map.tileSize;
    this.floorTiles = this.map.floorTiles;
    this.walls = this.map.walls;
    this.decor = this.map.decor;
    this.bullets = [];
    this.score = { kills: 0, deaths: 0 };

    this.me = makeActor(this.ownerPlayerId, name, { r: 96, g: 165, b: 250 }, "hero");
    let heroSpawn = this.map.randomSpawn(this.config.playerRadius, []);
    if (this.map.ejectFromWall) heroSpawn = this.map.ejectFromWall(heroSpawn.x, heroSpawn.y, this.config.playerRadius);
    this.me.x = heroSpawn.x;
    this.me.y = heroSpawn.y;

    const enemyColors = [
      { r: 248, g: 113, b: 113 },
      { r: 251, g: 191, b: 36 },
      { r: 52, g: 211, b: 153 },
      { r: 167, g: 139, b: 250 },
      { r: 244, g: 114, b: 182 }
    ];
    this.entities = [this.me];
    for (let i = 0; i < 8; i++) {
      const enemy = makeActor(this.nextActorId++, `BOT-${i + 1}`, enemyColors[i % enemyColors.length]);
      let spawn = this.map.randomSpawn(this.config.playerRadius, this.entities);
      if (this.map.ejectFromWall) spawn = this.map.ejectFromWall(spawn.x, spawn.y, this.config.playerRadius);
      enemy.x = spawn.x;
      enemy.y = spawn.y;
      enemy.aimAngle = Math.random() * Math.PI * 2;
      this.entities.push(enemy);
    }
    this.updateLeaderboard();
  }

  tick(input, aimAngle, shootQueued) {
    if (!this.me) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    this.me.input = input;
    this.me.aimAngle = aimAngle;

    if (this.me.alive) {
      this.moveActor(this.me, dt);
      if (shootQueued) this.shoot(this.me);
    } else if (now >= this.me.respawnAt) {
      this.respawn(this.me);
    }

    for (const enemy of this.entities) {
      if (enemy === this.me) continue;
      if (!enemy.alive) {
        if (now >= enemy.respawnAt) this.respawn(enemy);
        continue;
      }
      this.updateBot(enemy, dt, now);
      this.moveActor(enemy, dt);
    }

    this.updateBullets(dt, now);
    this.publishWorld();
  }

  moveActor(actor, dt) {
    const dir = normalize(actor.input.x, actor.input.y);
    const speed = this.config.playerSpeed * dt;
    const r = this.config.playerRadius;
    let x = actor.x;
    let y = actor.y;

    if (this.map.collides(x, y, r) && this.map.ejectFromWall) {
      const safe = this.map.ejectFromWall(x, y, r);
      actor.x = safe.x;
      actor.y = safe.y;
      x = safe.x;
      y = safe.y;
    }

    const targetX = clamp(x + dir.x * speed, -HALF_MAP + r, HALF_MAP - r);
    if (!this.map.collides(targetX, y, r)) x = targetX;

    const targetY = clamp(y + dir.y * speed, -HALF_MAP + r, HALF_MAP - r);
    if (!this.map.collides(x, targetY, r)) y = targetY;

    actor.vx = dt > 0 ? (x - actor.x) / dt : 0;
    actor.vy = dt > 0 ? (y - actor.y) / dt : 0;
    actor.x = x;
    actor.y = y;
  }

  shoot(actor) {
    const now = performance.now();
    if (!actor.alive || now < actor.reloadUntil) return false;
    if (now - actor.lastShootAt < this.config.shootCooldownMs) return false;
    if (actor.ammo <= 0) {
      const clipSize = actor.kind === "hero" ? 14 : 10;
      if (actor.kind === "hero") {
        if (actor.ammoReserve <= 0) return false;
        const refill = Math.min(clipSize, actor.ammoReserve);
        actor.ammoReserve -= refill;
        actor.ammo = refill;
      } else {
        actor.ammo = clipSize;
      }
      actor.reloadUntil = now + 1200;
      return false;
    }

    actor.lastShootAt = now;
    actor.muzzleUntil = now + 70;
    actor.ammo -= 1;
    const dir = normalize(Math.cos(actor.aimAngle), Math.sin(actor.aimAngle));
    this.bullets.push({
      id: this.nextBulletId++,
      owner: actor,
      x: actor.x + dir.x * (this.config.playerRadius + 14),
      y: actor.y + dir.y * (this.config.playerRadius + 14),
      vx: dir.x * this.config.bulletSpeed,
      vy: dir.y * this.config.bulletSpeed,
      radius: 4,
      damage: this.config.bulletDamage,
      expiresAt: now + this.config.bulletLifeMs,
      weapon: actor.weapon | 0,
      trail: []
    });
    return true;
  }

  addImpact(x, y, kind = "spark") {
    this.pendingImpacts.push({ x, y, kind, at: performance.now() });
    if (this.pendingImpacts.length > 40) this.pendingImpacts.shift();
  }

  updateBullets(dt, now) {
    const hitR = this.config.playerRadius + 2;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.trail.unshift({ x: bullet.x, y: bullet.y, life: now + 110 });
      bullet.trail = bullet.trail.filter((p) => p.life > now).slice(0, 7);

      const x0 = bullet.x;
      const y0 = bullet.y;
      const x1 = x0 + bullet.vx * dt;
      const y1 = y0 + bullet.vy * dt;

      if (bullet.expiresAt <= now) {
        this.bullets.splice(i, 1);
        continue;
      }

      let bestT = 1;
      let hitActor = null;
      for (const actor of this.entities) {
        if (!actor.alive || actor === bullet.owner) continue;
        const t = segmentCircleHitT(x0, y0, x1, y1, actor.x, actor.y, hitR + bullet.radius);
        if (t !== null && t <= bestT) {
          bestT = t;
          hitActor = actor;
        }
      }

      const wallT = firstWallAlongSegment(this.map, x0, y0, x1, y1, bullet.radius);

      if (wallT !== null && (hitActor === null || wallT < bestT)) {
        const hx = x0 + (x1 - x0) * wallT;
        const hy = y0 + (y1 - y0) * wallT;
        this.addImpact(hx, hy, "wall");
        this.bullets.splice(i, 1);
        continue;
      }

      if (hitActor) {
        let dmg = bullet.damage;
        if (hitActor.armor > 0) {
          const absorbed = Math.min(hitActor.armor, dmg);
          hitActor.armor -= absorbed;
          dmg -= absorbed;
        }
        if (dmg > 0) hitActor.health -= dmg;
        hitActor.hitUntil = now + 140;
        this.addImpact(hitActor.x, hitActor.y, "hit");
        this.bullets.splice(i, 1);
        if (hitActor.health <= 0) this.kill(hitActor, bullet.owner, bullet.weapon | 0);
        continue;
      }

      if (
        x1 < -HALF_MAP ||
        x1 > HALF_MAP ||
        y1 < -HALF_MAP ||
        y1 > HALF_MAP
      ) {
        this.addImpact(x1, y1, "wall");
        this.bullets.splice(i, 1);
        continue;
      }

      bullet.x = x1;
      bullet.y = y1;
    }
  }

  kill(victim, killer, weapon = 0) {
    victim.alive = false;
    victim.health = 0;
    victim.armor = 0;
    victim.deaths += 1;
    victim.respawnAt = performance.now() + (victim === this.me ? 2500 : 1800);
    if (killer) {
      killer.kills += 1;
      if (killer === this.me) {
        this.score.kills += 1;
        this.core.ui.onKill(1, this.score.kills);
      }
    }
    if (victim === this.me) {
      this.score.deaths += 1;
      this.core.ui.onDeath(killer?.name || "", this.score.kills);
    }
    this.core.ui.pushKillFeed({
      killerName: killer?.name || "???",
      victimName: victim?.name || "???",
      weapon: killer === victim ? 0 : weapon,
      killerId: killer?.id || 0,
      victimId: victim?.id || 0,
      isMeKiller: killer === this.me,
      isMeVictim: victim === this.me
    });
    this.updateLeaderboard();
  }

  respawn(actor) {
    let spawn = this.map.randomSpawn(this.config.playerRadius, this.entities.filter((item) => item !== actor && item.alive));
    if (this.map.ejectFromWall) spawn = this.map.ejectFromWall(spawn.x, spawn.y, this.config.playerRadius);
    actor.x = spawn.x;
    actor.y = spawn.y;
    actor.health = actor.maxHealth;
    actor.armor = actor.maxArmor;
    actor.alive = true;
    actor.ammo = actor.kind === "hero" ? 14 : 10;
    if (actor.kind === "hero") actor.ammoReserve = 120;
    actor.reloadUntil = 0;
    actor.state = "patrol";
    actor.patrolTarget = null;
    if (actor === this.me) this.core.ui.onSpawn(actor.health);
  }

  updateBot(bot, dt, now) {
    const seesHero = this.me.alive && this.map.lineOfSight(bot.x, bot.y, this.me.x, this.me.y);

    if (seesHero) {
      bot.aggroUntil = now + 1800;
      bot.suspectX = this.me.x;
      bot.suspectY = this.me.y;
    }

    if (bot.aggroUntil > now) {
      const dx = this.me.x - bot.x;
      const dy = this.me.y - bot.y;
      const dist = Math.hypot(dx, dy);
      bot.aimAngle = Math.atan2(dy, dx);

      if (dist > 280) {
        const n = normalize(dx, dy);
        bot.input.x = n.x;
        bot.input.y = n.y;
      } else if (dist < 180) {
        const n = normalize(-dx, -dy);
        bot.input.x = n.x * 0.7;
        bot.input.y = n.y * 0.7;
      } else {
        bot.input.x = 0;
        bot.input.y = 0;
      }

      if (seesHero && this.map.lineOfSight(bot.x, bot.y, this.me.x, this.me.y)) {
        this.shoot(bot);
      }
      return;
    }

    if (!bot.patrolTarget || Math.hypot(bot.patrolTarget.x - bot.x, bot.patrolTarget.y - bot.y) < 40) {
      const point = this.map.randomSpawn(this.config.playerRadius, this.entities.filter((item) => item.alive));
      bot.patrolTarget = point;
    }

    const pdx = bot.patrolTarget.x - bot.x;
    const pdy = bot.patrolTarget.y - bot.y;
    const dir = normalize(pdx, pdy);
    bot.input.x = dir.x * 0.75;
    bot.input.y = dir.y * 0.75;
    bot.aimAngle = Math.atan2(pdy, pdx);
  }

  makeSnapshot(now) {
    const players = [];
    const bullets = [];

    for (const actor of this.entities) {
      if (actor === this.me || !actor.alive) continue;
      players.push({
          id: actor.id,
          x: actor.x,
          y: actor.y,
          vx: actor.vx || 0,
          vy: actor.vy || 0,
          aimAngle: actor.aimAngle,
          health: actor.health,
          maxHealth: actor.maxHealth,
          armor: actor.armor,
          maxArmor: actor.maxArmor,
          color: actor.color,
          name: actor.name,
          muzzleFlash: actor.muzzleUntil > now,
          hitFlash: actor.hitUntil > now
        });
    }

    for (const bullet of this.bullets) {
      bullets.push({
          id: bullet.id,
          x: bullet.x,
          y: bullet.y,
          trail: bullet.trail,
          ownerId: bullet.owner?.id || 0
        });
    }

    return {
      me: {
        id: this.me.id,
        x: this.me.x,
        y: this.me.y,
        vx: this.me.vx || 0,
        vy: this.me.vy || 0,
        aimAngle: this.me.aimAngle,
        health: this.me.health,
        maxHealth: this.me.maxHealth,
        armor: this.me.armor,
        maxArmor: this.me.maxArmor,
        alive: this.me.alive,
        color: this.me.color,
        weapon: this.me.weapon | 0,
        ammo: this.me.ammo,
        ammoReserve: this.me.ammoReserve,
        ammoPistol: this.me.ammoPistol ?? this.me.ammo,
        reservePistol: this.me.reservePistol ?? this.me.ammoReserve,
        ammoRifle: this.me.ammoRifle ?? 32,
        reserveRifle: this.me.reserveRifle ?? 256,
        stamina: this.me.stamina ?? 100,
        muzzleFlash: this.me.muzzleUntil > now,
        hitFlash: this.me.hitUntil > now
      },
      players,
      bullets,
      impacts: this.pendingImpacts.splice(0, this.pendingImpacts.length),
      shake: false,
      enemiesAlive: this.entities.filter((actor) => actor !== this.me && actor.alive).length
    };
  }

  publishWorld() {
    const now = performance.now();
    this.world = this.makeSnapshot(now);
    this.core.app.onWorldUpdate(this.world);
    this.core.ui.onWorld(this.world.me, this.world.enemiesAlive);
    this.core.ui.updateScore(this.score.kills, this.score.deaths, this.world.me.ammo, this.world.me.ammoReserve, this.world.enemiesAlive);
    this.updateLeaderboard();
  }

  updateLeaderboard() {
    this.leaderboard = this.entities
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        score: actor.kills,
        alive: actor.alive
      }))
      .sort((a, b) => b.score - a.score || Number(b.alive) - Number(a.alive))
      .slice(0, 6);
    this.core.ui.updateLeaderboard(this.leaderboard, this.ownerPlayerId);
  }
}
