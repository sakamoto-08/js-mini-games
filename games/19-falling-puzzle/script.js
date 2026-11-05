/**
 * script.js
 * 落ちものパズル（簡易版）の本体です。
 *
 * 流れ:
 *   1. 盤面は、行と列の2次元配列で持つ
 *   2. ブロックが上から1マスずつ落ちる
 *   3. 左右で動かし、下で速く落とし、スペースか上で回す
 *   4. 下に着いたら、その色を盤面へ固定して次のブロックを出す
 *   5. 横一列が全部埋まったら消し、上のマスを1段落とす
 *   6. 次のブロックを置く場所が無ければゲームオーバー
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * createTimer は 1 秒ごとにしか進まないので、落下には使いません。
 * 落下の間隔は performance.now() で数えます。
 * スコア・結果メッセージ・もう一度ボタン・乱数・最高記録は common.js を使います。
 * 最高記録は localStorage に残すので、ページを閉じても消えません。
 */

// 横のマス数と縦のマス数です。ここを変えると盤面の広さが変わります。
const COLS = 10;
const ROWS = 18;

// 1マスの大きさ（ピクセル）です。
const CELL = 20;

// 何もしないときの落下間隔（ミリ秒）です。難易度調整用で、小さくすると速く落ちます。
const FALL_EVERY_MS = 650;

// 下キーを押しているあいだの落下間隔です。
const SOFT_DROP_MS = 70;

// 左右を押し続けたときの移動間隔です。
const SLIDE_EVERY_MS = 130;

// 一度に消した列数ごとの得点です。添字が消した列数です。
const LINE_POINTS = [0, 100, 300, 500, 800];

// このゲームだけの保存名です。他のゲームの記録と混ざらないようにします。
const HIGH_SCORE_KEY = "js-mini-games-falling-puzzle-highscore";

/**
 * ブロックの形です。rotations の1つが、ある向きのマスです。
 * 各マスは、ブロックの左上からの { x, y } です。
 * 色は common.css のアクセントに近い4色です。
 */
const SHAPES = [
  {
    color: "#e7b15a",
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    ],
  },
  {
    color: "#9ec0ea",
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
    ],
  },
  {
    color: "#f0a396",
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 2 },
      ],
    ],
  },
  {
    color: "#8ed0aa",
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
      ],
      [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
      ],
    ],
  },
];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// 盤面です。board[行][列] が null なら空き、色の文字列なら固定されたマスです。
let board = [];

// いま落ちているブロックです。着地して次が出るまで、この1つだけです。
let piece = null;

// 消した列の合計と、その得点です。
let lines = 0;
let score = 0;

// ブラウザに残っている最高記録です。まだ無いときは 0 です。
let highScore = getHighScore(HIGH_SCORE_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     キー待ち。ブロックは落ちない
 *   "playing"   落下中
 *   "finished"  ゲームオーバー
 */
let gameState = "ready";

// 左右と下を押し続けているかです。keyup で false に戻します。
const held = { left: false, right: false, down: false };

// 前回落とした時刻と、前回横へ動かした時刻です。
let lastFallTime = 0;
let lastSlideTime = 0;

const lineDisplay = createScoreDisplay(scoreArea, "ライン", 0);
const scoreDisplay = createScoreDisplay(scoreArea, "スコア", 0);
const highScoreDisplay = createScoreDisplay(scoreArea, "最高記録", highScore);

/**
 * 空の盤面を作ります。行の配列の中に、列の配列が入ります。
 */
function createBoard() {
  const next = [];

  for (let row = 0; row < ROWS; row += 1) {
    next.push(createEmptyRow());
  }

  return next;
}

/**
 * 1行ぶんの空きマスを作ります。列を消したあと、一番上に足すときにも使います。
 */
function createEmptyRow() {
  const row = [];

  for (let col = 0; col < COLS; col += 1) {
    row.push(null);
  }

  return row;
}

/**
 * ブロックが占めるマスを、盤面の座標で返します。
 */
function cellsOf(target) {
  const blocks = SHAPES[target.shapeIndex].rotations[target.rotation];
  const cells = [];

  for (let i = 0; i < blocks.length; i += 1) {
    cells.push({
      x: target.x + blocks[i].x,
      y: target.y + blocks[i].y,
    });
  }

  return cells;
}

/**
 * target を今の位置に置けるかを返します。
 * 盤面より上にはみ出すのは、落ちてくる途中だけ許します。
 */
function fits(target) {
  const cells = cellsOf(target);

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];

    if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) {
      return false;
    }

    if (cell.y < 0) {
      continue;
    }

    if (board[cell.y][cell.x] !== null) {
      return false;
    }
  }

  return true;
}

