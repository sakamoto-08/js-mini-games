/**
 * script.js
 * 神経衰弱の本体です。
 *
 * 流れ:
 *   1. 絵柄を2枚ずつにして、並びをシャッフルする
 *   2. 16枚をすべて裏向きで盤面に置く
 *   3. クリックで1枚表にする。2枚目が同じ絵柄なら残す
 *   4. 違う絵柄なら、少し待ってから2枚とも裏に戻す
 *   5. すべてのペアが揃ったらクリア。「もう一度」でシャッフルし直す
 *
 * カードの中身は配列で持ちます。
 * 手数・ペア数・結果メッセージ・もう一度ボタンは common.js の関数を使います。
 *
 * 裏に戻す待ち時間は createTimer ではなく setTimeout です。
 * createTimer は 1 秒ごとに増えていくタイマーです。
 * ここでは「800ミリ秒後に1回だけ裏に戻す」ので、一度きりの setTimeout が合います。
 */

// ペアにする絵柄です。1つ足すと、その絵柄のカードが2枚増えます。
const SYMBOLS = ["🍎", "🍋", "🍇", "🍉", "🍒", "🥝", "🍑", "🍓"];

// 違う絵柄だったとき、裏に戻すまでの時間（ミリ秒）。
const FLIP_BACK_MS = 800;

const scoreArea = document.getElementById("score-area");
const recordArea = document.getElementById("record-area");
const board = document.getElementById("board");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// いま盤面にあるカード。シャッフルのたびに作り直します。
let cards = [];

// 1手目・2手目にめくったカードの位置。めくっていなければ null。
let firstIndex = null;
let secondIndex = null;

// true のあいだは、裏に戻るのを待っているので新しいカードをめくれません。
let locked = false;

// 裏に戻す予約。もう一度押したときに clearTimeout します。
let flipBackTimeoutId = null;

// 2枚めくるたびに 1 増える手数です。
let moves = 0;

// 揃ったペアの数です。SYMBOLS の数と等しくなったらクリアです。
let pairs = 0;

// クリアしたときの最少手数。ページを再読み込みするまで残します。
// まだクリアしていなければ null で、「—」と表示します。
let bestMoves = null;

/**
 * ゲームの状態です。次の2つの文字列のどれかだけを入れます。
 *   "playing"   カードをめくれる
 *   "finished"  すべてのペアが揃った
 */
let gameState = "playing";

const movesDisplay = createScoreDisplay(scoreArea, "手数", 0);
const pairsDisplay = createScoreDisplay(scoreArea, "そろったペア", 0);
const bestDisplay = createScoreDisplay(recordArea, "最少手数", "—");

/**
 * 配列の並びをランダムに入れ替えます（フィッシャー・イェーツのシャッフル）。
 * うしろから順に、自分より前（自分を含む）のどれかと交換します。
 * getRandomInt は両端を含むので、0 も i も選ばれます。
 */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(0, i);
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }

  return list;
}

/**
 * 絵柄を2枚ずつにした配列を作り、シャッフルして返します。
 * pairId が同じカードどうしがペアです。
 */
function createDeck() {
  const deck = [];

  for (let i = 0; i < SYMBOLS.length; i += 1) {
    deck.push({ symbol: SYMBOLS[i], pairId: i });
    deck.push({ symbol: SYMBOLS[i], pairId: i });
  }

  return shuffle(deck);
}

/**
 * 1枚のボタンを作り、盤面に追加します。
 * 絵文字は最初から入っていますが、CSS で裏向きのあいだは隠します。
 */
function createCardButton(card, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card";
  button.setAttribute("aria-label", "裏のカード");

  const face = document.createElement("span");
  face.className = "card-face";
  face.textContent = card.symbol;
  face.setAttribute("aria-hidden", "true");
  button.appendChild(face);

  button.addEventListener("click", function () {
    flipCard(index);
  });

  card.element = button;
  board.appendChild(button);
}

/**
 * カードを表か裏にします。クラスを付け外しするだけで見た目が変わります。
 */
