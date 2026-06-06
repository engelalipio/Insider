import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { Guard } from '../entities/Guard.js';
import { GAME_CONFIG } from '../config.js';
import { audio } from '../AudioManager.js';
import { _drawAMSLogo } from './SplashScene.js';

const WORLD_WIDTH = 2800;
const GROUND_Y    = 340;

const PLATFORMS = [
  { x: 200, y: 290, w: 4 },
  { x: 420, y: 250, w: 3 },
  { x: 600, y: 290, w: 4 },
  { x: 820, y: 220, w: 5 },
  { x: 1060, y: 260, w: 3 },
  { x: 1240, y: 230, w: 4 },
  { x: 1480, y: 260, w: 5 },
  { x: 1720, y: 240, w: 3 },
  { x: 1920, y: 270, w: 4 },
  { x: 2160, y: 240, w: 5 },
  { x: 2420, y: 260, w: 4 },
];

const HAZARDS = [
  { x: 300, y: 338 },
  { x: 500, y: 338 },
  { x: 700, y: 338 },
  { x: 1000, y: 338 },
  { x: 1300, y: 338 },
  { x: 1600, y: 338 },
  { x: 1850, y: 338 },
  { x: 2100, y: 338 },
  { x: 2350, y: 338 },
];

const GUARDS_DATA = [
  { x: 380,  patrolLeft: 260,  patrolRight: 520  },
  { x: 700,  patrolLeft: 580,  patrolRight: 820  },
  { x: 1000, patrolLeft: 860,  patrolRight: 1120 },
  { x: 1360, patrolLeft: 1200, patrolRight: 1560 },
  { x: 1700, patrolLeft: 1560, patrolRight: 1880 },
  { x: 2000, patrolLeft: 1880, patrolRight: 2180 },
  { x: 2300, patrolLeft: 2160, patrolRight: 2480 },
];

const CHECKPOINTS = [700, 1400, 2100];

