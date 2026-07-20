import { BinaryReader, Writer } from "../utils/binary.js";
import { SERVER_WS_URL } from "../config/servers.js";
import { FfaMap, rleDecode } from "../map/FfaMap.js";
import { getSelectedCharacterIndex } from "../game/CharacterFactory.js";

export class Network {
  static SERVER_TO_CLIENT = {
    PING: 2,
    UPDATE_WORLD: 16,
    LEADERBOARD: 49,
    BORDER: 64,
    WELCOME: 65,
    DEATH: 66,
    SCORE: 67,
    KILL_FEED: 68
  };

  static CLIENT_TO_SERVER = {
    SPAWN: 0,
    INPUT: 16,
    SHOOT: 17,
    DASH: 18,
    MELEE: 19,
    SET_WEAPON: 20,
    RELOAD: 21,
    PROFILE: 22,
    PONG: 2
  };

  constructor(core) {
    this.core = core;
    this.protocol = "bulletecho-v1";
    this.ownerPlayerId = 0;
    this.connected = false;
    this.leaderboard = [];
    this.mapSize = 11520;
    this.tileSize = 64;
    this.mapSeed = 0;
    this.map = null;
    this.walls = [];
    this.floorTiles = [];
    this.decor = [];
    this.paths = [];
    this.flashlight = { range: 1200, angle: Math.PI / 2 };
    this.kills = 0;
    this.deaths = 0;
    this.world = null;
    this.me = null;
    // Per-tab skin (NOT live localStorage — otherwise 2 tabs share one look)
    this.localSkin = getSelectedCharacterIndex();
  }

