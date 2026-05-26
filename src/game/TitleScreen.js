const LW = 800, LH = 450;

export class TitleScreen {
  #selectedIdx = 0;
  #prevUp = false;
  #prevDown = false;
  #prevAction1 = false;
  #prevAction2 = false;
  #onSelect;

  // onSelect(mode) — mode: 'single' | 'multi'
  // actionAlreadyHeld: 진입 시점에 ACTION 키가 눌려있으면 true — 즉시 선택 방지
  constructor(onSelect, actionAlreadyHeld = false) {
    this.#onSelect = onSelect;
    this.#prevAction1 = actionAlreadyHeld;
    this.#prevAction2 = actionAlreadyHeld;
  }

  tick(inputs) {
    const up      = !!(inputs['1P_UP']      || inputs['2P_UP']);
    const down    = !!(inputs['1P_DOWN']    || inputs['2P_DOWN']);
    const confirm = !!(inputs['1P_CONFIRM'] || inputs['2P_CONFIRM']);

    if (up   && !this.#prevUp)   this.#selectedIdx = (this.#selectedIdx - 1 + 2) % 2;
    if (down && !this.#prevDown) this.#selectedIdx = (this.#selectedIdx + 1) % 2;

    if (confirm && !this.#prevAction1 && !this.#prevAction2) {
      this.#onSelect(this.#selectedIdx === 0 ? 'single' : 'multi');
    }

    this.#prevUp      = up;
    this.#prevDown    = down;
    this.#prevAction1 = !!(inputs['1P_CONFIRM']);
    this.#prevAction2 = !!(inputs['2P_CONFIRM']);
  }

  draw(ctx) {
    // 체육관 벽 (상단 배경)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, LH * 0.7);
    wallGrad.addColorStop(0, '#0e1b3a');
    wallGrad.addColorStop(1, '#1e3560');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, LW, LH);

    // 체육관 마루 (하단)
    const floorY = Math.round(LH * 0.68);
    ctx.fillStyle = '#7c4e14';
    ctx.fillRect(0, floorY, LW, LH - floorY);
    ctx.lineWidth = 1;
    for (let fy = floorY + 6; fy < LH; fy += 9) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(LW, fy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, floorY + 1); ctx.lineTo(LW, floorY + 1); ctx.stroke();

    // 포인트 스트라이프
    ctx.fillStyle = '#e85c00';
    ctx.fillRect(0, floorY - 14, LW, 9);
    ctx.fillStyle = '#f5c000';
    ctx.fillRect(0, floorY - 5, LW, 5);

    // 스포트라이트
    const spot = ctx.createRadialGradient(LW * 0.5, -20, 0, LW * 0.5, -20, LW * 0.75);
    spot.addColorStop(0, 'rgba(255,240,180,0.18)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, LW, LH);

    // 좌우 포인트 기둥
    ctx.fillStyle = 'rgba(255,120,0,0.2)';
    ctx.fillRect(0, 0, 14, floorY);
    ctx.fillRect(LW - 14, 0, 14, floorY);

    // 게임 타이틀
    ctx.fillStyle = '#ffdd33';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HAIKYUU', LW / 2, 105);
    ctx.fillStyle = '#ff8c00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('VOLLEYBALL', LW / 2, 152);

    // 메뉴 항목
    const ITEMS = ['싱글 플레이  (vs AI)', '멀티 플레이  (2P)'];
    const ITEM_Y = [255, 315];

    for (let i = 0; i < ITEMS.length; i++) {
      const selected = i === this.#selectedIdx;

      if (selected) {
        ctx.fillStyle = 'rgba(255,140,0,0.22)';
        ctx.beginPath();
        ctx.roundRect(LW / 2 - 170, ITEM_Y[i] - 22, 340, 44, 8);
        ctx.fill();
        ctx.strokeStyle = '#ff8c00';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = selected ? '#ffdd33' : 'rgba(255,255,255,0.5)';
      ctx.font = selected ? 'bold 22px monospace' : '22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((selected ? '▶  ' : '    ') + ITEMS[i], LW / 2, ITEM_Y[i]);
    }

    // 조작 안내
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('↑↓ 선택  /  Enter 확인  /  게임 중 Esc — 일시정지  /  일시정지 중 Enter — 타이틀로', LW / 2, LH - 14);
  }
}