function setFaceUp(card, isUp) {
  card.faceUp = isUp;
  card.element.classList.toggle("is-up", isUp);

  if (card.matched) {
    card.element.setAttribute("aria-label", "揃ったカード");
    return;
  }

  if (isUp) {
    card.element.setAttribute("aria-label", "表のカード");
    return;
  }

  card.element.setAttribute("aria-label", "裏のカード");
}

/**
 * 2枚が同じ絵柄だったときの処理です。
 * 表のまま残し、ペア数を増やします。全部揃ったらクリアにします。
 */
function markMatch(first, second) {
  first.matched = true;
  second.matched = true;
  first.element.classList.add("is-matched");
  second.element.classList.add("is-matched");
  first.element.disabled = true;
  second.element.disabled = true;
  setFaceUp(first, true);
  setFaceUp(second, true);

  pairs += 1;
  updateScore(pairsDisplay, pairs);
  firstIndex = null;
  secondIndex = null;

  if (pairs === SYMBOLS.length) {
    finishGame();
  }
}

/**
 * 2枚の絵柄が違ったときの処理です。
 * すぐ裏に戻すと見えないので、少し待ってから戻します。
 * 待っているあいだは locked にして、3枚目をめくれないようにします。
 */
function scheduleFlipBack(first, second) {
  locked = true;

  flipBackTimeoutId = setTimeout(function () {
    setFaceUp(first, false);
    setFaceUp(second, false);
    firstIndex = null;
    secondIndex = null;
    locked = false;
    flipBackTimeoutId = null;
  }, FLIP_BACK_MS);
}

/**
 * カードがクリックされたときの処理です。
 * プレイ中でない、裏待ち、すでに表、揃い済み、のときは何もしません。
 */
function flipCard(index) {
  if (gameState !== "playing" || locked) {
    return;
  }

  const card = cards[index];

  if (card.matched || card.faceUp) {
    return;
  }

  setFaceUp(card, true);

  // 1枚目。まだ手数は増やしません。2枚めくって1手です。
  if (firstIndex === null) {
    firstIndex = index;
    return;
  }

  secondIndex = index;
  moves += 1;
  updateScore(movesDisplay, moves);

  const first = cards[firstIndex];
  const second = cards[secondIndex];

  if (first.pairId === second.pairId) {
    markMatch(first, second);
    return;
  }

  scheduleFlipBack(first, second);
}

/**
 * すべてのペアが揃ったときの処理です。
 * 手数は少ないほど良いので、これまでの最少より小さいときだけ記録を更新します。
 */
function finishGame() {
  gameState = "finished";

  const isRecord = bestMoves === null || moves < bestMoves;

  if (isRecord) {
    bestMoves = moves;
    updateScore(bestDisplay, bestMoves);
    showMessage(messageElement, moves + "手で揃えました。最少手数です！", "success");
    return;
  }

  showMessage(
    messageElement,
    moves + "手で揃えました。最少手数は" + bestMoves + "手です。",
    "info"
  );
}

/**
 * 盤面を最初から作り直します。
 * 手数とペア数は 0 に戻し、最少手数だけ残します。
 */
function startGame() {
  if (flipBackTimeoutId !== null) {
    clearTimeout(flipBackTimeoutId);
    flipBackTimeoutId = null;
  }

  locked = false;
  firstIndex = null;
  secondIndex = null;
  moves = 0;
  pairs = 0;
  gameState = "playing";

  updateScore(movesDisplay, 0);
  updateScore(pairsDisplay, 0);
  clearMessage(messageElement);

  const deck = createDeck();
  cards = [];

  for (let i = 0; i < deck.length; i += 1) {
    cards.push({
      symbol: deck[i].symbol,
      pairId: deck[i].pairId,
      faceUp: false,
      matched: false,
      element: null,
    });
  }

  // 前のカードを消してから、新しい並びを描きます。
  board.replaceChildren();

  for (let i = 0; i < cards.length; i += 1) {
    createCardButton(cards[i], i);
  }
}

createRestartButton(restartArea, startGame, "もう一度");
startGame();
