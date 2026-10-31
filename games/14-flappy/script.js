/**
 * script.js
 * フラッピーバード（簡易版）の本体です。
 *
 * 流れ:
 *   1. キャラクターは重力で下へ落ちる
 *   2. スペースかクリックで、上向きの速度を入れる（ジャンプ）
 *   3. パイプは右から左へ流れる
 *   4. 隙間をくぐり終えるとスコアが 1 増える
 *   5. パイプ、地面、天井に当たるとゲームオーバー
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * ポンと同じく、前回からの秒数を速度に掛けて動かします。
 * スコア・最高記録・結果メッセージ・もう一度ボタン・隙間の乱数は common.js を使います。
 * 最高記録は localStorage に残すので、ページを閉じても消えません。
 */

// 盤面の大きさ（ピクセル）です。縦長にしています。
const BOARD_WIDTH = 260;
const BOARD_HEIGHT = 360;

// キャラクターの四角です。横位置は固定で、縦だけ動きます。
const BIRD_X = 56;
const BIRD_SIZE = 22;

// 重力（1秒あたりに下向き速度が増える量）と、ジャンプした瞬間の上向き速度です。
// 速度のプラスは下、マイナスは上です。
const GRAVITY = 1100;
const JUMP_VELOCITY = -380;

// 落ちる速さの上限です。これ以上は加速しません。
const MAX_FALL_SPEED = 460;

// パイプの見た目と流れです。数字を変えると難しさが変わります。
const PIPE_WIDTH = 46;
const GAP_HEIGHT = 112;
const PIPE_SPEED = 110;
const PIPE_SPACING = 190;
const FIRST_PIPE_X = 180;

// 上下の端です。この帯に触れてもゲームオーバーです。
const CEILING_HEIGHT = 16;
const GROUND_HEIGHT = 28;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// キャラクターの上端と、1秒あたりの縦速度です。
let birdY = 0;
let birdVy = 0;

// 流れているパイプです。gapY は隙間の中心、passed は得点済みかです。
let pipes = [];

let score = 0;

// このゲームだけの保存名です。他のゲームの記録と混ざらないようにします。
const HIGH_SCORE_KEY = "js-mini-games-flappy-highscore";

