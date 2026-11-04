/**
 * common.js
 * ミニゲーム集で使い回す共通関数です。
 *
 * 並びは、乱数 → スコア表示 → メッセージ → リスタート → タイマー → ハイスコアです。
 *
 * 読み込み方（各ゲームの index.html）:
 *   <script src="../../common/common.js"></script>
 *   <script src="script.js"></script>
 *
 * type="module" は付けていません。
 * ここで定義した関数は、あとに読む script.js から関数名だけで呼べます。
 * 例: getRandomInt(1, 100)
 */

// --- 乱数 ---

/**
 * min 以上、max 以下の整数を1つ返します。両端を含みます。
 */
function getRandomInt(min, max) {
  const minInt = Math.ceil(min);
  const maxInt = Math.floor(max);
  const range = maxInt - minInt + 1;
  return Math.floor(Math.random() * range) + minInt;
}

// --- スコア表示 ---

/**
 * スコア表示を作り、parent に追加します。
 * 戻り値は数字の要素です。あとから updateScore に渡します。
 */
function createScoreDisplay(parent, label, initialValue) {
  const wrapper = document.createElement("div");
  wrapper.className = "score-display";

  const labelElement = document.createElement("span");
  labelElement.className = "score-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "score-value";
  valueElement.textContent = String(initialValue);

  wrapper.append(labelElement, valueElement);
  parent.appendChild(wrapper);

  return valueElement;
}

/**
 * createScoreDisplay が返した要素の数字を書き換えます。
 */
function updateScore(scoreElement, value) {
  scoreElement.textContent = String(value);
}

// --- メッセージ ---

/**
 * 結果メッセージを出します。type は "info"、"success"、"error" です。
 * 省略したときは "info" になります。
 */
function showMessage(messageElement, text, type) {
  const messageType = type || "info";
  messageElement.textContent = text;
  messageElement.className = "message message-" + messageType;
  messageElement.hidden = false;
}

/**
 * メッセージを消して隠します。
 */
function clearMessage(messageElement) {
  messageElement.textContent = "";
  messageElement.className = "message";
  messageElement.hidden = true;
}

// --- リスタートボタン ---

/**
 * 「もう一度」ボタンを作り、parent に追加します。
 * 押すと onRestart を呼びます。label を省略すると「もう一度遊ぶ」です。
 */
function createRestartButton(parent, onRestart, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-restart";
  button.textContent = label || "もう一度遊ぶ";
  button.addEventListener("click", onRestart);
  parent.appendChild(button);
  return button;
}

// --- タイマー ---

/**
 * 1秒ごとに秒数を増やすタイマーを返します。
 * start / stop / reset / getSeconds を呼べます。
 * onTick を渡すと、増えたあとの秒数で呼ばれます。省略できます。
 */
function createTimer(onTick) {
  let seconds = 0;
  let intervalId = null;

  return {
    start() {
      // すでに動いていたら、タイマーを二重にしない
      if (intervalId !== null) {
        return;
      }

      intervalId = setInterval(function () {
        seconds += 1;

        // 渡されていれば、増えたあとの秒数を知らせる
        if (typeof onTick === "function") {
          onTick(seconds);
        }
      }, 1000);
    },

    stop() {
      if (intervalId === null) {
        return;
      }

      clearInterval(intervalId);
      intervalId = null;
    },

    reset() {
      this.stop();
      seconds = 0;
    },

    getSeconds() {
      return seconds;
    },
  };
}

// --- ハイスコア ---
// ゲームごとに違う key で localStorage に残します。
// 読むのは getHighScore、書くだけなら setHighScore、
// 記録を超えたときだけ残すなら updateHighScore です。

/**
 * 保存済みの最高記録を返します。
 * 無い、数字でない、0未満、保存を使えないときは 0 です。
 */
function getHighScore(key) {
  try {
    const saved = localStorage.getItem(key);

    if (saved === null) {
      return 0;
    }

    const score = Number(saved);

    if (!Number.isFinite(score) || score < 0) {
      return 0;
    }

    return Math.floor(score);
  } catch (error) {
    return 0;
  }
}

/**
 * 最高記録を保存します。
 * できたときは true、ブラウザに拒否されたときは false です。
 */
function setHighScore(key, score) {
  try {
    localStorage.setItem(key, String(Math.floor(score)));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * score が今の記録より大きいときだけ保存します。
 * 戻り値は、そのあとの最高記録です。超えていなければ今の記録のままです。
 * 0点は記録になりません。
 */
function updateHighScore(key, score) {
  const current = getHighScore(key);

  if (score > current) {
    setHighScore(key, score);
    return Math.floor(score);
  }

  return current;
}
