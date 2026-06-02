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
  mapHeight: 0.5625 * 1.5,
  ballGravity: 0.05 / UNIT,
  ballRadius: 18 / UNIT,
  playerWidth: 80 / UNIT,
  playerHeight: 80 / UNIT,
  netWidth: 10 / UNIT,
  netHeight: 150 / UNIT,
  armLength: 35 / UNIT,
  playerSpeed: 5 / UNIT,
  moveMargin: 9 / UNIT,
  maxStamina: null,
  reactionDelayTicks: 2,
  maxPredictionTicks: 132,
  profile: null,
  forcedType: null,
  serveTypes: ["OVERHAND", "UNDERHAND"],
};

const STAMINA_TUNING = {
  lowRatio: 0.36,
  criticalRatio: 0.18,
  emergencyUrgency: 0.82,
  criticalUrgency: 0.94,
  costs: {
    dive: 16,
    spike: 10,
    jump: 8,
    block: 8,
    serveJump: 8,
  },
};

const BOT_TUNING = {
  predictionTicks: 132,
  reactionDelayTicks: 2,
  moveDeadZone: 9 / UNIT,
  wallRestitution: 0.9,
  netRestitution: 0.65,
  lowBallY: 0.15,
  veryLowBallY: 0.095,
  attackMinY: 0.17,
  attackMaxY: 0.4,
  highBallY: 0.22,
  fastBallSpeed: 9 / UNIT,
  veryFastBallSpeed: 13 / UNIT,
  receiveRangeX: 64 / UNIT,
  receiveRangeY: 110 / UNIT,
  fastReceiveRangeBonus: 28 / UNIT,
  diveRangeX: 178 / UNIT,
  fastDiveRangeBonus: 42 / UNIT,
  diveCommitRangeX: 84 / UNIT,
  spikeRangeX: 78 / UNIT,
  spikeRangeY: 160 / UNIT,
  blockNetRange: 110 / UNIT,
  blockXRange: 82 / UNIT,
  jumpLeadTicks: 16,
  fastJumpLeadBonus: 5,
  blockLeadTicks: 20,
  diveLeadTicks: 30,
  noWallStickMargin: 18 / UNIT,
  serveJumpMinY: 0.145,
  serveJumpLeadY: 18 / UNIT,
  serveHitBufferY: 8 / UNIT,
  serveActionCooldown: 8,
  serveJumpCooldown: 18,
  actionCooldowns: {
    receive: 5,
    dive: 22,
    jump: 10,
    spike: 10,
    block: 12,
    serveAction: 8,
    serveJump: 18,
    clear: 28,
  },
};

const AI_PROFILES = {
  aggressive: {
    label: BOT_LABELS.aggressive,
    homeRatio: 0.46,
    opponentHomeRatio: 0.40,
    attackBias: 0.36,
    predictionBlend: 0.88,
    receiveMultiplier: 1.05,
    diveMultiplier: 1.08,
    spikeMultiplier: 1.52,
    spikeFreedom: 0.32,
    blockMultiplier: 1.30,
    skillFreedom: 0.18,
    jumpLeadBonus: 7,
    blockLeadBonus: 5,
    diveLeadBonus: -1,
    netPatrol: 0.092,
    actionCooldownScale: 0.72,
    preferJumpServe: true,
    serveHitRatio: 0.54,
  },
  defensive: {
    label: BOT_LABELS.defensive,
    homeRatio: 0.68,
    opponentHomeRatio: 0.72,
    attackBias: 0.12,
    predictionBlend: 0.96,
    receiveMultiplier: 1.42,
    diveMultiplier: 1.38,
    spikeMultiplier: 0.84,
    spikeFreedom: 0.04,
    blockMultiplier: 1.08,
    skillFreedom: 0.26,
    jumpLeadBonus: 2,
    blockLeadBonus: -1,
    diveLeadBonus: 6,
    netPatrol: 0.135,
    actionCooldownScale: 0.9,
    preferJumpServe: true,
    serveHitRatio: 0.58,
  },
  rally: {
    label: BOT_LABELS.rally,
    homeRatio: 0.58,
    opponentHomeRatio: 0.58,
    attackBias: 0.20,
    predictionBlend: 0.91,
    receiveMultiplier: 1.22,
    diveMultiplier: 1.18,
    spikeMultiplier: 1.08,
    spikeFreedom: 0.12,
    blockMultiplier: 1.14,
    skillFreedom: 0.16,
    jumpLeadBonus: 3,
    blockLeadBonus: 1,
    diveLeadBonus: 2,
    netPatrol: 0.115,
    actionCooldownScale: 0.96,
    preferJumpServe: true,
    serveHitRatio: 0.64,
  },
};

