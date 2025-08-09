import type { GameState } from './types';

// 递减收益（5/4/3/2/1）
export function incomeFor(n: number) {
  const seq = [5, 4, 3, 2, 1];
  let s = 0; for (let i = 0; i < Math.min(n, seq.length); i++) s += seq[i];
  return s;
}

// 只有“有单位站在矿上”的矿计入收入
export function garrisonedMinesCount(state: GameState, side: 'ATT'|'DEF') {
  return state.mines.filter(m =>
    state.units.some(u => u.hp > 0 && u.side === side && u.x === m.x && u.y === m.y)
  ).length;
}

// 维护：侦察兵0，其它1（守军0）
export function upkeepFor(state: GameState, side: 'ATT'|'DEF') {
  return state.units
    .filter(u => u.side === side && u.hp > 0 && !u.npcGuard)
    .reduce((acc, u) => acc + (u.cls === 'SCOUT' ? 0 : 1), 0);
}
