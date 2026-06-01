/**
 * SpriteGen.js — Canvas 2D로 스프라이트를 직접 생성 (파일 로딩 없음)
 * generateAssets() → AssetStore와 동일한 구조의 assets 객체 반환
 */

import { CHARACTERS } from './Characters.js';

async function bmp(canvas) {
  return createImageBitmap(canvas);
}

function frames(image, size) {
  const cols = Math.floor(image.width / size);
  const out = [];
  for (let i = 0; i < cols; i++) {
    out.push({ image, sx: i * size, sy: 0, sw: size, sh: size });
  }
  return out;
}

// ─── 배경 (코트) ──────────────────────────────────────────────────────────────
async function genCourt() {
  const W = 800, H = 450, FY = 380;
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, FY);
  sky.addColorStop(0, '#3a8ecc');
  sky.addColorStop(1, '#7fc8e8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FY);

  const fl = ctx.createLinearGradient(0, FY, 0, H);
  fl.addColorStop(0, '#d4a96a');
  fl.addColorStop(1, '#b87840');
  ctx.fillStyle = fl;
  ctx.fillRect(0, FY, W, H - FY);

  ctx.strokeStyle = '#c88840';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, FY); ctx.lineTo(W, FY); ctx.stroke();

  // 코트 중앙선 (점선)
  ctx.strokeStyle = '#e8a850';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(W / 2, FY + 2); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.setLineDash([]);

  return bmp(c);
}

// ─── 네트 ─────────────────────────────────────────────────────────────────────
async function genNet() {
  const W = 10, H = 150;
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#555';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 0.5;
  for (let y = 5; y < H; y += 5) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  ctx.fillStyle = '#eee';
  ctx.fillRect(0, 0, W, 5);

  return bmp(c);
}

// ─── 공 ───────────────────────────────────────────────────────────────────────
async function genBall() {
  const S = 32, R = S / 2 - 1;
  const c = new OffscreenCanvas(S, S);
  const ctx = c.getContext('2d');

  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 0, S / 2, S / 2, R);
  g.addColorStop(0, '#fffacc');
  g.addColorStop(0.55, '#f1c40f');
  g.addColorStop(1, '#c8900a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#a07008'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2); ctx.stroke();

  // 패널 선
  ctx.strokeStyle = '#a07008'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.ellipse(S / 2, S / 2, R, R * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(S / 2, 1); ctx.lineTo(S / 2, S - 1); ctx.stroke();
  ctx.globalAlpha = 1;

  const image = await bmp(c);
  return [{ image, sx: 0, sy: 0, sw: S, sh: S }];
}

// ─── 플레이어 (15프레임 × 64px) ─────────────────────────────────────────────
// 프레임 순서: IDLE RUN JUMP SPIKE×3 BLOCK×2 DIVE×2 RECEIVE×2 SKILL×3
const BG = [
  '#6a6a6a',             // 0 IDLE
  '#b85010',             // 1 RUN
  '#a07808',             // 2 JUMP
  '#8a1208', '#a81810', '#c82818', // 3-5 SPIKE
  '#581e80', '#6c2898',  // 6-7 BLOCK
  '#0a6858', '#0e8870',  // 8-9 DIVE
  '#156830', '#1a8040',  // 10-11 RECEIVE
  '#700090', '#9000b0', '#b018d0', // 12-14 SKILL
];

async function genPlayer() {
  const F = 64, N = 15;
  const c = new OffscreenCanvas(F * N, F);
  const ctx = c.getContext('2d');

  for (let i = 0; i < N; i++) {
    drawFrame(ctx, i * F, i);
  }

  const image = await bmp(c);
  return frames(image, F);
}

function drawFrame(ctx, ox, i) {
  // 배경
  ctx.fillStyle = BG[i];
  ctx.fillRect(ox, 0, 64, 64);

  // 스킬 글로우
  if (i >= 12) {
    const intensity = (i - 11) / 3;
    ctx.save();
    ctx.globalAlpha = 0.2 * intensity;
    ctx.fillStyle = '#ff88ff';
    ctx.beginPath();
    ctx.arc(ox + 32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const cx = ox + 32;
  ctx.lineCap = 'round';

  // 다이브는 눕혀서 그림
  if (i === 8 || i === 9) {
    drawDive(ctx, cx, i);
    return;
  }

  // 머리
  ctx.fillStyle = '#fde8b0';
  ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, 11, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 몸통
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, 38); ctx.stroke();

  // 다리
  ctx.lineWidth = 2.5;
  if (i === 1) { // RUN
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx - 10, 50); ctx.lineTo(cx - 8, 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx + 10, 52); ctx.lineTo(cx + 12, 62); ctx.stroke();
  } else if (i === 2) { // JUMP - 다리 굽힘
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx - 10, 50); ctx.lineTo(cx - 6, 58); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx + 10, 50); ctx.lineTo(cx + 6, 58); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx - 8, 55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 38); ctx.lineTo(cx + 8, 55); ctx.stroke();
  }

  // 팔
  drawArms(ctx, cx, i);
}

