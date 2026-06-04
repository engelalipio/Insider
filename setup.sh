#!/bin/bash
# inside-game — stuck right button fix
# Run from inside your inside-game folder

mkdir -p src/game/scenes src/game/entities

cat > src/game/config.js << 'ENDOFFILE'
export const GAME_CONFIG = {
  width: 1280,
  height: 400,
  gravity: 900,
  playerSpeed: 180,
  jumpVelocity: -520,
  groundY: 340,
};

ENDOFFILE

cat > src/game/index.js << 'ENDOFFILE'
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { SplashScene, MenuScene } from './scenes/SplashScene.js';
import { GameScene } from './scenes/GameScene.js';
import { Level2Scene } from './scenes/Level2Scene.js';
import { GAME_CONFIG } from './config.js';

export function createGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    parent,
    backgroundColor: '#0a0a12',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GAME_CONFIG.gravity },
        debug: false,
      },
    },
    scene: [BootScene, SplashScene, MenuScene, GameScene, Level2Scene],
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}

ENDOFFILE

cat > src/game/AudioManager.js << 'ENDOFFILE'
// ── AudioManager ─────────────────────────────────────────────────────────────
// Uses Web Audio API directly (same approach as Bug Blast) so it works on iOS.

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._droneNodes = [];
    this._rainNodes  = [];
    this._muted = false;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.6;
      this._masterGain.connect(this._ctx.destination);
    }
    // iOS requires resume after user gesture
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // ── AMBIENT DRONE ───────────────────────────────────────────────
  startAmbient() {
    if (this._droneNodes.length) return;
    const ctx = this._getCtx();

    // Two detuned oscillators for an eerie drone
    [[55, 0], [55.3, -8], [110, -14]].forEach(([freq, detune]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;

      filt.type = 'lowpass';
      filt.frequency.value = 400;

      gain.gain.value = 0;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this._masterGain);
      osc.start();

      // Fade in slowly
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);

      // Subtle slow tremolo
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      this._droneNodes.push({ osc, gain, lfo });
    });
  }

  stopAmbient() {
    const ctx = this._getCtx();
    this._droneNodes.forEach(({ osc, gain, lfo }) => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => { try { osc.stop(); lfo.stop(); } catch(e){} }, 1100);
    });
    this._droneNodes = [];
  }

  // ── RAIN ────────────────────────────────────────────────────────
  startRain() {
    if (this._rainNodes.length) return;
    const ctx = this._getCtx();

    // White noise buffer
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = buf;
    src.loop = true;
    filt.type = 'bandpass';
    filt.frequency.value = 3000;
    filt.Q.value = 0.4;
    gain.gain.value = 0;

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this._masterGain);
    src.start();

    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2);
    this._rainNodes = [{ src, gain }];
  }

  stopRain() {
    const ctx = this._getCtx();
    this._rainNodes.forEach(({ src, gain }) => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => { try { src.stop(); } catch(e){} }, 1100);
    });
    this._rainNodes = [];
  }

  // ── ONE-SHOT SFX ────────────────────────────────────────────────
  playFootstep() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 120 + Math.random() * 40;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.stop(ctx.currentTime + 0.07);
  }

  playJump() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.16);
  }

  playDeath() {
    if (this._muted) return;
    const ctx = this._getCtx();
    // Descending crash
    [0, 0.05, 0.1, 0.18].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 - i * 60, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + t + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
  }

  playCheckpoint() {
    if (this._muted) return;
    const ctx = this._getCtx();
    [0, 0.12].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660 + i * 220;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      osc.stop(ctx.currentTime + t + 0.22);
    });
  }

  playLever() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.2);
    gain.gain.value = 0.09;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.26);
  }

  playWin() {
    if (this._muted) return;
    const ctx = this._getCtx();
    [0, 0.15, 0.3, 0.5].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = [330, 440, 550, 660][i];
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
      osc.stop(ctx.currentTime + t + 0.42);
    });
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : 0.6;
    }
  }

  toggle() {
    this.setMuted(!this._muted);
    return this._muted;
  }
}

// Singleton shared across scenes
export const audio = new AudioManager();

ENDOFFILE

cat > src/game/PlayerSprite.js << 'ENDOFFILE'
// ── PlayerSprite ──────────────────────────────────────────────────────────────
// Generates a spritesheet texture procedurally using canvas.
// Frame layout (28x40 each):
//   0-1   idle (2 frames)
//   2-7   run  (6 frames)
//   8     jump (going up)
//   9     fall (going down)
//  10     land (1 frame, squash)

const W = 28;   // frame width
const H = 40;   // frame height
const FRAMES = 11;

// ── colour palette ────────────────────────────────────────────────────────────
const C = {
  body:    '#2a2a4a',
  hoodie:  '#cc2222',
  skin:    '#c8956c',
  shoe:    '#1a1a2e',
  shadow:  '#11111f',
  white:   '#ddeeff',
};

