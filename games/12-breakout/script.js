/**
 * script.js
 * ブロック崩し（簡易版）の本体です。
 *
 * 流れ:
 *   1. 上にブロック、下にバー、その上にボールを描く
 *   2. 左右キーかマウスでバーを動かす
 *   3. スペースかクリックでボールを出す
 *   4. ボールが壁・バー・ブロックに当たったら跳ね返す
 *   5. ブロックに当たったら消し、スコアを足す
 *   6. 下に落ちたらゲームオーバー。全部消したらクリア
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * 蛇は一定時間ごとに1マス進みますが、ボールは毎フレーム少しずつ動かします。
 * フレームの間隔は揺れるので、前回からの秒数を速度に掛けて、速さを一定にします。
 * スコア・結果メッセージ・もう一度ボタン・発射のずれは common.js の関数を使います。
 */

// 盤面の大きさ（ピクセル）です。
const BOARD_WIDTH = 300;
const BOARD_HEIGHT = 390;

// バーの大きさと、1秒あたりにキーボードで動く距離です。
const PADDLE_WIDTH = 72;
const PADDLE_HEIGHT = 10;
const PADDLE_BOTTOM = 28;
const PADDLE_SPEED = 320;

// ボールの半径と、1秒あたりに進む距離です。小さくするとゆっくりになります。
const BALL_RADIUS = 6;
const BALL_SPEED = 220;

// 真上から左右にずらす最大の角度（度）です。
const LAUNCH_SPREAD = 25;

// ブロックの並びです。行・列・大きさを変えると、上の並びが変わります。
const BLOCK_ROWS = 5;
const BLOCK_COLS = 7;
const BLOCK_WIDTH = 36;
const BLOCK_HEIGHT = 14;
const BLOCK_GAP = 6;
const BLOCK_TOP = 28;

// 1個壊すともらえる点数です。
const POINTS_PER_BLOCK = 1;

// 上の行から順に塗る色です。行数が多くても、この配列を繰り返します。
const BLOCK_COLORS = ["#e7b15a", "#f0a396", "#9ec0ea", "#8ed0aa", "#d4c4f0"];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// ブロックの残存です。blocks[行][列] が true なら、まだ残っています。
let blocks = [];

// バーの左端です。
let paddleX = 0;

// ボールの中心と、1秒あたりの速度です。vy がマイナスのとき上へ進みます。
let ball = { x: 0, y: 0, vx: 0, vy: 0 };

// キーボードの左右が押されているかです。keyup で false に戻します。
const heldKeys = { left: false, right: false };

let score = 0;
let highScore = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     ボールはバーの上で待っている
 *   "playing"   ボールが動いている
 *   "finished"  ゲームオーバーかクリア
 */
let gameState = "ready";

// 前回ループが呼ばれた時刻。最初の1回は 0 のままにして、大きな移動を防ぎます。
let lastFrameTime = 0;

const scoreDisplay = createScoreDisplay(scoreArea, "スコア", 0);
const highScoreDisplay = createScoreDisplay(scoreArea, "最高記録", 0);

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
 * バーの左端が盤面の外に出ないようにします。
 */
function clampPaddle() {
  paddleX = clamp(paddleX, 0, BOARD_WIDTH - PADDLE_WIDTH);
}

/**
 * バーの位置を長方形で返します。
 */
function paddleRect() {
  return {
    x: paddleX,
    y: BOARD_HEIGHT - PADDLE_BOTTOM - PADDLE_HEIGHT,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
}

/**
 * 行と列から、ブロックの長方形を計算します。
 * 全体の幅を盤面の中央に寄せています。
 */
function blockRect(row, col) {
  const totalWidth = BLOCK_COLS * BLOCK_WIDTH + (BLOCK_COLS - 1) * BLOCK_GAP;
  const offsetX = (BOARD_WIDTH - totalWidth) / 2;

  return {
    x: offsetX + col * (BLOCK_WIDTH + BLOCK_GAP),
    y: BLOCK_TOP + row * (BLOCK_HEIGHT + BLOCK_GAP),
    w: BLOCK_WIDTH,
    h: BLOCK_HEIGHT,
  };
}

/**
 * ブロックを全部ある状態に戻します。2次元配列なので、行と列で残せます。
 */
function createBlocks() {
  blocks = [];

  for (let row = 0; row < BLOCK_ROWS; row += 1) {
    const line = [];

    for (let col = 0; col < BLOCK_COLS; col += 1) {
      line.push(true);
    }

    blocks.push(line);
  }
}

/**
 * 残っているブロックの数を返します。
 */
function countBlocks() {
  let count = 0;

  for (let row = 0; row < blocks.length; row += 1) {
    for (let col = 0; col < blocks[row].length; col += 1) {
      if (blocks[row][col]) {
        count += 1;
      }
    }
  }

  return count;
}

/**
 * 円が長方形に触れているかを返します。
 * 長方形の中で円の中心に一番近い点を探し、その距離が半径以下なら当たっています。
 */
function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;

  return dx * dx + dy * dy <= radius * radius;
}

