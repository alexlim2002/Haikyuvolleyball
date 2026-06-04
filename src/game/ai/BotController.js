const AI_PROFILE_IDS = ["aggressive", "defensive", "rally"];

const BOT_LABELS = {
  aggressive: "공격형",
  defensive: "수비형",
  rally: "랠리형",
  attack: "공격형",
  defense: "수비형",
};

const UNIT = 800;
const DEFAULTS = {
  playerId: "player2",
  playerSide: "right",
  opponentId: "player1",
  mapWidth: 1,
  mapHeight: 0.5625,
  ballGravity: 0.05 / UNIT,
  ballRadius: 18 / UNIT,
  playerWidth: 80 / UNIT,
  playerHeight: 80 / UNIT,
  netWidth: 10 / UNIT,
  netHeight: 200 / UNIT,
  armLength: 35 / UNIT,
  playerSpeed: 5 / UNIT,
  moveMargin: 9 / UNIT,
  maxStamina: null,
  profile: null,
  forcedType: null,
  serveTypes: ["OVERHAND", "UNDERHAND"],
};

const SIMPLE_AI = {
  moveDeadZone: 12 / UNIT,
  receiveXRange: 88 / UNIT,
  serveReceiveXRange: 116 / UNIT,
  receiveYMax: 145 / UNIT,
  serveReceiveYMax: 168 / UNIT,
  receiveEmergencyY: 82 / UNIT,
  diveYMax: 76 / UNIT,
  serveDiveYMax: 62 / UNIT,
  diveXMin: 70 / UNIT,
  diveXMax: 260 / UNIT,
  attackXRange: 58 / UNIT,
  attackYMin: 162 / UNIT,
  attackYMax: 318 / UNIT,
  attackYWindow: 72 / UNIT,
  attackApproachTowardNet: 22 / UNIT,
  maxPredictionTicks: 150,
  minShiftInterval: 58,
  minDiveInterval: 78,
  minReceiveInterval: 11,
  minJumpInterval: 18,
  postReceiveFollowTicks: 72,
  lowStaminaThreshold: 0.35,
  criticalStaminaThreshold: 0.18,
  receiveSuppressLimit: 2,
  servePrepareTicks: 2,
  underhandTossWaitTicks: 18,
  underhandFallbackHitTicks: 62,
  jumpServeWaitTicks: 44,
  jumpServeMinAirTicks: 12,
  jumpServeFallbackTicks: 82,
};

const PROFILE_TUNING = {
  aggressive: { homeRatio: 0.62, attackExtra: 0.06, receiveExtra: 0, preferJumpServe: true },
  defensive: { homeRatio: 0.72, attackExtra: -0.02, receiveExtra: 0.035, preferJumpServe: false },
  rally: { homeRatio: 0.67, attackExtra: 0.015, receiveExtra: 0.02, preferJumpServe: true },
};

const PLANS = {
  WAIT: "WAIT",
  RECEIVE: "RECEIVE",
  RECOVER_AFTER_RECEIVE: "RECOVER_AFTER_RECEIVE",
  ATTACK_PREPARE: "ATTACK_PREPARE",
  JUMP_ATTACK: "JUMP_ATTACK",
  EMERGENCY_DIVE: "EMERGENCY_DIVE",
  SERVE: "SERVE",
};

const ACTIONS = {
  WAIT: "WAIT",
  MOVE: "MOVE",
  RECEIVE: "RECEIVE",
  SERVE_RECEIVE: "SERVE_RECEIVE",
  DIVE: "DIVE",
  JUMP: "JUMP",
  SPIKE: "SPIKE",
  SERVE_TOSS: "SERVE_TOSS",
  SERVE_WAIT: "SERVE_WAIT",
  SERVE_JUMP: "SERVE_JUMP",
  SERVE_HIT: "SERVE_HIT",
};

/**
 * 단순 배구 FSM 기반 AI 컨트롤러.
 * state를 직접 수정하지 않고 한 tick에 최소 입력 스냅샷만 반환한다.
 */
