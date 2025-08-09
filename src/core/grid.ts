// ===== 地图尺寸（手机竖屏友好：8x12） =====
export const W = 8;
export const H = 12;

// ===== 地形 =====
export type TileType = 'PLAIN' | 'FOREST' | 'HILL' | 'RIVER' | 'SWAMP' | 'MOUNTAIN';
export interface Tile { q: number; r: number; type: TileType; }

export const moveCost: Record<TileType, number> = {
  PLAIN: 1, FOREST: 2, HILL: 2, RIVER: 2, SWAMP: 3, MOUNTAIN: 9999,
};

export function tileAt(tiles: Tile[], x: number, y: number) {
  return tiles.find(t => t.q === x && t.r === y);
}

// 金矿：四角 + 中心
export function genMines() {
  return [
    { x: 0, y: 0 },
    { x: W - 1, y: 0 },
    { x: 0, y: H - 1 },
    { x: W - 1, y: H - 1 },
    { x: Math.floor(W / 2), y: Math.floor(H / 2) },
  ];
}

/** 从左或右边缘流入的短河：长度 3~5，只横向/斜向推进 */
function carveEdgeRiver(tiles: Tile[]) {
  const fromLeft = Math.random() < 0.5;
  let x = fromLeft ? 0 : W - 1;
  let y = Math.min(H - 2, Math.max(1, Math.floor(H / 2) + (Math.random() < 0.5 ? -1 : 1)));

  const len = Math.floor(Math.random() * 3) + 3; // 3~5
  for (let i = 0; i < len; i++) {
    const t = tileAt(tiles, x, y);
    if (t) t.type = 'RIVER';

    const dirs: [number, number][] = fromLeft ? [[1, 0], [1, 1], [1, -1]] : [[-1, 0], [-1, 1], [-1, -1]];
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
    const nx = x + dx;
    const ny = Math.min(H - 2, Math.max(1, y + dy));
    if (nx < 0 || nx >= W) break;
    x = nx; y = ny;
  }
}

/** 只放 2 座山，避开金矿与河流 （不在最外一行） */
function placeExactlyTwoMountains(tiles: Tile[]) {
  const mines = new Set(genMines().map(m => `${m.x},${m.y}`));
  const cands: { x: number; y: number }[] = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const t = tileAt(tiles, x, y)!;
      if (t.type === 'RIVER') continue;
      if (mines.has(`${x},${y}`)) continue;
      cands.push({ x, y });
    }
  }
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  for (let i = 0; i < Math.min(2, cands.length); i++) {
    const { x, y } = cands[i];
    const t = tileAt(tiles, x, y);
    if (t) t.type = 'MOUNTAIN';
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

  carveEdgeRiver(tiles);
  placeExactlyTwoMountains(tiles);

  // 矿点可站
  for (const m of genMines()) {
    const t = tileAt(tiles, m.x, m.y);
    if (t) t.type = 'PLAIN';
  }
  return tiles;
}
