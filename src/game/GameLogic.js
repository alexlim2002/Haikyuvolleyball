/**
 * GameLogic.js — 샘플 게임 로직
 *
 * initEntities(entityManager) → initialState
 * handlers: { resolveAction, onBallHitFloor, onBallHitNet, onBallHitPlayer }
 * physicsMap: PhysicsMap 인스턴스
 */

import { PhysicsMap } from '../engine/Physics.js';
import { playerHitboxes } from './Hitbox.js';

// ─── 물리 상수 (1 unit = 800px) ───────────────────────────────────────────────
const LW = 800; // LOGICAL_WIDTH

const P_SPEED   = 5   / LW;
const JUMP_VY   = 13  / LW;
const DIVE_VX   = 18  / LW;
const DIVE_VY   = 3   / LW;
const BLOCK_VY  = 9.1 / LW;

const P_GRAVITY      = 0.5  / LW;
const APEX_THRESHOLD = 2    / LW;
const BALL_GRAVITY = 0.05 / LW;
const BALL_REST    = 0.9;

const BALL_R      = 18  / LW;
const ARM_LEN     = 35  / LW;
const RECEIVE_R   = 55  / LW;
const P_SIZE      = { w: 80 / LW, h: 80 / LW };
const NET_SIZE    = { w: 10 / LW, h: 150 / LW };

const WIN_SCORE         = 15;
const WIN_SETS          = 2;
const POINT_PAUSE_TICKS = 0;

// ─── 스프라이트 레이아웃 (히나타쇼요.png, 8열×3행 1D) ───────────────────────
const PLAYER_SPRITES = {
  IDLE:    { right: { start: 0,  count: 1 }, left: { start: 1,  count: 1 } },
  RUN:     { right: { start: 2,  count: 2 }, left: { start: 4,  count: 2 } },
  JUMP:    { right: { start: 6,  count: 1 }, left: { start: 7,  count: 1 } },
  BLOCK:   { right: { start: 8,  count: 1 }, left: { start: 9,  count: 1 } },
  SERVE:   { right: { start: 10, count: 2 }, left: { start: 12, count: 2 } },
  RECEIVE: { right: { start: 14, count: 1 }, left: { start: 15, count: 1 } },
  SPIKE:   { right: { start: 16, count: 2 }, left: { start: 18, count: 2 } },
  DIVE:    { right: { start: 20, count: 1 }, left: { start: 21, count: 1 } },
  SKILL:   { right: { start: 0,  count: 1 }, left: { start: 1,  count: 1 } },
};

function makePlayerActions() {
  return {
    IDLE:    { duration: 0,  sprites: PLAYER_SPRITES.IDLE,    getHitbox: playerHitboxes.IDLE    },
    RUN:     { duration: 0,  sprites: PLAYER_SPRITES.RUN,     frameMs: 150, getHitbox: playerHitboxes.RUN     },
    JUMP:    { duration: 0,  sprites: PLAYER_SPRITES.JUMP,    getHitbox: playerHitboxes.JUMP    },
    SPIKE:   { duration: 10, sprites: PLAYER_SPRITES.SPIKE,   getHitbox: playerHitboxes.SPIKE   },
    BLOCK:   { duration: 15, sprites: PLAYER_SPRITES.BLOCK,   getHitbox: playerHitboxes.BLOCK   },
    DIVE:    { duration: 35, sprites: PLAYER_SPRITES.DIVE,    getHitbox: playerHitboxes.DIVE    },
    RECEIVE: { duration: 15, sprites: PLAYER_SPRITES.RECEIVE, getHitbox: playerHitboxes.RECEIVE, actionRange: { ox: 0, oy: 0.03, r: RECEIVE_R } },
    SKILL:   { duration: 30, sprites: PLAYER_SPRITES.SKILL,   getHitbox: playerHitboxes.SKILL   },
  };
}

// ─── 물리맵 ───────────────────────────────────────────────────────────────────
export const physicsMap = new PhysicsMap(1, 0.5625 * 1.5);