export function createBotController(config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const profileId = resolveProfileId(cfg);
  const profile = PROFILE_TUNING[profileId] ?? PROFILE_TUNING.rally;
  const inputPrefix = cfg.playerSide === "left" ? "1P_" : "2P_";
  const keys = {
    left: `${inputPrefix}LEFT`,
    right: `${inputPrefix}RIGHT`,
    up: `${inputPrefix}UP`,
    down: `${inputPrefix}DOWN`,
    action: `${inputPrefix}ACTION`,
    diveLeft: `${inputPrefix}DOUBLE_LEFT`,
    diveRight: `${inputPrefix}DOUBLE_RIGHT`,
    block: `${inputPrefix}DOUBLE_UP`,
  };

  const memory = {
    tick: 0,
    plan: PLANS.WAIT,
    lastAction: ACTIONS.WAIT,
    lastActionTick: -Infinity,
    lastShiftTick: -Infinity,
    lastDiveTick: -Infinity,
    lastReceiveTick: -Infinity,
    lastJumpTick: -Infinity,
    consecutiveReceiveCount: 0,
    postReceiveUntil: -Infinity,
    serveState: "PREPARE",
    serveTossTick: -Infinity,
    serveHitDone: false,
    debug: {},
  };

  function beginNewRally() {
    memory.tick = 0;
    memory.plan = PLANS.WAIT;
    memory.lastAction = ACTIONS.WAIT;
    memory.lastActionTick = -Infinity;
    memory.lastShiftTick = -Infinity;
    memory.lastDiveTick = -Infinity;
    memory.lastReceiveTick = -Infinity;
    memory.lastJumpTick = -Infinity;
    memory.consecutiveReceiveCount = 0;
    memory.postReceiveUntil = -Infinity;
    memory.serveState = "PREPARE";
    memory.serveTossTick = -Infinity;
    memory.serveHitDone = false;
    memory.debug = {};
  }

  function makeInputs(state = {}) {
    memory.tick += 1;
    const inputs = emptyInputs(keys);
    const context = makeContext(state, cfg, profile, profileId, keys, memory);
    const { player, ball } = context;

    if (!player || !ball) {
      remember(context, ACTIONS.WAIT, null, inputs);
      return inputs;
    }

    if (isMyServe(state, cfg)) {
      playServe(inputs, context);
      return finish(inputs, context);
    }

    resetServeMemoryIfNeeded();
    const ownSide = isBallOnOwnSide(ball, cfg.playerSide, context);
    const incoming = isBallComingToOwnSide(ball, cfg.playerSide, context);
    const lowStamina = isLowStamina(context);

    if (!ownSide && !incoming) {
      memory.consecutiveReceiveCount = 0;
      memory.plan = PLANS.WAIT;
      moveToward(inputs, context, getDefensiveHomeX(context));
      remember(context, ACTIONS.MOVE, getDefensiveHomeX(context), inputs);
      return finish(inputs, context);
    }

    const targetX = chooseReceiveTarget(context);
    const receiveTarget = clampToCourt(targetX, cfg.playerSide, context);
    const playerDist = Math.abs(player.x - receiveTarget);

    if (isOpponentServeThreat(context)) {
      const suppressReceive = shouldSuppressReceive(context);
      if (shouldReceive(context) && !suppressReceive) {
        memory.plan = PLANS.RECEIVE;
        press(inputs, keys.down);
        memory.lastReceiveTick = memory.tick;
        memory.postReceiveUntil = memory.tick + SIMPLE_AI.postReceiveFollowTicks;
        memory.consecutiveReceiveCount += 1;
        remember(context, ACTIONS.SERVE_RECEIVE, ball.x, inputs);
        return finish(inputs, context);
      }
      if (shouldEmergencyDive(context)) {
        memory.plan = PLANS.EMERGENCY_DIVE;
        press(inputs, ball.x < player.x ? keys.diveLeft : keys.diveRight);
        memory.lastDiveTick = memory.tick;
        remember(context, ACTIONS.DIVE, ball.x, inputs);
        return finish(inputs, context);
      }
      memory.plan = PLANS.RECEIVE;
      moveToward(inputs, context, receiveTarget);
      remember(context, inputs[keys.left] || inputs[keys.right] ? ACTIONS.MOVE : ACTIONS.WAIT, receiveTarget, inputs);
      return finish(inputs, context);
    }

    if (canSpikeNow(context)) {
      press(inputs, keys.action);
      memory.lastShiftTick = memory.tick;
      memory.plan = PLANS.JUMP_ATTACK;
      remember(context, ACTIONS.SPIKE, ball.x, inputs);
      return finish(inputs, context);
    }

    const suppressReceive = shouldSuppressReceive(context);
    if (shouldReceive(context) && !suppressReceive) {
      memory.plan = PLANS.RECEIVE;
      press(inputs, keys.down);
      memory.lastReceiveTick = memory.tick;
      memory.postReceiveUntil = memory.tick + SIMPLE_AI.postReceiveFollowTicks;
      memory.consecutiveReceiveCount += 1;
      remember(context, isOpponentServeThreat(context) ? ACTIONS.SERVE_RECEIVE : ACTIONS.RECEIVE, ball.x, inputs);
      return finish(inputs, context);
    }

    if (shouldEmergencyDive(context)) {
      memory.plan = PLANS.EMERGENCY_DIVE;
      press(inputs, ball.x < player.x ? keys.diveLeft : keys.diveRight);
      memory.lastDiveTick = memory.tick;
      remember(context, ACTIONS.DIVE, ball.x, inputs);
      return finish(inputs, context);
    }

    if (shouldPrepareAttack(context)) {
      memory.plan = memory.tick <= memory.postReceiveUntil ? PLANS.RECOVER_AFTER_RECEIVE : PLANS.ATTACK_PREPARE;
      const attackTarget = clampToCourt(ball.x + getNetDirection(cfg.playerSide) * SIMPLE_AI.attackApproachTowardNet, cfg.playerSide, context);
      if (shouldJumpForAttack(context)) {
        press(inputs, keys.up);
        memory.lastJumpTick = memory.tick;
        memory.plan = PLANS.JUMP_ATTACK;
        remember(context, ACTIONS.JUMP, attackTarget, inputs);
        return finish(inputs, context);
      }
      moveToward(inputs, context, attackTarget);
      remember(context, ACTIONS.MOVE, attackTarget, inputs);
      return finish(inputs, context);
    }

    if (lowStamina && suppressReceive) {
      memory.plan = PLANS.RECOVER_AFTER_RECEIVE;
      const safeTarget = clampToCourt((player.x + getNetDirection(cfg.playerSide) * 0.06 + receiveTarget) / 2, cfg.playerSide, context);
      moveToward(inputs, context, safeTarget);
      remember(context, ACTIONS.MOVE, safeTarget, inputs);
      return finish(inputs, context);
    }

    memory.plan = ownSide || incoming ? PLANS.RECEIVE : PLANS.WAIT;
    moveToward(inputs, context, receiveTarget);
    if (playerDist <= SIMPLE_AI.moveDeadZone && !ownSide && incoming) {
      memory.plan = PLANS.WAIT;
    }
    remember(context, inputs[keys.left] || inputs[keys.right] ? ACTIONS.MOVE : ACTIONS.WAIT, receiveTarget, inputs);
    return finish(inputs, context);
  }

  function finish(inputs, context) {
    context.debug.currentPlan = memory.plan;
    context.debug.plannedFollowUpAction = memory.tick <= memory.postReceiveUntil ? memory.plan : null;
    context.debug.consecutiveReceiveCount = memory.consecutiveReceiveCount;
    context.debug.lastAction = memory.lastAction;
    context.debug.lastActionTick = memory.lastActionTick;
    context.debug.cooldowns = {
      shift: Math.max(0, SIMPLE_AI.minShiftInterval - (memory.tick - memory.lastShiftTick)),
      dive: Math.max(0, SIMPLE_AI.minDiveInterval - (memory.tick - memory.lastDiveTick)),
      receive: Math.max(0, SIMPLE_AI.minReceiveInterval - (memory.tick - memory.lastReceiveTick)),
    };
    memory.debug = context.debug;
    return inputs;
  }

  function resetServeMemoryIfNeeded() {
    if (memory.serveState !== "PREPARE" || memory.serveHitDone) {
      memory.serveState = "PREPARE";
      memory.serveTossTick = -Infinity;
      memory.serveHitDone = false;
    }
  }

  function playServe(inputs, context) {
    const { state, player, ball } = context;
    memory.plan = PLANS.SERVE;

    if (state.serveStep === "ready") {
      if (memory.tick >= SIMPLE_AI.servePrepareTicks) {
        press(inputs, keys.action);
        memory.serveState = "TOSS";
        memory.serveTossTick = memory.tick;
        remember(context, ACTIONS.SERVE_TOSS, ball.x, inputs);
      } else {
        remember(context, ACTIONS.SERVE_WAIT, ball.x, inputs);
      }
      return;
    }

    if (state.serveStep !== "tossed" || memory.serveHitDone) {
      remember(context, ACTIONS.SERVE_WAIT, ball.x, inputs);
      return;
    }

    if (!Number.isFinite(memory.serveTossTick)) {
      memory.serveTossTick = memory.tick;
    }

    const elapsed = memory.tick - memory.serveTossTick;
    const serveType = getBotServeType(context);
    const headY = player.y + context.playerHeight;
    const withinFront = isBallInServeXWindow(context);

    if (serveType === "JUMP") {
      if (
        player.onGround !== false &&
        elapsed >= SIMPLE_AI.jumpServeWaitTicks &&
        ball.vy <= 0 &&
        ball.y >= headY + context.armLength * 0.35 &&
        memory.tick - memory.lastJumpTick >= SIMPLE_AI.minJumpInterval
      ) {
        press(inputs, keys.up);
        memory.lastJumpTick = memory.tick;
        remember(context, ACTIONS.SERVE_JUMP, ball.x, inputs);
        return;
      }
      const airTicks = memory.tick - memory.lastJumpTick;
      if (
        player.onGround === false &&
        airTicks >= SIMPLE_AI.jumpServeMinAirTicks &&
        elapsed >= SIMPLE_AI.jumpServeWaitTicks + SIMPLE_AI.jumpServeMinAirTicks &&
        withinFront &&
        ball.vy <= 0 &&
        ball.y >= headY - context.armLength * 0.15 &&
        ball.y <= headY + context.armLength * 1.05
      ) {
        press(inputs, keys.action);
        memory.lastShiftTick = memory.tick;
        memory.serveHitDone = true;
        remember(context, ACTIONS.SERVE_HIT, ball.x, inputs);
        return;
      }
      if (
        elapsed >= SIMPLE_AI.jumpServeFallbackTicks &&
        player.onGround !== false &&
        withinFront &&
        ball.y >= player.y &&
        ball.y <= headY + context.armLength &&
        ball.vy <= 0
      ) {
        press(inputs, keys.action);
        memory.lastShiftTick = memory.tick;
        memory.serveHitDone = true;
        remember(context, ACTIONS.SERVE_HIT, ball.x, inputs);
        return;
      }
      remember(context, ACTIONS.SERVE_WAIT, ball.x, inputs);
      return;
    }

    const underhandWindow = ball.y >= player.y && ball.y < headY - 2 / UNIT;
    const overhandWindow = serveType === "OVERHAND" && ball.y >= headY && ball.y <= headY + context.armLength;
    const lateUnderhandFallback = serveType === "UNDERHAND" && elapsed >= SIMPLE_AI.underhandFallbackHitTicks && ball.y >= player.y && ball.y < headY;
    if (
      elapsed >= SIMPLE_AI.underhandTossWaitTicks &&
      withinFront &&
      ball.vy <= 0 &&
      (underhandWindow || overhandWindow || lateUnderhandFallback)
    ) {
      press(inputs, keys.action);
      memory.lastShiftTick = memory.tick;
      memory.serveHitDone = true;
      remember(context, ACTIONS.SERVE_HIT, ball.x, inputs);
      return;
    }
    remember(context, ACTIONS.SERVE_WAIT, ball.x, inputs);
  }

  function getCurrentTypeLabel() {
    return BOT_LABELS[profileId] ?? BOT_LABELS.rally;
  }

  function getCurrentTypeId() {
    return profileId;
  }

  function getDebugInfo() {
    return { ...memory.debug };
  }

  return { beginNewRally, makeInputs, getCurrentTypeLabel, getCurrentTypeId, getDebugInfo };
}

