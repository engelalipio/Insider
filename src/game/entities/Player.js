import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { generatePlayerSheet, ANIM_FRAMES } from '../PlayerSprite.js';
import { audio } from '../AudioManager.js';

export class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    generatePlayerSheet(scene);
    super(scene, x, y, 'player-sheet', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(16, 36);
    this.body.setOffset(6, 4);
    this.body.setGravityY(0);

    // ── State flags ──────────────────────────────────────────────
    this.isDead         = false;
    this.isGrounded     = false;
    this._wasGrounded   = false;
    this._landFrame     = 0;
    this._currentAnim   = null;
    this._isRespawning  = false;

    // ── Combat ───────────────────────────────────────────────────
    this.hp              = GAME_CONFIG.maxHp;
    this._isAttacking    = false;
    this._attackCooldown = false;
    this._invincible     = false;
    this._flashEvent     = null;

    // ── Input keys (Z or X to attack) ───────────────────────────
    this._attackKeyZ = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this._attackKeyX = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this._createAnims(scene);
  }

  _createAnims(scene) {
    const anims = scene.anims;
    const keys = [
      'player-idle','player-run','player-jump',
      'player-fall','player-land','player-attack',
    ];
    keys.forEach(k => { if (anims.exists(k)) anims.remove(k); });

    anims.create({
      key: 'player-idle',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.IDLE }),
      frameRate: 2, repeat: -1,
    });
    anims.create({
      key: 'player-run',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.RUN }),
      frameRate: 12, repeat: -1,
    });
    anims.create({
      key: 'player-jump',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.JUMP }),
      frameRate: 1, repeat: 0,
    });
    anims.create({
      key: 'player-fall',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.FALL }),
      frameRate: 1, repeat: 0,
    });
    anims.create({
      key: 'player-land',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.LAND }),
      frameRate: 8, repeat: 0,
    });
    anims.create({
      key: 'player-attack',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.ATTACK }),
      frameRate: 18, repeat: 0,
    });

    this.on('animationcomplete-player-land', () => this._playAnim('player-idle'));
    this.on('animationcomplete-player-attack', () => {
      this._isAttacking = false;
      this._playAnim('player-idle');
    });
  }

  _playAnim(key) {
    if (this._currentAnim === key) return;
    if (!this.scene.anims.exists(key)) return;
    this._currentAnim = key;
    this.play(key);
  }

  // ── ATTACK ────────────────────────────────────────────────────────────────
  _doAttack() {
    if (this._isAttacking || this._attackCooldown || this.isDead || this._isRespawning) return;
    this._isAttacking    = true;
    this._attackCooldown = true;
    this._currentAnim    = null; // force anim switch
    this._playAnim('player-attack');
    audio.playAttack();

    // Signal scene to activate the hitbox
    const facingRight = !this.flipX;
    this.scene.events.emit('player-attack', this.x, this.y, facingRight);

    // Cooldown resets slightly after attack finishes
    this.scene.time.delayedCall(380, () => { this._attackCooldown = false; });
  }

  // ── TAKE DAMAGE ───────────────────────────────────────────────────────────
  // Returns true if this hit kills the player.
  takeDamage(amount) {
    if (this._invincible || this.isDead || this._isRespawning) return false;
    this.hp = Math.max(0, this.hp - amount);
    this._invincible = true;

    // Invincibility-frame flash (visible / invisible alternating)
    if (this._flashEvent) { this._flashEvent.remove(); this._flashEvent = null; }
    let tick = 0;
    this._flashEvent = this.scene.time.addEvent({
      delay: 90,
      repeat: Math.floor(GAME_CONFIG.invincibilityTime / 90) - 1,
      callback: () => {
        tick++;
        this.setVisible(tick % 2 === 0);
      },
    });
    this.scene.time.delayedCall(GAME_CONFIG.invincibilityTime, () => {
      this._invincible = false;
      this.setVisible(true);
      if (this._flashEvent) { this._flashEvent.remove(); this._flashEvent = null; }
    });

    return this.hp <= 0;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  update(cursors, wasd, touch = {}) {
    if (this.isDead || this._isRespawning) return;

    this._wasGrounded = this.isGrounded;
    this.isGrounded   = this.body.blocked.down;

    const left  = cursors.left.isDown  || wasd.left.isDown  || !!touch.left;
    const right = cursors.right.isDown || wasd.right.isDown || !!touch.right;
    const jump  = Phaser.Input.Keyboard.JustDown(cursors.up)    ||
                  Phaser.Input.Keyboard.JustDown(wasd.up)        ||
                  Phaser.Input.Keyboard.JustDown(cursors.space)  ||
                  !!touch.jumpJustPressed;
    const attack = Phaser.Input.Keyboard.JustDown(this._attackKeyZ) ||
                   Phaser.Input.Keyboard.JustDown(this._attackKeyX) ||
                   !!touch.attackJustPressed;

    if (attack) this._doAttack();

    // ── MOVEMENT ────────────────────────────────────────────────────────────
    if (left) {
      this.body.setVelocityX(-GAME_CONFIG.playerSpeed);
      this.setFlipX(true);
      if (this.isGrounded) this._runEffect();
    } else if (right) {
      this.body.setVelocityX(GAME_CONFIG.playerSpeed);
      this.setFlipX(false);
      if (this.isGrounded) this._runEffect();
    } else {
      this.body.setVelocityX(0);
    }

    if (jump && this.isGrounded) {
      this.body.setVelocityY(GAME_CONFIG.jumpVelocity);
    }

    // ── ANIMATION STATE MACHINE ─────────────────────────────────────────────
    // Don't interrupt attack animation
    if (this._isAttacking) return;

    const vy     = this.body.velocity.y;
    const moving = left || right;

    if (this.isGrounded && !this._wasGrounded) {
      this._playAnim('player-land');
      this.setScale(1.2, 0.75);
    }

    if (this.isGrounded) {
      this.setScale(
        Phaser.Math.Linear(this.scaleX, 1, 0.25),
        Phaser.Math.Linear(this.scaleY, 1, 0.25),
      );
      if (this._currentAnim !== 'player-land') {
        this._playAnim(moving ? 'player-run' : 'player-idle');
      }
    } else {
      if (vy < 0) {
        this._playAnim('player-jump');
        this.setScale(
          Phaser.Math.Linear(this.scaleX, 0.88, 0.15),
          Phaser.Math.Linear(this.scaleY, 1.18, 0.15),
        );
      } else {
        this._playAnim('player-fall');
        this.setScale(
          Phaser.Math.Linear(this.scaleX, 1.1, 0.15),
          Phaser.Math.Linear(this.scaleY, 0.9, 0.15),
        );
      }
    }

    // Idle subtle bob
    if (!moving && this.isGrounded && this._currentAnim !== 'player-land') {
      this.y += Math.sin(this.scene.time.now * 0.003) * 0.2;
    }
  }

  _runEffect() {
    this.scene.events.emit('player-step', this.x, this.y + 18);
  }

  // ── DIE / RESPAWN ─────────────────────────────────────────────────────────
  die(callback) {
    if (this.isDead || this._isRespawning) return;
    this.isDead = true;
    // Cancel invincibility flash
    if (this._flashEvent) { this._flashEvent.remove(); this._flashEvent = null; }
    this.setVisible(true);
    this._invincible = false;

    this.scene.tweens.killTweensOf(this);
    this.stop();
    this.body.enable = false;
    this.body.setVelocity(0, 0);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.1, scaleY: 0.1,
      angle: Phaser.Math.Between(-90, 90),
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.setAngle(0);
        if (callback) callback();
      },
    });
  }

  respawn(x, y) {
    this.isDead         = false;
    this._isRespawning  = true;
    this._isAttacking   = false;
    this._attackCooldown = false;
    this._invincible    = false;
    this._currentAnim   = null;
    this.hp             = GAME_CONFIG.maxHp;
    this.setPosition(x, y);
    this.setAlpha(0);
    this.setScale(1, 1);
    this.setAngle(0);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
    this.body.setGravityY(0);
    this._playAnim('player-idle');

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
      onComplete: () => { this._isRespawning = false; },
    });
  }
}