function hex(str) {
  const r = parseInt(str.slice(1,3),16);
  const g = parseInt(str.slice(3,5),16);
  const b = parseInt(str.slice(5,7),16);
  return { r, g, b };
}

// Draw one character frame onto a canvas context at offset (ox, oy)
// pose: 'idle0','idle1','run0'..'run5','jump','fall','land'
function drawFrame(ctx, ox, oy, pose) {
  ctx.clearRect(ox, oy, W, H);

  // ── helpers ─────────────────────────────────────────────────────────────────
  const fill = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const circle = (color, x, y, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + x, oy + y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── POSE DEFINITIONS ────────────────────────────────────────────────────────
  // Each pose: { headX, headY, torsoY, legL:[x,y,w,h], legR:[x,y,w,h], armL:[x,y,w,h], armR:[x,y,w,h] }
  const poses = {
    idle0: {
      headY:  4, headX: 14,
      torsoY: 14,
      legL:  [6,  28, 7, 11],
      legR:  [15, 28, 7, 11],
      armL:  [2,  16, 5, 10],
      armR:  [21, 16, 5, 10],
    },
    idle1: {  // very slight weight shift
      headY:  5, headX: 14,
      torsoY: 15,
      legL:  [6,  29, 7, 10],
      legR:  [15, 29, 7, 10],
      armL:  [2,  17, 5, 9],
      armR:  [21, 17, 5, 9],
    },
    run0: {   // stride: left leg forward
      headY:  3, headX: 15,
      torsoY: 13,
      legL:  [3,  26, 7, 13],
      legR:  [17, 28, 7, 11],
      armL:  [20, 14, 5, 12],
      armR:  [3,  14, 5, 12],
    },
    run1: {   // mid-stride
      headY:  4, headX: 14,
      torsoY: 14,
      legL:  [5,  26, 7, 13],
      legR:  [16, 27, 7, 12],
      armL:  [19, 15, 5, 11],
      armR:  [4,  15, 5, 11],
    },
    run2: {   // right leg forward
      headY:  3, headX: 13,
      torsoY: 13,
      legL:  [17, 28, 7, 11],
      legR:  [3,  26, 7, 13],
      armL:  [3,  14, 5, 12],
      armR:  [20, 14, 5, 12],
    },
    run3: {   // passing position (legs together, slightly up)
      headY:  2, headX: 14,
      torsoY: 12,
      legL:  [7,  26, 7, 13],
      legR:  [14, 26, 7, 13],
      armL:  [2,  15, 5, 10],
      armR:  [21, 15, 5, 10],
    },
    run4: {   // mirror of run0
      headY:  3, headX: 13,
      torsoY: 13,
      legL:  [17, 26, 7, 13],
      legR:  [3,  28, 7, 11],
      armL:  [3,  14, 5, 12],
      armR:  [20, 14, 5, 12],
    },
    run5: {   // mirror of run1
      headY:  4, headX: 14,
      torsoY: 14,
      legL:  [16, 26, 7, 13],
      legR:  [5,  27, 7, 12],
      armL:  [4,  15, 5, 11],
      armR:  [19, 15, 5, 11],
    },
    jump: {   // tucked slightly, arms up
      headY:  2, headX: 14,
      torsoY: 11,
      legL:  [5,  24, 7, 10],
      legR:  [16, 24, 7, 10],
      armL:  [1,  12, 5, 8],
      armR:  [22, 12, 5, 8],
    },
    fall: {   // spread, arms out
      headY:  4, headX: 14,
      torsoY: 14,
      legL:  [3,  28, 8, 11],
      legR:  [17, 28, 8, 11],
      armL:  [0,  15, 6, 8],
      armR:  [22, 15, 6, 8],
    },
    land: {   // squashed on landing
      headY:  8, headX: 14,
      torsoY: 17,
      legL:  [4,  28, 9, 8],
      legR:  [15, 28, 9, 8],
      armL:  [0,  18, 6, 7],
      armR:  [22, 18, 6, 7],
    },
  };

  const p = poses[pose];
  if (!p) return;

  // ── DRAW ORDER: shoes → legs → torso → hoodie → arms → head ─────────────────

  // Shoes
  fill(C.shoe, p.legL[0], p.legL[1] + p.legL[3] - 3, p.legL[2], 3);
  fill(C.shoe, p.legR[0], p.legR[1] + p.legR[3] - 3, p.legR[2], 3);

  // Legs
  fill(C.body, ...p.legL);
  fill(C.body, ...p.legR);

  // Torso
  fill(C.body, 5, p.torsoY, 18, 14);

  // Hoodie stripe
  fill(C.hoodie, 5, p.torsoY + 1, 18, 8);

  // Hoodie pocket hint
  fill(C.shadow, 11, p.torsoY + 4, 6, 4);

  // Arms
  fill(C.body, ...p.armL);
  fill(C.body, ...p.armR);

  // Neck
  fill(C.skin, p.headX - 2, p.headY + 8, 5, 4);

  // Head
  circle(C.body, p.headX, p.headY + 5, 7);

  // Hair hint (top of head, slightly darker)
  fill(C.shadow, p.headX - 5, p.headY, 10, 4);

  // Eye (tiny white dot)
  fill(C.white, p.headX + 2, p.headY + 4, 2, 2);
}

// ── PUBLIC: generate the spritesheet texture in Phaser ────────────────────────
export function generatePlayerSheet(scene) {
  const canvas = document.createElement('canvas');
  canvas.width  = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const poseNames = ['idle0','idle1','run0','run1','run2','run3','run4','run5','jump','fall','land'];
  poseNames.forEach((pose, i) => drawFrame(ctx, i * W, 0, pose));

  // Add to Phaser texture manager as a spritesheet
  if (scene.textures.exists('player-sheet')) {
    scene.textures.remove('player-sheet');
  }
  scene.textures.addSpriteSheet('player-sheet', canvas, {
    frameWidth: W,
    frameHeight: H,
  });
}

export const ANIM_FRAMES = {
  IDLE:  [0, 1],
  RUN:   [2, 3, 4, 5, 6, 7],
  JUMP:  [8],
  FALL:  [9],
  LAND:  [10],
};

export const FRAME_W = W;
export const FRAME_H = H;
export const TOTAL_FRAMES = FRAMES;

ENDOFFILE

cat > src/game/scenes/BootScene.js << 'ENDOFFILE'
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

    // ── GUARD ─────────────────────────────────────────────────────
    const guardGfx = this.make.graphics({ x: 0, y: 0, add: false });
    guardGfx.fillStyle(0x444444, 1);
    // legs
    guardGfx.fillRect(6, 30, 8, 14);
    guardGfx.fillRect(18, 30, 8, 14);
    // torso (bigger, more imposing)
    guardGfx.fillRect(4, 14, 24, 18);
    // head with helmet
    guardGfx.fillStyle(0x333333, 1);
    guardGfx.fillEllipse(16, 9, 20, 16);
    guardGfx.fillRect(4, 8, 24, 6);
    // flashlight cone hint
    guardGfx.fillStyle(0x886622, 0.7);
    guardGfx.fillTriangle(32, 20, 56, 10, 56, 32);
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

    // ── HAZARD (spike) ────────────────────────────────────────────
    const hazGfx = this.make.graphics({ x: 0, y: 0, add: false });
    hazGfx.fillStyle(0x662222, 1);
    for (let i = 0; i < 4; i++) {
      hazGfx.fillTriangle(i * 16, 20, i * 16 + 8, 0, i * 16 + 16, 20);
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

ENDOFFILE

cat > src/game/scenes/SplashScene.js << 'ENDOFFILE'
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

ENDOFFILE

cat > src/game/scenes/GameScene.js << 'ENDOFFILE'
import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { Guard } from '../entities/Guard.js';
import { GAME_CONFIG } from '../config.js';
import { audio } from '../AudioManager.js';
import { _drawAMSLogo } from './SplashScene.js';

const GROUND_SEGMENTS = [{ x: 0, w: 2400 }];

const PLATFORMS = [
  { x: 300, y: 280, w: 5 },
  { x: 520, y: 240, w: 4 },
  { x: 720, y: 280, w: 3 },
  { x: 900, y: 250, w: 6 },
  { x: 1150, y: 270, w: 4 },
  { x: 1380, y: 230, w: 5 },
  { x: 1620, y: 260, w: 4 },
  { x: 1860, y: 280, w: 6 },
];

const HAZARDS = [
  { x: 450, y: 338 },
  { x: 650, y: 338 },
  { x: 1050, y: 338 },
  { x: 1500, y: 338 },
  { x: 1750, y: 338 },
];

const GUARDS_DATA = [
  { x: 500,  patrolLeft: 400,  patrolRight: 650  },
  { x: 900,  patrolLeft: 800,  patrolRight: 1050 },
  { x: 1400, patrolLeft: 1280, patrolRight: 1560 },
  { x: 1800, patrolLeft: 1700, patrolRight: 1980 },
];

const CHECKPOINTS = [600, 1100, 1600];
const WORLD_WIDTH = 2400;
const GROUND_Y    = 340;

// Lever is at x=1200, gate blocks x=2050
const LEVER_X = 1200;
const GATE_X  = 2050;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.checkpointX  = 60;
    this.checkpointY  = GROUND_Y - 40;
    this.deathCount   = 0;
    this.leverPulled  = false;
    this._won         = false;
    this._killing     = false;
    this.touch = { left: false, right: false, jump: false, jumpJustPressed: false };
    this._prevJump = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a12');

    // ── PARALLAX ─────────────────────────────────────────────────
    this.bgSky  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'sky').setOrigin(0).setDepth(0).setScrollFactor(0);
    this.bgFar  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-far').setOrigin(0).setDepth(1).setScrollFactor(0);
    this.bgMid  = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-mid').setOrigin(0).setDepth(2).setScrollFactor(0);
    this.bgNear = this.add.tileSprite(0, 0, WORLD_WIDTH, 400, 'bg-near').setOrigin(0).setDepth(3).setScrollFactor(0);

    // ── PHYSICS ───────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, 500);

    // ── GROUND ────────────────────────────────────────────────────
    this.groundGroup = this.physics.add.staticGroup();
    GROUND_SEGMENTS.forEach(seg => {
      for (let i = 0; i < Math.ceil(seg.w / 32); i++) {
        const tile = this.groundGroup.create(seg.x + i * 32 + 16, GROUND_Y + 16, 'ground');
        tile.setDepth(10);
        tile.refreshBody();
      }
    });

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

    // ── LEVER & GATE ──────────────────────────────────────────────
    this._buildLeverAndGate();

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

    // ── COLLIDERS ─────────────────────────────────────────────────
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.gateGroup);
    this.guards.forEach(g => {
      this.physics.add.collider(g, this.groundGroup);
      this.physics.add.collider(g, this.platformGroup);
    });

    // ── OVERLAPS ──────────────────────────────────────────────────
    this.physics.add.overlap(this.player, this.hazardGroup,     this._killPlayer,    null, this);
    this.physics.add.overlap(this.player, this.checkpointGroup, this._hitCheckpoint,  null, this);
    this.physics.add.overlap(this.player, this.leverZone,       this._pullLever,      null, this);
    this.physics.add.overlap(this.player, this.exitZone,        this._winGame,        null, this);
    this.guards.forEach(guard => {
      this.physics.add.overlap(this.player, guard, () => this._killPlayer(), null, this);
    });

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
    const dustGfx = this.make.graphics({ x: 0, y: 0, add: false });
    dustGfx.fillStyle(0x2a2a3e, 1);
    dustGfx.fillCircle(3, 3, 3);
    dustGfx.generateTexture('dust', 6, 6);
    dustGfx.destroy();

    this.dustEmitter = this.add.particles(0, 0, 'dust', {
      speed: { min: 10, max: 40 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      quantity: 2,
      emitting: false,
    }).setDepth(16);

    this.events.on('player-step', (x, y) => {
      if (this.time.now % 120 < 60) this.dustEmitter.emitParticleAt(x, y, 3);
      if (this.time.now % 240 < 120) audio.playFootstep();
    });

    // ── RAIN ──────────────────────────────────────────────────────
    this._buildRain();

    // ── FOG ───────────────────────────────────────────────────────
    this.fogOverlay = this.add.image(0, 0, 'fog')
      .setOrigin(0).setDepth(30).setScrollFactor(0).setAlpha(0.08);

    // ── UI ────────────────────────────────────────────────────────
    this._buildUI();
    this._buildVignette();
    this._buildTouchControls();
    this._buildWatermark();

    // ── AUDIO ─────────────────────────────────────────────────────
    audio.startAmbient();

    // ── FLICKER ───────────────────────────────────────────────────
    this._scheduleFlicker();
  }

  _buildLeverAndGate() {
    // ── LEVER TEXTURE ─────────────────────────────────────────────
    const lg = this.make.graphics({ x: 0, y: 0, add: false });
    // Base
    lg.fillStyle(0x445566, 1);
    lg.fillRect(6, 24, 12, 8);
    // Handle (up position)
    lg.fillStyle(0x88bbdd, 1);
    lg.fillRect(10, 4, 4, 22);
    // Knob
    lg.fillStyle(0xaaddff, 1);
    lg.fillCircle(12, 4, 5);
    // Hint text
    lg.generateTexture('lever-off', 24, 32);
    lg.destroy();

    const lg2 = this.make.graphics({ x: 0, y: 0, add: false });
    lg2.fillStyle(0x445566, 1);
    lg2.fillRect(6, 0, 12, 8);
    // Handle (pulled down)
    lg2.fillStyle(0x88ffaa, 1);
    lg2.fillRect(10, 6, 4, 22);
    lg2.fillStyle(0xaaffcc, 1);
    lg2.fillCircle(12, 28, 5);
    lg2.generateTexture('lever-on', 24, 32);
    lg2.destroy();

    // Place lever
    this.leverSprite = this.add.image(LEVER_X, GROUND_Y - 16, 'lever-off').setDepth(11);

    // Prompt
    this.leverPrompt = this.add.text(LEVER_X, GROUND_Y - 54, 'walk into lever', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#4488aa',
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Physics zone for lever
    this.leverZone = this.physics.add.staticImage(LEVER_X, GROUND_Y - 16, 'lever-off');
    this.leverZone.body.setSize(32, 40);
    this.leverZone.setAlpha(0);
    this.leverZone.refreshBody();

    // ── GATE TEXTURE ──────────────────────────────────────────────
    const gg = this.make.graphics({ x: 0, y: 0, add: false });
    gg.fillStyle(0x223344, 1);
    gg.fillRect(0, 0, 16, 80);
    // bars
    gg.fillStyle(0x334455, 1);
    for (let i = 0; i < 5; i++) {
      gg.fillRect(2, i * 16 + 2, 12, 12);
    }
    gg.lineStyle(1, 0x445566, 1);
    gg.strokeRect(0, 0, 16, 80);
    gg.generateTexture('gate', 16, 80);
    gg.destroy();

    // Gate group (3 tiles wide = 48px)
    this.gateGroup = this.physics.add.staticGroup();
    for (let i = 0; i < 3; i++) {
      const g = this.gateGroup.create(GATE_X + i * 16 + 8, GROUND_Y - 40, 'gate');
      g.setDepth(12);
      g.body.setSize(16, 80);
      g.refreshBody();
    }

    // Gate label
    this.gateLabel = this.add.text(GATE_X + 24, GROUND_Y - 90, '🔒', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(20);
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
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.exitZone = this.physics.add.staticImage(doorX, doorY, 'exit-door');
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
      lifespan: 1000,
      quantity: 3,
      alpha: { start: 0.4, end: 0 },
      emitting: true,
    }).setDepth(25).setScrollFactor(0);
  }

  _buildUI() {
    this.deathText = this.add.text(16, 12, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#334455',
    }).setScrollFactor(0).setDepth(50);

    this.cpFlash = this.add.text(GAME_CONFIG.width / 2, 30, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#445566',
      alpha: 0,
    }).setScrollFactor(0).setDepth(50).setOrigin(0.5);

    this.controlsText = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 18,
      '← → move   ↑ / W / SPACE jump', {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: '#223344',
    }).setScrollFactor(0).setDepth(50).setOrigin(0.5);

    this.time.delayedCall(5000, () => {
      this.tweens.add({ targets: this.controlsText, alpha: 0, duration: 2000 });
    });
  }

  _buildVignette() {
    const w = GAME_CONFIG.width, h = GAME_CONFIG.height;
    const vGfx = this.make.graphics({ x: 0, y: 0, add: false });
    for (let i = 0; i < 12; i++) {
      const margin = i * 14;
      vGfx.fillStyle(0x000005, (12 - i) * 0.018);
      vGfx.fillRect(margin, margin, w - margin * 2, h - margin * 2);
    }
    vGfx.generateTexture('vignette', w, h);
    vGfx.destroy();
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(40).setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  _buildTouchControls() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const btnSize = 72, pad = 14;
    const btnY = H - pad - btnSize / 2;
    const alpha = 0.35;

    const makeBtn = (key, color) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 0.5);
      g.fillRoundedRect(0, 0, btnSize, btnSize, 14);
      g.lineStyle(2, color, 0.9);
      g.strokeRoundedRect(1, 1, btnSize - 2, btnSize - 2, 14);
      g.generateTexture(key, btnSize, btnSize);
      g.destroy();
    };

    makeBtn('btn-left',  0x4488cc);
    makeBtn('btn-right', 0x4488cc);
    makeBtn('btn-jump',  0x88cc44);

    const leftBtn  = this.add.image(pad + btnSize / 2,        btnY, 'btn-left').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const rightBtn = this.add.image(pad + btnSize * 1.5 + 10, btnY, 'btn-right').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const jumpBtn  = this.add.image(W - pad - btnSize / 2,    btnY, 'btn-jump').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();

    const ls = { fontFamily: 'monospace', fontSize: '22px', color: '#aaccff' };
    const js = { fontFamily: 'monospace', fontSize: '22px', color: '#aaffaa' };
    this.add.text(pad + btnSize / 2,        btnY, '◀', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(pad + btnSize * 1.5 + 10, btnY, '▶', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(W - pad - btnSize / 2,    btnY, '▲', js).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);

    const bindBtn = (btn, key) => {
      btn.on('pointerdown', () => { this.touch[key] = true;  btn.setAlpha(0.75); });
      btn.on('pointerup',   () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerout',  () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerupoutside', () => { this.touch[key] = false; btn.setAlpha(alpha); });
    };
    bindBtn(leftBtn, 'left');
    bindBtn(rightBtn, 'right');
    bindBtn(jumpBtn, 'jump');

    // Global safety — if pointer released anywhere, clear all touch states
    this.input.on('pointerup', () => {
      this.touch.left  = false;
      this.touch.right = false;
      this.touch.jump  = false;
      leftBtn.setAlpha(alpha);
      rightBtn.setAlpha(alpha);
      jumpBtn.setAlpha(alpha);
    });

    this.input.addPointer(3);
  }

  _pullLever() {
    if (this.leverPulled) return;
    this.leverPulled = true;
    audio.playLever();

    // Swap lever sprite
    this.leverSprite.setTexture('lever-on');
    this.leverPrompt.setText('gate opened!').setAlpha(1);
    this.tweens.add({ targets: this.leverPrompt, alpha: 0, delay: 2000, duration: 800 });

    // Open gate — slide upward and destroy
    this.gateLabel.setText('🔓');
    this.cameras.main.shake(150, 0.005);

    this.gateGroup.getChildren().forEach((g, i) => {
      this.tweens.add({
        targets: g,
        y: g.y - 100,
        alpha: 0,
        delay: i * 80,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          g.body.enable = false;
          g.setVisible(false);
        },
      });
    });

    this.time.delayedCall(600, () => this.gateLabel.destroy());
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

    // Screen flash red
    this.cameras.main.flash(200, 80, 0, 0);
    this.cameras.main.shake(300, 0.01);

    // Spawn blood/impact particles
    for (let i = 0; i < 12; i++) {
      const px = this.player.x + Phaser.Math.Between(-8, 8);
      const py = this.player.y + Phaser.Math.Between(-8, 8);
      const dot = this.add.circle(px, py, Phaser.Math.Between(2, 5), 0x661111, 0.9).setDepth(20);
      this.tweens.add({
        targets: dot,
        x: px + Phaser.Math.Between(-40, 40),
        y: py + Phaser.Math.Between(-30, 20),
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: Phaser.Math.Between(300, 600),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }

    this.player.die(() => {
      this.cameras.main.fade(400, 0, 0, 0);
      this.time.delayedCall(450, () => {
        this.player.respawn(this.checkpointX, this.checkpointY);
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
    this.cameras.main.fade(800, 0, 0, 0);
    this.time.delayedCall(900, () => {
      this.scene.start('Level2Scene');
    });
  }


  _buildWatermark() {
    const canvas = document.createElement('canvas');
    canvas.width  = 60;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    _drawAMSLogo(ctx, 30, 30, 28, 0.5);
    const key = 'ams-watermark-' + this.scene.key;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
    this.add.image(this.scale.width - 38, 22, key)
      .setScrollFactor(0)
      .setDepth(55)
      .setAlpha(0.18);
  }

  _scheduleFlicker() {
    this.time.addEvent({
      delay: Phaser.Math.Between(3000, 9000),
      callback: () => {
        this.tweens.add({
          targets: this.fogOverlay,
          alpha: { from: 0.15, to: 0.3 },
          duration: Phaser.Math.Between(80, 200),
          yoyo: true,
          ease: 'Stepped',
        });
        this._scheduleFlicker();
      },
    });
  }

  update() {
    this.touch.jumpJustPressed = this.touch.jump && !this._prevJump;
    this._prevJump = this.touch.jump;

    this.player.update(this.cursors, this.wasd, this.touch);
    this.guards.forEach(g => g.update(this.player));

    // Show lever prompt when near
    if (!this.leverPulled) {
      const dist = Math.abs(this.player.x - LEVER_X);
      this.leverPrompt.setAlpha(dist < 80 ? 0.8 : 0);
    }

    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.05;
    this.bgMid.tilePositionX  = cam.scrollX * 0.25;
    this.bgNear.tilePositionX = cam.scrollX * 0.6;
  }
}

ENDOFFILE

cat > src/game/scenes/Level2Scene.js << 'ENDOFFILE'
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
  { x: 380,  patrolLeft: 260,  patrolRight: 520,  speed: 70  },
  { x: 700,  patrolLeft: 580,  patrolRight: 820,  speed: 80  },
  { x: 1000, patrolLeft: 860,  patrolRight: 1120, speed: 90  },
  { x: 1360, patrolLeft: 1200, patrolRight: 1560, speed: 85  },
  { x: 1700, patrolLeft: 1560, patrolRight: 1880, speed: 100 },
  { x: 2000, patrolLeft: 1880, patrolRight: 2180, speed: 95  },
  { x: 2300, patrolLeft: 2160, patrolRight: 2480, speed: 110 },
];

const CHECKPOINTS = [700, 1400, 2100];

export class Level2Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Level2Scene' });
    this.checkpointX = 60;
    this.checkpointY = GROUND_Y - 40;
    this.deathCount  = 0;
    this.touch = { left: false, right: false, jump: false, jumpJustPressed: false };
    this._prevJump = false;
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

    // ── COLLIDERS ─────────────────────────────────────────────────
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.guards.forEach(g => {
      this.physics.add.collider(g, this.groundGroup);
      this.physics.add.collider(g, this.platformGroup);
    });

    // ── OVERLAPS ──────────────────────────────────────────────────
    this.physics.add.overlap(this.player, this.hazardGroup,    this._killPlayer,   null, this);
    this.physics.add.overlap(this.player, this.checkpointGroup, this._hitCheckpoint, null, this);
    this.physics.add.overlap(this.player, this.exitZone,       this._winGame,       null, this);
    this.guards.forEach(guard => {
      this.physics.add.overlap(this.player, guard, () => this._killPlayer(), null, this);
    });

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
      lifespan: 400,
      quantity: 2,
      emitting: false,
    }).setDepth(16);

    this.events.on('player-step', (x, y) => {
      if (this.time.now % 120 < 60) this.dustEmitter.emitParticleAt(x, y, 3);
      if (this.time.now % 240 < 120) audio.playFootstep();
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

    // Ambient flicker
    this._scheduleFlicker();

    // Level title flash
    this.time.delayedCall(300, () => {
      const t = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 - 20, 'LEVEL 2', {
        fontFamily: '"Courier New", monospace',
        fontSize: '28px',
        color: '#445566',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0);
      this.tweens.add({
        targets: t, alpha: 0.8, duration: 800, yoyo: true, hold: 1000,
        onComplete: () => t.destroy(),
      });
    });
  }

  _buildExitDoor() {
    // Create door texture
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Door frame
    g.fillStyle(0x223344, 1);
    g.fillRect(0, 0, 40, 70);
    // Door glow
    g.fillStyle(0x44aaff, 0.8);
    g.fillRect(4, 4, 32, 62);
    // Inner light
    g.fillStyle(0xaaddff, 0.6);
    g.fillRect(10, 10, 20, 50);
    // Bright core
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(16, 16, 8, 38);
    g.generateTexture('exit-door', 40, 70);
    g.destroy();

    // Place door at end of level
    const doorX = WORLD_WIDTH - 80;
    const doorY = GROUND_Y - 35;
    this.exitDoorSprite = this.add.image(doorX, doorY, 'exit-door').setDepth(11);

    // Pulsing glow effect
    this.tweens.add({
      targets: this.exitDoorSprite,
      alpha: { from: 0.8, to: 1 },
      scaleX: { from: 1, to: 1.04 },
      scaleY: { from: 1, to: 1.04 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Physics zone
    this.exitZone = this.physics.add.staticImage(doorX, doorY, 'exit-door');
    this.exitZone.setDepth(11);
    this.exitZone.body.setSize(40, 70);
    this.exitZone.setAlpha(0);
    this.exitZone.refreshBody();
  }

  _buildRain() {
    // Rain particle texture
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
      lifespan: 1000,
      quantity: 4,
      scale: { min: 0.8, max: 1.2 },
      alpha: { start: 0.5, end: 0 },
      emitting: true,
    }).setDepth(25).setScrollFactor(0);
  }

  _buildUI() {
    this.deathText = this.add.text(16, 12, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#334455',
    }).setScrollFactor(0).setDepth(50);

    this.cpFlash = this.add.text(GAME_CONFIG.width / 2, 30, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#445566',
      alpha: 0,
    }).setScrollFactor(0).setDepth(50).setOrigin(0.5);
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
    const btnSize = 72, pad = 14;
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

    makeBtn('btn-left',  0x4488cc);
    makeBtn('btn-right', 0x4488cc);
    makeBtn('btn-jump',  0x88cc44);

    const leftBtn  = this.add.image(pad + btnSize / 2,          btnY, 'btn-left2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const rightBtn = this.add.image(pad + btnSize * 1.5 + 10,   btnY, 'btn-right2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();
    const jumpBtn  = this.add.image(W - pad - btnSize / 2,      btnY, 'btn-jump2').setScrollFactor(0).setDepth(100).setAlpha(alpha).setInteractive();

    const ls = { fontFamily: 'monospace', fontSize: '22px', color: '#aaccff' };
    const js = { fontFamily: 'monospace', fontSize: '22px', color: '#aaffaa' };
    this.add.text(pad + btnSize / 2,        btnY, '◀', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(pad + btnSize * 1.5 + 10, btnY, '▶', ls).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);
    this.add.text(W - pad - btnSize / 2,    btnY, '▲', js).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.7);

    const bindBtn = (btn, key) => {
      btn.on('pointerdown', () => { this.touch[key] = true;  btn.setAlpha(0.75); });
      btn.on('pointerup',   () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerout',  () => { this.touch[key] = false; btn.setAlpha(alpha); });
      btn.on('pointerupoutside', () => { this.touch[key] = false; btn.setAlpha(alpha); });
    };
    bindBtn(leftBtn,  'left');
    bindBtn(rightBtn, 'right');
    bindBtn(jumpBtn,  'jump');

    // Global safety — if pointer released anywhere, clear all touch states
    this.input.on('pointerup', () => {
      this.touch.left  = false;
      this.touch.right = false;
      this.touch.jump  = false;
      leftBtn.setAlpha(alpha);
      rightBtn.setAlpha(alpha);
      jumpBtn.setAlpha(alpha);
    });

    this.input.addPointer(3);
  }


  _buildWatermark() {
    const canvas = document.createElement('canvas');
    canvas.width  = 60;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    _drawAMSLogo(ctx, 30, 30, 28, 0.5);
    const key = 'ams-watermark-' + this.scene.key;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
    this.add.image(this.scale.width - 38, 22, key)
      .setScrollFactor(0)
      .setDepth(55)
      .setAlpha(0.18);
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
    this.player.die(() => {
      this.cameras.main.fade(400, 0, 0, 0);
      this.time.delayedCall(450, () => {
        this.player.respawn(this.checkpointX, this.checkpointY);
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

    // Save best death count
    const prev = localStorage.getItem('ams-best-deaths');
    if (prev === null || this.deathCount < parseInt(prev)) {
      localStorage.setItem('ams-best-deaths', this.deathCount);
    }

    const win = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 - 30, 'YOU ESCAPED', {
      fontFamily: '"Courier New", monospace',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);

    const sub = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 + 10, `deaths: ${this.deathCount}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#aabbcc',
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
          yoyo: true,
          ease: 'Stepped',
        });
        this._scheduleFlicker();
      },
    });
  }

  update() {
    this.touch.jumpJustPressed = this.touch.jump && !this._prevJump;
    this._prevJump = this.touch.jump;

    this.player.update(this.cursors, this.wasd, this.touch);
    this.guards.forEach(g => g.update(this.player));

    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.05;
    this.bgMid.tilePositionX  = cam.scrollX * 0.25;
    this.bgNear.tilePositionX = cam.scrollX * 0.6;
  }
}

ENDOFFILE

cat > src/game/entities/Player.js << 'ENDOFFILE'
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

    this.isDead       = false;
    this.isGrounded   = false;
    this._wasGrounded = false;
    this._landFrame   = 0;
    this._currentAnim = null;
    this._isRespawning = false;

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
    if (!this.scene.anims.exists(key)) return;
    this._currentAnim = key;
    this.play(key);
  }

  update(cursors, wasd, touch = {}) {
    if (this.isDead || this._isRespawning) return;

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
    if (this.isDead || this._isRespawning) return;
    this.isDead = true;
    this._isRespawning = false;
    this.scene.tweens.killTweensOf(this);
    this.stop();
    // Disable physics body immediately — prevents re-triggering overlaps
    this.body.enable = false;
    this.body.setVelocity(0, 0);

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
    this._isRespawning = true;
    this._currentAnim = null;
    this.setPosition(x, y);
    this.setAlpha(0);
    this.setScale(1, 1);
    this.setAngle(0);
    // Re-enable physics body
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

ENDOFFILE

cat > src/game/entities/Guard.js << 'ENDOFFILE'
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

ENDOFFILE

cat > src/App.jsx << 'ENDOFFILE'
import { useEffect, useRef } from 'react';
import { createGame } from './game/index.js';
import './App.css';

export default function App() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = createGame(containerRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="title-bar">
        <span className="title-word">I</span>
        <span className="title-word dim">N</span>
        <span className="title-word">S</span>
        <span className="title-word dim">I</span>
        <span className="title-word">D</span>
        <span className="title-word dim">E</span>
        <span className="subtitle">— a demo —</span>
      </div>
      <div ref={containerRef} className="game-container" />
      <div className="footer-bar">
        <span>avoid guards · reach the end</span>
      </div>
    </div>
  );
}

ENDOFFILE

cat > src/App.css << 'ENDOFFILE'
* { margin: 0; padding: 0; box-sizing: border-box; }

body, html, #root {
  width: 100%;
  height: 100%;
  background: #04040a;
  overflow: hidden;
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: #04040a;
  gap: 10px;
}

.title-bar {
  display: flex;
  align-items: baseline;
  gap: 1px;
  letter-spacing: 0.25em;
  user-select: none;
}

.title-word {
  font-family: 'Georgia', serif;
  font-size: 22px;
  color: #445566;
  font-style: italic;
}

.title-word.dim {
  color: #223344;
}

.subtitle {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #1a2530;
  margin-left: 14px;
  letter-spacing: 0.12em;
}

.game-container {
  width: 100%;
  max-width: 1280px;
  canvas {
    display: block;
    image-rendering: auto;
  }
}

.footer-bar {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: #1a2230;
  letter-spacing: 0.15em;
  text-transform: lowercase;
}

ENDOFFILE

cat > src/index.css << 'ENDOFFILE'
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #04040a; }

ENDOFFILE

echo "✅ Done!"