/**
 * Renderer
 * Canvas 2D를 감싸는 출력 엔진.
 * - 논리 해상도 고정 (LOGICAL_WIDTH x LOGICAL_HEIGHT)
 * - 화면 크기에 맞게 스케일만 조정 (letterbox)
 *
 * 레이어 순서: 배경(bg) → 엔티티 → UI(ui)
 */

const LOGICAL_WIDTH  = 800;
const LOGICAL_HEIGHT = 450;

export class Renderer {
  #canvas;
  #ctx;
  #assets;

  get width()  { return LOGICAL_WIDTH; }
  get height() { return LOGICAL_HEIGHT; }

  constructor(canvas, assets) {
    this.#canvas = canvas;
    this.#assets = assets;
    this.#canvas.width  = LOGICAL_WIDTH;
    this.#canvas.height = LOGICAL_HEIGHT;
    this.#ctx = canvas.getContext("2d");

    this.#applyScale();
    window.addEventListener("resize", () => this.#applyScale());
  }

  clear() {
    this.#ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /** StateSystem.buf와 EntityManager를 받아 3개 레이어를 순서대로 그린다 */
  draw(buf, entityManager) {
    this.#drawLayer("bg", buf, entityManager);
    this.#drawLayer("entity", buf, entityManager);
    this.#drawLayer("ui", buf, entityManager);
  }

  /** 특정 레이어 타입에 해당하는 엔티티들을 그린다 */
  #drawLayer(layer, buf, entityManager) {
    for (const entity of entityManager.getAll()) {
      const isBg     = layer === "bg"     && entity.type === "bg";
      const isUI     = layer === "ui"     && entity.type === "ui";
      const isEntity = layer === "entity" && entity.type !== "bg" && entity.type !== "ui";
      if (!isBg && !isUI && !isEntity) continue;

      const state = buf[entity.id];
      if (!state) continue;

      if (entity.assetId === undefined) continue;

      const asset = this.#assets[entity.assetId];
      if (!asset) continue;

      if (Array.isArray(asset)) {
        // 스프라이트
        const frame = asset[entity.spriteIndex ?? 0];
        this.#drawSprite(frame, state.x, state.y, state.w, state.h, entity.flipH, entity.flipV);
      } else {
        // 단일 이미지
        this.#drawImage(asset, state.x, state.y, state.w, state.h, entity.flipH, entity.flipV);
      }
    }
  }

  #drawSprite(frame, x, y, w, h, flipH, flipV) {
    const ctx = this.#ctx;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (flipH) ctx.scale(-1,  1);
    if (flipV) ctx.scale( 1, -1);
    ctx.drawImage(frame.image, frame.sx, frame.sy, frame.sw, frame.sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  #drawImage(image, x, y, w, h, flipH, flipV) {
    const ctx = this.#ctx;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (flipH) ctx.scale(-1,  1);
    if (flipV) ctx.scale( 1, -1);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  #applyScale() {
    const scale = Math.min(
      window.innerWidth  / LOGICAL_WIDTH,
      window.innerHeight / LOGICAL_HEIGHT,
    );
    this.#canvas.style.width  = `${LOGICAL_WIDTH  * scale}px`;
    this.#canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
  }
}
