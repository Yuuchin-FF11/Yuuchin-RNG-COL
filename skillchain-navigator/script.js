// FFXI Skillchain Simulator Logic

// 1. 各武器種と主要ウェポンスキル (WS) の連携属性データ
const weaponWSData = {
    Dagger: [
        { name: "ルドラストーム", attrs: ["重力", "湾曲"], type: "短剣 (Lv99/RMEA等)" },
        { name: "エヴィサレイション", attrs: ["重力", "貫通"], type: "短剣 (メリポ)" },
        { name: "シャークバイト", attrs: ["収縮", "炸裂"], type: "短剣 (習得)" },
        { name: "ダンシングエッジ", attrs: ["切断", "炸裂"], type: "短剣 (習得)" },
        { name: "バイパーバイト", attrs: ["衝撃", "炸裂"], type: "短剣 (習得)" }
    ],
    Sword: [
        { name: "サベッジブレード", attrs: ["分解", "切断"], type: "片手剣 (クエスト)" },
        { name: "シャンデュシニュ", attrs: ["光", "分解"], type: "片手剣 (ミシック)" },
        { name: "レクイエスカット", attrs: ["重力", "切断"], type: "片手剣 (メリポ)" },
        { name: "フラットブレード", attrs: ["衝撃"], type: "片手剣 (習得)" },
        { name: "レッドロータス", attrs: ["溶解", "炸裂"], type: "片手剣 (習得)" },
        { name: "シャインブレード", attrs: ["閃光", "衝撃"], type: "片手剣 (習得)" }
    ],
    GreatSword: [
        { name: "レゾルーション", attrs: ["核熱", "衝撃"], type: "両手剣 (メリポ)" },
        { name: "トアクリーバー", attrs: ["光", "湾曲"], type: "両手剣 (エンピ)" },
        { name: "デシメーション", attrs: ["溶解", "炸裂"], type: "両手剣 (習得)" },
        { name: "スクラッチバスター", attrs: ["収縮", "貫通"], type: "両手剣 (習得)" },
        { name: "トルネドスライサー", attrs: ["炸裂", "衝撃"], type: "両手剣 (習得)" }
    ],
    Scythe: [
        { name: "インサージェンシー", attrs: ["重力", "溶解"], type: "両手鎌 (メリポ)" },
        { name: "エントロピー", attrs: ["重力", "貫通"], type: "両手鎌 (エルゴン)" },
        { name: "クロスリーパー", attrs: ["分解", "振動"], type: "両手鎌 (習得)" },
        { name: "スパイラルヘル", attrs: ["湾曲", "振動"], type: "両手鎌 (習得)" }
    ],
    Polearm: [
        { name: "スターダイバー", attrs: ["重力", "貫通"], type: "両手槍 (メリポ)" },
        { name: "カムラン", attrs: ["光", "分解"], type: "両手槍 (エンピ)" },
        { name: "ソニックスラスト", attrs: ["貫通", "炸裂"], type: "両手槍 (習得)" },
        { name: "ダブルスラスト", attrs: ["貫通"], type: "両手槍 (習得)" }
    ],
    GreatKatana: [
        { name: "祖之太刀・不動", attrs: ["分解", "湾曲"], type: "両手刀 (エンピ)" },
        { name: "八之太刀・月光", attrs: ["重力", "湾曲"], type: "両手刀 (習得)" },
        { name: "五之太刀・陣風", attrs: ["炸裂", "収縮"], type: "両手刀 (習得)" },
        { name: "七之太刀・雪風", attrs: ["分解", "硬化"], type: "両手刀 (習得)" }
    ],
    Bow: [
        { name: "南無八幡", attrs: ["分解", "貫通"], type: "弓術 (与一の弓)" },
        { name: "ジシュヌの輝き", attrs: ["光", "分解"], type: "弓術 (ガーンデーヴァ)" },
        { name: "エイペクスアロー", attrs: ["湾曲", "貫通"], type: "弓術 (習得)" },
        { name: "射影", attrs: ["切断", "振動"], type: "弓術 (習得)" }
    ],
    Marksmanship: [
        { name: "ラストスタンド", attrs: ["分解", "切断"], type: "射撃 (メリポ)" },
        { name: "カラナック", attrs: ["光", "分解"], type: "射撃 (アナイアレイター)" },
        { name: "ワイルドファイア", attrs: ["重力", "収縮"], type: "射撃 (アルマゲドン)" },
        { name: "デトネーター", attrs: ["核熱", "炸裂"], type: "射撃 (習得)" }
    ]
};

