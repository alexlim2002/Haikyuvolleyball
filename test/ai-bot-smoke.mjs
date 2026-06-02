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
  assert.equal(inputs['2P_DOUBLE_UP'], true, 'high net threat should trigger BLOCK');
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
  const ai = bot('defensive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.75, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0, stamina: 120 },
    ball: { x: 0.68, y: 0.19, vx: 0.012, vy: -0.012, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOWN'], true, 'fast falling ball should trigger earlier RECEIVE');
}

{
  const ai = bot('rally');
  assert.doesNotThrow(() => ai.makeInputs({ phase: 'rally' }), 'missing partial state should not crash');
}

{
  const entityManager = new EntityManager();
  let state = initEntities(entityManager, { serveTypes: ['UNDERHAND'] }, { serveTypes: ['JUMP', 'OVERHAND'] });
  const loop = new GameLoop({ entityManager, physicsMap, handlers });
  const ai = bot('rally', { serveTypes: ['JUMP', 'OVERHAND'] });
  for (let tick = 0; tick < 240; tick++) {
    const inputs = ai.makeInputs(state);
    const result = loop.tick(state, inputs);
    state = result.nextState;
  }
  assert.ok(state.player2 && state.ball, '240 tick GameLoop + BotController simulation should keep state valid');
}