/**
 * 최신 GameLoop/InputSystem 흐름에 맞춘 규칙 기반 AI 컨트롤러.
 * AI는 state를 직접 수정하지 않고, 사람 입력과 같은 형태의 입력 스냅샷 조각만 만든다.
 */
export function createBotController(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  let currentProfileId = normalizeProfileId(cfg.profile ?? cfg.forcedType) ?? chooseRandomProfileId();
  let currentRallyKey = "";
  let observedMaxStamina = finiteNumber(cfg.maxStamina, null);
  const cooldowns = makeCooldownState();
  let lastDebugInfo = makeInitialDebugInfo(currentProfileId);

  function beginNewRally(rallyKey) {
    if (currentRallyKey === rallyKey) return;

    currentRallyKey = rallyKey;
    currentProfileId = normalizeProfileId(cfg.profile ?? cfg.forcedType) ?? chooseRandomProfileId();
    resetCooldowns(cooldowns);
    lastDebugInfo = makeInitialDebugInfo(currentProfileId);
  }

  function makeInputs(state) {
    beginNewRally(makeRallyKey(state));
    countDownCooldowns(cooldowns);

    const inputs = makeEmptyInputs(cfg.playerSide);
    const context = readContext(state, cfg, currentProfileId);
    if (!context) {
      lastDebugInfo = makeInitialDebugInfo(currentProfileId);
      return inputs;
    }

    context.cooldowns = cooldowns;
    observedMaxStamina = updateObservedMaxStamina(observedMaxStamina, context.player, cfg);
    context.maxStamina = observedMaxStamina;
    context.staminaRatio = getStaminaRatio(context);

    if (isMyServe(state, cfg)) {
      const selectedAction = playServe(inputs, context);
      lastDebugInfo = buildDebugInfo(currentProfileId, getCurrentTypeLabel(), null, null, selectedAction, cooldowns, context);
      return inputs;
    }

    const prediction = predictBallLanding(state, context.playerSide, context);
    const targetInfo = getTargetX(context, prediction);
    moveToward(inputs, context, targetInfo.targetX);
    const selectedAction = chooseAction(inputs, context, prediction);

    lastDebugInfo = buildDebugInfo(currentProfileId, getCurrentTypeLabel(), targetInfo, prediction, selectedAction, cooldowns, context);
    return inputs;
  }

  function getCurrentTypeLabel() {
    return AI_PROFILES[currentProfileId]?.label ?? BOT_LABELS[currentProfileId] ?? currentProfileId;
  }

  function getCurrentTypeId() {
    return currentProfileId;
  }

  function getDebugInfo() {
    return {
      ...lastDebugInfo,
      cooldowns: { ...lastDebugInfo.cooldowns },
    };
  }

  return {
    beginNewRally,
    makeInputs,
    getCurrentTypeLabel,
    getCurrentTypeId,
    getDebugInfo,
  };
}

function playServe(inputs, context) {
  const { state, player, ball, playerSide, cfg, profile } = context;
  const actionKey = inputName(playerSide, "ACTION");
  const upKey = inputName(playerSide, "UP");

  if (state.serveStep === "ready") {
    if (canUseAction("serveAction", context, 1)) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      return "SERVE_TOSS";
    }
    return null;
  }

  if (state.serveStep !== "tossed") return null;

  const serveTypes = cfg.serveTypes ?? player.serveTypes ?? ["OVERHAND", "UNDERHAND"];
  const canJumpServe = serveTypes.includes("JUMP");
  const canOverhand = serveTypes.includes("OVERHAND");
  const canUnderhand = serveTypes.includes("UNDERHAND");
  const headY = player.y + cfg.playerHeight;
  const groundHeadY = cfg.playerHeight;
  const armLen = cfg.armLength;
  const facingX = playerSide === "left" ? 1 : -1;
  const dx = (ball.x - player.x) * facingX;
  const inFrontReach = dx > 0 && dx <= armLen * 1.2;
  if (!inFrontReach) return null;

  const lowStamina = isLowStamina(context);
  const mustJumpServe = canJumpServe && !canOverhand && !canUnderhand;
  const preferJump = canJumpServe && !lowStamina && (profile.preferJumpServe || !canOverhand || ball.y > groundHeadY + armLen * 0.72);
  const jumpReadyY = groundHeadY + armLen * (profile.preferJumpServe ? 0.26 : 0.45);
  const jumpServeHitWindow = ball.y >= headY - BOT_TUNING.serveHitBufferY && ball.y <= headY + armLen + BOT_TUNING.serveHitBufferY;
  const tossRatio = state.serveTossY > 0 ? ball.y / state.serveTossY : 1;
  const jumpHitReady = tossRatio >= (profile.serveHitRatio ?? 0.58) || ball.vy < 0;

  if (preferJump || mustJumpServe) {
    if (player.onGround && ball.y >= jumpReadyY && ball.vy >= -BOT_TUNING.serveJumpLeadY && canUseAction("serveJump", context, 1)) {
      inputs[upKey] = true;
      setCooldown("serveJump", context, 1);
      return "SERVE_JUMP";
    }

    if (!player.onGround && jumpServeHitWindow && jumpHitReady && canUseAction("serveAction", context, 1)) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      return "JUMP_SERVE_HIT";
    }

    // If jump serve timing is missed and the ball is falling out of range, fall back
    // to a legal overhand/underhand serve instead of faulting.
    if (ball.vy < 0 && canOverhand && ball.y >= groundHeadY && ball.y <= groundHeadY + armLen && canUseAction("serveAction", context, 1)) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      return "OVERHAND_FALLBACK_SERVE";
    }

    if (!player.onGround) return null;
  }

  if (canOverhand && ball.y >= groundHeadY && ball.y <= groundHeadY + armLen && canUseAction("serveAction", context, 1)) {
    inputs[actionKey] = true;
    setCooldown("serveAction", context, 1);
    return "OVERHAND_SERVE";
  }

  if (canUnderhand && ball.y >= player.y + 0.015 && ball.y < groundHeadY && canUseAction("serveAction", context, 1)) {
    inputs[actionKey] = true;
    setCooldown("serveAction", context, 1);
    return "UNDERHAND_SERVE";
  }

  return null;
}