function makeContext(state, cfg, profile, profileId, keys, memory) {
  const player = state?.[cfg.playerId] ?? null;
  const opponent = state?.[cfg.opponentId] ?? null;
  const ball = state?.ball ?? null;
  const mapWidth = finiteNumber(cfg.mapWidth, DEFAULTS.mapWidth);
  const netX = finiteNumber(state?.net?.x, mapWidth / 2);
  const playerHeight = finiteNumber(player?.size?.h, cfg.playerHeight);
  const playerWidth = finiteNumber(player?.size?.w, cfg.playerWidth);
  const armLength = finiteNumber(player?.armLength, cfg.armLength);
  const prediction = predictBallLanding(state, cfg.playerSide, {
    ...cfg,
    mapWidth,
    netX,
    maxPredictionTicks: SIMPLE_AI.maxPredictionTicks,
  });
  const stamina = getStamina(player, cfg);
  const staminaRatio = getStaminaRatio(player, cfg);
  const debug = {
    profile: profileId,
    profileLabel: BOT_LABELS[profileId] ?? BOT_LABELS.rally,
    selectedAction: ACTIONS.WAIT,
    currentPlan: memory.plan,
    predictedLandingX: prediction.landingX,
    predictedLandingTick: prediction.landingTick,
    receiveTargetX: choosePredictionTarget(prediction),
    firstOwnCourtTick: prediction.firstOwnPoint?.tick ?? null,
    interceptTick: prediction.intercept?.tick ?? null,
    ballSpeed: ball ? Math.hypot(finiteNumber(ball.vx, 0), finiteNumber(ball.vy, 0)) : 0,
    stamina,
    staminaRatio,
    targetX: null,
    targetMode: null,
  };
  return {
    state,
    cfg,
    profile,
    profileId,
    keys,
    memory,
    player,
    opponent,
    ball,
    mapWidth,
    netX,
    playerHeight,
    playerWidth,
    armLength,
    prediction,
    stamina,
    staminaRatio,
    debug,
  };
}

