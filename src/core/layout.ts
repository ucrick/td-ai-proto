export interface Layout {
  width: number;
  height: number;
  boardHeight: number; // 70%
  hud: number;         // 30%
  tile: number;        // tileSize 像素
}

import { W, H } from './grid';

export function calcLayout(): Layout {
  const width = Math.min(window.innerWidth, 900);  // 上限避免超大
  const height = window.innerHeight;

  const boardHeight = Math.floor(height * 0.7);
  const hud = height - boardHeight;
  const tile = Math.floor(Math.min(width / W, boardHeight / H));

  // 把结果挂到全局，其他模块读取
  (window as any).__LAYOUT__ = { width, height, boardHeight, hud, tile };
  return (window as any).__LAYOUT__;
}

export const LAYOUT: Layout = (window as any).__LAYOUT__ ?? calcLayout();
