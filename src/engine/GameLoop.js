/**
 * GameLoop
 * requestAnimationFrame 기반 고정 틱 루프.
 * - update(dt) : 물리/규칙 갱신
 * - render()   : 출력 (틱과 분리)
 */
export class GameLoop {
  #rafId = null;
  #lastTime = 0;
  #onUpdate;
  #onRender;

  constructor({ onUpdate, onRender }) {
    this.#onUpdate = onUpdate;
    this.#onRender = onRender;
  }

  start() {
    this.#lastTime = performance.now();
    this.#rafId = requestAnimationFrame(this.#loop);
  }

  stop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  #loop = (timestamp) => {
    // dt: 이전 프레임과의 경과시간(초). 최대 50ms로 캡 (탭 비활성 등 대비)
    const dt = Math.min((timestamp - this.#lastTime) / 1000, 0.05);
    this.#lastTime = timestamp;

    this.#onUpdate(dt);
    this.#onRender();

    this.#rafId = requestAnimationFrame(this.#loop);
  };
}