function readContext(state, cfg, profileId) {
  const player = state?.[cfg.playerId] ?? state?.p2;
  const opponent = state?.[cfg.opponentId] ?? state?.p1;
  const ball = state?.ball;
  if (!player || !ball) return null;

  const netX = finiteNumber(state?.net?.x, cfg.netX ?? cfg.mapWidth / 2);
  const playerSide = cfg.playerSide ?? (player.x < netX ? "left" : "right");
  const sideBounds = getCourtBounds(playerSide, netX, cfg);
  const opponentSide = playerSide === "left" ? "right" : "left";
  const opponentBounds = getCourtBounds(opponentSide, netX, cfg);
  const profile = AI_PROFILES[profileId] ?? AI_PROFILES.rally;

  return {
    state,
    player,
    opponent,
    ball,
    playerSide,
    opponentSide,
    netX,
    sideMinX: sideBounds.min,
    sideMaxX: sideBounds.max,
    opponentMinX: opponentBounds.min,
    opponentMaxX: opponentBounds.max,
    profileId,
    profile,
    cfg,
  };
}

export function predictBallLanding(state, botSide = "right", options = {}) {
  const cfg = { ...DEFAULTS, ...(options.cfg ?? options) };
  const ball = state?.ball ?? options.ball;
  const netX = finiteNumber(state?.net?.x, options.netX ?? cfg.netX ?? cfg.mapWidth / 2);
  const bounds = options.sideMinX !== undefined && options.sideMaxX !== undefined
    ? { min: options.sideMinX, max: options.sideMaxX }
    : getCourtBounds(botSide, netX, cfg);

  if (!ball) {
    const fallbackX = getDefensiveHomeX({ ...options, playerSide: botSide, sideMinX: bounds.min, sideMaxX: bounds.max });
    return makePrediction(fallbackX, null, null, [], false, 0);
  }

  const speed = ballSpeed(ball);
  const extraTicks = speed >= BOT_TUNING.veryFastBallSpeed ? 48 : speed >= BOT_TUNING.fastBallSpeed ? 24 : 0;
  const trajectory = simulateBallTrajectory(ball, {
    ...cfg,
    netX,
    ticks: (cfg.maxPredictionTicks ?? BOT_TUNING.predictionTicks) + extraTicks,
  });

  const landing = trajectory.find(p => p.y - cfg.ballRadius <= 0) ?? trajectory[trajectory.length - 1] ?? { x: ball.x, y: ball.y, tick: 0, vx: ball.vx, vy: ball.vy };
  const firstMyCourtPoint = trajectory.find(p => isInMyCourt(p.x, botSide, netX));
  const myCourtLowPoint = trajectory.find(p => isInMyCourt(p.x, botSide, netX) && p.y < dynamicLowBallY(speed) && p.vy < 0);
  const intercept = findBestIntercept(trajectory, botSide, netX, options.player, cfg, speed);
  const selected = myCourtLowPoint ?? firstMyCourtPoint ?? landing;
  const landingX = clampToCourt(selected.x, botSide, { netX, cfg, sideMinX: bounds.min, sideMaxX: bounds.max });

  return makePrediction(landingX, selected.tick, intercept, trajectory, !!firstMyCourtPoint, speed);
}

