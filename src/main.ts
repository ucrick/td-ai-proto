// src/main.ts
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { LAYOUT } from './core/layout';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LAYOUT.width,
  height: LAYOUT.height,
  backgroundColor: '#1b1d2a',
  scene: [GameScene],
});

// 简单处理横竖屏/窗口变化：整页刷新重新计算布局
window.addEventListener('orientationchange', () => location.reload());
window.addEventListener('resize', () => location.reload());
