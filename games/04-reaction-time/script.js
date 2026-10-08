/**
 * script.js
 * 反応速度ゲームの本体です。
 *
 * 流れ:
 *   1. 「スタート」で待機状態にする
 *   2. 1〜5秒のランダムな待ち時間のあと、画面を切り替える
 *   3. 切り替わってからクリックされるまでのミリ秒を測る
 *   4. 切り替わる前のクリックはフライングにして、記録にしない
 *   5. 「もう一度」で、最高記録以外を最初の状態に戻す
 *
 * 待ち時間は setTimeout です。
 * createTimer は 1 秒ごとにしか進まないので、ミリ秒の計測には使いません。
 * 経過時間は performance.now() の差で取ります。
 *
 * スコア表示・メッセージ・乱数・もう一度ボタンは common.js の関数を使います。
 */

// 合図が出るまでの待ち時間（ミリ秒）。両端を含みます。
const MIN_DELAY = 1000;
const MAX_DELAY = 5000;

const gameShell = document.getElementById("game-shell");
const scoreArea = document.getElementById("score-area");
const targetButton = document.getElementById("target-button");
const startButton = document.getElementById("start-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// 今回の記録（ミリ秒）。まだ無ければ null。
let reactionTime = null;

// ページを開いてからの最速記録。小さいほど良いです。
// 「もう一度」では消さず、再読み込みするまで残します。
let bestTime = null;

// performance.now() で控えた、合図が出た時刻。
let startedAt = 0;

// setTimeout が返した ID。フライングのときに clearTimeout します。
let timeoutId = null;

/**
 * ゲームの状態です。次の4つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち
 *   "waiting"   合図の前。ここでのクリックはフライング
 *   "go"        合図が出た。クリックまでの時間を測る
 *   "finished"  結果を出している
 */
let gameState = "ready";

const resultDisplay = createScoreDisplay(scoreArea, "今回 (ms)", "—");
const bestDisplay = createScoreDisplay(scoreArea, "最高記録 (ms)", "—");

/**
 * 予約している合図を消します。
 * 消さないと、フライングのあとに画面が変わってしまいます。
 */
function clearPendingSignal() {
  if (timeoutId === null) {
    return;
  }

  clearTimeout(timeoutId);
  timeoutId = null;
}

/**
 * 大きなボタンとカードの見た目を、状態に合わせます。
 */
function setStage(mode) {
  gameShell.className = "game-shell is-" + mode;
  targetButton.className = "btn target-button is-" + mode;

  if (mode === "ready") {
    targetButton.textContent = "スタートを押す";
    return;
  }

  if (mode === "waiting") {
    targetButton.textContent = "待機中…";
    return;
  }

  if (mode === "go") {
    targetButton.textContent = "今すぐクリック！";
    return;
  }

  if (mode === "false-start") {
    targetButton.textContent = "フライング";
    return;
  }

  targetButton.textContent = reactionTime + " ms";
}

/**
 * 状態に合わせて、ボタンを押せるか・表示するかを切り替えます。
 * ターゲットを押せるのは、待機中と合図のあとだけです。
 */
function updateButtons() {
  const canClickTarget = gameState === "waiting" || gameState === "go";
  const isFinished = gameState === "finished";

  targetButton.disabled = !canClickTarget;
  startButton.disabled = gameState !== "ready";
  startButton.hidden = gameState !== "ready";
  restartArea.hidden = !isFinished;
}

/**
 * 結果の文章を作ります。
 * 最高記録は「より短い時間」です。
 */
function buildResultMessage(isNewRecord) {
  const base = reactionTime + " ms でした。";

  if (isNewRecord) {
    return base + "最高記録です！";
  }

  return base + "最高記録は " + bestTime + " ms です。";
}

/**
 * 合図を出して、計測の開始時刻を控えます。
 * setTimeout から、待ち時間が過ぎたあとに呼ばれます。
 */
function showGoSignal() {
  timeoutId = null;

  // フライングなどで、もう待機中でないなら何もしない
  if (gameState !== "waiting") {
    return;
  }

  gameState = "go";
  // performance.now() は、ページを開いてからの経過ミリ秒です。
  // 終了時刻からこの値を引くと、反応にかかった時間が分かります。
  startedAt = performance.now();
  setStage("go");
  updateButtons();
}

/**
 * 計測を始めます。合図そのものは、ランダムな秒数のあとに出します。
 */
function startRound() {
  if (gameState !== "ready") {
    return;
  }

  gameState = "waiting";
  reactionTime = null;
  updateScore(resultDisplay, "—");
  clearMessage(messageElement);
  setStage("waiting");
  updateButtons();
  // 画面が短いとき、ボタンへ勝手にスクロールして見出しが隠れないようにする
  targetButton.focus({ preventScroll: true });

  // getRandomInt は両端を含むので、1000 も 5000 も出ます。
  const delay = getRandomInt(MIN_DELAY, MAX_DELAY);
  clearPendingSignal();
  timeoutId = setTimeout(showGoSignal, delay);
}

/**
 * 合図の前に押したとき。記録は残さず、合図も出さないようにします。
 */
function falseStart() {
  clearPendingSignal();
  gameState = "finished";
  reactionTime = null;
  updateScore(resultDisplay, "—");
  setStage("false-start");
  showMessage(
    messageElement,
    "フライングです。色が変わる前に押しました。",
    "error"
  );
  updateButtons();
}

/**
 * 合図のあとに押したとき。かかったミリ秒を四捨五入して記録します。
 */
function finishRound() {
  const elapsed = performance.now() - startedAt;
  reactionTime = Math.round(elapsed);
  gameState = "finished";

  updateScore(resultDisplay, reactionTime);

  // 記録が無いときと、これまでの最速より短いときだけ更新する
  const isNewRecord = bestTime === null || reactionTime < bestTime;
  if (isNewRecord) {
    bestTime = reactionTime;
    updateScore(bestDisplay, bestTime);
  }

  let messageType = "info";
  if (isNewRecord) {
    messageType = "success";
  }

  setStage("finished");
  showMessage(messageElement, buildResultMessage(isNewRecord), messageType);
  updateButtons();
}

/**
 * 大きなボタンが押されたとき。
 * 待機中ならフライング、合図のあとなら計測終了です。
 */
function handleTargetClick() {
  if (gameState === "waiting") {
    falseStart();
    return;
  }

  if (gameState !== "go") {
    return;
  }

  finishRound();
}

/**
 * 「もう一度」で、スタート待ちに戻します。
 * 最高記録は残します。
 */
function prepareRound() {
  clearPendingSignal();
  gameState = "ready";
  reactionTime = null;
  startedAt = 0;

  updateScore(resultDisplay, "—");
  clearMessage(messageElement);
  setStage("ready");
  updateButtons();
  startButton.focus({ preventScroll: true });
}

targetButton.addEventListener("click", handleTargetClick);
startButton.addEventListener("click", startRound);

createRestartButton(restartArea, prepareRound, "もう一度");

prepareRound();
