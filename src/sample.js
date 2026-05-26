/**
 * sample.js — 엔진 통합 샘플 게임 진입점
 *
 * GameBuilder 대신 개별 컴포넌트를 직접 조립하여
 * 게임 루프를 세밀하게 제어한다.
 */

import { Effector }        from './engine/Effector.js';
import { Renderer }        from './engine/Renderer.js';
import { initInputSystem } from './engine/InputSystem.js';
import { EntityManager }   from './engine/EntityManager.js';
import { StateSystem }     from './engine/StateSystem.js';
import { GameLoop }        from './engine/GameLoop.js';
import { physicsMap, initEntities, handlers } from './game/GameLogic.js';
import { generateAssets }  from './game/SpriteGen.js';
import { resolveBody }     from './engine/Physics.js';
import { CharacterSelect } from './game/CharacterSelect.js';

// ─── 키 매핑 ──────────────────────────────────────────────────────────────────
const KEYS = {
  '1P_LEFT':  'ArrowLeft',
  '1P_RIGHT': 'ArrowRight',
  '1P_UP':    'ArrowUp',
  '1P_DOWN':  'ArrowDown',
  '1P_ACTION': 'ShiftRight',
  '2P_LEFT':  'KeyA',
  '2P_RIGHT': 'KeyD',
  '2P_UP':    'KeyW',
  '2P_DOWN':  'KeyS',
  '2P_ACTION': 'ShiftLeft',
};

const TPS     = 60;
const TICK_MS = 1000 / TPS;

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  // 오디오 활성화 (첫 입력 시)
  const effector = new Effector();
  document.addEventListener('keydown',     () => effector.init(), { once: true });
  document.addEventListener('pointerdown', () => effector.init(), { once: true });

  const assets = await generateAssets();
  effector.setAssets(assets);

  const renderer         = new Renderer(canvas, assets);
  const inputsOfThisTick = initInputSystem({ keyboardMapping: KEYS, touchMapping: {} });
  const inputGen         = inputsOfThisTick();

  let phase      = 'select';
  let charSelect = null;
  let stateSystem, gameLoop, entityManager;
  let lastTime   = performance.now();
  let accumulator = 0;

  function startGame(p1Char, p2Char) {
    entityManager = new EntityManager();
    const initialState = initEntities(entityManager, p1Char, p2Char);
    stateSystem = new StateSystem(initialState);
    gameLoop    = new GameLoop({ entityManager, physicsMap, handlers });
    phase = 'game';
  }

  charSelect = new CharacterSelect(assets, (p1Char, p2Char) => {
    startGame(p1Char, p2Char);
  });

  function rafLoop(timestamp) {
    accumulator += Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    while (accumulator >= TICK_MS) {
      accumulator -= TICK_MS;
      const { value: inputs } = inputGen.next();

      if (phase === 'select') {
        charSelect.tick(inputs);
      } else {
        const state = stateSystem.buf;
        if (state.phase !== 'gameover') {
          const { nextState, toPlay } = gameLoop.tick(state, inputs);
          stateSystem.setState(nextState);
          effector.play(toPlay);
        }
      }
    }

    renderer.clear();
    if (phase === 'select') {
      charSelect.draw(ctx);
    } else {
      renderer.draw(stateSystem.buf, entityManager);
      if (window.showHitboxes) drawHitboxes(ctx, stateSystem.buf, entityManager);
      drawHUD(ctx, stateSystem.buf, renderer.width, renderer.height);
    }

    requestAnimationFrame(rafLoop);
  }

  requestAnimationFrame(rafLoop);
}

// ─── 히트박스 디버그 렌더 ────────────────────────────────────────────────────
const LW = 800, LH = 450;

function px(physX)  { return physX * LW; }
function py(physY)  { return LH - physY * LW; }

// GameLoop#extendArm 와 동일한 로직 (시각화용 복사본)
function extendArm(body, actionType, facing, armLength) {
  if (body.shape !== 'capsule' || armLength <= 0) return body;
  if (Math.abs(Math.cos(body.angle)) > 0.1) return body;
  if (actionType === 'BLOCK') {
    return { ...body, wy: body.wy + armLength / 2, length: body.length + armLength };
  }
  if (actionType === 'DIVE') {
    return { ...body, angle: 0, wx: body.wx + facing * armLength / 2, length: body.length + armLength };
  }
  return body;
}