// 2. 連携ルール判定マトリクス
// [トス属性][〆属性] = 発生連携
const chainMatrix = {
    // === Lv1連携の組み合わせ ===
    "収縮": { "振動": "振動", "貫通": "分解" },
    "貫通": { "衝撃": "衝撃", "振動": "振動", "切断": "分解" },
    "炸裂": { "切断": "切断", "収縮": "重力" },
    "切断": { "炸裂": "炸裂", "収縮": "重力" },
    "溶解": { "炸裂": "溶解", "貫通": "貫通", "衝撃": "核熱" },
    "振動": { "溶解": "溶解", "貫通": "湾曲" },
    "衝撃": { "貫通": "貫通", "溶解": "核熱" },
    
    // === Lv2連携からのLv3連携への昇格 ===
    "重力": { "分解": "光" },
    "分解": { "重力": "闇" },
    "核熱": { "湾曲": "闇" },
    "湾曲": { "核熱": "光" },
    
    // === Lv3からLv4への昇格 ===
    "光": { "光": "極光" },
    "闇": { "闇": "黒闇" }
};

// マジックバースト対応属性データ
const mbElements = {
    "光": ["火", "風", "雷", "光"],
    "極光": ["火", "風", "雷", "光"],
    "闇": ["土", "水", "氷", "闇"],
    "黒闇": ["土", "水", "氷", "闇"],
    "湾曲": ["水", "氷"],
    "分解": ["風", "雷"],
    "重力": ["土", "闇"],
    "核熱": ["火", "光"],
    "溶解": ["火"],
    "硬化": ["氷"],
    "炸裂": ["風"],
    "切断": ["土"],
    "貫通": ["水"],
    "衝撃": ["雷"],
    "振動": ["光"],
    "収縮": ["闇"]
};

// 元素クラスの対応定義（CSS色表示用）
const elementClasses = {
    "火": "el-fire", "氷": "el-ice", "風": "el-wind", "土": "el-earth",
    "雷": "el-thunder", "水": "el-water", "光": "el-light", "闇": "el-dark"
};

// 3. 連携計算コアエンジン
function getSkillchainResult(tossAttrs, closeAttrs) {
    // 1段目(トス)と2段目(〆)の属性の全ペアをチェックし、発生する最も強い連携を返す
    let bestResult = null;
    let maxLevel = 0;

    for (const toss of tossAttrs) {
        for (const close of closeAttrs) {
            // マトリクスから連携を引く
            let chain = null;
            if (chainMatrix[toss] && chainMatrix[toss][close]) {
                chain = chainMatrix[toss][close];
            } else if (chainMatrix[close] && chainMatrix[close][toss]) {
                // 対称ルール対応（一部のLv1連携）
                chain = chainMatrix[close][toss];
            }

            if (chain) {
                // 連携の強さ（レベル）を判定
                let level = 1;
                if (chain === "光" || chain === "闇") level = 3;
                else if (chain === "極光" || chain === "黒闇") level = 4;
                else if (["湾曲", "分解", "重力", "核熱"].includes(chain)) level = 2;

                if (level > maxLevel) {
                    maxLevel = level;
                    bestResult = { name: chain, level: level, toss: toss, close: close };
                }
            }
        }
    }

    return bestResult;
}

