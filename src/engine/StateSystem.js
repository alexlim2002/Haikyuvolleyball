/**
 * StateSystem
 *
 * 순수 상태 컨테이너. 게임 로직을 모른다.
 * GameLoop가 매 틱 setState()로 상태를 갱신하고,
 * Renderer가 buf로 현재 상태를 읽는다.
 */
export class StateSystem {
  #state;

  constructor(initialState) {
    this.#state = initialState;
  }

  setState(nextState) {
    this.#state = nextState;
  }

  get buf() {
    return this.#state;
  }
}