/**
 * ボールをバーのすぐ上に置きます。発射前はここから動きません。
 */
function stickBallToPaddle() {
  const paddle = paddleRect();
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - BALL_RADIUS - 1;
  ball.vx = 0;
  ball.vy = 0;
}

/**
 * 盤面を一度消してから、ブロック、バー、ボールを描きます。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  for (let row = 0; row < blocks.length; row += 1) {
    for (let col = 0; col < blocks[row].length; col += 1) {
      if (!blocks[row][col]) {
        continue;
      }

      const rect = blockRect(row, col);
      ctx.fillStyle = BLOCK_COLORS[row % BLOCK_COLORS.length];
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  const paddle = paddleRect();
  ctx.fillStyle = "#f3d7a1";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  ctx.fillStyle = "#f3f0ea";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 押されている左右キーの分だけ、バーを動かします。
 * dt は前回からの秒数です。
 */
function movePaddle(dt) {
  if (heldKeys.left) {
    paddleX -= PADDLE_SPEED * dt;
  }

  if (heldKeys.right) {
    paddleX += PADDLE_SPEED * dt;
  }

  clampPaddle();
}

/**
 * 中心が長方形の中に入っているとき、一番近い辺の外側へ押し出します。
 */
function pushOutOfRect(rect) {
  const left = ball.x - rect.x;
  const right = rect.x + rect.w - ball.x;
  const top = ball.y - rect.y;
  const bottom = rect.y + rect.h - ball.y;
  const nearest = Math.min(left, right, top, bottom);

  if (nearest === left) {
    ball.vx = -Math.abs(ball.vx);
    ball.x = rect.x - BALL_RADIUS;
    return;
  }

  if (nearest === right) {
    ball.vx = Math.abs(ball.vx);
    ball.x = rect.x + rect.w + BALL_RADIUS;
    return;
  }

  if (nearest === top) {
    ball.vy = -Math.abs(ball.vy);
    ball.y = rect.y - BALL_RADIUS;
    return;
  }

  ball.vy = Math.abs(ball.vy);
  ball.y = rect.y + rect.h + BALL_RADIUS;
}

/**
 * 当たった長方形の外側へボールを押し出し、近いほうの速度を反転します。
 */
function bounceAwayFrom(rect) {
  const insideX = ball.x > rect.x && ball.x < rect.x + rect.w;
  const insideY = ball.y > rect.y && ball.y < rect.y + rect.h;

  if (insideX && insideY) {
    pushOutOfRect(rect);
    return;
  }

  const nearestX = clamp(ball.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;

  if (dx === 0 && dy === 0) {
    pushOutOfRect(rect);
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    ball.x = dx > 0 ? rect.x + rect.w + BALL_RADIUS : rect.x - BALL_RADIUS;
    return;
  }

  ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
  ball.y = dy > 0 ? rect.y + rect.h + BALL_RADIUS : rect.y - BALL_RADIUS;
}

/**
 * バーに当たったときです。当たった位置で、左右の速度を変えます。
 * 端に当てるほど横に飛び、中央だとほぼ真上に戻ります。
 */
function bounceOffPaddle() {
  const paddle = paddleRect();
  const center = paddle.x + paddle.w / 2;
  const hit = clamp((ball.x - center) / (paddle.w / 2), -1, 1);

  ball.vx = hit * BALL_SPEED * 0.85;
  ball.vy = -Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vx * ball.vx);
  ball.y = paddle.y - BALL_RADIUS - 0.5;
}

/**
 * 残っているブロックを1つだけ調べ、当たったら消します。
 */
function hitBlock() {
  for (let row = 0; row < blocks.length; row += 1) {
    for (let col = 0; col < blocks[row].length; col += 1) {
      if (!blocks[row][col]) {
        continue;
      }

      const rect = blockRect(row, col);

      if (!circleHitsRect(ball.x, ball.y, BALL_RADIUS, rect)) {
        continue;
      }

      blocks[row][col] = false;
      score += POINTS_PER_BLOCK;
      updateScore(scoreDisplay, score);
      bounceAwayFrom(rect);

      if (countBlocks() === 0) {
        finishGame("clear");
      }

      return;
    }
  }
}