function drawArms(ctx, cx, i) {
  ctx.lineWidth = 2.5;

  if (i <= 2) { // IDLE, RUN, JUMP
    ctx.strokeStyle = '#555';
    const ay = i === 2 ? 12 : 30;
    const ax = i === 2 ? 14 : 13;
    ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx - ax, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx + ax, ay); ctx.stroke();
    return;
  }

  if (i >= 3 && i <= 5) { // SPIKE
    const angles = [Math.PI * 0.65, Math.PI * 0.3, -Math.PI * 0.1];
    const a = angles[i - 3];
    ctx.strokeStyle = '#dd1010'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 22);
    ctx.lineTo(cx + Math.cos(a) * 18, 22 - Math.sin(a) * 18);
    ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx - 12, 30); ctx.stroke();
    return;
  }

  if (i >= 6 && i <= 7) { // BLOCK
    const spread = i === 6 ? 16 : 22;
    ctx.strokeStyle = '#aa44ee'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx - spread, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx + spread, 8); ctx.stroke();
    return;
  }

  if (i >= 10 && i <= 11) { // RECEIVE
    ctx.strokeStyle = '#22cc66'; ctx.lineWidth = 3;
    const ext = i === 10 ? 1 : 1.3;
    ctx.beginPath(); ctx.moveTo(cx, 26); ctx.lineTo(cx - 14 * ext, 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 26); ctx.lineTo(cx + 10 * ext, 38); ctx.stroke();
    return;
  }

  if (i >= 12) { // SKILL
    const alpha = 0.7 + (i - 12) * 0.15;
    ctx.strokeStyle = `rgba(255,40,255,${alpha})`; ctx.lineWidth = 3.5;
    const spread = 14 + (i - 12) * 3;
    ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx - spread, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx + spread, 10); ctx.stroke();
    return;
  }

  ctx.strokeStyle = '#555';
  ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx - 12, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx + 12, 32); ctx.stroke();
}

function drawDive(ctx, cx, i) {
  // 수평으로 눕힌 캐릭터
  const ext = i === 9 ? 6 : 0;
  const cy = 34;

  // 머리 (왼쪽)
  ctx.fillStyle = '#fde8b0'; ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx - 20 - ext, cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 몸통 (가로)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 11 - ext, cy); ctx.lineTo(cx + 16, cy); ctx.stroke();

  // 팔 (앞으로 뻗음)
  ctx.strokeStyle = '#1abc9c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx - 11 - ext, cy - 4); ctx.lineTo(cx - 28 - ext, cy - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 11 - ext, cy + 4); ctx.lineTo(cx - 28 - ext, cy + 8); ctx.stroke();

  // 다리 (뒤로)
  ctx.strokeStyle = '#555';
  ctx.beginPath(); ctx.moveTo(cx + 16, cy - 3); ctx.lineTo(cx + 28, cy - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 16, cy + 3); ctx.lineTo(cx + 28, cy + 10); ctx.stroke();
}

// ─── PNG 스프라이트 시트 → 1D 프레임 배열 ────────────────────────────────────
async function loadImageFrames(src, frameSize) {
  try {
    const res = await fetch(src);
    if (!res.ok) { console.warn(`[SpriteGen] ${src} — HTTP ${res.status}`); return []; }
    const img  = await createImageBitmap(await res.blob());
    const cols = Math.floor(img.width  / frameSize);
    const rows = Math.floor(img.height / frameSize);
    const out  = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        out.push({ image: img, sx: col * frameSize, sy: row * frameSize, sw: frameSize, sh: frameSize });
      }
    }
    return out;
  } catch (e) {
    console.warn(`[SpriteGen] ${src} 로드 실패:`, e);
    return [];
  }
}

async function loadImageBitmap(relPath) {
  try {
    const url = new URL(relPath, import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) return null;
    return createImageBitmap(await res.blob());
  } catch (e) {
    console.warn('[SpriteGen] 로드 실패:', relPath, e);
    return null;
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────
export async function generateAssets() {
  const [bgImg, startImg, net, ball] = await Promise.all([
    loadImageBitmap('../asset/background.png'),
    loadImageBitmap('../asset/start.png'),
    genNet(),
    genBall(),
  ]);

  const court = bgImg ?? await genCourt();
  const start = startImg;

  const charEntries = await Promise.all(
    CHARACTERS.map(async char => {
      const url    = new URL(`../asset/character/${char.file}`, import.meta.url).href;
      const frames = await loadImageFrames(url, 127);
      return [char.id, frames];
    })
  );

  const assets = { court, net, ball, start };
  for (const [id, frames] of charEntries) {
    assets[id] = frames;
  }
  return assets;
}
