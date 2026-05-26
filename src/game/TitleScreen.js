const LW = 800, LH = 450;

export class TitleScreen {
  #selectedIdx = 0;
  #prevUp = false;
  #prevDown = false;
  #prevAction1 = false;
  #prevAction2 = false;
  #onSelect;

  // onSelect(mode) — mode: 'single' | 'multi'
  constructor(onSelect) {
    this.#onSelect = onSelect;
  }

  tick(inputs) {
    const up   = !!(inputs['1P_UP']   || inputs['2P_UP']);
    const down = !!(inputs['1P_DOWN'] || inputs['2P_DOWN']);
    const act  = !!(inputs['1P_ACTION'] || inputs['2P_ACTION']);

    if (up   && !this.#prevUp)   this.#selectedIdx = (this.#selectedIdx - 1 + 2) % 2;
    if (down && !this.#prevDown) this.#selectedIdx = (this.#selectedIdx + 1) % 2;

    if (act && !this.#prevAction1 && !this.#prevAction2) {
      this.#onSelect(this.#selectedIdx === 0 ? 'single' : 'multi');
    }

    this.#prevUp      = up;
    this.#prevDown    = down;
    this.#prevAction1 = !!(inputs['1P_ACTION']);
    this.#prevAction2 = !!(inputs['2P_ACTION']);
  }

  draw(ctx) {
    // 배경
    const bg = ctx.createLinearGradient(0, 0, 0, LH);
    bg.addColorStop(0, '#0d1b2a');
    bg.addColorStop(1, '#1a3a5c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LW, LH);

    // 로고 플레이스홀더
    ctx.fillStyle = '#1e3a5a';
    ctx.strokeStyle = '#4488bb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(LW / 2 - 200, 60, 400, 120, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOGO PLACEHOLDER', LW / 2, 120);

    // 메뉴 항목
    const ITEMS = ['싱글 플레이  (vs AI)', '멀티 플레이  (2P)'];
    const ITEM_Y = [270, 330];

    for (let i = 0; i < ITEMS.length; i++) {
      const selected = i === this.#selectedIdx;

      // 선택 배경
      if (selected) {
        ctx.fillStyle = 'rgba(68,136,255,0.25)';
        ctx.beginPath();
        ctx.roundRect(LW / 2 - 160, ITEM_Y[i] - 22, 320, 44, 8);
        ctx.fill();
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.45)';
      ctx.font = selected ? 'bold 22px monospace' : '22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ITEMS[i], LW / 2, ITEM_Y[i]);
    }

    // 조작 안내
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('↑↓ 선택  /  Shift 확인  /  게임 중 Esc — 타이틀로', LW / 2, LH - 14);
  }
}
