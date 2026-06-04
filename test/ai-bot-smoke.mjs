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
    player1: { x: 0.25, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
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

// 1. 낮고 빠르게 떨어지는 공은 Shift가 아니라 리시브/긴급 수비로 처리한다.
{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.74 }),
    ball: { x: 0.72, y: 0.09, vx: 0.004, vy: -0.010, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'low fast ball must not trigger ground Shift');
  assert.equal(inputs['2P_DOWN'] || inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], true, 'low fast ball should be saved by receive/dive');
}

// 2. 공이 상대 코트에 있으면 다이브하지 않는다.
{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.88 }),
    ball: { x: 0.30, y: 0.08, vx: 0, vy: -0.004, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'opponent-court ball must not trigger dive');
}

// 3. 자기 코트라도 이동으로 받을 수 있으면 다이브하지 않는다.
{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.76 }),
    ball: { x: 0.70, y: 0.16, vx: 0, vy: -0.002, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'reachable ball should prefer walking/receive over dive');
}

// 3-1. 상대 점프 서브 직후 공이 상대 코트에 있으면 다이브하지 않고 낙하지점으로 이동한다.
{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    server: 'player1',
    player1: { x: 0.38, y: 0.1, vx: 0, vy: 0, facing: 1, onGround: false, actionType: 'JUMP', actionTick: 5, actionDuration: 0, stamina: 120 },
    player2: player({ x: 0.82 }),
    ball: { x: 0.42, y: 0.28, vx: 0.012, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'opponent jump serve on opponent court must not trigger dive');
  assert.equal(inputs['2P_LEFT'] || inputs['2P_RIGHT'], true, 'opponent jump serve should make bot reposition first');
}

// 3-2. 빠른 상대 서브가 자기 코트로 넘어오면 다이브보다 RECEIVE를 우선한다.
{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    server: 'player1',
    player1: { x: 0.38, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, actionType: 'SERVE_HIT', actionTick: 1, actionDuration: 8, stamina: 120 },
    player2: player({ x: 0.72 }),
    ball: { x: 0.70, y: 0.16, vx: 0.014, vy: -0.006, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], true, 'fast incoming serve should trigger stable RECEIVE');
  assert.equal(inputs['2P_DOUBLE_LEFT'] || inputs['2P_DOUBLE_RIGHT'], false, 'fast incoming serve should not immediately dive');
  assert.equal(ai.getDebugInfo().selectedAction, 'SERVE_RECEIVE', 'debug should mark serve receive decision');
}

// 4. 높은 자기 코트 공에서 지상 상태면 Shift가 아니라 점프/접근을 먼저 한다.
{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.565, onGround: true, actionType: 'IDLE' }),
    ball: { x: 0.53, y: 0.27, vx: 0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'grounded bot must not mash Shift for high balls');
  assert.equal(inputs['2P_UP'] || inputs['2P_LEFT'] || inputs['2P_RIGHT'] || inputs['2P_DOUBLE_UP'], true, 'grounded high ball should cause setup movement/jump/block, not spike');
}

