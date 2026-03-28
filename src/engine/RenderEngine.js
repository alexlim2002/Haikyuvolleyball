/**
 * RenderEngine
 * Canvas 2D를 감싸는 출력 엔진.
 * World 레이어가 생기면 draw(world)에서 읽어 처리.
 * - 논리 해상도 고정 (LOGICAL_WIDTH x LOGICAL_HEIGHT)
 * - 화면 크기에 맞게 스케일만 조정 (letterbox)
 */

const LOGICAL_WIDTH  = 800;
const LOGICAL_HEIGHT = 450;

export class RenderEngine {
  #canvas;
  #ctx;

  get width()  { return LOGICAL_WIDTH; }
  get height() { return LOGICAL_HEIGHT; }
  get ctx()    { return this.#ctx; }

  constructor(canvas) {
    this.#canvas = canvas;
    this.#canvas.width  = LOGICAL_WIDTH;
    this.#canvas.height = LOGICAL_HEIGHT;
    this.#ctx = canvas.getContext('2d');

    this.#applyScale();
    window.addEventListener('resize', () => this.#applyScale());
  }

  clear() {
    this.#ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /** World 레이어가 생기면 여기서 읽어 그린다 */
  draw(world) {
    if (world === null) {
      this.#drawPlaceholder();
      return;
    }
    // TODO: world 구현 후 채울 것
  }

  /** 임시 플레이스홀더 — World 구현 전 엔진 동작 확인용 */
  #drawPlaceholder() {
    const ctx = this.#ctx;
    // 하늘
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // 바닥
    ctx.fillStyle = '#c8a46e';
    ctx.fillRect(0, LOGICAL_HEIGHT * 0.75, LOGICAL_WIDTH, LOGICAL_HEIGHT * 0.25);
    // 네트 기둥
    ctx.fillStyle = '#555';
    ctx.fillRect(LOGICAL_WIDTH / 2 - 4, LOGICAL_HEIGHT * 0.45, 8, LOGICAL_HEIGHT * 0.3);
    // 네트
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LOGICAL_WIDTH * 0.1, LOGICAL_HEIGHT * 0.45);
    ctx.lineTo(LOGICAL_WIDTH * 0.9, LOGICAL_HEIGHT * 0.45);
    ctx.stroke();
  }

  #applyScale() {
    const scale = Math.min(
      window.innerWidth  / LOGICAL_WIDTH,
      window.innerHeight / LOGICAL_HEIGHT
    );
    this.#canvas.style.width  = `${LOGICAL_WIDTH  * scale}px`;
    this.#canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
  }
}
