/**
 * script.js
 * 簡易RPG（選択肢式）の本体です。
 *
 * 流れ:
 *   1. プレイヤーのHP・所持金・持ち物を、1つのオブジェクトで持つ
 *   2. 物語は SCENES に場面ごとへ分けて書いておく
 *   3. 選択肢を押すと showScene が次の場面へ進む
 *   4. 戦闘の場面では「攻撃する」「逃げる」を選ぶ
 *   5. HPが0ならゲームオーバー。星のカケラを持ち帰るとクリア
 *
 * 画面の数字・結果メッセージ・もう一度ボタンは common.js を使います。
 * 場面の文章と選択肢は、下の SCENES を書き換えれば変えられます。
 */

// プレイヤーとアイテムの数値です。ここを変えると難しさが変わります。
const PLAYER_MAX_HP = 12;
const PLAYER_ATTACK = 4;
const START_GOLD = 5;
const HERB_COST = 8;
const HERB_HEAL = 6;
const CHEST_GOLD = 10;

// 敵の数値です。戦闘を始めるときに、この値をコピーして使います。
const SLIME = { name: "スライム", hp: 8, attack: 3, gold: 5 };
const WOLF = { name: "オオカミ", hp: 12, attack: 4, gold: 0 };

/**
 * 物語の場面です。キー（"village" など）が場面の名前です。
 * 選択肢の next に、この名前を書くとそこへ進みます。
 *
 *   village  村の入り口。道具屋か森へ
 *   shop     薬草を買う
 *   forest   分かれ道
 *   chest    宝箱。ゴールドが1回だけ増える
 *   slime    スライム戦
 *   clearing 勝ったあとの広場
 *   shrine   祠の前
 *   wolf     オオカミ戦
 *   ending   クリア
 */
const SCENES = {
  village: {
    text: "村の夜道は暗い。北の祠にある星のカケラを持ち帰れば、道が明るくなるという。",
    choices: [
      { label: "道具屋による", next: "shop" },
      { label: "森へ出発する", next: "forest" },
    ],
  },
  shop: {
    text: "店主が言った。「薬草は" + HERB_COST + "ゴールドだ。使うとHPが" + HERB_HEAL + "回復する。」",
    ownedText: "店主がうなずいた。「薬草は、もう持っているな。」",
    choices: [
      { label: "薬草を買う", action: "buyHerb", requires: "noHerb" },
      { label: "森へ出発する", next: "forest" },
      { label: "村の入り口に戻る", next: "village" },
    ],
  },
  forest: {
    text: "森の道が二つに分かれている。左は古い石畳。右は開けた広場で、何かが動く音がする。",
    choices: [
      { label: "左の石畳へ進む", next: "chest" },
      { label: "右の広場へ進む", next: "slime" },
      { label: "村へ戻る", next: "village" },
    ],
  },
  chest: {
    text: "苔むした箱があった。",
    openedText: "箱は、からっぽだった。",
    onEnter: "grantChest",
    choices: [
      { label: "広場のほうへ進む", next: "slime" },
      { label: "村へ戻る", next: "village" },
    ],
  },
  slime: {
    type: "battle",
    text: "広場にスライムがいた。道をふさがれている。",
    enemy: SLIME,
    winScene: "clearing",
    runScene: "forest",
  },
  clearing: {
    text: "スライムはいなくなった。木々の向こうに、祠の屋根が見える。",
    choices: [
      { label: "祠へ進む", next: "shrine" },
      { label: "薬草を使う", action: "useHerb", requires: "herb" },
      { label: "村へ戻る", next: "village" },
    ],
  },
  shrine: {
    text: "祠の前に大きなオオカミが座っている。星のカケラは、その後ろの台座で光っている。",
    choices: [
      { label: "戦う", next: "wolf" },
      { label: "薬草を使う", action: "useHerb", requires: "herb" },
      { label: "森へ戻る", next: "forest" },
    ],
  },
  wolf: {
    type: "battle",
    text: "オオカミが低くうなって、飛びかかってきた。",
    enemy: WOLF,
    winScene: "ending",
    runScene: "shrine",
  },
  ending: {
    text: "星のカケラを掲げると、村までの夜道がうっすらと光った。",
    ending: "clear",
    choices: [],
  },
};

const storyElement = document.getElementById("story");
const choicesElement = document.getElementById("choices");
const scoreArea = document.getElementById("score-area");
const messageElement = document.getElementById("message");
const restartArea = document.getElementById("restart-area");

// プレイヤーの状態です。HPが減る、お金が増える、薬草を持つ、をこの中だけで覚えます。
let player = null;

// いま戦っている敵です。戦闘以外の場面では null にします。
let enemy = null;

