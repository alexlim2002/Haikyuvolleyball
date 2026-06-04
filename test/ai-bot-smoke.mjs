import assert from 'node:assert/strict';
import { createBotController } from '../src/game/ai/BotController.js';
import { EntityManager } from '../src/engine/EntityManager.js';
import { GameLoop } from '../src/engine/GameLoop.js';
import { physicsMap, initEntities, handlers } from '../src/game/GameLogic.js';

globalThis.window = globalThis.window ?? { noScore: true };
globalThis.window.noScore = true;

function player(overrides = {}) {
  return {
    x: 0.75,
    y: 0,
    vx: 0,
    vy: 0,
    facing: -1,
    onGround: true,
    actionType: 'IDLE',
    actionTick: 0,
    actionDuration: 0,
    stamina: 120,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    net: { x: 0.5, y: 0, vx: 0, vy: 0 },
    player1: player({ x: 0.25, facing: 1 }),
    player2: player(),
    ball: { x: 0.75, y: 0.25, vx: 0, vy: 0, actionRangeCooldown: 0 },
    phase: 'rally',
    score: { p1: 0, p2: 0 },
    sets: { p1: 0, p2: 0 },
    ...overrides,
  };
}

function bot(profile = 'rally', extra = {}) {
  return createBotController({
    playerId: 'player2',
    playerSide: 'right',
    opponentId: 'player1',
    mapWidth: physicsMap.w,
    profile,
    ...extra,
  });
}

// 1. 공이 상대 코트에 있으면 Dive/Shift가 나오지 않는다.
{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.84 }),
    ball: { x: 0.30, y: 0.07, vx: -0.002, vy: -0.004, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'opponent-court ball must not trigger Shift');
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'opponent-court ball must not trigger Dive');
}

// 2. 상대 점프 서브 직후 바로 Dive하지 않는다.
{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    server: 'player1',
    player1: player({ x: 0.38, y: 0.12, facing: 1, onGround: false, actionType: 'JUMP' }),
    player2: player({ x: 0.82 }),
    ball: { x: 0.43, y: 0.28, vx: 0.012, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'opponent jump serve should not cause panic dive');
  assert.equal(inputs['2P_ACTION'], false, 'opponent jump serve should not cause Shift');
  assert.equal(inputs['2P_LEFT'] || inputs['2P_RIGHT'], true, 'bot should reposition first');
}

// 3. 빠른 서브가 자기 코트로 오면 이동 또는 Receive를 우선한다.
{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    server: 'player1',
    player1: player({ x: 0.38, facing: 1, actionType: 'SERVE_HIT' }),
    player2: player({ x: 0.73 }),
    ball: { x: 0.70, y: 0.14, vx: 0.014, vy: -0.005, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'fast serve should prefer receive/positioning over dive');
  assert.equal(inputs['2P_DOWN'] || inputs['2P_LEFT'] || inputs['2P_RIGHT'], true, 'fast serve should produce stable receive or positioning');
}

// 4. 바닥 상태에서는 일반 Shift가 나오지 않는다.
{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.56, onGround: true, facing: -1 }),
    ball: { x: 0.54, y: 0.28, vx: 0, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'grounded bot must not Shift for rally attack');
  assert.equal(inputs['2P_UP'] || inputs['2P_LEFT'] || inputs['2P_RIGHT'], true, 'grounded high ball should be approached or jumped for');
}

// 5. 리시브 후 follow-up 상태가 생긴다.
{
  const ai = bot('rally', { maxStamina: 120 });
  const state = baseState({
    player2: player({ x: 0.73, stamina: 120 }),
    ball: { x: 0.72, y: 0.08, vx: 0, vy: -0.003, actionRangeCooldown: 0 },
  });
  const receive = ai.makeInputs(state);
  assert.equal(receive['2P_DOWN'], true, 'first low own-court ball should be received');
  assert.equal(ai.getDebugInfo().currentPlan, 'RECEIVE');
  state.ball = { x: 0.70, y: 0.23, vx: 0, vy: 0.003, actionRangeCooldown: 0 };
  const follow = ai.makeInputs(state);
  assert.equal(follow['2P_ACTION'], false, 'follow-up on ground must not Shift immediately');
  assert.ok(['RECOVER_AFTER_RECEIVE', 'ATTACK_PREPARE', 'JUMP_ATTACK'].includes(ai.getDebugInfo().currentPlan), 'received high ball should keep a follow-up plan');
}

