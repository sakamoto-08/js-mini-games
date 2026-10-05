# 03 クリックカウンター

「スタート」を押すと 10 秒間の計測が始まります。そのあいだに大きなボタンを何回クリックできるかを競います。時間切れになると結果が出て、ボタンは押せなくなります。

## このゲームで学ぶ概念

- **状態** … `gameState` に `"ready"` / `"playing"` / `"finished"` のどれかを入れる。クリック数 (`clickCount`) と最高記録 (`highScore`) も、画面とは別に変数で持っておく。
- **状態で表示を決める** … `updateButtons` が `gameState` を見て、ボタンの有効・無効と「もう一度」の表示を切り替える。
- **イベント** … スタートボタンとクリックボタンの `click`。
- **タイマー** … `createTimer` に渡した関数が 1 秒ごとに呼ばれる。中身は `common.js` の `setInterval` と `clearInterval`。時間切れでは `stop` して、間隔の処理を止める。
- **条件** … `gameState` が `"playing"` のときだけクリックを数える。最高記録より多いときだけ記録を更新する。
- **関数の再利用** … スコア、メッセージ、タイマー、もう一度ボタンは `common.js` に任せる。

## 遊び方

1. `index.html` をブラウザで開く。
2. 「スタート」を押す。残り時間が 10 から減り始める。
3. 0 になるまで「クリック！」を連打する。スタート前と時間切れ後は押せない。
4. 時間切れになると、回数と最高記録かどうかが表示される。
5. 「もう一度」で回数と残り時間が最初に戻る。最高記録は、ページを再読み込みするまで残る。

## ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `index.html` | 見出し、スコアの置き場、クリックボタン、スタートボタン、メッセージ。`common.css` / `common.js` を相対パスで読み込む。 |
| `style.css` | クリック数と残り時間の横並び、大きなクリックボタン。 |
| `script.js` | 状態、カウント、残り時間、時間切れ、最高記録、やり直し。 |
| `../../common/common.js` | `createScoreDisplay`、`updateScore`、`showMessage`、`clearMessage`、`createTimer`、`createRestartButton`。 |
| `../../common/common.css` | 画面中央のレイアウト、暗い背景、スコア、メッセージ、ボタン。 |

## 読んでみる順番

1. `script.js` の `gameState` と `updateButtons` で、3つの状態がボタンにどう効くかを見る。
2. `startGame` → `handleTick` → `finishGame` の順で、タイマーの開始と終了を追う。
3. `common.js` の `createTimer` を開き、`setInterval` と `clearInterval` がどこにあるかを確認する。

小さく改造するなら、先頭の `TIME_LIMIT` を 5 や 15 に変えてみてください。表示の初期値も、この定数を使っています。
