import { DEFAULT_BINDINGS, DOUBLE_DEFAULTS, keyName } from './KeyBindings.js';
import { saveSoundSettings } from './SoundSettings.js';

const LW = 800, LH = 450;

const ACTION_KEYS = ['left', 'right', 'up', 'down', 'action', 'diveLeft', 'diveRight', 'block'];
const LABELS = {
  left: '이동 왼쪽', right: '이동 오른쪽', up: '점프', down: '리시브',
  action: '스파이크/서브', diveLeft: '다이빙 왼쪽', diveRight: '다이빙 오른쪽', block: '블로킹',
};
const NULLABLE = new Set(['diveLeft', 'diveRight', 'block']);
const RESERVED  = new Set(['Enter', 'Escape', 'Tab']);

const ROW_START = 66;
const ROW_H     = 34;
const KEY_ROWS  = ACTION_KEYS.length;        // 8
const BGM_ROW   = KEY_ROWS;                  // 8
const SFX_ROW   = KEY_ROWS + 1;             // 9
const RESET_ROW = KEY_ROWS + 2;             // 10
const TOTAL_ROWS = RESET_ROW + 1;           // 11

const LABEL_X  = 205;
const P_CX     = [350, 580];
const P_CW     = [155, 175];
const COLORS   = ['#44aaff', '#ff8844'];

export class ControlsConfig {
  #b;
  #sound;
  #row = 0;
  #col = 0;
  #listening = null;
  #prevUp = false; #prevDown = false; #prevLeft = false;
  #prevRight = false; #prevConfirm = false;
  #onSave;
  #onSoundSave;
  #keyHandler;

