/**
 * script.js
 * マインスイーパー（簡易版）の本体です。
 *
 * 流れ:
 *   1. マスを2次元配列で用意する。最初は全部閉じている
 *   2. 最初のクリックで地雷をばらまく。押したマスとその周りには置かない
 *   3. マスを開く。周りに地雷がなければ、開く処理を自分で呼び直して連鎖させる
 *   4. 地雷を開いたらゲームオーバー。地雷以外を全部開いたらクリア
 *   5. 終わったときの秒数を出す。「もう一度」で盤面を作り直す
 *
 * 経過秒は createTimer（1秒ごと）です。
 * 時間・残りマス・結果メッセージ・もう一度ボタンは common.js を使います。
 */

// 盤面の大きさと地雷の数です。ここを変えると難しさが変わります。
const ROWS = 8;
const COLS = 8;
const MINE_COUNT = 10;

// 長押しとみなすまでの時間（ミリ秒）。スマホで旗を立てるのに使います。
const LONG_PRESS_MS = 500;

// あるマスから見た、周囲8マスへのずれです。中央自身は含めません。
const NEIGHBORS = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

const boardElement = document.getElementById("board");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// board[row][col] が1マスです。mine / adjacent / open / flagged を持ちます。
let board = [];

// 画面のボタンです。board と同じ行・列で対応します。
let buttons = [];

// 開いた、地雷ではないマスの数です。これが安全なマスの数と一致したらクリアです。
let openedSafe = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     最初のクリック待ち。まだ地雷は無い
 *   "playing"   プレイ中。タイマーが進む
 *   "finished"  クリアかゲームオーバー
 */
let gameState = "ready";

// 長押しの予約です。指を離したら clearTimeout します。
let longPressId = null;

// 長押しで旗を立てた直後のクリックは、マスを開かないようにします。
let suppressClick = false;

const timeDisplay = createScoreDisplay(scoreArea, "時間", 0);
const remainingDisplay = createScoreDisplay(scoreArea, "残りマス", 0);

/**
 * 1秒ごとに、経過秒の表示を更新します。
 * createTimer はスタートしてから 1, 2, 3... と数えます。
 */
const timer = createTimer(function (seconds) {
  updateScore(timeDisplay, seconds);
});

/**
 * 地雷ではないマスの数です。クリアの目標値になります。
 */
function safeCellCount() {
  return ROWS * COLS - MINE_COUNT;
}

/**
 * 行と列が盤面の中かを返します。
 */
function inBounds(row, col) {
  return row >= 0 && col >= 0 && row < ROWS && col < COLS;
}

/**
 * 周囲8マスのうち、盤面の中にあるものだけを visit します。
 */
function forEachNeighbor(row, col, visit) {
  for (let i = 0; i < NEIGHBORS.length; i += 1) {
    const nearRow = row + NEIGHBORS[i].row;
    const nearCol = col + NEIGHBORS[i].col;

    if (!inBounds(nearRow, nearCol)) {
      continue;
    }

    visit(nearRow, nearCol);
  }
}

/**
 * 全部閉じた、地雷の無い盤面を作ります。
 * 外側の配列が行、内側の配列が列です。
 */
function createEmptyBoard() {
  board = [];

  for (let row = 0; row < ROWS; row += 1) {
    const line = [];

    for (let col = 0; col < COLS; col += 1) {
      line.push({
        mine: false,
        adjacent: 0,
        open: false,
        flagged: false,
        exploded: false,
      });
    }

    board.push(line);
  }
}

/**
 * 最初に開いたマスと、その周囲に地雷を置かないための判定です。
 * ずれが行・列とも 1 以内なら、そのマスは安全地帯です。
 */
function isFirstClickZone(row, col, safeRow, safeCol) {
  const rowDistance = Math.abs(row - safeRow);
  const colDistance = Math.abs(col - safeCol);
  return rowDistance <= 1 && colDistance <= 1;
}

/**
 * 地雷をばらまきます。
 * 最初のマスとその周りは避けます。だから最初の1手は空白になり、連鎖が見えます。
 */
