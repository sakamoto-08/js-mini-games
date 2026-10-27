/**
 * script.js
 * キャッチゲームの本体です。
 *
 * 流れ:
 *   1. 下のバーを、左右キーかマウスで動かす
 *   2. 上からアイテムを落とし、配列 items に足していく
 *   3. 金の丸を取るとスコアが増える。赤い四角を取るとライフが減る
 *   4. 取り逃したものは、画面の下で配列から消す
 *   5. ライフが0、または制限時間が0でゲームオーバー
 *
 * 描画は Canvas、動きは requestAnimationFrame です。
 * 残り時間だけは createTimer（1秒ごと）で数えます。
 * スコア・最高記録・結果メッセージ・もう一度ボタンは common.js を使います。
 * 最高記録は localStorage に残すので、ページを閉じても消えません。
 */

// 盤面の大きさ（ピクセル）です。
const BOARD_WIDTH = 280;
const BOARD_HEIGHT = 360;

// バーの大きさと、1秒あたりに動ける距離です。
const PLAYER_WIDTH = 72;
const PLAYER_HEIGHT = 14;
const PLAYER_BOTTOM = 28;
const PLAYER_SPEED = 280;

// 落ちてくるアイテムです。速度・間隔・悪いものの割合を変えると難しさが変わります。
const ITEM_SIZE = 18;
const FALL_SPEED = 150;
const SPAWN_INTERVAL_MS = 700;
const BAD_PERCENT = 30;

// ルールの数値です。
const POINTS_PER_GOOD = 1;
const START_LIVES = 3;
const TIME_LIMIT = 30;

// 色です。金が得点、赤がダメージ、バーは明るい黄です。
const GOOD_COLOR = "#e7b15a";
const BAD_COLOR = "#f0a396";
const PLAYER_COLOR = "#f3d7a1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// バーの左端です。
let playerX = 0;

// 落ちているアイテムの一覧です。kind は "good" か "bad" です。
let items = [];

// 次のアイテムを出すまでの、たまった時間（ミリ秒）です。
let spawnElapsed = 0;

let score = 0;
let lives = START_LIVES;

// このゲームだけの保存名です。他のゲームの記録と混ざらないようにします。
const HIGH_SCORE_KEY = "js-mini-games-catch-highscore";

// ブラウザに残っている最高記録です。まだ無いときは 0 です。
let highScore = getHighScore(HIGH_SCORE_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。アイテムは落ちてこない
 *   "playing"   プレイ中
 *   "finished"  ライフが0、または時間切れ
 */
let gameState = "ready";

// 左右キーが押されているかです。keyup で false に戻します。
const heldKeys = { left: false, right: false };

// 前回ループが呼ばれた時刻。最初の1回は 0 にして、大きな移動を防ぎます。
let lastFrameTime = 0;

const scoreDisplay = createScoreDisplay(scoreArea, "スコア", 0);
const highScoreDisplay = createScoreDisplay(scoreArea, "最高記録", highScore);
const lifeDisplay = createScoreDisplay(scoreArea, "ライフ", START_LIVES);
const timeDisplay = createScoreDisplay(scoreArea, "残り時間", TIME_LIMIT);

/**
 * 1秒ごとに残り時間を減らします。0になったら時間切れです。
 * elapsedSeconds は、スタートしてから何秒たったかです。
 */
function handleTick(elapsedSeconds) {
  if (gameState !== "playing") {
    return;
  }

  const remaining = TIME_LIMIT - elapsedSeconds;
  updateScore(timeDisplay, remaining);

  if (remaining <= 0) {
    finishGame("time");
  }
}

const timer = createTimer(handleTick);

/**
 * 2つの四角が重なっているかを返します。
 * 縦にも横にも、少しでもかぶっていれば true です。
 */
function rectsOverlap(a, b) {
  const separated =
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y;

  return !separated;
}

/**
 * バーの四角を返します。当たり判定に使います。
 */
function playerRect() {
  return {
    x: playerX,
    y: BOARD_HEIGHT - PLAYER_BOTTOM - PLAYER_HEIGHT,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
  };
}

/**
 * バーが盤面の外に出ないようにします。
 */
function clampPlayer() {
  if (playerX < 0) {
    playerX = 0;
  }

  if (playerX + PLAYER_WIDTH > BOARD_WIDTH) {
    playerX = BOARD_WIDTH - PLAYER_WIDTH;
  }
}

/**
 * アイテムを1つ作り、配列の末尾に足します。
 * 悪いものは BAD_PERCENT % の確率です。getRandomInt は両端を含みます。
 */
function spawnItem() {
  const roll = getRandomInt(1, 100);
  const kind = roll <= BAD_PERCENT ? "bad" : "good";

  items.push({
    x: getRandomInt(0, BOARD_WIDTH - ITEM_SIZE),
    y: -ITEM_SIZE,
    kind: kind,
    caught: false,
  });
}

/**
 * 一定時間ごとにアイテムを出します。
 */
function maybeSpawn(deltaMs) {
  spawnElapsed += deltaMs;

  if (spawnElapsed < SPAWN_INTERVAL_MS) {
    return;
  }

  spawnElapsed -= SPAWN_INTERVAL_MS;
  spawnItem();
}

/**
 * 押されている左右キーの分だけ、バーを動かします。
 */
function movePlayer(dt) {
  if (heldKeys.left) {
    playerX -= PLAYER_SPEED * dt;
  }

  if (heldKeys.right) {
    playerX += PLAYER_SPEED * dt;
  }

  clampPlayer();
}

/**
 * アイテムを下へ動かします。
 */
function moveItems(dt) {
  for (let i = 0; i < items.length; i += 1) {
    items[i].y += FALL_SPEED * dt;
  }
}

/**
 * バーと重なったアイテムをキャッチします。
 * 当たったものは caught にして、あとで配列から除きます。
 */
function resolveCatches() {
  const player = playerRect();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.caught || item.y > BOARD_HEIGHT) {
      continue;
    }

    const itemRect = {
      x: item.x,
      y: item.y,
      w: ITEM_SIZE,
      h: ITEM_SIZE,
    };

    if (!rectsOverlap(player, itemRect)) {
      continue;
    }

    item.caught = true;

    if (item.kind === "good") {
      score += POINTS_PER_GOOD;
      updateScore(scoreDisplay, score);
    } else {
      lives -= 1;
      updateScore(lifeDisplay, lives);
    }
  }

  // 取ったものと、下まで落ちたものを配列から消します。
  items = items.filter(function (item) {
    return !item.caught && item.y <= BOARD_HEIGHT;
  });

  if (lives < 0) {
    lives = 0;
    updateScore(lifeDisplay, lives);
  }

  if (gameState === "playing" && lives <= 0) {
    finishGame("lives");
  }
}