// 4. 逆引き探索ロジック
function searchSkillchains(weapon1, weapon2, targetChain) {
    const tossList = weaponWSData[weapon1] || [];
    const closeList = weaponWSData[weapon2] || [];
    const results = [];

    for (const tossWS of tossList) {
        for (const closeWS of closeList) {
            // 連携の試算
            const result = getSkillchainResult(tossWS.attrs, closeWS.attrs);
            
            if (result) {
                // ターゲット連携フィルター
                let isMatch = false;
                if (targetChain === "ANY") {
                    isMatch = true;
                } else if (targetChain === "Lv1") {
                    isMatch = (result.level === 1);
                } else {
                    isMatch = (result.name === targetChain);
                }

                if (isMatch) {
                    results.push({
                        toss: tossWS,
                        close: closeWS,
                        chain: result
                    });
                }
            }
        }
    }

    // 連携レベルが高い順にソート
    return results.sort((a, b) => b.chain.level - a.chain.level);
}

// 5. DOM連携およびUI描画
document.addEventListener("DOMContentLoaded", () => {
    const selectWeapon1 = document.getElementById("weapon-1");
    const selectWeapon2 = document.getElementById("weapon-2");
    const selectTargetChain = document.getElementById("target-chain");
    const btnSearch = document.getElementById("btn-search");
    
    const resultsList = document.getElementById("results-list");
    const resultCount = document.getElementById("result-count");
    const noResults = document.getElementById("no-results");

    // 探索ボタンイベント
    btnSearch.addEventListener("click", () => {
        const w1 = selectWeapon1.value;
        const w2 = selectWeapon2.value;
        const target = selectTargetChain.value;

        // 探索の実行
        const results = searchSkillchains(w1, w2, target);

        // UIのクリーンアップ
        resultsList.innerHTML = "";
        resultCount.textContent = `${results.length}件`;

        if (results.length === 0) {
            noResults.style.display = "block";
            return;
        }

        noResults.style.display = "none";

        // 結果カードの動的生成
        results.forEach((res, index) => {
            const card = document.createElement("div");
            
            // 連携レベルに応じたクラス適用
            let chainClass = "chain-level1";
            if (res.chain.name === "光" || res.chain.name === "極光") chainClass = "chain-light";
            else if (res.chain.name === "闇" || res.chain.name === "黒闇") chainClass = "chain-dark";
            else if (res.chain.name === "核熱") chainClass = "chain-fusion";
            else if (res.chain.name === "湾曲") chainClass = "chain-distortion";
            else if (res.chain.name === "重力") chainClass = "chain-gravitation";
            else if (res.chain.name === "分解") chainClass = "chain-fragmentation";

            card.className = `sc-card ${chainClass}`;
            card.style.animationDelay = `${index * 0.05}s`;

            // MB要素の組み立て
            const mbList = mbElements[res.chain.name] || [];
            let mbElementsHTML = "";
            mbList.forEach(el => {
                const elClass = elementClasses[el] || "";
                mbElementsHTML += `<span class="mb-el ${elClass}">${el}</span>`;
            });

            card.innerHTML = `
                <div class="sc-badge-row">
                    <span class="sc-name ${chainClass}">【${res.chain.name}連携】</span>
                    <span class="sc-level">Lv${res.chain.level} 連携</span>
                </div>
                <div class="ws-steps">
                    <div class="ws-step">
                        <span class="ws-num">1</span>
                        <div>
                            <span class="ws-name">${res.toss.name}</span>
                            <span class="ws-type">（${res.toss.type} ［${res.toss.attrs.join('/')}］）</span>
                        </div>
                    </div>
                    <div class="ws-step">
                        <span class="ws-num">2</span>
                        <div>
                            <span class="ws-name">${res.close.name}</span>
                            <span class="ws-type">（${res.close.type} ［${res.close.attrs.join('/')}］）</span>
                        </div>
                    </div>
                </div>
                <div class="mb-row">
                    <span class="mb-label">🔥 マジックバースト対応属性</span>
                    <div class="mb-elements">
                        ${mbElementsHTML || '<span class="mb-el">なし</span>'}
                    </div>
                </div>
            `;

            resultsList.appendChild(card);
        });
    });

    // 初回ロード時にも自動的に探索を実行する（親切設計）
    btnSearch.click();
});
