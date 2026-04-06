// TMPGAME.JS — 엔진 통합 테스트용 임시 파일
//
// [엔진 미비사항 — 추후 엔진에 추가 필요]
// 1. GameBuilder가 canvas ctx를 노출하지 않아 에셋 없이 커스텀 렌더링 불가
//    → 직접 canvas/ctx를 사용하는 방식으로 우회
// 2. GameBuilder rAF루프에 커스텀 렌더 훅 없음
//    → 직접 rAF루프 구현
// 3. Keyboard.json에 ACTION 키 매핑 없음
//    → tmpgame에서 직접 매핑 추가

import { initInputSystem, InputType } from "./engine/InputSystem.js";

// ─── 캔버스 ────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = 800;
const H = 450;
canvas.width = W;
canvas.height = H;

// ─── 입력 시스템 (엔진 사용) ────────────────────────────────────
const inputsOfThisTick = initInputSystem({
  keyboardMapping: {
    "1P_LEFT": "ArrowLeft",
    "1P_RIGHT": "ArrowRight",
    "1P_UP": "ArrowUp",
    "1P_DOWN": "ArrowDown",
    "1P_ACTION": "ShiftRight",
    "2P_LEFT": "KeyA",
    "2P_RIGHT": "KeyD",
    "2P_UP": "KeyW",
    "2P_DOWN": "KeyS",
    "2P_ACTION": "ShiftLeft",
  },
  touchMapping: {},
});
const inputGen = inputsOfThisTick();

// ─── 상수 ──────────────────────────────────────────────────────
const TPS = 60;
const TICK_MS = 1000 / TPS;
const GROUND = H - 50;
const NET_X = W / 2;
const NET_TOP = GROUND - 150;
const NET_W = 10;
const GRAVITY = 0.5;
const BALL_GRAV = 0.3;
const BALL_R = 18;
const P_W = 48;
const P_H = 64;
const P_R = P_W / 2;
const P_SPEED = 5;
const JUMP_VY = -13;
const DIVE_SPEED = 9;
const WIN_SCORE = 15;

// 액션별 duration (0 = 입력 의존 종료, >0 = 자동 종료)
const ACTION_DURATION = {
  IDLE: 0,
  RUN: 0,
  JUMP: 0,
  DIVE: 35,
  SPIKE: 10,
  BLOCK: 15,
  RECEIVE: 15,
  SKILL: 30,
};

// ─── 상태 초기화 ───────────────────────────────────────────────
function makePlayer(x, side) {
  return {
    x,
    y: GROUND,
    vx: 0,
    vy: 0,
    onGround: true,
    side,
    facing: side === "left" ? 1 : -1,
    action: { type: "IDLE", tick: 0, duration: 0 },
  };
}

function makeBall(serveLeft) {
  return { x: serveLeft ? 200 : 600, y: 150, vx: serveLeft ? 2 : -2, vy: -1 };
}

function makeState() {
  return {
    p1: makePlayer(150, "left"),
    p2: makePlayer(650, "right"),
    ball: makeBall(true),
    score: { p1: 0, p2: 0 },
    sets: { p1: 0, p2: 0 },
    phase: "rally", // 'rally' | 'point' | 'gameover'
    pointTimer: 0,
    lastScorer: "p1",
  };
}

let state = makeState();

// ─── 액션 헬퍼 ─────────────────────────────────────────────────
function setAction(p, type) {
  p.action = { type, tick: 0, duration: ACTION_DURATION[type] };
}

function isLocked(p) {
  return p.action.duration > 0 && p.action.tick < p.action.duration;
}

