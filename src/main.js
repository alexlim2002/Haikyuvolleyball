import { Effector }           from './engine/Effector.js';
import { Renderer }           from './engine/Renderer.js';
import { initInputSystem }    from './engine/InputSystem.js';
import { EntityManager }      from './engine/EntityManager.js';
import { StateSystem }        from './engine/StateSystem.js';
import { GameLoop }           from './engine/GameLoop.js';
import { physicsMap, initEntities, handlers } from './game/GameLogic.js';
import { generateAssets }     from './game/SpriteGen.js';
import { TitleScreen }        from './game/TitleScreen.js';
import { CharacterSelect }    from './game/CharacterSelect.js';
import { createBotController } from './game/ai/BotController.js';
import { drawHUD, drawPauseOverlay } from './game/HUD.js';
import { drawHitboxes }       from './game/DebugOverlay.js';

const KEYS = {
  '1P_LEFT':   'KeyA',
  '1P_RIGHT':  'KeyD',
  '1P_UP':     'KeyW',
  '1P_DOWN':   'KeyS',
  '1P_ACTION': 'ShiftLeft',
  '2P_LEFT':   'ArrowLeft',
  '2P_RIGHT':  'ArrowRight',
  '2P_UP':     'ArrowUp',
  '2P_DOWN':   'ArrowDown',
  '2P_ACTION': 'ShiftRight',
};

const TPS     = 60;
const TICK_MS = 1000 / TPS;

async function main() {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  const effector = new Effector();
  document.addEventListener('keydown',     () => effector.init(), { once: true });
  document.addEventListener('pointerdown', () => effector.init(), { once: true });

  const assets   = await generateAssets();
  effector.setAssets(assets);

  const renderer  = new Renderer(canvas, assets);
  const inputGen  = initInputSystem({ keyboardMapping: KEYS, touchMapping: {} })();

  let phase          = 'title';
  let isSinglePlay   = false;
  let paused         = false;
  let prevShiftPause = false;
  let titleScreen    = null;
  let charSelect     = null;
  let stateSystem, gameLoop, entityManager, botController;
  let lastTime    = performance.now();
  let accumulator = 0;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (phase === 'select') goToTitle();
      else if (phase === 'game') paused = !paused;
    }
  });

  function goToTitle() {
    paused        = false;
    stateSystem   = null;
    gameLoop      = null;
    entityManager = null;
    botController = null;
    charSelect    = null;
    titleScreen   = makeTitleScreen();
    phase = 'title';
  }

  function makeTitleScreen() {
    return new TitleScreen((mode) => {
      isSinglePlay = (mode === 'single');
      charSelect   = new CharacterSelect(assets, startGame, isSinglePlay);
      phase = 'select';
    });
  }

  function startGame(p1Char, p2Char) {
    entityManager = new EntityManager();
    stateSystem   = new StateSystem(initEntities(entityManager, p1Char, p2Char));
    gameLoop      = new GameLoop({ entityManager, physicsMap, handlers });
    botController = isSinglePlay ? createBotController({
      playerId: 'player2', playerSide: 'right',
      opponentId: 'player1', mapWidth: physicsMap.w,
    }) : null;
    paused         = false;
    prevShiftPause = false;
    phase = 'game';
  }

  titleScreen = makeTitleScreen();

  function rafLoop(timestamp) {
    accumulator += Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    while (accumulator >= TICK_MS) {
      accumulator -= TICK_MS;
      const { value: rawInputs } = inputGen.next();

      if (phase === 'title') {
        titleScreen.tick(rawInputs);
      } else if (phase === 'select') {
        charSelect.tick(rawInputs);
      } else {
        const state   = stateSystem.buf;
        const shiftNow = !!(rawInputs['1P_ACTION'] || rawInputs['2P_ACTION']);

        if (paused) {
          // 일시정지 중 Shift → 타이틀
          if (shiftNow && !prevShiftPause) goToTitle();
          prevShiftPause = shiftNow;
        } else if (state.phase === 'gameover') {
          if (shiftNow && !prevShiftPause) goToTitle();
          prevShiftPause = shiftNow;
        } else {
          prevShiftPause = false;
          const inputs = botController ? withBotInputs(rawInputs, state, botController) : rawInputs;
          const { nextState, toPlay } = gameLoop.tick(state, inputs);
          stateSystem.setState(nextState);
          effector.play(toPlay);
        }
      }
    }

    renderer.clear();
    if (phase === 'title') {
      titleScreen.draw(ctx);
    } else if (phase === 'select') {
      charSelect.draw(ctx);
    } else {
      renderer.draw(stateSystem.buf, entityManager);
      if (window.showHitboxes) drawHitboxes(ctx, stateSystem.buf, entityManager);
      drawHUD(ctx, stateSystem.buf, renderer.width, renderer.height, botController);
      if (paused) drawPauseOverlay(ctx, renderer.width, renderer.height);
    }

    requestAnimationFrame(rafLoop);
  }

  requestAnimationFrame(rafLoop);
}

function withBotInputs(rawInputs, state, botController) {
  const inputs = { ...rawInputs };
  const botInputs = botController.makeInputs(state);
  for (const key in botInputs) inputs[key] = botInputs[key];
  return inputs;
}

window.showHitboxes = false;
window.noScore = false;
main();
