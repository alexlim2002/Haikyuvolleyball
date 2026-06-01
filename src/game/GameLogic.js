/**
 * GameLogic.js — 샘플 게임 로직
 *
 * initEntities(entityManager) → initialState
 * handlers: { resolveAction, onBallHitFloor, onBallHitNet, onBallHitPlayer }
 * physicsMap: PhysicsMap 인스턴스
 */

import { PhysicsMap } from "../engine/Physics.js";
import { makePlayerHitboxes } from "./Hitbox.js";
import { TIER } from "./Characters.js";

// ─── 물리 상수 (1 unit = 800px) ───────────────────────────────────────────────
const LW = 800; // LOGICAL_WIDTH

// 스태미나 드레인 (틱당)
const DRAIN_MOVE = -0.03; // 이동 중 소량 회복
const DRAIN_JUMP = 4;
const DRAIN_SPIKE = 5;
const DRAIN_BLOCK = 1.5;
const DRAIN_DIVE = 8;
const DRAIN_RECEIVE = 1;
const RECOVER_IDLE = 0.1; // 가만히 있을 때 틱당 회복
const JUMP_VY = 13 / LW;
const DIVE_VX = 18 / LW;
const DIVE_VY = 3 / LW;
const BLOCK_VY = 9.1 / LW;

const TOSS_VY = 12 / LW;
const SERVE_TOSS_EXTRA_G = 0.2 / LW; // 토스 중 추가 중력 (체공시간 단축)
const SERVE_BALL_OFFSET = 30 / LW; // 공이 서버 앞쪽에 위치하는 거리
const SERVE_SPEED_MIN = 10 / LW;
const SERVE_SPEED_MAX = 18 / LW;
const SERVE_X_LEFT = 0.08;
const SERVE_X_RIGHT = 0.92;

const P_GRAVITY = 0.5 / LW;
const APEX_THRESHOLD = 2 / LW;
const BALL_GRAVITY = 0.05 / LW;
const BALL_REST = 0.9;

const BALL_R = 18 / LW;
const ARM_LEN = 35 / LW;
const RECEIVE_R = 55 / LW;
const P_SIZE = { w: 80 / LW, h: 80 / LW };
const NET_SIZE = { w: 10 / LW, h: 200 / LW }; // 히트박스 (높이 1.5배)
const NET_DISPLAY = { w: 20 / LW, h: 200 / LW }; // 시각 (두께 2배, 높이 1.5배)
const NET_DROP = 60 / LW; // 네트가 뷰포트 바닥 기준이라 히트박스를 FLOOR_OFFSET만큼 아래로

const WIN_SCORE = 15;
const WIN_SETS = 2;
const POINT_PAUSE_TICKS = 0;

// ─── 스프라이트 레이아웃 (히나타쇼요.png, 8열×3행 1D) ───────────────────────
const PLAYER_SPRITES = {
  IDLE: { right: { start: 0, count: 1 }, left: { start: 1, count: 1 } },
  RUN: { right: { start: 2, count: 2 }, left: { start: 4, count: 2 } },
  JUMP: { right: { start: 6, count: 1 }, left: { start: 7, count: 1 } },
  BLOCK: { right: { start: 8, count: 1 }, left: { start: 9, count: 1 } },
  SERVE: { right: { start: 10, count: 1 }, left: { start: 12, count: 1 } },
  SERVE_HIT: { right: { start: 11, count: 1 }, left: { start: 13, count: 1 } },
  RECEIVE: { right: { start: 14, count: 1 }, left: { start: 15, count: 1 } },
  SPIKE: { right: { start: 16, count: 2 }, left: { start: 18, count: 2 } },
  DIVE: { right: { start: 20, count: 1 }, left: { start: 21, count: 1 } },
};

// ─── 물리맵 ───────────────────────────────────────────────────────────────────
export const physicsMap = new PhysicsMap(1, 0.5625);

