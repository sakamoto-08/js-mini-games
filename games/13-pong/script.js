/**
 * script.js
 * ポン（簡易版）の本体です。
 *
 * 流れ:
 *   1. 左のバーはプレイヤー、右のバーはコンピュータ
 *   2. 上下キーか W / S で、左のバーを動かす
 *   3. 右のバーは、ボールの高さへ少し遅れて動く
 *   4. ボールが左右の端に入ると、入れられた側の相手に 1 点
 *   5. 先に 5 点取った方が勝ち
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * ブロック崩しと同じく、前回からの秒数を速度に掛けてボールを進めます。
 * 左右の得点・勝敗メッセージ・もう一度ボタン・サーブの角度は common.js を使います。
 */

// 盤面の大きさ（ピクセル）です。横長にしています。
const BOARD_WIDTH = 480;
const BOARD_HEIGHT = 270;

// バーの大きさと、プレイヤーが 1 秒あたりに動ける距離です。
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 64;
const PADDLE_MARGIN = 18;
const PADDLE_SPEED = 280;

// コンピュータのバーは、プレイヤーより遅くして勝ちやすくしています。
const AI_SPEED = 150;

// ボールの半径と、1 秒あたりに進む距離です。
const BALL_RADIUS = 6;
const BALL_SPEED = 240;

// 水平から上下にずらす最大の角度（度）です。
const SERVE_SPREAD = 40;

// この点数に先に届いた方が勝ちです。
const WIN_SCORE = 5;

// 点が入ったあと、次のボールを出すまでの待ち時間（ミリ秒）です。
const SERVE_DELAY_MS = 700;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// バーの上端です。左がプレイヤー、右がコンピュータです。
let playerY = 0;
let aiY = 0;

// ボールの中心と、1 秒あたりの速度です。vx がプラスのとき右へ進みます。
let ball = { x: 0, y: 0, vx: 0, vy: 0 };

// 次に出す方向です。-1 が左（プレイヤー側）、1 が右（CPU側）です。
let nextServeDirection = -1;

// 点のあと、この時刻になるまでボールを中央で止めます。
let serveAt = 0;
let waitingToServe = false;

// 上下キーが押されているかです。keyup で false に戻します。
const heldKeys = { up: false, down: false };

let playerScore = 0;
let cpuScore = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。ボールは中央で止まっている
 *   "playing"   対戦中
 *   "finished"  どちらかが 5 点取った
 */
let gameState = "ready";

// 前回ループが呼ばれた時刻。最初の 1 回は 0 にして、大きな移動を防ぎます。
let lastFrameTime = 0;

const playerDisplay = createScoreDisplay(scoreArea, "あなた", 0);
const cpuDisplay = createScoreDisplay(scoreArea, "CPU", 0);

/**
 * 値を min 以上、max 以下に収めます。
 */
function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

/**
 * バーの上端が盤面の外に出ないようにします。
 */
function clampPaddle(y) {
  return clamp(y, 0, BOARD_HEIGHT - PADDLE_HEIGHT);
}

/**
 * 左のバーの位置を長方形で返します。
 */