  connect(addr = SERVER_WS_URL) {
    if (this.ws) this.ws.close();
    const ws = (this.ws = new WebSocket(addr));
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      this.connected = true;
      this.core.ui.setStatus("Подключено");
      this.spawn(this.core.ui.getNick());
    };
    ws.onmessage = (e) => this.onMessage(e.data);
    ws.onclose = () => {
      this.connected = false;
      this.core.ui.setStatus("Отключено");
    };
    ws.onerror = () => {
      this.core.ui.setStatus("Ошибка соединения");
    };
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(data);
  }

  spawn(name) {
    this.localSkin = getSelectedCharacterIndex();
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.SPAWN);
    w.setUint8(this.localSkin);
    w.setUtf16(name || "Игрок");
    this.send(w.build());
  }

  /** Push nick + skin so everyone sees the change without respawn. */
  sendProfile(name, skin) {
    if (skin !== undefined && skin !== null) {
      this.localSkin = skin | 0;
    }
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.PROFILE);
    w.setUint8(this.localSkin | 0);
    w.setUtf16(name || this.core.ui?.getNick?.() || "Игрок");
    this.send(w.build());
  }

  sendInput(move, aimAngle, flashlightOn) {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.INPUT);
    w.setFloat32(move.x);
    w.setFloat32(move.y);
    w.setFloat32(aimAngle);
    w.setUint8(flashlightOn ? 1 : 0);
    this.send(w.build());
  }

  sendShoot(aimAngle) {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.SHOOT);
    w.setFloat32(aimAngle);
    this.send(w.build());
  }

  sendDash(aimAngle, move = { x: 0, y: 0 }) {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.DASH);
    w.setFloat32(aimAngle);
    w.setFloat32(move.x || 0);
    w.setFloat32(move.y || 0);
    this.send(w.build());
  }

  sendMelee(aimAngle) {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.MELEE);
    w.setFloat32(aimAngle);
    this.send(w.build());
  }

  sendWeapon(weaponId) {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.SET_WEAPON);
    w.setUint8(weaponId === 1 ? 1 : 0);
    this.send(w.build());
  }

  sendReload() {
    const w = new Writer();
    w.setUint8(Network.CLIENT_TO_SERVER.RELOAD);
    this.send(w.build());
  }

  onMessage(buffer) {
    const reader = new BinaryReader(new DataView(buffer));
    const opcode = reader.uint8();

    switch (opcode) {
      case Network.SERVER_TO_CLIENT.BORDER:
        this.readBorder(reader);
        break;
      case Network.SERVER_TO_CLIENT.WELCOME:
        this.ownerPlayerId = reader.uint32();
        this.core.ui.onSpawn(reader.uint8());
        break;
      case Network.SERVER_TO_CLIENT.UPDATE_WORLD:
        this.readWorld(reader);
        break;
      case Network.SERVER_TO_CLIENT.LEADERBOARD:
        this.readLeaderboard(reader);
        break;
      case Network.SERVER_TO_CLIENT.DEATH:
        this.readDeath(reader);
        break;
      case Network.SERVER_TO_CLIENT.SCORE:
        {
          const prevKills = this.kills | 0;
          this.kills = reader.uint32();
          this.deaths = reader.uint32();
          this.core.ui.updateScore(this.kills, this.deaths);
          if (this.kills > prevKills) {
            this.core.ui.onKill(this.kills - prevKills, this.kills);
          }
        }
        break;
      case Network.SERVER_TO_CLIENT.KILL_FEED:
        this.readKillFeed(reader);
        break;
      case Network.SERVER_TO_CLIENT.PING:
        this.send(new Uint8Array([Network.CLIENT_TO_SERVER.PONG]).buffer);
        break;
      default:
        break;
    }
  }

  readBorder(reader) {
    this.mapSize = reader.float32();
    this.tileSize = reader.uint16();
    this.mapSeed = reader.uint32();
    const tiles = reader.uint16();
    const format = reader.uint16();

    // format 2+: server sends RLE cell grid — same blocks as server collision
    if (format >= 2 && reader.canRead) {
      const rleBytes = new Uint8Array(
        reader.view.buffer,
        reader.view.byteOffset + reader.offset
      );
      const codes = rleDecode(rleBytes, tiles * tiles);
      this.map = FfaMap.fromCellCodes(codes, tiles);
    } else {
      this.map = new FfaMap(this.mapSeed);
    }

    this.walls = this.map.walls;
    this.floorTiles = this.map.floorTiles;
    this.decor = this.map.decor;
    this.paths = this.map.paths || [];
    this.mapSize = this.map.size;
    this.tileSize = this.map.tileSize;
    this.core.app.onMapReady();
  }

  readWorld(reader) {
    const me = {
      id: this.ownerPlayerId,
      x: reader.float32(),
      y: reader.float32(),
      aimAngle: reader.float32(),
      health: reader.uint8(),
      armor: reader.uint8(),
      stamina: reader.uint8(),
      flashlightOn: reader.uint8() === 1,
      alive: reader.uint8() === 1
    };
    const meFlags = reader.uint8();
    me.melee = !!(meFlags & 1);
    me.dash = !!(meFlags & 2);
    me.muzzle = !!(meFlags & 4);
    me.reload = !!(meFlags & 8);
    me.weapon = reader.uint8();
    me.ammoPistol = reader.uint8();
    me.reservePistol = reader.uint16();
    me.ammoRifle = reader.uint8();
    me.reserveRifle = reader.uint16();
    me.name = this.core.ui?.getNick?.() || "Игрок";
    me.skin = this.localSkin | 0;
    this.me = me;
    const playerCount = reader.uint16();
    const bulletCount = reader.uint16();
    const pickupCount = reader.uint16();
    const players = [];
    const bullets = [];
    const pickups = [];

    for (let i = 0; i < playerCount; i++) {
      const id = reader.uint32();
      const x = reader.float32();
      const y = reader.float32();
      const aimAngle = reader.float32();
      const health = reader.uint8();
      const armor = reader.uint8();
      const flags = reader.uint8();
      const weapon = reader.uint8();
      const skin = reader.uint8();
      const color = {
        r: reader.uint8(),
        g: reader.uint8(),
        b: reader.uint8()
      };
      const name = reader.utf16();
      players.push({
        id,
        x,
        y,
        aimAngle,
        health,
        armor,
        melee: !!(flags & 1),
        dash: !!(flags & 2),
        muzzle: !!(flags & 4),
        reload: !!(flags & 8),
        weapon,
        skin,
        color,
        name
      });
    }
    for (let i = 0; i < bulletCount; i++) {
      bullets.push({
        id: reader.uint32(),
        x: reader.float32(),
        y: reader.float32(),
        angle: reader.float32()
      });
    }
    for (let i = 0; i < pickupCount; i++) {
      pickups.push({
        id: reader.uint32(),
        x: reader.float32(),
        y: reader.float32(),
        type: reader.uint8()
      });
    }

    this.world = { me, players, bullets, pickups };
    this.core.app.onWorldUpdate(this.world);
    this.core.ui.onWorld(me, playerCount);
  }

  readLeaderboard(reader) {
    const count = reader.uint32();
    this.leaderboard = [];
    for (let i = 0; i < count; i++) {
      const id = reader.uint32();
      const name = reader.utf16();
      const kills = reader.uint32();
      const deaths = reader.uint32();
      const kd = kills / Math.max(1, deaths);
      this.leaderboard.push({
        id,
        name,
        kills,
        deaths,
        score: kills,
        kd,
        alive: true
      });
    }
    this.core.ui.updateLeaderboard(this.leaderboard, this.ownerPlayerId);
  }

  readDeath(reader) {
    const score = reader.uint32();
    const killer = reader.utf16();
    this.core.ui.onDeath(killer, score);
  }

  readKillFeed(reader) {
    const weapon = reader.uint8();
    const killerId = reader.uint32();
    const victimId = reader.uint32();
    const killerName = reader.utf16();
    const victimName = reader.utf16();
    this.core.ui.pushKillFeed({
      killerName,
      victimName,
      weapon,
      killerId,
      victimId,
      isMeKiller: killerId === this.ownerPlayerId,
      isMeVictim: victimId === this.ownerPlayerId
    });
  }
}
