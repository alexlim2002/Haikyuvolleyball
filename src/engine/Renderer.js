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

function computeSpriteIndex(entity, state) {
  const actionDef = entity.actions?.[state.actionType] ?? entity.actions?.DEFAULT;
  if (!actionDef?.sprites) return 0;
  const { start, count } = actionDef.sprites;
  if (count <= 1 || !state.actionDuration) return start;
  return start + Math.round((count - 1) * state.actionTick / state.actionDuration);
}

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

      const { x, y, w, h } = this.#toCanvasRect(entity, state);
      const flipH = state.facing === -1;

      if (Array.isArray(asset)) {
        const frame = asset[computeSpriteIndex(entity, state)];
        this.#drawSprite(frame, x, y, w, h, flipH, entity.flipV);
      } else {
        this.#drawImage(asset, x, y, w, h, flipH, entity.flipV);
      }
    }
  }

  #toCanvasRect(entity, state) {
    const w  = (entity.size?.w ?? 0) * LOGICAL_WIDTH;
    const h  = (entity.size?.h ?? 0) * LOGICAL_WIDTH;
    const cx = state.x * LOGICAL_WIDTH;
    const cy = LOGICAL_HEIGHT - state.y * LOGICAL_WIDTH;
    const x  = cx - w / 2;
    const y  = entity.origin === 'center' ? cy - h / 2 : cy - h;
    return { x, y, w, h };
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