// ブラウザに残っている最高記録です。まだ無いときは 0 です。
let highScore = getHighScore(HIGH_SCORE_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。重力もパイプも止める
 *   "playing"   落下とスクロール中
 *   "finished"  ゲームオーバー
 */
let gameState = "ready";

// 前回ループが呼ばれた時刻。最初の1回は 0 にして、大きな移動を防ぎます。
let lastFrameTime = 0;

const scoreDisplay = createScoreDisplay(scoreArea, "スコア", 0);
const highScoreDisplay = createScoreDisplay(scoreArea, "最高記録", highScore);

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
 * キャラクターの当たり判定です。描いている四角と同じ範囲です。
 */
function birdRect() {
  return {
    x: BIRD_X,
    y: birdY,
    w: BIRD_SIZE,
    h: BIRD_SIZE,
  };
}

/**
 * 隙間の中心を、天井と地面にぶつからない範囲でランダムに決めます。
 */
function randomGapY() {
  const min = CEILING_HEIGHT + GAP_HEIGHT / 2;
  const max = BOARD_HEIGHT - GROUND_HEIGHT - GAP_HEIGHT / 2;
  return getRandomInt(min, max);
}

/**
 * 1本のパイプを、上半分と下半分の四角に分けて返します。
 */
function pipeParts(pipe) {
  const gapTop = pipe.gapY - GAP_HEIGHT / 2;
  const gapBottom = pipe.gapY + GAP_HEIGHT / 2;

  return {
    top: {
      x: pipe.x,
      y: 0,
      w: PIPE_WIDTH,
      h: gapTop,
    },
    bottom: {
      x: pipe.x,
      y: gapBottom,
      w: PIPE_WIDTH,
      h: BOARD_HEIGHT - gapBottom,
    },
  };
}

/**
 * 画面の右より手前に、次のパイプが足りなければ足します。
 */
function ensurePipes() {
  if (pipes.length === 0) {
    pipes.push({
      x: FIRST_PIPE_X,
      gapY: randomGapY(),
      passed: false,
    });
  }

  // 右端のパイプが盤面の中に入っていたら、間隔を空けてもう1本足します。
  while (pipes[pipes.length - 1].x < BOARD_WIDTH) {
    pipes.push({
      x: pipes[pipes.length - 1].x + PIPE_SPACING,
      gapY: randomGapY(),
      passed: false,
    });
  }
}

/**
 * パイプを左へ動かし、画面外に出たものは配列から消します。
 */
function movePipes(dt) {
  for (let i = 0; i < pipes.length; i += 1) {
    pipes[i].x -= PIPE_SPEED * dt;
  }

  pipes = pipes.filter(function (pipe) {
    return pipe.x + PIPE_WIDTH > 0;
  });

  ensurePipes();
}

/**
 * 重力で速度を増やしてから、その速度で位置を動かします。
 */
function moveBird(dt) {
  birdVy += GRAVITY * dt;

  if (birdVy > MAX_FALL_SPEED) {
    birdVy = MAX_FALL_SPEED;
  }

  birdY += birdVy * dt;
}

/**
 * パイプ、地面、天井のどれかに触れていれば true です。
 */
function hitObstacle() {
  const bird = birdRect();
  const ceiling = { x: 0, y: 0, w: BOARD_WIDTH, h: CEILING_HEIGHT };
  const ground = {
    x: 0,
    y: BOARD_HEIGHT - GROUND_HEIGHT,
    w: BOARD_WIDTH,
    h: GROUND_HEIGHT,
  };

  if (rectsOverlap(bird, ceiling) || rectsOverlap(bird, ground)) {
    return true;
  }

  for (let i = 0; i < pipes.length; i += 1) {
    const parts = pipeParts(pipes[i]);

    if (rectsOverlap(bird, parts.top) || rectsOverlap(bird, parts.bottom)) {
      return true;
    }
  }

  return false;
}

/**
 * 隙間をくぐり終えたパイプがあれば、スコアを 1 増やします。
 * パイプの右端を、キャラクターの左端が過ぎたときです。
 */
function scorePassedPipes() {
  for (let i = 0; i < pipes.length; i += 1) {
    const pipe = pipes[i];

    if (pipe.passed) {
      continue;
    }

    if (BIRD_X > pipe.x + PIPE_WIDTH) {
      pipe.passed = true;
      score += 1;
      updateScore(scoreDisplay, score);
    }
  }
}

/**
 * 上向きの速度を入れます。待っているときは、ここから試合が始まります。
 * 終わったあとは無視します。
 */
function flap() {
  if (gameState === "finished") {
    return;
  }

  if (gameState === "ready") {
    gameState = "playing";
    clearMessage(messageElement);
  }

  birdVy = JUMP_VELOCITY;
}

/**
 * ゲームオーバーにします。
 * 得点が最高より大きいときだけ、localStorage に保存します。
 */
function finishGame() {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";

  const isRecord = score > highScore;

  if (isRecord) {
    highScore = updateHighScore(HIGH_SCORE_KEY, score);
    updateScore(highScoreDisplay, highScore);
    showMessage(messageElement, score + "点でゲームオーバー。最高記録です！", "success");
    restartArea.hidden = false;
    return;
  }

  if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。パイプか上下の端に当たりました。", "error");
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
 * キャラクターとパイプと得点を最初に戻します。最高記録は残します。
 */
function restartGame() {
  birdY = (BOARD_HEIGHT - BIRD_SIZE) / 2;
  birdVy = 0;
  pipes = [];
  score = 0;
  gameState = "ready";

  updateScore(scoreDisplay, 0);
  ensurePipes();
  draw();
  showMessage(messageElement, "スペースかクリックでジャンプします。", "info");
  restartArea.hidden = true;
}

/**
 * 背景を消してから、パイプ、地面、天井、キャラクターを描きます。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = "#8ed0aa";

  for (let i = 0; i < pipes.length; i += 1) {
    const parts = pipeParts(pipes[i]);
    ctx.fillRect(parts.top.x, parts.top.y, parts.top.w, parts.top.h);
    ctx.fillRect(parts.bottom.x, parts.bottom.y, parts.bottom.w, parts.bottom.h);
  }

  ctx.fillStyle = "#243044";
  ctx.fillRect(0, 0, BOARD_WIDTH, CEILING_HEIGHT);
  ctx.fillRect(0, BOARD_HEIGHT - GROUND_HEIGHT, BOARD_WIDTH, GROUND_HEIGHT);

  ctx.fillStyle = "#e7b15a";
  ctx.fillRect(BIRD_X, birdY, BIRD_SIZE, BIRD_SIZE);

  // 進行方向が分かるように、体の右端に小さな四角を塗ります。当たり判定の中です。
  ctx.fillStyle = "#f0a396";
  ctx.fillRect(BIRD_X + BIRD_SIZE - 8, birdY + 8, 6, 6);
}

function onKeyDown(event) {
  if (event.key !== " " && event.key !== "Spacebar") {
    return;
  }

  event.preventDefault();

  // 押し続けによるキーリピートでは、連続ジャンプしないようにします。
  if (event.repeat) {
    return;
  }

  flap();
}

/**
 * 画面の更新ループです。ポンと同じく、自分を requestAnimationFrame で予約します。
 */
function loop(now) {
  requestAnimationFrame(loop);

  if (lastFrameTime === 0) {
    lastFrameTime = now;
    draw();
    return;
  }

  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;
  const dt = deltaMs / 1000;

  if (gameState === "playing") {
    moveBird(dt);
    movePipes(dt);

    if (hitObstacle()) {
      finishGame();
    } else {
      scorePassedPipes();
    }
  }

  draw();
}

document.addEventListener("keydown", onKeyDown);
canvas.addEventListener("pointerdown", function (event) {
  if (gameState === "finished") {
    return;
  }

  event.preventDefault();
  flap();
});
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
