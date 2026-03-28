/**
 * SoundEngine
 * Web Audio API 래퍼.
 * - load(id, url) : 오디오 버퍼 프리로드
 * - play(id)      : 상호작용(Interaction) 발생 시 호출
 * AudioContext는 사용자 제스처 후 init() 으로 활성화 (브라우저 정책)
 */
export class SoundEngine {
  #ctx    = null;
  #buffers = new Map();

  init() {
    if (this.#ctx) return;
    this.#ctx = new AudioContext();
  }

  async load(id, url) {
    const res         = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    this.#buffers.set(id, await this.#ctx.decodeAudioData(arrayBuffer));
  }

  play(id) {
    if (!this.#ctx || !this.#buffers.has(id)) return;
    const source = this.#ctx.createBufferSource();
    source.buffer = this.#buffers.get(id);
    source.connect(this.#ctx.destination);
    source.start();
  }
}