export class Level2Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Level2Scene' });
    this.checkpointX = 60;
    this.checkpointY = GROUND_Y - 40;
    this.deathCount  = 0;
    this._won        = false;
    this._killing    = false;
    this.touch = {
      left: false, right: false,
      jump: false, jumpJustPressed: false,
      attack: false, attackJustPressed: false,
    };
    this._prevJump   = false;
    this._prevAttack = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#060610');

    // ── PARALLAX ─────────────────────────────────────────────────
    this.bgSky  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'sky2').setOrigin(0).setDepth(0).setScrollFactor(0);
    this.bgFar  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-far').setOrigin(0).setDepth(1).setScrollFactor(0);
    this.bgMid  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-mid').setOrigin(0).setDepth(2).setScrollFactor(0);
    this.bgNear = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-near').setOrigin(0).setDepth(3).setScrollFactor(0);

    // ── PHYSICS ───────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, 500);

    // ── GROUND ────────────────────────────────────────────────────
    this.groundGroup = this.physics.add.staticGroup();
    for (let i = 0; i < Math.ceil(WORLD_WIDTH / 32); i++) {
      const tile = this.groundGroup.create(i * 32 + 16, GROUND_Y + 16, 'ground');
      tile.setDepth(10);
      tile.refreshBody();
    }

    // ── PLATFORMS ─────────────────────────────────────────────────
    this.platformGroup = this.physics.add.staticGroup();
    PLATFORMS.forEach(p => {
      for (let i = 0; i < p.w; i++) {
        const tile = this.platformGroup.create(p.x + i * 32 + 16, p.y + 8, 'platform');
        tile.setDepth(10);
        tile.refreshBody();
      }
    });

    // ── HAZARDS ───────────────────────────────────────────────────
    this.hazardGroup = this.physics.add.staticGroup();
    HAZARDS.forEach(h => {
      const haz = this.hazardGroup.create(h.x + 32, h.y + 10, 'hazard');
      haz.setDepth(10);
      haz.body.setSize(64, 16);
      haz.refreshBody();
    });

    // ── CHECKPOINTS ───────────────────────────────────────────────
    this.checkpointGroup = this.physics.add.staticGroup();
    CHECKPOINTS.forEach(cx => {
      const cp = this.checkpointGroup.create(cx, GROUND_Y - 20, 'checkpoint');
      cp.setDepth(9);
      cp.body.setSize(24, 40);
      cp.refreshBody();
    });

    // ── EXIT DOOR ─────────────────────────────────────────────────
    this._buildExitDoor();

    // ── PLAYER ────────────────────────────────────────────────────
    this.player = new Player(this, 60, GROUND_Y - 40);
    this.player.setDepth(15);

    // ── GUARDS ────────────────────────────────────────────────────
    this.guards = GUARDS_DATA.map(g => {
      const guard = new Guard(this, g.x, GROUND_Y - 22, g.patrolLeft, g.patrolRight);
      guard.setDepth(14);
      return guard;
    });

    // ── ATTACK HITBOX ─────────────────────────────────────────────
    this._buildAttackHitbox();

    // ── COLLIDERS ─────────────────────────────────────────────────
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.guards.forEach(g => {
      this.physics.add.collider(g, this.groundGroup);
      this.physics.add.collider(g, this.platformGroup);
    });

    // ── OVERLAPS ──────────────────────────────────────────────────
    this.physics.add.overlap(this.player, this.hazardGroup,     this._killPlayer,    null, this);
    this.physics.add.overlap(this.player, this.checkpointGroup, this._hitCheckpoint,  null, this);
    this.physics.add.overlap(this.player, this.exitZone,        this._winGame,        null, this);

    // Guards deal damage
    this.guards.forEach(guard => {
      this.physics.add.overlap(this.player, guard, () => {
        if (!guard.isAlive) return;
        const killed = guard.tryDamagePlayer(this.player);
        this._updateHpDisplay();
        if (killed) {
          this._killPlayer();
        } else if (guard._canDamagePlayer === false) {
          audio.playHit();
          this.cameras.main.shake(120, 0.005);
          this.cameras.main.flash(80, 80, 0, 0);
        }
      }, null, this);
    });

    // Player attack hits guards
    this.physics.add.overlap(this.attackHitbox, this.guards, (hitbox, guard) => {
      if (guard.isAlive) guard.takeDamage(GAME_CONFIG.attackDamage);
    }, null, this);

    // ── CAMERA ────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 400);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(120, 60);

    // ── INPUT ─────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    };
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── PARTICLES ─────────────────────────────────────────────────
    this.dustEmitter = this.add.particles(0, 0, 'dust', {
      speed: { min: 10, max: 40 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400, quantity: 2, emitting: false,
    }).setDepth(16);

    this.events.on('player-step', (x, y) => {
      if (this.time.now % 120 < 60) this.dustEmitter.emitParticleAt(x, y, 3);
      if (this.time.now % 240 < 120) audio.playFootstep();
    });

    // ── ATTACK VISUAL / HITBOX ACTIVATION ─────────────────────────
    this.events.on('player-attack', (px, py, facingRight) => {
      const hx = facingRight ? px + 32 : px - 32;
      this.attackHitbox.setPosition(hx, py - 4);
      this.attackHitbox.body.reset(hx, py - 4);
      this.attackHitbox.body.enable = true;

      const slash = this.add.graphics().setDepth(25);
      slash.lineStyle(3, 0xffd060, 0.95);
      slash.beginPath();
      if (facingRight) {
        slash.arc(px + 10, py - 4, 28, -0.55, 0.55);
      } else {
        slash.arc(px - 10, py - 4, 28, Math.PI - 0.55, Math.PI + 0.55);
      }
      slash.strokePath();
      slash.lineStyle(1, 0xffffff, 0.7);
      slash.beginPath();
      if (facingRight) {
        slash.arc(px + 10, py - 4, 24, -0.4, 0.4);
      } else {
        slash.arc(px - 10, py - 4, 24, Math.PI - 0.4, Math.PI + 0.4);
      }
      slash.strokePath();
      this.tweens.add({
        targets: slash, alpha: 0, scaleX: 1.4, scaleY: 1.4,
        duration: 180, onComplete: () => slash.destroy(),
      });
      this.time.delayedCall(200, () => { this.attackHitbox.body.enable = false; });
    });

    // ── RAIN ──────────────────────────────────────────────────────
    this._buildRain();

    // ── FOG ───────────────────────────────────────────────────────
    this.fogOverlay = this.add.image(0, 0, 'fog')
      .setOrigin(0).setDepth(30).setScrollFactor(0).setAlpha(0.1);

    // ── UI ────────────────────────────────────────────────────────
    this._buildUI();
    this._buildVignette();
    this._buildTouchControls();
    this._buildWatermark();

    // ── AUDIO ─────────────────────────────────────────────────────
    audio.startAmbient();
    audio.startRain();
    this._scheduleFlicker();

    // Level title
    this.time.delayedCall(300, () => {
      const t = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 - 20, 'LEVEL 2', {
        fontFamily: '"Courier New", monospace',
        fontSize: '28px', color: '#445566',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0);
      this.tweens.add({
        targets: t, alpha: 0.8, duration: 800, yoyo: true, hold: 1000,
        onComplete: () => t.destroy(),
      });
    });
  }

  _buildAttackHitbox() {
    this.attackHitbox = this.add.rectangle(0, 0, 44, 30, 0xffd060, 0).setDepth(24);
    this.physics.add.existing(this.attackHitbox, false);
    this.attackHitbox.body.enable       = false;
    this.attackHitbox.body.allowGravity = false;
    this.attackHitbox.body.immovable    = true;
  }

  _buildExitDoor() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x223344, 1);
    g.fillRect(0, 0, 40, 70);
    g.fillStyle(0x44aaff, 0.8);
    g.fillRect(4, 4, 32, 62);
    g.fillStyle(0xaaddff, 0.6);
    g.fillRect(10, 10, 20, 50);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(16, 16, 8, 38);
    g.generateTexture('exit-door', 40, 70);
    g.destroy();

    const doorX = WORLD_WIDTH - 80;
    const doorY = GROUND_Y - 35;
    this.exitDoorSprite = this.add.image(doorX, doorY, 'exit-door').setDepth(11);
    this.tweens.add({
      targets: this.exitDoorSprite,
      alpha: { from: 0.8, to: 1 },
      scaleX: { from: 1, to: 1.04 },
      scaleY: { from: 1, to: 1.04 },
      duration: 1200, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.exitZone = this.physics.add.staticImage(doorX, doorY, 'exit-door');
    this.exitZone.setDepth(11);
    this.exitZone.body.setSize(40, 70);
    this.exitZone.setAlpha(0);
    this.exitZone.refreshBody();
  }

  _buildRain() {
    const rg = this.make.graphics({ x: 0, y: 0, add: false });
    rg.fillStyle(0x88aacc, 0.6);
    rg.fillRect(0, 0, 1, 8);
    rg.generateTexture('raindrop', 1, 8);
    rg.destroy();
    this.rainEmitter = this.add.particles(0, 0, 'raindrop', {
      x: { min: 0, max: GAME_CONFIG.width },
      y: -10,
      speedY: { min: 300, max: 500 },
      speedX: { min: -20, max: -10 },
      lifespan: 1000, quantity: 4,
      scale: { min: 0.8, max: 1.2 },
      alpha: { start: 0.5, end: 0 }, emitting: true,
    }).setDepth(25).setScrollFactor(0);
  }

  _buildUI() {
    this.add.text(16, 10, '❤', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px', color: '#cc2222',
    }).setScrollFactor(0).setDepth(50);

    this.hpPips = [];
    for (let i = 0; i < GAME_CONFIG.maxHp; i++) {
      const pip = this.add.rectangle(36 + i * 16, 16, 10, 10, 0xcc2222)
        .setAngle(45).setScrollFactor(0).setDepth(50);
      this.hpPips.push(pip);
    }

    this.add.text(16, GAME_CONFIG.height - 32, 'Z / X  attack', {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px', color: '#556644',
    }).setScrollFactor(0).setDepth(50);

    this.deathText = this.add.text(GAME_CONFIG.width - 16, 12, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px', color: '#334455',
    }).setScrollFactor(0).setDepth(50).setOrigin(1, 0);

    this.cpFlash = this.add.text(GAME_CONFIG.width / 2, 30, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px', color: '#445566', alpha: 0,
    }).setScrollFactor(0).setDepth(50).setOrigin(0.5);
  }

  _updateHpDisplay() {
    this.hpPips.forEach((pip, i) => {
      pip.setFillStyle(i < this.player.hp ? 0xcc2222 : 0x2a0000);
      pip.setAlpha(i < this.player.hp ? 1 : 0.3);
    });
  }

  _buildVignette() {
    const w = GAME_CONFIG.width, h = GAME_CONFIG.height;
    const vGfx = this.make.graphics({ x: 0, y: 0, add: false });
    for (let i = 0; i < 12; i++) {
      const margin = i * 14;
      vGfx.fillStyle(0x000005, (12 - i) * 0.022);
      vGfx.fillRect(margin, margin, w - margin * 2, h - margin * 2);
    }
    vGfx.generateTexture('vignette2', w, h);
    vGfx.destroy();
    this.add.image(0, 0, 'vignette2').setOrigin(0).setDepth(40).setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  _buildTouchControls() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const btnSize = 68, pad = 14;
    const btnY = H - pad - btnSize / 2;
    const alpha = 0.35;

    const makeBtn = (key, color) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 0.5);
      g.fillRoundedRect(0, 0, btnSize, btnSize, 14);
      g.lineStyle(2, color, 0.9);
      g.strokeRoundedRect(1, 1, btnSize - 2, btnSize - 2, 14);
      g.generateTexture(key + '2', btnSize, btnSize);
      g.destroy();
    };

    makeBtn('btn-left',   0x4488cc);
    makeBtn('btn-right',  0x4488cc);
    makeBtn('btn-jump',   0x88cc44);
    makeBtn('btn-attack', 0xcc8822);

    const leftBtn   = this.add.image(pad + btnSize / 2,            btnY, 'btn-left2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const rightBtn  = this.add.image(pad + btnSize * 1.5 + 10,     btnY, 'btn-right2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const jumpBtn   = this.add.image(W - pad - btnSize / 2,        btnY, 'btn-jump2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const attackBtn = this.add.image(W - pad - btnSize * 1.5 - 10, btnY, 'btn-attack2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();

    const ls = { fontFamily: 'monospace', fontSize: '20px', color: '#aaccff' };
    const js = { fontFamily: 'monospace', fontSize: '20px', color: '#aaffaa' };
    const as = { fontFamily: 'monospace', fontSize: '20px', color: '#ffcc88' };
    this.add.text(pad + btnSize / 2,            btnY, '◀', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(pad + btnSize * 1.5 + 10,     btnY, '▶', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(W - pad - btnSize / 2,        btnY, '▲', js).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(W - pad - btnSize * 1.5 - 10, btnY, '⚔', as).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);

    const bindBtn = (btn, key) => {
      btn.on('pointerdown', () => { this.touch[key] = true;  btn.setAlpha(0.75); });
      btn.on('pointerup',   () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerout',  () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerupoutside', () => { this.touch[key] = false; btn.setAlpha(alpha); });
    };
    bindBtn(leftBtn,   'left');
    bindBtn(rightBtn,  'right');
    bindBtn(jumpBtn,   'jump');
    bindBtn(attackBtn, 'attack');

    this.input.on('pointerup', () => {
      this.touch.left = this.touch.right = this.touch.jump = this.touch.attack = false;
      [leftBtn, rightBtn, jumpBtn, attackBtn].forEach(b => b.setAlpha(alpha));
    });
    this.input.addPointer(3);
  }

  _buildWatermark() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 60;
    const ctx = canvas.getContext('2d');
    _drawAMSLogo(ctx, 30, 30, 28, 0.5);
    const key = 'ams-watermark-' + this.scene.key;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
    this.add.image(this.scale.width - 38, 22, key)
      .setScrollFactor(0).setDepth(55).setAlpha(0.18);
  }

  _hitCheckpoint(player, cp) {
    if (cp.x > this.checkpointX) {
      this.checkpointX = cp.x;
      this.checkpointY = cp.y - 20;
      cp.setAlpha(0.2);
      audio.playCheckpoint();
      this.cpFlash.setText('checkpoint').setAlpha(0.8);
      this.tweens.add({ targets: this.cpFlash, alpha: 0, delay: 1200, duration: 800 });
    }
  }

  _killPlayer() {
    if (this.player.isDead || this.player._isRespawning || this._killing) return;
    this._killing = true;
    this.deathCount++;
    this.deathText.setText(`deaths: ${this.deathCount}`);
    audio.playDeath();
    this.cameras.main.flash(200, 80, 0, 0);
    this.cameras.main.shake(300, 0.008);

    for (let i = 0; i < 10; i++) {
      const px = this.player.x + Phaser.Math.Between(-8, 8);
      const py = this.player.y + Phaser.Math.Between(-8, 8);
      const dot = this.add.circle(px, py, Phaser.Math.Between(2, 5), 0x661111, 0.9).setDepth(20);
      this.tweens.add({
        targets: dot,
        x: px + Phaser.Math.Between(-40, 40),
        y: py + Phaser.Math.Between(-30, 20),
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(300, 600), ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }

    this.player.die(() => {
      this.player.hp = GAME_CONFIG.maxHp;
      this._updateHpDisplay();
      this.cameras.main.fade(400, 0, 0, 0);
      this.time.delayedCall(450, () => {
        this.player.respawn(this.checkpointX, this.checkpointY);
        this._updateHpDisplay();
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(650, () => { this._killing = false; });
      });
    });
  }

  _winGame() {
    if (this._won) return;
    this._won = true;
    audio.playWin();
    audio.stopAmbient();
    audio.stopRain();

    this.cameras.main.fade(1500, 255, 255, 255);

    const prev = localStorage.getItem('ams-best-deaths');
    if (prev === null || this.deathCount < parseInt(prev)) {
      localStorage.setItem('ams-best-deaths', this.deathCount);
    }

    const win = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 - 30, 'YOU ESCAPED', {
      fontFamily: '"Courier New", monospace',
      fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);

    const sub = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 + 10,
      `deaths: ${this.deathCount}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px', color: '#aabbcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);

    this.tweens.add({ targets: [win, sub], alpha: 1, delay: 400, duration: 1000 });
  }

  _scheduleFlicker() {
    this.time.addEvent({
      delay: Phaser.Math.Between(3000, 9000),
      callback: () => {
        this.tweens.add({
          targets: this.fogOverlay,
          alpha: { from: 0.25, to: 0.45 },
          duration: Phaser.Math.Between(80, 220),
          yoyo: true, ease: 'Stepped',
        });
        this._scheduleFlicker();
      },
    });
  }

  update() {
    this.touch.jumpJustPressed   = this.touch.jump   && !this._prevJump;
    this.touch.attackJustPressed = this.touch.attack && !this._prevAttack;
    this._prevJump   = this.touch.jump;
    this._prevAttack = this.touch.attack;

    this.player.update(this.cursors, this.wasd, this.touch);

    this.guards = this.guards.filter(g => g.active);
    this.guards.forEach(g => g.update(this.player));

    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.05;
    this.bgMid.tilePositionX  = cam.scrollX * 0.25;
    this.bgNear.tilePositionX = cam.scrollX * 0.6;
  }
}