// ─── 플레이어 틱 ───────────────────────────────────────────────
function tickPlayer(p, inputs, keys, minX, maxX) {
  const { left, right, up, down, action, dLeft, dRight, dUp, dDown } = keys;
  p.action.tick++;

  // 자동 종료
  if (p.action.duration > 0 && p.action.tick >= p.action.duration) {
    setAction(p, p.onGround ? "IDLE" : "JUMP");
  }

  const pressed = (key) => inputs[InputType[key]];

  // locked 중에도 허용되는 전이
  if (isLocked(p)) {
    if (pressed(dDown)) {
      // RECEIVE/JUMP 중 더블다운 → 스킬
      setAction(p, "SKILL");
    }
  }

  if (!isLocked(p)) {
    if (pressed(dDown)) {
      // 더블다운 → 스킬
      setAction(p, "SKILL");
    } else if (p.action.type === "JUMP" && pressed(dUp)) {
      // 점프 중 더블업 → 블로킹
      setAction(p, "BLOCK");
    } else if (pressed(dLeft) && p.onGround) {
      // 다이빙 좌
      setAction(p, "DIVE");
      p.vx = -DIVE_SPEED;
      p.vy = -3;
      p.onGround = false;
      p.facing = -1;
    } else if (pressed(dRight) && p.onGround) {
      // 다이빙 우
      setAction(p, "DIVE");
      p.vx = DIVE_SPEED;
      p.vy = -3;
      p.onGround = false;
      p.facing = 1;
    } else if (pressed(dUp) && p.onGround) {
      // 블로킹
      setAction(p, "BLOCK");
      p.vy = JUMP_VY * 0.7;
      p.onGround = false;
    } else if (pressed(action)) {
      // 스파이크
      setAction(p, "SPIKE");
    } else if (pressed(down) && p.onGround) {
      // 리시브
      setAction(p, "RECEIVE");
    } else if (pressed(up) && p.onGround) {
      // 점프
      setAction(p, "JUMP");
      p.vy = JUMP_VY;
      p.onGround = false;
    } else if (pressed(left)) {
      p.vx = -P_SPEED;
      p.facing = -1;
      if (p.onGround) setAction(p, "RUN");
    } else if (pressed(right)) {
      p.vx = P_SPEED;
      p.facing = 1;
      if (p.onGround) setAction(p, "RUN");
    } else {
      p.vx = 0;
      if (p.onGround && p.action.type === "RUN") setAction(p, "IDLE");
    }
  }

  if (p.action.type === "DIVE") p.vx *= 0.92;

  p.vy += GRAVITY;
  p.x += p.vx;
  p.y += p.vy;

  if (p.y >= GROUND) {
    p.y = GROUND;
    p.vy = 0;
    p.onGround = true;
    if (p.action.type === "JUMP" || p.action.type === "BLOCK")
      setAction(p, "IDLE");
  }

  if (p.x - P_R < minX) p.x = minX + P_R;
  if (p.x + P_R > maxX) p.x = maxX - P_R;
}

// ─── 공 틱 ─────────────────────────────────────────────────────
function tickBall(s) {
  const b = s.ball;
  b.vy += BALL_GRAV;
  b.x += b.vx;
  b.y += b.vy;

  if (b.x - BALL_R < 0) {
    b.x = BALL_R;
    b.vx *= -1;
  }
  if (b.x + BALL_R > W) {
    b.x = W - BALL_R;
    b.vx *= -1;
  }

  const nl = NET_X - NET_W / 2;
  const nr = NET_X + NET_W / 2;
  if (b.x + BALL_R > nl && b.x - BALL_R < nr && b.y + BALL_R > NET_TOP) {
    if (b.vx > 0) b.x = nl - BALL_R;
    else b.x = nr + BALL_R;
    b.vx *= -0.8;
  }

  collideBallPlayer(b, s.p1);
  collideBallPlayer(b, s.p2);

  if (b.y + BALL_R > GROUND) {
    b.y = GROUND - BALL_R;
    b.vy *= -0.6;
  }
}

