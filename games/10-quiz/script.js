/**
 * script.js
 * 4択クイズの本体です。
 *
 * 流れ:
 *   1. QUESTIONS から、いまの番号の問題を1問出す
 *   2. 選択肢を押したら、すぐに正解か不正解かを判定する
 *   3. 正解のボタンを緑、選んだ間違いを赤にし、解説を出す
 *   4. 「次の問題へ」で次の番号へ進む
 *   5. 最後まで終わったら、正解数と正答率を出す
 *
 * 問題は配列です。中身は1問ずつオブジェクトです。
 * 正解数・解説メッセージ・もう一度ボタンは common.js の関数を使います。
 */

/**
 * 問題の一覧です。うしろにオブジェクトを足すと、問題が増えます。
 * correctIndex は choices の番号です。配列と同じく、最初は 0 です。
 */
const QUESTIONS = [
  {
    question: "配列の最初の要素の番号は？",
    choices: ["0", "1", "2", "10"],
    correctIndex: 0,
    explanation: "配列は 0 から数えます。最初の要素は 0 番です。",
  },
  {
    question: "1時間は何分？",
    choices: ["30分", "60分", "90分", "100分"],
    correctIndex: 1,
    explanation: "1時間は 60 分です。",
  },
  {
    question: "日本の首都は？",
    choices: ["大阪", "京都", "東京", "名古屋"],
    correctIndex: 2,
    explanation: "日本の首都は東京です。",
  },
  {
    question: "三角形の内角の和は？",
    choices: ["90度", "180度", "270度", "360度"],
    correctIndex: 1,
    explanation: "三角形の内側の角を足すと 180 度になります。",
  },
  {
    question: "HTMLで一番大きい見出しは？",
    choices: ["p", "h6", "h2", "h1"],
    correctIndex: 3,
    explanation: "h1 が最も大きい見出しです。数字が大きいほど小さくなります。",
  },
  {
    question: "CSSで文字の色を指定するプロパティは？",
    choices: ["color", "font", "text", "paint"],
    correctIndex: 0,
    explanation: "color で文字の色を指定します。",
  },
  {
    question: "JavaScriptで「等しい」を調べる演算子は？",
    choices: ["+", "===", "//", "&&"],
    correctIndex: 1,
    explanation: "=== は、値と型の両方が等しいときに true になります。",
  },
  {
    question: "ふつうの1年は何日？",
    choices: ["360日", "364日", "365日", "366日"],
    correctIndex: 2,
    explanation: "ふつうの年は 365 日です。うるう年は 366 日です。",
  },
  {
    question: "HTMLで本文を書く要素は？",
    choices: ["head", "title", "body", "script"],
    correctIndex: 2,
    explanation: "画面に出る本文は body の中に書きます。",
  },
  {
    question: "光の三原色に入らない色は？",
    choices: ["赤", "緑", "青", "黄"],
    correctIndex: 3,
    explanation: "光の三原色は赤・緑・青です。黄は絵の具の三原色に入ります。",
  },
];

const scoreArea = document.getElementById("score-area");
const questionElement = document.getElementById("question");
const choicesElement = document.getElementById("choices");
const nextButton = document.getElementById("next-button");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// いま出している問題の番号。最初の問題は 0 です。
let currentIndex = 0;

// 正解した数です。
let correctCount = 0;

/**
 * クイズの状態です。次の3つの文字列のどれかだけを入れます。
 *   "answering"  選択肢を選べる
 *   "revealed"   正解と解説を出している。次へ進める
 *   "finished"   全問終わった
 */
let quizState = "answering";

const correctDisplay = createScoreDisplay(scoreArea, "正解", 0);
const progressDisplay = createScoreDisplay(scoreArea, "問題", "1 / " + QUESTIONS.length);

/**
 * いまの番号の問題オブジェクトを返します。
 */
function getCurrentQuestion() {
  return QUESTIONS[currentIndex];
}

/**
 * 選択肢のボタンを、いまの問題の配列から作り直します。
 */
function renderChoices() {
  const question = getCurrentQuestion();
  choicesElement.replaceChildren();

  for (let i = 0; i < question.choices.length; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = question.choices[i];

    // i を引数に固定して、押した番号がずれないようにします。
    button.addEventListener("click", function () {
      answer(i);
    });

    choicesElement.appendChild(button);
  }
}

/**
 * いまの問題を画面に出します。解説と「次へ」は隠します。
 */
function showQuestion() {
  const question = getCurrentQuestion();
  quizState = "answering";

  questionElement.textContent = question.question;
  updateScore(progressDisplay, currentIndex + 1 + " / " + QUESTIONS.length);
  renderChoices();

  choicesElement.hidden = false;
  nextButton.hidden = true;
  clearMessage(messageElement);
}

/**
 * 選んだ番号を判定します。回答済みのときは何もしません。
 * 正解のボタンは緑、選んだ間違いだけ赤にします。
 */
function answer(choiceIndex) {
  if (quizState !== "answering") {
    return;
  }

  const question = getCurrentQuestion();
  const buttons = choicesElement.querySelectorAll(".choice");
  const isCorrect = choiceIndex === question.correctIndex;

  quizState = "revealed";

  for (let i = 0; i < buttons.length; i += 1) {
    buttons[i].disabled = true;

    if (i === question.correctIndex) {
      buttons[i].classList.add("is-correct");
    }
  }

  if (isCorrect) {
    correctCount += 1;
    updateScore(correctDisplay, correctCount);
    showMessage(messageElement, "正解です。" + question.explanation, "success");
  } else {
    buttons[choiceIndex].classList.add("is-wrong");
    showMessage(
      messageElement,
      "不正解です。正解は「" + question.choices[question.correctIndex] + "」です。" + question.explanation,
      "error"
    );
  }

  const isLast = currentIndex === QUESTIONS.length - 1;
  nextButton.textContent = isLast ? "結果を見る" : "次の問題へ";
  nextButton.hidden = false;
}

/**
 * 正答率（パーセント）を四捨五入して返します。
 */
function getAccuracy() {
  return Math.round((correctCount / QUESTIONS.length) * 100);
}

/**
 * 全問終わったあとの結果です。
 */
function finishQuiz() {
  quizState = "finished";
  const accuracy = getAccuracy();

  questionElement.textContent = "全問おわりました。";
  choicesElement.hidden = true;
  nextButton.hidden = true;

  const text =
    QUESTIONS.length +
    "問中" +
    correctCount +
    "問正解しました。正答率は" +
    accuracy +
    "%です。";

  if (correctCount === QUESTIONS.length) {
    showMessage(messageElement, text, "success");
  } else {
    showMessage(messageElement, text, "info");
  }

  restartArea.hidden = false;
}

/**
 * 「次の問題へ」または「結果を見る」が押されたときです。
 */
function goNext() {
  if (quizState !== "revealed") {
    return;
  }

  if (currentIndex === QUESTIONS.length - 1) {
    finishQuiz();
    return;
  }

  currentIndex += 1;
  showQuestion();
}

/**
 * 正解数と問題番号を最初に戻して、1問目からやり直します。
 */
function restartQuiz() {
  currentIndex = 0;
  correctCount = 0;
  updateScore(correctDisplay, 0);
  restartArea.hidden = true;
  showQuestion();
}

nextButton.addEventListener("click", goNext);
createRestartButton(restartArea, restartQuiz, "もう一度");
showQuestion();
