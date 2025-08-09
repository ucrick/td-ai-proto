import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const TILE = 80;
const W = 8;
const H = 8;
const PANEL = 260; // 面板+边距
const WIDTH  = W * TILE + PANEL; // 640 + 260 = 900
const HEIGHT = H * TILE + 20;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#1b1d2a',
  scene: [GameScene]
});
