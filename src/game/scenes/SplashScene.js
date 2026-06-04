import Phaser from 'phaser';

// ── SplashScene ───────────────────────────────────────────────────────────────
// Shows the AMS logo for ~2.5s then transitions to MenuScene.
// The logo is drawn procedurally on a canvas to match the uploaded asset.

export class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Black background
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000);

    // Draw AMS logo onto canvas texture
    const canvas = document.createElement('canvas');
    canvas.width  = 260;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');

    _drawAMSLogo(ctx, 130, 130, 110);

    if (this.textures.exists('ams-logo-splash')) this.textures.remove('ams-logo-splash');
    this.textures.addCanvas('ams-logo-splash', canvas);

    const logo = this.add.image(W / 2, H / 2, 'ams-logo-splash')
      .setAlpha(0)
      .setScale(1.1);

    // Fade in
    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: 1,
      duration: 900,
      ease: 'Power2',
    });

    // Hold then fade out → MenuScene
    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: logo,
        alpha: 0,
        scale: 0.95,
        duration: 700,
        ease: 'Power2',
        onComplete: () => this.scene.start('MenuScene'),
      });
    });
  }
}

// ── MenuScene ─────────────────────────────────────────────────────────────────
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark background with subtle gradient feel
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000000, 0x000000, 0x0a0a1a, 0x0a0a1a, 1);
    bg.fillRect(0, 0, W, H);

    // Draw smaller AMS logo as backdrop watermark
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width  = 320;
    bgCanvas.height = 320;
    const bgCtx = bgCanvas.getContext('2d');
    _drawAMSLogo(bgCtx, 160, 160, 140, 0.08);
    if (this.textures.exists('ams-logo-bg')) this.textures.remove('ams-logo-bg');
    this.textures.addCanvas('ams-logo-bg', bgCanvas);

    this.add.image(W / 2, H / 2 - 20, 'ams-logo-bg').setAlpha(1);

    // Game title
    const title = this.add.text(W / 2, H / 2 - 80, 'INSIDE', {
      fontFamily: '"Courier New", monospace',
      fontSize: '48px',
      color: '#ffffff',
      letterSpacing: 18,
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(W / 2, H / 2 - 36, 'a g i l e  m o b i l e  s o l u t i o n s', {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
      letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0);

    // Start prompt
    const startText = this.add.text(W / 2, H / 2 + 60, 'TAP TO BEGIN', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#667788',
      letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    // Death/best score if exists
    const best = localStorage.getItem('ams-best-deaths');
    if (best !== null) {
      this.add.text(W / 2, H / 2 + 90, `best run: ${best} deaths`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '11px',
        color: '#334455',
      }).setOrigin(0.5).setAlpha(0.7);
    }

    // Version
    this.add.text(W - 12, H - 12, 'v1.0', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#223344',
    }).setOrigin(1, 1);

    // Fade in elements
    this.tweens.add({ targets: title,     alpha: 1, duration: 1000, delay: 200,  ease: 'Power2' });
    this.tweens.add({ targets: subtitle,  alpha: 1, duration: 1000, delay: 600,  ease: 'Power2' });
    this.tweens.add({ targets: startText, alpha: 1, duration: 800,  delay: 1200, ease: 'Power2' });

    // Pulse the start prompt
    this.time.delayedCall(1400, () => {
      this.tweens.add({
        targets: startText,
        alpha: { from: 1, to: 0.3 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Start on tap/click/key
    this.input.once('pointerdown', () => this._startGame());
    this.input.keyboard.once('keydown', () => this._startGame());
  }

  _startGame() {
    this.cameras.main.fade(500, 0, 0, 0);
    this.time.delayedCall(550, () => this.scene.start('GameScene'));
  }
}

// ── Shared logo drawing function ──────────────────────────────────────────────
export function _drawAMSLogo(ctx, cx, cy, radius, globalAlpha = 1) {
  ctx.save();
  ctx.globalAlpha = globalAlpha;

  // Outer circle fill
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.stroke();

  // Inner subtle ring
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
  ctx.stroke();

  // Text settings
  const scale = radius / 110;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // AGILE
  ctx.font = `bold ${Math.round(28 * scale)}px "Arial", sans-serif`;
  ctx.letterSpacing = `${4 * scale}px`;
  ctx.fillText('AGILE', cx, cy - 28 * scale);

  // MOBILE (with the O having a dot — drawn manually)
  ctx.fillText('MOBILE', cx, cy + 2 * scale);

  // SOLUTIONS
  ctx.font = `${Math.round(10 * scale)}px "Arial", sans-serif`;
  ctx.letterSpacing = `${6 * scale}px`;
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('SOLUTIONS', cx, cy + 34 * scale);

  // Dot accent on the i in AGILE (decorative)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + (4 * scale), cy - 40 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

