// src/core/combat.ts
import type { Unit, TileType, GameState } from './types';

// ========== 可调参数（手感全在这里） ==========
const BASE_DAMAGE = 24;         // 文明6近战基础 24
const DIFF_FACTOR = 1.037;      // 文明6经验系数：差 1 点 ≈ 3.7% 伤害变化
const FLANK_PER_ALLY = 2;       // 夹击：目标周围每个友军 +2 战斗力
const SUPPORT_PER_ALLY = 2;     // 支援：防守方相邻每个友军 +2 战斗力
const RIVER_ATTACK_PENALTY = -5;// 过河攻击 -5 战斗力
// 受伤惩罚：按血量比例折减战斗力（与文明6接近的线性）
const injuryScale = (hp: number, maxHp: number) => 0.5 + 0.5 * (hp / maxHp);

// 地形对“防守方”的战斗力修正
function terrainDefBonus(tile: TileType) {
  if (tile === 'FOREST') return +3;
  if (tile === 'HILL')   return +3;
  if (tile === 'SWAMP')  return -3;
  return 0; // PLAIN / RIVER（河本身不提供防守加成，这里把过河惩罚放在进攻端）
}

function neighbors(x: number, y: number) {
  return [
    [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
  ] as [number, number][];
}

function countAlliesAround(u: Unit, state: GameState) {
  return neighbors(u.x, u.y).filter(([x, y]) =>
    state.units.some(t => t.hp > 0 && t.side === u.side && t.x === x && t.y === y)
  ).length;
}

function countFlankers(attacker: Unit, target: Unit, state: GameState) {
  return neighbors(target.x, target.y).filter(([x, y]) =>
    state.units.some(t =>
      t.hp > 0 &&
      t.side === attacker.side &&
      t.id !== attacker.id &&
      t.x === x && t.y === y)
  ).length;
}

// 计算最终战斗力（文明6思路：把各种加成都叠到“战斗力”，再用差值进伤害公式）
function effectiveAttackStrength(
  attacker: Unit,
  target: Unit,
  attackerTile: TileType,
  targetTile: TileType,
  state: GameState
) {
  let str = attacker.atk;

  // 受伤衰减（乘法缩放）
  str *= injuryScale(attacker.hp, attacker.maxHp);

  // 夹击：看“目标周围”的我方单位
  str += FLANK_PER_ALLY * countFlankers(attacker, target, state);

  // 过河攻击惩罚：若攻击线跨越河流（简化为：任意一方站在 RIVER）
  if (attackerTile === 'RIVER' || targetTile === 'RIVER') {
    str += RIVER_ATTACK_PENALTY;
  }

  return str;
}

function effectiveDefenseStrength(
  defender: Unit,
  defenderTile: TileType,
  state: GameState
) {
  let str = defender.def;

  // 受伤衰减
  str *= injuryScale(defender.hp, defender.maxHp);

  // 支援：防守方相邻友军
  str += SUPPORT_PER_ALLY * countAlliesAround(defender, state);

  // 地形：森林/丘陵 +3，沼泽 -3
  str += terrainDefBonus(defenderTile);

  return str;
}

function clamp1(n: number) {
  return Math.max(1, Math.round(n));
}

/**
 * 文明6风格互殴计算：
 * 1) 计算进攻方/防守方“最终战斗力”
 * 2) diff = attStr - defStr
 * 3) 伤害 = BASE_DAMAGE * DIFF_FACTOR ^ diff
 */
export function calcExchangeDamage(
  attacker: Unit,
  defender: Unit,
  attackerTile: TileType,
  defenderTile: TileType,
  state: GameState
) {
  const attStr = effectiveAttackStrength(attacker, defender, attackerTile, defenderTile, state);
  const defStr = effectiveDefenseStrength(defender, defenderTile, state);

  const diff = attStr - defStr;

  const dmgToDef = clamp1(BASE_DAMAGE * Math.pow(DIFF_FACTOR, diff));
  const dmgToAtt = clamp1(BASE_DAMAGE * Math.pow(DIFF_FACTOR, -diff));

  return { dmgToDef, dmgToAtt, attStr: Math.round(attStr), defStr: Math.round(defStr) };
}

/** 兼容旧接口（不建议再用） */
export function calcDamage(
  attacker: Unit,
  defender: Unit,
  defenderTile: TileType,
  state: GameState
): number {
  return calcExchangeDamage(attacker, defender, 'PLAIN', defenderTile, state).dmgToDef;
}