function remember(context, action, targetX, inputs) {
  context.memory.lastAction = action;
  context.memory.lastActionTick = context.memory.tick;
  context.debug.selectedAction = action;
  context.debug.targetX = targetX;
  context.debug.targetMode = context.memory.plan;
  context.debug.inputs = { ...inputs };
}

function emptyInputs(keys) {
  return {
    [keys.left]: false,
    [keys.right]: false,
    [keys.up]: false,
    [keys.down]: false,
    [keys.action]: false,
    [keys.diveLeft]: false,
    [keys.diveRight]: false,
    [keys.block]: false,
  };
}

function press(inputs, key) {
  if (key) inputs[key] = true;
}

function moveToward(inputs, context, targetX) {
  const { player, keys } = context;
  if (!player || !Number.isFinite(targetX)) return false;
  const dx = targetX - player.x;
  if (Math.abs(dx) <= SIMPLE_AI.moveDeadZone) return false;
  press(inputs, dx < 0 ? keys.left : keys.right);
  return true;
}

function chooseReceiveTarget(context) {
  return clampToCourt(choosePredictionTarget(context.prediction), context.cfg.playerSide, context);
}

function choosePredictionTarget(prediction) {
  return prediction?.intercept?.x ?? prediction?.firstOwnPoint?.x ?? prediction?.landingX ?? 0.5;
}

