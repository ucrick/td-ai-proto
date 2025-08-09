import Phaser from 'phaser';
import { W, H, tileAt, moveCost } from '../core/grid';
import type { GameState, Unit } from '../core/types';

export class BoardView {
  // —— 依赖 & 回调 —— //
  private scene: Phaser.Scene;
  private state: GameState;
  private tileSize: number;
  private onUnitClick: (u: Unit) => void;
  private onTileClick: (x: number, y: number) => void;

  // —— 视图句柄 —— //
  public tileRects: Phaser.GameObjects.Rectangle[][] = [];
  public unitGfx: Map<string, Phaser.GameObjects.Arc> = new Map();
  public hpTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  public highlights: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    tileSize = 80,
    onUnitClick: (u: Unit) => void,
    onTileClick: (x: number, y: number) => void
  ) {
    this.scene = scene;
    this.state = state;
    this.tileSize = tileSize;
    this.onUnitClick = onUnitClick;
    this.onTileClick = onTileClick;
  }

  drawBoard() {
    const tiles = this.state.tiles;
    for (let y = 0; y < H; y++) {
      this.tileRects[y] = [];
      for (let x = 0; x < W; x++) {
        const t = tileAt(tiles, x, y)!;
        const color =
          t.type === 'SWAMP'  ? 0x4b3b66 : // 新：沼泽
          t.type === 'FOREST' ? 0x2e8b57 :
          t.type === 'HILL'   ? 0x8f7a66 :
          t.type === 'RIVER'  ? 0x2f6ee2 : 0x4a4f66;

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
  }

  drawUnits() {
    // 清旧
    this.unitGfx.forEach(g => g.destroy()); this.unitGfx.clear();
    this.hpTexts.forEach(t => t.destroy()); this.hpTexts.clear();

    for (const u of this.state.units) {
      if (u.hp <= 0) continue;
      const color = u.side === 'ATT' ? 0xff7360 : 0x66c2ff;
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

      // 驻扎环提示
      if ((u.fortifyTurnsLeft ?? 0) > 0) {
        this.scene.add.circle(
          u.x * this.tileSize + this.tileSize / 2,
          u.y * this.tileSize + this.tileSize / 2,
          this.tileSize * 0.36,
          0x00ff00, 0.12
        ).setStrokeStyle(2, 0x00aa00);
      }
    }
  }

  refreshUnits() {
    for (const u of this.state.units) {
      const g = this.unitGfx.get(u.id);
      const t = this.hpTexts.get(u.id);
      if (!g || !t) continue;
      if (u.hp <= 0) { g.destroy(); t.destroy(); continue; }
      g.setPosition(u.x * this.tileSize + this.tileSize / 2, u.y * this.tileSize + this.tileSize / 2);
      t.setPosition(u.x * this.tileSize + 10, u.y * this.tileSize + 8);
      t.setText(String(u.hp));
    }
    // 简易：重画一遍以刷新驻扎环
    this.drawUnits();
  }

  clearHighlights() {
    this.highlights.forEach(h => h.destroy());
    this.highlights = [];
  }

  showStepHighlights(u: Unit) {
    this.clearHighlights();

    const cand = ([
      [u.x + 1, u.y],
      [u.x - 1, u.y],
      [u.x, u.y + 1],
      [u.x, u.y - 1],
    ] as [number, number][])
    .filter(([x, y]) => x >= 0 && x < W && y >= 0 && y < H);

    for (const [x, y] of cand) {
      if (this.state.units.some(w => w.hp > 0 && w.x === x && w.y === y)) continue;
      const tt = tileAt(this.state.tiles, x, y)!;
      const cost = moveCost[tt.type];
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
}
