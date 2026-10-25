/**
 * script.js
 * トップページのゲームカードを作ります。
 *
 * games に1件足すと、カードが1枚増えます。
 * 番号、名前、説明、学ぶ概念、遊び方のリンクを、この配列だけで管理します。
 */

const games = [
  { id: "01", title: "数当て", description: "1〜100の数字を当てるシンプルなゲーム", concepts: ["変数", "条件分岐", "イベント", "DOM"], path: "games/01-number-guess/index.html" },
  { id: "02", title: "じゃんけん", description: "コンピュータとじゃんけんで勝負する", concepts: ["配列", "オブジェクト", "関数"], path: "games/02-janken/index.html" },
  { id: "03", title: "クリックカウンター", description: "制限時間内にクリックした回数を競う", concepts: ["状態", "イベント", "タイマー"], path: "games/03-click-counter/index.html" },
  { id: "04", title: "反応速度", description: "画面の変化にどれだけ早く反応できるか測る", concepts: ["setTimeout", "時間計測"], path: "games/04-reaction-time/index.html" },
  { id: "05", title: "モグラ叩き", description: "ランダムに出てくるモグラを叩く", concepts: ["タイマー", "DOM", "ランダム"], path: "games/05-whack-a-mole/index.html" },
  { id: "06", title: "サイコロ勝負", description: "サイコロの出目で勝負する", concepts: ["乱数", "条件分岐", "DOM"], path: "games/06-dice-battle/index.html" },
  { id: "07", title: "タイピング", description: "表示された文字を素早く入力する", concepts: ["キーボード", "文字列", "タイマー"], path: "games/07-typing/index.html" },
  { id: "08", title: "神経衰弱", description: "カードをひっくり返してペアを揃える", concepts: ["複数の状態", "繰り返し描画"], path: "games/08-memory/index.html" },
  { id: "09", title: "ストップウォッチ", description: "時間を計測するストップウォッチ", concepts: ["タイマー", "時間の計算", "状態"], path: "games/09-stopwatch/index.html" },
  { id: "10", title: "クイズ", description: "選択式のクイズに答える", concepts: ["配列", "オブジェクト", "DOM"], path: "games/10-quiz/index.html" },
  { id: "11", title: "スネーク簡易版", description: "蛇を操作して餌を食べる", concepts: ["Canvas", "アニメーション", "配列"], path: "games/11-snake/index.html" },
  { id: "12", title: "ブロック崩し簡易版", description: "ボールでブロックを壊す", concepts: ["Canvas", "衝突判定", "状態"], path: "games/12-breakout/index.html" },
  { id: "13", title: "ポン簡易版", description: "パドルでボールを打ち返す", concepts: ["Canvas", "入力", "簡単なAI"], path: "games/13-pong/index.html" },
  { id: "14", title: "フラッピーバード簡易版", description: "障害物を避けて飛び続ける", concepts: ["重力", "スクロール", "衝突判定"], path: "games/14-flappy/index.html" },
  { id: "15", title: "インベーダー簡易版", description: "敵を撃ち落とすシューティング", concepts: ["配列", "当たり判定", "グループ移動"], path: "games/15-invaders/index.html" },
  { id: "16", title: "マインスイーパー簡易版", description: "地雷を避けながらマスを開く", concepts: ["2次元配列", "再帰", "タイマー"], path: "games/16-minesweeper/index.html" },
  { id: "17", title: "簡易RPG", description: "選択肢で進むテキストベースのRPG", concepts: ["オブジェクト", "場面データ", "分岐"], path: "games/17-rpg/index.html" },
  { id: "18", title: "キャッチゲーム", description: "落ちてくるアイテムをキャッチする", concepts: ["配列", "衝突判定", "アニメーション"], path: "games/18-catch/index.html" },
];

const gameList = document.getElementById("game-list");

/**
 * 概念タグのリストを作ります。
 */
function createTags(concepts) {
  const list = document.createElement("ul");
  list.className = "tags";

  for (let i = 0; i < concepts.length; i += 1) {
    const item = document.createElement("li");
    item.textContent = concepts[i];
    list.appendChild(item);
  }

  return list;
}

/**
 * ゲーム1件分のカードを作ります。
 */
function createCard(game) {
  const card = document.createElement("article");
  card.className = "game-card";

  const id = document.createElement("p");
  id.className = "game-id";
  id.textContent = game.id;

  const title = document.createElement("h2");
  title.textContent = game.title;

  const description = document.createElement("p");
  description.className = "game-description";
  description.textContent = game.description;

  const playLink = document.createElement("a");
  playLink.className = "btn";
  playLink.href = game.path;
  playLink.textContent = "遊ぶ";
  playLink.setAttribute("aria-label", game.title + "を遊ぶ");

  card.append(id, title, description, createTags(game.concepts), playLink);
  return card;
}

/**
 * games を先頭から順にカードへして、一覧へ足します。
 */
function renderGames() {
  for (let i = 0; i < games.length; i += 1) {
    gameList.appendChild(createCard(games[i]));
  }
}

renderGames();