// ─── 엔티티 등록 + 초기 상태 반환 ────────────────────────────────────────────
export function initEntities(entityManager) {
  entityManager.register('court', {
    type:    'bg',
    role:    'bg',
    assetId: 'court',
    origin:  'bottom-center',
    size:    { w: 1, h: 0.5625 },
  });

  entityManager.register('net', {
    type:    'entity',
    role:    'net',
    assetId: 'net',
    origin:  'bottom-center',
    size:    NET_SIZE,
    physics: { gravity: 0, restitution: 0 },
    actions: {
      DEFAULT: {
        duration: 0,
        sprites:  { start: 0, count: 1 },
        getHitbox: () => [{
          shape: 'capsule',
          ox: 0, oy: NET_SIZE.h / 2,
          length: NET_SIZE.h,
          angle: Math.PI / 2,
          r: NET_SIZE.w / 2,
          restitution: 0,
        }],
      },
    },
  });

  entityManager.register('player1', {
    type:       'entity',
    role:       'player',
    playerSide: 'left',
    assetId:    'player',
    origin:     'bottom-center',
    size:       P_SIZE,
    physics:    { gravity: P_GRAVITY, restitution: 0, apexThreshold: APEX_THRESHOLD },
    armLength:  ARM_LEN,
    actions:    makePlayerActions(),
  });

  entityManager.register('player2', {
    type:       'entity',
    role:       'player',
    playerSide: 'right',
    assetId:    'player',
    origin:     'bottom-center',
    size:       P_SIZE,
    physics:    { gravity: P_GRAVITY, restitution: 0, apexThreshold: APEX_THRESHOLD },
    armLength:  ARM_LEN,
    actions:    makePlayerActions(),
  });

  entityManager.register('ball', {
    type:    'entity',
    role:    'ball',
    assetId: 'ball',
    origin:  'center',
    size:    { w: BALL_R * 2, h: BALL_R * 2 },
    physics: { gravity: BALL_GRAVITY, restitution: BALL_REST },
    actions: {
      DEFAULT: {
        duration: 0,
        sprites:  { start: 0, count: 1 },
        getHitbox: () => [{ shape: 'circle', ox: 0, oy: 0, r: BALL_R, restitution: BALL_REST }],
      },
    },
  });

  return makeInitialState(true);
}