// 6. follow-up 중 player가 바닥이면 Shift가 아니라 이동/Jump가 먼저 나온다.
{
  const ai = bot('aggressive', { maxStamina: 120 });
  ai.makeInputs(baseState({ player2: player({ x: 0.70 }), ball: { x: 0.70, y: 0.08, vx: 0, vy: -0.003, actionRangeCooldown: 0 } }));
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.58, onGround: true, facing: -1 }),
    ball: { x: 0.55, y: 0.25, vx: 0, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'grounded follow-up must not Shift');
  assert.equal(inputs['2P_UP'] || inputs['2P_LEFT'] || inputs['2P_RIGHT'], true, 'grounded follow-up should move or jump first');
}

// 7. player가 공중이고 높이/거리 조건이 맞을 때만 Shift가 나온다.
{
  const ai = bot('aggressive', { maxStamina: 120 });
  const hit = ai.makeInputs(baseState({
    player2: player({ x: 0.56, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP' }),
    ball: { x: 0.54, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(hit['2P_ACTION'], true, 'airborne aligned attack window should Shift');

  const far = bot('aggressive', { maxStamina: 120 }).makeInputs(baseState({
    player2: player({ x: 0.68, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP' }),
    ball: { x: 0.54, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(far['2P_ACTION'], false, 'far airborne ball should not Shift');
}

// 8. low stamina에서는 Shift/Dive가 억제된다.
{
  const spike = bot('aggressive', { maxStamina: 120 }).makeInputs(baseState({
    player2: player({ x: 0.56, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP', stamina: 20 }),
    ball: { x: 0.54, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(spike['2P_ACTION'], false, 'low stamina should suppress Shift');

  const dive = bot('defensive', { maxStamina: 120 }).makeInputs(baseState({
    player2: player({ x: 0.90, stamina: 20 }),
    ball: { x: 0.64, y: 0.05, vx: 0, vy: -0.004, actionRangeCooldown: 0 },
  }));
  assert.equal(dive['2P_DOUBLE_LEFT'] || dive['2P_DOUBLE_RIGHT'], false, 'low stamina should suppress Dive');
}

// 9. low stamina에서 receive 무한 반복이 억제된다.
{
  const ai = bot('defensive', { maxStamina: 120 });
  const state = baseState({
    player2: player({ x: 0.73, stamina: 16 }),
    ball: { x: 0.72, y: 0.09, vx: 0, vy: -0.003, actionRangeCooldown: 0 },
  });
  let receiveCount = 0;
  let nonReceiveCount = 0;
  for (let tick = 0; tick < 45; tick++) {
    const inputs = ai.makeInputs(state);
    if (inputs['2P_DOWN']) receiveCount += 1;
    else nonReceiveCount += 1;
    state.ball.y = tick < 4 ? 0.09 : 0.13;
  }
  assert.ok(receiveCount >= 1, 'bot should still save the initial low ball');
  assert.ok(nonReceiveCount > receiveCount, 'low stamina repeated receive should be suppressed rather than loop forever');
}

// 10. UNDERHAND serve는 toss 후 wait/hit 흐름을 따른다.
{
  const ai = bot('aggressive', { serveTypes: ['UNDERHAND'] });
  const ready = baseState({
    phase: 'serve', serveStep: 'ready', server: 'player2', serverSide: 'right',
    player2: player({ x: 0.92, actionType: 'SERVE' }),
    ball: { x: 0.8825, y: 0.10, vx: 0, vy: 0, actionRangeCooldown: 0 },
  });
  let tossed = false;
  for (let tick = 0; tick < 10; tick++) tossed ||= ai.makeInputs(ready)['2P_ACTION'];
  assert.equal(tossed, true, 'underhand serve should start with one toss action');

  const state = { ...ready, serveStep: 'tossed', ball: { x: 0.8825, y: 0.18, vx: 0, vy: 0.010, actionRangeCooldown: 0 } };
  assert.equal(ai.makeInputs(state)['2P_ACTION'], false, 'underhand serve should wait while ball is rising');
  let hit = false;
  for (let tick = 0; tick < 36; tick++) {
    state.ball = { x: 0.8825, y: 0.07, vx: 0, vy: -0.002, actionRangeCooldown: 0 };
    hit ||= ai.makeInputs(state)['2P_ACTION'];
  }
  assert.equal(hit, true, 'underhand serve should wait longer and hit at a lower underhand point');
  assert.equal(ai.makeInputs(state)['2P_ACTION'], false, 'underhand serve should not keep mashing Shift after hit');
}

// 11. JUMP serve는 toss 직후 바로 Shift하지 않고 충분히 기다린다.
{
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'], maxStamina: 120 });
  const state = baseState({
    phase: 'serve', serveStep: 'tossed', server: 'player2', serverSide: 'right', serveTossY: 0.46,
    player2: player({ x: 0.92, onGround: true, actionType: 'SERVE', stamina: 120 }),
    ball: { x: 0.8825, y: 0.24, vx: 0, vy: 0.006, actionRangeCooldown: 0 },
  });
  for (let tick = 0; tick < 34; tick++) {
    const early = ai.makeInputs(state);
    assert.equal(early['2P_ACTION'] || early['2P_UP'], false, 'jump serve should wait through early toss ticks');
  }
  state.ball = { x: 0.8825, y: 0.30, vx: 0, vy: -0.002, actionRangeCooldown: 0 };
  let jumped = false;
  for (let tick = 0; tick < 18; tick++) jumped ||= ai.makeInputs(state)['2P_UP'];
  assert.equal(jumped, true, 'jump serve should jump only after delay and falling/high ball');
}

// 12~13. 180tick 이상 GameLoop 연동 및 부분 state 방어.
{
  const ai = bot('rally');
  assert.doesNotThrow(() => ai.makeInputs({ phase: 'rally' }), 'missing partial state should not crash');

  const entityManager = new EntityManager();
  let state = initEntities(
    entityManager,
    { serveTypes: ['UNDERHAND'], stats: { speed: '중', power: '중', physique: '중', stamina: '중' } },
    { id: 'kageyama', serveTypes: ['JUMP', 'OVERHAND'], stats: { speed: '중', power: '중', physique: '중', stamina: '중' } },
  );
  state.server = 'player2';
  state.serverSide = 'right';
  state.phase = 'serve';
  state.serveStep = 'ready';
  const loop = new GameLoop({ entityManager, physicsMap, handlers });
  const serveAi = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'], maxStamina: state.player2.stamina });
  for (let tick = 0; tick < 190; tick++) {
    const result = loop.tick(state, serveAi.makeInputs(state));
    state = result.nextState;
    assert.ok(state.player2 && state.ball, 'GameLoop + BotController should keep state valid');
  }
}


// 14. 플레이어 점프 서브는 예상 낙하지점으로 미리 이동하고 낮아지면 Receive를 최우선 수행한다.
{
  const ai = bot('rally', { maxStamina: 120 });
  const early = ai.makeInputs(baseState({
    server: 'player1',
    player1: player({ x: 0.36, y: 0.14, facing: 1, onGround: false, actionType: 'JUMP' }),
    player2: player({ x: 0.84, stamina: 120 }),
    ball: { x: 0.42, y: 0.30, vx: 0.012, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(early['2P_DOUBLE_LEFT'] || early['2P_DOUBLE_RIGHT'], false, 'early jump serve should not dive before landing is urgent');
  assert.equal(early['2P_LEFT'] || early['2P_RIGHT'], true, 'early jump serve should move toward predicted landing/intercept');
  assert.equal(ai.getDebugInfo().currentPlan, 'RECEIVE');

  const receive = ai.makeInputs(baseState({
    server: 'player1',
    player1: player({ x: 0.36, facing: 1, actionType: 'SERVE_HIT' }),
    player2: player({ x: 0.70, stamina: 120 }),
    ball: { x: 0.69, y: 0.13, vx: 0.013, vy: -0.006, actionRangeCooldown: 0 },
  }));
  assert.equal(receive['2P_DOWN'], true, 'when player serve is catchable, Receive must be the highest-priority save');
  assert.equal(receive['2P_ACTION'], false, 'serve receive must not be replaced by Shift');
}

// 15. 예상 낙하지점에 시간상 도달하기 어려운 낮은 서브는 마지막 수단으로 Dive한다.
{
  const ai = bot('defensive', { maxStamina: 120 });
  const inputs = ai.makeInputs(baseState({
    server: 'player1',
    player1: player({ x: 0.37, facing: 1, actionType: 'SERVE_HIT' }),
    player2: player({ x: 0.90, stamina: 120 }),
    ball: { x: 0.66, y: 0.055, vx: 0.008, vy: -0.006, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], false, 'unreachable low serve should not pretend to receive in place');
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], true, 'unreachable low serve should trigger emergency dive');
}

// 16. UNDERHAND-only 봇 서브는 GameLoop에서 실제 rally 전환까지 수행된다.
{
  const entityManager = new EntityManager();
  let state = initEntities(
    entityManager,
    { serveTypes: ['UNDERHAND'], stats: { speed: '중', power: '중', physique: '중', stamina: '중' } },
    { id: 'hinata', serveTypes: ['UNDERHAND'], stats: { speed: '중', power: '중', physique: '중', stamina: '중' } },
  );
  state.server = 'player2';
  state.serverSide = 'right';
  state.phase = 'serve';
  state.serveStep = 'ready';
  const loop = new GameLoop({ entityManager, physicsMap, handlers });
  const underhandAi = bot('aggressive', { serveTypes: ['UNDERHAND'], maxStamina: state.player2.stamina });
  let reachedRally = false;
  for (let tick = 0; tick < 130; tick++) {
    const result = loop.tick(state, underhandAi.makeInputs(state));
    state = result.nextState;
    if (state.phase === 'rally') {
      reachedRally = true;
      break;
    }
  }
  assert.equal(reachedRally, true, 'UNDERHAND-only bot should complete serve and enter rally');
}


// 17. UNDERHAND 서브는 너무 높은 타점에서 바로 치지 않고 더 낮은 타점까지 기다린다.
{
  const ai = bot('aggressive', { serveTypes: ['UNDERHAND'] });
  const ready = baseState({
    phase: 'serve', serveStep: 'ready', server: 'player2', serverSide: 'right',
    player2: player({ x: 0.92, actionType: 'SERVE' }),
    ball: { x: 0.8825, y: 0.10, vx: 0, vy: 0, actionRangeCooldown: 0 },
  });
  for (let tick = 0; tick < 3; tick++) ai.makeInputs(ready);
  const highToss = { ...ready, serveStep: 'tossed', ball: { x: 0.8825, y: 0.09, vx: 0, vy: -0.002, actionRangeCooldown: 0 } };
  for (let tick = 0; tick < 38; tick++) {
    assert.equal(ai.makeInputs(highToss)['2P_ACTION'], false, 'underhand serve should not hit while the tossed ball is still too high');
  }
  highToss.ball = { x: 0.8825, y: 0.065, vx: 0, vy: -0.002, actionRangeCooldown: 0 };
  let lowHit = false;
  for (let tick = 0; tick < 8; tick++) lowHit ||= ai.makeInputs(highToss)['2P_ACTION'];
  assert.equal(lowHit, true, 'underhand serve should hit after the ball falls to a lower point');
}

// 18. 너무 빠른 자기 코트 공은 공격보다 Receive로 속도를 줄인다.
{
  const ai = bot('aggressive', { maxStamina: 120 });
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.66, onGround: true, facing: -1, stamina: 120 }),
    ball: { x: 0.65, y: 0.21, vx: -0.017, vy: -0.004, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], true, 'very fast own-court ball should use Receive to slow/stabilize play');
  assert.equal(inputs['2P_ACTION'], false, 'fast-ball stabilization should not be Shift');
}