export function simulateBallTrajectory(ball, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const ticks = Math.max(1, options.ticks ?? BOT_TUNING.predictionTicks);
  const netX = finiteNumber(options.netX, cfg.mapWidth / 2);
  const netTop = cfg.netHeight;
  const netLeft = netX - cfg.netWidth / 2;
  const netRight = netX + cfg.netWidth / 2;
  const points = [];

  let x = finiteNumber(ball.x, 0.5);
  let y = finiteNumber(ball.y, 0.3);
  let vx = finiteNumber(ball.vx, 0);
  let vy = finiteNumber(ball.vy, 0);

  for (let tick = 1; tick <= ticks; tick++) {
    vy -= cfg.ballGravity;
    x += vx;
    y += vy;

    if (x - cfg.ballRadius < 0) {
      x = cfg.ballRadius;
      vx = Math.abs(vx) * BOT_TUNING.wallRestitution;
    } else if (x + cfg.ballRadius > cfg.mapWidth) {
      x = cfg.mapWidth - cfg.ballRadius;
      vx = -Math.abs(vx) * BOT_TUNING.wallRestitution;
    }

    if (x + cfg.ballRadius > netLeft && x - cfg.ballRadius < netRight && y - cfg.ballRadius < netTop) {
      if (vx > 0) x = netLeft - cfg.ballRadius;
      else if (vx < 0) x = netRight + cfg.ballRadius;
      vx *= -BOT_TUNING.netRestitution;
    }

    points.push({ tick, x, y, vx, vy, speed: Math.hypot(vx, vy) });
    if (y - cfg.ballRadius <= 0) break;
  }

  return points;
}

function getTargetX(context, prediction) {
  const { ball, playerSide, netX, profile } = context;
  const ballInMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const comingToMe = ballInMyCourt || ballMovingTowardSide(ball, playerSide);
  const nearNet = Math.abs(ball.x - netX) < BOT_TUNING.blockNetRange * profile.blockMultiplier;
  const highNearNet = nearNet && ball.y > BOT_TUNING.highBallY;

  if (highNearNet && (comingToMe || isOpponentLikelyAttacking(context))) {
    return { targetX: clampToCourt(getBlockX(context), playerSide, context), mode: "block" };
  }

  if (comingToMe || prediction.willEnterMyCourt) {
    const homeX = getDefensiveHomeX(context);
    const predicted = prediction.intercept?.x ?? prediction.landingX;
    const speedBias = prediction.speed >= BOT_TUNING.fastBallSpeed ? 1 : 0;
    const blend = clamp(profile.predictionBlend + speedBias * 0.08, 0, 1);
    return { targetX: clampToCourt(predicted * blend + homeX * (1 - blend), playerSide, context), mode: speedBias ? "fast-intercept" : "intercept" };
  }

  if (ball.y > BOT_TUNING.attackMinY && Math.abs(ball.x - netX) < 0.20) {
    const attackX = getAttackX(context);
    const homeX = getDefensiveHomeX(context, true);
    return { targetX: clampToCourt(attackX * profile.attackBias + homeX * (1 - profile.attackBias), playerSide, context), mode: "pressure" };
  }

  return { targetX: getDefensiveHomeX(context, true), mode: "home" };
}

function chooseAction(inputs, context, prediction) {
  const urgency = getUrgency(context, prediction);

  if (shouldLowStaminaClear(context, prediction) && canUseAction("clear", context, 1)) {
    inputs[inputName(context.playerSide, "ACTION")] = true;
    setCooldown("clear", context, 1);
    return "LOW_STAMINA_CLEAR";
  }

  if (shouldReceive(context, prediction) && canUseAction("receive", context, urgency)) {
    inputs[inputName(context.playerSide, "DOWN")] = true;
    setCooldown("receive", context, urgency);
    return "RECEIVE";
  }

  if (shouldDive(context, prediction) && canUseAction("dive", context, urgency)) {
    pressDive(inputs, context, prediction.intercept?.x ?? prediction.landingX);
    setCooldown("dive", context, urgency);
    return "DIVE";
  }

  if (context.profileId === "aggressive" && shouldSpike(context, prediction) && canUseAction("spike", context, urgency)) {
    inputs[inputName(context.playerSide, "ACTION")] = true;
    setCooldown("spike", context, urgency);
    return "SPIKE";
  }

  if (shouldBlock(context, prediction) && canUseAction("block", context, urgency)) {
    inputs[inputName(context.playerSide, "DOUBLE_UP")] = true;
    setCooldown("block", context, urgency);
    return "BLOCK";
  }

  if (shouldSpike(context, prediction) && canUseAction("spike", context, urgency)) {
    inputs[inputName(context.playerSide, "ACTION")] = true;
    setCooldown("spike", context, urgency);
    return "SPIKE";
  }

  if (shouldJump(context, prediction) && canUseAction("jump", context, urgency)) {
    inputs[inputName(context.playerSide, "UP")] = true;
    setCooldown("jump", context, urgency);
    return "JUMP";
  }

  return null;
}

