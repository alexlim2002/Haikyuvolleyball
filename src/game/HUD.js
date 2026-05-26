export function drawPauseOverlay(ctx, W, H) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle    = '#fff';
  ctx.font         = 'bold 44px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('일시정지', W / 2, H / 2 - 28);
  ctx.font         = '18px monospace';
  ctx.fillStyle    = 'rgba(255,255,255,0.7)';
  ctx.fillText('Esc — 재개', W / 2, H / 2 + 20);
  ctx.fillText('Shift — 타이틀로', W / 2, H / 2 + 50);
}

export function drawHUD(ctx, state, W, H, botController) {
  // 점수판
  ctx.fillStyle    = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W / 2 - 80, 4, 160, 46);
  ctx.fillStyle    = '#fff';
  ctx.font         = 'bold 30px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${state.score.p1}  :  ${state.score.p2}`, W / 2, 8);
  ctx.font = '13px monospace';
  ctx.fillText(`세트  ${state.sets.p1} - ${state.sets.p2}`, W / 2, 38);

  // 조작 안내
  ctx.font         = '11px monospace';
  ctx.textAlign    = 'left';
  ctx.fillStyle    = 'rgba(255,255,255,0.65)';
  ctx.fillText('1P: AD이동 / W점프 / S리시브 / ShiftL스파이크 / AA·DD다이빙 / WW블로킹 / SS스킬  |  2P: ←→ / ↑↓ / ShiftR', 8, H - 18);

  if (botController) {
    ctx.textAlign = 'right';
    ctx.fillText(`2P AI: ${botController.getCurrentTypeLabel()}`, W - 8, H - 18);
  }

  // 서브 오버레이
  if (state.phase === 'serve') {
    const who  = state.server === 'player1' ? '1P' : '2P';
    const key  = state.server === 'player1' ? 'ShiftRight' : 'ShiftLeft';
    const step = state.serveStep === 'ready' ? `${key}: 토스` : `${key}: 서브`;
    ctx.fillStyle    = 'rgba(0,0,0,0.28)';
    ctx.fillRect(W / 2 - 160, H / 2 - 30, 320, 54);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 20px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${who} 서브 — ${step}`, W / 2, H / 2);
  }

  // 득점 오버레이
  if (state.phase === 'point') {
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 52px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('득점!', W / 2, H / 2);
  }

  // 게임오버 오버레이
  if (state.phase === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(0, 0, W, H);
    const winner = state.sets.p1 > state.sets.p2 ? '1P' : '2P';
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 52px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${winner} 승리!`, W / 2, H / 2 - 24);
    ctx.font = '24px monospace';
    ctx.fillText(`${state.sets.p1} - ${state.sets.p2}`, W / 2, H / 2 + 30);
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Shift — 타이틀로', W / 2, H / 2 + 72);
  }
}
