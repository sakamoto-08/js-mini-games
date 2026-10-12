/**
 * script.js
 * タイピングゲームの本体です。
 *
 * 流れ:
 *   1. 「スタート」で 60 秒の制限時間を始める
 *   2. 単語リストから 1 語を選んで表示する
 *   3. 入力のたびに、表示と文字列を比べる
 *   4. 一致したら得点にして、次の単語へ進む
 *   5. 時間切れで結果を出し、「もう一度」で最高記録以外を戻す
 *
 * 残り時間は createTimer です。中身は 1 秒ごとの setInterval です。
 * スコア表示・メッセージ・乱数・もう一度ボタンは common.js の関数を使います。
 */

// 制限時間（秒）。ここを変えると、ゲームの長さが変わります。
const TIME_LIMIT = 60;

/**
 * 出題する英単語です。
 * 小文字だけで書いています。表示と入力は、大文字小文字も区別して比べます。
 * 語を足したいときは、この配列に文字列を追加します。
 */
const WORDS = [
  "cat",
  "dog",
  "sun",
  "book",
  "code",
  "game",
  "fish",
  "tree",
  "star",
  "bird",
  "apple",
  "water",
  "music",
  "green",
  "array",
  "click",
  "timer",
  "score",
];

const scoreArea = document.getElementById("score-area");
const recordArea = document.getElementById("record-area");
const wordElement = document.getElementById("word");
const input = document.getElementById("type-input");
const startButton = document.getElementById("start-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// いま画面に出している単語。まだ無ければ空文字です。
let currentWord = "";

// 正解した数。プレイのたびに 0 に戻します。
let score = 0;

// このページを開いてからの最高記録。
// 「もう一度」では消さず、再読み込みするまで残します。
let highScore = 0;

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。入力できない
 *   "playing"   制限時間のあいだ。入力できる
 *   "finished"  時間切れ
 */
let gameState = "ready";

const scoreDisplay = createScoreDisplay(scoreArea, "正解数", 0);
const timeDisplay = createScoreDisplay(scoreArea, "残り時間", TIME_LIMIT);
const highScoreDisplay = createScoreDisplay(recordArea, "最高記録", 0);

/**
 * 状態に合わせて、入力欄とスタートを切り替えます。
 */
function updateControls() {
  const isPlaying = gameState === "playing";
  const isFinished = gameState === "finished";

  input.disabled = !isPlaying;
  startButton.disabled = gameState !== "ready";
  startButton.hidden = isFinished;
  restartArea.hidden = !isFinished;
}

/**
 * 入力欄の色を、ここまでの文字が合っているかで変えます。
 */
function updateFeedback(typed) {
  input.classList.remove("is-correct", "is-wrong");

  if (typed === "") {
    return;
  }

  // indexOf が 0 なら、「単語が typed で始まっている」ということです。
  if (currentWord.indexOf(typed) === 0) {
    input.classList.add("is-correct");
    return;
  }

  input.classList.add("is-wrong");
}

/**
 * 単語リストから、次に出す語を 1 つ選びます。
 * 直前と同じ語は、できるだけ避けます。
 */
function pickWord() {
  let index = getRandomInt(0, WORDS.length - 1);

  if (WORDS[index] === currentWord && WORDS.length > 1) {
    index = (index + 1) % WORDS.length;
  }

  return WORDS[index];
}

/**
 * 次の単語を表示し、入力欄を空にします。
 */
function nextWord() {
  currentWord = pickWord();
  wordElement.textContent = currentWord;
  input.value = "";
  updateFeedback("");
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
 * 表示どおりに入力できたとき。得点を足して次の単語へ進みます。
 */
function markCorrect() {
  score += 1;
  updateScore(scoreDisplay, score);
  clearMessage(messageElement);
  nextWord();
}

/**
 * 入力欄の中身を、いまの単語と比べます。
 * input イベント（文字が増減したあと）から呼びます。
 */
function checkTypedText() {
  if (gameState !== "playing") {
    return;
  }

  const typed = input.value;
  updateFeedback(typed);

  if (typed === currentWord) {
    markCorrect();
  }
}

/**
 * キーが押された瞬間の処理です。
 * Enter のときは、途中でも答え合わせをします。
 */
function handleKeyDown(event) {
  if (gameState !== "playing") {
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  // フォームではないので、Enter でページが動かないようにする
  event.preventDefault();

  if (input.value === "") {
    return;
  }

  if (input.value === currentWord) {
    markCorrect();
    return;
  }

  showMessage(messageElement, "まだ違います。表示どおりに入力してください。", "error");
}

/**
 * 結果の文章を作ります。
 */
function buildResultMessage(isNewRecord) {
  const base = score + "問正解しました。";

  if (isNewRecord) {
    return base + "最高記録です！";
  }

  if (highScore > 0) {
    return base + "最高記録は" + highScore + "問です。";
  }

  return base;
}

/**
 * 時間切れの処理です。入力を止めて、最終スコアを出します。
 */
function finishGame() {
  if (gameState !== "playing") {
    return;
  }

  gameState = "finished";
  timer.stop();
  input.value = "";
  input.classList.remove("is-correct", "is-wrong");

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
  updateControls();
}

/**
 * 計測を始めます。正解数だけリセットし、最高記録はそのままです。
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
  nextWord();
  updateControls();

  // 前回の秒数が残っていると、すぐ時間切れになるので一度 0 に戻す
  timer.reset();
  timer.start();
  input.focus({ preventScroll: true });
}

/**
 * 「もう一度」で、スタート待ちに戻します。
 * 最高記録は残します。
 */
function prepareGame() {
  gameState = "ready";
  score = 0;
  currentWord = "";
  timer.reset();

  updateScore(scoreDisplay, 0);
  updateScore(timeDisplay, TIME_LIMIT);
  wordElement.textContent = "—";
  input.value = "";
  updateFeedback("");
  clearMessage(messageElement);
  updateControls();
  startButton.focus({ preventScroll: true });
}

input.addEventListener("input", checkTypedText);
input.addEventListener("keydown", handleKeyDown);
startButton.addEventListener("click", startGame);
createRestartButton(restartArea, prepareGame, "もう一度");
prepareGame();
