import { Renderer } from "./Renderer.js";
import { Effector } from "./Effector.js";
import { initAssetStore } from "./AssetStore.js";
import { initInputSystem } from "./InputSystem.js";
import { StateSystem } from "./StateSystem.js";
import { EntityManager } from "./EntityManager.js";
import { GameLoop } from "./GameLoop.js";

const TPS = 60;
const TICK_MS = 1000 / TPS;

/**
 * GameBuilder
 *
 * 빌더 패턴으로 게임 구성 후 .build()로 Game 인스턴스 반환.
 *
 * 개발타임 정보 (코드/JSON에서):
 *   .setAssets(assetDescription)
 *
 * 유저타임 정보 (게임 설정에서):
 *   .setKeyboardMapping(mapping)
 *   .setTouchMapping(mapping)
 *
 * @example
 * const game = await new GameBuilder(canvas)
 *   .setAssets(assetDescription)
 *   .setKeyboardMapping(keyboardMapping)
 *   .build();
 *
 * game.start(match);
 * // 재시작
 * game.init().start(newMatch);
 */
export class GameBuilder {
  #canvas;
  #assetDescription = {};
  #keyboardMapping = {};
  #touchMapping = {};

  constructor(canvas) {
    this.#canvas = canvas;
  }

  setAssets(assetDescription) {
    this.#assetDescription = assetDescription;
    return this;
  }

  setKeyboardMapping(mapping) {
    this.#keyboardMapping = mapping;
    return this;
  }

  setTouchMapping(mapping) {
    this.#touchMapping = mapping;
    return this;
  }

  async build() {
    const effector = new Effector();
    const assets = await initAssetStore(
      this.#assetDescription,
      effector.decode.bind(effector),
    );
    effector.setAssets(assets);
    const renderer = new Renderer(this.#canvas, assets);
    const inputsOfThisTick = initInputSystem({
      keyboardMapping: this.#keyboardMapping,
      touchMapping: this.#touchMapping,
    });

    return new Game({ effector, renderer, inputsOfThisTick });
  }
}

/**
 * Game
 *
 * .start(match)  — 매치 데이터로 루프 시작
 * .init()        — 루프 정지 후 자신을 반환 (메서드 체이닝용)
 */
class Game {
  #effector;
  #renderer;
  #inputsOfThisTick;
  #entityManager = null;
  #stateSystem = null;
  #gameLoop = null;
  #inputGen = null;
  #rafId = null;
  #lastTick = 0;

  constructor({ effector, renderer, inputsOfThisTick }) {
    this.#effector = effector;
    this.#renderer = renderer;
    this.#inputsOfThisTick = inputsOfThisTick;
  }

  start({ physicsMap, initEntities, handlers }) {
    this.#effector.init();
    this.#entityManager = new EntityManager();
    const initialState = initEntities(this.#entityManager);
    this.#stateSystem = new StateSystem(initialState);
    this.#gameLoop = new GameLoop({ entityManager: this.#entityManager, physicsMap, handlers });
    this.#inputGen = this.#inputsOfThisTick();
    this.#lastTick = performance.now();
    this.#rafId = requestAnimationFrame(this.#rafLoop);
    return this;
  }

  init() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#entityManager = null;
    this.#stateSystem = null;
    this.#gameLoop = null;
    this.#inputGen = null;
    return this;
  }

  #rafLoop = async (timestamp) => {
    if (this.#stateSystem === null) {
      this.#rafId = requestAnimationFrame(this.#rafLoop);
      return;
    }

    if (timestamp - this.#lastTick >= TICK_MS) {
      this.#lastTick = timestamp;
      const { value: inputs } = await this.#inputGen.next();
      const { nextState, toPlay } = this.#gameLoop.tick(this.#stateSystem.buf, inputs);
      this.#stateSystem.setState(nextState);
      this.#effector.play(toPlay);
    }

    this.#renderer.clear();
    this.#renderer.draw(this.#stateSystem.buf, this.#entityManager);
    this.#rafId = requestAnimationFrame(this.#rafLoop);
  };
}