function placeMines(safeRow, safeCol) {
  let placed = 0;
  let tries = 0;
  const maxTries = ROWS * COLS * 20;

  while (placed < MINE_COUNT && tries < maxTries) {
    tries += 1;
    const row = getRandomInt(0, ROWS - 1);
    const col = getRandomInt(0, COLS - 1);
    const cell = board[row][col];

    if (cell.mine || isFirstClickZone(row, col, safeRow, safeCol)) {
      continue;
    }

    cell.mine = true;
    placed += 1;
  }
}

/**
 * 1マスの周囲にある地雷の数を数えます。
 */
function countNeighborMines(row, col) {
  let count = 0;

  forEachNeighbor(row, col, function (nearRow, nearCol) {
    if (board[nearRow][nearCol].mine) {
      count += 1;
    }
  });

  return count;
}

/**
 * 地雷ではないマス全部に、周囲の地雷数を書き込みます。
 */
function fillAdjacentCounts() {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = board[row][col];

      if (cell.mine) {
        cell.adjacent = 0;
        continue;
      }

      cell.adjacent = countNeighborMines(row, col);
    }
  }
}

/**
 * 読み上げ用の短い説明です。
 */
function labelFor(cell, row, col) {
  const place = row + 1 + "行" + (col + 1) + "列";

  if (cell.exploded) {
    return place + "、踏んだ地雷";
  }

  if (cell.open && cell.mine) {
    return place + "、地雷";
  }

  if (cell.open && cell.adjacent > 0) {
    return place + "、" + cell.adjacent;
  }

  if (cell.open) {
    return place + "、空白";
  }

  if (cell.flagged) {
    return place + "、旗";
  }

  return place + "、閉じたマス";
}

/**
 * 1マスの見た目を、データに合わせて更新します。
 */
function paintCell(row, col) {
  const cell = board[row][col];
  const button = buttons[row][col];

  button.className = "cell";
  button.textContent = "";

  if (cell.open) {
    button.classList.add("is-open");
  }

  if (cell.flagged && !cell.open) {
    button.classList.add("is-flag");
    button.textContent = "🚩";
  }

  if (cell.open && cell.mine) {
    button.classList.add("is-mine");
    button.textContent = "💣";
  }

  if (cell.exploded) {
    button.classList.add("is-exploded");
  }

  if (cell.open && !cell.mine && cell.adjacent > 0) {
    button.classList.add("n" + cell.adjacent);
    button.textContent = String(cell.adjacent);
  }

  button.setAttribute("aria-label", labelFor(cell, row, col));
}

/**
 * ボタンを作り直します。列の数は COLS に合わせます。
 */
function buildButtons() {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = "repeat(" + COLS + ", minmax(0, 1fr))";
  buttons = [];

  for (let row = 0; row < ROWS; row += 1) {
    const line = [];
    buttons.push(line);

    for (let col = 0; col < COLS; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      boardElement.appendChild(button);
      line.push(button);
      paintCell(row, col);
    }
  }
}

/**
 * クリックされたボタンから、行と列を取り出します。
 * ボタン以外をクリックしたときは null です。
 */
function cellPosition(target) {
  const button = target.closest(".cell");

  if (!button) {
    return null;
  }

  return {
    row: Number(button.dataset.row),
    col: Number(button.dataset.col),
  };
}

/**
 * マスを開きます。空白なら、周囲にも同じ関数を呼びます。
 * 関数が自分を呼ぶことを再帰といいます。
 * 開いたマスは open にしてから呼ぶので、同じマスを無限に開きません。
 */
function openCell(row, col) {
  if (!inBounds(row, col)) {
    return;
  }

  const cell = board[row][col];

  if (cell.open || cell.flagged || cell.mine) {
    return;
  }

  cell.open = true;
  openedSafe += 1;
  paintCell(row, col);
  updateScore(remainingDisplay, safeCellCount() - openedSafe);

  if (cell.adjacent !== 0) {
    return;
  }

  forEachNeighbor(row, col, function (nearRow, nearCol) {
    openCell(nearRow, nearCol);
  });
}

