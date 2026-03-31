import { RenderEngine }             from './engine/Renderer.js';
import { initInputSystem, InputType } from './engine/InputSystem.js';

// ─── 엔진 초기화 ───────────────────────────────────────────────
const canvas   = document.getElementById('gameCanvas');
const renderer = new RenderEngine(canvas);
const ctx      = renderer.ctx;
const W        = renderer.width;   // 800
const H        = renderer.height;  // 450

const inputsOfThisTick = initInputSystem({
  keyboardMapping: {
    "1P_LEFT":  "ArrowLeft",
    "1P_RIGHT": "ArrowRight",
    "1P_UP":    "ArrowUp",
    "2P_LEFT":  "KeyA",
    "2P_RIGHT": "KeyD",
    "2P_UP":    "KeyW",
  },
  touchMapping: {},
});
const inputGen = inputsOfThisTick();

// ─── 상수 ──────────────────────────────────────────────────────
const GROUND      = H - 50;
const NET_X       = W / 2;
const NET_TOP     = GROUND - 150;
const NET_W       = 8;
const GRAVITY     = 0.6;
const PLAYER_SPEED = 5;
const JUMP_VY     = -14;
const BALL_GRAVITY = 0.35;
const BALL_RADIUS  = 18;
const PLAYER_W     = 48;
const PLAYER_H     = 56;
const PLAYER_R     = PLAYER_W / 2; // 충돌용 반지름

const TPS     = 60;
const TICK_MS = 1000 / TPS;

// ─── 상태 ──────────────────────────────────────────────────────
function makePlayer(x) {
  return { x, y: GROUND, vx: 0, vy: 0, onGround: true };
}

function makeBall(serveLeft) {
  return { x: serveLeft ? 200 : 600, y: 180, vx: serveLeft ? 3 : -3, vy: -2 };
}

let score = { p1: 0, p2: 0 };
let p1   = makePlayer(150);
let p2   = makePlayer(650);
let ball = makeBall(true);

// ─── 물리 ──────────────────────────────────────────────────────
function tickPlayer(p, inputs, leftKey, rightKey, upKey, minX, maxX) {
  // 입력
  p.vx = 0;
  if (inputs[InputType[leftKey]])  p.vx = -PLAYER_SPEED;
  if (inputs[InputType[rightKey]]) p.vx =  PLAYER_SPEED;
  if (inputs[InputType[upKey]] && p.onGround) {
    p.vy = JUMP_VY;
    p.onGround = false;
  }

  // 중력·이동
  p.vy += GRAVITY;
  p.x  += p.vx;
  p.y  += p.vy;

  // 착지
  if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }

  // 코트 경계
  if (p.x - PLAYER_R < minX) p.x = minX + PLAYER_R;
  if (p.x + PLAYER_R > maxX) p.x = maxX - PLAYER_R;
}

function tickBall() {
  ball.vy += BALL_GRAVITY;
  ball.x  += ball.vx;
  ball.y  += ball.vy;

  // 벽
  if (ball.x - BALL_RADIUS < 0)  { ball.x = BALL_RADIUS;      ball.vx *= -1; }
  if (ball.x + BALL_RADIUS > W)  { ball.x = W - BALL_RADIUS;  ball.vx *= -1; }

  // 천장
  if (ball.y - BALL_RADIUS < 0)  { ball.y = BALL_RADIUS;      ball.vy *= -1; }

  // 네트
  const netLeft  = NET_X - NET_W / 2;
  const netRight = NET_X + NET_W / 2;
  if (ball.x + BALL_RADIUS > netLeft && ball.x - BALL_RADIUS < netRight && ball.y + BALL_RADIUS > NET_TOP) {
    if (ball.vx > 0) { ball.x = netLeft  - BALL_RADIUS; }
    else             { ball.x = netRight + BALL_RADIUS; }
    ball.vx *= -0.8;
  }

  // 플레이어 충돌
  collideBallPlayer(p1);
  collideBallPlayer(p2);

  // 바닥 → 실점
  if (ball.y + BALL_RADIUS > GROUND) {
    if (ball.x < NET_X) { score.p2++; ball = makeBall(false); }
    else                { score.p1++; ball = makeBall(true);  }
    p1 = makePlayer(150);
    p2 = makePlayer(650);
  }
}

