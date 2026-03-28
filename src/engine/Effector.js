/**
 * Effector
 * 사운드 및 파티클 등 이펙트 전반. 틱과는 별개로 재생되는것들.
 *
 * - er suffix: 출력(소비) 담당
 * - 틱 비종속: 상위 레이어가 상호작용 발생 시 직접 호출
 * - decode() : AssetStore가 사운드 에셋 로드 시 사용
 *
 * AudioContext는 사용자 제스처 후 init()으로 활성화 (브라우저 정책)
 */
export class Effector {
  #ctx = null;

  init() {
    if (this.#ctx) return this;
    this.#ctx = new AudioContext();
    return this;
  }

  decode(arrayBuffer) {
    return this.#ctx.decodeAudioData(arrayBuffer);
  }

  playSound(audioBuffer) {
    const source = this.#ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.#ctx.destination);
    source.start();
  }

  // TODO: playParticle(particleDesc, position)
}
