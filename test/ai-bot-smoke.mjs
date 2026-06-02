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
    player1: { x: 0.25, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    player2: { x: 0.75, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    ball: { x: 0.75, y: 0.25, vx: 0, vy: 0, actionRangeCooldown: 0 },
    phase: 'rally',
    score: { p1: 0, p2: 0 },
    sets: { p1: 0, p2: 0 },
    ...overrides,
  };
}

function bot(profile = 'rally') {
  return createBotController({
    playerId: 'player2',
    playerSide: 'right',
    opponentId: 'player1',
    mapWidth: physicsMap.w,
    profile,
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
    player2: { x: 0.88, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    ball: { x: 0.72, y: 0.075, vx: 0, vy: -0.003, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_LEFT'], true, 'far low ball should trigger left DIVE');
}

{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.565, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    player1: { x: 0.46, y: 0, vx: 0, vy: 0.002, facing: 1, onGround: false, actionType: 'JUMP', actionTick: 5, actionDuration: 0 },
    ball: { x: 0.52, y: 0.28, vx: 0.002, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_DOUBLE_UP'], true, 'high net threat should trigger BLOCK');
}

{
  const ai = bot('aggressive');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.74, y: 0.06, vx: 0, vy: 0, facing: -1, onGround: false, actionType: 'JUMP', actionTick: 8, actionDuration: 0 },
    ball: { x: 0.68, y: 0.24, vx: -0.001, vy: -0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_ACTION'], true, 'front high attackable ball should trigger SPIKE');
}

{
  const ai = bot('rally');
  const inputs = ai.makeInputs(baseState({
    player2: { x: 0.92, y: 0, vx: 0, vy: 0, facing: -1, onGround: true, actionType: 'IDLE', actionTick: 0, actionDuration: 0 },
    ball: { x: 0.30, y: 0.25, vx: -0.001, vy: 0.001, actionRangeCooldown: 0 },
  }));
  assert.equal(inputs['2P_LEFT'], true, 'opponent-court ball should make bot return to defensive home');
}

{
  const ai = bot('rally');
  assert.doesNotThrow(() => ai.makeInputs({ phase: 'rally' }), 'missing partial state should not crash');
}

{
  const entityManager = new EntityManager();
  let state = initEntities(entityManager);
  const loop = new GameLoop({ entityManager, physicsMap, handlers });
  const ai = bot('rally');
  for (let tick = 0; tick < 180; tick++) {
    const inputs = ai.makeInputs(state);
    const result = loop.tick(state, inputs);
    state = result.nextState;
  }
  assert.ok(state.player2 && state.ball, '180 tick GameLoop + BotController simulation should keep state valid');
}