// ─── 캐릭터 스탯 → 엔티티 수치 변환 ─────────────────────────────────────────
function resolveCharStats(char) {
  const s = char?.stats ?? {};
  const physMult = TIER.physique[s.physique ?? "중"];
  return {
    size: { w: P_SIZE.w * physMult, h: P_SIZE.h * physMult },
    armLength: ARM_LEN * physMult,
    speed: TIER.speed[s.speed ?? "중"],
    power: TIER.power[s.power ?? "중"],
    maxStamina: TIER.stamina[s.stamina ?? "중"],
    hitboxes: makePlayerHitboxes(physMult),
  };
}

function makePlayerActionsFor(hitboxes) {
  return {
    IDLE: {
      duration: 0,
      sprites: PLAYER_SPRITES.IDLE,
      getHitbox: hitboxes.IDLE,
    },
    RUN: {
      duration: 0,
      sprites: PLAYER_SPRITES.RUN,
      frameMs: 150,
      getHitbox: hitboxes.RUN,
    },
    JUMP: {
      duration: 0,
      sprites: PLAYER_SPRITES.JUMP,
      getHitbox: hitboxes.JUMP,
    },
    SPIKE: {
      duration: 10,
      sprites: PLAYER_SPRITES.SPIKE,
      getHitbox: hitboxes.SPIKE,
    },
    BLOCK: {
      duration: 50,
      sprites: PLAYER_SPRITES.BLOCK,
      getHitbox: hitboxes.BLOCK,
    },
    DIVE: {
      duration: 35,
      sprites: PLAYER_SPRITES.DIVE,
      getHitbox: hitboxes.DIVE,
    },
    RECEIVE: {
      duration: 15,
      sprites: PLAYER_SPRITES.RECEIVE,
      getHitbox: hitboxes.RECEIVE,
      actionRange: { ox: 0, oy: 0.03, r: RECEIVE_R },
    },
    SERVE: {
      duration: 0,
      sprites: PLAYER_SPRITES.SERVE,
      getHitbox: hitboxes.IDLE,
    },
    SERVE_HIT: {
      duration: 8,
      sprites: PLAYER_SPRITES.SERVE_HIT,
      getHitbox: hitboxes.IDLE,
    },
  };
}

// ─── 엔티티 등록 + 초기 상태 반환 ────────────────────────────────────────────
export function initEntities(entityManager, p1Char, p2Char) {
  const p1Stats = resolveCharStats(p1Char);
  const p2Stats = resolveCharStats(p2Char);

  entityManager.register("court", {
    type: "bg",
    role: "bg",
    assetId: "court",
    origin: "bottom-center",
    size: { w: 1, h: 0.5625 },
  });

  entityManager.register("net", {
    type: "entity",
    role: "net",
    assetId: "net",
    origin: "bottom-center",
    size: NET_DISPLAY,
    physics: { gravity: 0, restitution: 0 },
    actions: {
      DEFAULT: {
        duration: 0,
        sprites: { start: 0, count: 1 },
        getHitbox: () => [
          {
            shape: "capsule",
            ox: 0,
            oy: NET_SIZE.h / 2 - NET_DROP,
            length: NET_SIZE.h,
            angle: Math.PI / 2,
            r: NET_SIZE.w / 2,
            restitution: 0,
          },
        ],
      },
    },
  });

  entityManager.register("player1", {
    type: "entity",
    role: "player",
    playerSide: "left",
    assetId: p1Char?.id ?? "hinata",
    origin: "bottom-center",
    size: p1Stats.size,
    physics: {
      gravity: P_GRAVITY,
      restitution: 0,
      apexThreshold: APEX_THRESHOLD,
    },
    armLength: p1Stats.armLength,
    speed: p1Stats.speed,
    power: p1Stats.power,
    maxStamina: p1Stats.maxStamina,
    actions: makePlayerActionsFor(p1Stats.hitboxes),
    serveTypes: p1Char?.serveTypes ?? ["UNDERHAND"],
  });

  entityManager.register("player2", {
    type: "entity",
    role: "player",
    playerSide: "right",
    assetId: p2Char?.id ?? "hinata",
    origin: "bottom-center",
    size: p2Stats.size,
    physics: {
      gravity: P_GRAVITY,
      restitution: 0,
      apexThreshold: APEX_THRESHOLD,
    },
    armLength: p2Stats.armLength,
    speed: p2Stats.speed,
    power: p2Stats.power,
    maxStamina: p2Stats.maxStamina,
    actions: makePlayerActionsFor(p2Stats.hitboxes),
    serveTypes: p2Char?.serveTypes ?? ["UNDERHAND"],
  });

  entityManager.register("ball", {
    type: "entity",
    role: "ball",
    assetId: "ball",
    origin: "center",
    size: { w: BALL_R * 2, h: BALL_R * 2 },
    physics: { gravity: BALL_GRAVITY, restitution: BALL_REST },
    actions: {
      DEFAULT: {
        duration: 0,
        sprites: { start: 0, count: 1 },
        getHitbox: () => [
          { shape: "circle", ox: 0, oy: 0, r: BALL_R, restitution: BALL_REST },
        ],
      },
    },
  });

  return makeInitialState(
    Math.random() < 0.5,
    null,
    null,
    p1Stats.maxStamina,
    p2Stats.maxStamina,
  );
}