function shouldReceive(context) {
  const { player, ball, cfg, memory, profile } = context;
  if (!player || !ball || player.onGround === false) return false;
  if (!isBallOnOwnSide(ball, cfg.playerSide, context)) return false;
  if (memory.tick - memory.lastReceiveTick < SIMPLE_AI.minReceiveInterval) return false;
  const serveThreat = isOpponentServeThreat(context);
  const xRange = (serveThreat ? SIMPLE_AI.serveReceiveXRange : SIMPLE_AI.receiveXRange) + profile.receiveExtra;
  const targetX = chooseReceiveTarget(context);
  const nearBall = Math.abs(ball.x - player.x) <= xRange;
  const waitingAtLanding = Math.abs(player.x - targetX) <= SIMPLE_AI.moveDeadZone * 1.8 && Math.abs(ball.x - player.x) <= xRange + 26 / UNIT;
  const lowEnough = ball.y <= (serveThreat ? SIMPLE_AI.serveReceiveYMax : SIMPLE_AI.receiveYMax);
  const fallingOrFast = ball.vy <= 0.003 || Math.hypot(ball.vx ?? 0, ball.vy ?? 0) > 8 / UNIT;
  return (nearBall || waitingAtLanding) && lowEnough && fallingOrFast;
}

function shouldSuppressReceive(context) {
  const { memory, ball } = context;
  if (!isLowStamina(context)) return false;
  if (memory.consecutiveReceiveCount < SIMPLE_AI.receiveSuppressLimit) return false;
  if (!ball) return true;
  return ball.y > SIMPLE_AI.receiveEmergencyY;
}

