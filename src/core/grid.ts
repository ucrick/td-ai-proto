// ==== 尺寸 ====
export const W = 8;
export const H = 8;

// ==== 地形 ====
export type TileType = 'PLAIN' | 'FOREST' | 'HILL' | 'RIVER' | 'SWAMP';

export interface Tile {
  q: number; // x
  r: number; // y
  type: TileType;
}

// 移动力消耗（补上 SWAMP）
export const moveCost: Record<TileType, number> = {
  PLAIN: 1,
  FOREST: 2,
  HILL: 2,
  RIVER: 2,
  SWAMP: 3,
};

// 取格子
export function tileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  return tiles.find(t => t.q === x && t.r === y);
}

// 随机生成地图（带 SWAMP）
export function genMap(): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.random();
      let type: TileType = 'PLAIN';
      if (r < 0.08) type = 'SWAMP';
      else if (r < 0.18) type = 'FOREST';
      else if (r < 0.26) type = 'HILL';
      else if (r < 0.32) type = 'RIVER';
      tiles.push({ q: x, r: y, type });
    }
  }
  return tiles;
}
