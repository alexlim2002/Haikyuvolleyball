const AI_PROFILE_IDS = ["aggressive", "defensive", "rally"];

const BOT_LABELS = {
  aggressive: "공격형",
  defensive: "수비형",
  rally: "랠리형",
  // Backward-compatible labels for older callers/docs.
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
  playerSpeed: 5 / UNIT,
  moveMargin: 10 / UNIT,
  reactionDelayTicks: 3,
  maxPredictionTicks: 96,
  profile: null,
};

const BOT_TUNING = {
  predictionTicks: 96,
  reactionDelayTicks: 3,
  landingLookaheadTicks: 72,
  interceptLookaheadTicks: 30,
  moveDeadZone: 10 / UNIT,
  wallRestitution: 0.9,
  netRestitution: 0.65,
  lowBallY: 0.145,
  veryLowBallY: 0.095,
  attackMinY: 0.17,
  attackMaxY: 0.38,
  highBallY: 0.22,
  receiveRangeX: 58 / UNIT,
  receiveRangeY: 95 / UNIT,
  diveRangeX: 150 / UNIT,
  diveCommitRangeX: 70 / UNIT,
  spikeRangeX: 74 / UNIT,
  spikeRangeY: 150 / UNIT,
  blockNetRange: 105 / UNIT,
  blockXRange: 78 / UNIT,
  jumpLeadTicks: 14,
  blockLeadTicks: 18,
  diveLeadTicks: 26,
  noWallStickMargin: 18 / UNIT,
  actionCooldowns: {
    receive: 8,
    dive: 34,
    jump: 13,
    spike: 16,
    block: 18,
  },
};

const AI_PROFILES = {
  aggressive: {
    label: BOT_LABELS.aggressive,
    homeRatio: 0.46,
    opponentHomeRatio: 0.40,
    attackBias: 0.34,
    predictionBlend: 0.84,
    receiveMultiplier: 0.94,
    diveMultiplier: 0.88,
    spikeMultiplier: 1.24,
    blockMultiplier: 1.20,
    jumpLeadBonus: 4,
    blockLeadBonus: 5,
    diveLeadBonus: -3,
    netPatrol: 0.092,
    actionCooldownScale: 0.82,
  },
  defensive: {
    label: BOT_LABELS.defensive,
    homeRatio: 0.68,
    opponentHomeRatio: 0.72,
    attackBias: 0.12,
    predictionBlend: 0.94,
    receiveMultiplier: 1.22,
    diveMultiplier: 1.18,
    spikeMultiplier: 0.82,
    blockMultiplier: 0.92,
    jumpLeadBonus: 1,
    blockLeadBonus: -2,
    diveLeadBonus: 5,
    netPatrol: 0.135,
    actionCooldownScale: 0.92,
  },
  rally: {
    label: BOT_LABELS.rally,
    homeRatio: 0.58,
    opponentHomeRatio: 0.58,
    attackBias: 0.20,
    predictionBlend: 0.88,
    receiveMultiplier: 1.08,
    diveMultiplier: 1.00,
    spikeMultiplier: 1.00,
    blockMultiplier: 1.00,
    jumpLeadBonus: 2,
    blockLeadBonus: 0,
    diveLeadBonus: 1,
    netPatrol: 0.115,
    actionCooldownScale: 1.0,
  },
};

/**
 * 최신 GameLoop/InputSystem 흐름에 맞춘 규칙 기반 AI 컨트롤러.
 *
 * AI는 state를 직접 수정하지 않고, 사람 입력과 같은 형태의 입력 스냅샷 조각만 만든다.
 * sample.js는 매 tick마다 실제 키보드 입력 위에 이 값을 덮어써서 GameLoop.tick(state, inputs)에 전달한다.
 */
