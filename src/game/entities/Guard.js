import Phaser from 'phaser';

const STATE = { PATROL: 'patrol', ALERT: 'alert', CHASE: 'chase', RETURN: 'return' };
const PATROL_SPEED = 60;
const CHASE_SPEED  = 160;
const DETECTION_RANGE  = 220;
const DETECTION_HEIGHT = 80;

export class Guard extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'guard');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(28, 40);
    this.body.setOffset(4, 2);
    this.body.setImmovable(false);
    this.body.allowGravity = true;

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.originX = x;

    this.state      = STATE.PATROL;
    this.facingRight = true;

    // Alert text
    this.alertText = scene.add.text(x, y - 36, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cc4444',
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // ── FLASHLIGHT CONE (Graphics drawn each frame) ───────────────
    this.flashlight = scene.add.graphics().setDepth(13);
    this._flashAlpha  = 0.18;
    this._flashColor  = 0xffee88;
    this._alertColor  = 0xff4444;
  }

  update(player) {
    if (!player || player.isDead) {
      this._patrol();
      this._drawFlashlight();
      this._syncAlert();
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const facingPlayer = this.facingRight ? dx > 0 : dx < 0;
    const inRange  = Math.abs(dx) < DETECTION_RANGE && Math.abs(dy) < DETECTION_HEIGHT;
    const detected = inRange && facingPlayer;

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
          this._alertTimer = this.scene.time.delayedCall(600, () => {
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
    this._syncAlert();
  }

  _drawFlashlight() {
    this.flashlight.clear();

    const isAlert = this.state === STATE.ALERT || this.state === STATE.CHASE;
    const color   = isAlert ? this._alertColor : this._flashColor;
    const alpha   = isAlert ? 0.28 : this._flashAlpha;
    const length  = isAlert ? DETECTION_RANGE : DETECTION_RANGE * 0.85;
    const spread  = isAlert ? 38 : 28; // half-height of cone at tip

    this.flashlight.fillStyle(color, alpha);

    const ox = this.x + (this.facingRight ? 14 : -14);
    const oy = this.y;
    const tx = this.facingRight ? ox + length : ox - length;

    // Draw cone as triangle
    this.flashlight.fillTriangle(
      ox, oy - 6,
      ox, oy + 6,
      tx, oy + spread
    );
    this.flashlight.fillTriangle(
      ox, oy - 6,
      tx, oy - spread,
      tx, oy + spread
    );

    // Bright inner core
    this.flashlight.fillStyle(color, alpha * 0.6);
    this.flashlight.fillTriangle(
      ox, oy - 3,
      ox, oy + 3,
      tx, oy + spread * 0.4
    );
    this.flashlight.fillTriangle(
      ox, oy - 3,
      tx, oy - spread * 0.4,
      tx, oy + spread * 0.4
    );
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

  _setAlert(symbol) {
    this.alertText.setText(symbol);
    this.scene.tweens.add({ targets: this.alertText, alpha: 1, duration: 200 });
  }

  _clearAlert() {
    this.scene.tweens.add({ targets: this.alertText, alpha: 0, duration: 400 });
  }

  _syncAlert() {
    this.alertText.setPosition(this.x, this.y - 36);
  }

  isChasingPlayer() {
    return this.state === STATE.CHASE;
  }

  destroy() {
    this.alertText.destroy();
    this.flashlight.destroy();
    super.destroy();
  }
}