function shouldLowStaminaClear(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (context.profileId !== "aggressive" || !isLowStamina(context)) return false;

  const inFront = (ball.x - player.x) * getFacingTowardOpponent(playerSide) > 0;
  if (!inFront) return false;

  const spikeFreedom = profile.spikeFreedom ?? 0;
  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.10));
  const closeEnough = dx <= BOT_TUNING.spikeRangeX * profile.spikeMultiplier + spikeFreedom * 0.06;
  const reachableHeight = ball.y >= BOT_TUNING.veryLowBallY && ball.y <= BOT_TUNING.attackMaxY + spikeFreedom * 0.08;
  const reachableBody = dy <= BOT_TUNING.spikeRangeY * profile.spikeMultiplier + spikeFreedom * 0.08;
  const attackableCourt = isInMyCourt(ball.x, playerSide, netX) || Math.abs(ball.x - netX) <= 0.12 + spikeFreedom * 0.18;
  const needsClear = shouldReceive(context, prediction) || prediction.willEnterMyCourt || isInMyCourt(ball.x, playerSide, netX);

  return closeEnough && reachableHeight && reachableBody && attackableCourt && needsClear;
}

function shouldReceive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const incoming = isInMyCourt(ball.x, playerSide, netX) || prediction.willEnterMyCourt;
  if (!incoming) return false;

  const speed = prediction.speed;
  const target = prediction.intercept ?? { x: prediction.landingX, y: ball.y, tick: prediction.landingTick ?? 99, vy: ball.vy };
  const dx = Math.abs(target.x - player.x);
  const dy = Math.abs(target.y - (player.y + 0.035));
  const speedBonus = speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastReceiveRangeBonus : 0;
  const freedom = profile.skillFreedom ?? 0;
  const receiveRangeX = BOT_TUNING.receiveRangeX * profile.receiveMultiplier + speedBonus + freedom * 0.05;
  const receiveRangeY = BOT_TUNING.receiveRangeY * profile.receiveMultiplier + freedom * 0.04;
  const imminentLimit = (speed >= BOT_TUNING.fastBallSpeed ? 22 : 16) + Math.round(freedom * 18);
  const receiveY = dynamicLowBallY(speed) * profile.receiveMultiplier + freedom * 0.06;
  const imminent = target.tick <= imminentLimit && target.y <= receiveY;
  const currentLowClose = ball.y <= receiveY && Math.abs(ball.x - player.x) <= receiveRangeX;
  return (imminent && dx <= receiveRangeX && dy <= receiveRangeY && target.vy <= 0) || currentLowClose;
}

function shouldDive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround || !isInMyCourt(prediction.landingX, playerSide, netX)) return false;
  const speed = prediction.speed;
  const target = prediction.intercept ?? { x: prediction.landingX, y: ball.y, tick: prediction.landingTick ?? 99, vy: ball.vy };
  const freedom = profile.skillFreedom ?? 0;
  const receiveLimit = BOT_TUNING.receiveRangeX * profile.receiveMultiplier + (speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastReceiveRangeBonus * 0.6 : 0);
  const diveLimit = BOT_TUNING.diveRangeX * profile.diveMultiplier + (speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastDiveRangeBonus : 0) + freedom * 0.08;
  const dx = Math.abs(target.x - player.x);
  const tooFarForReceive = dx > receiveLimit * (0.84 - freedom * 0.2);
  const reachableByDive = dx <= diveLimit;
  const lead = BOT_TUNING.diveLeadTicks + profile.diveLeadBonus + (speed >= BOT_TUNING.fastBallSpeed ? 8 : 0) + Math.round(freedom * 20);
  const soonLow = target.tick <= lead && target.y <= dynamicLowBallY(speed) * (1.35 + freedom);
  const currentEmergency = ball.y <= BOT_TUNING.veryLowBallY + freedom * 0.04 && Math.abs(ball.x - player.x) <= BOT_TUNING.diveCommitRangeX * profile.diveMultiplier + freedom * 0.06;
  return (tooFarForReceive && reachableByDive && soonLow && target.vy <= 0) || currentEmergency;
}

function shouldBlock(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const freedom = profile.skillFreedom ?? 0;
  const nearNet = Math.abs(ball.x - netX) <= BOT_TUNING.blockNetRange * profile.blockMultiplier + freedom * 0.05;
  const blockX = getBlockX(context);
  const aligned = Math.abs(player.x - blockX) <= BOT_TUNING.blockXRange * profile.blockMultiplier + freedom * 0.04;
  const highEnough = ball.y >= BOT_TUNING.highBallY * (0.88 - freedom * 0.18);
  const threat = ballMovingTowardSide(ball, playerSide) || isOpponentLikelyAttacking(context) || prediction.willEnterMyCourt || Math.abs(ball.x - netX) < 0.08 + freedom * 0.08;
  const timing = prediction.intercept?.tick == null || prediction.intercept.tick <= BOT_TUNING.blockLeadTicks + profile.blockLeadBonus + Math.round(freedom * 20);
  return nearNet && aligned && highEnough && threat && timing;
}

