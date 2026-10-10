/**
 * script.js
 * モグラ叩きの本体です。
 *
 * 流れ:
 *   1. 9つの穴を作る
 *   2. 「スタート」で 30 秒の制限時間を始める
 *   3. 一定間隔で、ランダムな穴にモグラを出す
 *   4. モグラをクリックしたら得点にして、そのモグラを隠す
 *   5. 時間切れで結果を出し、「もう一度」で最高記録以外を戻す
 *
 * 残り時間は createTimer です。中身は 1 秒ごとの setInterval です。
 * モグラを出す間隔は、それとは別の setInterval で動かします。
 * スコア表示・メッセージ・乱数・もう一度ボタンは common.js の関数を使います。
 */

// 制限時間（秒）。ここを変えると、ゲームの長さが変わります。
const TIME_LIMIT = 30;

// 穴の数。3×3 なので 9 です。
const HOLE_COUNT = 9;

// モグラを出してから隠すまでの時間（ミリ秒）。
const MOLE_STAY_MS = 800;

// 次のモグラを出すまでの間隔（ミリ秒）。滞在時間より少し長くして、隙間を作ります。
const SPAWN_EVERY_MS = 1000;

const scoreArea = document.getElementById("score-area");
const recordArea = document.getElementById("record-area");
const board = document.getElementById("board");
const startButton = document.getElementById("start-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// 作った穴ボタンを入れておく配列。ランダムに選ぶときに使います。
const holes = [];

// いま見えているモグラの穴。出ていなければ null。
let activeHole = null;

// モグラを隠す予約。次を出すときと、叩いたときに clearTimeout します。
let hideTimeoutId = null;

// モグラを繰り返し出す setInterval の ID。時間切れで clearInterval します。
let spawnIntervalId = null;

// いまの得点。プレイのたびに 0 に戻します。
let score = 0;

// このページを開いてからの最高記録。
// 「もう一度」では消さず、再読み込みするまで残します。
let highScore = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。穴は押せない
 *   "playing"   制限時間のあいだ。モグラを叩ける
 *   "finished"  時間切れ
 */
let gameState = "ready";

const scoreDisplay = createScoreDisplay(scoreArea, "得点", 0);
const timeDisplay = createScoreDisplay(scoreArea, "残り時間", TIME_LIMIT);
const highScoreDisplay = createScoreDisplay(recordArea, "最高記録", 0);

/**
 * 穴を1つ作り、盤面に追加します。
 * ボタンの中にモグラの見た目を入れておき、クラスで出したり隠したりします。
 */
function createHole(index) {
  const hole = document.createElement("button");
  hole.type = "button";
  hole.className = "hole";
  hole.disabled = true;
  hole.dataset.label = "穴" + (index + 1);
  hole.setAttribute("aria-label", hole.dataset.label);

  const mole = document.createElement("span");
  mole.className = "mole";
  mole.setAttribute("aria-hidden", "true");

  const leftEye = document.createElement("span");
  leftEye.className = "eye eye-left";
  const rightEye = document.createElement("span");
  rightEye.className = "eye eye-right";
  mole.append(leftEye, rightEye);
  hole.appendChild(mole);

  hole.addEventListener("click", function () {
    hitMole(hole);
  });

  board.appendChild(hole);
  holes.push(hole);
}

/**
 * 9つの穴を作ります。配列 holes の長さが、あとから選ぶ範囲になります。
 */
function createBoard() {
  for (let index = 0; index < HOLE_COUNT; index++) {
    createHole(index);
  }
}

/**
 * 状態に合わせて、スタートと穴を押せるようにします。
 */
function updateButtons() {
  const isPlaying = gameState === "playing";
  const isFinished = gameState === "finished";

  startButton.disabled = gameState !== "ready";
  startButton.hidden = isFinished;
  restartArea.hidden = !isFinished;

  for (let index = 0; index < holes.length; index++) {
    holes[index].disabled = !isPlaying;
  }
}

/**
 * 見えているモグラを隠します。
 * クラス has-mole を外すと、CSS が顔を穴の下へ戻します。
 */
function hideMole() {
  if (hideTimeoutId !== null) {
    clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }

  if (activeHole === null) {
    return;
  }

  activeHole.classList.remove("has-mole");
  activeHole.setAttribute("aria-label", activeHole.dataset.label);
  activeHole = null;
}

/**
 * 次に出す穴をランダムに選びます。
 * いま出ている穴と同じときは、隣の穴にずらします。
 */
function chooseHole() {
  let index = getRandomInt(0, holes.length - 1);
  const currentIndex = holes.indexOf(activeHole);

  if (index === currentIndex) {
    index = (index + 1) % holes.length;
  }

  return holes[index];
}

/**
 * モグラを1匹出します。
 * すでに出ているモグラは先に隠して、同時に2匹は出しません。
 */
function showMole() {
  if (gameState !== "playing") {
    return;
  }

  const hole = chooseHole();
  hideMole();

  activeHole = hole;
  activeHole.classList.add("has-mole");
  activeHole.setAttribute("aria-label", "モグラ");

  hideTimeoutId = setTimeout(hideMole, MOLE_STAY_MS);
}

/**
 * モグラを繰り返し出します。
 * createTimer とは別の setInterval です。
 */
function startSpawning() {
  showMole();
  spawnIntervalId = setInterval(showMole, SPAWN_EVERY_MS);
}

/**
 * 出現の繰り返しを止め、見えているモグラも隠します。
 */
function stopSpawning() {
  if (spawnIntervalId !== null) {
    clearInterval(spawnIntervalId);
    spawnIntervalId = null;
  }

  hideMole();
}

/**
 * 1秒経過するたびに createTimer から呼ばれます。
 */
function handleTick(elapsedSeconds) {
  const remaining = TIME_LIMIT - elapsedSeconds;
  updateScore(timeDisplay, remaining);

  if (remaining <= 0) {
    finishGame();
  }
}

// 残り時間用。1秒たつたびに handleTick が呼ばれます。
const timer = createTimer(handleTick);

/**
 * モグラが押されたとき。
 * プレイ中で、その穴にモグラがいるときだけ得点にします。
 */
function hitMole(hole) {
  if (gameState !== "playing") {
    return;
  }

  if (!hole.classList.contains("has-mole")) {
    return;
  }

  score += 1;
  updateScore(scoreDisplay, score);
  hideMole();
}

/**
 * 結果の文章を作ります。
 */
function buildResultMessage(isNewRecord) {
  const base = score + "点でした。";

  if (isNewRecord) {
    return base + "最高記録です！";
  }

  if (highScore > 0) {
    return base + "最高記録は" + highScore + "点です。";
  }

  return base;
}

/**
 * 時間切れの処理です。
 * 両方のタイマーを止めて、最終スコアを出します。
 */
function finishGame() {
  if (gameState !== "playing") {
    return;
  }

  gameState = "finished";
  timer.stop();
  stopSpawning();

  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    updateScore(highScoreDisplay, highScore);
  }

  let messageType = "info";
  if (isNewRecord) {
    messageType = "success";
  }

  showMessage(messageElement, buildResultMessage(isNewRecord), messageType);
  updateButtons();
}

/**
 * 計測を始めます。得点だけリセットし、最高記録はそのままです。
 */
function startGame() {
  if (gameState !== "ready") {
    return;
  }

  score = 0;
  gameState = "playing";

  updateScore(scoreDisplay, score);
  updateScore(timeDisplay, TIME_LIMIT);
  clearMessage(messageElement);
  updateButtons();

  // 前回の秒数が残っていると、すぐ時間切れになるので一度 0 に戻す
  timer.reset();
  timer.start();
  startSpawning();
}

/**
 * 「もう一度」で、スタート待ちに戻します。
 * 最高記録は残します。
 */
function prepareGame() {
  gameState = "ready";
  score = 0;
  timer.reset();
  stopSpawning();

  updateScore(scoreDisplay, 0);
  updateScore(timeDisplay, TIME_LIMIT);
  clearMessage(messageElement);
  updateButtons();
  startButton.focus({ preventScroll: true });
}

createBoard();
startButton.addEventListener("click", startGame);
createRestartButton(restartArea, prepareGame, "もう一度");
prepareGame();
