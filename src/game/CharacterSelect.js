import { CHARACTERS } from './Characters.js';

const LW = 800, LH = 450;
const CARD_W = 120, CARD_H = 160, CARD_GAP = 20;
const TOTAL_W = CHARACTERS.length * CARD_W + (CHARACTERS.length - 1) * CARD_GAP;
const START_X = (LW - TOTAL_W) / 2;

export class CharacterSelect {
  #assets;
  #p1Idx = 0;
  #p2Idx = 1;
  #p1Done = false;
  #p2Done = false;
  #prev1 = false;
  #prev2 = false;
  #prevL1 = false; #prevR1 = false;
  #prevL2 = false; #prevR2 = false;
  #onComplete;

  constructor(assets, onComplete) {
    this.#assets = assets;
    this.#onComplete = onComplete;
  }

  tick(inputs) {
    if (this.#p1Done && this.#p2Done) return;

    // 1P: Arrow keys + ShiftRight
    const L1 = !!inputs['1P_LEFT'];
    const R1 = !!inputs['1P_RIGHT'];
    const A1 = !!inputs['1P_ACTION'];
    if (!this.#p1Done) {
      if (L1 && !this.#prevL1) this.#p1Idx = (this.#p1Idx - 1 + CHARACTERS.length) % CHARACTERS.length;
      if (R1 && !this.#prevR1) this.#p1Idx = (this.#p1Idx + 1) % CHARACTERS.length;
      if (A1 && !this.#prev1) this.#p1Done = true;
    }
    this.#prevL1 = L1; this.#prevR1 = R1; this.#prev1 = A1;

    // 2P: WASD + ShiftLeft
    const L2 = !!inputs['2P_LEFT'];
    const R2 = !!inputs['2P_RIGHT'];
    const A2 = !!inputs['2P_ACTION'];
    if (!this.#p2Done) {
      if (L2 && !this.#prevL2) this.#p2Idx = (this.#p2Idx - 1 + CHARACTERS.length) % CHARACTERS.length;
      if (R2 && !this.#prevR2) this.#p2Idx = (this.#p2Idx + 1) % CHARACTERS.length;
      if (A2 && !this.#prev2) this.#p2Done = true;
    }
    this.#prevL2 = L2; this.#prevR2 = R2; this.#prev2 = A2;

    if (this.#p1Done && this.#p2Done) {
      this.#onComplete(CHARACTERS[this.#p1Idx], CHARACTERS[this.#p2Idx]);
    }
  }

  draw(ctx) {
    // 배경
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, LW, LH);

    // 타이틀
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('캐릭터 선택', LW / 2, 24);

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('1P: ←→ 이동 / ShiftRight 선택    2P: A/D 이동 / ShiftLeft 선택', LW / 2, 60);

    const CARDS_Y = 110;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const cx = START_X + i * (CARD_W + CARD_GAP);
      const is1P = i === this.#p1Idx;
      const is2P = i === this.#p2Idx;

      // 카드 배경
      ctx.fillStyle = '#2a3f55';
      ctx.beginPath();
      ctx.roundRect(cx, CARDS_Y, CARD_W, CARD_H, 8);
      ctx.fill();

      // 테두리 (1P=파란색, 2P=주황색, 둘 다=양쪽)
      if (is1P) {
        ctx.strokeStyle = this.#p1Done ? '#44aaff' : '#88ccff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (is2P) {
        ctx.strokeStyle = this.#p2Done ? '#ff8800' : '#ffbb44';
        ctx.lineWidth = is1P ? 2 : 3;
        ctx.beginPath();
        ctx.roundRect(cx + (is1P ? 3 : 0), CARDS_Y + (is1P ? 3 : 0), CARD_W - (is1P ? 6 : 0), CARD_H - (is1P ? 6 : 0), 6);
        ctx.stroke();
      }

      // 스프라이트 (idle frame 0)
      const frames = this.#assets[char.id];
      if (frames && frames.length > 0) {
        const f = frames[0];
        ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, cx + 4, CARDS_Y + 8, CARD_W - 8, CARD_W - 8);
      } else {
        // 스프라이트 없을 때 빈칸 표시
        ctx.fillStyle = '#3a5a7a';
        ctx.fillRect(cx + 4, CARDS_Y + 8, CARD_W - 8, CARD_W - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx + CARD_W / 2, CARDS_Y + 8 + (CARD_W - 8) / 2);
      }

      // 이름
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(char.name, cx + CARD_W / 2, CARDS_Y + CARD_W);

      // 서브 타입 뱃지
      const badgeY = CARDS_Y + CARD_W + 20;
      ctx.font = '10px monospace';
      for (let j = 0; j < char.serveTypes.length; j++) {
        const label = { JUMP: '점프', OVERHAND: '오버', UNDERHAND: '언더' }[char.serveTypes[j]] ?? char.serveTypes[j];
        const bx = cx + 8 + j * 36;
        ctx.fillStyle = { JUMP: '#cc4444', OVERHAND: '#4488cc', UNDERHAND: '#44aa66' }[char.serveTypes[j]] ?? '#888';
        ctx.beginPath();
        ctx.roundRect(bx, badgeY, 32, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + 16, badgeY + 7);
      }

      // 커서 레이블
      if (is1P) {
        ctx.fillStyle = this.#p1Done ? '#44aaff' : '#88ccff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.#p1Done ? '1P ✓' : '▼ 1P', cx + CARD_W / 2, CARDS_Y - 4);
      }
      if (is2P) {
        ctx.fillStyle = this.#p2Done ? '#ff8800' : '#ffbb44';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.#p2Done ? '2P ✓' : '▲ 2P', cx + CARD_W / 2, CARDS_Y + CARD_H + 4);
      }
    }
  }
}
