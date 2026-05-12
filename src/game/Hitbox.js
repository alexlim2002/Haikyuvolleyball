/**
 * Hitbox.js
 *
 * 캐릭터 물리 바디 정의 및 액션별 자세 업데이트.
 * 모든 크기/오프셋은 물리 단위 (1 = 캔버스 가로).
 * 엔티티 원점: 플레이어 밑바닥 중앙.
 *
 * 기본 바디 (항상 존재): head, torso
 * 액션별 추가 바디:
 *   SPIKE / SKILL → arm (facing 방향으로 스윙)
 *   BLOCK         → arm (머리 위로 펼침)
 *   DIVE          → torso 수평 변형
 *   RECEIVE       → arm (언더핸드 앞쪽)
 */

function lerp(a, b, t) { return a + (b - a) * t; }

// ─── 크기 상수 (800px 캔버스 기준) ───────────────────────────────────────────

const HEAD_R    = 0.0175;  // 14px
const TORSO_R   = 0.0200;  // 16px
const TORSO_LEN = 0.0500;  // 40px
const ARM_R     = 0.0125;  // 10px
const ARM_LEN   = 0.0350;  // 28px

// ─── 기본 바디 팩토리 ─────────────────────────────────────────────────────────

function makeHead() {
  return { shape: 'circle',  ox: 0, oy: -0.070, r: HEAD_R,  restitution: 0 };
}

function makeTorso() {
  return { shape: 'capsule', ox: 0, oy: -0.040, length: TORSO_LEN, angle: Math.PI / 2, r: TORSO_R, restitution: 0 };
}

// ─── 초기화 ───────────────────────────────────────────────────────────────────

/** 플레이어 생성 시 초기 bodies 반환. */
export function initPlayerBodies() {
  return {
    head:  makeHead(),
    torso: makeTorso(),
  };
}

// ─── 액션별 바디 업데이트 ─────────────────────────────────────────────────────

/**
 * 플레이어 action.tick에 따라 bodies를 갱신한다. tick()마다 호출.
 * @param {object} player  { action: { type, tick, duration }, facing, bodies }
 */
export function updatePlayerBodies(player) {
  const { action, facing } = player;
  const t = action.duration > 0 ? action.tick / action.duration : 0;

  // torso는 매 tick 기본값으로 복원 (DIVE에서 변형되므로)
  player.bodies.torso = makeTorso();

  switch (action.type) {

    case 'SPIKE':
    case 'SKILL': {
      // 팔이 위에서 앞으로 스윙
      const start = facing > 0 ?  Math.PI * 0.65 : Math.PI * 0.35;
      const end   = facing > 0 ? -Math.PI * 0.10 : Math.PI * 1.10;
      player.bodies.arm = {
        shape: 'capsule',
        ox: facing * 0.015,
        oy: -0.058,
        length: ARM_LEN,
        angle: lerp(start, end, t),
        r: ARM_R,
        restitution: 0,
      };
      break;
    }

    case 'BLOCK': {
      // 양팔 머리 위로 펼침 (수평 캡슐)
      player.bodies.arm = {
        shape: 'capsule',
        ox: 0,
        oy: -0.090,
        length: ARM_LEN * 1.1,
        angle: 0,
        r: ARM_R,
        restitution: 0,
      };
      break;
    }

    case 'DIVE': {
      // 몸 전체 수평 — torso 방향 변경, arm 제거
      player.bodies.torso = {
        shape: 'capsule',
        ox: 0,
        oy: -0.020,
        length: TORSO_LEN * 1.3,
        angle: facing > 0 ? -Math.PI * 0.12 : Math.PI * (1 + 0.12),
        r: TORSO_R,
        restitution: 0,
      };
      delete player.bodies.arm;
      break;
    }

    case 'RECEIVE': {
      // 언더핸드: 팔을 아래 앞쪽으로
      player.bodies.arm = {
        shape: 'capsule',
        ox: facing * 0.020,
        oy: -0.025,
        length: ARM_LEN,
        angle: facing > 0 ? -Math.PI * 0.35 : -Math.PI * 0.65,
        r: ARM_R,
        restitution: 0,
      };
      break;
    }

    default:
      delete player.bodies.arm;
  }
}