export function createBotController(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  let currentProfileId = normalizeProfileId(cfg.profile) ?? chooseRandomProfileId();
  let currentRallyKey = "";
  const cooldowns = makeCooldownState();
  let lastDebugInfo = makeInitialDebugInfo(currentProfileId);

  function beginNewRally(rallyKey) {
    if (currentRallyKey === rallyKey) return;

    currentRallyKey = rallyKey;
    currentProfileId = normalizeProfileId(cfg.profile) ?? chooseRandomProfileId();
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
    const prediction = predictBallLanding(state, context.playerSide, context);
    const targetInfo = getTargetX(context, prediction);
    moveToward(inputs, context, targetInfo.targetX);
    const selectedAction = chooseAction(inputs, context, prediction);

    lastDebugInfo = {
      profile: currentProfileId,
      profileLabel: getCurrentTypeLabel(),
      targetX: roundDebug(targetInfo.targetX),
      targetMode: targetInfo.mode,
      predictedLandingX: roundDebug(prediction.landingX),
      predictedLandingTick: prediction.landingTick,
      interceptX: roundDebug(prediction.intercept?.x),
      interceptY: roundDebug(prediction.intercept?.y),
      interceptTick: prediction.intercept?.tick ?? null,
      selectedAction,
      cooldowns: { ...cooldowns },
    };

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
    return makePrediction(fallbackX, null, null, [], false);
  }

  const trajectory = simulateBallTrajectory(ball, {
    ...cfg,
    netX,
    ticks: cfg.maxPredictionTicks ?? BOT_TUNING.predictionTicks,
  });

  let landing = trajectory.find(p => p.y - cfg.ballRadius <= 0) ?? trajectory[trajectory.length - 1] ?? { x: ball.x, y: ball.y, tick: 0 };
  const myCourtLanding = trajectory.find(p => isInMyCourt(p.x, botSide, netX) && p.y < BOT_TUNING.lowBallY && p.vy < 0);
  const intercept = findBestIntercept(trajectory, botSide, netX, options.player, cfg);
  const landingX = clampToCourt((myCourtLanding ?? landing).x, botSide, { netX, cfg, sideMinX: bounds.min, sideMaxX: bounds.max });

  return makePrediction(landingX, (myCourtLanding ?? landing).tick, intercept, trajectory, !!myCourtLanding);
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

    points.push({ tick, x, y, vx, vy });
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
    const targetX = predicted * profile.predictionBlend + homeX * (1 - profile.predictionBlend);
    return { targetX: clampToCourt(targetX, playerSide, context), mode: "intercept" };
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

function shouldReceive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround || !isInMyCourt(ball.x, playerSide, netX)) return false;
  const intercept = prediction.intercept;
  const target = intercept ?? { x: ball.x, y: ball.y, tick: 0, vy: ball.vy };
  const dx = Math.abs(target.x - player.x);
  const dy = Math.abs(target.y - (player.y + 0.035));
  const receiveRangeX = BOT_TUNING.receiveRangeX * profile.receiveMultiplier;
  const receiveRangeY = BOT_TUNING.receiveRangeY * profile.receiveMultiplier;
  const imminent = target.tick <= 16 && target.y <= BOT_TUNING.lowBallY * profile.receiveMultiplier;
  const currentLowClose = ball.y <= BOT_TUNING.lowBallY * profile.receiveMultiplier && Math.abs(ball.x - player.x) <= receiveRangeX;
  return (imminent && dx <= receiveRangeX && dy <= receiveRangeY && target.vy <= 0) || currentLowClose;
}

function shouldDive(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround || !isInMyCourt(prediction.landingX, playerSide, netX)) return false;
  const target = prediction.intercept ?? { x: prediction.landingX, y: ball.y, tick: prediction.landingTick ?? 99, vy: ball.vy };
  const dx = Math.abs(target.x - player.x);
  const tooFarForReceive = dx > BOT_TUNING.receiveRangeX * profile.receiveMultiplier;
  const reachableByDive = dx <= BOT_TUNING.diveRangeX * profile.diveMultiplier;
  const soonLow = target.tick <= BOT_TUNING.diveLeadTicks + profile.diveLeadBonus && target.y <= BOT_TUNING.lowBallY * 1.2;
  const currentEmergency = ball.y <= BOT_TUNING.veryLowBallY && Math.abs(ball.x - player.x) <= BOT_TUNING.diveCommitRangeX * profile.diveMultiplier;
  return (tooFarForReceive && reachableByDive && soonLow && target.vy <= 0) || currentEmergency;
}

function shouldBlock(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const nearNet = Math.abs(ball.x - netX) <= BOT_TUNING.blockNetRange * profile.blockMultiplier;
  const blockX = getBlockX(context);
  const aligned = Math.abs(player.x - blockX) <= BOT_TUNING.blockXRange * profile.blockMultiplier;
  const highEnough = ball.y >= BOT_TUNING.highBallY * 0.92;
  const threat = ballMovingTowardSide(ball, playerSide) || isOpponentLikelyAttacking(context) || prediction.willEnterMyCourt;
  const timing = prediction.intercept?.tick == null || prediction.intercept.tick <= BOT_TUNING.blockLeadTicks + profile.blockLeadBonus;
  return nearNet && aligned && highEnough && threat && timing;
}

