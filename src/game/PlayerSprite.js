// ── PlayerSprite ──────────────────────────────────────────────────────────────
// Generates a spritesheet texture procedurally using canvas.
// Frame layout (28x40 each):
//   0-1    idle     (2 frames)
//   2-7    run      (6 frames)
//   8      jump
//   9      fall
//  10      land
//  11      attack0  (wind-up)
//  12      attack1  (slash)

const W = 28;   // frame width
const H = 40;   // frame height
const FRAMES = 13;

// ── Blasphemous Penitent colour palette ──────────────────────────────────────
// Bright off-white robe makes the player pop against dark backgrounds.
const C = {
  robe:    '#e8dfc8',  // cream/off-white robe — very visible
  robeSh:  '#b8a888',  // robe shadow fold
  hood:    '#181820',  // very dark hood
  skin:    '#c8956c',  // warm skin tone
  belt:    '#8b6914',  // leather belt
  trim:    '#d4a820',  // gold trim / rope detail
  shoe:    '#2a1a08',  // dark leather shoes
  eye:     '#ffffff',  // bright eye dot
  blade:   '#e8e8f0',  // silver blade
  bladeGl: '#ffd060',  // gold blade glint
};

// ── Pose definitions ──────────────────────────────────────────────────────────
const poses = {
  idle0: {
    headY:4,  headX:14,
    torsoY:14,
    legL:[6,28,7,11],  legR:[15,28,7,11],
    armL:[2,16,5,10],  armR:[21,16,5,10],
  },
  idle1: {
    headY:5,  headX:14,
    torsoY:15,
    legL:[6,29,7,10],  legR:[15,29,7,10],
    armL:[2,17,5,9],   armR:[21,17,5,9],
  },
  run0: {
    headY:3,  headX:15,
    torsoY:13,
    legL:[3,26,7,13],  legR:[17,28,7,11],
    armL:[20,14,5,12], armR:[3,14,5,12],
  },
  run1: {
    headY:4,  headX:14,
    torsoY:14,
    legL:[5,26,7,13],  legR:[16,27,7,12],
    armL:[19,15,5,11], armR:[4,15,5,11],
  },
  run2: {
    headY:3,  headX:13,
    torsoY:13,
    legL:[17,28,7,11], legR:[3,26,7,13],
    armL:[3,14,5,12],  armR:[20,14,5,12],
  },
  run3: {
    headY:2,  headX:14,
    torsoY:12,
    legL:[7,26,7,13],  legR:[14,26,7,13],
    armL:[2,15,5,10],  armR:[21,15,5,10],
  },
  run4: {
    headY:3,  headX:13,
    torsoY:13,
    legL:[17,26,7,13], legR:[3,28,7,11],
    armL:[3,14,5,12],  armR:[20,14,5,12],
  },
  run5: {
    headY:4,  headX:14,
    torsoY:14,
    legL:[16,26,7,13], legR:[5,27,7,12],
    armL:[4,15,5,11],  armR:[19,15,5,11],
  },
  jump: {
    headY:2,  headX:14,
    torsoY:11,
    legL:[5,24,7,10],  legR:[16,24,7,10],
    armL:[1,12,5,8],   armR:[22,12,5,8],
  },
  fall: {
    headY:4,  headX:14,
    torsoY:14,
    legL:[3,28,8,11],  legR:[17,28,8,11],
    armL:[0,15,6,8],   armR:[22,15,6,8],
  },
  land: {
    headY:8,  headX:14,
    torsoY:17,
    legL:[4,28,9,8],   legR:[15,28,9,8],
    armL:[0,18,6,7],   armR:[22,18,6,7],
  },
  // ── Attack: wind-up (arm raised, body pivoting) ──────────────────────────
  attack0: {
    headY:2,  headX:12,
    torsoY:12,
    legL:[5,26,7,12],  legR:[14,26,7,12],
    armL:[1,15,5,9],   armR:[16,8,8,8],   // right arm raised
    blade: null,
  },
  // ── Attack: slash (arm driving forward + blade tip) ─────────────────────
  attack1: {
    headY:2,  headX:15,
    torsoY:12,
    legL:[4,25,7,13],  legR:[14,25,7,13],
    armL:[0,16,5,8],   armR:[16,12,10,5], // right arm extended
    blade: [26, 10, 9, 3],               // silver blade tip beyond body
  },
};

