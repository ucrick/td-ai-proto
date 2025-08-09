// src/core/combat.ts
import type { Unit, TileType } from './types';

function clamp1(n: number) {
  return Math.max(1, Math.round(n));
}

// 每+5防御 → 减2伤害；50及以下不减伤
function mitigate(def: number) {
  const delta = Math.floor((def - 50) / 5);
  return Math.max(0, delta * 2);
}

// 地形修正（可自由调）
function terrainFlat(tile: TileType) {
  if (tile === 'FOREST') return -2;
  if (tile === 'HILL')   return -3;
  if (tile === 'RIVER')  return -1;
  return 0; // PLAIN
}

/**
 * 互殴一次的伤害：
 * base 20，攻差 diff，DEF 提供平减，地形加成（负数代表更抗打）
 */
export function calcExchangeDamage(
  attacker: Unit,
  defender: Unit,
  attackerTile: TileType,
  defenderTile: TileType
) {
  const BASE = 20;
  const diff = attacker.atk - defender.atk;

  const dmgToDef = clamp1(
    BASE + diff - mitigate(defender.def) + terrainFlat(defenderTile)
  );
  const dmgToAtt = clamp1(
    BASE - diff - mitigate(attacker.def) + terrainFlat(attackerTile)
  );

  return { dmgToDef, dmgToAtt };
}

/** 兼容旧接口：只返回对方所受伤害（以防有文件还在用） */
export function calcDamage(
  attacker: Unit,
  defender: Unit,
  defenderTile: TileType
): number {
  // 旧函数不知己方地形，就当平原
  return calcExchangeDamage(attacker, defender, 'PLAIN', defenderTile).dmgToDef;
}