  constructor(bindings, soundSettings, onSave, onSoundSave) {
    this.#b = structuredClone(bindings);
    this.#sound = { ...soundSettings };
    this.#onSave = onSave;
    this.#onSoundSave = onSoundSave;

    this.#keyHandler = (e) => {
      if (!this.#listening) {
        if ((e.code === 'Delete' || e.code === 'Backspace') && this.#row < KEY_ROWS) {
          const action = ACTION_KEYS[this.#row];
          if (NULLABLE.has(action)) {
            const p = this.#col === 0 ? 'p1' : 'p2';
            if (this.#b[p][action] !== null) {
              this.#b[p][action] = null;
              this.#onSave(structuredClone(this.#b));
            }
          }
        }
        return;
      }

      e.preventDefault();
      if (e.code === 'Escape') { this.#listening = null; return; }
      if (RESERVED.has(e.code)) return;

      const { row, col } = this.#listening;
      const p = col === 0 ? 'p1' : 'p2';
      this.#b[p][ACTION_KEYS[row]] = e.code;
      this.#listening = null;
      this.#onSave(structuredClone(this.#b));
    };

    document.addEventListener('keydown', this.#keyHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.#keyHandler);
  }

  tick(inputs) {
    if (this.#listening) return;

    const up      = !!(inputs['1P_UP']      || inputs['2P_UP']);
    const down    = !!(inputs['1P_DOWN']    || inputs['2P_DOWN']);
    const left    = !!(inputs['1P_LEFT']    || inputs['2P_LEFT']);
    const right   = !!(inputs['1P_RIGHT']   || inputs['2P_RIGHT']);
    const confirm = !!(inputs['1P_CONFIRM'] || inputs['2P_CONFIRM']);

    if (up    && !this.#prevUp)    this.#row = (this.#row - 1 + TOTAL_ROWS) % TOTAL_ROWS;
    if (down  && !this.#prevDown)  this.#row = (this.#row + 1) % TOTAL_ROWS;
    if (this.#row < KEY_ROWS) {
      if (left  && !this.#prevLeft)  this.#col = 0;
      if (right && !this.#prevRight) this.#col = 1;
    }

    if (confirm && !this.#prevConfirm) {
      if (this.#row === RESET_ROW) {
        this.#b = structuredClone(DEFAULT_BINDINGS);
        this.#onSave(structuredClone(this.#b));
      } else if (this.#row === BGM_ROW) {
        this.#sound.bgm = !this.#sound.bgm;
        this.#onSoundSave({ ...this.#sound });
      } else if (this.#row === SFX_ROW) {
        this.#sound.sfx = !this.#sound.sfx;
        this.#onSoundSave({ ...this.#sound });
      } else {
        this.#listening = { row: this.#row, col: this.#col };
      }
    }

    this.#prevUp = up; this.#prevDown = down; this.#prevLeft = left;
    this.#prevRight = right; this.#prevConfirm = confirm;
  }

  #drawToggleRow(ctx, label, enabled, rowIdx) {
    const y = ROW_START + rowIdx * ROW_H;
    const mid = y + ROW_H / 2;
    const isCursor = this.#row === rowIdx;

    ctx.fillStyle = isCursor ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = isCursor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(20, y + 4, LW - 40, ROW_H - 8, 4);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 36, mid);

    const btnW = 52, btnH = 20;
    const btnX = LW - 36 - btnW, btnY = mid - btnH / 2;
    ctx.fillStyle = enabled ? 'rgba(68,220,100,0.25)' : 'rgba(180,40,40,0.25)';
    ctx.strokeStyle = enabled ? '#44dd66' : '#cc4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = enabled ? '#88ffaa' : '#ff8888';
    ctx.font = isCursor ? 'bold 12px monospace' : '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(enabled ? 'ON' : 'OFF', btnX + btnW / 2, mid);
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(5,10,25,0.95)';
    ctx.fillRect(0, 0, LW, LH);

    ctx.fillStyle = '#ffdd33';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('조작 설정', LW / 2, 12);

    for (let ci = 0; ci < 2; ci++) {
      ctx.fillStyle = COLORS[ci];
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ci + 1}P`, P_CX[ci], 46);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, 62); ctx.lineTo(LW - 20, 62); ctx.stroke();

    // 키 바인딩 행
    for (let ri = 0; ri < KEY_ROWS; ri++) {
      const action = ACTION_KEYS[ri];
      const y = ROW_START + ri * ROW_H;
      const mid = y + ROW_H / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[action], LABEL_X, mid);

      for (let ci = 0; ci < 2; ci++) {
        const p = ci === 0 ? 'p1' : 'p2';
        const isCursor   = this.#row === ri && this.#col === ci;
        const isListening = this.#listening?.row === ri && this.#listening?.col === ci;
        const bound      = this.#b[p][action];
        const isNullable = NULLABLE.has(action);
        const cx = P_CX[ci], cw = P_CW[ci];

        if (isListening) {
          ctx.fillStyle   = 'rgba(255,220,0,0.2)';
          ctx.strokeStyle = '#ffdd00';
        } else if (isCursor) {
          ctx.fillStyle   = ci === 0 ? 'rgba(68,170,255,0.18)' : 'rgba(255,136,68,0.18)';
          ctx.strokeStyle = COLORS[ci];
        } else {
          ctx.fillStyle   = 'rgba(255,255,255,0.04)';
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        }
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx - cw / 2, y + 4, cw, ROW_H - 8, 4);
        ctx.fill(); ctx.stroke();

        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        if (isListening) {
          ctx.fillStyle = '#ffdd00';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('키 입력...', cx, mid);
        } else if (isNullable && bound === null) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '11px monospace';
          ctx.fillText(DOUBLE_DEFAULTS[p][action], cx, mid);
        } else {
          ctx.fillStyle = isCursor ? '#ffffff' : 'rgba(255,255,255,0.72)';
          ctx.font = isCursor ? 'bold 13px monospace' : '13px monospace';
          ctx.fillText(keyName(bound), cx, mid);
          if (isCursor && isNullable && bound) {
            ctx.fillStyle = 'rgba(255,120,120,0.9)';
            ctx.font = 'bold 9px monospace';
            ctx.fillText('Del: 더블탭 복원', cx, y + ROW_H - 4);
          }
        }
      }
    }

    // 사운드 구분선
    const divY = ROW_START + KEY_ROWS * ROW_H + 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, divY); ctx.lineTo(LW - 20, divY); ctx.stroke();

    // 사운드 토글 행
    this.#drawToggleRow(ctx, '배경음악', this.#sound.bgm, BGM_ROW);
    this.#drawToggleRow(ctx, '효과음',   this.#sound.sfx, SFX_ROW);

    // 초기화 버튼
    const rstY = ROW_START + RESET_ROW * ROW_H + 4;
    const isReset = this.#row === RESET_ROW;
    ctx.fillStyle   = isReset ? 'rgba(255,80,80,0.25)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = isReset ? '#ff6666' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(LW / 2 - 130, rstY, 260, 28, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle    = isReset ? '#ff9999' : 'rgba(255,255,255,0.52)';
    ctx.font         = isReset ? 'bold 13px monospace' : '13px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('키 바인딩 기본값으로 초기화', LW / 2, rstY + 14);

    ctx.fillStyle    = 'rgba(255,255,255,0.38)';
    ctx.font         = '11px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('↑↓ 이동  /  ←→ 플레이어  /  Enter 설정·토글  /  Del 더블탭 복원  /  Esc 닫기', LW / 2, LH - 8);
  }
}
