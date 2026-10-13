/**
 * script.js
 * ストップウォッチの本体です。
 *
 * 流れ:
 *   1. 「スタート」で計測を始める。止めている時間があれば、その続きから測る
 *   2. 10ミリ秒ごとに表示を更新する
 *   3. 「ストップ」で止め、それまでの時間を確定する
 *   4. 「ラップ」で、いまの経過時間を一覧に残す
 *   5. 「リセット」で 0 に戻し、ラップも消す
 *
 * 表示の更新は setInterval、経過時間の計算は performance.now() です。
 * createTimer は 1 秒ごとにしか進まないので、ここでは使いません。
 * ラップ数・一時停止のメッセージ・リセットボタンは common.js の関数を使います。
 */

// 画面を更新する間隔（ミリ秒）。短いほど表示がなめらかになります。
const TICK_MS = 10;

const timeElement = document.getElementById("time");
const scoreArea = document.getElementById("score-area");
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");
const lapButton = document.getElementById("lap-button");
const resetArea = document.getElementById("reset-area");
const messageElement = document.getElementById("message");
const lapList = document.getElementById("lap-list");

// ストップするまでに確定した経過時間（ミリ秒）。
// 計測中の「いまのぶん」は、ここにはまだ足しません。
let elapsedMs = 0;

// いまの計測を始めた時刻。performance.now() の値です。
let runningStartedAt = 0;

// setInterval が返した ID。ストップとリセットで clearInterval します。
let intervalId = null;

// 記録したラップの経過時間（ミリ秒）を、古い順に入れます。
const laps = [];

/**
 * 計測の状態です。次の2つの文字列のどれかだけを入れます。
 *   "stopped"  止まっている。スタートできる
 *   "running"  計測中。ストップとラップができる
 */
let watchState = "stopped";

const lapCountDisplay = createScoreDisplay(scoreArea, "ラップ", 0);

/**
 * 数を2桁の文字列にします。9 は "09"、12 はそのまま "12" です。
 */
function pad2(number) {
  if (number < 10) {
    return "0" + number;
  }

  return String(number);
}

/**
 * ミリ秒を「分:秒.1/100秒」の文字列にします。
 * 例: 1234 → "00:01.23"（1秒と 23/100秒）
 * 画面にはミリ秒のうち、下2桁（1/100秒）だけを出します。
 */
function formatTime(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);

  return pad2(minutes) + ":" + pad2(seconds) + "." + pad2(centiseconds);
}

/**
 * いま画面に出すべき経過時間（ミリ秒）を返します。
 * 止まっているときは確定済みの時間だけです。
 * 計測中は、確定済みに「スタートしてからの差」を足します。
 */
function getElapsedMs() {
  if (watchState !== "running") {
    return elapsedMs;
  }

  return elapsedMs + (performance.now() - runningStartedAt);
}

/**
 * 大きな時間表示を、いまの経過時間で書き換えます。
 */
function renderTime() {
  timeElement.textContent = formatTime(getElapsedMs());
}

/**
 * 状態に合わせて、押してよいボタンだけを有効にします。
 * disabled にすると、クリックしてもイベントは起きません。
 */
function updateButtons() {
  const running = watchState === "running";
  const hasProgress = elapsedMs > 0 || laps.length > 0;

  startButton.disabled = running;
  stopButton.disabled = !running;
  lapButton.disabled = !running;
  resetButton.disabled = running ? false : !hasProgress;
}

/**
 * ラップ一覧を描き直します。新しい記録が上に来ます。
 * 1件もなければ一覧ごと隠します。
 */
function renderLaps() {
  lapList.replaceChildren();

  if (laps.length === 0) {
    lapList.hidden = true;
    return;
  }

  for (let i = laps.length - 1; i >= 0; i -= 1) {
    const item = document.createElement("li");

    const label = document.createElement("span");
    label.className = "lap-label";
    label.textContent = "ラップ " + (i + 1);

    const value = document.createElement("span");
    value.textContent = formatTime(laps[i]);

    item.append(label, value);
    lapList.appendChild(item);
  }

  lapList.hidden = false;
}

/**
 * 計測を始めます。すでに動いていれば何もしません。
 * 止めたあとに押すと、0 からではなく続きから測ります。
 */
function startWatch() {
  if (watchState === "running") {
    return;
  }

  runningStartedAt = performance.now();
  watchState = "running";

  // すでに動いていたら二重にしない
  if (intervalId !== null) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(renderTime, TICK_MS);
  renderTime();
  clearMessage(messageElement);
  updateButtons();
}

/**
 * 計測を止めます。止まっているあいだに増えた分を elapsedMs に確定します。
 */
function stopWatch() {
  if (watchState !== "running") {
    return;
  }

  elapsedMs = getElapsedMs();
  watchState = "stopped";

  clearInterval(intervalId);
  intervalId = null;

  renderTime();
  showMessage(messageElement, "一時停止中です。スタートで続きから測れます。", "info");
  updateButtons();
}

/**
 * いまの経過時間をラップとして残します。計測中だけ記録します。
 */
function recordLap() {
  if (watchState !== "running") {
    return;
  }

  laps.push(getElapsedMs());
  updateScore(lapCountDisplay, laps.length);
  renderLaps();
}

/**
 * 時間とラップを最初に戻します。計測中ならタイマーも止めます。
 */
function resetWatch() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }

  elapsedMs = 0;
  runningStartedAt = 0;
  watchState = "stopped";
  laps.length = 0;

  renderTime();
  updateScore(lapCountDisplay, 0);
  renderLaps();
  clearMessage(messageElement);
  updateButtons();
}

const resetButton = createRestartButton(resetArea, resetWatch, "リセット");

startButton.addEventListener("click", startWatch);
stopButton.addEventListener("click", stopWatch);
lapButton.addEventListener("click", recordLap);

updateButtons();
