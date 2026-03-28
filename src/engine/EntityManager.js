/**
 * EntityManager
 * 모든 게임 요소(엔티티)의 등록/삭제를 담당.
 * 동적 등록/삭제가 가능해서 Manager.
 *
 * 각 엔티티는:
 *   - id       : 고유 식별자
 *   - type     : 엔티티 종류 (상위 레이어에서 정의)
 *   - assetId  : AssetStore의 키 (렌더링 시 참조)
 *
 * 상태는 저장하지 않음 — 모든 게임 상태는 StateSystem이 관리
 */
export class EntityManager {
  #entities = new Map();

  register(id, { type, assetId }) {
    this.#entities.set(id, Object.freeze({ id, type, assetId }));
    return this;
  }

  unregister(id) {
    this.#entities.delete(id);
    return this;
  }

  get(id) {
    return this.#entities.get(id);
  }

  getAll() {
    return this.#entities.values();
  }

  has(id) {
    return this.#entities.has(id);
  }
}
