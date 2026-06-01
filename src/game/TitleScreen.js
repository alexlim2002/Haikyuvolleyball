const LW = 800,
  LH = 450;

export class TitleScreen {
  #selectedIdx = 0;
  #prevUp = false;
  #prevDown = false;
  #prevAction1 = false;
  #prevAction2 = false;
  #onSelect;
  #assets;

  // onSelect(mode) — mode: 'single' | 'multi'
  // actionAlreadyHeld: 진입 시점에 ACTION 키가 눌려있으면 true — 즉시 선택 방지
  constructor(onSelect, actionAlreadyHeld = false, assets = null) {
    this.#onSelect = onSelect;
    this.#prevAction1 = actionAlreadyHeld;
    this.#prevAction2 = actionAlreadyHeld;
    this.#assets = assets;
  }

  tick(inputs) {
    const up = !!(inputs["1P_UP"] || inputs["2P_UP"]);
    const down = !!(inputs["1P_DOWN"] || inputs["2P_DOWN"]);
    const confirm = !!(inputs["1P_CONFIRM"] || inputs["2P_CONFIRM"]);

    if (up && !this.#prevUp)
      this.#selectedIdx = (this.#selectedIdx - 1 + 2) % 2;
    if (down && !this.#prevDown)
      this.#selectedIdx = (this.#selectedIdx + 1) % 2;

    if (confirm && !this.#prevAction1 && !this.#prevAction2) {
      this.#onSelect(this.#selectedIdx === 0 ? "single" : "multi");
    }

    this.#prevUp = up;
    this.#prevDown = down;
    this.#prevAction1 = !!inputs["1P_CONFIRM"];
    this.#prevAction2 = !!inputs["2P_CONFIRM"];
  }

  static ITEM_Y = [304, 340];

  handleClick(lx, ly) {
    for (let i = 0; i < TitleScreen.ITEM_Y.length; i++) {
      const cy = TitleScreen.ITEM_Y[i];
      if (ly >= cy - 20 && ly <= cy + 20) {
        if (this.#selectedIdx === i) {
          this.#onSelect(i === 0 ? "single" : "multi");
        } else {
          this.#selectedIdx = i;
        }
        return;
      }
    }
  }

  draw(ctx) {
    if (this.#assets?.start) {
      ctx.drawImage(this.#assets.start, 0, 0, LW, LH);
    } else {
      ctx.fillStyle = "#1a2a3a";
      ctx.fillRect(0, 0, LW, LH);
    }

    // 조작 안내 (상단)
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("↑↓ / 클릭 선택  /  Enter 확인", LW / 2, 10);

    // 선택 테두리
    const cy = TitleScreen.ITEM_Y[this.#selectedIdx];
    ctx.strokeStyle = "#00e8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(LW / 2 - 160, cy - 10, 320, 40, 6);
    ctx.stroke();
  }
}