// 戦闘中に出す、直前の結果です。「4のダメージ」などを入れます。
let battleLog = "";

// いま表示している場面の名前です。薬草を使ったあと、同じ場面を描き直すのに使います。
let currentSceneId = "";

/**
 * ゲームの状態です。次の2つの文字列のどれかだけを入れます。
 *   "playing"   選択肢を押せる
 *   "finished"  クリアかゲームオーバー
 */
let gameState = "playing";

const hpDisplay = createScoreDisplay(scoreArea, "HP", "0");
const goldDisplay = createScoreDisplay(scoreArea, "所持金", 0);
const itemDisplay = createScoreDisplay(scoreArea, "持ち物", "なし");
const enemyHpDisplay = createScoreDisplay(scoreArea, "敵HP", "—");

/**
 * 新しいプレイヤーを作ります。もう一度押したときも、ここからやり直します。
 */
function createPlayer() {
  return {
    hp: PLAYER_MAX_HP,
    gold: START_GOLD,
    hasHerb: false,
    openedChest: false,
  };
}

/**
 * 画面上のHP・所持金・持ち物・敵HPを、いまの値に合わせます。
 */
function updateStatus() {
  updateScore(hpDisplay, player.hp + " / " + PLAYER_MAX_HP);
  updateScore(goldDisplay, player.gold);
  updateScore(itemDisplay, player.hasHerb ? "薬草" : "なし");

  if (enemy) {
    updateScore(enemyHpDisplay, enemy.hp);
  } else {
    updateScore(enemyHpDisplay, "—");
  }
}

/**
 * 条件つきの選択肢を、いま出してよいか返します。
 * requires が無い選択肢は、いつでも出せます。
 */
function canChoose(choice) {
  if (choice.requires === "herb") {
    return player.hasHerb;
  }

  if (choice.requires === "noHerb") {
    return !player.hasHerb;
  }

  return true;
}

/**
 * 場面の文章を返します。宝箱を開けたあとや、薬草を持っているときは文を変えます。
 */
function textOf(sceneId, scene) {
  if (sceneId === "chest" && player.openedChest) {
    return scene.openedText;
  }

  if (sceneId === "shop" && player.hasHerb) {
    return scene.ownedText;
  }

  return scene.text;
}

/**
 * 選択肢のボタンを作り直します。前のボタンは捨てます。
 */