/**
 * 位置や向きだけを変えたコピーを作ります。元のブロックはまだ動かしません。
 */
function movedPiece(dx, dy, rotation) {
  return {
    shapeIndex: piece.shapeIndex,
    rotation: rotation,
    x: piece.x + dx,
    y: piece.y + dy,
  };
}

/**
 * 空いているときだけ、落ちているブロックを動かします。
 */
function tryMove(dx, dy) {
  const next = movedPiece(dx, dy, piece.rotation);

  if (!fits(next)) {
    return false;
  }

  piece = next;
  return true;
}

/**
 * 次の向きに回します。
 * 壁にくっつくと、その場ではマスがはみ出します。
 * そのときは左右へ 1〜2 マスずらしてから回します。
 */
function rotatePiece() {
  const count = SHAPES[piece.shapeIndex].rotations.length;
  const nextRotation = (piece.rotation + 1) % count;
  const kicks = [0, -1, 1, -2, 2];

  for (let i = 0; i < kicks.length; i += 1) {
    const next = movedPiece(kicks[i], 0, nextRotation);

    if (fits(next)) {
      piece = next;
      return true;
    }
  }

  return false;
}

/**
 * ブロックを盤面の上端、左右の中央に置きます。
 */
function placeAtTop(target) {
  const cells = cellsOf(target);
  let minX = cells[0].x;
  let maxX = cells[0].x;
  let minY = cells[0].y;

  for (let i = 1; i < cells.length; i += 1) {
    minX = Math.min(minX, cells[i].x);
    maxX = Math.max(maxX, cells[i].x);
    minY = Math.min(minY, cells[i].y);
  }

  const width = maxX - minX + 1;
  target.x += Math.floor((COLS - width) / 2) - minX;
  target.y += -minY;
}

/**
 * 次のブロックを出します。置く場所が無ければゲームオーバーです。
 */
function spawnPiece() {
  piece = {
    shapeIndex: getRandomInt(0, SHAPES.length - 1),
    rotation: 0,
    x: 0,
    y: 0,
  };
  placeAtTop(piece);

  if (!fits(piece)) {
    piece = null;
    finishGame();
  }
}

/**
 * その行が端から端まで埋まっているかを返します。
 */
function isRowFull(row) {
  for (let col = 0; col < COLS; col += 1) {
    if (board[row][col] === null) {
      return false;
    }
  }

  return true;
}

/**
 * 埋まった行を消します。消した行のぶん、上の行が下へずれます。
 * 同じ段がまた埋まっていることがあるので、消した行の番号は進めません。
 */
function clearLines() {
  let cleared = 0;

  for (let row = ROWS - 1; row >= 0; ) {
    if (!isRowFull(row)) {
      row -= 1;
      continue;
    }

    board.splice(row, 1);
    board.unshift(createEmptyRow());
    cleared += 1;
  }

  return cleared;
}

/**
 * 落ちているブロックを盤面へ固定し、列を消してから次を出します。
 */
function lockPiece() {
  const cells = cellsOf(piece);
  const color = SHAPES[piece.shapeIndex].color;

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];

    if (cell.y < 0 || cell.y >= ROWS) {
      continue;
    }

    board[cell.y][cell.x] = color;
  }

  const cleared = clearLines();

  if (cleared > 0) {
    lines += cleared;
    score += LINE_POINTS[cleared];
    updateScore(lineDisplay, lines);
    updateScore(scoreDisplay, score);
  }

  spawnPiece();
}

/**
 * 1マス下へ落とします。置けなければ、そこで固定します。
 */
function stepDown() {
  if (gameState === "finished" || piece === null) {
    return;
  }

  if (tryMove(0, 1)) {
    return;
  }

  lockPiece();
}

/**
 * 1マスを塗りつぶします。すき間を空けるので、マスの境目が見えます。
 */
function fillCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
}