function shouldSpike(context, _prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const inMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const inFront = (ball.x - player.x) * getFacingTowardOpponent(playerSide) > 0;
  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.10));
  const heightOk = ball.y >= BOT_TUNING.attackMinY - spikeFreedom * 0.05 && ball.y <= BOT_TUNING.attackMaxY + spikeFreedom * 0.12;
  const rangeOk = dx <= BOT_TUNING.spikeRangeX * profile.spikeMultiplier + spikeFreedom * 0.06 && dy <= BOT_TUNING.spikeRangeY * profile.spikeMultiplier + spikeFreedom * 0.08;
  const attackableCourt = inMyCourt || Math.abs(ball.x - netX) <= 0.12 + spikeFreedom * 0.18;
  const committedAttack = !player.onGround || context.profileId === "aggressive";
  return committedAttack && inFront && heightOk && rangeOk && attackableCourt;
}

function shouldJump(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const intercept = prediction.intercept;
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const closeX = Math.abs((intercept?.x ?? ball.x) - player.x) < BOT_TUNING.spikeRangeX * (1.15 + spikeFreedom * 1.1);
  const speedBonus = prediction.speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastJumpLeadBonus : 0;
  const leadTicks = BOT_TUNING.jumpLeadTicks + profile.jumpLeadBonus + speedBonus + Math.round(spikeFreedom * 16);
  const highEnough = (intercept?.y ?? ball.y) > BOT_TUNING.attackMinY - spikeFreedom * 0.04;
  const coming = isInMyCourt(ball.x, playerSide, netX) || prediction.willEnterMyCourt || ballMovingTowardSide(ball, playerSide);
  return coming && closeX && highEnough && (intercept?.tick ?? 0) <= leadTicks;
}

function hasStaminaBudget(actionName, context, urgency = 0) {
  const cost = STAMINA_TUNING.costs[actionName] ?? 0;
  if (cost <= 0) return true;

  const stamina = finiteNumber(context.player?.stamina, context.maxStamina ?? 0);
  const ratio = getStaminaRatio(context);
  if (ratio > STAMINA_TUNING.lowRatio && stamina >= cost) return true;

  const critical = ratio <= STAMINA_TUNING.criticalRatio || stamina < cost * 0.5;
  const requiredUrgency = critical ? STAMINA_TUNING.criticalUrgency : STAMINA_TUNING.emergencyUrgency;

  return urgency >= requiredUrgency && stamina >= cost * 0.35;
}

function isLowStamina(context) {
  return getStaminaRatio(context) <= STAMINA_TUNING.lowRatio;
}

function getStaminaRatio(context) {
  const stamina = finiteNumber(context.player?.stamina, null);
  const maxStamina = finiteNumber(context.maxStamina ?? context.cfg?.maxStamina, stamina ?? 120);
  if (stamina == null || maxStamina <= 0) return 1;
  return clamp(stamina / maxStamina, 0, 1);
}

function updateObservedMaxStamina(currentMax, player, cfg) {
  const configured = finiteNumber(cfg.maxStamina, null);
  const playerMax = finiteNumber(player?.maxStamina, null);
  const stamina = finiteNumber(player?.stamina, null);
  return Math.max(configured ?? 0, playerMax ?? 0, currentMax ?? 0, stamina ?? 0) || null;
}

function canUseAction(actionName, context, urgency = 0) {
  if (!hasStaminaBudget(actionName, context, urgency)) return false;

  const cooldown = context.cooldowns?.[actionName] ?? 0;
  if (cooldown <= 0) return true;

  const freedom = context.profile?.skillFreedom ?? 0;
  const skillAction = actionName === "receive" || actionName === "dive" || actionName === "block";
  const spikeFreedom = actionName === "spike" ? context.profile?.spikeFreedom ?? 0 : 0;
  const urgencyGate = skillAction ? 0.58 - freedom * 0.7 : 0.85 - spikeFreedom * 1.4;
  if (urgency < urgencyGate) return false;

  const baseOverride = actionName === "dive" ? 7 : actionName === "receive" ? 5 : actionName === "block" ? 5 : 3;
  const maxOverrideCooldown = baseOverride + Math.round(freedom * 10);
  return cooldown <= maxOverrideCooldown;
}

