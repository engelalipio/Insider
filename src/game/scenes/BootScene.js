import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // ── SKY GRADIENT ──────────────────────────────────────────────
    const skyGfx = this.make.graphics({ x: 0, y: 0, add: false });
    skyGfx.fillGradientStyle(0x2a4a7a, 0x2a4a7a, 0x4a7aaa, 0x4a7aaa, 1);
    skyGfx.fillRect(0, 0, 1280, 400);
    skyGfx.generateTexture('sky', 1280, 400);
    skyGfx.destroy();

    // ── FAR BG (silhouette hills) ─────────────────────────────────
    const farGfx = this.make.graphics({ x: 0, y: 0, add: false });
    farGfx.fillStyle(0x2a3e5a, 1);
    farGfx.fillRect(0, 0, 1280, 400);
    // distant hills
    farGfx.fillStyle(0x3a5570, 1);
    for (let i = 0; i < 8; i++) {
      const hx = i * 180 + 40;
      const hy = 200 + Math.sin(i * 1.3) * 30;
      const hw = 220 + Math.cos(i) * 60;
      const hh = 400 - hy;
      farGfx.fillEllipse(hx + hw / 2, hy + hh, hw, hh * 1.6);
    }
    farGfx.generateTexture('bg-far', 1280, 400);
    farGfx.destroy();

    // ── MID BG (tree line) ────────────────────────────────────────
    const midGfx = this.make.graphics({ x: 0, y: 0, add: false });
    midGfx.fillStyle(0x0a0a0a, 0);
    midGfx.fillRect(0, 0, 1280, 400);
    // tree silhouettes
    midGfx.fillStyle(0x2a442a, 1);
    for (let i = 0; i < 22; i++) {
      const tx = i * 62 - 10;
      const th = 120 + (i % 3) * 40;
      const ty = 400 - th;
      const tw = 24 + (i % 4) * 8;
      // trunk
      midGfx.fillRect(tx + tw / 2 - 3, ty + th * 0.55, 6, th * 0.45);
      // canopy triangle-ish
      midGfx.fillTriangle(
        tx, ty + th * 0.6,
        tx + tw, ty + th * 0.6,
        tx + tw / 2, ty
      );
      midGfx.fillTriangle(
        tx + 4, ty + th * 0.42,
        tx + tw - 4, ty + th * 0.42,
        tx + tw / 2, ty - th * 0.15
      );
    }
    midGfx.generateTexture('bg-mid', 1280, 400);
    midGfx.destroy();

    // ── NEAR BG (dark ground layer) ───────────────────────────────
    const nearGfx = this.make.graphics({ x: 0, y: 0, add: false });
    nearGfx.fillStyle(0x1e2230, 1);
    nearGfx.fillRect(0, 310, 1280, 90);
    // some scattered rocks
    nearGfx.fillStyle(0x2a2a3e, 1);
    [100, 300, 550, 780, 1000, 1200].forEach(rx => {
      nearGfx.fillEllipse(rx, 320, 60 + (rx % 40), 20);
    });
    nearGfx.generateTexture('bg-near', 1280, 400);
    nearGfx.destroy();

    // ── GROUND PLATFORM ───────────────────────────────────────────
    const groundGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Ground body
    groundGfx.fillStyle(0x1e1e30, 1);
    groundGfx.fillRect(0, 0, 32, 32);
    // Subtle vertical grid lines
    groundGfx.lineStyle(1, 0x2a2a44, 0.5);
    groundGfx.strokeRect(0, 0, 32, 32);
    // Top edge highlight — same as platform so ground reads clearly
    groundGfx.fillStyle(0x8899bb, 1);
    groundGfx.fillRect(0, 0, 32, 2);
    groundGfx.fillStyle(0x4455778, 0.5);
    groundGfx.fillRect(1, 2, 30, 2);
    groundGfx.generateTexture('ground', 32, 32);
    groundGfx.destroy();

    // ── PLATFORM TILE ─────────────────────────────────────────────
    const platGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Body — visible mid-tone blue-grey
    platGfx.fillStyle(0x3a3a6a, 1);
    platGfx.fillRect(0, 2, 32, 14);
    // Side edges — slightly lighter
    platGfx.fillStyle(0x4a4a7a, 1);
    platGfx.fillRect(0, 2, 2, 14);
    platGfx.fillRect(30, 2, 2, 14);
    // Bottom edge shadow
    platGfx.fillStyle(0x1a1a30, 1);
    platGfx.fillRect(0, 14, 32, 2);
    // Top edge highlight — bright so it reads as a surface
    platGfx.fillStyle(0xaabbdd, 1);
    platGfx.fillRect(0, 0, 32, 2);
    // Inner top subtle glow strip
    platGfx.fillStyle(0x6677aa, 0.6);
    platGfx.fillRect(1, 2, 30, 2);
    platGfx.generateTexture('platform', 32, 16);
    platGfx.destroy();

    // ── PLAYER ────────────────────────────────────────────────────
    // Spritesheet is generated dynamically by PlayerSprite.js
    // A placeholder 1x1 texture avoids Phaser warnings
    const playerGfx = this.make.graphics({ x: 0, y: 0, add: false });
    playerGfx.fillStyle(0x000000, 0);
    playerGfx.fillRect(0, 0, 1, 1);
    playerGfx.generateTexture('player', 1, 1);
    playerGfx.destroy();

    // ── GUARD — Blasphemous inquisitor: crimson robe + silver helm ────────────
    // Bright, high-contrast colours so they pop against dark backgrounds.
    const guardGfx = this.make.graphics({ x: 0, y: 0, add: false });

    // Robe legs (deep crimson)
    guardGfx.fillStyle(0x8b1515, 1);
    guardGfx.fillRect(5, 30, 9, 14);
    guardGfx.fillRect(18, 30, 9, 14);

    // Boot tips (dark leather)
    guardGfx.fillStyle(0x2a1008, 1);
    guardGfx.fillRect(5, 40, 9, 4);
    guardGfx.fillRect(18, 40, 9, 4);

    // Robe body (brighter crimson)
    guardGfx.fillStyle(0xaa1a1a, 1);
    guardGfx.fillRect(4, 14, 24, 18);

    // Chest armour plate (dark steel)
    guardGfx.fillStyle(0x555568, 1);
    guardGfx.fillRect(7, 15, 18, 12);

    // Armour highlight strip
    guardGfx.fillStyle(0x8888a0, 1);
    guardGfx.fillRect(7, 15, 18, 2);

    // Gold cross / insignia on chest
    guardGfx.fillStyle(0xd4a820, 1);
    guardGfx.fillRect(14, 17, 4, 9);   // vertical
    guardGfx.fillRect(10, 20, 12, 3);  // horizontal

    // Helmet (silver)
    guardGfx.fillStyle(0xaaaabc, 1);
    guardGfx.fillEllipse(16, 9, 22, 18);
    guardGfx.fillRect(3, 7, 26, 7);    // brim

    // Helmet highlight
    guardGfx.fillStyle(0xddddee, 1);
    guardGfx.fillRect(6, 4, 10, 3);

    // Eye slit — orange glow (very visible)
    guardGfx.fillStyle(0xff8800, 1);
    guardGfx.fillRect(7, 9, 18, 3);
    // Inner bright core
    guardGfx.fillStyle(0xffcc44, 0.8);
    guardGfx.fillRect(9, 9, 14, 2);

    // Shoulder guard (left side from facing direction)
    guardGfx.fillStyle(0x777788, 1);
    guardGfx.fillRect(1, 14, 5, 8);
    guardGfx.fillRect(26, 14, 5, 8);

    guardGfx.generateTexture('guard', 64, 44);
    guardGfx.destroy();

    // ── CHECKPOINT ────────────────────────────────────────────────
    const cpGfx = this.make.graphics({ x: 0, y: 0, add: false });
    cpGfx.fillStyle(0x223355, 0.4);
    cpGfx.fillRect(0, 0, 4, 40);
    cpGfx.fillStyle(0x4477aa, 0.7);
    cpGfx.fillTriangle(4, 0, 4, 16, 20, 8);
    cpGfx.generateTexture('checkpoint', 24, 40);
    cpGfx.destroy();

    // ── HAZARD (spike) — bright metal tips ────────────────────────
    const hazGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Base rail
    hazGfx.fillStyle(0x441111, 1);
    hazGfx.fillRect(0, 16, 64, 4);
    // Spikes — dark red with bright silver tip
    for (let i = 0; i < 4; i++) {
      hazGfx.fillStyle(0x882222, 1);
      hazGfx.fillTriangle(i * 16, 20, i * 16 + 8, 2, i * 16 + 16, 20);
      // Bright silver highlight on spike tip
      hazGfx.fillStyle(0xccccdd, 0.9);
      hazGfx.fillTriangle(i * 16 + 6, 10, i * 16 + 8, 2, i * 16 + 10, 10);
    }
    hazGfx.generateTexture('hazard', 64, 20);
    hazGfx.destroy();

    // ── FOG OVERLAY ───────────────────────────────────────────────
    const fogGfx = this.make.graphics({ x: 0, y: 0, add: false });
    fogGfx.fillStyle(0x0a0a18, 0.08);
    fogGfx.fillRect(0, 0, 1280, 400);
    fogGfx.generateTexture('fog', 1280, 400);
    fogGfx.destroy();

    // ── SKY2 (darker, for level 2) ───────────────────────────────
    const sky2Gfx = this.make.graphics({ x: 0, y: 0, add: false });
    sky2Gfx.fillGradientStyle(0x141428, 0x141428, 0x1e1e38, 0x1e1e38, 1);
    sky2Gfx.fillRect(0, 0, 1280, 400);
    // Add some stars
    sky2Gfx.fillStyle(0xffffff, 1);
    for (let i = 0; i < 60; i++) {
      const sx = Math.floor(Math.random() * 1280);
      const sy = Math.floor(Math.random() * 200);
      const ss = Math.random() > 0.8 ? 2 : 1;
      sky2Gfx.fillRect(sx, sy, ss, ss);
    }
    sky2Gfx.generateTexture('sky2', 1280, 400);
    sky2Gfx.destroy();

    this.scene.start('SplashScene');
  }
}

