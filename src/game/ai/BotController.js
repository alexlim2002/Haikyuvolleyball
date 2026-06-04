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

const COMMON_SEND_OVER = {
  enabled: true,
  minOwnCourtTicksBeforeUrgency: 24,
  receiveRepeatLimit: 2,
  clearAttemptRange: 118 / UNIT,
  clearAttemptY: 0.115,
  lowStaminaClearY: 0.084,
  spikeAttemptRange: 96 / UNIT,
  spikeAttemptY: 0.155,
  attackSetupMinY: 0.18,
  forwardPressure: 38 / UNIT,
  maxDirectionalAssistRange: 150 / UNIT,
};

const LOW_STAMINA_POLICY = {
  aggressive: {
    receiveRepeatLimit: 1,
    ownCourtTicksBeforeClear: 8,
    clearRangeScale: 1.16,
    clearY: 0.084,
  },
  defensive: {
    receiveRepeatLimit: 2,
    ownCourtTicksBeforeClear: 16,
    clearRangeScale: 1.04,
    clearY: 0.096,
  },
  rally: {
    receiveRepeatLimit: 2,
    ownCourtTicksBeforeClear: 14,
    clearRangeScale: 1.08,
    clearY: 0.092,
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
  serveActionCooldown: 18,
  serveJumpCooldown: 26,
  minSpikeIntervalTicks: 46,
  minDiveIntervalTicks: 52,
  postSpikeRecoveryTicks: 24,
  postDiveRecoveryTicks: 34,
  diveDirectionLockTicks: 48,
  postShiftRecoveryTicks: 28,
  serveReceiveDiveLockTicks: 42,
  postReceivePlanTicks: 54,
  spikeAirborneOnly: true,
  spikeYWindow: 70 / UNIT,
  spikeXWindow: 64 / UNIT,
  minSpikeStaminaRatio: 0.32,
  minDiveStaminaRatio: 0.28,
  underhandServeMinWaitTicks: 18,
  jumpServeMinWaitTicks: 34,
  jumpServeReactionTicks: 18,
  actionCooldowns: {
    receive: 5,
    dive: 48,
    jump: 12,
    spike: 34,
    block: 12,
    serveAction: 18,
    serveJump: 26,
    clear: 28,
  },
};

const AI_PROFILES = {
  aggressive: {
    label: BOT_LABELS.aggressive,
    homeRatio: 0.46,
    opponentHomeRatio: 0.4,
    attackBias: 0.36,
    predictionBlend: 0.88,
    receiveMultiplier: 1.05,
    diveMultiplier: 1.08,
    spikeMultiplier: 1.52,
    spikeFreedom: 0.32,
    blockMultiplier: 1.3,
    skillFreedom: 0.18,
    jumpLeadBonus: 7,
    blockLeadBonus: 5,
    diveLeadBonus: -1,
    netPatrol: 0.092,
    actionCooldownScale: 0.72,
    preferJumpServe: true,
    serveHitRatio: 0.54,
    sendOverAggression: 1.22,
    sendOverRisk: 1.18,
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
    sendOverAggression: 0.82,
    sendOverRisk: 0.82,
  },
  rally: {
    label: BOT_LABELS.rally,
    homeRatio: 0.58,
    opponentHomeRatio: 0.58,
    attackBias: 0.2,
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
    sendOverAggression: 1.0,
    sendOverRisk: 0.96,
  },
};

/**
 * 최신 GameLoop/InputSystem 흐름에 맞춘 규칙 기반 AI 컨트롤러.
 * AI는 state를 직접 수정하지 않고, 사람 입력과 같은 형태의 입력 스냅샷 조각만 만든다.
 */
export function createBotController(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  let currentProfileId =
    normalizeProfileId(cfg.profile ?? cfg.forcedType) ??
    chooseRandomProfileId();
  let currentRallyKey = "";
  let observedMaxStamina = finiteNumber(cfg.maxStamina, null);
  const cooldowns = makeCooldownState();
  let lastDebugInfo = makeInitialDebugInfo(currentProfileId);
  const rallyMemory = makeRallyMemory();

  function beginNewRally(rallyKey) {
    if (currentRallyKey === rallyKey) return;

    currentRallyKey = rallyKey;
    currentProfileId =
      normalizeProfileId(cfg.profile ?? cfg.forcedType) ??
      chooseRandomProfileId();
    resetCooldowns(cooldowns);
    resetRallyMemory(rallyMemory);
    lastDebugInfo = makeInitialDebugInfo(currentProfileId);
  }

  function makeInputs(state) {
    beginNewRally(makeRallyKey(state));
    countDownCooldowns(cooldowns);
    rallyMemory.tick++;

    const inputs = makeEmptyInputs(cfg.playerSide);
    const context = readContext(state, cfg, currentProfileId);
    if (!context) {
      lastDebugInfo = makeInitialDebugInfo(currentProfileId);
      return inputs;
    }

    context.cooldowns = cooldowns;
    context.memory = rallyMemory;
    updateRallyMemoryBeforeAction(rallyMemory, context);
    observedMaxStamina = updateObservedMaxStamina(
      observedMaxStamina,
      context.player,
      cfg,
    );
    context.maxStamina = observedMaxStamina;
    context.staminaRatio = getStaminaRatio(context);

    if (isMyServe(state, cfg)) {
      const selectedAction = playServe(inputs, context);
      lastDebugInfo = buildDebugInfo(
        currentProfileId,
        getCurrentTypeLabel(),
        null,
        null,
        selectedAction,
        cooldowns,
        context,
      );
      return inputs;
    }

    const prediction = predictBallLanding(state, context.playerSide, context);
    const targetInfo = getTargetX(context, prediction);
    moveToward(inputs, context, targetInfo.targetX);
    const selectedAction = chooseAction(inputs, context, prediction);
    updateRallyMemoryAfterAction(rallyMemory, selectedAction, context);

    lastDebugInfo = buildDebugInfo(
      currentProfileId,
      getCurrentTypeLabel(),
      targetInfo,
      prediction,
      selectedAction,
      cooldowns,
      context,
    );
    return inputs;
  }

  function getCurrentTypeLabel() {
    return (
      AI_PROFILES[currentProfileId]?.label ??
      BOT_LABELS[currentProfileId] ??
      currentProfileId
    );
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
  const { state, player, ball, playerSide, cfg, profile, memory } = context;
  const actionKey = inputName(playerSide, "ACTION");
  const upKey = inputName(playerSide, "UP");
  const tick = memory?.tick ?? 0;

  if (state.serveStep === "ready") {
    memory.currentPlan = "SERVE_PREPARE";
    memory.serveState = "SERVE_PREPARE";
    memory.serveHitArmed = false;
    if (canUseAction("serveAction", context, 1)) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      memory.serveState = "SERVE_TOSS";
      memory.serveTossTick = tick;
      memory.lastAction = "SERVE_TOSS";
      memory.lastActionTick = tick;
      return "SERVE_TOSS";
    }
    return null;
  }

  if (state.serveStep !== "tossed") {
    memory.serveState = "SERVE_PREPARE";
    return null;
  }

  if (!Number.isFinite(memory.serveTossTick)) memory.serveTossTick = tick;
  if (
    memory.lastAction === "UNDERHAND_SERVE" ||
    memory.lastAction === "OVERHAND_SERVE" ||
    memory.lastAction === "JUMP_SERVE_HIT"
  ) {
    memory.serveState = "SERVE_HIT";
    return null;
  }
  const elapsed = tick - memory.serveTossTick;
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
  if (!inFrontReach) {
    memory.serveState = "SERVE_WAIT_FALL";
    return null;
  }

  const lowStamina = isLowStamina(context);
  const onlyUnderhand = canUnderhand && !canOverhand && !canJumpServe;
  const mustJumpServe = canJumpServe && !canOverhand && !canUnderhand;
  const preferJump =
    canJumpServe &&
    !lowStamina &&
    !onlyUnderhand &&
    (profile.preferJumpServe || !canOverhand);
  const tossRatio = state.serveTossY > 0 ? ball.y / state.serveTossY : 0;

  if (onlyUnderhand || (canUnderhand && !canOverhand && !preferJump)) {
    memory.serveState =
      elapsed < BOT_TUNING.underhandServeMinWaitTicks || ball.vy >= 0
        ? "SERVE_WAIT_FALL"
        : "SERVE_HIT";
    const underhandHitReady =
      elapsed >= BOT_TUNING.underhandServeMinWaitTicks &&
      ball.vy < 0 &&
      ball.y >= player.y + 0.012 &&
      ball.y <= groundHeadY * 0.98 &&
      canUseAction("serveAction", context, 1);
    if (underhandHitReady) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      memory.serveHitArmed = false;
      memory.lastAction = "UNDERHAND_SERVE";
      memory.lastActionTick = tick;
      return "UNDERHAND_SERVE";
    }
    return null;
  }

  if (preferJump || mustJumpServe) {
    const jumpReady =
      elapsed >= BOT_TUNING.jumpServeMinWaitTicks &&
      player.onGround &&
      ball.vy <= 0 &&
      ball.y >= groundHeadY + armLen * 0.55 &&
      canUseAction("serveJump", context, 1);
    if (jumpReady) {
      inputs[upKey] = true;
      setCooldown("serveJump", context, 1);
      memory.serveState = "SERVE_WAIT_FALL";
      memory.lastAction = "SERVE_JUMP";
      memory.lastActionTick = tick;
      return "SERVE_JUMP";
    }

    const jumpServeHitWindow =
      !player.onGround &&
      elapsed >= BOT_TUNING.jumpServeMinWaitTicks + BOT_TUNING.jumpServeReactionTicks &&
      ball.vy < 0 &&
      ball.y >= headY - BOT_TUNING.serveHitBufferY &&
      ball.y <= headY + armLen + BOT_TUNING.serveHitBufferY;
    const jumpHitReady =
      jumpServeHitWindow &&
      tossRatio >= Math.min(0.92, profile.serveHitRatio ?? 0.58);
    if (jumpHitReady && canUseAction("serveAction", context, 1)) {
      inputs[actionKey] = true;
      setCooldown("serveAction", context, 1);
      memory.serveState = "SERVE_HIT";
      memory.lastAction = "JUMP_SERVE_HIT";
      memory.lastActionTick = tick;
      return "JUMP_SERVE_HIT";
    }

    if (!player.onGround) {
      memory.serveState = "SERVE_WAIT_FALL";
      return null;
    }
  }

  const overhandReady =
    canOverhand &&
    elapsed >= 12 &&
    (ball.vy < 0 || lowStamina) &&
    ball.y >= groundHeadY &&
    ball.y <= groundHeadY + armLen &&
    canUseAction("serveAction", context, 1);
  if (overhandReady) {
    inputs[actionKey] = true;
    setCooldown("serveAction", context, 1);
    memory.serveState = "SERVE_HIT";
    memory.lastAction = "OVERHAND_SERVE";
    memory.lastActionTick = tick;
    return "OVERHAND_SERVE";
  }

  memory.serveState = "SERVE_WAIT_FALL";
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
  const netX = finiteNumber(
    state?.net?.x,
    options.netX ?? cfg.netX ?? cfg.mapWidth / 2,
  );
  const bounds =
    options.sideMinX !== undefined && options.sideMaxX !== undefined
      ? { min: options.sideMinX, max: options.sideMaxX }
      : getCourtBounds(botSide, netX, cfg);

  if (!ball) {
    const fallbackX = getDefensiveHomeX({
      ...options,
      playerSide: botSide,
      sideMinX: bounds.min,
      sideMaxX: bounds.max,
    });
    return makePrediction(fallbackX, null, null, [], false, 0);
  }

  const speed = ballSpeed(ball);
  const extraTicks =
    speed >= BOT_TUNING.veryFastBallSpeed
      ? 48
      : speed >= BOT_TUNING.fastBallSpeed
        ? 24
        : 0;
  const trajectory = simulateBallTrajectory(ball, {
    ...cfg,
    netX,
    ticks: (cfg.maxPredictionTicks ?? BOT_TUNING.predictionTicks) + extraTicks,
  });

  const landing = trajectory.find((p) => p.y - cfg.ballRadius <= 0) ??
    trajectory[trajectory.length - 1] ?? {
      x: ball.x,
      y: ball.y,
      tick: 0,
      vx: ball.vx,
      vy: ball.vy,
    };
  const firstMyCourtPoint = trajectory.find((p) =>
    isInMyCourt(p.x, botSide, netX),
  );
  const myCourtLowPoint = trajectory.find(
    (p) =>
      isInMyCourt(p.x, botSide, netX) &&
      p.y < dynamicLowBallY(speed) &&
      p.vy < 0,
  );
  const intercept = findBestIntercept(
    trajectory,
    botSide,
    netX,
    options.player,
    cfg,
    speed,
  );
  const selected = myCourtLowPoint ?? firstMyCourtPoint ?? landing;
  const landingX = clampToCourt(selected.x, botSide, {
    netX,
    cfg,
    sideMinX: bounds.min,
    sideMaxX: bounds.max,
  });

  return makePrediction(
    landingX,
    selected.tick,
    intercept,
    trajectory,
    !!firstMyCourtPoint,
    speed,
  );
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

    if (
      x + cfg.ballRadius > netLeft &&
      x - cfg.ballRadius < netRight &&
      y - cfg.ballRadius < netTop
    ) {
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
  const nearNet =
    Math.abs(ball.x - netX) <
    BOT_TUNING.blockNetRange * profile.blockMultiplier;
  const highNearNet = nearNet && ball.y > BOT_TUNING.highBallY;
  const sendOver = shouldSendOver(context.state, prediction, profile, context);

  if (isOpponentJumpServeIncoming(context.state, prediction, context)) {
    return {
      targetX: clampToCourt(
        prediction.intercept?.x ?? prediction.landingX,
        playerSide,
        context,
      ),
      mode: "serve-receive",
    };
  }

  if (sendOver) {
    const targetX = getSendOverPreparationX(context, prediction);
    return { targetX, mode: "send-over" };
  }

  if (highNearNet && (comingToMe || isOpponentLikelyAttacking(context))) {
    return {
      targetX: clampToCourt(getBlockX(context), playerSide, context),
      mode: "block",
    };
  }

  if (comingToMe || prediction.willEnterMyCourt) {
    const homeX = getDefensiveHomeX(context);
    const predicted = prediction.intercept?.x ?? prediction.landingX;
    const speedBias = prediction.speed >= BOT_TUNING.fastBallSpeed ? 1 : 0;
    const blend = clamp(profile.predictionBlend + speedBias * 0.08, 0, 1);
    return {
      targetX: clampToCourt(
        predicted * blend + homeX * (1 - blend),
        playerSide,
        context,
      ),
      mode: speedBias ? "fast-intercept" : "intercept",
    };
  }

  if (ball.y > BOT_TUNING.attackMinY && Math.abs(ball.x - netX) < 0.2) {
    const attackX = getAttackX(context);
    const homeX = getDefensiveHomeX(context, true);
    return {
      targetX: clampToCourt(
        attackX * profile.attackBias + homeX * (1 - profile.attackBias),
        playerSide,
        context,
      ),
      mode: "pressure",
    };
  }

  return { targetX: getDefensiveHomeX(context, true), mode: "home" };
}

function chooseAction(inputs, context, prediction) {
  const window = getPlayableWindow(context, prediction);
  const staminaMode = getStaminaMode(context);
  const receiveLoopPressure = getReceiveLoopPressure(context.memory, context);
  context.playableWindow = window;
  context.staminaMode = staminaMode;
  context.receiveLoopPressure = receiveLoopPressure;
  context.decisionReason = null;

  const sendOverChoice = chooseSendOverAction(
    context.state,
    prediction,
    context.profile,
    context,
  );
  const urgency = Math.max(
    getUrgency(context, prediction),
    sendOverChoice?.urgency ?? 0,
    receiveLoopPressure.urgency,
  );
  const candidates = [];
  const receiveLoopEscape =
    receiveLoopPressure.shouldEscape && window.clearableNow;
  const currentVeryLow =
    context.ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 0.68;
  const stableReceiveProfile = context.profileId !== "aggressive";
  const saveFirst =
    window.receiveSaveNow &&
    !receiveLoopEscape &&
    ((context.ball.vy < -0.006 &&
      context.ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 1.35) ||
      (stableReceiveProfile &&
        context.ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 1.25));
  const serveReceive = shouldReceiveServe(
    context.state,
    prediction,
    context.profile,
    context,
  );
  const receiveSuppressed = shouldSuppressReceiveByStamina(
    context,
    receiveLoopPressure,
    prediction,
  );
  const followUpChoice = chooseReceiveFollowUp(
    context,
    prediction,
    window,
    receiveLoopPressure,
  );

  if (
    serveReceive &&
    !receiveSuppressed &&
    canSpend("receive", context, Math.max(urgency, 0.82), window)
  ) {
    candidates.push({
      action: "SERVE_RECEIVE",
      reason: "serve_receive",
      score: 102,
      apply() {
        inputs[inputName(context.playerSide, "DOWN")] = true;
        context.memory.currentPlan = "DEFEND";
        setCooldown("receive", context, Math.max(urgency, 0.82));
      },
    });
  }

  if (
    shouldLowStaminaClear(context, prediction, window, receiveLoopPressure) &&
    canSpend("clear", context, urgency, window)
  ) {
    candidates.push({
      action: context.player.onGround ? "LOW_STAMINA_FACE_CLEAR" : "LOW_STAMINA_CLEAR",
      reason: receiveLoopEscape ? "receive_loop_escape" : "low_stamina_clear",
      score:
        94 +
        receiveLoopPressure.score * 18 +
        (staminaMode === "critical" ? 4 : 0),
      apply() {
        pressTowardOpponent(inputs, context);
        context.memory.currentPlan = "LOW_STAMINA_CLEAR";
        if (canSpikeNow(context, prediction, window)) {
          inputs[inputName(context.playerSide, "ACTION")] = true;
          setCooldown("spike", context, urgency);
        } else if (shouldJumpForSpike(context, prediction, window) && canSpend("jump", context, urgency, window)) {
          inputs[inputName(context.playerSide, "UP")] = true;
          setCooldown("jump", context, urgency);
        } else if (context.ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 0.82 && canUseAction("receive", context, urgency)) {
          inputs[inputName(context.playerSide, "DOWN")] = true;
          setCooldown("receive", context, urgency);
        } else {
          setCooldown("clear", context, urgency);
        }
      },
    });
  }

  if (followUpChoice) {
    candidates.push({
      action: followUpChoice.action,
      reason: followUpChoice.reason,
      score: followUpChoice.score,
      apply() {
        followUpChoice.apply(inputs, context, prediction, window, urgency);
      },
    });
  }

  if (
    sendOverChoice?.action === "SPIKE" &&
    !saveFirst &&
    canSpikeNow(context, prediction, window) &&
    canSpend("spike", context, urgency, window)
  ) {
    candidates.push({
      action: sendOverChoice.jump ? "SEND_OVER_JUMP_SPIKE" : "SEND_OVER_SPIKE",
      reason: receiveLoopEscape ? "receive_loop_escape" : "send_over_clear",
      score:
        86 +
        (context.profile.sendOverAggression ?? 1) * 8 +
        receiveLoopPressure.score * 12,
      apply() {
        inputs[inputName(context.playerSide, "ACTION")] = true;
        pressTowardOpponent(inputs, context);
        setCooldown("spike", context, urgency);
      },
    });
  }

  if (
    sendOverChoice?.action === "JUMP_SPIKE" &&
    !receiveLoopEscape &&
    !saveFirst
  ) {
    if (
      canSpikeNow(context, prediction, window) &&
      canSpend("spike", context, urgency, window)
    ) {
      candidates.push({
        action: "SEND_OVER_SPIKE",
        reason: "attackable_spike",
        score: 82 + (context.profile.sendOverAggression ?? 1) * 7,
        apply() {
          inputs[inputName(context.playerSide, "ACTION")] = true;
          pressTowardOpponent(inputs, context);
          setCooldown("spike", context, urgency);
        },
      });
    } else if (
      shouldJumpForSpike(context, prediction, window) &&
      canSpend("jump", context, urgency, window)
    ) {
      candidates.push({
        action: "SEND_OVER_JUMP",
        reason: "send_over_clear",
        score: 58 + (context.profile.sendOverAggression ?? 1) * 5,
        apply() {
          pressTowardOpponent(inputs, context);
          inputs[inputName(context.playerSide, "UP")] = true;
          setCooldown("jump", context, urgency);
        },
      });
    }
  }

  const suppressReceive =
    (receiveLoopEscape && !currentVeryLow) ||
    (receiveSuppressed && !serveReceive);
  if (
    !suppressReceive &&
    window.receiveSaveNow &&
    canSpend("receive", context, urgency, window)
  ) {
    candidates.push({
      action: "RECEIVE",
      reason: staminaMode === "critical" ? "emergency_save" : "stable_receive",
      score:
        currentVeryLow || saveFirst ? 96 : 70 - receiveLoopPressure.score * 24,
      apply() {
        inputs[inputName(context.playerSide, "DOWN")] = true;
        context.memory.currentPlan = "RECEIVE_SETUP";
        if (
          sendOverChoice?.directionalAssist ||
          receiveLoopPressure.score > 0.4
        )
          pressTowardOpponent(inputs, context);
        setCooldown("receive", context, urgency);
      },
    });
  }

  const diveNeeded =
    window.diveSaveSoon &&
    !shouldAvoidDiveOnServe(context.state, prediction, context.profile, context) &&
    (!window.receiveSaveNow ||
      window.dx >
        BOT_TUNING.receiveRangeX *
          (context.profile.receiveMultiplier ?? 1) *
          1.08);
  if (diveNeeded && canSpend("dive", context, urgency, window)) {
    candidates.push({
      action: "DIVE",
      reason: "emergency_save",
      score: 78 + urgency * 18,
      apply() {
        pressDive(
          inputs,
          context,
          prediction.intercept?.x ?? prediction.landingX,
        );
        setCooldown("dive", context, urgency);
        context.memory.currentPlan = "EMERGENCY_DIVE";
      },
    });
  }

  if (
    shouldBlock(context, prediction) &&
    window.blockThreat &&
    canSpend("block", context, urgency, window)
  ) {
    candidates.push({
      action: "BLOCK",
      reason: "block_threat",
      score: 64 + (context.profile.blockMultiplier ?? 1) * 8,
      apply() {
        inputs[inputName(context.playerSide, "DOUBLE_UP")] = true;
        setCooldown("block", context, urgency);
      },
    });
  }

  if (
    !saveFirst &&
    shouldSpike(context, prediction, window) &&
    canSpikeNow(context, prediction, window) &&
    canSpend("spike", context, urgency, window)
  ) {
    candidates.push({
      action: "SPIKE",
      reason: "attackable_spike",
      score:
        74 +
        (context.profileId === "aggressive" ? 10 : 0) +
        (context.profile.spikeFreedom ?? 0) * 16,
      apply() {
        inputs[inputName(context.playerSide, "ACTION")] = true;
        pressTowardOpponent(inputs, context);
        setCooldown("spike", context, urgency);
      },
    });
  }

  if (
    shouldJump(context, prediction) &&
    shouldJumpForSpike(context, prediction, window) &&
    canSpend("jump", context, urgency, window)
  ) {
    candidates.push({
      action: "JUMP",
      reason: "jump_setup",
      score: 42 + (context.profile.jumpLeadBonus ?? 0),
      apply() {
        inputs[inputName(context.playerSide, "UP")] = true;
        setCooldown("jump", context, urgency);
      },
    });
  }

  const selected = pickActionCandidate(candidates);
  if (!selected) {
    context.decisionReason = window.incoming
      ? "conserve_stamina"
      : "no_playable_ball";
    return null;
  }

  selected.apply();
  context.decisionReason = selected.reason;
  return selected.action;
}

function getPlayableWindow(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const speed = prediction?.speed ?? ballSpeed(ball);
  const target = prediction?.intercept ?? {
    x: prediction?.landingX ?? ball.x,
    y: ball.y,
    tick: prediction?.landingTick ?? 99,
    vy: ball.vy,
  };
  const dx = Math.abs(ball.x - player.x);
  const targetDx = Math.abs((target?.x ?? ball.x) - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.1));
  const inFront =
    (ball.x - player.x) * getFacingTowardOpponent(playerSide) >
    -COMMON_SEND_OVER.clearAttemptRange * 0.18;
  const incoming =
    isInMyCourt(ball.x, playerSide, netX) ||
    !!prediction?.willEnterMyCourt ||
    isInMyCourt(prediction?.landingX, playerSide, netX);
  const nearNetOwnSide =
    Math.abs(ball.x - netX) <= 0.12 + (profile.spikeFreedom ?? 0) * 0.18;
  const bodyReach =
    dy <=
    BOT_TUNING.spikeRangeY * Math.max(1, profile.spikeMultiplier ?? 1) +
      (profile.skillFreedom ?? 0) * 0.08;
  const clearRange =
    COMMON_SEND_OVER.clearAttemptRange *
    (0.92 + (profile.sendOverAggression ?? 1) * 0.24);
  const attackRange =
    BOT_TUNING.spikeRangeX * (profile.spikeMultiplier ?? 1) +
    (profile.spikeFreedom ?? 0) * 0.06;
  const clearableNow =
    incoming &&
    inFront &&
    bodyReach &&
    dx <= clearRange &&
    ball.y >= COMMON_SEND_OVER.lowStaminaClearY &&
    ball.y <= BOT_TUNING.attackMaxY + (profile.spikeFreedom ?? 0) * 0.1 &&
    (isInMyCourt(ball.x, playerSide, netX) || nearNetOwnSide);
  const attackableNow =
    shouldSpikeGeometry(context) && targetDx <= attackRange * 1.35;
  const receiveSaveNow = shouldReceive(context, prediction);
  const diveSaveSoon = shouldDive(context, prediction);
  const blockThreat = shouldBlock(context, prediction);
  const jumpSetupSoon =
    player.onGround &&
    incoming &&
    targetDx <= attackRange * 1.25 &&
    (target?.y ?? ball.y) >= BOT_TUNING.attackMinY &&
    (target?.tick ?? 99) <=
      BOT_TUNING.jumpLeadTicks +
        (profile.jumpLeadBonus ?? 0) +
        (speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastJumpLeadBonus : 0);

  return {
    incoming,
    closeNow:
      dx <=
      Math.max(
        clearRange,
        BOT_TUNING.receiveRangeX * (profile.receiveMultiplier ?? 1),
      ),
    attackableNow,
    clearableNow,
    receiveSaveNow,
    diveSaveSoon,
    blockThreat,
    jumpSetupSoon,
    tickToContact: target?.tick ?? null,
    dx,
    dy,
  };
}