/**
 * 地雷を全部表にします。踏んだ1マスだけ色を変えます。
 */
function revealMines(explodedRow, explodedCol) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = board[row][col];

      if (!cell.mine) {
        continue;
      }

      cell.open = true;
      cell.flagged = false;
      cell.exploded = row === explodedRow && col === explodedCol;
      paintCell(row, col);
    }
  }
}

/**
 * クリアかゲームオーバーにします。
 * result は "clear" か "over" です。秒数は createTimer の値です。
 */
function finishGame(result, explodedRow, explodedCol) {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  timer.stop();
  cancelLongPress();

  const seconds = timer.getSeconds();

  if (result === "over") {
    revealMines(explodedRow, explodedCol);
    showMessage(messageElement, "ゲームオーバー。" + seconds + "秒でした。", "error");
  } else {
    showMessage(messageElement, "クリアです。" + seconds + "秒でした。", "success");
  }

  restartArea.hidden = false;
}

/**
 * 左クリックでマスを開きます。最初の1手で地雷を置き、タイマーを始めます。
 */
function openAt(row, col) {
  if (gameState === "finished") {
    return;
  }

  if (gameState === "ready") {
    placeMines(row, col);
    fillAdjacentCounts();
    gameState = "playing";
    clearMessage(messageElement);
    timer.start();
  }

  const cell = board[row][col];

  if (cell.open || cell.flagged) {
    return;
  }

  if (cell.mine) {
    finishGame("over", row, col);
    return;
  }

  openCell(row, col);

  if (gameState === "playing" && openedSafe === safeCellCount()) {
    finishGame("clear");
  }
}

/**
 * 旗を立てるか、外します。開いたマスと、終わったあとは無視します。
 */
function toggleFlag(row, col) {
  if (gameState === "finished") {
    return;
  }

  const cell = board[row][col];

  if (cell.open) {
    return;
  }

  cell.flagged = !cell.flagged;
  paintCell(row, col);
}

/**
 * 長押しの予約を消します。
 */
function cancelLongPress() {
  if (longPressId === null) {
    return;
  }

  clearTimeout(longPressId);
  longPressId = null;
}

/**
 * 盤面とタイマーを最初に戻します。
 */
function restartGame() {
  timer.reset();
  updateScore(timeDisplay, 0);
  openedSafe = 0;
  gameState = "ready";
  suppressClick = false;
  cancelLongPress();
  createEmptyBoard();
  buildButtons();
  updateScore(remainingDisplay, safeCellCount());
  showMessage(messageElement, "マスをクリックして開きます。右クリックで旗を立てます。", "info");
  restartArea.hidden = true;
}

boardElement.addEventListener("click", function (event) {
  const position = cellPosition(event.target);

  if (!position) {
    return;
  }

  if (suppressClick) {
    suppressClick = false;
    return;
  }

  openAt(position.row, position.col);
});

boardElement.addEventListener("contextmenu", function (event) {
  const position = cellPosition(event.target);

  if (!position) {
    return;
  }

  event.preventDefault();
  cancelLongPress();

  // 長押し側で先に旗を立てていれば、ここでは重ねて切り替えません。
  if (suppressClick) {
    return;
  }

  toggleFlag(position.row, position.col);
});

boardElement.addEventListener("pointerdown", function (event) {
  if (event.button !== 0) {
    return;
  }

  const position = cellPosition(event.target);

  if (!position) {
    return;
  }

  // 直前の長押しで残った「クリックを無視」は、新しい押し始めでは解除する
  suppressClick = false;
  cancelLongPress();
  longPressId = setTimeout(function () {
    longPressId = null;
    // 指を離したあとの click でマスを開かない。次の pointerdown まで残します。
    suppressClick = true;
    toggleFlag(position.row, position.col);
  }, LONG_PRESS_MS);
});

boardElement.addEventListener("pointerup", cancelLongPress);
boardElement.addEventListener("pointerleave", cancelLongPress);
boardElement.addEventListener("pointercancel", cancelLongPress);

createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
