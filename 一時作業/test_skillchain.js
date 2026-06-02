// FFXI Skillchain Navigator Logic Test
const fs = require('fs');
const path = require('path');

// script.jsのテキストを読み込み、DOM操作部分を除外して評価する
const scriptPath = path.join(__dirname, '..', 'skillchain-navigator', 'script.js');
let scriptCode = fs.readFileSync(scriptPath, 'utf8');

// DOMContentLoaded以降を除外する
const domIndex = scriptCode.indexOf('document.addEventListener("DOMContentLoaded"');
if (domIndex !== -1) {
    scriptCode = scriptCode.substring(0, domIndex);
}

// 評価環境のモックと実行
const sandbox = {};
try {
    eval(scriptCode);
} catch (e) {
    console.error("Evaluation error:", e);
    process.exit(1);
}

// evalされた関数やデータをローカルにバインド
const weaponWSData = sandbox.weaponWSData || global.weaponWSData;
const chainMatrix = sandbox.chainMatrix || global.chainMatrix;
const getSkillchainResult = sandbox.getSkillchainResult || global.getSkillchainResult;
const getModifiedAttrs = sandbox.getModifiedAttrs || global.getModifiedAttrs;
const searchSkillchains = sandbox.searchSkillchains || global.searchSkillchains;

let testPassed = true;

function assert(condition, message) {
    if (!condition) {
        console.error("❌ FAIL: " + message);
        testPassed = false;
    } else {
        console.log("✅ PASS: " + message);
    }
}

// テスト1：四神円舞 ＞ 四神円舞 (イオニックAM3) -> 極光 (Lv4)
const res1 = searchSkillchains("HandToHand", "HandToHand", "ANY", "IONIC_AM3");
const shishinChain = res1.find(r => r.toss.name === "四神円舞" && r.close.name === "四神円舞");
assert(shishinChain !== undefined, "四神円舞 > 四神円舞 の組み合わせが存在すること");
if (shishinChain) {
    assert(shishinChain.chain.name === "極光", "四神円舞 > 四神円舞 (イオニックAM3) は極光になること (実際: " + shishinChain.chain.name + ")");
    assert(shishinChain.chain.level === 4, "連携レベルは4であること (実際: " + shishinChain.chain.level + ")");
}

// テスト2：エントロピー ＞ エントロピー (イオニックAM3) -> 黒闇 (Lv4)
const res2 = searchSkillchains("Scythe", "Scythe", "ANY", "IONIC_AM3");
const entropyChain = res2.find(r => r.toss.name === "エントロピー" && r.close.name === "エントロピー");
assert(entropyChain !== undefined, "エントロピー > エントロピー の組み合わせが存在すること");
if (entropyChain) {
    assert(entropyChain.chain.name === "黒闇", "エントロピー > エントロピー (イオニックAM3) は黒闇になること (実際: " + entropyChain.chain.name + ")");
    assert(entropyChain.chain.level === 4, "連携レベルは4であること (実際: " + entropyChain.chain.level + ")");
}

// テスト3：ジ・エンド ＞ サベッジブレード (通常武器) -> 光 (Lv3)
const res3 = searchSkillchains("Marksmanship", "Sword", "ANY", "NORMAL");
const ziendoSavage = res3.find(r => r.toss.name === "ジ・エンド" && r.close.name === "サベッジブレード");
assert(ziendoSavage !== undefined, "ジ・エンド > サベッジブレード の組み合わせが存在すること");
if (ziendoSavage) {
    assert(ziendoSavage.chain.name === "光", "ジ・エンド > サベッジブレード は光になること (実際: " + ziendoSavage.chain.name + ")");
    assert(ziendoSavage.chain.level === 3, "連携レベルは3であること (実際: " + ziendoSavage.chain.level + ")");
}

// テスト4：ワイルドファイア ＞ ワイルドファイア (通常武器) -> 闇 (Lv3)
const res4 = searchSkillchains("Marksmanship", "Marksmanship", "ANY", "NORMAL");
const wfWf = res4.find(r => r.toss.name === "ワイルドファイア" && r.close.name === "ワイルドファイア");
assert(wfWf !== undefined, "ワイルドファイア > ワイルドファイア の組み合わせが存在すること");
if (wfWf) {
    assert(wfWf.chain.name === "闇", "ワイルドファイア > ワイルドファイア は闇になること (実際: " + wfWf.chain.name + ")");
}

// テスト5：オムニシエンスの属性と分類
const staffWS = weaponWSData["Staff"];
const omni = staffWS.find(w => w.name === "オムニシエンス");
assert(omni !== undefined, "両手棍にオムニシエンスが存在すること");
if (omni) {
    assert(omni.attrs.includes("重力") && omni.attrs.includes("貫通"), "オムニシエンスの属性が重力・貫通であること (実際: " + omni.attrs.join("/") + ")");
    assert(omni.type === "両手棍 (ミシック)", "オムニシエンスのタイプが両手棍 (ミシック) であること (実際: " + omni.type + ")");
}

if (testPassed) {
    console.log("\n🎉 全テストケースをクリアしました！");
    process.exit(0);
} else {
    console.error("\n❌ テストに失敗した項目があります。");
    process.exit(1);
}
