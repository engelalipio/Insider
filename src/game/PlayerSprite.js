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

