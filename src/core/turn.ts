import type { GameState, Unit } from './types';
import { moveCost, tileAt } from './grid';

export function canMove(u: Unit, tileType: keyof typeof moveCost) {
  return u.mp >= moveCost[tileType];
}

export function moveUnit(state: GameState, u: Unit, toX: number, toY: number) {
  const t = tileAt(state.tiles, toX, toY);
  if (!t) return false;
  const cost = moveCost[t.type];
  if (u.mp < cost) return false;
  u.x = toX; u.y = toY; u.mp -= cost;
  return true;
}

export function endUnitTurn(u: Unit) {
  u.hasActed = true;
  u.mp = 0;
}

export function endSideTurn(s: GameState) {
  s.turnSide = s.turnSide === 'ATT' ? 'DEF' : 'ATT';
  s.units.forEach(u => {
    if (u.side === s.turnSide) {
      u.mp = u.maxMp;
      u.hasActed = false;
    }
  });
  if (s.turnSide === 'ATT') s.round += 1;
}
