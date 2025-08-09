export type TileType = 'PLAIN' | 'FOREST' | 'HILL' | 'RIVER' | 'SWAMP';

export interface Tile {
  q: number;
  r: number;
  type: TileType;
}

export type UnitClass = 'CAVALRY' | 'INFANTRY' | 'ANTI_CAV';
export type Archetype = 'MOB' | 'BURST' | 'AOE';

export interface Unit {
  id: string;
  side: 'ATT' | 'DEF';
  cls: UnitClass;
  arch: Archetype;

  x: number;
  y: number;

  hp: number;
  maxHp: number;

  atk: number;   // 攻击力
  def: number;   // 防御力（驻扎+5，当前版本伤害不参与计算，只展示/预留）

  mp: number;
  maxMp: number;

  hasActed: boolean;

  /** 驻扎剩余回合（>0 表示处于驻扎状态） */
  fortifyTurnsLeft?: number;
  /** 本次驻扎带来的防御加成（用于回合结束时撤回） */
  fortifyDefBonus?: number;

  /** 升级次数（本原型限制为最多 1 次） */
  upgradeLv?: number;

  name?: string;
}

export interface GameState {
  turnSide: 'ATT' | 'DEF';
  tiles: Tile[];
  units: Unit[];
  round: number;
}
