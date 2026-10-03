/**
 * script.js
 * 数当てゲームの本体です。
 *
 * 流れ:
 *   1. 1〜100 の正解を決める
 *   2. 入力された数字と比べる
 *   3. 大きい / 小さい をヒントとして出す
 *   4. 当たったらメッセージを出し、もう一度遊べるようにする
 *
 * スコア表示・メッセージ・乱数・リスタートボタンは common.js の関数を使います。
 */

// 出題する範囲。定数なので、ゲーム中に書き換えません。
const MIN_NUMBER = 1;
const MAX_NUMBER = 100;

// HTML にある要素を、あとから何度も使うので先に取っておく
const scoreArea = document.getElementById("score-area");
const form = document.getElementById("guess-form");
const input = document.getElementById("guess-input");
const submitButton = form.querySelector("button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// ゲームの状態。プレイ中に変わるので let を使います。
let answer = 0;
let attempts = 0;
let isFinished = false;

// 「試行回数 0」の表示を作る。戻り値は数字部分の要素。
const attemptsDisplay = createScoreDisplay(scoreArea, "試行回数", 0);

/**
 * ゲームを初期状態に戻します。
 * ページを開いたときと、「もう一度遊ぶ」を押したときの両方から呼びます。
 */
function startGame() {
  answer = getRandomInt(MIN_NUMBER, MAX_NUMBER);
  // 正解は画面に出さない。確認したいときは次の行のコメントを外す。
  // console.log(answer);
  attempts = 0;
  isFinished = false;

  updateScore(attemptsDisplay, attempts);
  clearMessage(messageElement);

  input.disabled = false;
  submitButton.disabled = false;
  input.value = "";
  restartArea.hidden = true;
  input.focus();
}

/**
 * 「答える」が押されたときの処理です。
 * form の submit なので、Enter キーでも動きます。
 */
function handleGuess(event) {
  // ページの再読み込み（フォームの標準動作）を止める
  event.preventDefault();

  if (isFinished) {
    return;
  }

  const guess = Number(input.value);

  // HTML の required に加えて、JS 側でも範囲を確認する
  if (!Number.isInteger(guess) || guess < MIN_NUMBER || guess > MAX_NUMBER) {
    showMessage(
      messageElement,
      MIN_NUMBER + "〜" + MAX_NUMBER + " の整数を入力してください。",
      "error"
    );
    return;
  }

  attempts += 1;
  updateScore(attemptsDisplay, attempts);

  if (guess === answer) {
    isFinished = true;
    showMessage(
      messageElement,
      "正解！ " + answer + " です。" + attempts + " 回で当たりました。",
      "success"
    );
    input.disabled = true;
    submitButton.disabled = true;
    restartArea.hidden = false;
    return;
  }

  // 正解そのものは言わず、どちらへ直せばよいかだけ伝える
  if (guess < answer) {
    showMessage(messageElement, guess + " より大きいです。", "info");
  } else {
    showMessage(messageElement, guess + " より小さいです。", "info");
  }

  // 次の入力をしやすくするため、入っている数字を選択状態にする
  input.select();
}

form.addEventListener("submit", handleGuess);

// ボタンは1回だけ作る。押されたら startGame でやり直す。
createRestartButton(restartArea, startGame);

startGame();