function shouldEmergencyDive(context) {
  const { player, ball, cfg, memory } = context;
  if (!player || !ball || player.onGround === false) return false;
  if (!isBallOnOwnSide(ball, cfg.playerSide, context)) return false;
  const serveThreat = isOpponentServeThreat(context);
  const maxDiveY = serveThreat ? SIMPLE_AI.serveDiveYMax : SIMPLE_AI.diveYMax;
  if (memory.tick - memory.lastDiveTick < SIMPLE_AI.minDiveInterval) return false;
  if (ball.y > maxDiveY) return false;
  if (context.staminaRatio <= SIMPLE_AI.criticalStaminaThreshold) return false;
  if (isLowStamina(context) && ball.y > SIMPLE_AI.receiveEmergencyY * 0.62) return false;
  const targetX = chooseReceiveTarget(context);
  const distance = Math.abs(player.x - targetX);
  const ballDistance = Math.abs(player.x - ball.x);
  const reachable = canReachByWalking(context, targetX);
  const farEnough = distance >= SIMPLE_AI.diveXMin || ballDistance >= SIMPLE_AI.diveXMin;
  return farEnough && distance <= SIMPLE_AI.diveXMax && !reachable;
}

function shouldPrepareAttack(context) {
  const { player, ball, cfg, memory, profile } = context;
  if (!player || !ball) return false;
  if (!isBallOnOwnSide(ball, cfg.playerSide, context)) return false;
  if (isLowStamina(context)) return memory.tick <= memory.postReceiveUntil && ball.y >= SIMPLE_AI.attackYMin + 0.04;
  const highEnough = ball.y >= SIMPLE_AI.attackYMin + profile.attackExtra;
  const notTooHigh = ball.y <= SIMPLE_AI.attackYMax + 0.08;
  const follow = memory.tick <= memory.postReceiveUntil && ball.y >= 0.16;
  return (highEnough && notTooHigh) || follow;
}

function shouldJumpForAttack(context) {
  const { player, ball, memory } = context;
  if (!player || !ball || player.onGround === false) return false;
  if (isLowStamina(context)) return false;
  if (memory.tick - memory.lastJumpTick < SIMPLE_AI.minJumpInterval) return false;
  if (Math.abs(player.x - ball.x) > SIMPLE_AI.attackXRange * 1.25) return false;
  return ball.y >= SIMPLE_AI.attackYMin && ball.y <= SIMPLE_AI.attackYMax;
}

function canSpikeNow(context) {
  const { player, ball, cfg, memory } = context;
  if (!player || !ball) return false;
  if (player.onGround !== false) return false;
  if (!isBallOnOwnSide(ball, cfg.playerSide, context)) return false;
  if (isLowStamina(context)) return false;
  if (memory.tick - memory.lastShiftTick < SIMPLE_AI.minShiftInterval) return false;
  if (![PLANS.JUMP_ATTACK, PLANS.ATTACK_PREPARE, PLANS.RECOVER_AFTER_RECEIVE].includes(memory.plan)) {
    const airborneAction = /JUMP|BLOCK/.test(String(player.actionType ?? ""));
    if (!airborneAction && memory.tick > memory.postReceiveUntil) return false;
  }
  if (!isFacingOpponentCourt(player, cfg.playerSide)) return false;
  if (Math.abs(player.x - ball.x) > SIMPLE_AI.attackXRange) return false;
  const hitY = player.y + context.playerHeight;
  if (ball.y < SIMPLE_AI.attackYMin) return false;
  return Math.abs(ball.y - hitY) <= SIMPLE_AI.attackYWindow;
}

