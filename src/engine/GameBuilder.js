import { Renderer }       from "./Renderer.js";
import { Effector }       from "./Effector.js";
import { initAssetStore } from "./AssetStore.js";
import { initInputSystem } from "./InputSystem.js";

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
  #keyboardMapping  = {};
  #touchMapping     = {};

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
    const renderer = new Renderer(this.#canvas);
    const assets   = await initAssetStore(this.#assetDescription, effector.decode.bind(effector));
    const inputsOfThisTick = initInputSystem({
      keyboardMapping: this.#keyboardMapping,
      touchMapping:    this.#touchMapping,
    });

    return new Game({ effector, renderer, assets, inputsOfThisTick });
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
  #assets;
  #inputsOfThisTick;
  #rafId = null;
  #inputGen = null;

  constructor({ effector, renderer, assets, inputsOfThisTick }) {
    this.#effector = effector;
    this.#renderer = renderer;
    this.#assets   = assets;
    this.#inputsOfThisTick = inputsOfThisTick;
  }

  start(match) {
    this.#effector.init();
    this.#inputGen = this.#inputsOfThisTick();
    // TODO: match로 World/Rules 초기화
    this.#rafId = requestAnimationFrame(this.#loop);
    return this;
  }

  init() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#inputGen = null;
    return this;
  }

  #loop = async () => {
    const { value: inputs } = await this.#inputGen.next();
    // TODO: world.update(inputs)
    this.#renderer.clear();
    this.#renderer.draw(null); // TODO: world 연결
    this.#rafId = requestAnimationFrame(this.#loop);
  };
}
