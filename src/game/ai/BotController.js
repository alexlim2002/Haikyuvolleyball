const BOT_TYPES = ["attack", "defense", "rally"];

const BOT_LABELS = {
  attack: "공격형",
  defense: "수비형",
  rally: "랠리형",
};

const DEFAULTS = {
  playerId: "player2",
  playerSide: "right",
  opponentId: "player1",
  mapWidth: 1,
  ballGravity: 0.05 / 800,
  ballRadius: 18 / 800,
  playerWidth: 80 / 800,
  netWidth: 10 / 800,
  moveMargin: 14 / 800,
  maxPredictionTicks: 180,
};

/**
 * 최신 GameLoop/InputSystem 흐름에 맞춘 규칙 기반 AI 컨트롤러.
 *
 * AI는 state를 직접 수정하지 않고, 사람 입력과 같은 형태의 입력 스냅샷 조각만 만든다.
 * sample.js는 매 tick마다 실제 키보드 입력 위에 이 값을 덮어써서 GameLoop.tick(state, inputs)에 전달한다.
 */
export function createBotController(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  let currentType = chooseRandomType();
  let currentRallyKey = "";
  let diveCooldown = 0;
  let jumpCooldown = 0;
  let spikeCooldown = 0;
  let receiveCooldown = 0;
  let blockCooldown = 0;

  function beginNewRally(rallyKey) {
    if (currentRallyKey === rallyKey) return;

    currentRallyKey = rallyKey;
    currentType = chooseRandomType();
    diveCooldown = 0;
    jumpCooldown = 0;
    spikeCooldown = 0;
    receiveCooldown = 0;
    blockCooldown = 0;
  }

  function makeInputs(state) {
    beginNewRally(makeRallyKey(state));
    countDownCooldowns();

    const inputs = makeEmptyInputs(cfg.playerSide);
    const context = readContext(state, cfg);
    if (!context) return inputs;

    const targetX = chooseTargetX(currentType, context);
    moveToTarget(inputs, context, targetX);
    chooseAction(inputs, currentType, context);

    return inputs;
  }

  function getCurrentTypeLabel() {
    return BOT_LABELS[currentType] ?? currentType;
  }

  function getCurrentTypeId() {
    return currentType;
  }

  function countDownCooldowns() {
    if (diveCooldown > 0) diveCooldown--;
    if (jumpCooldown > 0) jumpCooldown--;
    if (spikeCooldown > 0) spikeCooldown--;
    if (receiveCooldown > 0) receiveCooldown--;
    if (blockCooldown > 0) blockCooldown--;
  }

  function chooseAction(inputs, botType, context) {
    const { player, ball, playerSide, netX } = context;
    const inMyCourt = isInMyCourt(ball.x, playerSide, netX);
    const comingToMe = ballMovingTowardSide(ball, playerSide) || inMyCourt;
    const nearNet = Math.abs(ball.x - netX) < 0.11;
    const distanceX = Math.abs(ball.x - player.x);
    const distanceY = Math.abs(ball.y - (player.y + 0.08));
    const closeHorizontally = distanceX < 0.09;
    const reachable = distanceX < 0.105 && distanceY < 0.16;
    const lowBall = ball.y < 0.14;
    const highBall = ball.y > 0.22;
    const fallingBall = ball.vy < 0;

    if (comingToMe && nearNet && highBall && blockCooldown === 0) {
      inputs[inputName(playerSide, "DOUBLE_UP")] = true;
      blockCooldown = 26;
      return;
    }

    if (botType === "attack") {
      playAttack(inputs, context, { inMyCourt, comingToMe, nearNet, closeHorizontally, reachable, lowBall, highBall, fallingBall });
      return;
    }

    if (botType === "defense") {
      playDefense(inputs, context, { inMyCourt, comingToMe, closeHorizontally, lowBall, fallingBall });
      return;
    }

    playRally(inputs, context, { inMyCourt, comingToMe, closeHorizontally, reachable, lowBall, highBall, fallingBall });
  }

  function playAttack(inputs, context, info) {
    const { player, ball, playerSide } = context;

    if ((info.inMyCourt || info.comingToMe) && info.closeHorizontally && info.highBall && player.onGround && jumpCooldown === 0) {
      inputs[inputName(playerSide, "UP")] = true;
      jumpCooldown = 18;
      return;
    }

    if (!player.onGround && info.reachable && spikeCooldown === 0) {
      inputs[inputName(playerSide, "ACTION")] = true;
      spikeCooldown = 22;
      return;
    }

    if (info.inMyCourt && info.lowBall && info.fallingBall && Math.abs(ball.x - player.x) < 0.08 && receiveCooldown === 0) {
      inputs[inputName(playerSide, "DOWN")] = true;
      receiveCooldown = 14;
    }
  }

  function playDefense(inputs, context, info) {
    const { player, ball, playerSide } = context;
    if (!info.inMyCourt && !info.comingToMe) return;

    if (info.lowBall && info.fallingBall) {
      if (!info.closeHorizontally && Math.abs(ball.x - player.x) < 0.18 && diveCooldown === 0 && player.onGround) {
        pressDive(inputs, context, ball.x);
        diveCooldown = 48;
        return;
      }

      if (receiveCooldown === 0) {
        inputs[inputName(playerSide, "DOWN")] = true;
        receiveCooldown = 16;
      }
      return;
    }

    if (info.closeHorizontally && ball.y > 0.18 && player.onGround && jumpCooldown === 0) {
      inputs[inputName(playerSide, "UP")] = true;
      jumpCooldown = 24;
    }
  }

  function playRally(inputs, context, info) {
    const { player, playerSide } = context;
    if (!info.inMyCourt && !info.comingToMe) return;

    if (info.lowBall && info.fallingBall && info.closeHorizontally && receiveCooldown === 0) {
      inputs[inputName(playerSide, "DOWN")] = true;
      receiveCooldown = 15;
      return;
    }

    if (info.reachable && info.highBall && player.onGround && jumpCooldown === 0) {
      inputs[inputName(playerSide, "UP")] = true;
      jumpCooldown = 24;
      return;
    }

    if (!player.onGround && info.reachable && spikeCooldown === 0) {
      inputs[inputName(playerSide, "ACTION")] = true;
      spikeCooldown = 34;
    }
  }

  return {
    beginNewRally,
    makeInputs,
    getCurrentTypeLabel,
    getCurrentTypeId,
  };
}