function canReachByWalking(context, targetX) {
  const { player, prediction, cfg, ball } = context;
  const timeCandidates = [prediction.intercept?.tick, prediction.landingTick].filter(Number.isFinite);
  const ticks = Math.max(1, Math.min(...(timeCandidates.length ? timeCandidates : [18])));
  const speed = finiteNumber(cfg.playerSpeed, DEFAULTS.playerSpeed) * Math.max(0.45, context.staminaRatio || 1);
  const urgentPenalty = ball && ball.y <= SIMPLE_AI.diveYMax ? 8 / UNIT : 18 / UNIT;
  return Math.abs(player.x - targetX) <= speed * ticks + urgentPenalty;
}

function isOpponentServeThreat(context) {
  const { state, cfg, opponent, ball } = context;
  if (!state || !ball) return false;
  if (state.phase === "serve" && state.server === cfg.opponentId) return true;
  if (state.server === cfg.opponentId && ball && !isBallOnOwnSide(ball, cfg.playerSide, context)) return true;
  const opponentAction = String(opponent?.actionType ?? "");
  return state.server === cfg.opponentId && /SERVE|JUMP/.test(opponentAction);
}

function getBotServeType(context) {
  const types = context.cfg.serveTypes ?? [];
  if (types.includes("JUMP") && context.profile.preferJumpServe && !isLowStamina(context)) return "JUMP";
  if (types.includes("UNDERHAND")) return "UNDERHAND";
  if (types.includes("OVERHAND")) return "OVERHAND";
  if (types.includes("JUMP")) return "JUMP";
  return "UNDERHAND";
}

function isBallInServeXWindow(context) {
  const { player, ball, cfg } = context;
  if (!player || !ball) return false;
  const dir = getNetDirection(cfg.playerSide);
  const dx = (ball.x - player.x) * dir;
  return dx > 0 && dx <= context.armLength + 8 / UNIT;
}

function isMyServe(state, cfg) {
  return state?.phase === "serve" && state?.server === cfg.playerId;
}

function isBallOnOwnSide(ball, side, context = {}) {
  if (!ball) return false;
  const netX = finiteNumber(context.netX, finiteNumber(context?.state?.net?.x, 0.5));
  return side === "right" ? ball.x >= netX : ball.x <= netX;
}

function isBallComingToOwnSide(ball, side, context = {}) {
  if (!ball) return false;
  if (isBallOnOwnSide(ball, side, context)) return true;
  const vx = finiteNumber(ball.vx, 0);
  return side === "right" ? vx > 0 : vx < 0;
}

function getNetDirection(side) {
  return side === "right" ? -1 : 1;
}

function isFacingOpponentCourt(player, side) {
  if (!player) return true;
  const dir = getNetDirection(side);
  const facing = finiteNumber(player.facing, dir);
  return side === "right" ? facing < 0 : facing > 0;
}

function getDefensiveHomeX(context) {
  const { cfg, profile, mapWidth, netX } = context;
  const half = mapWidth / 2;
  if (cfg.playerSide === "right") {
    return clampToCourt(netX + half * profile.homeRatio, cfg.playerSide, context);
  }
  return clampToCourt(netX - half * profile.homeRatio, cfg.playerSide, context);
}

function isLowStamina(context) {
  return context.staminaRatio <= SIMPLE_AI.lowStaminaThreshold;
}

function getStamina(player, cfg = {}) {
  if (!player || !Number.isFinite(player.stamina)) return null;
  return player.stamina;
}

function getStaminaRatio(player, cfg = {}) {
  const stamina = getStamina(player, cfg);
  if (stamina == null) return 1;
  const max = finiteNumber(cfg.maxStamina, finiteNumber(player.maxStamina, null));
  if (!max || max <= 0) return stamina > 40 ? 1 : Math.max(0, Math.min(1, stamina / 120));
  return Math.max(0, Math.min(1, stamina / max));
}

