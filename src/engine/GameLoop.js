/**
 * GameLoop
 *
 * 엔진 내부 tick 구현. 매 틱 다음 작업을 수행한다.
 *   1. 플레이어 액션 상태머신 (입력 → 액션 전이)
 *   2. 히트박스 갱신 (entity.actions[actionType].getHitbox)
 *   3. 물리 (중력, 이동, 충돌)
 *   4. 이벤트 감지 → handlers 호출
 *
 * 엔티티 스키마 (EntityManager에 등록 시):
 *   role: 'player' | 'ball' | 'net'
 *   playerSide: 'left' | 'right'   (role=player 전용)
 *   origin: 'bottom-center' | 'center'
 *   size: { w, h }                 (physics unit)
 *   physics: { gravity, restitution }
 *   actions: {
 *     [actionName]: {
 *       duration: number,           0 = 입력으로만 종료
 *       sprites: { start, count },
 *       getHitbox: (t, facing) => Body[],
 *     }
 *   }
 *
 * 상태(state) 엔티티 필드:
 *   x, y        — 물리 좌표 (physics unit, 엔티티 원점 기준)
 *   vx, vy      — 속도 (physics unit/tick)
 *   facing      — 1(오른쪽) | -1(왼쪽)  (player 전용)
 *   onGround    — boolean               (player 전용)
 *   actionType  — 현재 액션 이름
 *   actionTick  — 현재 액션 경과 틱
 *   actionDuration — 현재 액션 총 틱
 *
 * handlers:
 *   resolveAction(entityId, entity, state, inputs)
 *     → { action, dvx, dvy } | null
 *   onBallHitFloor(state, side)   → void  (state 직접 변경)
 *   onBallHitNet(state)           → void
 *   onBallHitPlayer(state, entityId, normal) → void
 */

import {
  PhysicsMap,
  applyGravity,
  resolveBody,
  detectBallVsCompound,
  detectVsMap,
  resolveCollision,
} from './Physics.js';

export class GameLoop {
  #entityManager;
  #physicsMap;
  #handlers;

  constructor({ entityManager, physicsMap, handlers }) {
    this.#entityManager = entityManager;
    this.#physicsMap    = physicsMap;
    this.#handlers      = handlers;
  }

  // ─── 공개 API ──────────────────────────────────────────────────────────────

  tick(state, inputs) {
    const next = {};
    for (const key in state) {
      const val = state[key];
      next[key] = (val !== null && typeof val === 'object') ? { ...val } : val;
    }
    const toPlay  = [];
    const em      = this.#entityManager;
    const map     = this.#physicsMap;
    const h       = this.#handlers;

    // ── 플레이어 처리 ───────────────────────────────────────────────────────
    for (const entity of em.getAll()) {
      if (entity.role !== 'player') continue;
      this.#tickPlayer(entity, next, inputs, toPlay);
    }

    // ── 공 처리 ────────────────────────────────────────────────────────────
    const ballEntity = this.#findByRole('ball');
    if (ballEntity && next[ballEntity.id]) {
      this.#tickBall(ballEntity, next, toPlay);
    }

    // 틱 종료 후 훅 (게임 규칙 타이머 등)
    { const sfx = h.onTick?.(next); if (Array.isArray(sfx)) toPlay.push(...sfx); }

    return { nextState: next, toPlay };
  }

  // ─── 플레이어 틱 ───────────────────────────────────────────────────────────

  #tickPlayer(entity, state, inputs, toPlay) {
    const es  = state[entity.id];
    const map = this.#physicsMap;
    if (!es) return;

    // 1. actionTick 증가
    es.actionTick++;

    // 2. 액션 만료
    if (es.actionDuration > 0 && es.actionTick >= es.actionDuration) {
      const fallback = this.#handlers.resolveAction(entity.id, entity, state, {}) ?? { action: 'IDLE', dvx: 0, dvy: 0 };
      this.#applyAction(es, entity, fallback);
    }

    // 3. 입력 기반 액션 전이
    const transition = this.#handlers.resolveAction(entity.id, entity, state, inputs);
    if (transition) {
      this.#applyAction(es, entity, transition);
      if (Array.isArray(transition.sfx)) toPlay.push(...transition.sfx);
    }

    // 4. 중력 (변곡점 감속은 뷰포트 높이 내에서만)
    const VIEWPORT_H = 0.5625;
    const atApex = entity.physics.apexThreshold &&
                   Math.abs(es.vy) < entity.physics.apexThreshold &&
                   es.y < VIEWPORT_H;
    es.vy = applyGravity(es.vy, entity.physics.gravity * (atApex ? 0.4 : 1));

