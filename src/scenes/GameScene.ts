import Phaser from 'phaser';
import { genMap, tileAt } from '../core/grid';
import type { GameState, Unit } from '../core/types';
import { calcExchangeDamage } from '../core/combat';
import { endSideTurn, moveUnit } from '../core/turn';
import { aiTakeTurn } from '../core/ai/ai-rule';
import { BoardView } from '../view/BoardView';
import { UnitPanel } from '../ui/UnitPanel';

export class GameScene extends Phaser.Scene {
  state!: GameState;
  board!: BoardView;
  panel!: UnitPanel;
  hudTurn!: Phaser.GameObjects.Text;
  tileSize = 80;
  selected: Unit | null = null;

  constructor() { super('GameScene'); }

  create() {
    const tiles = genMap();

    // 示例单位：ATK=50 DEF=50
    const mk = (id: string, side:'ATT'|'DEF', cls:any, arch:any, x:number, y:number, name?:string): Unit => ({
      id, side, cls, arch, x, y,
      hp:100, maxHp:100, atk:50, def:50,
      mp:3, maxMp:3, hasActed:false,
      fortifyTurnsLeft:0, fortifyDefBonus:0, upgradeLv:0, name
    });

    this.state = {
      turnSide:'ATT',
      tiles,
      units:[
        mk('a1','ATT','CAVALRY','BURST',1,6,'红-骑兵'),
        mk('a2','ATT','INFANTRY','MOB', 2,6,'红-步兵'),
        mk('d1','DEF','ANTI_CAV','AOE', 5,1,'蓝-抗骑'),
        mk('d2','DEF','INFANTRY','MOB', 6,1,'蓝-步兵'),
      ],
      round:1
    };

    // HUD
    this.hudTurn = this.add.text(16, 8, '', { color:'#fff' });
    this.add.text(580, 8, '结束回合', { color:'#fff', backgroundColor:'#444', padding:{left:8,right:8,top:2,bottom:2}})
      .setInteractive({ useHandCursor:true })
      .on('pointerdown', ()=> this.playerEndTurn());
    this.updateHud();

    // 视图
    this.board = new BoardView(
      this, this.state, this.tileSize,
      (u)=>this.onUnitClick(u),
      (x,y)=>this.onTileClick(x,y)
    );
    this.board.drawBoard();
    this.board.drawUnits();

    // 面板
    this.panel = new UnitPanel(
      this, this.state,
      ()=>this.onFortify(),
      ()=>this.onUpgrade(),
      this.tileSize
    );
    this.panel.build();
    this.panel.update(null);
  }

  // —— 交互 —— //
  onUnitClick(clicked: Unit) {
    // 若已选中己方 & 点到相邻敌人 → 直接攻击
    if (this.selected && clicked.side !== this.selected.side) {
      if (Math.abs(clicked.x - this.selected.x) + Math.abs(clicked.y - this.selected.y) === 1) {
        this.resolveAttack(this.selected, clicked);
        return;
      }
    }
    // 选中本方单位
    this.selected = clicked.side === this.state.turnSide ? clicked : null;
    if (this.selected) {
      this.board.showStepHighlights(this.selected);
      this.panel.update(this.selected);
    } else {
      this.board.clearHighlights();
      this.panel.update(null);
    }
  }

  onTileClick(x:number,y:number) {
    const u = this.selected; if (!u) return;
    // 若该格是相邻敌人 → 也允许直接攻击
    const enemy = this.state.units.find(en => en.hp>0 && en.side!==u.side && en.x===x && en.y===y
      && Math.abs(en.x-u.x)+Math.abs(en.y-u.y)===1);
    if (enemy) { this.resolveAttack(u, enemy); return; }

    // 否则移动
    const occupied = this.state.units.some(w => w.hp>0 && w.x===x && w.y===y);
    if (occupied) return;

    const ok = moveUnit(this.state, u, x, y);
    if (ok) {
      if (u.mp===0) u.hasActed = true;
      this.board.refreshUnits();
      this.board.showStepHighlights(u);
      this.panel.update(u);
      this.checkAutoEnd();
    }
  }