function resolveProfileId(cfg) {
  const preferred = cfg.forcedType ?? cfg.profile;
  if (preferred === "attack") return "aggressive";
  if (preferred === "defense") return "defensive";
  if (AI_PROFILE_IDS.includes(preferred)) return preferred;
  return "rally";
}

export function predictBallLanding(state, botSide = "right", options = {}) {
  const ball = state?.ball;
  const mapWidth = finiteNumber(options.mapWidth, DEFAULTS.mapWidth);
  const netX = finiteNumber(options.netX, finiteNumber(state?.net?.x, mapWidth / 2));
  if (!ball) {
    const fallbackX = botSide === "right" ? netX + mapWidth * 0.25 : netX - mapWidth * 0.25;
    return {
      landingX: clampToCourt(fallbackX, botSide, { mapWidth, netX }),
      landingTick: Infinity,
      trajectory: [],
      willEnterMyCourt: false,
      intercept: null,
    };
  }
  const trajectory = simulateBallTrajectory(ball, {
    ...options,
    mapWidth,
    maxPredictionTicks: finiteNumber(options.maxPredictionTicks, SIMPLE_AI.maxPredictionTicks),
  });
  const groundY = finiteNumber(options.groundY, 0.02);
  let selected = trajectory.find((p) => p.y <= groundY && p.tick > 0) ?? trajectory[trajectory.length - 1];
  if (!selected) selected = { x: ball.x, y: ball.y, tick: 0 };
  const ownPoint = trajectory.find((p) => (botSide === "right" ? p.x >= netX : p.x <= netX));
  const intercept = trajectory.find((p) => {
    const onOwn = botSide === "right" ? p.x >= netX : p.x <= netX;
    return onOwn && p.y <= SIMPLE_AI.receiveYMax;
  }) ?? null;
  return {
    landingX: clampToCourt(selected.x, botSide, { mapWidth, netX }),
    landingTick: selected.tick,
    trajectory,
    willEnterMyCourt: !!ownPoint,
    firstOwnPoint: ownPoint ?? null,
    intercept,
  };
}

export function simulateBallTrajectory(ball, options = {}) {
  const maxTicks = Math.max(1, Math.trunc(finiteNumber(options.maxPredictionTicks, SIMPLE_AI.maxPredictionTicks)));
  const mapWidth = finiteNumber(options.mapWidth, DEFAULTS.mapWidth);
  const gravity = finiteNumber(options.ballGravity, DEFAULTS.ballGravity);
  const radius = finiteNumber(options.ballRadius, DEFAULTS.ballRadius);
  const rest = finiteNumber(options.wallRestitution, 0.9);
  let x = finiteNumber(ball?.x, 0.5);
  let y = finiteNumber(ball?.y, 0.3);
  let vx = finiteNumber(ball?.vx, 0);
  let vy = finiteNumber(ball?.vy, 0);
  const points = [];
  for (let tick = 0; tick <= maxTicks; tick++) {
    points.push({ tick, x, y, vx, vy });
    x += vx;
    y += vy;
    vy -= gravity;
    if (x < radius) {
      x = radius;
      vx = Math.abs(vx) * rest;
    } else if (x > mapWidth - radius) {
      x = mapWidth - radius;
      vx = -Math.abs(vx) * rest;
    }
    if (y <= 0 && tick > 0) break;
  }
  return points;
}

export function clampToCourt(x, side, context = {}) {
  const mapWidth = finiteNumber(context.mapWidth, DEFAULTS.mapWidth);
  const netX = finiteNumber(context.netX, finiteNumber(context?.state?.net?.x, mapWidth / 2));
  const margin = finiteNumber(context.moveMargin, DEFAULTS.moveMargin) + finiteNumber(context.playerWidth, DEFAULTS.playerWidth) / 2;
  const min = side === "right" ? netX + margin : margin;
  const max = side === "right" ? mapWidth - margin : netX - margin;
  if (max < min) return Math.max(0, Math.min(mapWidth, finiteNumber(x, netX)));
  return Math.max(min, Math.min(max, finiteNumber(x, (min + max) / 2)));
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