// 5. 공중이고 높이/거리/방향이 맞을 때만 스파이크한다.
{
  const ai = bot('aggressive');
  const hitInputs = ai.makeInputs(baseState({
    player2: player({ x: 0.565, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP', actionTick: 8 }),
    ball: { x: 0.53, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(hitInputs['2P_ACTION'], true, 'airborne aligned attack window should trigger spike');

  const badInputs = bot('aggressive').makeInputs(baseState({
    player2: player({ x: 0.565, y: 0.16, onGround: false, facing: 1, actionType: 'JUMP', actionTick: 8 }),
    ball: { x: 0.53, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(badInputs['2P_ACTION'], false, 'wrong facing should suppress spike');
}

// 6. 같은 공에 대한 Shift 재입력은 긴 cooldown으로 억제된다.
{
  const ai = bot('aggressive');
  const state = baseState({
    player2: player({ x: 0.565, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP', actionTick: 8 }),
    ball: { x: 0.53, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  });
  const first = ai.makeInputs(state);
  const second = ai.makeInputs(state);
  assert.equal(first['2P_ACTION'], true, 'first valid airborne spike should be allowed');
  assert.equal(second['2P_ACTION'], false, 'next tick spike should be suppressed by cooldown/recovery');
}

// 7. 리시브 반복 후에는 무한 리시브 대신 네트 방향 setup으로 전환한다.
{
  const ai = bot('rally', { maxStamina: 120 });
  const state = baseState({
    player2: player({ x: 0.74, stamina: 16 }),
    ball: { x: 0.72, y: 0.10, vx: 0, vy: -0.002, actionRangeCooldown: 0 },
  });
  let receiveCount = 0;
  let faceOrSetupCount = 0;
  for (let tick = 0; tick < 40; tick++) {
    const inputs = ai.makeInputs(state);
    const action = ai.getDebugInfo().selectedAction;
    if (action === 'RECEIVE') receiveCount++;
    if (inputs['2P_LEFT'] && !inputs['2P_DOWN']) faceOrSetupCount++;
    state.ball.y = tick < 8 ? 0.10 : 0.14;
  }
  assert.ok(receiveCount >= 1, 'bot should still save the initial low ball');
  assert.ok(faceOrSetupCount >= 1, 'bot should eventually face/setup toward the net instead of receiving forever');
}

// 7-1. 리시브 직후 공이 뜨면 follow-up plan을 유지하고 접근/점프를 선택한다.
{
  const ai = bot('rally', { maxStamina: 120 });
  const state = baseState({
    player2: player({ x: 0.74, stamina: 120 }),
    ball: { x: 0.72, y: 0.09, vx: 0, vy: -0.002, actionRangeCooldown: 0 },
  });
  const receiveInputs = ai.makeInputs(state);
  assert.equal(receiveInputs['2P_DOWN'], true, 'first low ball should be received');
  state.ball = { x: 0.70, y: 0.22, vx: 0, vy: 0.004, actionRangeCooldown: 0 };
  const followInputs = ai.makeInputs(state);
  const debug = ai.getDebugInfo();
  assert.equal(followInputs['2P_ACTION'], false, 'grounded follow-up must not Shift immediately');
  assert.ok(
    ['APPROACH_ATTACK', 'FOLLOW_UP_JUMP_ATTACK', 'SAFE_SEND_OVER', 'SEND_OVER_JUMP', 'JUMP'].includes(debug.selectedAction) ||
      followInputs['2P_LEFT'] ||
      followInputs['2P_UP'],
    'received high ball should produce a follow-up approach/jump/send-over plan',
  );
  assert.ok(debug.plannedFollowUpAction, 'debug should expose a planned follow-up action');
}

// 8. 낮은 stamina에서는 Spike/Dive 남발이 억제된다.
{
  const ai = bot('aggressive', { maxStamina: 120 });
  const inputs = ai.makeInputs(baseState({
    player2: player({ x: 0.565, y: 0.16, onGround: false, facing: -1, actionType: 'JUMP', stamina: 20 }),
    ball: { x: 0.53, y: 0.26, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'low stamina should suppress spike');

  const diveInputs = bot('defensive', { maxStamina: 120 }).makeInputs(baseState({
    player2: player({ x: 0.92, stamina: 25 }),
    ball: { x: 0.66, y: 0.075, vx: 0, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(diveInputs['2P_DOUBLE_LEFT'] || diveInputs['2P_DOUBLE_RIGHT'], false, 'low stamina should suppress non-critical dive');
}

// 8-1. low stamina + repeated receive에서는 receive suppression 후 네트 방향 follow-up을 고른다.
{
  const ai = bot('defensive', { maxStamina: 120 });
  const state = baseState({
    player2: player({ x: 0.74, stamina: 14 }),
    ball: { x: 0.72, y: 0.09, vx: 0, vy: -0.002, actionRangeCooldown: 0 },
  });
  let receiveCount = 0;
  let suppressedFollowUp = false;
  for (let tick = 0; tick < 42; tick++) {
    const inputs = ai.makeInputs(state);
    const debug = ai.getDebugInfo();
    if (inputs['2P_DOWN']) receiveCount++;
    if (!inputs['2P_DOWN'] && (inputs['2P_LEFT'] || debug.selectedAction === 'SAFE_SEND_OVER')) {
      suppressedFollowUp = true;
    }
    state.ball.y = tick < 3 ? 0.09 : 0.145;
  }
  assert.ok(receiveCount >= 1, 'low stamina bot should still save the first emergency ball');
  assert.equal(suppressedFollowUp, true, 'low stamina repeated receive should be suppressed into follow-up movement');
}

// 9. UNDERHAND 서브는 toss 후 wait-fall/hit 순서를 따른다.
{
  const ai = bot('aggressive', { serveTypes: ['UNDERHAND'] });
  const ready = baseState({
    phase: 'serve', serveStep: 'ready', server: 'player2', serverSide: 'right',
    player2: player({ x: 0.75, actionType: 'SERVE' }),
    ball: { x: 0.7125, y: 0.10, vx: 0, vy: 0, actionRangeCooldown: 0 },
  });
  assert.equal(ai.makeInputs(ready)['2P_ACTION'], true, 'underhand serve starts with one toss action');
  const tossed = { ...ready, serveStep: 'tossed', ball: { x: 0.7125, y: 0.18, vx: 0, vy: 0.010, actionRangeCooldown: 0 } };
  assert.equal(ai.makeInputs(tossed)['2P_ACTION'], false, 'underhand serve should wait while ball is rising');
  let hit = false;
  for (let tick = 0; tick < 24; tick++) {
    tossed.ball = { x: 0.7125, y: 0.09, vx: 0, vy: -0.002, actionRangeCooldown: 0 };
    hit ||= ai.makeInputs(tossed)['2P_ACTION'];
  }
  assert.equal(hit, true, 'underhand serve should hit after wait-fall window');
  assert.equal(ai.makeInputs(tossed)['2P_ACTION'], false, 'underhand serve should not keep mashing Shift after hit');
}

// 10. 점프 서브 캐릭터는 tossed 직후 즉시 Shift를 누르지 않는다.
{
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  const inputs = ai.makeInputs(baseState({
    phase: 'serve', serveStep: 'tossed', server: 'player2', serverSide: 'right', serveTossY: 0.46,
    player2: player({ x: 0.92, y: 0.03, onGround: false, actionType: 'JUMP', actionTick: 2 }),
    ball: { x: 0.8825, y: 0.13, vx: 0, vy: 0.014, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'jump serve should not hit immediately at low early toss point');
}

// 10-1. 점프 서브는 toss 후 충분히 기다린 뒤 낙하 구간에서 점프한다.
{
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  const state = baseState({
    phase: 'serve', serveStep: 'tossed', server: 'player2', serverSide: 'right', serveTossY: 0.46,
    player2: player({ x: 0.92, y: 0, onGround: true, actionType: 'SERVE' }),
    ball: { x: 0.8825, y: 0.24, vx: 0, vy: 0.006, actionRangeCooldown: 0 },
  });
  for (let tick = 0; tick < 28; tick++) {
    const early = ai.makeInputs(state);
    assert.equal(early['2P_UP'] || early['2P_ACTION'], false, 'jump serve should wait through early toss ticks');
  }
  state.ball = { x: 0.8825, y: 0.30, vx: 0, vy: -0.002, actionRangeCooldown: 0 };
  let jumped = false;
  for (let tick = 0; tick < 16; tick++) {
    jumped ||= ai.makeInputs(state)['2P_UP'];
  }
  assert.equal(jumped, true, 'jump serve should jump after delay when ball is falling/high enough');
}

// 11. 180tick 이상 GameLoop 연동 및 부분 state 방어.
{
  const ai = bot('rally');
  assert.doesNotThrow(() => ai.makeInputs({ phase: 'rally' }), 'missing partial state should not crash');

  const entityManager = new EntityManager();
  let state = initEntities(entityManager, { serveTypes: ['UNDERHAND'] }, { id: 'kageyama', serveTypes: ['JUMP', 'OVERHAND'], stats: { speed: '중', power: '중', physique: '중', stamina: '중' } });
  state.server = 'player2';
  state.serverSide = 'right';
  state.phase = 'serve';
  state.serveStep = 'ready';
  state.player2.x = 0.92;
  state.ball.x = 0.8825;
  state.ball.y = 0.1;
  state.ball.vx = 0;
  state.ball.vy = 0;
  const loop = new GameLoop({ entityManager, physicsMap, handlers });
  const serveAi = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  let jumpServeHitTick = null;
  for (let tick = 0; tick < 220; tick++) {
    const inputs = serveAi.makeInputs(state);
    const selectedAction = serveAi.getDebugInfo().selectedAction;
    if (selectedAction === 'JUMP_SERVE_HIT') jumpServeHitTick = tick;
    const result = loop.tick(state, inputs);
    state = result.nextState;
    if (state.phase === 'rally') break;
  }
  assert.ok(state.player2 && state.ball, 'GameLoop + BotController simulation should keep state valid');
  assert.ok(jumpServeHitTick === null || jumpServeHitTick >= 24, 'jump serve should include a reaction/wait window before hit');
}
