import Phaser from 'phaser';
import { genMap, genMines, tileAt, W, H } from '../core/grid';
import type { GameState, Unit, Mine } from '../core/types';
import { calcExchangeDamage } from '../core/combat';
import { endSideTurn } from '../core/turn';
import { BoardView } from '../view/BoardView';
import { aiTakeTurn } from '../core/ai/ai-rule';
import { LAYOUT } from '../core/layout';
import { MobileHUD } from '../ui/MobileHUD';
import { upkeepFor, incomeFor, garrisonedMinesCount } from '../core/economy';

type PendingBuy = null | { cls: 'SCOUT' | 'MELEE'; cost: number };

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private board!: BoardView;
  private hud!: MobileHUD;
  private selected: Unit | null = null;
  private pending: PendingBuy = null;

  create() {
    const tiles = genMap();
    const mines: Mine[] = genMines().map(p => ({ x: p.x, y: p.y, owner: null }));

    // 守军：仅防御
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

    this.state = {
      turnSide: 'ATT',
      tiles,
      mines,
      units: [...guards],
      round: 1,
      gold: { ATT: 50, DEF: 50 },
    };

    this.board = new BoardView(
      this, this.state, LAYOUT.tile,
      (u)=>this.onUnitClick(u),
      (x,y)=>this.onTileClick(x,y)
    );
    this.board.drawBoard();

    this.hud = new MobileHUD(
      this, this.state,
      () => this.startBuy('SCOUT', 5),
      () => this.startBuy('MELEE', 10),
      () => this.playerEndTurn(),
      () => this.onFortify(),
      () => this.onUpgrade(),
    );
    this.hud.build();
    this.hud.showShop();
    this.refreshShopButtons();
  }

  // ===== 放置模式 =====
  private spawnRowFor(side:'ATT'|'DEF'){ return side==='ATT' ? H-1 : 0; }
  private computeSpawnCells(side:'ATT'|'DEF'): [number,number][] {
    const y = this.spawnRowFor(side);
    const ret: [number,number][] = [];
    for (let x=0;x<W;x++){
      const occ = this.state.units.some(u => u.hp>0 && u.x===x && u.y===y);
      const t = tileAt(this.state.tiles, x, y)!;
      if (!occ && t.type !== 'MOUNTAIN') ret.push([x,y]);
    }
    return ret;
  }
  private startBuy(cls:'SCOUT'|'MELEE', cost:number) {
    const side = this.state.turnSide;
    if (this.state.gold[side] < cost) return;
    const free = this.computeSpawnCells(side);
    if (!free.length) return;
    this.pending = { cls, cost };
    this.selected = null;
    this.board.clearHighlights();
    this.board.showTileHighlights(free);
    this.hud.showShop();
  }
  private finalizeBuyAt(x:number,y:number){
    if (!this.pending) return false;
    const side = this.state.turnSide;
    const ok = this.computeSpawnCells(side).some(p => p[0]===x && p[1]===y);
    if (!ok) return false;
    const {cls, cost} = this.pending;
    if (this.state.gold[side] < cost) return false;

    if (cls==='SCOUT') this.spawnUnit(side, 'SCOUT', x, y, 15, 20, 5, cost, true);
    else this.spawnUnit(side, 'MELEE', x, y, 35, 35, 3, cost, false);

    this.pending = null;
    this.board.clearHighlights();
    this.refreshShopButtons();
    return true;
  }
  private refreshShopButtons(){
    const side = this.state.turnSide;
    const free = this.computeSpawnCells(side).length > 0;
    const canScout = free && this.state.gold[side] >= 5;
    const canMelee = free && this.state.gold[side] >= 10;
    this.hud.setShopEnabled(canScout, canMelee);
    this.hud.updateTop();
  }

  // ===== 交互 =====
  private onUnitClick(u: Unit) {
    if (this.pending) return; // 放置模式中忽略
    if (this.selected && u.side !== this.selected.side) {
      if (Math.abs(u.x - this.selected.x) + Math.abs(u.y - this.selected.y) === 1) {
        this.resolveAttack(this.selected, u); return;
      }
    }
    this.selected = (u.side === this.state.turnSide && !u.npcGuard) ? u : null;
    if (this.selected) { this.board.showStepHighlights(this.selected); this.hud.showUnit(this.selected); }
    else { this.board.clearHighlights(); this.hud.showShop(); }
  }

  private onTileClick(x:number,y:number) {
    if (this.pending) { this.finalizeBuyAt(x,y); return; }

    const u = this.selected;
    if (!u) { this.board.clearHighlights(); this.hud.showShop(); return; }

    const enemy = this.state.units.find(en => en.hp>0 && en.side!==u.side && en.x===x && en.y===y &&
      Math.abs(en.x-u.x)+Math.abs(en.y-u.y)===1);
    if (enemy) { this.resolveAttack(u, enemy); return; }

    // 简化移动（只判断占位和山脉 + 1 格）
    if (Math.abs(x - u.x) + Math.abs(y - u.y) === 1) {
      const occ = this.state.units.some(w => w.hp>0 && w.x===x && w.y===y);
      const t = tileAt(this.state.tiles, x, y)!;
      if (!occ && t.type !== 'MOUNTAIN' && u.mp >= 1) {
        u.x = x; u.y = y; u.mp -= 1;
        this.tryCaptureMine(u);
        this.board.refreshUnits();
        this.board.showStepHighlights(u);
        this.hud.updateTop();
        this.hud.showUnit(u);
        return;
      }
    }

    this.board.clearHighlights(); this.hud.showShop();
  }

  // ===== 战斗 / 占矿 =====
  private resolveAttack(attacker: Unit, defender: Unit) {
    const attTile = tileAt(this.state.tiles, attacker.x, attacker.y)!.type;
    const defTile = tileAt(this.state.tiles, defender.x, defender.y)!.type;
    const { dmgToDef, dmgToAtt } = calcExchangeDamage(attacker, defender, attTile, defTile, this.state);

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

  // ===== 单位动作 =====
  private onFortify() {
    if (!this.selected) return;
    const u = this.selected; if (u.hasActed) return;
    u.def += 5;
    u.fortifyDefBonus = (u.fortifyDefBonus ?? 0) + 5;
    u.fortifyTurnsLeft = (u.fortifyTurnsLeft ?? 0) + 1;
    u.hasActed = true; u.mp = 0;
    this.board.clearHighlights(); this.board.refreshUnits(); this.hud.showShop();
  }
  private onUpgrade() {
    if (!this.selected) return;
    const u = this.selected; if (u.hasActed) return;
    u.atk += 10;
    u.maxHp = Math.min(100, u.maxHp + 20);
    u.hp    = Math.min(100, u.hp + 20);
    u.hasActed = true; u.mp = 0;
    this.board.clearHighlights(); this.board.refreshUnits(); this.hud.showShop();
  }

  // ===== 回合切换 / 经济 =====
  private playerEndTurn() {
    // 清驻扎
    for (const u of this.state.units) {
      if (u.fortifyTurnsLeft && u.fortifyTurnsLeft > 0) {
        u.fortifyTurnsLeft -= 1;
        if (u.fortifyTurnsLeft === 0 && u.fortifyDefBonus) {
          u.def -= u.fortifyDefBonus; u.fortifyDefBonus = 0;
        }
      }
    }
    this.pending = null;
    this.board.clearHighlights();

    // 结算：只有“驻扎矿”的收入
    const side = this.state.turnSide;
    this.state.gold[side] += incomeFor(garrisonedMinesCount(this.state, side));
    this.state.gold[side] -= upkeepFor(this.state, side);

    endSideTurn(this.state);
    this.board.refreshUnits();
    this.refreshShopButtons();
    this.hud.showShop();

    // 简易 AI（蓝方）
    if (this.state.turnSide === 'DEF') {
      // 这里可接 AI 行为，当前先跳过
      endSideTurn(this.state); // 直接切回玩家
      this.board.refreshUnits(); this.refreshShopButtons(); this.hud.showShop();
    }
  }

  // ===== 造兵 =====
  private spawnUnit(
    side:'ATT'|'DEF', cls:'SCOUT'|'MELEE',
    x:number, y:number, atk:number, def:number,
    mp:number, cost:number, ignores=false
  ) {
    const id = `${cls}-${side}-${Date.now()}-${Math.floor(Math.random()*999)}`;
    this.state.units.push({
      id, side, cls, arch:'MOB',
      x, y, hp:100, maxHp:100, atk, def,
      mp, maxMp:mp, hasActed:false, ignoresTerrain:ignores, cost
    });
    this.state.gold[side] -= cost;
    this.board.refreshUnits();
  }
}
