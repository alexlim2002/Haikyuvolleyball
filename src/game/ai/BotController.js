import { InputType } from "../../engine/InputSystem.js";

const BOT_TYPES = ["attack", "defense", "rally"];

const BOT_LABELS = {
  attack: "공격형",
  defense: "수비형",
  rally: "랠리형",
};

export function createBotController(config) {
  let currentType = chooseRandomType();
  let currentRallyNumber = 0;
  let diveCooldown = 0;
  let jumpCooldown = 0;
  let spikeCooldown = 0;
  let receiveCooldown = 0;

  function beginNewRally(rallyNumber) {
    if (currentRallyNumber === rallyNumber) return;

    currentRallyNumber = rallyNumber;
    currentType = chooseRandomType();
    diveCooldown = 0;
    jumpCooldown = 0;
    spikeCooldown = 0;
    receiveCooldown = 0;
  }

  function makeInputs(state) {
    beginNewRally(state.rallyNumber);
    countDownCooldowns();

    const inputs = makeEmpty2PInputs();
    const player = state.p2;
    const ball = state.ball;
    const targetX = chooseTargetX(currentType, player, ball, config);

    moveToTarget(inputs, player, targetX);
    chooseAction(inputs, currentType, player, ball, config);

    return inputs;
  }

  function getCurrentTypeLabel() {
    return BOT_LABELS[currentType];
  }

  function getCurrentTypeId() {
    return currentType;
  }

  function countDownCooldowns() {
    if (diveCooldown > 0) diveCooldown--;
    if (jumpCooldown > 0) jumpCooldown--;
    if (spikeCooldown > 0) spikeCooldown--;
    if (receiveCooldown > 0) receiveCooldown--;
  }

  function chooseAction(inputs, botType, player, ball, cfg) {
    const ballInMyCourt = ball.x >= cfg.netX;
    const ballNearMyCourt = ball.x >= cfg.netX - 60 && ball.vx > 0;
    const playerCenterY = player.y - cfg.playerHeight / 2;
    const distanceX = Math.abs(ball.x - player.x);
    const distanceY = Math.abs(ball.y - playerCenterY);
    const lowBall = ball.y > cfg.ground - 105;
    const reachableBall = distanceX < 78 && distanceY < 88;
    const fallingBall = ball.vy > 0;

    if (botType === "defense") {
      playDefense(inputs, player, ball, {
        ballInMyCourt,
        distanceX,
        lowBall,
        fallingBall,
      });
      return;
    }

    if (botType === "attack") {
      playAttack(inputs, player, ball, {
        ballInMyCourt,
        ballNearMyCourt,
        distanceX,
        reachableBall,
      });
      return;
    }

    playRally(inputs, player, ball, {
      ballInMyCourt,
      distanceX,
      lowBall,
      fallingBall,
      reachableBall,
    });
  }

  function playAttack(inputs, player, ball, info) {
    if ((info.ballInMyCourt || info.ballNearMyCourt) && info.distanceX < 90) {
      if (player.onGround && ball.y < config.ground - 55 && jumpCooldown === 0) {
        inputs[InputType["2P_UP"]] = true;
        jumpCooldown = 18;
      }

      if (!player.onGround && info.reachableBall && spikeCooldown === 0) {
        inputs[InputType["2P_ACTION"]] = true;
        spikeCooldown = 20;
      }
    }

    if (info.ballInMyCourt && ball.y > config.ground - 85 && info.distanceX < 70) {
      inputs[InputType["2P_DOWN"]] = true;
    }
  }

  function playDefense(inputs, player, ball, info) {
    if (!info.ballInMyCourt) return;

    if (info.lowBall && info.fallingBall) {
      if (info.distanceX > 55 && diveCooldown === 0 && player.onGround) {
        pressDive(inputs, player, ball.x);
        diveCooldown = 45;
        return;
      }

      if (receiveCooldown === 0) {
        inputs[InputType["2P_DOWN"]] = true;
        receiveCooldown = 16;
      }
      return;
    }

    if (info.distanceX < 80 && ball.y < config.ground - 80 && player.onGround) {
      inputs[InputType["2P_UP"]] = true;
    }
  }

  function playRally(inputs, player, ball, info) {
    if (!info.ballInMyCourt) return;

    if (info.lowBall && info.fallingBall && info.distanceX < 90) {
      inputs[InputType["2P_DOWN"]] = true;
      return;
    }

    if (info.reachableBall && player.onGround && jumpCooldown === 0) {
      inputs[InputType["2P_UP"]] = true;
      jumpCooldown = 24;
      return;
    }

    if (!player.onGround && info.reachableBall && spikeCooldown === 0) {
      inputs[InputType["2P_ACTION"]] = true;
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

function chooseTargetX(botType, player, ball, cfg) {
  const predictedX = predictLandingX(ball, cfg);
  const rightCenter = (cfg.minX + cfg.maxX) / 2;
  const ballComingToMe = ball.x >= cfg.netX || ball.vx > 0;

  if (botType === "attack") {
    if (ballComingToMe) return clamp(predictedX, cfg.minX + 35, cfg.maxX - 30);
    return cfg.minX + 95;
  }

  if (botType === "defense") {
    if (ballComingToMe) {
      return clamp((predictedX + rightCenter) / 2, cfg.minX + 45, cfg.maxX - 45);
    }
    return rightCenter + 60;
  }

  if (ballComingToMe) return clamp(predictedX, cfg.minX + 45, cfg.maxX - 45);
  return rightCenter;
}

function moveToTarget(inputs, player, targetX) {
  const margin = 14;

  if (player.x < targetX - margin) {
    inputs[InputType["2P_RIGHT"]] = true;
    return;
  }

  if (player.x > targetX + margin) {
    inputs[InputType["2P_LEFT"]] = true;
  }
}

function pressDive(inputs, player, ballX) {
  if (ballX < player.x) {
    inputs[InputType["2P_DOUBLE_LEFT"]] = true;
  } else {
    inputs[InputType["2P_DOUBLE_RIGHT"]] = true;
  }
}

function predictLandingX(ball, cfg) {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;

  for (let tick = 0; tick < 180; tick++) {
    vy += cfg.ballGravity;
    x += vx;
    y += vy;

    if (x - cfg.ballRadius < 0) {
      x = cfg.ballRadius;
      vx *= -1;
    }

    if (x + cfg.ballRadius > cfg.width) {
      x = cfg.width - cfg.ballRadius;
      vx *= -1;
    }

    if (touchesNet(x, y, vx, cfg)) {
      if (vx > 0) x = cfg.netX - cfg.netWidth / 2 - cfg.ballRadius;
      else x = cfg.netX + cfg.netWidth / 2 + cfg.ballRadius;
      vx *= -0.8;
    }

    if (y + cfg.ballRadius >= cfg.ground) {
      return clamp(x, cfg.minX, cfg.maxX);
    }
  }

  return clamp(x, cfg.minX, cfg.maxX);
}

function touchesNet(x, y, vx, cfg) {
  const netLeft = cfg.netX - cfg.netWidth / 2;
  const netRight = cfg.netX + cfg.netWidth / 2;
  const touchesX = x + cfg.ballRadius > netLeft && x - cfg.ballRadius < netRight;
  const touchesY = y + cfg.ballRadius > cfg.netTop;

  return touchesX && touchesY && vx !== 0;
}

function makeEmpty2PInputs() {
  const inputs = {};
  inputs[InputType["2P_UP"]] = false;
  inputs[InputType["2P_DOWN"]] = false;
  inputs[InputType["2P_LEFT"]] = false;
  inputs[InputType["2P_RIGHT"]] = false;
  inputs[InputType["2P_ACTION"]] = false;
  inputs[InputType["2P_DOUBLE_UP"]] = false;
  inputs[InputType["2P_DOUBLE_DOWN"]] = false;
  inputs[InputType["2P_DOUBLE_LEFT"]] = false;
  inputs[InputType["2P_DOUBLE_RIGHT"]] = false;
  return inputs;
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