function leftPaddle() {
  return {
    x: PADDLE_MARGIN,
    y: playerY,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
}

/**
 * 右のバーの位置を長方形で返します。
 */
function rightPaddle() {
  return {
    x: BOARD_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
    y: aiY,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
}

/**
 * 円が長方形に触れているかを返します。
 * 長方形の中で円の中心に一番近い点までの距離が、半径以下なら当たっています。
 */
function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;

  return dx * dx + dy * dy <= radius * radius;
}

/**
 * ボールを盤面の中央に置き、速度を 0 にします。
 */
function placeBallCenter() {
  ball.x = BOARD_WIDTH / 2;
  ball.y = BOARD_HEIGHT / 2;
  ball.vx = 0;
  ball.vy = 0;
}

/**
 * ボールを出します。direction が 1 なら右、 -1 なら左へ飛ばします。
 * 角度は水平から少し上下にずらします。
 */
function serve(direction) {
  const spread = getRandomInt(-SERVE_SPREAD, SERVE_SPREAD);
  const degrees = (direction > 0 ? 0 : 180) + spread;
  const radians = (degrees * Math.PI) / 180;

  ball.vx = Math.cos(radians) * BALL_SPEED;
  ball.vy = Math.sin(radians) * BALL_SPEED;
  waitingToServe = false;
}

/**
 * 押されている上下キーの分だけ、左のバーを動かします。
 */
function movePlayer(dt) {
  if (heldKeys.up) {
    playerY -= PADDLE_SPEED * dt;
  }

  if (heldKeys.down) {
    playerY += PADDLE_SPEED * dt;
  }

  playerY = clampPaddle(playerY);
}

/**
 * バーの中心を、目標の高さへ speed まで近づけます。
 */
function moveToward(currentY, targetY, dt, speed) {
  const center = currentY + PADDLE_HEIGHT / 2;
  const diff = targetY - center;
  const maxMove = speed * dt;

  if (Math.abs(diff) <= maxMove) {
    return clampPaddle(currentY + diff);
  }

  const step = diff > 0 ? maxMove : -maxMove;
  return clampPaddle(currentY + step);
}

/**
 * 右のバーです。ボールが右へ来ているときだけ、その高さを追います。
 * 左へ戻っているあいだは、中央へゆっくり戻します。
 */
function moveAi(dt) {
  if (ball.vx > 0) {
    aiY = moveToward(aiY, ball.y, dt, AI_SPEED);
    return;
  }

  aiY = moveToward(aiY, BOARD_HEIGHT / 2, dt, AI_SPEED * 0.45);
}

/**
 * バーに当たったボールを、反対側へ返します。
 * direction が 1 なら右向き、-1 なら左向きです。
 * バーの端に当てるほど、上下の速度が大きくなります。
 */
function bounceOffPaddle(paddle, direction) {
  const center = paddle.y + paddle.h / 2;
  const hit = clamp((ball.y - center) / (paddle.h / 2), -1, 1);

  ball.vy = hit * BALL_SPEED * 0.85;
  ball.vx = direction * Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vy * ball.vy);

  if (direction > 0) {
    ball.x = paddle.x + paddle.w + BALL_RADIUS + 0.5;
    return;
  }

  ball.x = paddle.x - BALL_RADIUS - 0.5;
}

/**
 * このフレームでボールがバーの前を横切ったかを返します。
 * 1 フレームでバーを飛び越えても、点にしないためです。
 */
function crossedPaddle(previousX, paddle) {
  const left = paddle.x - BALL_RADIUS;
  const right = paddle.x + paddle.w + BALL_RADIUS;
  const minX = Math.min(previousX, ball.x);
  const maxX = Math.max(previousX, ball.x);
  const crossedX = maxX >= left && minX <= right;
  const withinY = ball.y + BALL_RADIUS >= paddle.y && ball.y - BALL_RADIUS <= paddle.y + paddle.h;

  return crossedX && withinY;
}

/**
 * 左右どちらかに 1 点入れます。5 点なら試合を終え、そうでなければ次のボールを待ちます。
 * scoredBy は "player" か "cpu" です。次のボールは、落とした側へ向かいます。
 */
function scorePoint(scoredBy) {
  if (scoredBy === "player") {
    playerScore += 1;
    updateScore(playerDisplay, playerScore);
    nextServeDirection = 1;
  } else {
    cpuScore += 1;
    updateScore(cpuDisplay, cpuScore);
    nextServeDirection = -1;
  }

  if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) {
    finishGame();
    return;
  }

  placeBallCenter();
  waitingToServe = true;
  serveAt = performance.now() + SERVE_DELAY_MS;
}

/**
 * ボールを dt 秒ぶん進め、壁とバーに当たったら跳ね返します。
 */
