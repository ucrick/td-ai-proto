import type { Tile, TileType } from './types';

export const W = 8, H = 8;

export function genMap(): Tile[] {
  const pick = (): TileType => {
    const r = Math.random();
    if (r < 0.15) return 'FOREST';
    if (r < 0.28) return 'HILL';
    if (r < 0.38) return 'RIVER';
    return 'PLAIN';
  };
  const arr: Tile[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      arr.push({ q: x, r: y, type: pick() });
    }
  }
  return arr;
}

export const moveCost: Record<TileType, number> = {
  PLAIN: 1,
  FOREST: 2, // 森林移动2
  HILL: 2,   // 丘陵移动2
  RIVER: 2,  // 简化：河格本身移动2；跨河额外+1可后续再做
};

export function defenseBonus(t: TileType): number {
  if (t === 'FOREST') return 0.2;
  if (t === 'HILL') return 0.3;
  return 0;
}

export function tileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  return tiles.find(t => t.q === x && t.r === y);
}
