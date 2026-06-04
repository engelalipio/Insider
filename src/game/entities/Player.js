import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { generatePlayerSheet, ANIM_FRAMES, FRAME_W, FRAME_H, TOTAL_FRAMES } from '../PlayerSprite.js';

export class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    // Generate sheet first, then create sprite from it
    generatePlayerSheet(scene);
    super(scene, x, y, 'player-sheet', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(16, 36);
    this.body.setOffset(6, 4);
    this.body.setGravityY(0);

    this.isDead      = false;
    this.isGrounded  = false;
    this._wasGrounded = false;
    this._landFrame  = 0;
    this._currentAnim = null;

    this._createAnims(scene);
  }

  _createAnims(scene) {
    const anims = scene.anims;

    // Helper to build frame array from sheet indices
    const frames = (indices) => indices.map(i => ({
      key: 'player-sheet',
      frame: i,
      // Phaser needs the frame as a number index into the canvas texture
    }));

    // Remove if already exist (hot reload safety)
    ['player-idle','player-run','player-jump','player-fall','player-land'].forEach(k => {
      if (anims.exists(k)) anims.remove(k);
    });

    anims.create({
      key: 'player-idle',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.IDLE }),
      frameRate: 2,
      repeat: -1,
    });

    anims.create({
      key: 'player-run',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.RUN }),
      frameRate: 12,
      repeat: -1,
    });

    anims.create({
      key: 'player-jump',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.JUMP }),
      frameRate: 1,
      repeat: 0,
    });

    anims.create({
      key: 'player-fall',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.FALL }),
      frameRate: 1,
      repeat: 0,
    });

    anims.create({
      key: 'player-land',
      frames: anims.generateFrameNumbers('player-sheet', { frames: ANIM_FRAMES.LAND }),
      frameRate: 8,
      repeat: 0,
    });

    // After land anim, go back to idle
    this.on('animationcomplete-player-land', () => {
      this._playAnim('player-idle');
    });
  }

  _playAnim(key) {
    if (this._currentAnim === key) return;
    this._currentAnim = key;
    this.play(key);
  }

  update(cursors, wasd, touch = {}) {
    if (this.isDead) return;

    this._wasGrounded = this.isGrounded;
    this.isGrounded   = this.body.blocked.down;

    const left  = cursors.left.isDown  || wasd.left.isDown  || !!touch.left;
    const right = cursors.right.isDown || wasd.right.isDown || !!touch.right;
    const jump  = Phaser.Input.Keyboard.JustDown(cursors.up) ||
                  Phaser.Input.Keyboard.JustDown(wasd.up)    ||
                  Phaser.Input.Keyboard.JustDown(cursors.space) ||
                  !!touch.jumpJustPressed;

    // ── MOVEMENT ──────────────────────────────────────────────────
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

    // ── ANIMATION STATE MACHINE ────────────────────────────────────
    const vy = this.body.velocity.y;
    const moving = left || right;

    // Just landed
    if (this.isGrounded && !this._wasGrounded) {
      this._playAnim('player-land');
      // Land squash
      this.setScale(1.2, 0.75);
    }

    if (this.isGrounded) {
      // Recover scale after land
      this.setScale(
        Phaser.Math.Linear(this.scaleX, 1, 0.25),
        Phaser.Math.Linear(this.scaleY, 1, 0.25)
      );

      if (this._currentAnim !== 'player-land') {
        if (moving) {
          this._playAnim('player-run');
        } else {
          this._playAnim('player-idle');
        }
      }
    } else {
      // In air — squash & stretch
      if (vy < 0) {
        this._playAnim('player-jump');
        this.setScale(
          Phaser.Math.Linear(this.scaleX, 0.88, 0.15),
          Phaser.Math.Linear(this.scaleY, 1.18, 0.15)
        );
      } else {
        this._playAnim('player-fall');
        this.setScale(
          Phaser.Math.Linear(this.scaleX, 1.1, 0.15),
          Phaser.Math.Linear(this.scaleY, 0.9, 0.15)
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

  die(callback) {
    if (this.isDead) return;
    this.isDead = true;
    this.stop();
    this.body.setVelocity(0, -180);
    this.body.setGravityY(200);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
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
    this.isDead = false;
    this._currentAnim = null;
    this.setPosition(x, y);
    this.setAlpha(0);
    this.setScale(1, 1);
    this.setAngle(0);
    this.body.setVelocity(0, 0);
    this.body.setGravityY(0);
    this._playAnim('player-idle');

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
    });
  }
}