function getStaminaMode(context) {
  const ratio = getStaminaRatio(context);
  if (ratio <= STAMINA_TUNING.criticalRatio) return "critical";
  if (ratio <= STAMINA_TUNING.lowRatio) return "low";
  return "safe";
}

function getReceiveLoopPressure(memory, context) {
  const policy =
    LOW_STAMINA_POLICY[context.profileId] ?? LOW_STAMINA_POLICY.rally;
  const receiveCount = memory?.consecutiveReceiveCount ?? 0;
  const ownCourtTicks = memory?.ownCourtTicks ?? 0;
  const receivePressure = clamp(
    receiveCount / Math.max(1, policy.receiveRepeatLimit),
    0,
    1,
  );
  const courtPressure = clamp(
    ownCourtTicks / Math.max(1, policy.ownCourtTicksBeforeClear),
    0,
    1,
  );
  const lowStaminaBonus = isLowStamina(context) ? 0.35 : 0;
  const score = clamp(
    Math.max(receivePressure, courtPressure) + lowStaminaBonus,
    0,
    1,
  );
  return {
    score,
    receiveCount,
    ownCourtTicks,
    receiveLimit: policy.receiveRepeatLimit,
    ownCourtLimit: policy.ownCourtTicksBeforeClear,
    shouldEscape:
      receiveCount >= policy.receiveRepeatLimit ||
      ownCourtTicks >= policy.ownCourtTicksBeforeClear,
    urgency: score * 0.42,
  };
}

