/**
 * script.js
 * インベーダー（簡易版）の本体です。
 *
 * 流れ:
 *   1. 下の自機を、左右キーで動かす
 *   2. スペースで弾を撃つ。弾は配列に足していく
 *   3. 上の敵はまとめて左右へ動き、端に着くと下へ下がって折り返す
 *   4. 弾が敵に当たると、その敵を消してスコアを足す
 *   5. 全部倒すとクリア。敵が自機の高さまで降りるとゲームオーバー
 *
 * 描画は Canvas、繰り返しは requestAnimationFrame です。
 * フラッピーバードと同じく、前回からの秒数を速度に掛けて動かします。
 * スコア・最高記録・結果メッセージ・もう一度ボタンは common.js を使います。
 * 最高記録は localStorage に残すので、ページを閉じても消えません。
 */

// 盤面の大きさ（ピクセル）です。
const BOARD_WIDTH = 280;
const BOARD_HEIGHT = 360;

// 自機の大きさと、1秒あたりに動ける距離です。
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 12;
const PLAYER_BOTTOM = 28;
const PLAYER_SPEED = 220;

// 弾の大きさと速さです。クールダウンは、次の弾を撃てるまでの待ち時間です。
const BULLET_WIDTH = 3;
const BULLET_HEIGHT = 10;
const BULLET_SPEED = 320;
const FIRE_COOLDOWN_MS = 260;

// 敵の並びです。行・列・速さを変えると、難しさが変わります。
const ENEMY_ROWS = 4;
const ENEMY_COLS = 7;
const ENEMY_WIDTH = 22;
const ENEMY_HEIGHT = 14;
const ENEMY_GAP_X = 8;
const ENEMY_GAP_Y = 10;
const FORMATION_TOP = 36;
const ENEMY_SPEED = 36;
const ENEMY_DROP = 14;

// 1体倒すともらえる点数です。
const POINTS_PER_ENEMY = 1;

// 上の行から順に塗る色です。
const ENEMY_COLORS = ["#e7b15a", "#f0a396", "#9ec0ea", "#8ed0aa"];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// 自機の左端です。
let playerX = 0;

// 敵の一覧です。alive が false なら、すでに倒しています。
let enemies = [];

// 飛んでいる弾の一覧です。画面の上に出たか、敵に当たったら消します。
let bullets = [];

// 敵グループが進む向きです。1 が右、-1 が左です。
let enemyDir = 1;

// 前回弾を撃った時刻です。連射の間隔に使います。
let lastShotAt = 0;

let score = 0;

// このゲームだけの保存名です。他のゲームの記録と混ざらないようにします。
const HIGH_SCORE_KEY = "js-mini-games-invaders-highscore";

// ブラウザに残っている最高記録です。まだ無いときは 0 です。
let highScore = getHighScore(HIGH_SCORE_KEY);

/**
 * ゲームの状態です。次の3つの文字列のどれかだけを入れます。
 *   "ready"     スタート待ち。敵は止まっている
 *   "playing"   対戦中
 *   "finished"  クリアかゲームオーバー
 */
let gameState = "ready";

// 左右キーが押されているかです。keyup で false に戻します。
const heldKeys = { left: false, right: false };

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
 * 自機の四角を返します。
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
 * 敵を行×列の配列で作ります。最初は全員 alive です。
 */
function createEnemies() {
  const formationWidth = ENEMY_COLS * ENEMY_WIDTH + (ENEMY_COLS - 1) * ENEMY_GAP_X;
  const offsetX = (BOARD_WIDTH - formationWidth) / 2;
  enemies = [];

  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    for (let col = 0; col < ENEMY_COLS; col += 1) {
      enemies.push({
        x: offsetX + col * (ENEMY_WIDTH + ENEMY_GAP_X),
        y: FORMATION_TOP + row * (ENEMY_HEIGHT + ENEMY_GAP_Y),
        row: row,
        alive: true,
      });
    }
  }
}

/**
 * まだ残っている敵の数を返します。
 */
function countAlive() {
  let count = 0;

  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].alive) {
      count += 1;
    }
  }

  return count;
}

/**
 * 敵をまとめて横へ動かします。
 * 残っている敵のどれかが端に着くなら、そのフレームは下げて向きを反転します。
 */
function moveEnemies(dt) {
  const step = ENEMY_SPEED * dt * enemyDir;
  let hitEdge = false;

  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];

    if (!enemy.alive) {
      continue;
    }

    const nextX = enemy.x + step;

    if (nextX < 0 || nextX + ENEMY_WIDTH > BOARD_WIDTH) {
      hitEdge = true;
    }
  }

  if (hitEdge) {
    enemyDir *= -1;

    for (let i = 0; i < enemies.length; i += 1) {
      if (enemies[i].alive) {
        enemies[i].y += ENEMY_DROP;
      }
    }

    return;
  }

  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].alive) {
      enemies[i].x += step;
    }
  }
}

/**
 * 押されている左右キーの分だけ、自機を動かします。
 */
function movePlayer(dt) {
  if (heldKeys.left) {
    playerX -= PLAYER_SPEED * dt;
  }

  if (heldKeys.right) {
    playerX += PLAYER_SPEED * dt;
  }

  if (playerX < 0) {
    playerX = 0;
  }

  if (playerX + PLAYER_WIDTH > BOARD_WIDTH) {
    playerX = BOARD_WIDTH - PLAYER_WIDTH;
  }
}

