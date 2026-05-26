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
  ctx.fillText('Enter — 타이틀로', W / 2, H / 2 + 50);
}

function drawStaminaBar(ctx, stamina, maxStamina, x, y, w, h) {
  const ratio = maxStamina > 0 ? Math.max(0, stamina / maxStamina) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, h);
  const color = ratio > 0.5 ? '#44dd44' : ratio > 0.25 ? '#dddd22' : '#dd4444';
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * ratio, h);
}

export function drawHUD(ctx, state, W, H, botController, entityManager) {
  // 스태미나 바 (캐릭터 위)
  if (state.player1 && entityManager) {
    const p1 = state.player1;
    const e1 = entityManager.get('player1');
    if (e1?.maxStamina) {
      const sx = (p1.x / 1) * W;
      const sy = H - (p1.y / 0.5625) * H - (e1.size.h / 0.5625) * H - 8;
      drawStaminaBar(ctx, p1.stamina, e1.maxStamina, sx - 24, sy, 48, 5);
    }
  }
  if (state.player2 && entityManager) {
    const p2 = state.player2;
    const e2 = entityManager.get('player2');
    if (e2?.maxStamina) {
      const sx = (p2.x / 1) * W;
      const sy = H - (p2.y / 0.5625) * H - (e2.size.h / 0.5625) * H - 8;
      drawStaminaBar(ctx, p2.stamina, e2.maxStamina, sx - 24, sy, 48, 5);
    }
  }

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
  ctx.fillText('1P: AD이동 / W점프 / S리시브 / ShiftL스파이크 / AA·DD다이빙 / WW블로킹  |  2P: ←→ / ↑↓ / ShiftR', 8, H - 18);

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
    ctx.fillText('Enter — 타이틀로', W / 2, H / 2 + 72);
  }
}