function canSpend(actionName, context, urgency = 0, window = null) {
  const staminaMode = context.staminaMode ?? getStaminaMode(context);

  if (actionName === "receive")
    return canUseAction("receive", context, urgency);
  if (actionName === "block")
    return (
      staminaMode !== "critical" && canUseAction("block", context, urgency)
    );

  if (actionName === "dive") {
    if (!window?.diveSaveSoon) return false;
    if (staminaMode === "critical" && urgency < STAMINA_TUNING.criticalUrgency)
      return false;
    return canUseAction("dive", context, urgency);
  }

  if (actionName === "jump") {
    if (!window?.jumpSetupSoon || staminaMode !== "safe") return false;
    return canUseAction("jump", context, urgency);
  }

  if (actionName === "spike") {
    if (!window?.attackableNow && !window?.clearableNow) return false;
    if (staminaMode === "critical") return false;
    return canUseAction(
      "spike",
      context,
      Math.max(urgency, window?.attackableNow ? 0.65 : 0.82),
    );
  }

  if (actionName === "clear") {
    if (!window?.clearableNow) return false;
    // Clear is implemented by ACTION in the engine, so only allow it when the ball
    // is actually playable. Critical stamina may still attempt a close clear to
    // escape a receive-only rally loop because the engine accepts ACTION at 0 stamina.
    if (staminaMode === "critical") return true;
    return (
      canUseAction("spike", context, Math.max(urgency, 0.86)) ||
      canUseAction("clear", context, urgency)
    );
  }

  return canUseAction(actionName, context, urgency);
}