    // 5. 이동
    es.x += es.vx;
    es.y += es.vy;

    // 6. 바닥 충돌
    if (es.y <= 0) {
      es.y        = 0;
      es.vy       = 0;
      es.onGround = true;
    } else {
      es.onGround = false;
    }

    // 7. 좌우 맵 경계 clamp
    const hw = (entity.size?.w ?? 0) / 2;
    es.x = Math.max(hw, Math.min(map.w - hw, es.x));

    // 8. 코트 영역 clamp (네트 넘기 금지)
    const netEntity = this.#findByRole('net');
    if (netEntity) {
      const netX = state[netEntity.id]?.x ?? map.w / 2;
      const netHw = (netEntity.size?.w ?? 0) / 2;
      if (entity.playerSide === 'left') {
        es.x = Math.min(es.x, netX - netHw - hw);
      } else {
        es.x = Math.max(es.x, netX + netHw + hw);
      }
    }
  }

  // ─── 공 틱 ────────────────────────────────────────────────────────────────

  #tickBall(ballEntity, state, toPlay) {
    const bs = state[ballEntity.id];
    if (!bs) return;
    const h  = this.#handlers;
    const map = this.#physicsMap;

    // 1. 중력
    bs.vy = applyGravity(bs.vy, ballEntity.physics.gravity);

    // 2. 이동
    bs.x += bs.vx;
    bs.y += bs.vy;

    // 3. 공 히트박스
    const ballBodyDef = ballEntity.actions?.DEFAULT?.getHitbox?.(0, 1)?.[0];
    if (!ballBodyDef) return;
    const ballResolved = resolveBody(bs.x, bs.y, ballBodyDef);

    // 4. 맵 경계 충돌
    for (const hit of detectVsMap(ballResolved, map)) {
      if (hit.side === 'bottom') {
        const { newVelA } = resolveCollision(
          { x: bs.vx, y: bs.vy }, ballEntity.physics.restitution,
          { x: 0, y: 0 }, 0,
          hit
        );
        bs.vx = newVelA.x;
        bs.vy = newVelA.y;
        bs.y += hit.ny * hit.depth;
        { const sfx = h.onBallHitFloor?.(state, bs.x < map.w / 2 ? 'left' : 'right'); if (sfx) toPlay.push(...sfx); }
        continue;
      }
      // 좌/우/상단 벽 반사
      const { newVelA } = resolveCollision(
        { x: bs.vx, y: bs.vy }, ballEntity.physics.restitution,
        { x: 0, y: 0 }, 0,
        hit
      );
      bs.vx = newVelA.x;
      bs.vy = newVelA.y;
      bs.x += hit.nx * hit.depth;
      bs.y += hit.ny * hit.depth;
      { const sfx = h.onBallHitWall?.(state); if (sfx) toPlay.push(...sfx); }
    }

    // 5. 네트 충돌
    const netEntity = this.#findByRole('net');
    if (netEntity) {
      const ns = state[netEntity.id];
      if (ns) {
        const netBodies = netEntity.actions?.DEFAULT?.getHitbox?.(0, 1) ?? [];
        const resolvedNet = netBodies.map(b => resolveBody(ns.x, ns.y, b));
        const freshBall   = resolveBody(bs.x, bs.y, ballBodyDef);
        const rawNetHit = detectBallVsCompound(freshBall, resolvedNet);
        const netHit = rawNetHit ? { nx: -rawNetHit.nx, ny: -rawNetHit.ny, depth: rawNetHit.depth } : null;
        if (netHit) {
          const { newVelA } = resolveCollision(
            { x: bs.vx, y: bs.vy }, ballEntity.physics.restitution,
            { x: 0, y: 0 }, 0,
            netHit
          );
          bs.vx = newVelA.x;
          bs.vy = newVelA.y;
          bs.x += netHit.nx * netHit.depth;
          bs.y += netHit.ny * netHit.depth;
          { const sfx = h.onBallHitNet?.(state); if (sfx) toPlay.push(...sfx); }
        }
      }
    }

    // 6. 플레이어 충돌 + 액션 범위 탐지
    if (bs.actionRangeCooldown > 0) bs.actionRangeCooldown--;

    for (const entity of this.#entityManager.getAll()) {
      if (entity.role !== 'player') continue;
      const ps = state[entity.id];
      if (!ps) continue;
      if (ps.noBallCollide) continue;  // 서브 중 서버는 공과 충돌하지 않음

      const actionDef = entity.actions?.[ps.actionType];
      if (!actionDef?.getHitbox) continue;
      const t        = ps.actionDuration > 0 ? ps.actionTick / ps.actionDuration : 0;
      const bodyDefs = actionDef.getHitbox(t, ps.facing);
      const armLen   = entity.armLength ?? 0;

      // BLOCK/DIVE: torso 선분 연장 후 물리 충돌
      const bodies    = bodyDefs
        .map(b => resolveBody(ps.x, ps.y, b))
        .map(b => this.#extendArm(b, ps.actionType, ps.facing, armLen));
      const freshBall = resolveBody(bs.x, bs.y, ballBodyDef);
      const rawHit = detectBallVsCompound(freshBall, bodies);
      const hit    = rawHit ? { nx: -rawHit.nx, ny: -rawHit.ny, depth: rawHit.depth } : null;

      if (hit) {
        const { newVelA } = resolveCollision(
          { x: bs.vx, y: bs.vy }, ballEntity.physics.restitution,
          { x: ps.vx, y: ps.vy }, 0,
          hit
        );
        bs.vx = newVelA.x;
        bs.vy = newVelA.y;
        bs.x += hit.nx * hit.depth;
        bs.y += hit.ny * hit.depth;
        { const sfx = h.onBallHitPlayer?.(state, entity.id, hit); if (sfx) toPlay.push(...sfx); }
      }

      // SPIKE/SKILL: arm 상단 끝점 기준 범위 탐지
      if (bs.actionRangeCooldown <= 0 &&
          (ps.actionType === 'SPIKE' || ps.actionType === 'SKILL') && armLen > 0) {
        const armDef = bodyDefs.find(b => b.isArm);
        if (armDef) {
          const arm  = resolveBody(ps.x, ps.y, armDef);
          const half = arm.length / 2;
          const cos  = Math.cos(arm.angle), sin = Math.sin(arm.angle);
          const y1   = arm.wy + sin * half, y2 = arm.wy - sin * half;
          const topX = y1 >= y2 ? arm.wx + cos * half : arm.wx - cos * half;
          const topY = Math.max(y1, y2);
          if ((bs.x - ps.x) * ps.facing > 0 &&
              bs.y > topY &&
              Math.hypot(bs.x - topX, bs.y - topY) <= armLen) {
            { const sfx = h.onBallInActionRange?.(state, entity.id, entity, ps.actionType); if (sfx) toPlay.push(...sfx); }
            bs.actionRangeCooldown = 15;
          }
        }
      }

      // RECEIVE: actionRange 원 탐지
      if (bs.actionRangeCooldown <= 0 &&
          ps.actionType === 'RECEIVE' && actionDef.actionRange) {
        const { ox, oy, r } = actionDef.actionRange;
        if (Math.hypot(bs.x - (ps.x + ox), bs.y - (ps.y + oy)) <= r) {
          { const sfx = h.onBallInActionRange?.(state, entity.id, entity, 'RECEIVE'); if (sfx) toPlay.push(...sfx); }
          bs.actionRangeCooldown = 15;
        }
      }
    }
  }

  // ─── 헬퍼 ─────────────────────────────────────────────────────────────────

  // BLOCK: 수직 torso 선분 상단을 armLength만큼 위로 연장
  // DIVE:  수직 torso 선분을 수평으로 눕히고 facing 방향으로 armLength만큼 연장
  #extendArm(body, actionType, facing, armLength) {
    if (body.shape !== 'capsule' || armLength <= 0) return body;
    if (Math.abs(Math.cos(body.angle)) > 0.1) return body;  // 수직 캡슐만 처리
    if (actionType === 'BLOCK') {
      return { ...body, wy: body.wy + armLength / 2, length: body.length + armLength };
    }
    if (actionType === 'DIVE') {
      return { ...body, angle: 0, wx: body.wx + facing * armLength / 2, length: body.length + armLength };
    }
    return body;
  }

  #applyAction(es, entity, { action, dvx = 0, dvy = 0 }) {
    const actionDef = entity.actions?.[action];
    if (!actionDef) return;
    es.actionType     = action;
    es.actionTick     = 0;
    es.actionDuration = actionDef.duration;
    es.vx += dvx;
    es.vy += dvy;
  }

  #findByRole(role) {
    for (const entity of this.#entityManager.getAll()) {
      if (entity.role === role) return entity;
    }
    return null;
  }
}
