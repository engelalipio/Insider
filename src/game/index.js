import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
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
    scene: [BootScene, GameScene, Level2Scene],
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