function pickActionCandidate(candidates) {
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.score - a.score)[0];
}

function isOpponentServeThreat(state, context) {
  if (!state || !context?.ball) return false;
  if (state.phase === "serve" && state.server && state.server !== context.cfg.playerId)
    return true;
  const serverIsOpponent = state.server && state.server !== context.cfg.playerId;
  const earlyRallyFromOpponentServe =
    serverIsOpponent &&
    context.memory?.ownCourtTicks < BOT_TUNING.serveReceiveDiveLockTicks &&
    ballMovingTowardSide(context.ball, context.playerSide);
  const opponentServeAction =
    context.opponent?.actionType === "SERVE_HIT" ||
    context.opponent?.actionType === "SERVE" ||
    (context.opponent?.actionType === "JUMP" &&
      !isInMyCourt(context.ball.x, context.playerSide, context.netX));
  return !!(
    earlyRallyFromOpponentServe ||
    (opponentServeAction &&
      (ballMovingTowardSide(context.ball, context.playerSide) ||
        context.ball.y >= BOT_TUNING.highBallY))
  );
}

function isOpponentJumpServeIncoming(state, prediction, context) {
  if (!isOpponentServeThreat(state, context)) return false;
  const opponentAirServe =
    context.opponent?.actionType === "JUMP" ||
    context.opponent?.actionType === "SERVE_HIT" ||
    state?.serveStep === "tossed";
  const fastIncoming =
    (prediction?.speed ?? ballSpeed(context.ball)) >=
      BOT_TUNING.fastBallSpeed * 0.72 ||
    Math.abs(context.ball.vx ?? 0) >= BOT_TUNING.fastBallSpeed * 0.52;
  return !!(
    opponentAirServe &&
    (fastIncoming ||
      prediction?.willEnterMyCourt ||
      ballMovingTowardSide(context.ball, context.playerSide))
  );
}

function shouldReceiveServe(state, prediction, _profile, context) {
  if (!isOpponentJumpServeIncoming(state, prediction, context)) return false;
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const target = prediction?.intercept ?? {
    x: prediction?.landingX ?? ball.x,
    y: ball.y,
    tick: prediction?.landingTick ?? 99,
    vy: ball.vy,
  };
  const ballInMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const incoming = ballInMyCourt || prediction?.willEnterMyCourt;
  if (!incoming) return false;
  const speed = prediction?.speed ?? ballSpeed(ball);
  const dx = Math.abs(target.x - player.x);
  const receiveRange =
    BOT_TUNING.receiveRangeX * (profile.receiveMultiplier ?? 1) +
    BOT_TUNING.fastReceiveRangeBonus * 1.15 +
    (profile.skillFreedom ?? 0) * 0.06;
  const heightGate =
    dynamicLowBallY(speed) * (1.45 + (profile.skillFreedom ?? 0) * 0.8);
  const timingGate =
    target.tick <= (speed >= BOT_TUNING.fastBallSpeed ? 34 : 26) ||
    (ballInMyCourt && ball.y <= heightGate);
  return (
    timingGate &&
    dx <= receiveRange &&
    (target.y <= heightGate || ball.y <= heightGate) &&
    (target.vy <= 0 || ball.vy <= 0)
  );
}

function shouldAvoidDiveOnServe(state, prediction, _profile, context) {
  if (!isOpponentJumpServeIncoming(state, prediction, context)) return false;
  const { player, ball, playerSide, netX } = context;
  if (!isInMyCourt(ball.x, playerSide, netX)) return true;
  const target = prediction?.intercept ?? {
    x: prediction?.landingX ?? ball.x,
    y: ball.y,
    tick: prediction?.landingTick ?? 99,
    vy: ball.vy,
  };
  if (canReachByWalking(player, target.x, target.tick, context)) return true;
  if ((target.tick ?? 99) > 6) return true;
  if (ball.y > BOT_TUNING.veryLowBallY * 0.9) return true;
  return false;
}

function canReachByWalking(player, landingX, ticksToLanding, context) {
  const speed = context.cfg?.playerSpeed ?? DEFAULTS.playerSpeed;
  const reaction = context.cfg?.reactionDelayTicks ?? DEFAULTS.reactionDelayTicks;
  const travelTicks = Math.max(0, finiteNumber(ticksToLanding, 0) - reaction);
  const receiveCushion =
    BOT_TUNING.receiveRangeX *
    (0.75 + (context.profile?.receiveMultiplier ?? 1) * 0.22);
  return (
    Math.abs(finiteNumber(landingX, player?.x ?? 0.5) - (player?.x ?? 0.5)) <=
    speed * travelTicks + receiveCushion
  );
}

function shouldSuppressReceiveByStamina(context, receiveLoopPressure, prediction) {
  const ratio = getStaminaRatio(context);
  if (ratio > STAMINA_TUNING.lowRatio) return false;
  const count = context.memory?.consecutiveReceiveCount ?? 0;
  const policy =
    LOW_STAMINA_POLICY[context.profileId] ?? LOW_STAMINA_POLICY.rally;
  const ballVeryLow =
    context.ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 0.72;
  if (ballVeryLow && receiveLoopPressure?.score < 0.9) return false;
  return (
    count >= Math.max(1, policy.receiveRepeatLimit) ||
    receiveLoopPressure?.shouldEscape ||
    (ratio <= STAMINA_TUNING.criticalRatio && count >= 1)
  );
}

function chooseReceiveFollowUp(context, prediction, window, receiveLoopPressure) {
  const memory = context.memory;
  if (!memory) return null;
  const recentlyReceived =
    memory.receivedBallRecently ||
    memory.lastSelectedAction === "RECEIVE" ||
    memory.lastSelectedAction === "SERVE_RECEIVE" ||
    memory.tick <= (memory.postReceivePlanUntil ?? 0);
  if (!recentlyReceived) return null;
  const { player, ball, playerSide, netX } = context;
  if (!isInMyCourt(ball.x, playerSide, netX)) return null;
  if (ball.y < COMMON_SEND_OVER.lowStaminaClearY) return null;

  const lowStamina = isLowStamina(context);
  const canAttackSetup =
    shouldPrepareSpike(context, prediction, window) ||
    ball.y >= COMMON_SEND_OVER.attackSetupMinY;

  if (lowStamina || receiveLoopPressure?.shouldEscape) {
    return {
      action: "SAFE_SEND_OVER",
      reason: "post_receive_safe_send_over",
      score: 76 + (receiveLoopPressure?.score ?? 0) * 14,
      apply(inputs, ctx) {
        pressTowardOpponent(inputs, ctx);
        ctx.memory.currentPlan = "SAFE_SEND_OVER";
      },
    };
  }

  if (player.onGround && canAttackSetup) {
    if (shouldJumpForSpike(context, prediction, window)) {
      return {
        action: "FOLLOW_UP_JUMP_ATTACK",
        reason: "post_receive_jump_attack",
        score: 80,
        apply(inputs, ctx, _prediction, _window, urgency) {
          pressTowardOpponent(inputs, ctx);
          inputs[inputName(ctx.playerSide, "UP")] = true;
          ctx.memory.currentPlan = "JUMP_ATTACK";
          setCooldown("jump", ctx, urgency);
        },
      };
    }
    return {
      action: "APPROACH_ATTACK",
      reason: "post_receive_approach",
      score: 62,
      apply(inputs, ctx) {
        pressTowardOpponent(inputs, ctx);
        ctx.memory.currentPlan = "APPROACH_ATTACK";
      },
    };
  }

  if (!player.onGround && canSpikeNow(context, prediction, window)) {
    return {
      action: "FOLLOW_UP_SPIKE",
      reason: "post_receive_spike",
      score: 88,
      apply(inputs, ctx, _prediction, _window, urgency) {
        inputs[inputName(ctx.playerSide, "ACTION")] = true;
        pressTowardOpponent(inputs, ctx);
        ctx.memory.currentPlan = "JUMP_ATTACK";
        setCooldown("spike", ctx, urgency);
      },
    };
  }

  return null;
}