function setCooldown(actionName, context, urgency = 0) {
  const base = BOT_TUNING.actionCooldowns[actionName] ?? 12;
  const scale = context.profile?.actionCooldownScale ?? 1;
  const urgentScale = urgency > 0.85 ? 0.55 : 1;
  context.cooldowns[actionName] = Math.max(1, Math.round(base * scale * urgentScale));
}

function getUrgency(context, prediction) {
  const tick = prediction.intercept?.tick ?? prediction.landingTick ?? 99;
  const height = prediction.intercept?.y ?? context.ball.y;
  const speed = prediction.speed;
  const lowUrgency = height <= BOT_TUNING.veryLowBallY ? 0.45 : height <= dynamicLowBallY(speed) ? 0.25 : 0;
  const timeUrgency = tick <= 8 ? 0.55 : tick <= 16 ? 0.35 : tick <= 28 ? 0.15 : 0;
  const speedUrgency = speed >= BOT_TUNING.veryFastBallSpeed ? 0.25 : speed >= BOT_TUNING.fastBallSpeed ? 0.15 : 0;
  return Math.min(1, lowUrgency + timeUrgency + speedUrgency);
}

function findBestIntercept(trajectory, botSide, netX, player, cfg, speed = 0) {
  if (!player) return null;
  const startX = finiteNumber(player.x, cfg.mapWidth / 2);
  const playerSpeed = cfg.playerSpeed;
  const speedRangeBonus = speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastReceiveRangeBonus : 0;

  for (const point of trajectory) {
    if (point.tick < cfg.reactionDelayTicks) continue;
    if (!isInMyCourt(point.x, botSide, netX)) continue;
    if (point.y > BOT_TUNING.attackMaxY + (speed >= BOT_TUNING.fastBallSpeed ? 0.08 : 0)) continue;

    const travelTicks = Math.max(0, point.tick - cfg.reactionDelayTicks);
    const reachableX = Math.abs(point.x - startX) <= playerSpeed * travelTicks + BOT_TUNING.receiveRangeX + speedRangeBonus;
    if (reachableX) return point;
  }

  return trajectory.find(point => isInMyCourt(point.x, botSide, netX)) ?? null;
}

function getDefensiveHomeX(context, useOpponentAware = false) {
  const { playerSide, sideMinX, sideMaxX, profile = AI_PROFILES.rally, ball, netX } = context;
  const ratio = useOpponentAware && ball && !isInMyCourt(ball.x, playerSide, netX)
    ? profile.opponentHomeRatio
    : profile.homeRatio;
  const sideRatio = playerSide === "left" ? 1 - ratio : ratio;
  return clampToCourt(sideMinX + (sideMaxX - sideMinX) * sideRatio, playerSide, context);
}

function getAttackX(context) {
  const { playerSide, netX, profile } = context;
  const offset = profile.netPatrol;
  return playerSide === "left" ? netX - offset : netX + offset;
}

function getBlockX(context) {
  const { ball, playerSide, netX, cfg } = context;
  const netOffset = cfg.netWidth / 2 + cfg.playerWidth / 2 + 0.012;
  const nearNetX = playerSide === "left" ? netX - netOffset : netX + netOffset;
  return ballMovingTowardSide(ball, playerSide)
    ? nearNetX
    : (nearNetX + getAttackX(context)) / 2;
}

function moveToward(inputs, context, targetX) {
  const { player, playerSide, cfg } = context;
  const margin = Math.max(cfg.moveMargin, BOT_TUNING.moveDeadZone);

  if (player.x < targetX - margin) {
    inputs[inputName(playerSide, "RIGHT")] = true;
    return;
  }

  if (player.x > targetX + margin) {
    inputs[inputName(playerSide, "LEFT")] = true;
  }
}

function pressDive(inputs, context, targetX) {
  const { player, playerSide } = context;
  inputs[inputName(playerSide, targetX < player.x ? "DOUBLE_LEFT" : "DOUBLE_RIGHT")] = true;
}

export function clampToCourt(x, side, context = {}) {
  const cfg = context.cfg ?? DEFAULTS;
  const netX = finiteNumber(context.netX, cfg.mapWidth / 2);
  const bounds = context.sideMinX !== undefined && context.sideMaxX !== undefined
    ? { min: context.sideMinX, max: context.sideMaxX }
    : getCourtBounds(side, netX, cfg);
  const margin = BOT_TUNING.noWallStickMargin;
  return clamp(finiteNumber(x, (bounds.min + bounds.max) / 2), bounds.min + margin, bounds.max - margin);
}

function getCourtBounds(playerSide, netX, cfg) {
  const halfPlayer = cfg.playerWidth / 2;
  const halfNet = cfg.netWidth / 2;
  if (playerSide === "left") {
    return { min: halfPlayer, max: netX - halfNet - halfPlayer };
  }
  return { min: netX + halfNet + halfPlayer, max: cfg.mapWidth - halfPlayer };
}

