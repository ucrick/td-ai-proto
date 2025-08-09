import type { GameState, Unit } from './types';
import { W } from './grid';

// 递减收益
export function incomeFor(n: number) {
  const seq = [5, 4, 3, 2, 1];
  let s = 0; for (let i = 0; i < Math.min(n, seq.length); i++) s += seq[i];
  return s;
}

export function minesOwned(state: GameState, side: 'ATT'|'DEF') {
  return state.mines.filter(m => m.owner === side).length;
}

// ★ 单位维护费映射
function upkeepOfUnit(u: Unit): number {
  if (u.npcGuard || u.hp <= 0) return 0;
  switch (u.cls) {
    case 'SCOUT':   return 0; // 侦察兵
    case 'MELEE':
    case 'INFANTRY':
    case 'ANTI_CAV':
    case 'CAVALRY':
    default:        return 1; // 默认步兵等 1
  }
}

export function upkeepFor(state: GameState, side: 'ATT'|'DEF') {
  return state.units
    .filter(u => u.side === side)
    .reduce((acc, u) => acc + upkeepOfUnit(u), 0);
}

// 回合开始结算；DEF 第1回合仍可通过回调给它出侦察兵
export function settleEconomyAtTurnStart(
  state: GameState,
  side: 'ATT'|'DEF',
  spawnScout: (side:'ATT'|'DEF', x:number, y:number) => void
) {
  state.gold[side] += incomeFor(minesOwned(state, side));
  state.gold[side] -= upkeepFor(state, side);

  if (side === 'DEF' && state.round === 1) {
    spawnScout('DEF', W - 2, 1);
    spawnScout('DEF', Math.max(0, W - 3), 1);
  }
}