function shouldSendOver(_state, prediction, profile, context) {
  if (!COMMON_SEND_OVER.enabled || !context?.ball || !context?.player)
    return false;
  const { ball, playerSide, netX, memory } = context;
  const ballInMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const predictedMyCourt =
    prediction?.willEnterMyCourt ||
    isInMyCourt(prediction?.landingX, playerSide, netX);
  if (!ballInMyCourt && !predictedMyCourt) return false;

  const attackable = canAttackOrClear(context.player, ball, context);
  const ownCourtTicks = memory?.ownCourtTicks ?? 0;
  const repeatedReceive =
    (memory?.consecutiveReceiveCount ?? 0) >=
    COMMON_SEND_OVER.receiveRepeatLimit;
  const urgency = getSendOverUrgency(context, prediction, profile);

  return (
    attackable ||
    repeatedReceive ||
    ownCourtTicks >= COMMON_SEND_OVER.minOwnCourtTicksBeforeUrgency ||
    urgency >= 0.45
  );
}

function canAttackOrClear(player, ball, context) {
  const profile = context.profile ?? AI_PROFILES.rally;
  const aggression = profile.sendOverAggression ?? 1;
  const risk = profile.sendOverRisk ?? 1;
  const facing = getFacingTowardOpponent(context.playerSide);
  const inFront =
    (ball.x - player.x) * facing > -COMMON_SEND_OVER.clearAttemptRange * 0.18;
  const dx = Math.abs(ball.x - player.x);
  const bodyY = player.y + 0.1;
  const dy = Math.abs(ball.y - bodyY);
  const clearRange =
    COMMON_SEND_OVER.clearAttemptRange * (0.9 + aggression * 0.28);
  const spikeRange =
    COMMON_SEND_OVER.spikeAttemptRange * (0.9 + aggression * 0.34);
  const clearHeight =
    ball.y >= COMMON_SEND_OVER.clearAttemptY * (1.04 - risk * 0.12);
  const spikeHeight =
    ball.y >= COMMON_SEND_OVER.spikeAttemptY * (1.08 - risk * 0.14);
  const notTooHigh =
    ball.y <= BOT_TUNING.attackMaxY + (profile.spikeFreedom ?? 0) * 0.12;
  const bodyReach =
    dy <=
    BOT_TUNING.spikeRangeY * Math.max(1, profile.spikeMultiplier) +
      (profile.skillFreedom ?? 0) * 0.08;
  return (
    inFront &&
    notTooHigh &&
    bodyReach &&
    ((spikeHeight && dx <= spikeRange) || (clearHeight && dx <= clearRange))
  );
}

function getOpponentCourtTargetX(state, botSide) {
  const cfg = DEFAULTS;
  const netX = finiteNumber(state?.net?.x, cfg.mapWidth / 2);
  const opponentSide = botSide === "left" ? "right" : "left";
  const bounds = getCourtBounds(opponentSide, netX, cfg);
  return opponentSide === "left"
    ? bounds.min + (bounds.max - bounds.min) * 0.58
    : bounds.min + (bounds.max - bounds.min) * 0.42;
}

function chooseSendOverAction(state, prediction, profile, context) {
  if (!shouldSendOver(state, prediction, profile, context)) return null;
  const { player, ball, playerSide, netX, memory } = context;
  const urgency = getSendOverUrgency(context, prediction, profile);
  const ballInMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const reachable = canAttackOrClear(player, ball, context);
  const dx = Math.abs(ball.x - player.x);
  const height = ball.y;
  const repeatedReceive =
    (memory?.consecutiveReceiveCount ?? 0) >=
    COMMON_SEND_OVER.receiveRepeatLimit;
  const oldOwnCourtBall =
    (memory?.ownCourtTicks ?? 0) >=
    COMMON_SEND_OVER.minOwnCourtTicksBeforeUrgency;
  const nearNet = Math.abs(ball.x - netX) <= 0.15;
  const highEnough =
    height >=
    COMMON_SEND_OVER.spikeAttemptY *
      (context.profileId === "defensive" ? 1.02 : 0.94);
  const notMovingAwayFromOpponent =
    finiteNumber(ball.vx, 0) * getFacingTowardOpponent(playerSide) >= -0.001;

  if (
    reachable &&
    !player.onGround &&
    highEnough &&
    (notMovingAwayFromOpponent ||
      repeatedReceive ||
      oldOwnCourtBall ||
      nearNet ||
      urgency >= 0.35)
  ) {
    return { action: "SPIKE", urgency, directionalAssist: true };
  }

  if (
    player.onGround &&
    highEnough &&
    notMovingAwayFromOpponent &&
    height > dynamicLowBallY(prediction?.speed ?? 0) * 1.18 &&
    dx <=
      COMMON_SEND_OVER.spikeAttemptRange *
        (1.1 + (profile.sendOverAggression ?? 1) * 0.28)
  ) {
    return { action: "JUMP_SPIKE", urgency, directionalAssist: true };
  }

  if (
    (repeatedReceive || oldOwnCourtBall) &&
    reachable &&
    !player.onGround &&
    height >= COMMON_SEND_OVER.clearAttemptY
  ) {
    return {
      action: "SPIKE",
      urgency: Math.max(urgency, 0.72),
      directionalAssist: true,
    };
  }

  if (
    ballInMyCourt &&
    height <= dynamicLowBallY(prediction?.speed ?? 0) * 1.12
  ) {
    return { action: "RECEIVE", urgency, directionalAssist: true };
  }

  return { action: null, urgency, directionalAssist: true };
}

function getSendOverUrgency(context, prediction, profile) {
  const ownCourtTicks = context.memory?.ownCourtTicks ?? 0;
  const receiveCount = context.memory?.consecutiveReceiveCount ?? 0;
  const tickPressure = clamp(
    (ownCourtTicks - COMMON_SEND_OVER.minOwnCourtTicksBeforeUrgency) / 70,
    0,
    0.45,
  );
  const receivePressure = clamp(
    (receiveCount - COMMON_SEND_OVER.receiveRepeatLimit + 1) * 0.18,
    0,
    0.42,
  );
  const landingPressure = isInMyCourt(
    prediction?.landingX,
    context.playerSide,
    context.netX,
  )
    ? 0.12
    : 0;
  const profilePush = (profile.sendOverAggression ?? 1) * 0.08;
  return clamp(
    tickPressure + receivePressure + landingPressure + profilePush,
    0,
    1,
  );
}

function getSendOverPreparationX(context, prediction) {
  const { playerSide, netX, ball, player } = context;
  const facing = getFacingTowardOpponent(playerSide);
  const interceptX = prediction?.intercept?.x ?? ball.x;
  const behindBallX = interceptX - facing * COMMON_SEND_OVER.forwardPressure;
  const attackX = getAttackX(context);
  const urgency = getSendOverUrgency(context, prediction, context.profile);
  const blended =
    behindBallX * (0.62 + urgency * 0.18) + attackX * (0.38 - urgency * 0.18);
  const fallback = player.x + facing * COMMON_SEND_OVER.forwardPressure;
  return clampToCourt(
    Number.isFinite(blended) ? blended : fallback,
    playerSide,
    context,
  );
}

function shouldLowStaminaClear(
  context,
  prediction,
  window = null,
  receiveLoopPressure = null,
) {
  const { player, ball, playerSide, netX, profile, memory } = context;
  if (!isLowStamina(context)) return false;

  const policy =
    LOW_STAMINA_POLICY[context.profileId] ?? LOW_STAMINA_POLICY.rally;
  const playable = window ?? getPlayableWindow(context, prediction);
  const pressure =
    receiveLoopPressure ?? getReceiveLoopPressure(memory, context);
  if (!playable.clearableNow) return false;
  if (
    ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 0.68 &&
    !pressure.shouldEscape
  )
    return false;

  const facing = getFacingTowardOpponent(playerSide);
  const inFront =
    (ball.x - player.x) * facing > -COMMON_SEND_OVER.clearAttemptRange * 0.16;
  if (!inFront) return false;

  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.1));
  const aggression = profile.sendOverAggression ?? 1;
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const clearRange =
    COMMON_SEND_OVER.clearAttemptRange *
      policy.clearRangeScale *
      (0.9 + aggression * 0.22) +
    spikeFreedom * 0.05;
  const minClearY = Math.min(
    policy.clearY,
    COMMON_SEND_OVER.clearAttemptY *
      (1.02 - (profile.sendOverRisk ?? 1) * 0.12),
  );
  const reachableHeight =
    ball.y >= minClearY &&
    ball.y <= BOT_TUNING.attackMaxY + spikeFreedom * 0.08;
  const reachableBody =
    dy <=
    BOT_TUNING.spikeRangeY * Math.max(1, profile.spikeMultiplier ?? 1) +
      spikeFreedom * 0.08;
  const attackableCourt =
    isInMyCourt(ball.x, playerSide, netX) ||
    Math.abs(ball.x - netX) <= 0.12 + spikeFreedom * 0.18;
  const needsClear =
    pressure.shouldEscape ||
    playable.clearableNow ||
    prediction.willEnterMyCourt ||
    isInMyCourt(ball.x, playerSide, netX);
  const notJustPanicOnVeryLow =
    ball.y >= policy.clearY || pressure.shouldEscape;

  return (
    dx <= clearRange &&
    reachableHeight &&
    reachableBody &&
    attackableCourt &&
    needsClear &&
    notJustPanicOnVeryLow
  );
}

