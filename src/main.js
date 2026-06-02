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
import { ControlsConfig }     from './game/ControlsConfig.js';
import {
  loadBindings, saveBindings, setCurrentBindings,
  buildKeysMap, buildDirectMap, buildDisabledDoubles,
} from './game/KeyBindings.js';
import { loadSoundSettings, saveSoundSettings } from './game/SoundSettings.js';

const TPS     = 60;
const TICK_MS = 1000 / TPS;

async function main() {
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  const effector = new Effector();
  document.addEventListener('keydown',     () => effector.init(), { once: true });
  document.addEventListener('pointerdown', () => effector.init(), { once: true });

  const assets = await generateAssets();
  effector.setAssets(assets);
  effector.setGain('sfx_ball_hard', 2.0);
  effector.setGain('sfx_ball_soft', 2.0);

  const renderer = new Renderer(canvas, assets);

  // ── 사운드 설정 ──────────────────────────────────────────────────────────
  let soundSettings = loadSoundSettings();
  effector.setBGMEnabled(soundSettings.bgm);
  effector.setSFXEnabled(soundSettings.sfx);

  function applySoundSettings(s) {
    soundSettings = s;
    saveSoundSettings(s);
    effector.setBGMEnabled(s.bgm);
    effector.setSFXEnabled(s.sfx);
  }

  // ── 키 바인딩 ────────────────────────────────────────────────────────────
  let bindings  = loadBindings();
  setCurrentBindings(bindings);

  const keysMap        = buildKeysMap(bindings);
  const directMap      = buildDirectMap(bindings);
  const disabledDoubles = buildDisabledDoubles(bindings);

  const inputGen = initInputSystem({ keyboardMapping: keysMap, touchMapping: {}, directMapping: directMap, disabledDoubles })();

  function applyBindings(newBindings) {
    bindings = newBindings;
    setCurrentBindings(newBindings);
    saveBindings(newBindings);
    const km = buildKeysMap(newBindings);
    const dm = buildDirectMap(newBindings);
    Object.keys(keysMap).forEach(k => delete keysMap[k]);
    Object.assign(keysMap, km);
    Object.keys(directMap).forEach(k => delete directMap[k]);
    Object.assign(directMap, dm);
    disabledDoubles.clear();
    for (const v of buildDisabledDoubles(newBindings)) disabledDoubles.add(v);
  }

  // ── 마우스 ───────────────────────────────────────────────────────────────
  function canvasLogical(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      lx: (e.clientX - rect.left) * (800 / rect.width),
      ly: (e.clientY - rect.top)  * (450 / rect.height),
    };
  }

  canvas.addEventListener('click', (e) => {
    if (controlsConfig) return;
    const { lx, ly } = canvasLogical(e);
    if (phase === 'title')  titleScreen.handleClick(lx, ly);
    if (phase === 'select') charSelect.handleClick(lx, ly, e.button);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (controlsConfig) return;
    const { lx, ly } = canvasLogical(e);
    if (phase === 'select') charSelect.handleClick(lx, ly, 2);
  });

  // ── 상태 ─────────────────────────────────────────────────────────────────
  let phase          = 'title';
  let isSinglePlay   = false;
  let paused         = false;
  let controlsConfig = null;
  let spaceHeld      = false;
  document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); spaceHeld = true; } });
  document.addEventListener('keyup',   (e) => { if (e.code === 'Space') spaceHeld = false; });
  let prevShiftPause = false;
  let titleScreen    = null;
  let charSelect     = null;
  let stateSystem, gameLoop, entityManager, botController;
  let lastTime    = performance.now();
  let accumulator = 0;

  function openControls() {
    if (controlsConfig) return;
    controlsConfig = new ControlsConfig(bindings, soundSettings, (newBindings) => {
      applyBindings(newBindings);
    }, (newSound) => {
      applySoundSettings(newSound);
    });
  }
  function closeControls() {
    if (!controlsConfig) return;
    controlsConfig.destroy();
    controlsConfig = null;
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      controlsConfig ? closeControls() : openControls();
      return;
    }
    if (e.code === 'Escape') {
      if (controlsConfig) { closeControls(); return; }
      if (phase === 'select') goToTitle();
      else if (phase === 'game') paused = !paused;
    }
  });

  function goToTitle() {
    const { value: rawInputs } = inputGen.next();
    const confirmHeld = !!(rawInputs['1P_CONFIRM'] || rawInputs['2P_CONFIRM']);
    paused      = false;
    stateSystem = null; gameLoop = null; entityManager = null; botController = null; charSelect = null;
    titleScreen = makeTitleScreen(confirmHeld);
    phase = 'title';
  }

  function makeTitleScreen(actionAlreadyHeld = false) {
    effector.playBGM('bgm_title');
    return new TitleScreen((mode) => {
      isSinglePlay = (mode === 'single');
      charSelect   = new CharacterSelect(assets, startGame, isSinglePlay, effector);
      phase = 'select';
    }, actionAlreadyHeld, assets, effector);
  }

  function startGame(p1Char, p2Char) {
    effector.playBGM('bgm_game');
    effector.play(['sfx_crowd']);
    entityManager = new EntityManager();
    stateSystem   = new StateSystem(initEntities(entityManager, p1Char, p2Char));
    gameLoop      = new GameLoop({ entityManager, physicsMap, handlers });
    botController = isSinglePlay ? createBotController({
      playerId: 'player2', playerSide: 'right',
      opponentId: 'player1', mapWidth: physicsMap.w,
      serveTypes: p2Char?.serveTypes ?? ['OVERHAND', 'UNDERHAND'],
      forcedType: p2Char?.aiType ?? null,
    }) : null;
    paused         = false;
    prevShiftPause = false;
    phase          = 'game';
  }

  window.game_end = function() {
    if (!stateSystem || phase !== 'game') return;
    const winner = Math.random() < 0.5 ? 'p1' : 'p2';
    stateSystem.buf.sets[winner] = 2;
    stateSystem.buf.phase = 'gameover';
  };

  titleScreen = makeTitleScreen();

  function rafLoop(timestamp) {
    accumulator += Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    while (accumulator >= TICK_MS) {
      accumulator -= TICK_MS;
      const { value: rawInputs } = inputGen.next();

      if (controlsConfig) {
        controlsConfig.tick(rawInputs);
        // 설정 화면이 열려있는 동안 게임 입력 차단
      } else if (phase === 'title') {
        const inp = spaceHeld ? { ...rawInputs, '1P_CONFIRM': true, '2P_CONFIRM': true } : rawInputs;
        titleScreen.tick(inp);
      } else if (phase === 'select') {
        const inp = spaceHeld ? { ...rawInputs, '1P_CONFIRM': true, '2P_CONFIRM': true } : rawInputs;
        charSelect.tick(inp);
      } else {
        const state      = stateSystem.buf;
        const confirmNow = !!(rawInputs['1P_CONFIRM'] || rawInputs['2P_CONFIRM']);
        if (paused) {
          if (confirmNow && !prevShiftPause) goToTitle();
          prevShiftPause = confirmNow;
        } else if (state.phase === 'gameover') {
          if (confirmNow && !prevShiftPause) goToTitle();
          prevShiftPause = confirmNow;
        } else {
          prevShiftPause = false;
          let inputs = isSinglePlay ? mergeSingleInputs(rawInputs) : rawInputs;
          if (botController) inputs = withBotInputs(inputs, state, botController);
          const oldScore = { ...state.score };
          const oldSets  = { ...state.sets };
          const oldPhase = state.phase;
          const { nextState, toPlay } = gameLoop.tick(state, inputs);
          if (nextState.phase === 'gameover' && oldPhase !== 'gameover') {
            toPlay.push('sfx_win', 'sfx_crowd');
          } else if (nextState.sets.p1 !== oldSets.p1 || nextState.sets.p2 !== oldSets.p2) {
            toPlay.push('sfx_setwon', 'sfx_crowd');
          } else if (nextState.score.p1 !== oldScore.p1 || nextState.score.p2 !== oldScore.p2) {
            toPlay.push('sfx_score');
          }
          stateSystem.setState(nextState);
          effector.play(toPlay);
        }
      }
    }

    renderer.clear();
    if (phase === 'title') {
      titleScreen.draw(ctx);
      if (window.showHitboxes) titleScreen.drawClickBoxes(ctx);
    } else if (phase === 'select') {
      charSelect.draw(ctx);
      if (window.showHitboxes) charSelect.drawClickBoxes(ctx);
    } else {
      renderer.draw(stateSystem.buf, entityManager);
      if (window.showHitboxes) drawHitboxes(ctx, stateSystem.buf, entityManager);
      drawHUD(ctx, stateSystem.buf, renderer.width, renderer.height, botController, entityManager);
      if (paused) drawPauseOverlay(ctx, renderer.width, renderer.height);
    }

    if (controlsConfig) controlsConfig.draw(ctx);

    requestAnimationFrame(rafLoop);
  }

  requestAnimationFrame(rafLoop);
}

const INPUT_SUFFIXES = ['LEFT','RIGHT','UP','DOWN','ACTION','DOUBLE_LEFT','DOUBLE_RIGHT','DOUBLE_UP','DOUBLE_DOWN'];

function mergeSingleInputs(raw) {
  const merged = { ...raw };
  for (const s of INPUT_SUFFIXES) {
    if (raw[`2P_${s}`]) merged[`1P_${s}`] = true;
  }
  return merged;
}

function withBotInputs(inputs, state, botController) {
  const next = { ...inputs };
  const botInputs = botController.makeInputs(state);
  for (const key in botInputs) next[key] = botInputs[key];
  return next;
}

window.showHitboxes = false;
window.noScore = false;
main();
