// src/core/layout.ts
import { W, H } from './grid';

/** 手机优先：上棋盘、下操作栏 */
const HUD_MIN = 160;
const HUD_MAX = 240;

function calcLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 底部操作区 ≈ 1/4 高度，但限制在区间内
  const hud = Math.max(HUD_MIN, Math.min(HUD_MAX, Math.floor(vh * 0.25)));

  // 棋盘区域的最大可用高
  const boardHAvail = vh - hud;

  // 每格像素（尽量大）
  const tile = Math.max(44, Math.floor(Math.min(vw / W, boardHAvail / H)));

  const width  = tile * W;
  const height = tile * H + hud;

  return { width, height, tile, hud };
}

/** 当前布局（页面刷新时重算即可） */
export const LAYOUT = calcLayout();
