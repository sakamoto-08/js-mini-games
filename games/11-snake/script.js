/**
 * script.js
 * スネーク（簡易版）の本体です。
 *
 * 流れ:
 *   1. マス目の上に、蛇と餌を描く
 *   2. 矢印キーか WASD で進行方向を変える
 *   3. 一定時間ごとに頭を1マス進め、尻尾を1マス短くする
 *   4. 餌のマスに入ったら、尻尾を消さずにスコアを足す
 *   5. 壁か自分の体に入る動きをしたらゲームオーバー
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * createTimer は 1 秒ごとにしか進まないので、蛇の移動には使いません。
 * 移動の間隔は performance.now() と同じ時刻で数えます。
 * スコア・結果メッセージ・もう一度ボタンは common.js の関数を使います。
 * 最高記録は localStorage に残すので、ページを閉じても消えません。
 */

// 横のマス数と縦のマス数です。ここを変えると盤面の広さが変わります。
const COLS = 16;
const ROWS = 16;

// 1マスの大きさ（ピクセル）です。
const CELL = 18;

// 蛇が1マス進む間隔（ミリ秒）です。小さくすると速くなります。
const MOVE_EVERY_MS = 150;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// 絵のサイズを、マス数 × 1マスの大きさに合わせます。
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// 蛇の体です。先頭（0番）が頭です。各要素は { x, y } です。
let snake = [];

// いま実際に進んでいる方向。x は 1 が右、-1 が左。y は 1 が下、-1 が上。
let direction = { x: 0, y: 0 };

// 次の移動で使う方向。キーを押した瞬間に入り、移動のタイミングで direction に写します。
let queuedDirection = { x: 0, y: 0 };

// 餌の位置。空きマスが無いときは null です。
let food = null;

// いまの得点。餌を1つ食べるたびに 1 増えます。
let score = 0;

// このゲームだけの保存名です。他のゲームの記録と混ざらないようにします。
const HIGH_SCORE_KEY = "js-mini-games-snake-highscore";

// ブラウザに残っている最高記録です。まだ無いときは 0 です。
let highScore = getHighScore(HIGH_SCORE_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     キー待ち。蛇は止まっている
 *   "playing"   移動中
 *   "finished"  ゲームオーバー
 */
let gameState = "ready";

// 前回蛇を動かした時刻。requestAnimationFrame が渡すミリ秒です。
let lastMoveTime = 0;

const scoreDisplay = createScoreDisplay(scoreArea, "スコア", 0);
const highScoreDisplay = createScoreDisplay(scoreArea, "最高記録", highScore);

/**
 * マスの位置が、parts のどれかと重なるかを返します。
 */
function occupies(x, y, parts) {
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].x === x && parts[i].y === y) {
      return true;
    }
  }

  return false;
}

/**
 * 蛇がいないマスから、餌の位置を1つ選びます。
 * 空きが無いときは food を null にします。
 */
function spawnFood() {
  const empty = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!occupies(x, y, snake)) {
        empty.push({ x: x, y: y });
      }
    }
  }

  if (empty.length === 0) {
    food = null;
    return;
  }

  const index = getRandomInt(0, empty.length - 1);
  food = empty[index];
}

/**
 * 1マスを塗りつぶします。すき間を空けるので、マスの境目が見えます。
 */
function fillCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
}

/**
 * 盤面全体を描き直します。毎フレーム足していくのではなく、一度消してから描きます。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (food) {
    fillCell(food.x, food.y, "#8ed0aa");
  }

  for (let i = 0; i < snake.length; i += 1) {
    const color = i === 0 ? "#f3d7a1" : "#e7b15a";
    fillCell(snake[i].x, snake[i].y, color);
  }
}

/**
 * 進行方向を予約します。真後ろには戻れません。
 * 止まっているときに押すと、その方向へ動き始めます。
 */
function setDirection(x, y) {
  if (gameState === "finished") {
    return;
  }

  const moving = direction.x !== 0 || direction.y !== 0;
  const isReverse = moving && direction.x + x === 0 && direction.y + y === 0;

  if (isReverse) {
    return;
  }

  queuedDirection = { x: x, y: y };

  if (gameState === "ready") {
    direction = { x: x, y: y };
    gameState = "playing";
    lastMoveTime = performance.now();
    clearMessage(messageElement);
  }
}

/**
 * 蛇を1マス進めます。壁か自分の体に入るなら、そこでゲームオーバーにします。
 */
function step() {
  direction = { x: queuedDirection.x, y: queuedDirection.y };

  const head = snake[0];
  const next = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
    finishGame();
    return;
  }

  const willEat = food !== null && next.x === food.x && next.y === food.y;

  // 食べないときは尻尾がどくので、尻尾のマスに入っても衝突にしません。
  const body = willEat ? snake : snake.slice(0, snake.length - 1);

  if (occupies(next.x, next.y, body)) {
    finishGame();
    return;
  }

  snake.unshift(next);

  if (!willEat) {
    snake.pop();
    return;
  }

  score += 1;
  updateScore(scoreDisplay, score);
  spawnFood();

  if (food === null) {
    finishGame();
  }
}

/**
 * ゲームオーバーにします。
 * 得点が最高より大きいときだけ、localStorage に保存します。
 */
function finishGame() {
  gameState = "finished";
  draw();

  const isRecord = score > highScore;

  if (isRecord) {
    highScore = updateHighScore(HIGH_SCORE_KEY, score);
    updateScore(highScoreDisplay, highScore);
    showMessage(messageElement, score + "点でゲームオーバー。最高記録です！", "success");
  } else if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。壁か自分の体に当たりました。", "error");
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
 * 蛇・餌・得点を最初に戻します。最高記録は残します。
 */
function restartGame() {
  // 頭が右端です。最初から右を向いているので、左は真後ろとして無視します。
  snake = [
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ];
  direction = { x: 1, y: 0 };
  queuedDirection = { x: 1, y: 0 };
  score = 0;
  gameState = "ready";

  updateScore(scoreDisplay, 0);
  spawnFood();
  draw();
  showMessage(messageElement, "矢印キーか WASD でスタートします。", "info");
  restartArea.hidden = true;
}

/**
 * 押されたキーを、上下左右の方向に変えます。関係ないキーは無視します。
 */
function directionFromKey(key) {
  if (key === "ArrowUp" || key === "w" || key === "W") {
    return { x: 0, y: -1 };
  }

  if (key === "ArrowDown" || key === "s" || key === "S") {
    return { x: 0, y: 1 };
  }

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return { x: -1, y: 0 };
  }

  if (key === "ArrowRight" || key === "d" || key === "D") {
    return { x: 1, y: 0 };
  }

  return null;
}

function onKeyDown(event) {
  const next = directionFromKey(event.key);

  if (next === null) {
    return;
  }

  // 矢印キーでページがスクロールしないようにします。
  event.preventDefault();
  setDirection(next.x, next.y);
}

/**
 * 画面の更新ループです。ブラウザが表示できるタイミングで、何度も呼ばれます。
 * 呼ばれる間隔は一定ではないので、前回から MOVE_EVERY_MS 以上たっているときだけ蛇を動かします。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (gameState !== "playing") {
    return;
  }

  if (now - lastMoveTime < MOVE_EVERY_MS) {
    return;
  }

  lastMoveTime = now;
  step();

  if (gameState === "playing") {
    draw();
  }
}

document.addEventListener("keydown", onKeyDown);
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