function shouldSpike(context, _prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  const inMyCourt = isInMyCourt(ball.x, playerSide, netX);
  const inFront = (ball.x - player.x) * getFacingTowardOpponent(playerSide) > 0;
  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - (player.y + 0.10));
  const heightOk = ball.y >= BOT_TUNING.attackMinY && ball.y <= BOT_TUNING.attackMaxY;
  const rangeOk = dx <= BOT_TUNING.spikeRangeX * profile.spikeMultiplier && dy <= BOT_TUNING.spikeRangeY * profile.spikeMultiplier;
  const attackableCourt = inMyCourt || Math.abs(ball.x - netX) <= 0.12;
  return inFront && heightOk && rangeOk && attackableCourt;
}

function shouldJump(context, prediction) {
  const { player, ball, playerSide, netX, profile } = context;
  if (!player.onGround) return false;
  const intercept = prediction.intercept;
  const closeX = Math.abs((intercept?.x ?? ball.x) - player.x) < BOT_TUNING.spikeRangeX * 1.15;
  const leadTicks = BOT_TUNING.jumpLeadTicks + profile.jumpLeadBonus;
  const highEnough = (intercept?.y ?? ball.y) > BOT_TUNING.attackMinY;
  const coming = isInMyCourt(ball.x, playerSide, netX) || prediction.willEnterMyCourt || ballMovingTowardSide(ball, playerSide);
  return coming && closeX && highEnough && (intercept?.tick ?? 0) <= leadTicks;
}

function canUseAction(actionName, context, urgency = 0) {
  const cooldown = context.cooldowns?.[actionName] ?? 0;
  if (cooldown <= 0) return true;
  if (urgency < 0.85) return false;

  // Critical moments may override short residual cooldowns. This avoids the bot
  // watching an easy ball drop while a previous input cooldown has 1~3 ticks left.
  const maxOverrideCooldown = actionName === "dive" ? 5 : 3;
  return cooldown <= maxOverrideCooldown;
}

function setCooldown(actionName, context, urgency = 0) {
  const base = BOT_TUNING.actionCooldowns[actionName] ?? 12;
  const scale = context.profile.actionCooldownScale ?? 1;
  const urgentScale = urgency > 0.85 ? 0.55 : 1;
  context.cooldowns[actionName] = Math.max(1, Math.round(base * scale * urgentScale));
}

function getUrgency(context, prediction) {
  const tick = prediction.intercept?.tick ?? prediction.landingTick ?? 99;
  const height = prediction.intercept?.y ?? context.ball.y;
  const lowUrgency = height <= BOT_TUNING.veryLowBallY ? 0.45 : height <= BOT_TUNING.lowBallY ? 0.25 : 0;
  const timeUrgency = tick <= 8 ? 0.55 : tick <= 16 ? 0.35 : tick <= 28 ? 0.15 : 0;
  return Math.min(1, lowUrgency + timeUrgency);
}

function findBestIntercept(trajectory, botSide, netX, player, cfg) {
  if (!player) return null;
  const startX = finiteNumber(player.x, cfg.mapWidth / 2);
  const speed = cfg.playerSpeed;

  for (const point of trajectory) {
    if (point.tick < cfg.reactionDelayTicks) continue;
    if (!isInMyCourt(point.x, botSide, netX)) continue;
    if (point.y > BOT_TUNING.attackMaxY) continue;

    const travelTicks = Math.max(0, point.tick - cfg.reactionDelayTicks);
    const reachableX = Math.abs(point.x - startX) <= speed * travelTicks + BOT_TUNING.receiveRangeX;
    if (reachableX) return point;
  }

  return trajectory.find(point => isInMyCourt(point.x, botSide, netX)) ?? null;
}

function getDefensiveHomeX(context, useOpponentAware = false) {
  const { playerSide, sideMinX, sideMaxX, profile, ball, netX } = context;
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
  return `${state?.phase ?? "rally"}:${sets.p1}-${sets.p2}:${score.p1}-${score.p2}`;
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
  return { receive: 0, dive: 0, jump: 0, spike: 0, block: 0 };
}

function resetCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) cooldowns[key] = 0;
}

function countDownCooldowns(cooldowns) {
  for (const key of Object.keys(cooldowns)) {
    if (cooldowns[key] > 0) cooldowns[key]--;
  }
}

function makePrediction(landingX, landingTick, intercept, trajectory, willEnterMyCourt) {
  return {
    landingX,
    landingTick,
    intercept,
    trajectory,
    willEnterMyCourt,
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
    cooldowns: makeCooldownState(),
  };
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