function drawCapsule(ctx, b) {
  const half   = b.length / 2;
  const cos    = Math.cos(b.angle), sin = Math.sin(b.angle);
  const r      = b.r * LW;
  const ax     = px(b.wx + cos * half), ay  = py(b.wy + sin * half);
  const bx     = px(b.wx - cos * half), by_ = py(b.wy - sin * half);
  const cAngle = Math.atan2(by_ - ay, bx - ax);
  const segLen = Math.hypot(bx - ax, by_ - ay);
  ctx.save();
  ctx.translate((ax + bx) / 2, (ay + by_) / 2);
  ctx.rotate(cAngle);
  ctx.beginPath(); ctx.rect(-segLen / 2, -r, segLen, 2 * r); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(ax,  ay,  r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx, by_,  r, 0, Math.PI * 2); ctx.fill();
}

function drawHitboxes(ctx, buf, entityManager) {
  ctx.save();

  for (const entity of entityManager.getAll()) {
    const es = buf[entity.id];
    if (!es || !entity.actions) continue;

    const actionDef = entity.actions[es.actionType] ?? entity.actions.DEFAULT;
    if (!actionDef?.getHitbox) continue;

    const t       = actionDef.duration > 0 ? es.actionTick / actionDef.duration : 0;
    const facing  = es.facing ?? 1;
    const armLen  = entity.armLength ?? 0;
    const bodyDefs = actionDef.getHitbox(t, facing);

    const fill  = entity.role === 'ball'       ? 'rgba(0,255,255,0.35)'
                : entity.role === 'net'        ? 'rgba(255,255,0,0.35)'
                : entity.playerSide === 'left' ? 'rgba(0,255,136,0.35)'
                : 'rgba(255,102,0,0.35)';
    const labelColor = fill.replace('0.35', '1');

    ctx.fillStyle = fill;

    // 히트박스 (BLOCK/DIVE는 연장 적용)
    for (const bodyDef of bodyDefs) {
      const b = extendArm(resolveBody(es.x, es.y, bodyDef), es.actionType, facing, armLen);
      if (b.shape === 'circle') {
        ctx.beginPath(); ctx.arc(px(b.wx), py(b.wy), b.r * LW, 0, Math.PI * 2); ctx.fill();
      } else if (b.shape === 'capsule') {
        drawCapsule(ctx, b);
      }
    }

    // SPIKE/SKILL: arm 상단 끝점 기준 액션 범위 시각화
    if ((es.actionType === 'SPIKE' || es.actionType === 'SKILL') && armLen > 0) {
      const armDef = bodyDefs.find(b => b.isArm);
      if (armDef) {
        const arm  = resolveBody(es.x, es.y, armDef);
        const half = arm.length / 2;
        const cos  = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        const y1   = arm.wy + sin * half, y2 = arm.wy - sin * half;
        const topX = y1 >= y2 ? arm.wx + cos * half : arm.wx - cos * half;
        const topY = Math.max(y1, y2);
        ctx.fillStyle = fill.replace('0.35', '0.15');
        ctx.beginPath(); ctx.arc(px(topX), py(topY), armLen * LW, 0, Math.PI * 2); ctx.fill();
      }
    }

    // RECEIVE: actionRange 원 시각화
    if (es.actionType === 'RECEIVE' && actionDef.actionRange) {
      const { ox, oy, r } = actionDef.actionRange;
      ctx.fillStyle = fill.replace('0.35', '0.15');
      ctx.beginPath(); ctx.arc(px(es.x + ox), py(es.y + oy), r * LW, 0, Math.PI * 2); ctx.fill();
    }

    // 플레이어 레이블
    if (entity.role === 'player') {
      const label = entity.playerSide === 'left' ? '1P' : '2P';
      ctx.fillStyle    = labelColor;
      ctx.font         = 'bold 13px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, px(es.x), py(es.y + 0.13));
    }
  }

  // ── 서브 범위 시각화 (tossed 단계) ────────────────────────────────────────
  if (buf.phase === 'serve' && buf.serveStep === 'tossed') {
    const ss = buf[buf.server];
    if (ss) {
      const ARM    = 35;           // ARM_LEN in pixels (35/800 * 800)
      const PSH    = 80;           // P_SIZE.h in pixels
      const facDir = buf.serverSide === 'left' ? 1 : -1;
      const spx    = px(ss.x);
      const footPY = py(ss.y);                  // 발 y
      const headPY = py(ss.y + 80 / LW);        // 정수리 y

      // 오버핸드 범위 (노란색): x=앞쪽 ARM_LEN, y=정수리~정수리+ARM_LEN
      const ovX    = facDir === 1 ? spx : spx - ARM;
      const ovTopY = headPY - ARM;   // canvas: 정수리에서 ARM_LEN 위
      ctx.fillStyle   = 'rgba(255,220,0,0.20)';
      ctx.strokeStyle = 'rgba(255,220,0,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(ovX, ovTopY, ARM, ARM);
      ctx.strokeRect(ovX, ovTopY, ARM, ARM);
      ctx.fillStyle = 'rgba(255,220,0,0.9)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('오버핸드', ovX + ARM / 2, ovTopY - 2);

      // 언더핸드 범위 (하늘색): x=앞쪽 ARM_LEN, y=정수리~발 (직사각형)
      const unX = facDir === 1 ? spx : spx - ARM;
      ctx.fillStyle   = 'rgba(80,200,255,0.20)';
      ctx.strokeStyle = 'rgba(80,200,255,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(unX, headPY, ARM, footPY - headPY);
      ctx.strokeRect(unX, headPY, ARM, footPY - headPY);
      ctx.fillStyle = 'rgba(80,200,255,0.9)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('언더핸드', unX + ARM / 2, footPY - 2);
    }
  }

  ctx.restore();
}

