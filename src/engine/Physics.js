/**
 * Physics.js
 *
 * 물리 계산 유틸리티 모듈.
 * 좌표계: 좌하단 원점, Y축 위 증가, 1 unit = 캔버스 가로.
 *
 * 바디 종류:
 *   circle:  { shape:'circle',  ox, oy, r, restitution }
 *   capsule: { shape:'capsule', ox, oy, length, angle, r, restitution }
 *     - ox, oy: 엔티티 원점 기준 캡슐 중심 오프셋
 *     - angle: 0=오른쪽 수평, PI/2=위 수직 (라디안)
 *     - length: 선분 전체 길이
 *
 * 엔티티 원점:
 *   공        → 중심점
 *   플레이어  → 밑바닥 중앙
 *   네트      → 밑바닥 중앙
 */

// ─── PhysicsMap ───────────────────────────────────────────────────────────────

export class PhysicsMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
  }
}

// ─── 중력 ─────────────────────────────────────────────────────────────────────

/** Y축이 위 방향이므로 중력은 vy를 감소시킨다. */
export function applyGravity(vy, g) {
  return vy - g;
}

// ─── 바디 월드 좌표 변환 ──────────────────────────────────────────────────────

/**
 * 엔티티 원점 좌표 + 바디 오프셋 → wx, wy(월드 좌표)가 추가된 바디 반환.
 * @param {number} ex  엔티티 X (월드)
 * @param {number} ey  엔티티 Y (월드)
 * @param {object} body  바디 정의
 */
export function resolveBody(ex, ey, body) {
  return { ...body, wx: ex + body.ox, wy: ey + body.oy };
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { x: ax + t * dx, y: ay + t * dy };
}

function capsuleEndpoints(cap) {
  const half = cap.length / 2;
  const cos  = Math.cos(cap.angle);
  const sin  = Math.sin(cap.angle);
  return {
    ax: cap.wx + cos * half, ay: cap.wy + sin * half,
    bx: cap.wx - cos * half, by: cap.wy - sin * half,
  };
}

/** 원-원 충돌. 법선 방향: a → b. */
function detectCC(ax, ay, ar, bx, by, br) {
  const dx   = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const minD = ar + br;
  if (dist >= minD || dist === 0) return null;
  return { nx: dx / dist, ny: dy / dist, depth: minD - dist };
}

/** 원-캡슐 충돌. 법선 방향: 원 → 캡슐. */
function detectCCap(cx, cy, cr, cap) {
  const { ax, ay, bx, by } = capsuleEndpoints(cap);
  const closest = closestOnSegment(cx, cy, ax, ay, bx, by);
  return detectCC(cx, cy, cr, closest.x, closest.y, cap.r);
}

// ─── 바디 간 충돌 감지 ────────────────────────────────────────────────────────

/**
 * 두 resolved 바디 간 충돌 감지. 법선 방향: a → b.
 * 지원: circle-circle, circle-capsule, capsule-circle.
 * @returns {{ nx, ny, depth }} | null
 */
export function detectBodies(a, b) {
  if (a.shape === 'circle' && b.shape === 'circle') {
    return detectCC(a.wx, a.wy, a.r, b.wx, b.wy, b.r);
  }
  if (a.shape === 'circle' && b.shape === 'capsule') {
    return detectCCap(a.wx, a.wy, a.r, b);
  }
  if (a.shape === 'capsule' && b.shape === 'circle') {
    const hit = detectCCap(b.wx, b.wy, b.r, a);
    if (!hit) return null;
    return { nx: -hit.nx, ny: -hit.ny, depth: hit.depth };
  }
  return null;
}

/**
 * 공(resolved circle) vs 복합 바디 목록. 가장 깊이 겹친 바디 기준 반환.
 * @param {object}   ball    resolved circle body
 * @param {object[]} bodies  resolved body 배열
 * @returns {{ nx, ny, depth }} | null
 */
export function detectBallVsCompound(ball, bodies) {
  let best = null;
  for (const body of bodies) {
    const hit = detectBodies(ball, body);
    if (hit && (!best || hit.depth > best.depth)) best = hit;
  }
  return best;
}

