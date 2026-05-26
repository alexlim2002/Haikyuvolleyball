/**
 * Hitbox.js
 *
 * 액션별 getHitbox(t, facing) → Body[] 순수 함수 모음.
 * 엔티티 등록 시 actions[actionName].getHitbox 에 할당한다.
 *
 * 모든 크기/오프셋은 물리 단위 (1 = 캔버스 가로).
 * 엔티티 원점: 플레이어/네트는 밑바닥 중앙, 공은 중심점.
 *
 * BLOCK/DIVE 의 팔 연장은 엔진(GameLoop)이 armLength 를 이용해 처리한다.
 * SPIKE/SKILL 의 spikeArm 은 isArm:true 태그로 엔진이 액션 범위 기준점을 추출한다.
 */

function lerp(a, b, t) { return a + (b - a) * t; }

const HEAD_R    = 0.0175;
const TORSO_R   = 0.0200;
const TORSO_LEN = 0.0500;
const ARM_R     = 0.0125;
const ARM_LEN   = 0.0350;

function head()  { return { shape: 'circle',  ox: 0, oy: 0.070, r: HEAD_R,  restitution: 0 }; }
function torso() { return { shape: 'capsule', ox: 0, oy: 0.040, length: TORSO_LEN, angle: Math.PI / 2, r: TORSO_R, restitution: 0 }; }

function spikeArm(t, facing) {
  const start = facing > 0 ?  Math.PI * 0.65 : Math.PI * 0.35;
  const end   = facing > 0 ? -Math.PI * 0.10 : Math.PI * 1.10;
  return { shape: 'capsule', ox: facing * 0.015, oy: 0.058, length: ARM_LEN, angle: lerp(start, end, t), r: ARM_R, restitution: 0, isArm: true };
}

export const playerHitboxes = {
  IDLE:    (_t, _f)     => [head(), torso()],
  RUN:     (_t, _f)     => [head(), torso()],
  JUMP:    (_t, _f)     => [head(), torso()],
  SPIKE:   (t,  facing) => [head(), torso(), spikeArm(t, facing)],
  SKILL:   (t,  facing) => [head(), torso(), spikeArm(t, facing)],
  BLOCK:   (_t, _f)     => [head(), torso()],
  DIVE:    (_t, _f)     => [head(), torso()],
  RECEIVE: (_t, _f)     => [head(), torso()],
};
