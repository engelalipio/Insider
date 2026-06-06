import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { audio } from '../AudioManager.js';

const STATE = { PATROL: 'patrol', ALERT: 'alert', CHASE: 'chase', RETURN: 'return' };
const PATROL_SPEED     = 65;
const CHASE_SPEED      = 155;
const DETECTION_RANGE  = 230;
const DETECTION_HEIGHT = 90;

export class Guard extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'guard');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(26, 40);
    this.body.setOffset(4, 2);
    this.body.setImmovable(false);
    this.body.allowGravity = true;

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.originX     = x;

    this.state       = STATE.PATROL;
    this.facingRight = true;

    // ── Combat ───────────────────────────────────────────────────
    this.hp              = GAME_CONFIG.guardMaxHp;
    this.isAlive         = true;
    this._invincible     = false;
    this._canDamagePlayer = true;

    // ── HP pip display (3 small rectangles above head) ───────────
    this._hpPips = [];
    for (let i = 0; i < GAME_CONFIG.guardMaxHp; i++) {
      const pip = scene.add.rectangle(x + (i - 1) * 9, y - 50, 7, 4, 0xcc2222).setDepth(22);
      this._hpPips.push(pip);
    }

    // Alert text
    this.alertText = scene.add.text(x, y - 38, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff4444',
    }).setOrigin(0.5).setDepth(22).setAlpha(0);

    // ── Flashlight cone ─────────────────────────────────────────
    this.flashlight   = scene.add.graphics().setDepth(13);
    this._flashAlpha  = 0.20;
    this._flashColor  = 0xffaa44;   // warm torch-like colour
    this._alertColor  = 0xff2222;   // red when hostile
  }

  // ── TAKE DAMAGE ──────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (!this.isAlive || this._invincible) return;
    this.hp -= amount;
    this._invincible = true;

    // Hit flash (white tint)
    this.setTint(0xffffff);
    // Emit hit particles from the scene
    this._spawnHitParticles();

    this.scene.time.delayedCall(180, () => {
      if (!this.isAlive) return;
      this.clearTint();
      this._invincible = false;
    });

    this._updateHpPips();

    if (this.hp <= 0) {
      this._die();
    } else {
      // Brief stagger — slow down for a moment
      this.body.setVelocityX(this.body.velocity.x * 0.3);
    }
  }

  _spawnHitParticles() {
    for (let i = 0; i < 6; i++) {
      const dot = this.scene.add.circle(
        this.x + Phaser.Math.Between(-10, 10),
        this.y + Phaser.Math.Between(-10, 6),
        Phaser.Math.Between(2, 5),
        0xcc2222, 0.9,
      ).setDepth(22);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-28, 28),
        y: dot.y + Phaser.Math.Between(-18, 12),
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(250, 450),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
    // Brief camera shake from scene
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(80, 0.004);
    }
  }

  _updateHpPips() {
    this._hpPips.forEach((pip, i) => {
      pip.setFillStyle(i < this.hp ? 0xcc2222 : 0x2a0000);
      pip.setAlpha(i < this.hp ? 1 : 0.3);
    });
  }

  _die() {
    this.isAlive = false;
    audio.playGuardDeath();

    // Disable physics
    this.body.enable = false;
    this._clearAlert();

    // Hide HP pips
    this._hpPips.forEach(p => p.destroy());
    this.flashlight.clear();

    // Blood burst
    for (let i = 0; i < 12; i++) {
      const dot = this.scene.add.circle(
        this.x + Phaser.Math.Between(-12, 12),
        this.y + Phaser.Math.Between(-10, 8),
        Phaser.Math.Between(2, 7),
        0x991111, 0.9,
      ).setDepth(22);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-40, 40),
        y: dot.y + Phaser.Math.Between(-30, 20),
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(350, 650),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }

    // Camera flash + shake
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(200, 0.008);
      this.scene.cameras.main.flash(120, 60, 0, 0);
    }

    // Death fall tween
    this.scene.tweens.add({
      targets: this,
      y: this.y + 24,
      alpha: 0,
      angle: this.facingRight ? 80 : -80,
      duration: 550,
      ease: 'Power2',
      onComplete: () => this.destroy(),
    });
  }

  // ── CONTACT DAMAGE (called from scene overlap) ───────────────────────────
  tryDamagePlayer(player) {
    if (!this.isAlive || !this._canDamagePlayer) return;
    this._canDamagePlayer = false;
    this.scene.time.delayedCall(GAME_CONFIG.guardDamageCooldown, () => {
      this._canDamagePlayer = true;
    });
    // Return true so scene can handle HP update / death check
    return player.takeDamage(GAME_CONFIG.guardDamage);
  }

  // ── MAIN UPDATE ──────────────────────────────────────────────────────────
  update(player) {
    if (!this.isAlive) return;

    // Sync HP pip + alert text positions
    this._syncOverlays();

    if (!player || player.isDead) {
      this._patrol();
      this._drawFlashlight();
      return;
    }

    const dx          = player.x - this.x;
    const dy          = player.y - this.y;
    const facingPlayer = this.facingRight ? dx > 0 : dx < 0;
    const inRange     = Math.abs(dx) < DETECTION_RANGE && Math.abs(dy) < DETECTION_HEIGHT;
    const detected    = inRange && facingPlayer;

    switch (this.state) {
      case STATE.PATROL:
        this._patrol();
        if (detected) {
          this.state = STATE.ALERT;
          this._setAlert('!');
        }
        break;

      case STATE.ALERT:
        this.body.setVelocityX(0);
        if (!this._alertTimer) {
          this._alertTimer = this.scene.time.delayedCall(550, () => {
            this.state = STATE.CHASE;
            this._alertTimer = null;
          });
        }
        if (!detected) {
          this.state = STATE.PATROL;
          this._clearAlert();
          if (this._alertTimer) { this._alertTimer.remove(); this._alertTimer = null; }
        }
        break;

      case STATE.CHASE:
        this._chase(player);
        if (!inRange) {
          this.state = STATE.RETURN;
          this._setAlert('?');
        }
        break;

      case STATE.RETURN:
        this._returnToOrigin();
        if (detected) {
          this.state = STATE.ALERT;
          this._setAlert('!');
        }
        break;
    }

    this._drawFlashlight();
  }

  _patrol() {
    if (this.facingRight) {
      this.body.setVelocityX(PATROL_SPEED);
      if (this.x >= this.patrolRight) this.facingRight = false;
    } else {
      this.body.setVelocityX(-PATROL_SPEED);
      if (this.x <= this.patrolLeft) this.facingRight = true;
    }
    this.setFlipX(!this.facingRight);
  }

  _chase(player) {
    const dx = player.x - this.x;
    this.facingRight = dx > 0;
    this.setFlipX(!this.facingRight);
    this.body.setVelocityX(dx > 0 ? CHASE_SPEED : -CHASE_SPEED);
    this._setAlert('!');
  }

  _returnToOrigin() {
    const dx = this.originX - this.x;
    if (Math.abs(dx) < 10) {
      this.body.setVelocityX(0);
      this.state = STATE.PATROL;
      this._clearAlert();
    } else {
      this.facingRight = dx > 0;
      this.setFlipX(!this.facingRight);
      this.body.setVelocityX(dx > 0 ? PATROL_SPEED : -PATROL_SPEED);
    }
  }

  _drawFlashlight() {
    if (!this.isAlive) { this.flashlight.clear(); return; }
    this.flashlight.clear();

    const isAlert = this.state === STATE.ALERT || this.state === STATE.CHASE;
    const color   = isAlert ? this._alertColor : this._flashColor;
    const alpha   = isAlert ? 0.28 : this._flashAlpha;
    const length  = isAlert ? DETECTION_RANGE : DETECTION_RANGE * 0.80;
    const spread  = isAlert ? 42 : 30;

    this.flashlight.fillStyle(color, alpha);
    const ox = this.x + (this.facingRight ? 14 : -14);
    const oy = this.y;
    const tx = this.facingRight ? ox + length : ox - length;

    this.flashlight.fillTriangle(ox, oy - 6, ox, oy + 6, tx, oy + spread);
    this.flashlight.fillTriangle(ox, oy - 6, tx, oy - spread, tx, oy + spread);
    // Bright inner core
    this.flashlight.fillStyle(color, alpha * 0.55);
    this.flashlight.fillTriangle(ox, oy - 3, ox, oy + 3, tx, oy + spread * 0.4);
    this.flashlight.fillTriangle(ox, oy - 3, tx, oy - spread * 0.4, tx, oy + spread * 0.4);
  }

  _syncOverlays() {
    this.alertText.setPosition(this.x, this.y - 40);
    const baseX = this.x - (GAME_CONFIG.guardMaxHp - 1) * 4.5;
    this._hpPips.forEach((pip, i) => {
      pip.setPosition(baseX + i * 9, this.y - 50);
    });
  }

  _setAlert(symbol) {
    this.alertText.setText(symbol);
    this.scene.tweens.add({ targets: this.alertText, alpha: 1, duration: 180 });
  }

  _clearAlert() {
    this.scene.tweens.add({ targets: this.alertText, alpha: 0, duration: 350 });
  }

  isChasingPlayer() { return this.state === STATE.CHASE; }

  destroy() {
    if (this.alertText && this.alertText.active) this.alertText.destroy();
    if (this.flashlight && this.flashlight.active) this.flashlight.destroy();
    this._hpPips.forEach(p => { if (p && p.active) p.destroy(); });
    super.destroy();
  }
}