// ─── 맵 경계 충돌 감지 ───────────────────────────────────────────────────────

/**
 * resolved 바디 vs 맵 경계 충돌 감지.
 * @returns {{ nx, ny, depth, side }[]}
 */
export function detectVsMap(body, map) {
  const hits = [];

  if (body.shape === 'circle') {
    const { wx, wy, r } = body;
    if (wy - r < 0)      hits.push({ nx:  0, ny:  1, depth: r - wy,          side: 'bottom' });
    if (wy + r > map.h)  hits.push({ nx:  0, ny: -1, depth: wy + r - map.h,  side: 'top'    });
    if (wx - r < 0)      hits.push({ nx:  1, ny:  0, depth: r - wx,          side: 'left'   });
    if (wx + r > map.w)  hits.push({ nx: -1, ny:  0, depth: wx + r - map.w,  side: 'right'  });
    return hits;
  }

  if (body.shape === 'capsule') {
    const { ax, ay, bx, by } = capsuleEndpoints(body);
    const r    = body.r;
    const minX = Math.min(ax, bx) - r;
    const maxX = Math.max(ax, bx) + r;
    const minY = Math.min(ay, by) - r;
    const maxY = Math.max(ay, by) + r;
    if (minY < 0)      hits.push({ nx:  0, ny:  1, depth: -minY,          side: 'bottom' });
    if (maxY > map.h)  hits.push({ nx:  0, ny: -1, depth: maxY - map.h,   side: 'top'    });
    if (minX < 0)      hits.push({ nx:  1, ny:  0, depth: -minX,          side: 'left'   });
    if (maxX > map.w)  hits.push({ nx: -1, ny:  0, depth: maxX - map.w,   side: 'right'  });
    return hits;
  }

  return hits;
}

// ─── 충돌 해소 ────────────────────────────────────────────────────────────────

/**
 * 탄성 조합에 따른 충돌 해소. 법선 방향: a → b.
 *
 * 탄성-탄성   (rA>0, rB>0): 둘 다 반사
 * 탄성-비탄성 (rA>0, rB=0): A만 반사. B 속도는 계산 입력으로만 사용.
 * 비탄성-탄성 (rA=0, rB>0): B만 반사. A 속도는 계산 입력으로만 사용.
 * 비탄성-비탄성 (rA=0, rB=0): 둘 다 법선 방향 속도 → 0.
 *
 * 맵 경계 충돌 시: velB={x:0,y:0}, rB=0 으로 호출.
 *
 * @param {{ x, y }} velA
 * @param {number}   rA    restitution of A
 * @param {{ x, y }} velB
 * @param {number}   rB    restitution of B
 * @param {{ nx, ny }} normal
 * @returns {{ newVelA: {x,y}, newVelB: {x,y} }}
 */
export function resolveCollision(velA, rA, velB, rB, { nx, ny }) {
  const relVn = (velA.x - velB.x) * nx + (velA.y - velB.y) * ny;
  if (relVn >= 0) return { newVelA: velA, newVelB: velB }; // 이미 분리 중

  if (rA > 0 && rB > 0) {
    const impulse = -(1 + Math.min(rA, rB)) * relVn / 2;
    return {
      newVelA: { x: velA.x + impulse * nx, y: velA.y + impulse * ny },
      newVelB: { x: velB.x - impulse * nx, y: velB.y - impulse * ny },
    };
  }

  if (rA > 0) {
    return {
      newVelA: { x: velA.x - (1 + rA) * relVn * nx, y: velA.y - (1 + rA) * relVn * ny },
      newVelB: velB,
    };
  }

  if (rB > 0) {
    return {
      newVelA: velA,
      newVelB: { x: velB.x + (1 + rB) * relVn * nx, y: velB.y + (1 + rB) * relVn * ny },
    };
  }

  // 둘 다 비탄성: 법선 방향 속도 → 0
  const vnA = velA.x * nx + velA.y * ny;
  const vnB = velB.x * nx + velB.y * ny;
  return {
    newVelA: { x: velA.x - vnA * nx, y: velA.y - vnA * ny },
    newVelB: { x: velB.x - vnB * nx, y: velB.y - vnB * ny },
  };
}