/**
 * キーかマウスで動き始めたら、落下とタイマーを始めます。
 */
function beginPlaying() {
  if (gameState !== "ready") {
    return;
  }

  gameState = "playing";
  clearMessage(messageElement);
  timer.start();
}

/**
 * ライフが0、または時間切れにします。
 * reason は "lives" か "time" です。
 * 得点が最高より大きいときだけ、localStorage に保存します。
 */
function finishGame(reason) {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  timer.stop();
  heldKeys.left = false;
  heldKeys.right = false;

  const isRecord = score > highScore;

  if (isRecord) {
    highScore = updateHighScore(HIGH_SCORE_KEY, score);
    updateScore(highScoreDisplay, highScore);
  }

  if (reason === "time" && isRecord) {
    showMessage(messageElement, "時間切れです。" + score + "点で最高記録です！", "success");
  } else if (reason === "time") {
    showMessage(
      messageElement,
      "時間切れです。" + score + "点でした。最高記録は" + highScore + "点です。",
      "info"
    );
  } else if (isRecord) {
    showMessage(messageElement, score + "点でゲームオーバー。最高記録です！", "success");
  } else if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。ライフが0になりました。", "error");
  } else {
    showMessage(
      messageElement,
      score + "点でゲームオーバー。最高記録は" + highScore + "点です。",
      "info"
    );
  }

  restartArea.hidden = false;
}

/**
 * バー・アイテム・得点・時間を最初に戻します。最高記録は残します。
 */
function restartGame() {
  playerX = (BOARD_WIDTH - PLAYER_WIDTH) / 2;
  items = [];
  spawnElapsed = 0;
  score = 0;
  lives = START_LIVES;
  gameState = "ready";
  heldKeys.left = false;
  heldKeys.right = false;

  timer.reset();
  updateScore(scoreDisplay, 0);
  updateScore(lifeDisplay, START_LIVES);
  updateScore(timeDisplay, TIME_LIMIT);
  draw();
  showMessage(messageElement, "左右キーかマウスで動かします。金の丸をキャッチしてください。", "info");
  restartArea.hidden = true;
}

/**
 * 背景を消してから、アイテムとバーを描きます。
 * 当たり判定はどちらも四角です。金の丸だけ、見た目を円にしています。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.kind === "good") {
      ctx.fillStyle = GOOD_COLOR;
      ctx.beginPath();
      ctx.arc(
        item.x + ITEM_SIZE / 2,
        item.y + ITEM_SIZE / 2,
        ITEM_SIZE / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else {
      ctx.fillStyle = BAD_COLOR;
      ctx.fillRect(item.x, item.y, ITEM_SIZE, ITEM_SIZE);
    }
  }

  const player = playerRect();
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(player.x, player.y, player.w, player.h);
}

/**
 * マウスやタッチの位置を、盤面の中のX座標に直します。
 * 表示サイズとCanvasの本当の幅が違っても、ずれないように比率を掛けます。
 */
function pointerToBoardX(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return (event.clientX - rect.left) * scale;
}

/**
 * ポインタの位置へバーを動かします。
 */
function movePlayerToPointer(event) {
  if (gameState === "finished") {
    return;
  }

  playerX = pointerToBoardX(event) - PLAYER_WIDTH / 2;
  clampPlayer();
  beginPlaying();
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    event.preventDefault();
    heldKeys.left = true;
    beginPlaying();
    return;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    event.preventDefault();
    heldKeys.right = true;
    beginPlaying();
  }
}

function onKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    heldKeys.left = false;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    heldKeys.right = false;
  }
}

/**
 * 画面の更新ループです。自分を requestAnimationFrame で予約します。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (lastFrameTime === 0) {
    lastFrameTime = now;
    draw();
    return;
  }

  // タブを放置したあとに、一気に進みすぎないよう 32 ミリ秒で頭打ちにします。
  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;
  const dt = deltaMs / 1000;

  if (gameState === "ready" || gameState === "playing") {
    movePlayer(dt);
  }

  if (gameState === "playing") {
    maybeSpawn(deltaMs);
    moveItems(dt);
    resolveCatches();
  }

  draw();
}

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", function () {
  heldKeys.left = false;
  heldKeys.right = false;
});
canvas.addEventListener("pointerdown", movePlayerToPointer);
canvas.addEventListener("pointermove", movePlayerToPointer);
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
