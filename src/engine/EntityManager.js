/**
 * EntityManager
 * 모든 게임 요소(엔티티)의 등록/삭제를 담당.
 * 동적 등록/삭제가 가능해서 Manager.
 *
 * 엔티티 스키마 (타입별):
 *   에셋 없음:   { id, type }
 *   이미지:      { id, type, assetId, flipH, flipV }
 *   스프라이트:  { id, type, assetId, spriteIndex, flipH, flipV }
 *
 * 상태는 저장하지 않음 — 모든 게임 상태는 StateSystem이 관리
 */
export class EntityManager {
  #entities = new Map();

  register(id, entity) {
    this.#entities.set(id, Object.freeze({ id, ...entity }));
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