function makeInitialState(serveLeft) {
  return {
    court:   { x: 0.5,  y: 0 },
    net:     { x: 0.5,  y: 0, vx: 0, vy: 0 },
    player1: { x: 0.25, y: 0, vx: 0, vy: 0, facing:  1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    player2: { x: 0.75, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    ball:    { x: serveLeft ? 0.25 : 0.75, y: 0.375, vx: serveLeft ? 0.0025 : -0.0025, vy: -0.00125, actionRangeCooldown: 0 },
    phase:      'rally',
    score:      { p1: 0, p2: 0 },
    sets:       { p1: 0, p2: 0 },
    lastScorer: 'p1',
    pointTimer: 0,
  };
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────
export const handlers = {

  resolveAction(entityId, entity, state, inputs) {
    const es = state[entityId];
    if (!es) return null;

    const pfx = entity.playerSide === 'left' ? '1P_' : '2P_';
    const L  = !!inputs[`${pfx}LEFT`];
    const R  = !!inputs[`${pfx}RIGHT`];
    const U  = !!inputs[`${pfx}UP`];
    const D  = !!inputs[`${pfx}DOWN`];
    const A  = !!inputs[`${pfx}ACTION`];
    const DL = !!inputs[`${pfx}DOUBLE_LEFT`];
    const DR = !!inputs[`${pfx}DOUBLE_RIGHT`];
    const DU = !!inputs[`${pfx}DOUBLE_UP`];
    const DD = !!inputs[`${pfx}DOUBLE_DOWN`];

    const locked = es.actionDuration > 0 && es.actionTick < es.actionDuration;

    // DIVE 감속 (매 틱)
    if (es.actionType === 'DIVE') es.vx *= 0.92;

    // SKILL — locked 중에도 허용
    if (DD) return { action: 'SKILL', dvx: -es.vx, dvy: 0 };

    if (locked) return null;

    // 점프 중 더블업 → 블로킹
    if (es.actionType === 'JUMP' && DU) return { action: 'BLOCK', dvx: 0, dvy: 0 };

    // 다이빙 (지상 전용)
    if (DL && es.onGround) { es.vx = -DIVE_VX; es.facing = -1; return { action: 'DIVE', dvx: 0, dvy: DIVE_VY }; }
    if (DR && es.onGround) { es.vx =  DIVE_VX; es.facing =  1; return { action: 'DIVE', dvx: 0, dvy: DIVE_VY }; }

    // 지상 더블업 → 블로킹 점프
    if (DU && es.onGround) return { action: 'BLOCK', dvx: 0, dvy: BLOCK_VY };

    // 스파이크
    if (A) return { action: 'SPIKE', dvx: 0, dvy: 0 };

    // 리시브 (지상)
    if (D && es.onGround) return { action: 'RECEIVE', dvx: 0, dvy: 0 };

    // 점프
    if (U && es.onGround) return { action: 'JUMP', dvx: 0, dvy: JUMP_VY };

    // 착지
    if (es.onGround && (es.actionType === 'JUMP' || es.actionType === 'BLOCK' || es.actionType === 'DIVE')) {
      es.vx = 0;
      return { action: 'IDLE', dvx: 0, dvy: 0 };
    }

    // 이동
    if (L) { es.vx = -P_SPEED; es.facing = -1; return es.actionType === 'RUN' ? null : { action: 'RUN', dvx: 0, dvy: 0 }; }
    if (R) { es.vx =  P_SPEED; es.facing =  1; return es.actionType === 'RUN' ? null : { action: 'RUN', dvx: 0, dvy: 0 }; }

    // 정지
    if (es.actionType === 'RUN') { es.vx = 0; return { action: 'IDLE', dvx: 0, dvy: 0 }; }
    if (es.actionType === 'IDLE') es.vx = 0;

    return null;
  },

  onBallHitFloor(state, side) {
    if (state.phase !== 'rally') return;
    if (window.noScore) return;
    const scorer = side === 'left' ? 'p2' : 'p1';
    state.score[scorer]++;
    state.lastScorer = scorer;
    state.phase      = 'point';
    state.pointTimer = POINT_PAUSE_TICKS;
    // 공 정지 (point 페이즈 중 바닥 중복 감지 방지)
    if (state.ball) { state.ball.vx = 0; state.ball.vy = 0; }
  },

  onBallHitNet(_state) {},
  onBallHitPlayer(_state, _entityId, _hit) {},

  onBallInActionRange(state, entityId, _entity, actionType) {
    const ps = state[entityId];
    const bs = state.ball;
    if (!ps || !bs) return;

    if (actionType === 'SPIKE' || actionType === 'SKILL') {
      // 플레이어→공 방향과 "앞아래" 목표 방향을 블렌딩
      const dx = bs.x - ps.x, dy = bs.y - ps.y;
      const len = Math.hypot(dx, dy) || 1;
      const rawX = dx / len, rawY = dy / len;
      const tgtX = ps.facing, tgtY = -0.6;
      const tgtLen = Math.hypot(tgtX, tgtY);
      const BIAS = 0.7;
      const fx = rawX * (1 - BIAS) + (tgtX / tgtLen) * BIAS;
      const fy = rawY * (1 - BIAS) + (tgtY / tgtLen) * BIAS;
      const fl = Math.hypot(fx, fy);
      const SPEED = 14 / LW;
      bs.vx = (fx / fl) * SPEED;
      bs.vy = (fy / fl) * SPEED;

    } else if (actionType === 'RECEIVE') {
      // 플레이어→공 방향과 "위" 방향을 블렌딩
      const dx = bs.x - ps.x, dy = bs.y - ps.y;
      const len = Math.hypot(dx, dy) || 1;
      const rawX = dx / len, rawY = dy / len;
      const BIAS = 0.5;
      const fx = rawX * (1 - BIAS);
      const fy = rawY * (1 - BIAS) + BIAS;  // 위쪽 편향
      const fl = Math.hypot(fx, fy);
      const SPEED = 10 / LW;
      bs.vx = (fx / fl) * SPEED;
      bs.vy = (fy / fl) * SPEED;
    }
  },

  onTick: tickGameRule,
};

// ─── 게임 규칙 틱 (GameLoop 외부에서 호출) ───────────────────────────────────
export function tickGameRule(state) {
  if (state.phase !== 'point') return;

  state.pointTimer--;
  if (state.pointTimer > 0) return;

  if (state.score.p1 >= WIN_SCORE || state.score.p2 >= WIN_SCORE) {
    const setWinner = state.score.p1 > state.score.p2 ? 'p1' : 'p2';
    state.sets[setWinner]++;
    if (state.sets.p1 >= WIN_SETS || state.sets.p2 >= WIN_SETS) {
      state.phase = 'gameover';
      return;
    }
    state.score = { p1: 0, p2: 0 };
  }

  const fresh = makeInitialState(state.lastScorer === 'p2');
  Object.assign(state, fresh);
  state.phase = 'rally';
}