function shouldReceive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const incoming =
    isInMyCourt(ball.x, playerSide, netX) || prediction.willEnterMyCourt;
  if (!incoming) return false;

  const speed = prediction.speed;
  const target = prediction.intercept ?? {
    x: prediction.landingX,
    y: ball.y,
    tick: prediction.landingTick ?? 99,
    vy: ball.vy,
  };
  const dx = Math.abs(target.x - player.x);
  const dy = Math.abs(target.y - (player.y + 0.035));
  const speedBonus =
    speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastReceiveRangeBonus : 0;
  const freedom = profile.skillFreedom ?? 0;
  const receiveRangeX =
    BOT_TUNING.receiveRangeX * profile.receiveMultiplier +
    speedBonus +
    freedom * 0.05;
  const receiveRangeY =
    BOT_TUNING.receiveRangeY * profile.receiveMultiplier + freedom * 0.04;
  const imminentLimit =
    (speed >= BOT_TUNING.fastBallSpeed ? 22 : 16) + Math.round(freedom * 18);
  const receiveY =
    dynamicLowBallY(speed) * profile.receiveMultiplier + freedom * 0.06;
  const imminent = target.tick <= imminentLimit && target.y <= receiveY;
  const currentLowClose =
    ball.y <= receiveY && Math.abs(ball.x - player.x) <= receiveRangeX;
  return (
    (imminent &&
      dx <= receiveRangeX &&
      dy <= receiveRangeY &&
      target.vy <= 0) ||
    currentLowClose
  );
}

function shouldDive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  if (shouldAvoidDiveOnServe(context.state, prediction, profile, context))
    return false;
  if (!isInMyCourt(ball.x, playerSide, netX) && !prediction?.willEnterMyCourt)
    return false;
  if (!isInMyCourt(prediction.landingX, playerSide, netX))
    return false;
  const memory = context.memory ?? {};
  if ((memory.tick ?? 0) < (memory.postDiveRecoveryUntil ?? 0)) return false;
  if (
    (memory.tick ?? 0) - (memory.lastDiveTick ?? -Infinity) <
    BOT_TUNING.minDiveIntervalTicks
  )
    return false;
  if (getStaminaRatio(context) < BOT_TUNING.minDiveStaminaRatio) return false;
  const speed = prediction.speed;
  const target = prediction.intercept ?? {
    x: prediction.landingX,
    y: ball.y,
    tick: prediction.landingTick ?? 99,
    vy: ball.vy,
  };
  const freedom = profile.skillFreedom ?? 0;
  const receiveLimit =
    BOT_TUNING.receiveRangeX * profile.receiveMultiplier +
    (speed >= BOT_TUNING.fastBallSpeed
      ? BOT_TUNING.fastReceiveRangeBonus * 0.6
      : 0);
  const diveLimit =
    BOT_TUNING.diveRangeX * profile.diveMultiplier +
    (speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastDiveRangeBonus : 0) +
    freedom * 0.08;
  const dx = Math.abs(target.x - player.x);
  const expectedDirection = target.x < player.x ? "left" : "right";
  if (
    memory.lastDiveDirection &&
    memory.lastDiveDirection !== expectedDirection &&
    (memory.tick ?? 0) < (memory.diveDirectionLockUntil ?? 0)
  )
    return false;
  const tooFarForReceive = dx > receiveLimit * (0.84 - freedom * 0.2);
  const reachableByDive = dx <= diveLimit;
  const canWalk = canReachByWalking(player, target.x, target.tick, context);
  if (canWalk && target.tick > 8) return false;
  const lead =
    BOT_TUNING.diveLeadTicks +
    profile.diveLeadBonus +
    (speed >= BOT_TUNING.fastBallSpeed ? 8 : 0) +
    Math.round(freedom * 20);
  const soonLow =
    target.tick <= lead &&
    target.y <= dynamicLowBallY(speed) * (1.1 + freedom * 0.6);
  const currentEmergency =
    ball.y <= BOT_TUNING.veryLowBallY * (0.92 + freedom * 0.25) &&
    Math.abs(ball.x - player.x) <=
      BOT_TUNING.diveCommitRangeX * profile.diveMultiplier + freedom * 0.06;
  return (
    (tooFarForReceive && !canWalk && reachableByDive && soonLow && target.vy <= 0) ||
    (currentEmergency && !canWalk)
  );
}

function shouldBlock(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const freedom = profile.skillFreedom ?? 0;
  const nearNet =
    Math.abs(ball.x - netX) <=
    BOT_TUNING.blockNetRange * profile.blockMultiplier + freedom * 0.05;
  const blockX = getBlockX(context);
  const aligned =
    Math.abs(player.x - blockX) <=
    BOT_TUNING.blockXRange * profile.blockMultiplier + freedom * 0.04;
  const highEnough = ball.y >= BOT_TUNING.highBallY * (0.88 - freedom * 0.18);
  const threat =
    ballMovingTowardSide(ball, playerSide) ||
    isOpponentLikelyAttacking(context) ||
    prediction.willEnterMyCourt ||
    Math.abs(ball.x - netX) < 0.08 + freedom * 0.08;
  const timing =
    prediction.intercept?.tick == null ||
    prediction.intercept.tick <=
      BOT_TUNING.blockLeadTicks +
        profile.blockLeadBonus +
        Math.round(freedom * 20);
  return nearNet && aligned && highEnough && threat && timing;
}

function shouldSpike(context, _prediction, window = null) {
  const playable = window ?? getPlayableWindow(context, _prediction);
  if (!playable.attackableNow) return false;
  return canSpikeNow(context, _prediction, playable);
}

function canSpikeNow(context, prediction, window = null) {
  const playable = window ?? getPlayableWindow(context, prediction);
  if (!playable.attackableNow) return false;
  const { player, ball, playerSide, netX, memory } = context;
  if (BOT_TUNING.spikeAirborneOnly && player.onGround) return false;
  if (!isAirborneAttackWindow(player, ball, context.profile)) return false;
  if (!isInMyCourt(ball.x, playerSide, netX) && Math.abs(ball.x - netX) > 0.12)
    return false;
  if (!isFacingOpponentCourt(player, playerSide)) return false;
  if ((memory?.tick ?? 0) < (memory?.postShiftRecoveryUntil ?? 0)) return false;
  if ((memory?.tick ?? 0) < (memory?.postSpikeRecoveryUntil ?? 0)) return false;
  if (
    (memory?.tick ?? 0) - (memory?.lastShiftTick ?? -Infinity) <
    BOT_TUNING.postShiftRecoveryTicks
  )
    return false;
  if (
    (memory?.tick ?? 0) - (memory?.lastSpikeTick ?? -Infinity) <
    BOT_TUNING.minSpikeIntervalTicks
  )
    return false;
  if (getStaminaRatio(context) < BOT_TUNING.minSpikeStaminaRatio) return false;
  if (ball.y <= dynamicLowBallY(prediction?.speed ?? 0) * 1.05 && ball.vy < 0)
    return false;
  return true;
}

function shouldPrepareSpike(context, prediction, window = null) {
  const playable = window ?? getPlayableWindow(context, prediction);
  if (!playable.incoming) return false;
  const { player, ball, playerSide, netX } = context;
  if (!isInMyCourt(ball.x, playerSide, netX) && Math.abs(ball.x - netX) > 0.14)
    return false;
  if (ball.y < COMMON_SEND_OVER.attackSetupMinY) return false;
  const dx = Math.abs((prediction?.intercept?.x ?? ball.x) - player.x);
  return dx <= BOT_TUNING.spikeRangeX * (1.8 + (context.profile.spikeFreedom ?? 0));
}

function shouldJumpForSpike(context, prediction, window = null) {
  const playable = window ?? getPlayableWindow(context, prediction);
  const { player, ball } = context;
  if (!player.onGround) return false;
  if (!shouldPrepareSpike(context, prediction, playable)) return false;
  if (getStaminaRatio(context) < STAMINA_TUNING.lowRatio) return false;
  const target = prediction?.intercept ?? { x: ball.x, y: ball.y, tick: 12 };
  const closeX =
    Math.abs(target.x - player.x) <=
    BOT_TUNING.spikeRangeX * (1.3 + (context.profile.spikeFreedom ?? 0));
  const lead =
    BOT_TUNING.jumpLeadTicks +
    (context.profile.jumpLeadBonus ?? 0) +
    (prediction?.speed >= BOT_TUNING.fastBallSpeed
      ? BOT_TUNING.fastJumpLeadBonus
      : 0);
  return closeX && target.y >= BOT_TUNING.attackMinY && target.tick <= lead + 8;
}

