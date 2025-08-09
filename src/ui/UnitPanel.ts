import Phaser from 'phaser';
import type { GameState, Unit } from '../core/types';
import { W } from '../core/grid';

export class UnitPanel {
  // 依赖
  private scene: Phaser.Scene;
  private state: GameState;
  private onFortify: () => void;
  private onUpgrade: () => void;
  private tileSize: number;

  // 视图句柄
  private container: Phaser.GameObjects.Container | null = null;
  private bg: Phaser.GameObjects.Rectangle | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private stats: Phaser.GameObjects.Text | null = null;
  private btnFortify: Phaser.GameObjects.Container | null = null;
  private btnUpgrade: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    onFortify: () => void,
    onUpgrade: () => void,
    tileSize = 80
  ) {
    this.scene = scene;
    this.state = state;
    this.onFortify = onFortify;
    this.onUpgrade = onUpgrade;
    this.tileSize = tileSize;
  }

  build() {
    const panelX = W * this.tileSize + 10;
    const panelW = 240;
    this.container = this.scene.add.container(panelX, 40);

    this.bg = this.scene.add
      .rectangle(0, 0, panelW, 330, 0x1f2330, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x555);

    this.title = this.scene.add.text(10, 10, '未选中单位', {
      color: '#fff',
      fontSize: '16px',
    });

    this.stats = this.scene.add.text(10, 40, '', {
      color: '#ddd',
      lineSpacing: 6,
    });

    this.btnFortify = this.makeButton(
      10, 210, panelW - 20, 36,
      '驻扎（DEF+5 / 1回合）',
      this.onFortify
    );
    this.btnUpgrade = this.makeButton(
      10, 256, panelW - 20, 36,
      '升级（ATK+10 / HP+20）',
      this.onUpgrade
    );

    this.container.add([this.bg, this.title, this.stats, this.btnFortify, this.btnUpgrade]);
  }

  private makeButton(
    x: number, y: number, w: number, h: number,
    label: string, handler: () => void
  ) {
    const g = this.scene.add.container(x, y);
    const bg = this.scene.add
      .rectangle(0, 0, w, h, 0x3a4154, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x777);
    const txt = this.scene.add.text(12, 8, label, { color: '#fff' });
    g.add([bg, txt]);
    g.setSize(w, h);
    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => { if (!g.getData('disabled')) handler(); });
    g.setData('bg', bg);
    g.setData('txt', txt);
    this.setEnabled(g, false);
    return g;
  }

  private setEnabled(btn: Phaser.GameObjects.Container, enabled: boolean) {
    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
    const txt = btn.getData('txt') as Phaser.GameObjects.Text;
    btn.setData('disabled', !enabled);
    bg.fillColor = enabled ? 0x4a90e2 : 0x3a4154;
    txt.setColor(enabled ? '#fff' : '#999');
  }

  update(u: Unit | null) {
    if (!this.title || !this.stats || !this.btnFortify || !this.btnUpgrade) return;

    if (!u) {
      this.title.setText('未选中单位');
      this.stats.setText('点击棋子查看详情');
      this.setEnabled(this.btnFortify, false);
      this.setEnabled(this.btnUpgrade, false);
      return;
    }

    const side = u.side === 'ATT' ? '进攻(红)' : '防守(蓝)';
    const status: string[] = [];
    if ((u.fortifyTurnsLeft ?? 0) > 0)
      status.push(`驻扎(DEF+${u.fortifyDefBonus ?? 0}，剩${u.fortifyTurnsLeft}回合)`);
    if ((u.upgradeLv ?? 0) > 0) status.push('已升级');

    this.title.setText(u.name ?? `${side}-${u.id}`);
    this.stats.setText(
      `阵营：${side}\n兵种：${u.cls}\n流派：${u.arch}\n\nHP：${u.hp}/${u.maxHp}\nATK：${u.atk}\nDEF：${u.def}\nMP：${u.mp}/${u.maxMp}\n状态：${
        status.join('、') || '—'
      }`
    );

    const myTurn = u.side === this.state.turnSide;
    const canAct = myTurn && u.hp > 0 && u.mp > 0 && !u.hasActed;
    const canFortify = canAct && (u.fortifyTurnsLeft ?? 0) === 0;
    const canUpgrade = canAct && (u.upgradeLv ?? 0) < 1;

    this.setEnabled(this.btnFortify, !!canFortify);
    this.setEnabled(this.btnUpgrade, !!canUpgrade);
  }
}
