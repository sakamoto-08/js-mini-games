/**
 * script.js
 * じゃんけんの本体です。
 *
 * 流れ:
 *   1. プレイヤーがボタンで手を選ぶ
 *   2. コンピュータが配列の中から手を1つ選ぶ
 *   3. 勝敗ルールのオブジェクトで勝ち・負け・あいこを決める
 *   4. スコアとメッセージを更新する
 *   5. リセットでスコアを 0 に戻す
 *
 * 乱数・スコア表示・メッセージ・リセットボタンは common.js の関数を使います。
 */

// 出せる手。並び順はこの配列が決めるので、ボタンもここから作ります。
const HANDS = ["グー", "チョキ", "パー"];

/**
 * 勝敗ルールです。
 * 「自分の手: その手が勝つ相手」という形のオブジェクトです。
 * 例: グーはチョキに勝つ、チョキはパーに勝つ、パーはグーに勝つ。
 */
const WIN_AGAINST = {
  グー: "チョキ",
  チョキ: "パー",
  パー: "グー",
};

// HTML にある要素を、あとから何度も使うので先に取っておく
const scoreArea = document.getElementById("score-area");
const handList = document.getElementById("hand-list");
const resultBoard = document.getElementById("result-board");
const playerHandElement = document.getElementById("player-hand");
const computerHandElement = document.getElementById("computer-hand");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// 勝ち・負け・あいこの回数。プレイ中に増えるので let ではなく、
// 中身を書き換えるオブジェクトにまとめています。
const scores = {
  win: 0,
  lose: 0,
  draw: 0,
};

// 数字の表示部分。updateScore に渡すために取っておきます。
const winDisplay = createScoreDisplay(scoreArea, "勝ち", 0);
const loseDisplay = createScoreDisplay(scoreArea, "負け", 0);
const drawDisplay = createScoreDisplay(scoreArea, "あいこ", 0);

/**
 * コンピュータの手を1つ返します。
 * getRandomInt(0, 2) は 0, 1, 2 のどれかなので、
 * それを配列の位置（インデックス）として使います。
 */
function pickComputerHand() {
  const index = getRandomInt(0, HANDS.length - 1);
  return HANDS[index];
}

/**
 * プレイヤーとコンピュータの手から、結果を返します。
 * 戻り値は "win" / "lose" / "draw" のどれかです。
 */
function judge(playerHand, computerHand) {
  if (playerHand === computerHand) {
    return "draw";
  }

  // プレイヤーの手が勝つ相手と、コンピュータの手が同じなら勝ち
  if (WIN_AGAINST[playerHand] === computerHand) {
    return "win";
  }

  return "lose";
}

/**
 * 結果に対応するメッセージ文を作ります。
 * 画面に出す処理とは分けて、文章の中身だけを担当します。
 */
function buildMessage(result, playerHand, computerHand) {
  if (result === "draw") {
    return "あいこです。お互い" + playerHand + "でした。";
  }

  if (result === "win") {
    return "勝ち！ " + playerHand + "は" + computerHand + "に勝ちます。";
  }

  return "負け… " + playerHand + "は" + computerHand + "に負けます。";
}

/**
 * 勝敗に応じて、共通関数の色分け（success / error / info）を選びます。
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
 * 選んだ結果に合わせて、対応するスコアを 1 増やします。
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
 * あなたとコンピュータの手を、画面の対戦欄に出します。
 */
function showHands(playerHand, computerHand) {
  playerHandElement.textContent = playerHand;
  computerHandElement.textContent = computerHand;
  resultBoard.hidden = false;
}

/**
 * いま押したボタンだけ枠の色を変えます。
 */
function markSelectedHand(playerHand) {
  const buttons = handList.querySelectorAll("button");

  for (let index = 0; index < buttons.length; index++) {
    const button = buttons[index];
    if (button.textContent === playerHand) {
      button.classList.add("is-selected");
    } else {
      button.classList.remove("is-selected");
    }
  }
}

/**
 * 手を1回出す処理です。ボタンのクリックから呼ばれます。
 */
function playRound(playerHand) {
  const computerHand = pickComputerHand();
  const result = judge(playerHand, computerHand);

  showHands(playerHand, computerHand);
  markSelectedHand(playerHand);
  addScore(result);
  showMessage(
    messageElement,
    buildMessage(result, playerHand, computerHand),
    messageTypeFor(result)
  );
}

/**
 * スコアと表示を、ページを開いた直後の状態に戻します。
 */
function resetScores() {
  scores.win = 0;
  scores.lose = 0;
  scores.draw = 0;

  updateScore(winDisplay, 0);
  updateScore(loseDisplay, 0);
  updateScore(drawDisplay, 0);

  clearMessage(messageElement);
  resultBoard.hidden = true;
  playerHandElement.textContent = "";
  computerHandElement.textContent = "";
  markSelectedHand("");
}

// HANDS の中身の数だけボタンを作る。配列を直せば、ボタンも一緒に変わります。
for (let index = 0; index < HANDS.length; index++) {
  const hand = HANDS[index];
  const button = document.createElement("button");

  button.type = "button";
  button.className = "btn hand-btn";
  button.textContent = hand;
  button.addEventListener("click", function () {
    playRound(hand);
  });

  handList.appendChild(button);
}

// ボタンは1回だけ作る。押されたらスコアを 0 に戻す。
createRestartButton(restartArea, resetScores, "リセット");
