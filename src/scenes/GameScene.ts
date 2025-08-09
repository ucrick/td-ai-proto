import Phaser from 'phaser';
import { genMap, genMines, tileAt, W, H } from '../core/grid';
import type { GameState, Unit, Mine } from '../core/types';
import { calcExchangeDamage } from '../core/combat';
import { endSideTurn, moveUnit } from '../core/turn';
import { BoardView } from '../view/BoardView';
import { aiTakeTurn } from '../core/ai/ai-rule';
import { LAYOUT } from '../core/layout';
import { MobileHUD } from '../ui/MobileHUD';
import { settleEconomyAtTurnStart } from '../core/economy';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private board!: BoardView;
  private hud!: MobileHUD;
  private selected: Unit | null = null;

  create() {
    const tiles = genMap();
    const mines: Mine[] = genMines().map(p => ({ x: p.x, y: p.y, owner: null }));

    // 守军（不攻不动）
    const guard = (id: string, x: number, y: number, def: number, name: string): Unit => ({
      id, side: 'NEUTRAL', cls: 'INFANTRY', arch: 'MOB',
      x, y, hp: 100, maxHp: 100, atk: 0, def,
      mp: 0, maxMp: 0, hasActed: true, npcGuard: true, name
    });
    const guards: Unit[] = [
      guard('g1', 0, 0, 40, '野蛮人'),
      guard('g2', W-1, 0, 40, '野蛮人'),
      guard('g3', 0, H-1, 40, '野蛮人'),
      guard('g4', W-1, H-1, 40, '野蛮人'),
      guard('g5', Math.floor(W/2), Math.floor(H/2), 50, '枪兵'),
    ];

    // 初始金币：双方 50
    this.state = {
      turnSide: 'ATT',
      tiles, units: [...guards], mines,
      round: 1,
      gold: { ATT: 50, DEF: 50 },
    };

    // 棋盘
    this.board = new BoardView(
      this, this.state, LAYOUT.tile,
      (u)=>this.onUnitClick(u),
      (x,y)=>this.onTileClick(x,y)
    );
    this.board.drawBoard();
    this.board.drawUnits();

    // HUD（含驻扎/升级）
    this.hud = new MobileHUD(
      this, this.state,
      () => this.spawnScout(this.state.turnSide),
      () => this.spawnMelee(this.state.turnSide),
      () => this.playerEndTurn(),
      () => this.onFortify(),
      () => this.onUpgrade(),
    );
    this.hud.build();
    this.hud.showShop();

    // 先手出一个近战（扣钱）
    this.spawnMelee('ATT', 1, H - 2);
    this.hud.updateTop();
  }

  // —— 单位交互 —— //
  private onUnitClick(u: Unit) {
    if (this.selected && u.side !== this.selected.side) {
      if (Math.abs(u.x - this.selected.x) + Math.abs(u.y - this.selected.y) === 1) {
        this.resolveAttack(this.selected, u); return;
      }
    }
    this.selected = (u.side === this.state.turnSide && !u.npcGuard) ? u : null;
    if (this.selected) {
      this.board.showStepHighlights(this.selected);
      this.hud.showUnit(this.selected);
    } else {
      this.board.clearHighlights();
      this.hud.showShop();
    }
  }

  private onTileClick(x:number,y:number) {
    const u = this.selected;
    if (!u) { this.board.clearHighlights(); this.hud.showShop(); return; }

    const enemy = this.state.units.find(en => en.hp>0 && en.side!==u.side && en.x===x && en.y===y &&
      Math.abs(en.x-u.x)+Math.abs(en.y-u.y)===1);
    if (enemy) { this.resolveAttack(u, enemy); return; }

    if (moveUnit(this.state, u, x, y)) {
      this.board.refreshUnits();
      this.board.showStepHighlights(u);
      this.tryCaptureMine(u);
      this.hud.updateTop();
      this.hud.showUnit(u);
    } else {
      this.board.clearHighlights();
      this.hud.showShop();
    }
  }

  // —— 战斗 —— //
  private resolveAttack(attacker: Unit, defender: Unit) {
    const attTile = tileAt(this.state.tiles, attacker.x, attacker.y)!.type;
    const defTile = tileAt(this.state.tiles, defender.x, defender.y)!.type;
    const { dmgToDef, dmgToAtt } =
      (defender.npcGuard ? { dmgToDef: calcExchangeDamage(attacker, defender, attTile, defTile, this.state).dmgToDef, dmgToAtt: 0 }
                          : calcExchangeDamage(attacker, defender, attTile, defTile, this.state));

    defender.hp = Math.max(0, defender.hp - dmgToDef);
    attacker.hp = Math.max(0, attacker.hp - dmgToAtt);

    attacker.hasActed = true; attacker.mp = 0;
    this.selected = null;

    if (defender.hp<=0) this.tryCaptureMine(attacker);

    this.board.clearHighlights();
    this.board.refreshUnits();
    this.hud.updateTop();
    this.hud.showShop();

    this.playerEndTurn();
  }

  private tryCaptureMine(u: Unit) {
    const mine = this.state.mines.find(m => m.x===u.x && m.y===u.y);
    if (!mine) return;
    const guardAlive = this.state.units.some(t => t.hp>0 && t.side==='NEUTRAL' && t.x===u.x && t.y===u.y);
    if (guardAlive) return;
    if (u.side==='ATT' || u.side==='DEF') { mine.owner = u.side; this.board.refreshMines(); }
  }

  // —— 单位动作：驻扎 / 升级 —— //
  private onFortify() {
    if (!this.selected) return;
    const u = this.selected;
    if (u.hasActed) return;

    u.def += 5;
    u.fortifyDefBonus = (u.fortifyDefBonus ?? 0) + 5;
    u.fortifyTurnsLeft = (u.fortifyTurnsLeft ?? 0) + 1;

    u.hasActed = true; u.mp = 0;
    this.board.clearHighlights();
    this.board.refreshUnits();
    this.hud.showShop(); // 动作后回到商店
  }

  private onUpgrade() {
    if (!this.selected) return;
    const u = this.selected;
    if (u.hasActed) return;

    u.atk += 10;
    u.maxHp += 20;
    u.hp = Math.min(u.maxHp, u.hp + 20);

    u.hasActed = true; u.mp = 0;
    this.board.clearHighlights();
    this.board.refreshUnits();
    this.hud.showShop();
  }

  // —— 回合切换 & 经济 —— //
  private playerEndTurn() {
    // 撤销驻扎加成：到本方回合结束清算
    for (const u of this.state.units) {
      if (u.fortifyTurnsLeft && u.fortifyTurnsLeft > 0) {
        u.fortifyTurnsLeft -= 1;
        if (u.fortifyTurnsLeft === 0 && u.fortifyDefBonus) {
          u.def -= u.fortifyDefBonus;
          u.fortifyDefBonus = 0;
        }
      }
    }

    endSideTurn(this.state);

    settleEconomyAtTurnStart(this.state, this.state.turnSide, (side, x, y) => this.spawnScout(side, x, y));
    this.board.refreshUnits();
    this.hud.updateTop();
    this.hud.showShop();

    if (this.state.turnSide === 'DEF') {
      aiTakeTurn(this.state);
      endSideTurn(this.state);
      settleEconomyAtTurnStart(this.state, this.state.turnSide, (side, x, y) => this.spawnScout(side, x, y));
      this.board.refreshUnits();
      this.hud.updateTop();
      this.hud.showShop();
    }
  }

  // —— 造兵（买即扣钱） —— //
  private spawnScout(side:'ATT'|'DEF', x?:number, y?:number) {
    const cost = 5;
    if (this.state.gold[side] < cost) return;
    if (x==null || y==null) { x = side==='ATT'?1:W-2; y = side==='ATT'?H-2:1; }
    if (this.state.units.some(u=>u.hp>0 && u.x===x && u.y===y)) return;

    const id = `s-${side}-${Date.now()}-${Math.floor(Math.random()*999)}`;
    const u: Unit = {
      id, side, cls:'SCOUT', arch:'MOB',
      x, y, hp:100, maxHp:100, atk:15, def:20,
      mp:5, maxMp:5, hasActed:false,
      ignoresTerrain:true, cost
    };
    this.state.units.push(u);
    this.state.gold[side] -= cost;
    this.board.refreshUnits(); this.hud.updateTop(); this.hud.showShop();
  }

  private spawnMelee(side:'ATT'|'DEF', x?:number, y?:number) {
    const cost = 10;
    if (this.state.gold[side] < cost) return;
    if (x==null || y==null) { x = side==='ATT'?1:W-2; y = side==='ATT'?H-2:1; }
    if (this.state.units.some(u=>u.hp>0 && u.x===x && u.y===y)) return;

    const id = `m-${side}-${Date.now()}-${Math.floor(Math.random()*999)}`;
    const u: Unit = {
      id, side, cls:'MELEE', arch:'MOB',
      x, y, hp:100, maxHp:100, atk:35, def:35,
      mp:3, maxMp:3, hasActed:false, cost
    };
    this.state.units.push(u);
    this.state.gold[side] -= cost;
    this.board.refreshUnits(); this.hud.updateTop(); this.hud.showShop();
  }
}