// ── Draw one frame ─────────────────────────────────────────────────────────
function drawFrame(ctx, ox, oy, pose) {
  ctx.clearRect(ox, oy, W, H);

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

  const p = poses[pose];
  if (!p) return;

  // ── Draw order: shoes → robe folds → legs → torso → belt → arms → hood/head ──

  // Shoes
  fill(C.shoe, p.legL[0], p.legL[1] + p.legL[3] - 3, p.legL[2], 3);
  fill(C.shoe, p.legR[0], p.legR[1] + p.legR[3] - 3, p.legR[2], 3);

  // Robe legs (wider, flowing)
  fill(C.robe,   ...p.legL);
  fill(C.robe,   ...p.legR);
  // Inner shadow on each leg
  fill(C.robeSh, p.legL[0] + 1, p.legL[1], 2, p.legL[3] - 3);
  fill(C.robeSh, p.legR[0] + p.legR[2] - 3, p.legR[1], 2, p.legR[3] - 3);

  // Torso robe
  fill(C.robe,   5, p.torsoY, 18, 14);
  // Centre fold shadow
  fill(C.robeSh, 12, p.torsoY + 2, 2, 10);
  // Side fold shadows
  fill(C.robeSh, 5,  p.torsoY, 2, 12);
  fill(C.robeSh, 21, p.torsoY, 2, 12);

  // Gold trim strip across chest
  fill(C.trim, 6, p.torsoY + 1, 16, 2);

  // Belt / rope
  fill(C.belt, 5, p.torsoY + 9, 18, 3);
  // Belt knot hint
  fill(C.trim, 11, p.torsoY + 9, 4, 3);

  // Arms (robe sleeves)
  fill(C.robe, ...p.armL);
  fill(C.robe, ...p.armR);

  // Blade / weapon (attack1 only)
  if (p.blade) {
    fill(C.blade,   ...p.blade);
    // gold glint on blade edge
    fill(C.bladeGl, p.blade[0], p.blade[1], p.blade[2], 1);
  }

  // Neck
  fill(C.skin, p.headX - 2, p.headY + 8, 5, 4);

  // Head — dark hood
  circle(C.hood, p.headX, p.headY + 5, 7);
  // Hood brim / cowl shadow
  fill(C.hood, p.headX - 7, p.headY + 2, 14, 5);
  // Face window (visible skin patch inside hood)
  fill(C.skin, p.headX - 3, p.headY + 4, 7, 5);

  // Eye (bright white dot — pops against dark hood)
  fill(C.eye, p.headX + 1, p.headY + 5, 2, 2);
}

// ── PUBLIC: generate the spritesheet texture in Phaser ────────────────────────
export function generatePlayerSheet(scene) {
  const canvas = document.createElement('canvas');
  canvas.width  = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const poseNames = [
    'idle0','idle1',
    'run0','run1','run2','run3','run4','run5',
    'jump','fall','land',
    'attack0','attack1',
  ];
  poseNames.forEach((pose, i) => drawFrame(ctx, i * W, 0, pose));

  if (scene.textures.exists('player-sheet')) {
    scene.textures.remove('player-sheet');
  }
  scene.textures.addSpriteSheet('player-sheet', canvas, {
    frameWidth:  W,
    frameHeight: H,
  });
}

export const ANIM_FRAMES = {
  IDLE:    [0, 1],
  RUN:     [2, 3, 4, 5, 6, 7],
  JUMP:    [8],
  FALL:    [9],
  LAND:    [10],
  ATTACK:  [11, 12, 12],
};

export const FRAME_W = W;
export const FRAME_H = H;
export const TOTAL_FRAMES = FRAMES;