function isMyServe(state, cfg) {
  return state?.phase === "serve" && state?.server === cfg.playerId;
}

function isOpponentLikelyAttacking(context) {
  const { opponent, ball, opponentSide, netX } = context;
  if (!opponent) return false;
  const opponentNearBall = Math.abs(ball.x - opponent.x) < 0.13 && Math.abs(ball.y - (opponent.y + 0.10)) < 0.18;
  const ballNearNet = Math.abs(ball.x - netX) < 0.16;
  const opponentActionThreat = opponent.actionType === "SPIKE" || opponent.actionType === "BLOCK" || opponent.actionType === "JUMP";
  return isInMyCourt(ball.x, opponentSide, netX) && ballNearNet && (opponentNearBall || opponentActionThreat);
}

function isInMyCourt(x, playerSide, netX) {
  return playerSide === "left" ? x < netX : x > netX;
}

function ballMovingTowardSide(ball, playerSide) {
  return playerSide === "left" ? finiteNumber(ball.vx, 0) < 0 : finiteNumber(ball.vx, 0) > 0;
}

function getFacingTowardOpponent(playerSide) {
  return playerSide === "left" ? 1 : -1;
}

function makeEmptyInputs(playerSide) {
  const inputs = {};
  for (const action of ["UP", "DOWN", "LEFT", "RIGHT", "ACTION", "DOUBLE_UP", "DOUBLE_DOWN", "DOUBLE_LEFT", "DOUBLE_RIGHT"]) {
    inputs[inputName(playerSide, action)] = false;
  }
  return inputs;
}

function inputName(playerSide, action) {
  return `${playerSide === "left" ? "1P" : "2P"}_${action}`;
}

function makeRallyKey(state) {
  const score = state?.score ?? { p1: 0, p2: 0 };
  const sets = state?.sets ?? { p1: 0, p2: 0 };
  return `${state?.phase ?? "rally"}:${state?.serveStep ?? "none"}:${state?.server ?? "none"}:${sets.p1}-${sets.p2}:${score.p1}-${score.p2}`;
}

function chooseRandomProfileId() {
  const index = Math.floor(Math.random() * AI_PROFILE_IDS.length);
  return AI_PROFILE_IDS[index];
}

function normalizeProfileId(profileId) {
  if (profileId === "attack") return "aggressive";
  if (profileId === "defense") return "defensive";
  return AI_PROFILES[profileId] ? profileId : null;
}

function makeCooldownState() {
  return { receive: 0, dive: 0, jump: 0, spike: 0, block: 0, serveAction: 0, serveJump: 0, clear: 0 };
}

function resetCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) cooldowns[key] = 0;
}

function countDownCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) {
    if (cooldowns[key] > 0) cooldowns[key]--;
  }
}

function makePrediction(landingX, landingTick, intercept, trajectory, willEnterMyCourt, speed) {
  return { landingX, landingTick, intercept, trajectory, willEnterMyCourt, speed };
}

function makeInitialDebugInfo(profile) {
  return {
    profile,
    profileLabel: AI_PROFILES[profile]?.label ?? profile,
    targetX: null,
    targetMode: null,
    predictedLandingX: null,
    predictedLandingTick: null,
    interceptX: null,
    interceptY: null,
    interceptTick: null,
    selectedAction: null,
    staminaRatio: null,
    cooldowns: makeCooldownState(),
  };
}

function buildDebugInfo(profile, profileLabel, targetInfo, prediction, selectedAction, cooldowns, context = null) {
  return {
    profile,
    profileLabel,
    targetX: roundDebug(targetInfo?.targetX),
    targetMode: targetInfo?.mode ?? null,
    predictedLandingX: roundDebug(prediction?.landingX),
    predictedLandingTick: prediction?.landingTick ?? null,
    interceptX: roundDebug(prediction?.intercept?.x),
    interceptY: roundDebug(prediction?.intercept?.y),
    interceptTick: prediction?.intercept?.tick ?? null,
    ballSpeed: roundDebug(prediction?.speed),
    selectedAction,
    staminaRatio: context ? roundDebug(getStaminaRatio(context)) : null,
    cooldowns: { ...cooldowns },
  };
}

function ballSpeed(ball) {
  return Math.hypot(finiteNumber(ball?.vx, 0), finiteNumber(ball?.vy, 0));
}

function dynamicLowBallY(speed) {
  if (speed >= BOT_TUNING.veryFastBallSpeed) return BOT_TUNING.lowBallY + 0.06;
  if (speed >= BOT_TUNING.fastBallSpeed) return BOT_TUNING.lowBallY + 0.035;
  return BOT_TUNING.lowBallY;
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function roundDebug(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
