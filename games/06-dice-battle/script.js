/**
 * script.js
 * サイコロ勝負の本体です。
 *
 * 流れ:
 *   1. 「サイコロを振る」で、あなたとコンピュータの出目を決める
 *   2. 大きい方が勝ち。同じならあいこ
 *   3. 勝ち・負け・あいこの回数を更新する
 *   4. 「リセット」で回数と出目を最初に戻す
 *
 * 出目の乱数、スコア表示、メッセージ、リセットボタンは common.js の関数を使います。
 */

// サイコロの最小と最大。getRandomInt は両端を含むので、1 も 6 も出ます。
const MIN_FACE = 1;
const MAX_FACE = 6;

/**
 * 出目ごとの「どの位置の点を付けるか」です。
 * サイコロは 3×3 のマスで、番号は次の並びです。
 *   0 1 2
 *   3 4 5
 *   6 7 8
 * 配列の 0 番は使わず、1〜6 番を出目と揃えています。
 */
const PIP_LAYOUTS = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

const scoreArea = document.getElementById("score-area");
const playerDie = document.getElementById("player-die");
const computerDie = document.getElementById("computer-die");
const playerValue = document.getElementById("player-value");
const computerValue = document.getElementById("computer-value");
const rollButton = document.getElementById("roll-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// 勝ち・負け・あいこの回数。中身だけを書き換えて保持します。
const scores = {
  win: 0,
  lose: 0,
  draw: 0,
};

const winDisplay = createScoreDisplay(scoreArea, "勝ち", 0);
const loseDisplay = createScoreDisplay(scoreArea, "負け", 0);
const drawDisplay = createScoreDisplay(scoreArea, "あいこ", 0);

/**
 * サイコロの中に、点の置き場を 9 個作ります。
 */
function createPips(dieElement) {
  for (let position = 0; position < 9; position++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    dieElement.appendChild(pip);
  }
}

/**
 * その出目で、この位置に点を付けるかを返します。
 */
function isPipOn(face, position) {
  const positions = PIP_LAYOUTS[face];

  for (let index = 0; index < positions.length; index++) {
    if (positions[index] === position) {
      return true;
    }
  }

  return false;
}

/**
 * 1〜6 の出目を 1 つ返します。
 */
function rollDie() {
  return getRandomInt(MIN_FACE, MAX_FACE);
}

/**
 * 出目を、サイコロの点と下の数字の両方に反映します。
 */
function showFace(dieElement, valueElement, face) {
  const pips = dieElement.querySelectorAll(".pip");

  for (let position = 0; position < pips.length; position++) {
    if (isPipOn(face, position)) {
      pips[position].classList.add("on");
    } else {
      pips[position].classList.remove("on");
    }
  }

  valueElement.textContent = String(face);
  dieElement.setAttribute("aria-label", face + "の目");
}

/**
 * 振る前の見た目に戻します。
 */
function clearFace(dieElement, valueElement) {
  const pips = dieElement.querySelectorAll(".pip");

  for (let position = 0; position < pips.length; position++) {
    pips[position].classList.remove("on");
  }

  valueElement.textContent = "—";
  dieElement.setAttribute("aria-label", "未定");
}

/**
 * 出目を比べて、"win" / "lose" / "draw" のどれかを返します。
 * 大きい方が勝ちです。
 */
function judge(playerFace, computerFace) {
  if (playerFace === computerFace) {
    return "draw";
  }

  if (playerFace > computerFace) {
    return "win";
  }

  return "lose";
}

/**
 * 結果の文章を作ります。
 */
function buildMessage(result, playerFace, computerFace) {
  if (result === "draw") {
    return "あいこです。お互い " + playerFace + " でした。";
  }

  if (result === "win") {
    return "勝ち！ " + playerFace + " 対 " + computerFace + " です。";
  }

  return "負け… " + playerFace + " 対 " + computerFace + " です。";
}

/**
 * 勝敗に応じて、共通関数の色分けを選びます。
 */
function messageTypeFor(result) {
  if (result === "win") {
    return "success";
  }

  if (result === "lose") {
    return "error";
  }

  return "info";
}

/**
 * 対応するスコアを 1 増やします。
 */
function addScore(result) {
  if (result === "win") {
    scores.win += 1;
    updateScore(winDisplay, scores.win);
    return;
  }

  if (result === "lose") {
    scores.lose += 1;
    updateScore(loseDisplay, scores.lose);
    return;
  }

  scores.draw += 1;
  updateScore(drawDisplay, scores.draw);
}

/**
 * 1回分の勝負です。ボタンを押すたびに呼ばれます。
 */
function playRound() {
  const playerFace = rollDie();
  const computerFace = rollDie();
  const result = judge(playerFace, computerFace);

  showFace(playerDie, playerValue, playerFace);
  showFace(computerDie, computerValue, computerFace);
  addScore(result);
  showMessage(
    messageElement,
    buildMessage(result, playerFace, computerFace),
    messageTypeFor(result)
  );
}

/**
 * スコアと出目を、ページを開いた直後の状態に戻します。
 */
function resetScores() {
  scores.win = 0;
  scores.lose = 0;
  scores.draw = 0;

  updateScore(winDisplay, 0);
  updateScore(loseDisplay, 0);
  updateScore(drawDisplay, 0);

  clearFace(playerDie, playerValue);
  clearFace(computerDie, computerValue);
  clearMessage(messageElement);
}

createPips(playerDie);
createPips(computerDie);

rollButton.addEventListener("click", playRound);
createRestartButton(restartArea, resetScores, "リセット");
