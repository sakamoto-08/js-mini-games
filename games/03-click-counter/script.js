/**
 * script.js
 * クリックカウンターの本体です。
 *
 * 流れ:
 *   1. 「スタート」で 10 秒間の計測を始める
 *   2. 制限時間中だけ、大きなボタンのクリックを数える
 *   3. 1 秒ごとに残り時間を更新する
 *   4. 0 秒になったら結果を出して、ボタンを押せなくする
 *   5. 「もう一度」で、最高記録以外を最初の状態に戻す
 *
 * スコア表示・メッセージ・タイマー・もう一度ボタンは common.js の関数を使います。
 * setInterval / clearInterval そのものは createTimer の中にあります。
 */

// 制限時間（秒）。ここを変えると、ゲームの長さが変わります。
const TIME_LIMIT = 10;

const scoreArea = document.getElementById("score-area");
const recordArea = document.getElementById("record-area");
const clickButton = document.getElementById("click-button");
const startButton = document.getElementById("start-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// いま何回押したか。プレイのたびに 0 に戻します。
let clickCount = 0;

// このページを開いてからの最高記録。
// 「もう一度」では消さず、再読み込みするまで残します。
let highScore = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。クリックは無効
 *   "playing"   制限時間のあいだ。クリックが有効
 *   "finished"  時間切れ。クリックは無効
 */
let gameState = "ready";

const clickDisplay = createScoreDisplay(scoreArea, "クリック数", 0);
const timeDisplay = createScoreDisplay(scoreArea, "残り時間", TIME_LIMIT);
const highScoreDisplay = createScoreDisplay(recordArea, "最高記録", 0);

/**
 * 状態に合わせて、ボタンを押せるか・表示するかを切り替えます。
 * クリックが数えられるのは "playing" のときだけです。
 */
function updateButtons() {
  const isPlaying = gameState === "playing";
  const isFinished = gameState === "finished";

  clickButton.disabled = !isPlaying;
  startButton.disabled = gameState !== "ready";
  startButton.hidden = isFinished;
  restartArea.hidden = !isFinished;
}

/**
 * 1秒経過するたびに createTimer から呼ばれます。
 * elapsedSeconds は、スタートしてから何秒たったかです。
 */
function handleTick(elapsedSeconds) {
  const remaining = TIME_LIMIT - elapsedSeconds;
  updateScore(timeDisplay, remaining);

  if (remaining <= 0) {
    finishGame();
  }
}

// onTick に handleTick を渡す。start すると 1 秒ごとに呼ばれます。
const timer = createTimer(handleTick);

/**
 * 結果の文章を作ります。
 * 最高記録を更新したかどうかで、文の後半が変わります。
 */
function buildResultMessage(isNewRecord) {
  const base = clickCount + "回クリックしました。";

  if (isNewRecord) {
    return base + "最高記録です！";
  }

  if (highScore > 0) {
    return base + "最高記録は" + highScore + "回です。";
  }

  return base;
}

/**
 * 時間切れの処理です。
 * タイマーを止め、クリックを無効にし、最終スコアを出します。
 */
function finishGame() {
  // すでに終わっているのに、もう一度呼ばれても何もしない
  if (gameState !== "playing") {
    return;
  }

  gameState = "finished";
  timer.stop();

  // 記録を更新するかどうかは、数字を書き換える前に比べる
  const isNewRecord = clickCount > highScore;
  if (isNewRecord) {
    highScore = clickCount;
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
 * 計測を始めます。クリック数だけリセットし、最高記録はそのままです。
 */
function startGame() {
  if (gameState !== "ready") {
    return;
  }

  clickCount = 0;
  gameState = "playing";

  updateScore(clickDisplay, clickCount);
  updateScore(timeDisplay, TIME_LIMIT);
  clearMessage(messageElement);

  // 前回の秒数が残っていると、すぐ時間切れになるので一度 0 に戻してから始める
  timer.reset();
  timer.start();

  updateButtons();
  clickButton.focus();
}

/**
 * 「もう一度」で、スタート待ちの状態に戻します。
 * 最高記録は残します。
 */
function prepareGame() {
  gameState = "ready";
  clickCount = 0;
  timer.reset();

  updateScore(clickDisplay, 0);
  updateScore(timeDisplay, TIME_LIMIT);
  clearMessage(messageElement);
  updateButtons();
  startButton.focus();
}

/**
 * 大きなボタンが押されたとき。
 * playing でなければ、たとえ押せても数えません。
 */
function handleClick() {
  if (gameState !== "playing") {
    return;
  }

  clickCount += 1;
  updateScore(clickDisplay, clickCount);
}

clickButton.addEventListener("click", handleClick);
startButton.addEventListener("click", startGame);

createRestartButton(restartArea, prepareGame, "もう一度");

prepareGame();