function isAirborneAttackWindow(player, ball, profile = AI_PROFILES.rally) {
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const headY = finiteNumber(player?.y, 0) + 0.1;
  const dxOk =
    Math.abs(finiteNumber(ball?.x, 0) - finiteNumber(player?.x, 0)) <=
    BOT_TUNING.spikeXWindow * (1 + spikeFreedom * 0.8);
  const dyOk =
    Math.abs(finiteNumber(ball?.y, 0) - headY) <=
    BOT_TUNING.spikeYWindow * (1.05 + spikeFreedom);
  const heightOk =
    finiteNumber(ball?.y, 0) >= BOT_TUNING.attackMinY &&
    finiteNumber(ball?.y, 0) <= BOT_TUNING.attackMaxY + spikeFreedom * 0.12;
  return !player?.onGround && dxOk && dyOk && heightOk;
}

function shouldSpikeGeometry(context) {
  const { player, ball, playerSide, netX, profile } = context;
  const inMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const inFront = (ball.x - player.x) * getFacingTowardOpponent(playerSide) > 0;
  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.1));
  const heightOk =
    ball.y >= BOT_TUNING.attackMinY - spikeFreedom * 0.05 &&
    ball.y <= BOT_TUNING.attackMaxY + spikeFreedom * 0.12;
  const rangeOk =
    dx <=
      BOT_TUNING.spikeRangeX * profile.spikeMultiplier + spikeFreedom * 0.06 &&
    dy <=
      BOT_TUNING.spikeRangeY * profile.spikeMultiplier + spikeFreedom * 0.08;
  const attackableCourt =
    inMyCourt || Math.abs(ball.x - netX) <= 0.12 + spikeFreedom * 0.18;
  return inFront && heightOk && rangeOk && attackableCourt;
}

function shouldJump(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const intercept = prediction.intercept;
  const spikeFreedom = profile.spikeFreedom ?? 0;
  const closeX =
    Math.abs((intercept?.x ?? ball.x) - player.x) <
    BOT_TUNING.spikeRangeX * (1.15 + spikeFreedom * 1.1);
  const speedBonus =
    prediction.speed >= BOT_TUNING.fastBallSpeed
      ? BOT_TUNING.fastJumpLeadBonus
      : 0;
  const leadTicks =
    BOT_TUNING.jumpLeadTicks +
    profile.jumpLeadBonus +
    speedBonus +
    Math.round(spikeFreedom * 16);
  const highEnough =
    (intercept?.y ?? ball.y) > BOT_TUNING.attackMinY - spikeFreedom * 0.04;
  const coming =
    isInMyCourt(ball.x, playerSide, netX) ||
    prediction.willEnterMyCourt ||
    ballMovingTowardSide(ball, playerSide);
  return coming && closeX && highEnough && (intercept?.tick ?? 0) <= leadTicks;
}

function hasStaminaBudget(actionName, context, urgency = 0) {
  const cost = STAMINA_TUNING.costs[actionName] ?? 0;
  if (cost <= 0) return true;

  const stamina = finiteNumber(
    context.player?.stamina,
    context.maxStamina ?? 0,
  );
  const ratio = getStaminaRatio(context);
  if (ratio > STAMINA_TUNING.lowRatio && stamina >= cost) return true;

  const critical =
    ratio <= STAMINA_TUNING.criticalRatio || stamina < cost * 0.5;
  const requiredUrgency = critical
    ? STAMINA_TUNING.criticalUrgency
    : STAMINA_TUNING.emergencyUrgency;

  return urgency >= requiredUrgency && stamina >= cost * 0.35;
}

function isLowStamina(context) {
  return getStaminaRatio(context) <= STAMINA_TUNING.lowRatio;
}

function getStaminaRatio(context) {
  const stamina = finiteNumber(context.player?.stamina, null);
  const maxStamina = finiteNumber(
    context.maxStamina ?? context.cfg?.maxStamina,
    stamina ?? 120,
  );
  if (stamina == null || maxStamina <= 0) return 1;
  return clamp(stamina / maxStamina, 0, 1);
}

function updateObservedMaxStamina(currentMax, player, cfg) {
  const configured = finiteNumber(cfg.maxStamina, null);
  const playerMax = finiteNumber(player?.maxStamina, null);
  const stamina = finiteNumber(player?.stamina, null);
  return (
    Math.max(configured ?? 0, playerMax ?? 0, currentMax ?? 0, stamina ?? 0) ||
    null
  );
}

function canUseAction(actionName, context, urgency = 0) {
  if (!hasStaminaBudget(actionName, context, urgency)) return false;

  const cooldown = context.cooldowns?.[actionName] ?? 0;
  if (cooldown <= 0) return true;

  const freedom = context.profile?.skillFreedom ?? 0;
  const skillAction =
    actionName === "receive" || actionName === "dive" || actionName === "block";
  const spikeFreedom =
    actionName === "spike" ? (context.profile?.spikeFreedom ?? 0) : 0;
  const urgencyGate = skillAction
    ? 0.58 - freedom * 0.7
    : 0.85 - spikeFreedom * 1.4;
  if (urgency < urgencyGate) return false;

  const baseOverride =
    actionName === "dive"
      ? 7
      : actionName === "receive"
        ? 5
        : actionName === "block"
          ? 5
          : 3;
  const maxOverrideCooldown = baseOverride + Math.round(freedom * 10);
  return cooldown <= maxOverrideCooldown;
}

function setCooldown(actionName, context, urgency = 0) {
  const base = BOT_TUNING.actionCooldowns[actionName] ?? 12;
  const scale = context.profile?.actionCooldownScale ?? 1;
  const urgentScale = urgency > 0.85 ? 0.55 : 1;
  context.cooldowns[actionName] = Math.max(
    1,
    Math.round(base * scale * urgentScale),
  );
}

function getUrgency(context, prediction) {
  const tick = prediction.intercept?.tick ?? prediction.landingTick ?? 99;
  const height = prediction.intercept?.y ?? context.ball.y;
  const speed = prediction.speed;
  const lowUrgency =
    height <= BOT_TUNING.veryLowBallY
      ? 0.45
      : height <= dynamicLowBallY(speed)
        ? 0.25
        : 0;
  const timeUrgency =
    tick <= 8 ? 0.55 : tick <= 16 ? 0.35 : tick <= 28 ? 0.15 : 0;
  const speedUrgency =
    speed >= BOT_TUNING.veryFastBallSpeed
      ? 0.25
      : speed >= BOT_TUNING.fastBallSpeed
        ? 0.15
        : 0;
  return Math.min(1, lowUrgency + timeUrgency + speedUrgency);
}

function findBestIntercept(trajectory, botSide, netX, player, cfg, speed = 0) {
  if (!player) return null;
  const startX = finiteNumber(player.x, cfg.mapWidth / 2);
  const playerSpeed = cfg.playerSpeed;
  const speedRangeBonus =
    speed >= BOT_TUNING.fastBallSpeed ? BOT_TUNING.fastReceiveRangeBonus : 0;

  for (const point of trajectory) {
    if (point.tick < cfg.reactionDelayTicks) continue;
    if (!isInMyCourt(point.x, botSide, netX)) continue;
    if (
      point.y >
      BOT_TUNING.attackMaxY + (speed >= BOT_TUNING.fastBallSpeed ? 0.08 : 0)
    )
      continue;

    const travelTicks = Math.max(0, point.tick - cfg.reactionDelayTicks);
    const reachableX =
      Math.abs(point.x - startX) <=
      playerSpeed * travelTicks + BOT_TUNING.receiveRangeX + speedRangeBonus;
    if (reachableX) return point;
  }

  return (
    trajectory.find((point) => isInMyCourt(point.x, botSide, netX)) ?? null
  );
}

function getDefensiveHomeX(context, useOpponentAware = false) {
  const {
    playerSide,
    sideMinX,
    sideMaxX,
    profile = AI_PROFILES.rally,
    ball,
    netX,
  } = context;
  const ratio =
    useOpponentAware && ball && !isInMyCourt(ball.x, playerSide, netX)
      ? profile.opponentHomeRatio
      : profile.homeRatio;
  const sideRatio = playerSide === "left" ? 1 - ratio : ratio;
  return clampToCourt(
    sideMinX + (sideMaxX - sideMinX) * sideRatio,
    playerSide,
    context,
  );
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
  const direction = targetX < player.x ? "left" : "right";
  inputs[inputName(playerSide, direction === "left" ? "DOUBLE_LEFT" : "DOUBLE_RIGHT")] =
    true;
  if (context.memory) {
    context.memory.lastDiveDirection = direction;
    context.memory.diveDirectionLockUntil =
      context.memory.tick + BOT_TUNING.diveDirectionLockTicks;
  }
}

function pressTowardOpponent(inputs, context) {
  const { player, ball, playerSide } = context;
  if (Math.abs(ball.x - player.x) > COMMON_SEND_OVER.maxDirectionalAssistRange)
    return;
  const action = playerSide === "left" ? "RIGHT" : "LEFT";
  const opposite = playerSide === "left" ? "LEFT" : "RIGHT";
  inputs[inputName(playerSide, action)] = true;
  inputs[inputName(playerSide, opposite)] = false;
}

