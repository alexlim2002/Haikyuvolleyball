import { resolveBody } from '../engine/Physics.js';
import { FLOOR_OFFSET } from '../engine/Renderer.js';

const LW = 800, LH = 450;

function px(x) { return x * LW; }
function py(y) { return LH - FLOOR_OFFSET - y * LW; }

// GameLoop#extendArm 시각화용 복사본
function extendArm(body, actionType, facing, armLength) {
  if (body.shape !== 'capsule' || armLength <= 0) return body;
  if (Math.abs(Math.cos(body.angle)) > 0.1) return body;
  if (actionType === 'BLOCK') return { ...body, wy: body.wy + armLength / 2, length: body.length + armLength };
  if (actionType === 'DIVE')  return { ...body, angle: 0, wx: body.wx + facing * armLength / 2, length: body.length + armLength };
  return body;
}

function drawCapsule(ctx, b) {
  const half   = b.length / 2;
  const cos    = Math.cos(b.angle), sin = Math.sin(b.angle);
  const r      = b.r * LW;
  const ax     = px(b.wx + cos * half), ay  = py(b.wy + sin * half);
  const bx     = px(b.wx - cos * half), by_ = py(b.wy - sin * half);
  const cAngle = Math.atan2(by_ - ay, bx - ax);
  const segLen = Math.hypot(bx - ax, by_ - ay);
  ctx.save();
  ctx.translate((ax + bx) / 2, (ay + by_) / 2);
  ctx.rotate(cAngle);
  ctx.beginPath(); ctx.rect(-segLen / 2, -r, segLen, 2 * r); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(ax,  ay, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx, by_, r, 0, Math.PI * 2); ctx.fill();
}

export function drawHitboxes(ctx, buf, entityManager) {
  ctx.save();

  for (const entity of entityManager.getAll()) {
    const es = buf[entity.id];
    if (!es || !entity.actions) continue;

    const actionDef = entity.actions[es.actionType] ?? entity.actions.DEFAULT;
    if (!actionDef?.getHitbox) continue;

    const t        = actionDef.duration > 0 ? es.actionTick / actionDef.duration : 0;
    const facing   = es.facing ?? 1;
    const armLen   = entity.armLength ?? 0;
    const bodyDefs = actionDef.getHitbox(t, facing);

    const fill = entity.role === 'ball'       ? 'rgba(0,255,255,0.35)'
               : entity.role === 'net'        ? 'rgba(255,255,0,0.35)'
               : entity.playerSide === 'left' ? 'rgba(0,255,136,0.35)'
               : 'rgba(255,102,0,0.35)';
    const labelColor = fill.replace('0.35', '1');

    ctx.fillStyle = fill;

    for (const bodyDef of bodyDefs) {
      const b = extendArm(resolveBody(es.x, es.y, bodyDef), es.actionType, facing, armLen);
      if (b.shape === 'circle') {
        ctx.beginPath(); ctx.arc(px(b.wx), py(b.wy), b.r * LW, 0, Math.PI * 2); ctx.fill();
      } else if (b.shape === 'capsule') {
        drawCapsule(ctx, b);
      }
    }

    if (es.actionType === 'SPIKE' && armLen > 0) {
      const armDef = bodyDefs.find(b => b.isArm);
      if (armDef) {
        const arm  = resolveBody(es.x, es.y, armDef);
        const half = arm.length / 2;
        const cos  = Math.cos(arm.angle), sin = Math.sin(arm.angle);
        const y1   = arm.wy + sin * half, y2 = arm.wy - sin * half;
        const topX = y1 >= y2 ? arm.wx + cos * half : arm.wx - cos * half;
        const topY = Math.max(y1, y2);
        ctx.fillStyle = fill.replace('0.35', '0.15');
        ctx.beginPath(); ctx.arc(px(topX), py(topY), armLen * LW, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (es.actionType === 'RECEIVE' && actionDef.actionRange) {
      const { ox, oy, r } = actionDef.actionRange;
      ctx.fillStyle = fill.replace('0.35', '0.15');
      ctx.beginPath(); ctx.arc(px(es.x + ox), py(es.y + oy), r * LW, 0, Math.PI * 2); ctx.fill();
    }

    if (entity.role === 'player') {
      const label = entity.playerSide === 'left' ? '1P' : '2P';
      ctx.fillStyle    = labelColor;
      ctx.font         = 'bold 13px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, px(es.x), py(es.y + 0.13));
    }
  }

  // 서브 범위 시각화 (tossed 단계)
  if (buf.phase === 'serve' && buf.serveStep === 'tossed') {
    const ss = buf[buf.server];
    if (ss) {
      const ARM    = 35;
      const facDir = buf.serverSide === 'left' ? 1 : -1;
      const spx    = px(ss.x);
      const footPY = py(ss.y);
      const headPY = py(ss.y + 80 / LW);

      const ovX    = facDir === 1 ? spx : spx - ARM;
      const ovTopY = headPY - ARM;
      ctx.fillStyle   = 'rgba(255,220,0,0.20)';
      ctx.strokeStyle = 'rgba(255,220,0,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(ovX, ovTopY, ARM, ARM);
      ctx.strokeRect(ovX, ovTopY, ARM, ARM);
      ctx.fillStyle = 'rgba(255,220,0,0.9)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('오버핸드', ovX + ARM / 2, ovTopY - 2);

      const unX = facDir === 1 ? spx : spx - ARM;
      ctx.fillStyle   = 'rgba(80,200,255,0.20)';
      ctx.strokeStyle = 'rgba(80,200,255,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(unX, headPY, ARM, footPY - headPY);
      ctx.strokeRect(unX, headPY, ARM, footPY - headPY);
      ctx.fillStyle = 'rgba(80,200,255,0.9)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('언더핸드', unX + ARM / 2, footPY - 2);
    }
  }

  ctx.restore();
}
