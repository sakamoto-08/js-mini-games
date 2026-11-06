/**
 * script.js
 * 迷路の本体です。
 *
 * 流れ:
 *   1. 盤面を、全部壁の2次元配列で作る
 *   2. 穴掘り法で通路を掘り、スタートからゴールまでつなぐ
 *   3. 矢印キーか WASD で、通路の上だけを1マス進む
 *   4. ゴールに着いたらクリア。手数を数える
 *   5. 「もう一度」で、新しい迷路を掘り直す
 *
 * 描画は Canvas です。迷路は自動で落ちたりしないので、
 * requestAnimationFrame は使わず、キーを押したときだけ描き直します。
 * スコア・結果メッセージ・もう一度ボタン・乱数・記録は common.js を使います。
 * 最短手数とクリア回数は localStorage に残すので、ページを閉じても消えません。
 */

// 一辺のマス数です。奇数にしてください。外周を壁、内側の奇数マスを通路にします。
const SIZE = 15;

// 1マスの大きさ（ピクセル）です。
const CELL = 18;

// スタートは左上の通路、ゴールは右下の通路です。どちらも奇数の位置です。
const start = { x: 1, y: 1 };
const goal = { x: SIZE - 2, y: SIZE - 2 };

// 最短手数です。少ないほど良いので、updateHighScore は使いません。
// まだ記録が無いときは getHighScore が 0 を返します。
const BEST_KEY = "js-mini-games-maze-best";

// クリア回数です。増えるほど大きい数なので、updateHighScore で保存できます。
const CLEAR_KEY = "js-mini-games-maze-clears";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = SIZE * CELL;
canvas.height = SIZE * CELL;

// 盤面です。board[行][列] は "wall" か "path" です。
let board = [];

// プレイヤーの位置です。通路のマスだけに進みます。
let player = { x: start.x, y: start.y };

// いまの迷路で進んだ手数です。「もう一度」で 0 に戻します。
let steps = 0;

// ブラウザに残っている最短手数です。0 は「まだクリアしていない」です。
let bestSteps = getHighScore(BEST_KEY);

// ブラウザに残っているクリア回数です。
let clears = getHighScore(CLEAR_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     最初の一手の前。説明を出している
 *   "playing"   移動中
 *   "finished"  ゴールした
 */
let gameState = "ready";

const stepDisplay = createScoreDisplay(scoreArea, "手数", 0);
const bestDisplay = createScoreDisplay(scoreArea, "最短", bestSteps === 0 ? "—" : bestSteps);
const clearDisplay = createScoreDisplay(scoreArea, "クリア", clears);

/**
 * 全部が壁の盤面を作ります。
 */
function createWalls() {
  const next = [];

  for (let y = 0; y < SIZE; y += 1) {
    const row = [];

    for (let x = 0; x < SIZE; x += 1) {
      row.push("wall");
    }

    next.push(row);
  }

  return next;
}

/**
 * 配列の並びをランダムに入れ替えます。掘る方向の順番に使います。
 */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(0, i);
    const saved = list[i];
    list[i] = list[j];
    list[j] = saved;
  }

  return list;
}

/**
 * 穴掘り法です。今のマスを通路にして、まだ壁のマスへ2マス先まで掘ります。
 * 途中の1マスも通路にするので、壁が1枚だけ残って道がつながります。
 * 進める先が無くなったら関数が終わり、呼び出し元（1つ前の分かれ道）に戻ります。
 * この「進んで、ダメなら戻る」は再帰です。関数が自分をもう一度呼んでいます。
 * スタートから届く奇数マスはすべて掘るので、ゴールまで必ず道があります。
 */
function carve(x, y) {
  board[y][x] = "path";

  const directions = shuffle([
    { x: 0, y: -2 },
    { x: 0, y: 2 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
  ]);

  for (let i = 0; i < directions.length; i += 1) {
    const nextX = x + directions[i].x;
    const nextY = y + directions[i].y;

    if (nextX <= 0 || nextX >= SIZE - 1 || nextY <= 0 || nextY >= SIZE - 1) {
      continue;
    }

    if (board[nextY][nextX] !== "wall") {
      continue;
    }

    const wallX = x + directions[i].x / 2;
    const wallY = y + directions[i].y / 2;
    board[wallY][wallX] = "path";
    carve(nextX, nextY);
  }
}

/**
 * 1マスの中に、プレイヤーかゴールの印を描きます。
 */
function fillToken(x, y, color) {
  const pad = 4;
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
}

/**
 * 壁、通路、ゴール、プレイヤーの順に描き直します。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      ctx.fillStyle = board[y][x] === "wall" ? "#343b4e" : "#1a1e2a";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  fillToken(goal.x, goal.y, "#8ed0aa");
  fillToken(player.x, player.y, "#e7b15a");
}

/**
 * 通路なら1マス進み、手数を足します。壁なら何もしません。
 */
function tryMove(dx, dy) {
  if (gameState === "finished") {
    return;
  }

  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (nextX < 0 || nextX >= SIZE || nextY < 0 || nextY >= SIZE) {
    return;
  }

  if (board[nextY][nextX] !== "path") {
    return;
  }

  if (gameState === "ready") {
    gameState = "playing";
    clearMessage(messageElement);
  }

  player = { x: nextX, y: nextY };
  steps += 1;
  updateScore(stepDisplay, steps);
  draw();

  if (player.x === goal.x && player.y === goal.y) {
    finishGame();
  }
}

/**
 * ゴールしたときの記録です。
 * 最短手数は小さい方が良いので、今より少ないときだけ setHighScore で保存します。
 * クリア回数は増えるので、updateHighScore に任せます。
 */
function finishGame() {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";

  const isRecord = bestSteps === 0 || steps < bestSteps;

  if (isRecord) {
    setHighScore(BEST_KEY, steps);
    bestSteps = steps;
    updateScore(bestDisplay, bestSteps);
  }

  clears += 1;
  clears = updateHighScore(CLEAR_KEY, clears);
  updateScore(clearDisplay, clears);

  if (isRecord) {
    showMessage(messageElement, steps + "手でゴールです。最短記録です！", "success");
  } else {
    showMessage(messageElement, steps + "手でゴールです。最短は" + bestSteps + "手です。", "info");
  }

  restartArea.hidden = false;
}

/**
 * 新しい迷路を掘って、手数だけ最初に戻します。最短とクリア回数は残します。
 */
function restartGame() {
  board = createWalls();
  carve(start.x, start.y);
  player = { x: start.x, y: start.y };
  steps = 0;
  gameState = "ready";

  updateScore(stepDisplay, 0);
  draw();
  showMessage(messageElement, "矢印キーか WASD で進みます。", "info");
  restartArea.hidden = true;
}

/**
 * 押されたキーを、上下左右の移動量に変えます。関係ないキーは null です。
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
  const direction = directionFromKey(event.key);

  if (direction === null) {
    return;
  }

  event.preventDefault();
  tryMove(direction.x, direction.y);
}

document.addEventListener("keydown", onKeyDown);
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
