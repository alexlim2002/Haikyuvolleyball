/**
 * Effector
 * 게임 틱과 무관하게 실시간으로 독립 실행되는 이펙트 (사운드 등).
 *
 * SFX: assets에 ArrayBuffer로 저장 → setAssets()에서 AudioBuffer로 미리 디코딩
 *      createBufferSource()로 즉시 재생 (지연 없음)
 * BGM: assets에 URL string으로 저장 → <audio> 스트리밍 재생 (루프)
 *
 * 브라우저 정책상 init() (첫 제스처) 전까지 AudioContext는 suspended 상태.
 * init() 전 playBGM()은 pending 저장 → init() 때 자동 시작.
 */
export class Effector {
  #ctx = new AudioContext();
  #initialized = false;
  #assets = null;
  #sfxBuffers = new Map();  // id → AudioBuffer (디코딩 완료)
  #gainMap = new Map();     // id → gain 값 (기본 1.0)
  #bgmEnabled = true;
  #sfxEnabled = true;
  #bgm = null;
  #pendingBGMid = null;

  init() {
    if (this.#initialized) return this;
    this.#initialized = true;
    this.#ctx.resume();
    if (this.#pendingBGMid) this.#startBGM(this.#pendingBGMid);
    return this;
  }

  setGain(id, gain) {
    this.#gainMap.set(id, gain);
  }

  setBGMEnabled(enabled) {
    this.#bgmEnabled = enabled;
    if (!enabled) {
      if (this.#bgm) { this.#bgm.pause(); this.#bgm = null; }
    } else if (this.#initialized && this.#pendingBGMid) {
      this.#startBGM(this.#pendingBGMid);
    }
  }

  setSFXEnabled(enabled) {
    this.#sfxEnabled = enabled;
  }

  setAssets(assets) {
    this.#assets = assets;
    for (const [id, val] of Object.entries(assets)) {
      if (val instanceof ArrayBuffer) {
        this.#ctx.decodeAudioData(val).then(buf => {
          this.#sfxBuffers.set(id, buf);
        }).catch(() => {});
      }
    }
  }

  // toPlay: 사운드 ID 배열 — 각각 독립 재생 (fire-and-forget)
  play(toPlay) {
    if (!this.#initialized || !this.#sfxEnabled) return;
    for (const id of toPlay) {
      const buf = this.#sfxBuffers.get(id);
      if (!buf) continue;
      const src = this.#ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.#gainMap.get(id) ?? 1;
      if (gain !== 1) {
        const g = this.#ctx.createGain();
        g.gain.value = gain;
        src.connect(g);
        g.connect(this.#ctx.destination);
      } else {
        src.connect(this.#ctx.destination);
      }
      src.start();
    }
  }

  // 반복 재생 BGM 전환. init() 전 호출 시 pending → init() 때 자동 시작
  playBGM(id) {
    this.#pendingBGMid = id;
    if (this.#bgm) { this.#bgm.pause(); this.#bgm = null; }
    if (this.#initialized) this.#startBGM(id);
  }

  stopBGM() {
    this.#pendingBGMid = null;
    if (this.#bgm) { this.#bgm.pause(); this.#bgm = null; }
  }

  #startBGM(id) {
    if (this.#bgm) { this.#bgm.pause(); this.#bgm = null; }
    if (!this.#bgmEnabled) return;
    const url = this.#assets?.[id];
    if (typeof url !== 'string') return;
    this.#bgm = new Audio(url);
    this.#bgm.loop = true;
    this.#bgm.volume = 0.4;
    this.#bgm.play().catch(() => {});
  }
}
