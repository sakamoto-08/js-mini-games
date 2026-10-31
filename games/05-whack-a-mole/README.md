# 05 モグラ叩き

3×3 の穴から、モグラがランダムに顔を出します。「スタート」から 30 秒のあいだに叩くと 1 点です。時間切れになると結果が出て、最高記録はブラウザに保存されるので、ページを再読み込みしても残ります。

## このゲームで学ぶ概念

- **タイマーが2つ** … 残り時間は `createTimer`（中身は 1 秒ごとの `setInterval`）。モグラを出す繰り返しは、このファイルの別の `setInterval`。終わるときは、どちらも `clearInterval` で止める。
- **DOM を作る** … 穴は HTML に書かず、`createElement` で 9 個作って盤面に足す。作ったボタンは配列 `holes` に入れておく。
- **クラスの切り替え** … モグラを出すときは `has-mole` を付け、隠すときは外す。見え方そのものは CSS が担当する。
- **ランダム** … `getRandomInt` で配列の位置を選び、穴を 1 つ取り出す。
- **状態** … `gameState` が `"playing"` のときだけ得点にする。空の穴や、時間切れのあとのクリックは数えない。
- **関数の再利用** … スコア、メッセージ、残り時間、乱数、もう一度ボタンは `common.js` に任せる。最高記録の読み書きは `getHighScore` と `updateHighScore` です。
- **localStorage** … 時間切れのとき、今回の得点が保存済みの記録より大きいときだけ書き込みます。キーは `js-mini-games-whack-highscore` です。

## 遊び方

1. `index.html` をブラウザで開く。
2. 「スタート」を押す。残り時間が 30 から減り、穴からモグラが出る。
3. 顔が見えているあいだに、その穴をクリックする。1 匹につき 1 点。
4. 0 秒になると、得点と最高記録かどうかが表示される。得点がこれまでの最高より大きいときだけ、最高記録が更新され、「最高記録です！」と出る。
5. 「もう一度」で得点と残り時間が最初に戻る。最高記録は残る。ページを再読み込みしても、最高記録は残っている。

モグラがいない穴を押しても、得点は増えません。

## ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `index.html` | 見出し、スコアの置き場、穴を並べる盤面、スタートボタン、メッセージ。`common.css` / `common.js` を相対パスで読み込む。 |
| `style.css` | 3×3 の穴、モグラが隠れているときと出ているときの見た目。 |
| `script.js` | 穴の生成、出現と消滅、得点、制限時間、最高記録。 |
| `../../common/common.js` | `getRandomInt`、`createScoreDisplay`、`updateScore`、`showMessage`、`clearMessage`、`createTimer`、`createRestartButton`、`getHighScore`、`updateHighScore`。 |
| `../../common/common.css` | 画面中央のレイアウト、暗い背景、スコア、メッセージ、ボタン。 |

## 読んでみる順番

1. `createHole` と `createBoard` で、穴がどう作られて配列に入るかを見る。
2. `showMole` と `hideMole` で、`has-mole` の付け外しを追う。
3. `startSpawning` と `handleTick` で、2 つのタイマーが別々に動いていることを確認する。
4. `finishGame` で、`updateHighScore` が記録を超えたときだけ保存している箇所を確認する。

小さく改造するなら、`MOLE_STAY_MS` を短くしてみてください。モグラが早く隠れるので、難しくなります。
