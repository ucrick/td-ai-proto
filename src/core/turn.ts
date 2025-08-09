import type { GameState, Unit } from './types';
import { moveCost, tileAt } from './grid';

export function moveUnit(state: GameState, u: Unit, x: number, y: number) {
  if (u.hasActed || u.hp <= 0) return false;

  const dx = Math.abs(x - u.x);
  const dy = Math.abs(y - u.y);
  if (dx + dy !== 1) return false;

  const tile = tileAt(state.tiles, x, y);
  if (!tile) return false;

  // 山脉不可通行
  if (tile.type === 'MOUNTAIN') return false;

  const cost = u.ignoresTerrain ? 1 : moveCost[tile.type];
  if (u.mp < cost) return false;

  const occ = state.units.some(w => w.hp > 0 && w.x === x && w.y === y);
  if (occ) return false;

  u.x = x; u.y = y; u.mp -= cost;
  if (u.mp <= 0) u.hasActed = true;
  return true;
}

export function endSideTurn(state: GameState) {
  state.turnSide = state.turnSide === 'ATT' ? 'DEF' : 'ATT';
  state.round += state.turnSide === 'ATT' ? 1 : 0;
  for (const u of state.units) {
    if (u.side === state.turnSide && u.hp > 0) {
      u.mp = u.maxMp; u.hasActed = false;
    }
  }
}
