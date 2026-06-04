import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';

export class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(18, 38);
    this.body.setOffset(5, 2);
    this.body.setGravityY(0);

    this.isDead = false;
    this.isGrounded = false;
    this.deathCallback = null;

    // Create animations programmatically
    this._createAnims(scene);
  }

  _createAnims(scene) {
    // We only have a static texture so we'll use tint/scale tricks for now
    // In a real game you'd have sprite sheets here
  }

  update(cursors, wasd, touch = {}) {
    if (this.isDead) return;

    this.isGrounded = this.body.blocked.down;

    const left  = cursors.left.isDown  || wasd.left.isDown  || !!touch.left;
    const right = cursors.right.isDown || wasd.right.isDown || !!touch.right;
    const jump  = Phaser.Input.Keyboard.JustDown(cursors.up) ||
                  Phaser.Input.Keyboard.JustDown(wasd.up)    ||
                  Phaser.Input.Keyboard.JustDown(cursors.space) ||
                  !!touch.jumpJustPressed;

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

    // Subtle idle bob
    if (!left && !right && this.isGrounded) {
      this.y += Math.sin(this.scene.time.now * 0.003) * 0.3;
    }

    // Squash & stretch
    if (!this.isGrounded) {
      const vy = this.body.velocity.y;
      const scaleY = vy < 0 ? 1.15 : 0.9;
      const scaleX = vy < 0 ? 0.88 : 1.08;
      this.setScale(
        Phaser.Math.Linear(this.scaleX, scaleX, 0.2),
        Phaser.Math.Linear(this.scaleY, scaleY, 0.2)
      );
    } else {
      this.setScale(
        Phaser.Math.Linear(this.scaleX, 1, 0.3),
        Phaser.Math.Linear(this.scaleY, 1, 0.3)
      );
    }
  }

  _runEffect() {
    // Subtle footstep dust — emitted via scene event
    this.scene.events.emit('player-step', this.x, this.y + 18);
  }

  die(callback) {
    if (this.isDead) return;
    this.isDead = true;
    this.body.setVelocity(0, -200);
    this.body.setGravityY(200);

    // Flash red then fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        if (callback) callback();
      }
    });
  }

  respawn(x, y) {
    this.isDead = false;
    this.setPosition(x, y);
    this.setAlpha(0);
    this.setScale(1, 1);
    this.body.setVelocity(0, 0);
    this.body.setGravityY(0);

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 600,
      ease: 'Power2'
    });
  }
}