function renderChoices(choices) {
  choicesElement.innerHTML = "";

  for (let i = 0; i < choices.length; i += 1) {
    const choice = choices[i];

    if (!canChoose(choice)) {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice.label;
    button.addEventListener("click", function () {
      choose(choice);
    });
    choicesElement.appendChild(button);
  }
}

/**
 * 名前で指定した場面へ切り替えます。文章とボタンを描き直します。
 */
function showScene(sceneId) {
  if (gameState !== "playing") {
    return;
  }

  const scene = SCENES[sceneId];
  currentSceneId = sceneId;
  clearMessage(messageElement);

  if (scene.type === "battle") {
    startBattle(scene);
    return;
  }

  enemy = null;
  updateStatus();
  storyElement.textContent = textOf(sceneId, scene);

  // 宝箱のように、着いた瞬間だけ起きる処理です。
  if (scene.onEnter) {
    ACTIONS[scene.onEnter]();
  }

  renderChoices(scene.choices);

  if (scene.ending === "clear") {
    finishGame("clear");
  }
}

/**
 * 戦闘を始めます。敵のHPは、定義のコピーなので、逃げて入り直すと満タンに戻ります。
 */
function startBattle(scene) {
  enemy = {
    name: scene.enemy.name,
    hp: scene.enemy.hp,
    attack: scene.enemy.attack,
    gold: scene.enemy.gold,
    winScene: scene.winScene,
    runScene: scene.runScene,
  };
  battleLog = scene.text;
  renderBattle();
}

/**
 * 戦闘の文章と、「攻撃する / 薬草 / 逃げる」を出します。
 */
function renderBattle() {
  storyElement.textContent = battleLog + "\n\n" + enemy.name + "のHP: " + enemy.hp;
  updateStatus();
  renderChoices([
    { label: "攻撃する", action: "attack" },
    { label: "薬草を使う", action: "useHerb", requires: "herb" },
    { label: "逃げる", action: "run" },
  ]);
}

/**
 * 押された選択肢に応じて、次の場面か、戦闘の行動へ進みます。
 */
function choose(choice) {
  if (gameState !== "playing") {
    return;
  }

  if (choice.action) {
    ACTIONS[choice.action]();
    return;
  }

  showScene(choice.next);
}

/**
 * 薬草を買います。ゴールドが足りないときは、場面を変えません。
 */
function buyHerb() {
  if (player.hasHerb) {
    return;
  }

  if (player.gold < HERB_COST) {
    showMessage(messageElement, "ゴールドが足りません。", "error");
    return;
  }

  player.gold -= HERB_COST;
  player.hasHerb = true;
  updateStatus();
  showScene("shop");
  showMessage(messageElement, "薬草を買った。", "success");
}

/**
 * 宝箱のゴールドを、1回だけ加算します。
 */
function grantChest() {
  if (player.openedChest) {
    return;
  }

  player.openedChest = true;
  player.gold += CHEST_GOLD;
  updateStatus();
  showMessage(messageElement, CHEST_GOLD + "ゴールドを手に入れた。", "info");
}

/**
 * 薬草でHPを回復します。戦闘中なら、使ったあとに敵の攻撃を受けます。
 */
function useHerb() {
  if (!player.hasHerb) {
    return;
  }

  if (player.hp >= PLAYER_MAX_HP) {
    showMessage(messageElement, "HPは満タンです。", "info");
    return;
  }

  player.hasHerb = false;
  player.hp += HERB_HEAL;

  if (player.hp > PLAYER_MAX_HP) {
    player.hp = PLAYER_MAX_HP;
  }

  updateStatus();

  if (enemy) {
    applyEnemyAttack("薬草を使った。HPが回復した。");
    return;
  }

  showScene(currentSceneId);
  showMessage(messageElement, "薬草を使った。", "success");
}

/**
 * 攻撃します。敵のHPが0なら勝ち、残っていれば敵の反撃を受けます。
 * 倒したターンには、敵の攻撃を受けません。
 */
function attack() {
  if (!enemy) {
    return;
  }

  enemy.hp -= PLAYER_ATTACK;

  if (enemy.hp < 0) {
    enemy.hp = 0;
  }

  const hitLine = enemy.name + "に " + PLAYER_ATTACK + " のダメージを与えた。";

  if (enemy.hp === 0) {
    const name = enemy.name;
    const gold = enemy.gold;
    const next = enemy.winScene;

    if (gold > 0) {
      player.gold += gold;
    }

    updateStatus();
    storyElement.textContent = hitLine + "\n" + name + "を倒した。";
    showScene(next);

    // クリアの場面では、finishGame のメッセージを残す
    if (gameState !== "playing") {
      return;
    }

    let message = name + "を倒した。";

    if (gold > 0) {
      message += gold + "ゴールドを手に入れた。";
    }

    showMessage(messageElement, message, "success");
    return;
  }

  applyEnemyAttack(hitLine);
}

/**
 * 敵の攻撃を1回受けます。HPが0になったらゲームオーバーです。
 */
function applyEnemyAttack(prefix) {
  const hit = enemy.attack;
  player.hp -= hit;

  if (player.hp < 0) {
    player.hp = 0;
  }

  battleLog = prefix + "\n" + enemy.name + "の攻撃！" + hit + " のダメージを受けた。";
  updateStatus();

  if (player.hp === 0) {
    storyElement.textContent = battleLog + "\n\n" + enemy.name + "のHP: " + enemy.hp;
    finishGame("over");
    return;
  }

  renderBattle();
}

/**
 * 戦闘から逃げます。報酬はもらえません。
 */
function runAway() {
  if (!enemy) {
    return;
  }

  const name = enemy.name;
  const next = enemy.runScene;
  showScene(next);
  showMessage(messageElement, name + "から逃げた。", "info");
}

/**
 * クリアかゲームオーバーにします。
 * result は "clear" か "over" です。
 */
function finishGame(result) {
  if (gameState === "finished") {
    return;
  }

  gameState = "finished";
  choicesElement.innerHTML = "";
  updateStatus();

  if (result === "clear") {
    showMessage(messageElement, "クリアです。星のカケラを持ち帰った。", "success");
  } else {
    showMessage(messageElement, "ゲームオーバー。HPが0になった。", "error");
  }

  restartArea.hidden = false;
}

/**
 * プレイヤーと場面を、最初の村に戻します。
 */
function restartGame() {
  player = createPlayer();
  enemy = null;
  battleLog = "";
  gameState = "playing";
  restartArea.hidden = true;
  updateStatus();
  showScene("village");
  showMessage(messageElement, "選択肢を選んで、祠を目指します。", "info");
}

// 選択肢の action や、場面の onEnter から呼ぶ関数です。
const ACTIONS = {
  buyHerb: buyHerb,
  grantChest: grantChest,
  useHerb: useHerb,
  attack: attack,
  run: runAway,
};

createRestartButton(restartArea, restartGame, "もう一度");
restartGame();