function moveBall(dt) {
  const previousX = ball.x;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - BALL_RADIUS < 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.y + BALL_RADIUS > BOARD_HEIGHT) {
    ball.y = BOARD_HEIGHT - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy);
  }

  const playerPaddle = leftPaddle();
  const cpuPaddle = rightPaddle();

  if (ball.vx < 0 && (circleHitsRect(ball.x, ball.y, BALL_RADIUS, playerPaddle) || crossedPaddle(previousX, playerPaddle))) {
    bounceOffPaddle(playerPaddle, 1);
  } else if (ball.vx > 0 && (circleHitsRect(ball.x, ball.y, BALL_RADIUS, cpuPaddle) || crossedPaddle(previousX, cpuPaddle))) {
    bounceOffPaddle(cpuPaddle, -1);
  }

  if (gameState !== "playing") {
    return;
  }

  if (ball.x + BALL_RADIUS < 0) {
    scorePoint("cpu");
    return;
  }

  if (ball.x - BALL_RADIUS > BOARD_WIDTH) {
    scorePoint("player");
  }
}

/**
 * 試合を始めます。待っているときだけボールを出します。
 */
function startMatch() {
  if (gameState !== "ready") {
    return;
  }

  gameState = "playing";
  clearMessage(messageElement);
  nextServeDirection = getRandomInt(0, 1) === 0 ? -1 : 1;
  serve(nextServeDirection);
}

/**
 * 5 点に届いたときの勝敗です。
 */
function finishGame() {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  waitingToServe = false;
  ball.vx = 0;
  ball.vy = 0;

  if (playerScore > cpuScore) {
    showMessage(messageElement, "あなたの勝ちです。", "success");
  } else {
    showMessage(messageElement, "コンピュータの勝ちです。", "info");
  }

  restartArea.hidden = false;
}

/**
 * 得点とバーを最初に戻します。
 */
function restartGame() {
  playerScore = 0;
  cpuScore = 0;
  playerY = (BOARD_HEIGHT - PADDLE_HEIGHT) / 2;
  aiY = playerY;
  gameState = "ready";
  waitingToServe = false;
  heldKeys.up = false;
  heldKeys.down = false;

  updateScore(playerDisplay, 0);
  updateScore(cpuDisplay, 0);
  placeBallCenter();
  draw();
  showMessage(messageElement, "スペースかクリックでスタートします。", "info");
  restartArea.hidden = true;
}

/**
 * 背景を消してから、中央線、左右のバー、ボールを描きます。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = "#343b4e";
  const dash = 8;
  const gap = 8;
  const lineX = BOARD_WIDTH / 2 - 1;

  for (let y = 8; y < BOARD_HEIGHT; y += dash + gap) {
    ctx.fillRect(lineX, y, 2, dash);
  }

  const playerPaddle = leftPaddle();
  const cpuPaddle = rightPaddle();
  ctx.fillStyle = "#f3d7a1";
  ctx.fillRect(playerPaddle.x, playerPaddle.y, playerPaddle.w, playerPaddle.h);
  ctx.fillStyle = "#9ec0ea";
  ctx.fillRect(cpuPaddle.x, cpuPaddle.y, cpuPaddle.w, cpuPaddle.h);

  ctx.fillStyle = "#f3f0ea";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function onKeyDown(event) {
  if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
    event.preventDefault();
    heldKeys.up = true;
    return;
  }

  if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
    event.preventDefault();
    heldKeys.down = true;
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    startMatch();
  }
}

function onKeyUp(event) {
  if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
    heldKeys.up = false;
  }

  if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
    heldKeys.down = false;
  }
}

/**
 * 画面の更新ループです。ブロック崩しと同じく、自分を requestAnimationFrame で予約します。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (lastFrameTime === 0) {
    lastFrameTime = now;
    draw();
    return;
  }

  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;
  const dt = deltaMs / 1000;

  if (gameState === "ready" || gameState === "playing") {
    movePlayer(dt);
  }

  if (gameState === "playing") {
    moveAi(dt);

    if (waitingToServe) {
      if (now >= serveAt) {
        serve(nextServeDirection);
      }
    } else {
      moveBall(dt);
    }
  }

  draw();
}

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", function () {
  heldKeys.up = false;
  heldKeys.down = false;
});
canvas.addEventListener("pointerdown", function (event) {
  if (gameState !== "ready") {
    return;
  }

  event.preventDefault();
  startMatch();
});
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