function makeInitialState(serveLeft, score, sets, p1Stamina, p2Stamina) {
  const serverSide = serveLeft ? "left" : "right";
  const server = serveLeft ? "player1" : "player2";
  const sx = serveLeft ? SERVE_X_LEFT : SERVE_X_RIGHT;
  return {
    court: { x: 0.5, y: 0 },
    net: { x: 0.5, y: 0, vx: 0, vy: 0 },
    player1: {
      x: serveLeft ? sx : 0.25,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      actionType: "IDLE",
      actionTick: 0,
      actionDuration: 0,
      prevAction: false,
      noBallCollide: serveLeft,
      serveBuffer: 0,
      stamina: p1Stamina ?? 120,
    },
    player2: {
      x: serveLeft ? 0.75 : sx,
      y: 0,
      vx: 0,
      vy: 0,
      facing: -1,
      onGround: true,
      actionType: "IDLE",
      actionTick: 0,
      actionDuration: 0,
      prevAction: false,
      noBallCollide: !serveLeft,
      serveBuffer: 0,
      stamina: p2Stamina ?? 120,
    },
    ball: {
      x: sx + (serveLeft ? 1 : -1) * SERVE_BALL_OFFSET,
      y: P_SIZE.h,
      vx: 0,
      vy: 0,
      actionRangeCooldown: 0,
    },
    phase: "serve",
    serveStep: "ready", // 'ready' → 'tossed'
    server,
    serverSide,
    serveTossY: 0,
    score: score ?? { p1: 0, p2: 0 },
    sets: sets ?? { p1: 0, p2: 0 },
    lastScorer: serveLeft ? "p1" : "p2",
    pointTimer: 0,
  };
}

