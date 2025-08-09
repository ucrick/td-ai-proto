export type TileType = 'PLAIN' | 'FOREST' | 'HILL' | 'RIVER' | 'SWAMP' | 'MOUNTAIN';
export type Side = 'ATT' | 'DEF' | 'NEUTRAL';

export interface Tile { q: number; r: number; type: TileType; }

export type UnitClass = 'MELEE' | 'SCOUT' | 'CAVALRY' | 'INFANTRY' | 'ANTI_CAV';
export type Archetype = 'MOB' | 'BURST' | 'AOE';

export interface Unit {
  id: string; side: Side; cls: UnitClass; arch: Archetype;
  x: number; y: number;
  hp: number; maxHp: number;
  atk: number; def: number;
  mp: number; maxMp: number;
  hasActed: boolean;

  npcGuard?: boolean;
  ignoresTerrain?: boolean;
  cost?: number;

  fortifyTurnsLeft?: number;
  fortifyDefBonus?: number;
  upgradeLv?: number;

  name?: string;
}

export interface Mine { x: number; y: number; owner: 'ATT' | 'DEF' | null; }

export interface GameState {
  turnSide: 'ATT' | 'DEF';
  tiles: Tile[];
  units: Unit[];
  mines: Mine[];
  round: number;
  gold: { ATT: number; DEF: number };
}