/**
 * 自機の中央から弾を1つ出します。間隔が短いときは出しません。
 */
function fire(now) {
  if (gameState === "finished") {
    return;
  }

  if (now - lastShotAt < FIRE_COOLDOWN_MS) {
    return;
  }

  beginPlaying();
  lastShotAt = now;

  bullets.push({
    x: playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
    y: playerRect().y - BULLET_HEIGHT,
    hit: false,
  });
}

/**
 * 弾を上へ動かし、画面の外に出たものを消します。
 */
function moveBullets(dt) {
  for (let i = 0; i < bullets.length; i += 1) {
    bullets[i].y -= BULLET_SPEED * dt;
  }

  bullets = bullets.filter(function (bullet) {
    return bullet.y + BULLET_HEIGHT > 0 && !bullet.hit;
  });
}

/**
 * 弾と敵が重なったら、その敵を消し、弾も消します。
 * 1発の弾は、最初に当たった1体だけを倒します。
 */
function resolveHits() {
  for (let b = 0; b < bullets.length; b += 1) {
    const bullet = bullets[b];
    const bulletRect = {
      x: bullet.x,
      y: bullet.y,
      w: BULLET_WIDTH,
      h: BULLET_HEIGHT,
    };

    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];

      if (!enemy.alive || bullet.hit) {
        continue;
      }

      const enemyRect = {
        x: enemy.x,
        y: enemy.y,
        w: ENEMY_WIDTH,
        h: ENEMY_HEIGHT,
      };

      if (!rectsOverlap(bulletRect, enemyRect)) {
        continue;
      }

      enemy.alive = false;
      bullet.hit = true;
      score += POINTS_PER_ENEMY;
      updateScore(scoreDisplay, score);
    }
  }

  bullets = bullets.filter(function (bullet) {
    return !bullet.hit;
  });
}

/**
 * 残っている敵が、自機の高さまで降りたか、自機に重なったかを返します。
 */
function enemiesReachedPlayer() {
  const player = playerRect();

  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];

    if (!enemy.alive) {
      continue;
    }

    const enemyRect = {
      x: enemy.x,
      y: enemy.y,
      w: ENEMY_WIDTH,
      h: ENEMY_HEIGHT,
    };

    if (enemy.y + ENEMY_HEIGHT >= player.y || rectsOverlap(enemyRect, player)) {
      return true;
    }
  }

  return false;
}

/**
 * キーを押したとき、待っている状態なら対戦を始めます。
 */
function beginPlaying() {
  if (gameState !== "ready") {
    return;
  }

  gameState = "playing";
  clearMessage(messageElement);
}

/**
 * クリアかゲームオーバーにします。
 * result は "clear" か "over" です。
 * 得点が最高より大きいときだけ、localStorage に保存します。
 */
function finishGame(result) {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  const isRecord = score > highScore;

  if (isRecord) {
    highScore = updateHighScore(HIGH_SCORE_KEY, score);
    updateScore(highScoreDisplay, highScore);
  }

  if (result === "clear" && isRecord) {
    showMessage(messageElement, "全部倒しました。最高記録です！", "success");
  } else if (result === "clear") {
    showMessage(messageElement, "全部倒しました。最高記録は" + highScore + "点です。", "info");
  } else if (isRecord) {
    showMessage(messageElement, score + "点でゲームオーバー。最高記録です！", "success");
  } else if (score === 0 && highScore === 0) {
    showMessage(messageElement, "ゲームオーバー。敵が降りてきました。", "error");
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
 * 敵・弾・得点を最初に戻します。最高記録は残します。
 */
function restartGame() {
  playerX = (BOARD_WIDTH - PLAYER_WIDTH) / 2;
  enemyDir = 1;
  bullets = [];
  score = 0;
  lastShotAt = 0;
  gameState = "ready";
  heldKeys.left = false;
  heldKeys.right = false;

  updateScore(scoreDisplay, 0);
  createEnemies();
  draw();
  showMessage(messageElement, "左右キーで動き、スペースで撃ちます。", "info");
  restartArea.hidden = true;
}

/**
 * 背景を消してから、敵、自機、弾を描きます。
 */
function draw() {
  ctx.fillStyle = "#10131b";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];

    if (!enemy.alive) {
      continue;
    }

    ctx.fillStyle = ENEMY_COLORS[enemy.row % ENEMY_COLORS.length];
    ctx.fillRect(enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT);
  }

  const player = playerRect();
  ctx.fillStyle = "#f3d7a1";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.fillStyle = "#f3f0ea";

  for (let i = 0; i < bullets.length; i += 1) {
    ctx.fillRect(bullets[i].x, bullets[i].y, BULLET_WIDTH, BULLET_HEIGHT);
  }
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
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    fire(performance.now());
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
 * 画面の更新ループです。フラッピーバードと同じく、自分を requestAnimationFrame で予約します。
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

  if (gameState === "ready" || gameState === "playing") {
    movePlayer(dt);
  }

  if (gameState === "playing") {
    moveEnemies(dt);
    moveBullets(dt);
    resolveHits();

    if (countAlive() === 0) {
      finishGame("clear");
    } else if (enemiesReachedPlayer()) {
      finishGame("over");
    }
  }

  draw();
}

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", function () {
  heldKeys.left = false;
  heldKeys.right = false;
});
createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
requestAnimationFrame(loop);