// ─── 서브 실행 ───────────────────────────────────────────────────────────────
function executeServe(state, entity) {
  const bs = state.ball;
  const ps = state[state.server];
  if (!bs || !ps) return false;

  const facingX = state.serverSide === "left" ? 1 : -1;
  const dx = (bs.x - ps.x) * facingX;
  const entitySize = entity?.size ?? P_SIZE;
  const headY = ps.y + entitySize.h;
  const armLen = entity?.armLength ?? ARM_LEN;
  const isAir = !ps.onGround;
  const isOverhand = bs.y >= headY;
  const types = entity?.serveTypes ?? ["OVERHAND", "UNDERHAND"];

  // x 범위: SERVE_BALL_OFFSET 기준 고정 (체격 스케일 무관)
  if (dx <= 0 || dx > ARM_LEN) return false;

  let serveType;
  if (isAir) {
    if (!isOverhand || bs.y > headY + armLen) return false;
    if (!types.includes("JUMP")) return false;
    serveType = "JUMP";
  } else if (isOverhand) {
    if (bs.y > headY + armLen) return false;
    if (!types.includes("OVERHAND")) return false;
    serveType = "OVERHAND";
  } else {
    if (bs.y < ps.y) return false;
    if (!types.includes("UNDERHAND")) return false;
    serveType = "UNDERHAND";
  }

  const power = entity?.power ?? 1.0;
  const ratio = Math.min(1, Math.max(0, bs.y / (state.serveTossY || 0.001)));
  const speed =
    (SERVE_SPEED_MIN + (SERVE_SPEED_MAX - SERVE_SPEED_MIN) * ratio) * power;

  let vx, vy;
  if (serveType === "JUMP") {
    vx = facingX * speed * 0.97;
    vy = -speed * 0.2;
  } else if (serveType === "OVERHAND") {
    vx = facingX * speed * 0.92;
    vy = speed * 0.4; // 위로
  } else {
    // 낮게 칠수록 30°, 높게 칠수록 80°
    const heightRatio = Math.min(1, Math.max(0, bs.y / headY));
    const angleRad = ((30 + heightRatio * 50) * Math.PI) / 180;
    vx = facingX * speed * Math.cos(angleRad);
    vy = speed * Math.sin(angleRad);
  }

  bs.vx = vx;
  bs.vy = vy;
  state[state.server].noBallCollide = false;
  state.phase = "rally";
  return true;
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────
export const handlers = {
  resolveAction(entityId, entity, state, inputs) {
    const es = state[entityId];
    if (!es) return null;

    const pfx = entity.playerSide === "left" ? "1P_" : "2P_";
    const L = !!inputs[`${pfx}LEFT`];
    const R = !!inputs[`${pfx}RIGHT`];
    const U = !!inputs[`${pfx}UP`];
    const D = !!inputs[`${pfx}DOWN`];
    const A = !!inputs[`${pfx}ACTION`];
    const DL = !!inputs[`${pfx}DOUBLE_LEFT`];
    const DR = !!inputs[`${pfx}DOUBLE_RIGHT`];
    const DU = !!inputs[`${pfx}DOUBLE_UP`];
    const DD = !!inputs[`${pfx}DOUBLE_DOWN`];

    // ── 서브 페이즈 처리 ────────────────────────────────────────────────────
    if (state.phase === "serve" && state.server === entityId) {
      // 서브 플레이어는 맵 끝에 고정, 이동 불가
      es.vx = 0;
      es.stamina = Math.min(entity.maxStamina, es.stamina + RECOVER_IDLE);
      const justPressed = A && !es.prevAction;
      es.prevAction = A;
      if (justPressed) {
        if (state.serveStep === "ready") {
          // 1차: 공 토스 → SERVE 프레임1로 전환
          const bs = state.ball;
          if (bs) {
            bs.vx = 0;
            bs.vy = TOSS_VY;
            state.serveTossY =
              bs.y +
              (TOSS_VY * TOSS_VY) / (2 * (BALL_GRAVITY + SERVE_TOSS_EXTRA_G));
          }
          state.serveStep = "tossed";
          es.serveBuffer = 0;
          return { action: "SERVE", dvx: 0, dvy: 0 };
        } else if (state.serveStep === "tossed") {
          if (executeServe(state, entity)) {
            es.serveBuffer = 0;
            return { action: "SERVE_HIT", dvx: 0, dvy: 0 };
          }
          // 범위 밖이면 20틱 버퍼 — 공이 범위에 들어올 때 자동 실행
          es.serveBuffer = 20;
        }
      }

      // 버퍼 처리: 이전에 눌렀는데 범위 밖이었던 경우 매 틱 재시도
      if (es.serveBuffer > 0 && state.serveStep === "tossed") {
        es.serveBuffer--;
        if (executeServe(state, entity)) {
          es.serveBuffer = 0;
          return { action: "SERVE_HIT", dvx: 0, dvy: 0 };
        }
      }

      // 점프서브 가능 캐릭터: tossed 중 점프 허용
      if (state.serveStep === "tossed" && entity.serveTypes?.includes("JUMP")) {
        if (U && es.onGround) return { action: "JUMP", dvx: 0, dvy: JUMP_VY };
        if (es.onGround && es.actionType === "JUMP") {
          es.vx = 0;
          return { action: "SERVE", dvx: 0, dvy: 0 };
        }
        if (!es.onGround) return null; // 공중: JUMP 유지
      }

      return es.actionType === "SERVE"
        ? null
        : { action: "SERVE", dvx: 0, dvy: 0 };
    }

    const locked = es.actionDuration > 0 && es.actionTick < es.actionDuration;

    // DIVE 감속 (매 틱)
    if (es.actionType === "DIVE") es.vx *= 0.92;

    if (es.actionType === "BLOCK" && !es.onGround && locked && es.vy < 0)
      es.vy += P_GRAVITY * 0.1;

    if (locked) return null;

    // 스태미나 기반 유효 속도
    const staminaRatio = es.stamina / entity.maxStamina;
    const effectiveSpeed = entity.speed * Math.max(0.4, staminaRatio);

    // 점프 중 더블업 → 블로킹
    if (es.actionType === "JUMP" && DU) {
      es.stamina = Math.max(0, es.stamina - DRAIN_BLOCK);
      return { action: "BLOCK", dvx: 0, dvy: 0 };
    }

    // 다이빙 (지상 전용)
    if (DL && es.onGround) {
      es.stamina = Math.max(0, es.stamina - DRAIN_DIVE);
      es.vx = -DIVE_VX;
      es.facing = -1;
      return { action: "DIVE", dvx: 0, dvy: DIVE_VY };
    }
    if (DR && es.onGround) {
      es.stamina = Math.max(0, es.stamina - DRAIN_DIVE);
      es.vx = DIVE_VX;
      es.facing = 1;
      return { action: "DIVE", dvx: 0, dvy: DIVE_VY };
    }

    // 지상 더블업 → 블로킹 점프
    if (DU && es.onGround) {
      es.stamina = Math.max(0, es.stamina - DRAIN_BLOCK);
      return { action: "BLOCK", dvx: 0, dvy: BLOCK_VY };
    }

    // 스파이크
    if (A) {
      es.stamina = Math.max(0, es.stamina - DRAIN_SPIKE);
      return { action: "SPIKE", dvx: 0, dvy: 0 };
    }

    // 리시브 (지상)
    if (D && es.onGround) {
      es.stamina = Math.max(0, es.stamina - DRAIN_RECEIVE);
      return { action: "RECEIVE", dvx: 0, dvy: 0 };
    }

    // 점프
    if (U && es.onGround) {
      es.stamina = Math.max(0, es.stamina - DRAIN_JUMP);
      return { action: "JUMP", dvx: 0, dvy: JUMP_VY };
    }

    // 착지
    if (
      es.onGround &&
      (es.actionType === "JUMP" ||
        es.actionType === "BLOCK" ||
        es.actionType === "DIVE")
    ) {
      es.vx = 0;
      return { action: "IDLE", dvx: 0, dvy: 0 };
    }

    // 이동
    if (L) {
      es.stamina = Math.min(entity.maxStamina, es.stamina - DRAIN_MOVE);
      es.vx = -effectiveSpeed;
      es.facing = -1;
      return es.actionType === "RUN" ? null : { action: "RUN", dvx: 0, dvy: 0 };
    }
    if (R) {
      es.stamina = Math.min(entity.maxStamina, es.stamina - DRAIN_MOVE);
      es.vx = effectiveSpeed;
      es.facing = 1;
      return es.actionType === "RUN" ? null : { action: "RUN", dvx: 0, dvy: 0 };
    }

    // 정지
    if (es.actionType === "RUN") {
      es.vx = 0;
      return { action: "IDLE", dvx: 0, dvy: 0 };
    }
    if (es.actionType === "IDLE") {
      es.vx = 0;
      es.stamina = Math.min(entity.maxStamina, es.stamina + RECOVER_IDLE);
    }

    return null;
  },

  onBallHitFloor(state, side) {
    if (state.phase === "serve") {
      // 서브 도중 공이 떨어지면 폴트 → 상대방 득점
      if (window.noScore) return;
      const scorer = state.serverSide === "left" ? "p2" : "p1";
      state.score[scorer]++;
      state.lastScorer = scorer;
      state.phase = "point";
      state.pointTimer = POINT_PAUSE_TICKS;
      if (state.ball) {
        state.ball.vx = 0;
        state.ball.vy = 0;
      }
      return;
    }
    if (state.phase !== "rally") return;
    if (window.noScore) return;
    const scorer = side === "left" ? "p2" : "p1";
    state.score[scorer]++;
    state.lastScorer = scorer;
    state.phase = "point";
    state.pointTimer = POINT_PAUSE_TICKS;
    // 공 정지 (point 페이즈 중 바닥 중복 감지 방지)
    if (state.ball) {
      state.ball.vx = 0;
      state.ball.vy = 0;
    }
  },

  onBallHitNet(_state) {},
  onBallHitPlayer(_state, _entityId, _hit) {},

  onBallInActionRange(state, entityId, entity, actionType) {
    const _entity = entity;
    const ps = state[entityId];
    const bs = state.ball;
    if (!ps || !bs) return;

    if (actionType === "SPIKE") {
      // 플레이어→공 방향과 "앞아래" 목표 방향을 블렌딩
      const dx = bs.x - ps.x,
        dy = bs.y - ps.y;
      const len = Math.hypot(dx, dy) || 1;
      const rawX = dx / len,
        rawY = dy / len;
      const tgtX = ps.facing,
        tgtY = -0.6;
      const tgtLen = Math.hypot(tgtX, tgtY);
      const BIAS = 0.7;
      const fx = rawX * (1 - BIAS) + (tgtX / tgtLen) * BIAS;
      const fy = rawY * (1 - BIAS) + (tgtY / tgtLen) * BIAS;
      const fl = Math.hypot(fx, fy);
      const power = _entity?.power ?? 1.0;
      const SPEED = (14 / LW) * power;
      bs.vx = (fx / fl) * SPEED;
      bs.vy = (fy / fl) * SPEED;
    } else if (actionType === "RECEIVE") {
      // 플레이어→공 방향과 "위" 방향을 블렌딩
      const dx = bs.x - ps.x,
        dy = bs.y - ps.y;
      const len = Math.hypot(dx, dy) || 1;
      const rawX = dx / len,
        rawY = dy / len;
      const BIAS = 0.5;
      const fx = rawX * (1 - BIAS);
      const fy = rawY * (1 - BIAS) + BIAS; // 위쪽 편향
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
  if (state.phase === "serve") {
    if (state.serveStep === "ready") {
      // 공을 서버 앞쪽에 고정
      const ps = state[state.server];
      if (ps && state.ball) {
        const facingX = state.serverSide === "left" ? 1 : -1;
        state.ball.x = ps.x + facingX * SERVE_BALL_OFFSET;
        state.ball.y = ps.y + P_SIZE.h;
        state.ball.vx = 0;
        state.ball.vy = 0;
      }
    } else if (state.serveStep === "tossed" && state.ball) {
      // 토스 체공시간 단축을 위한 추가 중력
      state.ball.vy -= SERVE_TOSS_EXTRA_G;
    }
    return;
  }

  if (state.phase !== "point") return;

  state.pointTimer--;
  if (state.pointTimer > 0) return;

  // 세트 종료 판단
  let newScore = { ...state.score };
  let newSets = { ...state.sets };

  if (newScore.p1 >= WIN_SCORE || newScore.p2 >= WIN_SCORE) {
    const setWinner = newScore.p1 > newScore.p2 ? "p1" : "p2";
    newSets[setWinner]++;
    if (newSets.p1 >= WIN_SETS || newSets.p2 >= WIN_SETS) {
      state.phase = "gameover";
      return;
    }
    newScore = { p1: 0, p2: 0 };
  }

  const p1Stamina = state.player1.stamina;
  const p2Stamina = state.player2.stamina;
  const fresh = makeInitialState(
    state.lastScorer === "p1",
    newScore,
    newSets,
    p1Stamina,
    p2Stamina,
  );
  Object.assign(state, fresh);
}
