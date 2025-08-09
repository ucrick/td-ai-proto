// ==== 尺寸：建议手机 8x12 ====
export const W = 8;
export const H = 12;

// ==== 地形 ====
export type TileType = 'PLAIN' | 'FOREST' | 'HILL' | 'RIVER' | 'SWAMP' | 'MOUNTAIN';
export interface Tile { q: number; r: number; type: TileType; }

export const moveCost: Record<TileType, number> = {
  PLAIN: 1, FOREST: 2, HILL: 2, RIVER: 2, SWAMP: 3, MOUNTAIN: 9999,
};

export function tileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  return tiles.find(t => t.q === x && t.r === y);
}

// 固定五个矿：四角+中心
export function genMines(): { x: number; y: number }[] {
  return [
    { x: 0,     y: 0     },
    { x: W - 1, y: 0     },
    { x: 0,     y: H - 1 },
    { x: W - 1, y: H - 1 },
    { x: Math.floor(W / 2), y: Math.floor(H / 2) },
  ];
}

// —— 只生成“位于地图中部”的一条河：横向为主，允许斜向摆动，长度≥3 —— //
function carveCenteredRiver(tiles: Tile[]) {
  // 起点在靠左的中部带（避免太靠边）
  const mid = Math.floor(H / 2);
  let y = Math.min(H - 2, Math.max(1, mid + (Math.random() < 0.5 ? -1 : 1)));
  let x = 1;

  const lenTarget = Math.max(3, Math.floor(W * 0.7)); // 横向贯穿
  for (let i = 0; i < lenTarget && x < W - 1; i++) {
    const t = tileAt(tiles, x, y);
    if (t) t.type = 'RIVER';

    // 只能向右推进，允许斜向 ±1
    const dirs: [number, number][] = [[1, 0], [1, 1], [1, -1]];
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
    const ny = Math.min(H - 2, Math.max(1, y + dy)); // 约束在中部带
    x = x + dx;
    y = ny;
  }
}

// 少量山脉（不可通行），避开矿点
function sprinkleMountains(tiles: Tile[], density = 0.06) {
  const mines = new Set(genMines().map(m => `${m.x},${m.y}`));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mines.has(`${x},${y}`)) continue;
      if (Math.random() < density) {
        const t = tileAt(tiles, x, y);
        if (t) t.type = 'MOUNTAIN';
      }
    }
  }
}

export function genMap(): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.random();
      let type: TileType = 'PLAIN';
      if (r < 0.08) type = 'SWAMP';
      else if (r < 0.18) type = 'FOREST';
      else if (r < 0.26) type = 'HILL';
      tiles.push({ q: x, r: y, type });
    }
  }

  sprinkleMountains(tiles);
  carveCenteredRiver(tiles); // ★ 中部横向/斜向河

  // 确保矿点可站立
  for (const m of genMines()) {
    const t = tileAt(tiles, m.x, m.y);
    if (t) t.type = 'PLAIN';
  }
  return tiles;
}