export function clampToCourt(x, side, context = {}) {
  const cfg = context.cfg ?? DEFAULTS;
  const netX = finiteNumber(context.netX, cfg.mapWidth / 2);
  const bounds =
    context.sideMinX !== undefined && context.sideMaxX !== undefined
      ? { min: context.sideMinX, max: context.sideMaxX }
      : getCourtBounds(side, netX, cfg);
  const margin = BOT_TUNING.noWallStickMargin;
  return clamp(
    finiteNumber(x, (bounds.min + bounds.max) / 2),
    bounds.min + margin,
    bounds.max - margin,
  );
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
  const opponentNearBall =
    Math.abs(ball.x - opponent.x) < 0.13 &&
    Math.abs(ball.y - (opponent.y + 0.1)) < 0.18;
  const ballNearNet = Math.abs(ball.x - netX) < 0.16;
  const opponentActionThreat =
    opponent.actionType === "SPIKE" ||
    opponent.actionType === "BLOCK" ||
    opponent.actionType === "JUMP";
  return (
    isInMyCourt(ball.x, opponentSide, netX) &&
    ballNearNet &&
    (opponentNearBall || opponentActionThreat)
  );
}

function isInMyCourt(x, playerSide, netX) {
  return playerSide === "left" ? x < netX : x > netX;
}

function ballMovingTowardSide(ball, playerSide) {
  return playerSide === "left"
    ? finiteNumber(ball.vx, 0) < 0
    : finiteNumber(ball.vx, 0) > 0;
}

function getFacingTowardOpponent(playerSide) {
  return playerSide === "left" ? 1 : -1;
}

function isFacingOpponentCourt(player, playerSide) {
  return finiteNumber(player?.facing, getFacingTowardOpponent(playerSide)) ===
    getFacingTowardOpponent(playerSide);
}

function makeEmptyInputs(playerSide) {
  const inputs = {};
  for (const action of [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
    "ACTION",
    "DOUBLE_UP",
    "DOUBLE_DOWN",
    "DOUBLE_LEFT",
    "DOUBLE_RIGHT",
  ]) {
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
  return {
    receive: 0,
    dive: 0,
    jump: 0,
    spike: 0,
    block: 0,
    serveAction: 0,
    serveJump: 0,
    clear: 0,
  };
}

function makeRallyMemory() {
  return {
    tick: 0,
    currentPlan: "IDLE",
    ownCourtTicks: 0,
    consecutiveReceiveCount: 0,
    lastSelectedAction: null,
    lastAction: null,
    lastActionTick: -Infinity,
    lastSpikeTick: -Infinity,
    lastDiveTick: -Infinity,
    lastReceiveTick: -Infinity,
    lastShiftTick: -Infinity,
    lastBallSide: null,
    sendOverUrgency: 0,
    postShiftRecoveryUntil: 0,
    postDiveRecoveryUntil: 0,
    postSpikeRecoveryUntil: 0,
    postReceivePlanUntil: 0,
    receivedBallRecently: false,
    plannedFollowUpAction: null,
    failedShiftCount: 0,
    shiftAttemptOnCurrentBall: false,
    lastDiveDirection: null,
    diveDirectionLockUntil: 0,
    serveState: "SERVE_PREPARE",
    serveTossTick: -Infinity,
    serveHitArmed: false,
  };
}

function resetRallyMemory(memory) {
  memory.tick = 0;
  memory.currentPlan = "IDLE";
  memory.ownCourtTicks = 0;
  memory.consecutiveReceiveCount = 0;
  memory.lastSelectedAction = null;
  memory.lastAction = null;
  memory.lastActionTick = -Infinity;
  memory.lastSpikeTick = -Infinity;
  memory.lastDiveTick = -Infinity;
  memory.lastReceiveTick = -Infinity;
  memory.lastShiftTick = -Infinity;
  memory.lastBallSide = null;
  memory.sendOverUrgency = 0;
  memory.postShiftRecoveryUntil = 0;
  memory.postDiveRecoveryUntil = 0;
  memory.postSpikeRecoveryUntil = 0;
  memory.postReceivePlanUntil = 0;
  memory.receivedBallRecently = false;
  memory.plannedFollowUpAction = null;
  memory.failedShiftCount = 0;
  memory.shiftAttemptOnCurrentBall = false;
  memory.lastDiveDirection = null;
  memory.diveDirectionLockUntil = 0;
  memory.serveState = "SERVE_PREPARE";
  memory.serveTossTick = -Infinity;
  memory.serveHitArmed = false;
}

function updateRallyMemoryBeforeAction(memory, context) {
  const ballSide = isInMyCourt(context.ball.x, context.playerSide, context.netX)
    ? "own"
    : "opponent";
  if (memory.lastBallSide && memory.lastBallSide !== ballSide) {
    memory.consecutiveReceiveCount = 0;
    memory.shiftAttemptOnCurrentBall = false;
    if (ballSide === "opponent") {
      memory.receivedBallRecently = false;
      memory.plannedFollowUpAction = null;
      memory.postReceivePlanUntil = 0;
    }
  }
  memory.lastBallSide = ballSide;
  if (ballSide === "own") {
    memory.ownCourtTicks++;
  } else {
    memory.ownCourtTicks = 0;
    memory.consecutiveReceiveCount = 0;
  }
  if (memory.tick > (memory.postReceivePlanUntil ?? 0)) {
    memory.receivedBallRecently = false;
    memory.plannedFollowUpAction = null;
  }
}

function updateRallyMemoryAfterAction(memory, selectedAction, context) {
  if (selectedAction === "RECEIVE" || selectedAction === "SERVE_RECEIVE") {
    memory.consecutiveReceiveCount++;
    memory.lastReceiveTick = memory.tick;
    memory.receivedBallRecently = true;
    memory.postReceivePlanUntil = memory.tick + BOT_TUNING.postReceivePlanTicks;
    memory.plannedFollowUpAction = isLowStamina(context)
      ? "SAFE_SEND_OVER"
      : "APPROACH_ATTACK";
  } else if (selectedAction && selectedAction !== "SEND_OVER_JUMP" && selectedAction !== "SEND_OVER_APPROACH") {
    memory.consecutiveReceiveCount = 0;
  }
  const usedShift =
    selectedAction?.includes("SPIKE") ||
    selectedAction === "UNDERHAND_SERVE" ||
    selectedAction === "OVERHAND_SERVE" ||
    selectedAction === "JUMP_SERVE_HIT";
  if (usedShift) {
    memory.lastShiftTick = memory.tick;
    memory.postShiftRecoveryUntil =
      memory.tick + BOT_TUNING.postShiftRecoveryTicks;
    memory.shiftAttemptOnCurrentBall = true;
  }
  if (selectedAction?.includes("SPIKE")) {
    memory.lastSpikeTick = memory.tick;
    memory.postSpikeRecoveryUntil = memory.tick + BOT_TUNING.postSpikeRecoveryTicks;
  }
  if (selectedAction === "DIVE") {
    memory.lastDiveTick = memory.tick;
    memory.postDiveRecoveryUntil = memory.tick + BOT_TUNING.postDiveRecoveryTicks;
  }
  if (selectedAction) {
    memory.lastAction = selectedAction;
    memory.lastActionTick = memory.tick;
    if (
      selectedAction === "APPROACH_ATTACK" ||
      selectedAction === "FOLLOW_UP_JUMP_ATTACK" ||
      selectedAction === "SAFE_SEND_OVER"
    ) {
      memory.plannedFollowUpAction = selectedAction;
    }
  }
  memory.lastSelectedAction = selectedAction;
  memory.sendOverUrgency = getSendOverUrgency(context, null, context.profile);
}

function resetCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) cooldowns[key] = 0;
}

function countDownCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) {
    if (cooldowns[key] > 0) cooldowns[key]--;
  }
}

function makePrediction(
  landingX,
  landingTick,
  intercept,
  trajectory,
  willEnterMyCourt,
  speed,
) {
  return {
    landingX,
    landingTick,
    intercept,
    trajectory,
    willEnterMyCourt,
    speed,
  };
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
    ownCourtTicks: 0,
    consecutiveReceiveCount: 0,
    sendOverUrgency: 0,
    currentPlan: "IDLE",
    plannedFollowUpAction: null,
    staminaRatio: null,
    staminaMode: null,
    receiveLoopPressure: null,
    playableWindow: null,
    decisionReason: null,
    cooldowns: makeCooldownState(),
  };
}

function buildDebugInfo(
  profile,
  profileLabel,
  targetInfo,
  prediction,
  selectedAction,
  cooldowns,
  context = null,
) {
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
    ownCourtTicks: context?.memory?.ownCourtTicks ?? 0,
    consecutiveReceiveCount: context?.memory?.consecutiveReceiveCount ?? 0,
    sendOverUrgency: roundDebug(context?.memory?.sendOverUrgency),
    currentPlan: context?.memory?.currentPlan ?? null,
    plannedFollowUpAction: context?.memory?.plannedFollowUpAction ?? null,
    opponentCourtTargetX: context
      ? roundDebug(getOpponentCourtTargetX(context.state, context.playerSide))
      : null,
    staminaRatio: context ? roundDebug(getStaminaRatio(context)) : null,
    staminaMode: context?.staminaMode ?? null,
    receiveLoopPressure: context?.receiveLoopPressure
      ? {
          ...context.receiveLoopPressure,
          score: roundDebug(context.receiveLoopPressure.score),
          urgency: roundDebug(context.receiveLoopPressure.urgency),
        }
      : null,
    playableWindow: context?.playableWindow
      ? roundPlayableWindow(context.playableWindow)
      : null,
    decisionReason: context?.decisionReason ?? null,
    cooldowns: { ...cooldowns },
  };
}

function roundPlayableWindow(window) {
  return {
    ...window,
    dx: roundDebug(window.dx),
    dy: roundDebug(window.dy),
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
