import Phaser from 'phaser';
import type { GameState, Unit } from '../core/types';
import { LAYOUT } from '../core/layout';
import { upkeepFor, incomeFor, minesOwned } from '../core/economy';

function makeButton(
  scene: Phaser.Scene,
  x: number, y: number, w: number, h: number,
  label: string,
  onTap: () => void
) {
  const g = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, 0x3a4154, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x777);
  const txt = scene.add.text(12, 8, label, { color: '#fff', fontSize: '16px' });
  g.add([bg, txt]);
  g.setSize(w, h);
  g.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
    .on('pointerdown', () => onTap());
  return g;
}

type Mode = 'shop' | 'unit';

export class MobileHUD {
  private scene: Phaser.Scene;
  private state: GameState;

  private onSpawnScout: () => void;
  private onSpawnMelee: () => void;
  private onEndTurn: () => void;
  private onFortify: () => void;
  private onUpgrade: () => void;

  private bg!: Phaser.GameObjects.Rectangle;
  private txtGold!: Phaser.GameObjects.Text; // 金币+维护+回合净

  private shopGroup!: Phaser.GameObjects.Container;
  private unitGroup!: Phaser.GameObjects.Container;

  private btnScout!: Phaser.GameObjects.Container;
  private btnMelee!: Phaser.GameObjects.Container;
  private btnEnd!: Phaser.GameObjects.Container;

  private unitTitle!: Phaser.GameObjects.Text;
  private unitBody!: Phaser.GameObjects.Text;
  private btnFortify!: Phaser.GameObjects.Container;
  private btnUpgrade!: Phaser.GameObjects.Container;

  private mode: Mode = 'shop';

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    onSpawnScout: () => void,
    onSpawnMelee: () => void,
    onEndTurn: () => void,
    onFortify: () => void,
    onUpgrade: () => void,
  ) {
    this.scene = scene;
    this.state = state;
    this.onSpawnScout = onSpawnScout;
    this.onSpawnMelee = onSpawnMelee;
    this.onEndTurn = onEndTurn;
    this.onFortify = onFortify;
    this.onUpgrade = onUpgrade;
  }

  build() {
    const WPIX = LAYOUT.width;
    const HUDH = LAYOUT.hud;
    const hudY = LAYOUT.height - HUDH;

    this.bg = this.scene.add
      .rectangle(0, hudY, WPIX, HUDH, 0x151824, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x333);

    // 金币 + 维护 + 回合净
    this.txtGold = this.scene.add.text(12, hudY + 8, '', {
      color: '#ffd54f', fontSize: '16px'
    });

    // — 商店 —
    this.shopGroup = this.scene.add.container(0, 0);
    const btnW = Math.floor((WPIX - 12 * 2 - 8 * 2) / 3);
    const btnH = 40;
    this.btnScout = makeButton(this.scene, 12, hudY + 36, btnW, btnH, '侦察兵 5G', () => this.onSpawnScout());
    this.btnMelee = makeButton(this.scene, 12 + btnW + 8, hudY + 36, btnW, btnH, '近战 10G', () => this.onSpawnMelee());
    this.btnEnd   = makeButton(this.scene, 12 + (btnW + 8) * 2, hudY + 36, btnW, btnH, '结束回合', () => this.onEndTurn());
    this.shopGroup.add([this.btnScout, this.btnMelee, this.btnEnd]);

    // — 单位 —
    this.unitGroup = this.scene.add.container(0, 0);
    this.unitTitle = this.scene.add.text(12, hudY + 44, '未选中单位', { color: '#fff', fontSize: '16px' });
    this.unitBody  = this.scene.add.text(12, hudY + 72, '点击棋子查看详情', {
      color: '#cbd5e1', fontSize: '14px', lineSpacing: 4,
    });

    const uBtnW = Math.floor((WPIX - 12 * 2 - 8) / 2);
    const uBtnH = 38;
    this.btnFortify = makeButton(this.scene, 12,            hudY + 116, uBtnW, uBtnH, '驻扎 +5DEF/1回合', () => this.onFortify());
    this.btnUpgrade = makeButton(this.scene, 12 + uBtnW + 8, hudY + 116, uBtnW, uBtnH, '升级 +10ATK +20HP', () => this.onUpgrade());
    this.unitGroup.add([this.unitTitle, this.unitBody, this.btnFortify, this.btnUpgrade]);

    this.setMode('shop');
    this.updateTop();
  }

  updateTop() {
    const s = this.state.turnSide;
    const upkeep = upkeepFor(this.state, s);
    const inc = incomeFor(minesOwned(this.state, s));
    const net = inc - upkeep;
    const netStr = net >= 0 ? `+${net}` : `${net}`;
    this.txtGold.setText(`金币：${this.state.gold[s]}    维护：-${upkeep}/回合    回合净：${netStr}`);
  }

  showUnit(u: Unit | null) {
    this.setMode('unit');
    if (!u) {
      this.unitTitle.setText('未选中单位');
      this.unitBody.setText('点击棋子查看详情');
      return;
    }
    const side = u.side === 'ATT' ? '红' : u.side === 'DEF' ? '蓝' : '中立';
    this.unitTitle.setText(`${side} · ${u.name ?? u.cls}`);
    this.unitBody.setText(`HP ${u.hp}/${u.maxHp}\nATK ${u.atk}  DEF ${u.def}\nMP ${u.mp}/${u.maxMp}`);
  }

  showShop() { this.setMode('shop'); }

  private setMode(m: Mode) {
    this.shopGroup.setVisible(m === 'shop');
    this.unitGroup.setVisible(m === 'unit');
  }
}