/**
 * 固定されたマスと、落ちているブロックを描き直します。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      fillCell(col, row, board[row][col] || "#1a1e2a");
    }
  }

  if (piece === null) {
    return;
  }

  const cells = cellsOf(piece);
  const color = SHAPES[piece.shapeIndex].color;

  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i].y < 0) {
      continue;
    }

    fillCell(cells[i].x, cells[i].y, color);
  }
}

/**
 * キー待ちを終わらせて、落下を始めます。
 */
function beginPlaying() {
  if (gameState !== "ready") {
    return;
  }

  gameState = "playing";
  const now = performance.now();
  lastFallTime = now;
  lastSlideTime = now;
  clearMessage(messageElement);
}

/**
 * ゲームオーバーにします。
 * 得点が最高より大きいときだけ、localStorage に保存します。
 */
function finishGame() {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  held.left = false;
  held.right = false;
  held.down = false;
  draw();

  const isRecord = score > highScore;

  if (isRecord) {
    highScore = updateHighScore(HIGH_SCORE_KEY, score);
    updateScore(highScoreDisplay, highScore);
    showMessage(messageElement, lines + "列で" + score + "点。最高記録です！", "success");
  } else if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。ブロックが天井まで積み上がりました。", "error");
  } else {
    showMessage(
      messageElement,
      lines + "列で" + score + "点。最高記録は" + highScore + "点です。",
      "info"
    );
  }

  restartArea.hidden = false;
}

/**
 * 盤面と得点を最初に戻します。最高記録は残します。
 */
function restartGame() {
  board = createBoard();
  lines = 0;
  score = 0;
  gameState = "ready";
  held.left = false;
  held.right = false;
  held.down = false;

  updateScore(lineDisplay, 0);
  updateScore(scoreDisplay, 0);
  spawnPiece();
  draw();
  showMessage(messageElement, "左右キーか A / D でスタートします。", "info");
  restartArea.hidden = true;
}

/**
 * 押されたキーを、操作の名前に変えます。関係ないキーは null です。
 */
function actionFromKey(key) {
  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return "left";
  }

  if (key === "ArrowRight" || key === "d" || key === "D") {
    return "right";
  }

  if (key === "ArrowDown" || key === "s" || key === "S") {
    return "down";
  }

  if (key === "ArrowUp" || key === "w" || key === "W" || key === " ") {
    return "rotate";
  }

  return null;
}

/**
 * キーを押した瞬間に1回動かし、押し続けは loop が繰り返します。
 */
function onKeyDown(event) {
  const action = actionFromKey(event.key);

  if (action === null) {
    return;
  }

  event.preventDefault();

  if (gameState === "finished") {
    return;
  }

  if (gameState === "ready") {
    beginPlaying();
  }

  if (action === "left") {
    held.left = true;
  }

  if (action === "right") {
    held.right = true;
  }

  if (action === "down") {
    held.down = true;
  }

  if (event.repeat) {
    return;
  }

  if (action === "left") {
    tryMove(-1, 0);
  }

  if (action === "right") {
    tryMove(1, 0);
  }

  if (action === "down") {
    stepDown();
    lastFallTime = performance.now();
  }

  if (action === "rotate") {
    rotatePiece();
  }

  lastSlideTime = performance.now();

  if (gameState === "playing") {
    draw();
  }
}

/**
 * キーを離したら、押し続けの移動を止めます。
 */
function onKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    held.left = false;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    held.right = false;
  }

  if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
    held.down = false;
  }
}

/**
 * 画面の更新ループです。ブラウザが表示できるタイミングで、何度も呼ばれます。
 * 左右の押し続けと落下は、それぞれの間隔が過ぎたときだけ進めます。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (gameState !== "playing" || piece === null) {
    return;
  }

  let moved = false;

  if (now - lastSlideTime >= SLIDE_EVERY_MS) {
    if (held.left && !held.right) {
      tryMove(-1, 0);
      lastSlideTime = now;
      moved = true;
    } else if (held.right && !held.left) {
      tryMove(1, 0);
      lastSlideTime = now;
      moved = true;
    }
  }

  const fallEvery = held.down ? SOFT_DROP_MS : FALL_EVERY_MS;

  if (now - lastFallTime >= fallEvery) {
    lastFallTime = now;
    stepDown();
    moved = true;
  }

  if (moved && gameState === "playing") {
    draw();
  }
}

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", function () {
  held.left = false;
  held.right = false;
  held.down = false;
});
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
