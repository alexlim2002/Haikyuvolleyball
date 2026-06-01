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
const TPS = 60;
export const FLOOR_OFFSET = 60; // 바닥이 캔버스 하단에서 이 픽셀만큼 위에 위치

function resolveSprites(sprites, facing) {
  if (sprites?.right !== undefined) {
    return facing === -1 ? sprites.left : sprites.right;
  }
  return sprites;
}

const AIR_OVERRIDE = new Set(['IDLE', 'RUN', 'RECEIVE']);

function computeSpriteIndex(entity, state) {
  let actionType = state.actionType;
  if (entity.role === 'player' && !state.onGround && AIR_OVERRIDE.has(actionType)) {
    actionType = 'JUMP';
  }

  const actionDef = entity.actions?.[actionType] ?? entity.actions?.DEFAULT;
  if (!actionDef?.sprites) return 0;

  const { start, count } = resolveSprites(actionDef.sprites, state.facing);
  if (count <= 1) return start;

  if (state.actionDuration > 0) {
    return start + Math.round((count - 1) * state.actionTick / state.actionDuration);
  }

  if (actionDef.frameMs) {
    const frameTicks = actionDef.frameMs * TPS / 1000;
    return start + Math.floor(state.actionTick / frameTicks) % count;
  }

  return start;
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
      const sprites = entity.actions?.[state.actionType]?.sprites ?? entity.actions?.DEFAULT?.sprites;
      const flipH = sprites?.right === undefined && state.facing === -1;

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
    // bg(코트 배경)와 net은 뷰포트 바닥 기준, 그 외는 물리 바닥(FLOOR_OFFSET 위)
    const floor = (entity.type === 'bg' || entity.role === 'net') ? 0 : FLOOR_OFFSET;
    const cx = state.x * LOGICAL_WIDTH;
    const cy = LOGICAL_HEIGHT - floor - state.y * LOGICAL_WIDTH;
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
    const dpr   = window.devicePixelRatio || 1;
    const scale = Math.min(
      window.innerWidth  / LOGICAL_WIDTH,
      window.innerHeight / LOGICAL_HEIGHT,
    );
    const totalScale = scale * dpr * 0.75;
    this.#canvas.width  = Math.round(LOGICAL_WIDTH  * totalScale);
    this.#canvas.height = Math.round(LOGICAL_HEIGHT * totalScale);
    this.#canvas.style.width  = `${LOGICAL_WIDTH  * scale}px`;
    this.#canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
    this.#ctx.setTransform(totalScale, 0, 0, totalScale, 0, 0);
  }
}