function collideBallPlayer(b, p) {
  const cx = p.x;
  const cy = p.y - P_H / 2;
  const dx = b.x - cx;
  const dy = b.y - cy;
  const dist = Math.hypot(dx, dy);
  const minD = BALL_R + P_R;
  if (dist >= minD || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  b.x += nx * (minD - dist);
  b.y += ny * (minD - dist);

  const dot = b.vx * nx + b.vy * ny;
  const power = p.action.type === "SPIKE" ? 1.5 : 1.0;
  b.vx = (b.vx - 2 * dot * nx + p.vx * 0.5) * power;
  b.vy = (b.vy - 2 * dot * ny + p.vy * 0.3) * power;

  const speed = Math.hypot(b.vx, b.vy);
  if (speed < 4) {
    b.vx *= 4 / speed;
    b.vy *= 4 / speed;
  }
  if (speed > 22) {
    b.vx *= 22 / speed;
    b.vy *= 22 / speed;
  }
}

// ─── 게임 틱 ───────────────────────────────────────────────────
function tick(inputs) {
  const s = state;

  if (s.phase === "gameover") return;

  if (s.phase === "point") {
    s.pointTimer--;
    if (s.pointTimer <= 0) {
      if (s.score.p1 >= WIN_SCORE || s.score.p2 >= WIN_SCORE) {
        if (s.score.p1 > s.score.p2) s.sets.p1++;
        else s.sets.p2++;
        if (s.sets.p1 >= 2 || s.sets.p2 >= 2) {
          s.phase = "gameover";
          return;
        }
        s.score = { p1: 0, p2: 0 };
      }
      s.p1 = makePlayer(150, "left");
      s.p2 = makePlayer(650, "right");
      s.ball = makeBall(s.lastScorer === "p2");
      s.phase = "rally";
    }
    return;
  }

  tickPlayer(
    s.p1,
    inputs,
    {
      left: "1P_LEFT",
      right: "1P_RIGHT",
      up: "1P_UP",
      down: "1P_DOWN",
      action: "1P_ACTION",
      dLeft: "1P_DOUBLE_LEFT",
      dRight: "1P_DOUBLE_RIGHT",
      dUp: "1P_DOUBLE_UP",
      dDown: "1P_DOUBLE_DOWN",
    },
    0,
    NET_X - NET_W / 2,
  );

  tickPlayer(
    s.p2,
    inputs,
    {
      left: "2P_LEFT",
      right: "2P_RIGHT",
      up: "2P_UP",
      down: "2P_DOWN",
      action: "2P_ACTION",
      dLeft: "2P_DOUBLE_LEFT",
      dRight: "2P_DOUBLE_RIGHT",
      dUp: "2P_DOUBLE_UP",
      dDown: "2P_DOUBLE_DOWN",
    },
    NET_X + NET_W / 2,
    W,
  );

  tickBall(s);
}

// ─── 렌더 (에셋 없이 직접 그림) ────────────────────────────────
const ACTION_COLOR = {
  IDLE: "#aaa",
  RUN: "#e67e22",
  JUMP: "#f1c40f",
  DIVE: "#1abc9c",
  SPIKE: "#e74c3c",
  BLOCK: "#9b59b6",
  RECEIVE: "#2ecc71",
  SKILL: "#ff00ff",
};

function drawPlayer(p, label) {
  const bx = p.x - P_W / 2;
  const by = p.y - P_H;
  const color = ACTION_COLOR[p.action.type] ?? "#aaa";

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(p.x, GROUND, P_R, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(bx, by + 20, P_W, P_H - 20);
  ctx.beginPath();
  ctx.arc(p.x, by + 16, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `${p.action.type}(${p.action.tick}/${p.action.duration})`,
    p.x,
    by - 4,
  );
  ctx.fillText(label, p.x, by + 36);
}

function render() {
  const s = state;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#c8a46e";
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.fillStyle = "#555";
  ctx.fillRect(NET_X - NET_W / 2, NET_TOP, NET_W, GROUND - NET_TOP);

  drawPlayer(s.p1, "1P");
  drawPlayer(s.p2, "2P");

  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = "#f1c40f";
  ctx.fill();
  ctx.strokeStyle = "#e67e22";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${s.score.p1}  :  ${s.score.p2}`, W / 2, 38);
  ctx.font = "14px monospace";
  ctx.fillText(`세트 ${s.sets.p1} - ${s.sets.p2}`, W / 2, 58);

  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(
    "1P: ←→ 이동 / ↑ 점프 / ↓ 리시브 / Shift 스파이크 / ←← 다이빙 / ↑↑ 블로킹",
    8,
    H - 8,
  );

  if (s.phase === "point") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px monospace";
    ctx.textAlign = "center";
    ctx.fillText("득점!", W / 2, H / 2);
  }

  if (s.phase === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${s.sets.p1 > s.sets.p2 ? "1P" : "2P"} 승리!`,
      W / 2,
      H / 2 - 20,
    );
    ctx.font = "24px monospace";
    ctx.fillText(`${s.sets.p1} - ${s.sets.p2}`, W / 2, H / 2 + 30);
  }
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