function collideBallPlayer(p) {
  // 플레이어를 원으로 근사 (머리 위치 기준)
  const cx = p.x;
  const cy = p.y - PLAYER_H / 2;
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_RADIUS + PLAYER_R;

  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;

    // 겹침 해소
    const overlap = minDist - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // 반사 + 플레이어 속도 전달
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx = ball.vx - 2 * dot * nx + p.vx * 0.5;
    ball.vy = ball.vy - 2 * dot * ny + p.vy * 0.3;

    // 최소 속도 보장 (공이 멈추지 않도록)
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < 5) {
      ball.vx *= 5 / speed;
      ball.vy *= 5 / speed;
    }
  }
}

// ─── 틱 ───────────────────────────────────────────────────────
function tick(inputs) {
  tickPlayer(p1, inputs, "1P_LEFT", "1P_RIGHT", "1P_UP", 0,     NET_X - NET_W / 2);
  tickPlayer(p2, inputs, "2P_LEFT", "2P_RIGHT", "2P_UP", NET_X + NET_W / 2, W);
  tickBall();
}

// ─── 렌더 ──────────────────────────────────────────────────────
function render() {
  renderer.clear();

  // 하늘
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, W, H);

  // 바닥
  ctx.fillStyle = '#c8a46e';
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // 바닥 라인
  ctx.strokeStyle = '#a07850';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  // 네트 기둥
  ctx.fillStyle = '#555';
  ctx.fillRect(NET_X - NET_W / 2, NET_TOP, NET_W, GROUND - NET_TOP);

  // 네트 줄
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  for (let y = NET_TOP; y < GROUND; y += 15) {
    ctx.beginPath();
    ctx.moveTo(NET_X - NET_W / 2, y);
    ctx.lineTo(NET_X + NET_W / 2, y);
    ctx.stroke();
  }

  // 플레이어 1 (빨강)
  drawPlayer(p1, '#e74c3c', '#c0392b');

  // 플레이어 2 (파랑)
  drawPlayer(p2, '#3498db', '#2980b9');

  // 공
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#f1c40f';
  ctx.fill();
  ctx.strokeStyle = '#e67e22';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 스코어
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(score.p1, W / 4,     40);
  ctx.fillText(score.p2, W * 3 / 4, 40);
  ctx.shadowBlur = 0;

  // 조작법
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('P1: ← → ↑', 10, H - 10);
  ctx.textAlign = 'right';
  ctx.fillText('P2: A D W', W - 10, H - 10);
}

function drawPlayer(p, bodyColor, shadowColor) {
  const bx = p.x - PLAYER_W / 2;
  const by = p.y - PLAYER_H;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, GROUND, PLAYER_R, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 몸통
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by + 20, PLAYER_W, PLAYER_H - 20);

  // 머리
  ctx.beginPath();
  ctx.arc(p.x, by + 16, 20, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();

  // 눈
  const eyeX = p.vx >= 0 ? p.x + 6 : p.x - 6;
  ctx.beginPath();
  ctx.arc(eyeX, by + 12, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeX + (p.vx >= 0 ? 1 : -1), by + 12, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
}

// ─── 루프 ──────────────────────────────────────────────────────
let lastTick = performance.now();

async function rafLoop(timestamp) {
  if (timestamp - lastTick >= TICK_MS) {
    lastTick = timestamp;
    const { value: inputs } = await inputGen.next();
    tick(inputs);
  }
  render();
  requestAnimationFrame(rafLoop);
}

requestAnimationFrame(rafLoop);