function readContext(state, cfg) {
  const playerId = cfg.playerId;
  const opponentId = cfg.opponentId;
  const player = state[playerId] ?? state.p2;
  const opponent = state[opponentId] ?? state.p1;
  const ball = state.ball;
  if (!player || !ball) return null;

  const netX = state.net?.x ?? cfg.netX ?? cfg.mapWidth / 2;
  const playerSide = cfg.playerSide ?? (player.x < netX ? "left" : "right");
  const sideMinX = playerSide === "left" ? cfg.playerWidth / 2 : netX + cfg.netWidth / 2 + cfg.playerWidth / 2;
  const sideMaxX = playerSide === "left" ? netX - cfg.netWidth / 2 - cfg.playerWidth / 2 : cfg.mapWidth - cfg.playerWidth / 2;
  const homeX = playerSide === "left"
    ? sideMinX + (sideMaxX - sideMinX) * 0.42
    : sideMinX + (sideMaxX - sideMinX) * 0.58;
  const attackX = playerSide === "left" ? netX - 0.095 : netX + 0.095;
  const defenseX = playerSide === "left" ? sideMinX + (sideMaxX - sideMinX) * 0.35 : sideMinX + (sideMaxX - sideMinX) * 0.65;

  return {
    state,
    player,
    opponent,
    ball,
    playerSide,
    netX,
    sideMinX,
    sideMaxX,
    homeX,
    attackX,
    defenseX,
    cfg,
  };
}

function chooseTargetX(botType, context) {
  const { ball, playerSide, netX, sideMinX, sideMaxX, homeX, attackX, defenseX } = context;
  const predictedX = predictLandingX(context);
  const comingToMe = isInMyCourt(ball.x, playerSide, netX) || ballMovingTowardSide(ball, playerSide);

  if (!comingToMe) {
    if (botType === "attack") return clamp(attackX, sideMinX, sideMaxX);
    if (botType === "defense") return clamp(defenseX, sideMinX, sideMaxX);
    return clamp(homeX, sideMinX, sideMaxX);
  }

  if (botType === "defense") {
    return clamp((predictedX + defenseX) / 2, sideMinX, sideMaxX);
  }

  if (botType === "attack" && Math.abs(ball.x - netX) < 0.18 && ball.y > 0.18) {
    return clamp(attackX, sideMinX, sideMaxX);
  }

  return clamp(predictedX, sideMinX, sideMaxX);
}

function moveToTarget(inputs, context, targetX) {
  const { player, playerSide, cfg } = context;
  const margin = cfg.moveMargin;

  if (player.x < targetX - margin) {
    inputs[inputName(playerSide, "RIGHT")] = true;
    return;
  }

  if (player.x > targetX + margin) {
    inputs[inputName(playerSide, "LEFT")] = true;
  }
}

function pressDive(inputs, context, ballX) {
  const { player, playerSide } = context;
  inputs[inputName(playerSide, ballX < player.x ? "DOUBLE_LEFT" : "DOUBLE_RIGHT")] = true;
}

function predictLandingX(context) {
  const { ball, playerSide, sideMinX, sideMaxX, netX, cfg } = context;
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;

  for (let tick = 0; tick < cfg.maxPredictionTicks; tick++) {
    vy -= cfg.ballGravity;
    x += vx;
    y += vy;

    if (x - cfg.ballRadius < 0) {
      x = cfg.ballRadius;
      vx *= -0.9;
    }

    if (x + cfg.ballRadius > cfg.mapWidth) {
      x = cfg.mapWidth - cfg.ballRadius;
      vx *= -0.9;
    }

    const netLeft = netX - cfg.netWidth / 2;
    const netRight = netX + cfg.netWidth / 2;
    const netTop = 150 / 800;
    if (x + cfg.ballRadius > netLeft && x - cfg.ballRadius < netRight && y - cfg.ballRadius < netTop) {
      x = vx > 0 ? netLeft - cfg.ballRadius : netRight + cfg.ballRadius;
      vx *= -0.65;
    }

    if (y - cfg.ballRadius <= 0) {
      return clamp(x, sideMinX, sideMaxX);
    }

    if (isInMyCourt(x, playerSide, netX) && y < 0.2 && vy < 0) {
      return clamp(x, sideMinX, sideMaxX);
    }
  }

  return clamp(x, sideMinX, sideMaxX);
}

function isInMyCourt(x, playerSide, netX) {
  return playerSide === "left" ? x < netX : x > netX;
}

function ballMovingTowardSide(ball, playerSide) {
  return playerSide === "left" ? ball.vx < 0 : ball.vx > 0;
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
  const score = state.score ?? { p1: 0, p2: 0 };
  const sets = state.sets ?? { p1: 0, p2: 0 };
  return `${state.phase ?? "rally"}:${sets.p1}-${sets.p2}:${score.p1}-${score.p2}`;
}

function chooseRandomType() {
  const index = Math.floor(Math.random() * BOT_TYPES.length);
  return BOT_TYPES[index];
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
