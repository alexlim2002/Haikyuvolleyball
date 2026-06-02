import assert from 'node:assert/strict';
import { createBotController } from '../src/game/ai/BotController.js';
import { EntityManager } from '../src/engine/EntityManager.js';
import { GameLoop } from '../src/engine/GameLoop.js';
import { physicsMap, initEntities, handlers } from '../src/game/GameLogic.js';

globalThis.window = globalThis.window ?? { noScore: true };
globalThis.window.noScore = true;

function baseState(overrides = {}) {
  return {
    net: { x: 0.5, y: 0, vx: 0, vy: 0 },
    player1: { x: 0.25, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    player2: { x: 0.75, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
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

{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({ ball: { x: 0.75, y: 0.10, vx: 0, vy: -0.004, actionRangeCooldown: 0 } }));
  assert.equal(inputs['2P_DOWN'], true, 'low close ball should trigger RECEIVE');
}

{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.88, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.72, y: 0.075, vx: 0, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'], true, 'far low ball should trigger left DIVE');
}

{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.565, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    player1: { x: 0.46, y: 0, vx: 0, vy: 0.002, facing: 1, onGround: false, actionType: 'JUMP', actionTick: 5, actionDuration: 0, stamina: 120 },
    ball: { x: 0.52, y: 0.28, vx: 0.002, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'aggressive high net threat should prioritize SPIKE when attackable');
}


{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.565, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    player1: { x: 0.46, y: 0, vx: 0, vy: 0.002, facing: 1, onGround: false, actionType: 'JUMP', actionTick: 5, actionDuration: 0, stamina: 120 },
    ball: { x: 0.52, y: 0.28, vx: 0.002, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_UP'], true, 'rally high net threat should still trigger BLOCK');
}

{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.74, y: 0.06, vx: 0, vy: 0, facing: -1, onGround: false, actionType: 'JUMP', actionTick: 8, actionDuration: 0, stamina: 120 },
    ball: { x: 0.68, y: 0.24, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'front high attackable ball should trigger SPIKE');
}

{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.92, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.30, y: 0.25, vx: -0.001, vy: 0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_LEFT'], true, 'opponent-court ball should make bot return to defensive home');
}

{
  const ai = bot('aggressive', { serveTypes: ['JUMP', 'OVERHAND'] });
  const inputs = ai.makeInputs(baseState({
    phase: 'serve',
    serveStep: 'ready',
    server: 'player2',
    serverSide: 'right',
    ball: { x: 0.7125, y: 0.10, vx: 0, vy: 0, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'bot serve should start with toss ACTION');
}

{
  const ai = bot('aggressive', { serveTypes: ['JUMP', 'OVERHAND'] });
  const inputs = ai.makeInputs(baseState({
    phase: 'serve',
    serveStep: 'tossed',
    server: 'player2',
    serverSide: 'right',
    ball: { x: 0.7125, y: 0.125, vx: 0, vy: 0.01, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_UP'], true, 'jump-serve-capable bot should jump after toss');
}

{
  const ai = bot('aggressive', { serveTypes: ['JUMP', 'OVERHAND'] });
  const inputs = ai.makeInputs(baseState({
    phase: 'serve',
    serveStep: 'tossed',
    server: 'player2',
    serverSide: 'right',
    player2: { x: 0.75, y: 0.05, vx: 0, vy: 0.006, facing: -1, onGround: false, actionType: 'JUMP', actionTick: 7, actionDuration: 0, stamina: 120 },
    ball: { x: 0.7125, y: 0.17, vx: 0, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'airborne bot should hit jump serve in timing window');
}


{
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  const inputs = ai.makeInputs(baseState({
    phase: 'serve',
    serveStep: 'tossed',
    server: 'player2',
    serverSide: 'right',
    serveTossY: 0.46,
    player2: { x: 0.92, y: 0.03, vx: 0, vy: 0.015, facing: -1, onGround: false, actionType: 'JUMP', actionTick: 2, actionDuration: 0, stamina: 120 },
    ball: { x: 0.8825, y: 0.13, vx: 0, vy: 0.014, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], false, 'rally jump serve should wait instead of hitting at a low early toss point');
}

{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.75, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.68, y: 0.19, vx: 0.012, vy: -0.012, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], true, 'fast falling ball should trigger earlier RECEIVE');
}


{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.61, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    player1: { x: 0.45, y: 0, vx: 0, vy: 0.002, facing: 1, onGround: false, actionType: 'JUMP', actionTick: 5, actionDuration: 0, stamina: 120 },
    ball: { x: 0.535, y: 0.27, vx: 0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'aggressive profile should spike more freely near the net when attackable');
}

{
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.92, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.66, y: 0.13, vx: 0.002, vy: -0.006, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'], true, 'defensive profile should dive more freely for far low balls');
}

{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.74, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.72, y: 0.18, vx: 0.004, vy: -0.004, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], true, 'rally profile should use stable receives before the ball gets too low');
}

{
  const ai = bot('rally');
  assert.doesNotThrow(() => ai.makeInputs({ phase: 'rally' }), 'missing partial state should not crash');
}

{
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
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  let rallyTick = null;
  let jumpServeHitTick = null;
  for (let tick = 0; tick < 240; tick++) {
    const inputs = ai.makeInputs(state);
    const selectedAction = ai.getDebugInfo().selectedAction;
    if (selectedAction === 'JUMP_SERVE_HIT') jumpServeHitTick = tick;
    const result = loop.tick(state, inputs);
    state = result.nextState;
    if (state.phase === 'rally') {
      rallyTick = tick;
      break;
    }
  }
  assert.ok(state.player2 && state.ball, '240 tick GameLoop + BotController simulation should keep state valid');
  assert.ok(jumpServeHitTick !== null && jumpServeHitTick >= 8, 'rally profile should wait for a higher jump-serve contact point');
  assert.equal(rallyTick, jumpServeHitTick, 'rally profile jump serve should transition to rally on hit');
}
