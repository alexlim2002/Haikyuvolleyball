class TripleBufferSlot {
  _slots;
  #latest  = 0;
  #reading = 1;

  constructor(factory) {
    this._slots = [factory(), factory(), factory()];
  }

  get _freeIndex() {
    return [0, 1, 2].find((i) => i !== this.#latest && i !== this.#reading);
  }

  _commit() {
    this.#latest = this._freeIndex;
  }

  get _latest() {
    this.#reading = this.#latest;
    return this._slots[this.#reading];
  }
}

/**
 * TripleBufferStatic
 * 고정 스키마 (일반 객체) 용.
 *
 * stateTable[key] = value  → free 슬롯 in-place 수정 후 commit
 * stateTable.buff          → latest 슬롯 (소비자용)
 */
export function TripleBufferStatic(factory) {
  const slot = new TripleBufferSlot(factory);
  return new Proxy(slot, {
    set(target, prop, value) {
      target._slots[target._freeIndex][prop] = value;
      target._commit();
      return true;
    },
    get(target, prop) {
      if (prop === "buff") return target._latest;
    },
  });
}

/**
 * TripleBufferDynamic
 * 동적 스키마 (Map) 용.
 *
 * stateTable[key] = value  → free 슬롯 Map.set 후 commit
 * stateTable.buff          → latest Map (소비자용)
 */
export function TripleBufferDynamic() {
  const slot = new TripleBufferSlot(() => new Map());
  return new Proxy(slot, {
    set(target, prop, value) {
      target._slots[target._freeIndex].set(prop, value);
      target._commit();
      return true;
    },
    get(target, prop) {
      if (prop === "buff") return target._latest;
    },
  });
}