  // —— 面板按钮 —— //
  onFortify() {
    const u = this.selected; if (!u) return;
    const bonus = 5; // DEF +5，持续1回合
    u.def += bonus;
    u.fortifyDefBonus = (u.fortifyDefBonus ?? 0) + bonus;
    u.fortifyTurnsLeft = (u.fortifyTurnsLeft ?? 0) + 1;

    u.hasActed = true; u.mp = 0;
    this.selected = null;
    this.board.clearHighlights();
    this.board.refreshUnits();
    this.panel.update(null);
    this.checkAutoEnd();
  }

  onUpgrade() {
    const u = this.selected; if (!u) return;
    u.upgradeLv = Math.min(1, (u.upgradeLv ?? 0) + 1);
    u.atk += 10; u.maxHp += 20; u.hp = Math.min(u.maxHp, u.hp + 20);
    u.hasActed = true; u.mp = 0;
    this.selected = null;
    this.board.clearHighlights();
    this.board.refreshUnits();
    this.panel.update(null);
    this.checkAutoEnd();
  }

  // —— 战斗 & 回合 —— //
  private resolveAttack(attacker: Unit, defender: Unit) {
    const attTile = tileAt(this.state.tiles, attacker.x, attacker.y)!.type;
    const defTile = tileAt(this.state.tiles, defender.x, defender.y)!.type;

    const { dmgToDef, dmgToAtt } = calcExchangeDamage(attacker, defender, attTile, defTile);

    defender.hp = Math.max(0, defender.hp - dmgToDef);
    attacker.hp = Math.max(0, attacker.hp - dmgToAtt);

    attacker.hasActed = true;
    attacker.mp = 0;
    this.selected = null;

    this.board.clearHighlights();
    this.board.refreshUnits();
    this.panel.update(null);

    // 攻击后立刻结束整方回合
    this.playerEndTurn();
  }

  private checkAutoEnd() {
    const my = this.state.units.filter(u => u.side===this.state.turnSide && u.hp>0);
    const canAct = my.some(u => u.mp>0 && !u.hasActed);
    if (!canAct) this.playerEndTurn();
  }

  private playerEndTurn() {
    // 本方回合末：驻扎衰减 & 撤回加成
    this.state.units.forEach(u=>{
      if (u.side!==this.state.turnSide) return;
      if ((u.fortifyTurnsLeft ?? 0) > 0) {
        u.fortifyTurnsLeft!--;
        if (u.fortifyTurnsLeft! <= 0) {
          const bonus = u.fortifyDefBonus ?? 0;
          if (bonus) u.def = Math.max(0, u.def - bonus);
          u.fortifyDefBonus = 0;
          u.fortifyTurnsLeft = 0;
        }
      }
    });

    // 切到 AI
    endSideTurn(this.state); this.updateHud();
    aiTakeTurn(this.state);
    this.board.refreshUnits();

    // AI 回合末也衰减他们的驻扎
    this.state.units.forEach(u=>{
      if (u.side!==this.state.turnSide) return; // 现在 turnSide = DEF
      if ((u.fortifyTurnsLeft ?? 0) > 0) {
        u.fortifyTurnsLeft!--;
        if (u.fortifyTurnsLeft! <= 0) {
          const bonus = u.fortifyDefBonus ?? 0;
          if (bonus) u.def = Math.max(0, u.def - bonus);
          u.fortifyDefBonus = 0;
          u.fortifyTurnsLeft = 0;
        }
      }
    });

    // 回到玩家
    endSideTurn(this.state); this.updateHud();
    this.board.refreshUnits();
  }

  private updateHud() {
    this.hudTurn.setText(`回合：${this.state.round}  当前行动方：${this.state.turnSide==='ATT'?'进攻(红)':'防守(蓝)'}`);
  }
}
