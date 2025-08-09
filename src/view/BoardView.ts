import Phaser from 'phaser';
import { W, H, tileAt, moveCost } from '../core/grid';
import type { GameState, Unit } from '../core/types';
import { LAYOUT } from '../core/layout';

export class BoardView {
  public state: GameState;
  public scene: Phaser.Scene;
  public tileSize: number;

  private onUnitClick: (u: Unit) => void;
  private onTileClick: (x: number, y: number) => void;

  public tileRects: Phaser.GameObjects.Rectangle[][] = [];
  public unitGfx: Map<string, Phaser.GameObjects.Arc> = new Map();
  public hpTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  public highlights: Phaser.GameObjects.Rectangle[] = [];
  private readyRings: Map<string, Phaser.GameObjects.Arc> = new Map();
  private mineIcons: Phaser.GameObjects.Container[] = [];

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    tile: number,
    onUnitClick: (u: Unit) => void,
    onTileClick: (x: number, y: number) => void
  ) {
    this.scene = scene;
    this.state = state;
    this.tileSize = tile;
    this.onUnitClick = onUnitClick;
    this.onTileClick = onTileClick;
  }

  // ===== 绘制棋盘（占屏幕 70% 高度，剩余 30% 给 HUD） =====
  drawBoard() {
    const tiles = this.state.tiles;
    for (let y = 0; y < H; y++) {
      this.tileRects[y] = [];
      for (let x = 0; x < W; x++) {
        const t = tileAt(tiles, x, y)!;
        const color =
          t.type === 'FOREST'   ? 0x2e8b57 :
          t.type === 'HILL'     ? 0x8f7a66 :
          t.type === 'RIVER'    ? 0x2f6ee2 :
          t.type === 'SWAMP'    ? 0x4b3b66 :
          t.type === 'MOUNTAIN' ? 0x777777 :
          0x4a4f66;

        const r = this.scene.add.rectangle(
          x * this.tileSize + this.tileSize / 2,
          y * this.tileSize + this.tileSize / 2,
          this.tileSize - 2, this.tileSize - 2, color
        ).setStrokeStyle(1, 0x000000)
         .setInteractive({ useHandCursor: true });

        r.on('pointerdown', () => this.onTileClick(x, y));
        this.tileRects[y][x] = r;
      }
    }
    this.drawMines();
    this.drawUnits();
  }

  // ===== 金矿图标（金币 + 归属描边） =====
  private drawMines() {
    this.mineIcons.forEach(c => c.destroy());
    this.mineIcons = [];

    const S = this.tileSize;
    for (const m of this.state.mines) {
      const gx = m.x * S + S / 2;
      const gy = m.y * S + S / 2;

      const box = this.scene.add.container(gx, gy);
      const coin = this.scene.add.circle(0, 0, S * 0.18, 0xffd54f).setStrokeStyle(2, 0x996515);
      const bar  = this.scene.add.rectangle(0, S * 0.02, S * 0.16, S * 0.06, 0x996515);
      box.add([coin, bar]);

      if (m.owner) {
        const color = m.owner === 'ATT' ? 0xff7360 : 0x66c2ff;
        const ring = this.scene.add.circle(0, 0, S * 0.26, color, 0).setStrokeStyle(3, color);
        box.add(ring);
        box.sendToBack(ring);
      }
      this.mineIcons.push(box);
    }
  }
  refreshMines() { this.drawMines(); }

  // ===== 单位绘制（未行动黄圈 + HP） =====
  drawUnits() {
    this.unitGfx.forEach(g => g.destroy()); this.unitGfx.clear();
    this.hpTexts.forEach(t => t.destroy()); this.hpTexts.clear();
    this.readyRings.forEach(r => r.destroy()); this.readyRings.clear();

    for (const u of this.state.units) {
      if (u.hp <= 0) continue;
      const color = u.side === 'ATT' ? 0xff7360 : (u.side === 'DEF' ? 0x66c2ff : 0xaaaaaa);

      if ((u.side === this.state.turnSide) && !u.npcGuard && !u.hasActed) {
        const ring = this.scene.add.circle(
          u.x * this.tileSize + this.tileSize / 2,
          u.y * this.tileSize + this.tileSize / 2,
          this.tileSize * 0.34
        ).setStrokeStyle(3, 0xffd54f).setFillStyle(0, 0);
        this.readyRings.set(u.id, ring);
      }

      const circle = this.scene.add.circle(
        u.x * this.tileSize + this.tileSize / 2,
        u.y * this.tileSize + this.tileSize / 2,
        this.tileSize * 0.3,
        color
      ).setInteractive({ useHandCursor: true });
      circle.on('pointerdown', () => this.onUnitClick(u));
      this.unitGfx.set(u.id, circle);

      const txt = this.scene.add.text(
        u.x * this.tileSize + 10,
        u.y * this.tileSize + 8,
        String(u.hp),
        { color: '#fff', fontSize: '12px' }
      );
      this.hpTexts.set(u.id, txt);
    }
  }
  refreshUnits() { this.drawUnits(); this.drawMines(); }

  // ===== 高亮 =====
  clearHighlights() {
    this.highlights.forEach(h => h.destroy());
    this.highlights = [];
  }

  showStepHighlights(u: Unit) {
    this.clearHighlights();

    const cand = ([
      [u.x + 1, u.y], [u.x - 1, u.y], [u.x, u.y + 1], [u.x, u.y - 1],
    ] as [number, number][])
    .filter(([x, y]) => x >= 0 && x < W && y >= 0 && y < H);

    for (const [x, y] of cand) {
      if (this.state.units.some(w => w.hp > 0 && w.x === x && w.y === y)) continue;
      const tt = tileAt(this.state.tiles, x, y)!;
      if (tt.type === 'MOUNTAIN') continue;
      const cost = u.ignoresTerrain ? 1 : moveCost[tt.type];
      if (u.mp < cost) continue;

      const h = this.scene.add.rectangle(
        x * this.tileSize + this.tileSize / 2,
        y * this.tileSize + this.tileSize / 2,
        this.tileSize - 6, this.tileSize - 6,
        0xffff00, 0.2
      ).setStrokeStyle(2, 0xffd54f);
      this.highlights.push(h);
    }
  }

  // 放置模式：任意坐标高亮
  showTileHighlights(coords: [number, number][]) {
    this.clearHighlights();
    for (const [x, y] of coords) {
      const h = this.scene.add.rectangle(
        x * this.tileSize + this.tileSize / 2,
        y * this.tileSize + this.tileSize / 2,
        this.tileSize - 6, this.tileSize - 6,
        0x00ff00, 0.18
      ).setStrokeStyle(2, 0x00dd88);
      this.highlights.push(h);
    }
  }
}