// ─── HUD (캔버스 직접 렌더) ───────────────────────────────────────────────────
function drawHUD(ctx, state, W, H) {
  // 점수
  ctx.fillStyle    = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W / 2 - 80, 4, 160, 46);
  ctx.fillStyle    = '#fff';
  ctx.font         = 'bold 30px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${state.score.p1}  :  ${state.score.p2}`, W / 2, 8);
  ctx.font = '13px monospace';
  ctx.fillText(`세트  ${state.sets.p1} - ${state.sets.p2}`, W / 2, 38);

  // 조작 안내
  ctx.font         = '11px monospace';
  ctx.textAlign    = 'left';
  ctx.fillStyle    = 'rgba(255,255,255,0.65)';
  ctx.fillText('1P: ←→이동 / ↑점프 / ↓리시브 / Shift스파이크 / ←←or→→다이빙 / ↑↑블로킹 / ↓↓스킬  |  2P: WASD / ShiftLeft', 8, H - 18);

  // 서브 오버레이
  if (state.phase === 'serve') {
    const who  = state.server === 'player1' ? '1P' : '2P';
    const key  = state.server === 'player1' ? 'ShiftRight' : 'ShiftLeft';
    const step = state.serveStep === 'ready' ? `${key}: 토스` : `${key}: 서브`;
    ctx.fillStyle    = 'rgba(0,0,0,0.28)';
    ctx.fillRect(W / 2 - 160, H / 2 - 30, 320, 54);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 20px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${who} 서브 — ${step}`, W / 2, H / 2);
  }

  // 득점 오버레이
  if (state.phase === 'point') {
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 52px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('득점!', W / 2, H / 2);
  }

  // 게임오버 오버레이
  if (state.phase === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(0, 0, W, H);
    const winner = state.sets.p1 > state.sets.p2 ? '1P' : '2P';
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 52px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${winner} 승리!`, W / 2, H / 2 - 24);
    ctx.font = '24px monospace';
    ctx.fillText(`${state.sets.p1} - ${state.sets.p2}`, W / 2, H / 2 + 30);
  }
}

window.showHitboxes = false;
window.noScore = false;
main();