/**
 * ボールを dt 秒ぶん進め、壁・バー・ブロックとの当たりを処理します。
 */
function moveBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - BALL_RADIUS < 0) {
    ball.x = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx);
  }

  if (ball.x + BALL_RADIUS > BOARD_WIDTH) {
    ball.x = BOARD_WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx);
  }

  if (ball.y - BALL_RADIUS < 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.vy > 0 && circleHitsRect(ball.x, ball.y, BALL_RADIUS, paddleRect())) {
    bounceOffPaddle();
  }

  hitBlock();

  if (gameState !== "playing") {
    return;
  }

  if (ball.y - BALL_RADIUS > BOARD_HEIGHT) {
    finishGame("over");
  }
}

/**
 * ボールを真上から少しずらして発射します。待っているときだけ動きます。
 */
function launchBall() {
  if (gameState !== "ready") {
    return;
  }

  const offset = getRandomInt(-LAUNCH_SPREAD, LAUNCH_SPREAD);
  const radians = ((-90 + offset) * Math.PI) / 180;

  ball.vx = Math.cos(radians) * BALL_SPEED;
  ball.vy = Math.sin(radians) * BALL_SPEED;
  gameState = "playing";
  clearMessage(messageElement);
}

/**
 * クリアかゲームオーバーにします。
 * result は "clear" か "over" です。得点が最高より大きいときだけ記録します。
 */
function finishGame(result) {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";

  const isRecord = score > highScore;

  if (isRecord) {
    highScore = score;
    updateScore(highScoreDisplay, highScore);
  }

  if (result === "clear" && isRecord) {
    showMessage(messageElement, "全部壊しました。最高記録です！", "success");
  } else if (result === "clear") {
    showMessage(messageElement, "全部壊しました。最高記録は" + highScore + "点です。", "info");
  } else if (isRecord) {
    showMessage(messageElement, score + "点でゲームオーバー。最高記録です！", "success");
  } else if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。ボールが下に落ちました。", "error");
  } else {
    showMessage(
      messageElement,
      score + "点でゲームオーバー。最高記録は" + highScore + "点です。",
      "info"
    );
  }

  restartArea.hidden = false;
}

/**
 * ブロックと得点を最初に戻します。最高記録は残します。
 */
function restartGame() {
  createBlocks();
  paddleX = (BOARD_WIDTH - PADDLE_WIDTH) / 2;
  score = 0;
  gameState = "ready";
  heldKeys.left = false;
  heldKeys.right = false;

  updateScore(scoreDisplay, 0);
  stickBallToPaddle();
  draw();
  showMessage(messageElement, "スペースかクリックでボールを出します。", "info");
  restartArea.hidden = true;
}

/**
 * マウスやタッチの位置を、Canvas の中の横座標に直します。
 * 表示サイズと描画サイズが違っても、同じ割合で変換します。
 */
function pointerToCanvasX(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return (event.clientX - rect.left) * scale;
}

function onPointerMove(event) {
  if (gameState === "finished") {
    return;
  }

  paddleX = pointerToCanvasX(event) - PADDLE_WIDTH / 2;
  clampPaddle();
}

function onPointerDown(event) {
  if (gameState !== "ready") {
    return;
  }

  event.preventDefault();
  paddleX = pointerToCanvasX(event) - PADDLE_WIDTH / 2;
  clampPaddle();
  stickBallToPaddle();
  launchBall();
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    event.preventDefault();
    heldKeys.left = true;
    return;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    event.preventDefault();
    heldKeys.right = true;
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    launchBall();
  }
}

function onKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    heldKeys.left = false;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    heldKeys.right = false;
  }
}

/**
 * 画面の更新ループです。スネークと同じく、自分を requestAnimationFrame で予約します。
 * ボールはマス単位で止めないので、前回からの秒数だけ進めます。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (lastFrameTime === 0) {
    lastFrameTime = now;
    draw();
    return;
  }

  // タブを戻した直後に、ボールが大きく飛ばないよう間隔の上限を設けます。
  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;
  const dt = deltaMs / 1000;

  if (gameState === "ready" || gameState === "playing") {
    movePaddle(dt);
  }

  if (gameState === "playing") {
    moveBall(dt);
  } else if (gameState === "ready") {
    stickBallToPaddle();
  }

  draw();
}

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", function () {
  heldKeys.left = false;
  heldKeys.right = false;
});
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerdown", onPointerDown);
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
