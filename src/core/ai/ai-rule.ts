// src/core/ai/ai-rule.ts
import type { GameState, Unit } from '../types';
import { W, H, tileAt } from '../grid';
import { moveUnit } from '../turn';
import { calcExchangeDamage } from '../combat';

function manhattan(a: Unit, b: Unit) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aiTakeTurn(state: GameState) {
  // 这里假定 AI 是防守方（蓝方）：'DEF'
  const myUnits = state.units.filter(u => u.side === 'DEF' && u.hp > 0);

  for (const u of myUnits) {
    if (u.hp <= 0) continue;

    // 1) 有相邻敌人就打
    const enemies = state.units.filter(e => e.side !== u.side && e.hp > 0);
    const adj = enemies.find(e => manhattan(u, e) === 1);
    if (adj) {
      const attTile = tileAt(state.tiles, u.x, u.y)!.type;
      const defTile = tileAt(state.tiles, adj.x, adj.y)!.type;
      const { dmgToDef, dmgToAtt } =
        calcExchangeDamage(u, adj, attTile, defTile, state);

      adj.hp = Math.max(0, adj.hp - dmgToDef);
      u.hp   = Math.max(0, u.hp   - dmgToAtt);

      u.hasActed = true;
      u.mp = 0;
      continue; // 本单位回合结束
    }

    // 2) 否则向最近敌人走一步（简单直走；被占格会跳过）
    if (u.mp <= 0 || enemies.length === 0) continue;

    // 关键：在 filter 之前就把候选数组标成“二元组数组”
    const candidates = ([
      [u.x + 1, u.y],
      [u.x - 1, u.y],
      [u.x, u.y + 1],
      [u.x, u.y - 1],
    ] as [number, number][])
      .filter(([x, y]) =>
        x >= 0 && x < W && y >= 0 && y < H &&
        !state.units.some(t => t.hp > 0 && t.x === x && t.y === y)
      );

    // 选离目标最近的一步
    const target = enemies.reduce((best, e) =>
      manhattan(u, e) < manhattan(u, best) ? e : best, enemies[0]);

    candidates.sort((a, b) =>
      (Math.abs(a[0] - target.x) + Math.abs(a[1] - target.y)) -
      (Math.abs(b[0] - target.x) + Math.abs(b[1] - target.y))
    );

    for (const [nx, ny] of candidates) {
      if (moveUnit(state, u, nx, ny)) break;
    }
  }
}
