/**
 * common.js
 * ミニゲーム集で使い回す共通関数です。
 *
 * 読み込み方（各ゲームの index.html）:
 *   <script src="../../common/common.js"></script>
 *   <script src="script.js"></script>
 *
 * type="module" は付けていません。
 * そのため、ここで定義した関数は window に付き、
 * あとに読み込む script.js から関数名だけで呼べます。
 * 例: getRandomInt(1, 100)
 */

/**
 * min 以上、max 以下の整数を1つ返します。
 * 両端を含むので、getRandomInt(1, 100) は 1 も 100 も出ます。
 *
 * Math.random() は 0 以上 1 未満の小数です。
 * それを (max - min + 1) 倍して切り捨て、min を足すと整数になります。
 */
function getRandomInt(min, max) {
  const minInt = Math.ceil(min);
  const maxInt = Math.floor(max);
  const range = maxInt - minInt + 1;
  return Math.floor(Math.random() * range) + minInt;
}

/**
 * スコア表示を作り、parent の中に追加します。
 * 返ってくるのは「数字が入っている要素」です。
 * あとから updateScore に渡して、表示だけ更新します。
 *
 * @param {HTMLElement} parent 追加先の要素
 * @param {string} label 見出し（例: "試行回数"）
 * @param {number|string} initialValue 最初に表示する値
 * @returns {HTMLElement} 値を表示している要素
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
 * createScoreDisplay が返した要素の表示を更新します。
 */
function updateScore(scoreElement, value) {
  scoreElement.textContent = String(value);
}

/**
 * 結果メッセージを表示します。
 * type で色を変えます: "info" | "success" | "error"
 */
function showMessage(messageElement, text, type) {
  const messageType = type || "info";
  messageElement.textContent = text;
  messageElement.className = "message message-" + messageType;
  messageElement.hidden = false;
}

/**
 * メッセージを消します。
 */
function clearMessage(messageElement) {
  messageElement.textContent = "";
  messageElement.className = "message";
  messageElement.hidden = true;
}

/**
 * 「もう一度」ボタンを作り、parent に追加します。
 * クリックされたら onRestart を呼びます。
 *
 * @param {HTMLElement} parent 追加先
 * @param {function} onRestart 押し直したときに実行する関数
 * @param {string} [label] ボタンの文字。省略すると「もう一度遊ぶ」
 * @returns {HTMLButtonElement}
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

/**
 * 1秒ごとに経過秒数を増やすタイマーです。
 * 中では setInterval で数え、stop / reset で clearInterval しています。
 *
 * onTick を渡すと、秒が増えた直後にその秒数で呼ばれます。
 * 残り時間の表示を更新したいゲームで使います。
 *
 * 使い方:
 *   const timer = createTimer(function (seconds) {
 *     console.log(seconds); // 1, 2, 3, ...
 *   });
 *   timer.start();
 *   timer.getSeconds(); // 経過秒
 *   timer.stop();
 *   timer.reset();
 *
 * 返しているのは「関数をまとめたオブジェクト」です。
 * start / stop / reset / getSeconds をあとから呼べます。
 * onTick は省略できます。
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
