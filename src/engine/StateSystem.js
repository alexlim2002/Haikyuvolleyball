/**
 * StateSystem
 *
 * 게임 로직을 콜백으로 주입받아 상태 컨테이너만 관리한다.
 * 엔진은 state 구조를 알 필요 없음.
 *
 * @param {object} match
 * @param {EntityManager} entityManager
 * @param {{ initState, tick }} logic  — GameLogic 콜백 묶음
 */
export class StateSystem {
  #state = null;
  #tick  = null;

  constructor(match, entityManager, { initState, tick }) {
    this.#state = initState(match, entityManager);
    this.#tick  = tick;
  }

  tick(inputs) {
    const { nextState, toPlay } = this.#tick(this.#state, inputs);
    this.#state = nextState;
    return { toPlay };
  }

  get buf() {
    return this.#state;
  }
}
