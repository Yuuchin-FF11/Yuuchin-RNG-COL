// FFXI Skillchain Simulator Logic

// 1. 各武器種とすべての実在するウェポンスキル (WS) の連携属性データ
const weaponWSData = {
    HandToHand: [
        { name: "コンボ", attrs: ["衝撃"], type: "格闘 (初期)" },
        { name: "タックル", attrs: ["振動", "衝撃"], type: "格闘 (習得)" },
        { name: "短勁", attrs: ["収縮"], type: "格闘 (習得)" },
        { name: "バックハンドブロー", attrs: ["炸裂"], type: "格闘 (習得)" },
        { name: "乱撃", attrs: ["衝撃"], type: "格闘 (習得)" },
        { name: "スピンアタック", attrs: ["溶解", "衝撃"], type: "格闘 (習得)" },
        { name: "空鳴拳", attrs: ["貫通", "衝撃"], type: "格闘 (習得)" },
        { name: "双竜脚", attrs: ["分解"], type: "格闘 (習得)" },
        { name: "夢想阿修羅拳", attrs: ["重力", "溶解"], type: "格闘 (クエスト)" },
        { name: "闘魂旋風脚", attrs: ["硬化", "炸裂", "衝撃"], type: "格闘 (習得)" },
        { name: "ファイナルヘヴン", attrs: ["光", "核熱"], type: "格闘 (レリック)" },
        { name: "アスケーテンツォルン", attrs: ["核熱", "貫通"], type: "格闘 (ミシック)" },
        { name: "連環六合圏", attrs: ["重力", "溶解"], type: "格闘 (ミシック)" },
        { name: "ビクトリースマイト", attrs: ["光", "分解"], type: "格闘 (エンピ)" },
        { name: "四神円舞", attrs: ["核熱", "振動"], type: "格闘 (メリポ/イオニック)" },
        { name: "マルカラ", attrs: ["炸裂", "収縮", "湾曲"], type: "格闘 (プライム)" }
    ],
    Dagger: [
        { name: "ワスプスティング", attrs: ["切断"], type: "短剣 (初期)" },
        { name: "ガストスラッシュ", attrs: ["炸裂"], type: "短剣 (習得)" },
        { name: "シャドーステッチ", attrs: ["振動"], type: "短剣 (習得)" },
        { name: "バイパーバイト", attrs: ["切断"], type: "短剣 (習得)" },
        { name: "サイクロン", attrs: ["炸裂", "衝撃"], type: "短剣 (習得)" },
        { name: "エナジースティール", attrs: [], type: "短剣 (習得)" },
        { name: "エナジードレイン", attrs: [], type: "短剣 (習得)" },
        { name: "ダンシングエッジ", attrs: ["切断", "炸裂"], type: "短剣 (習得)" },
        { name: "シャークバイト", attrs: ["分解"], type: "短剣 (習得)" },
        { name: "エヴィサレイション", attrs: ["重力", "貫通"], type: "短剣 (クエスト)" },
        { name: "イオリアンエッジ", attrs: ["切断", "炸裂", "衝撃"], type: "短剣 (習得)" },
        { name: "マーシーストローク", attrs: ["闇", "重力"], type: "短剣 (レリック)" },
        { name: "マンダリクスタッブ", attrs: ["闇", "湾曲"], type: "短剣 (ミシック)" },
        { name: "モーダントライム", attrs: ["重力", "貫通"], type: "短剣 (ミシック)" },
        { name: "ピリッククレオス", attrs: ["湾曲", "切断"], type: "短剣 (ミシック)" },
        { name: "ルドラストーム", attrs: ["闇", "湾曲"], type: "短剣 (エンピ)" },
        { name: "エクゼンテレター", attrs: ["分解", "切断"], type: "短剣 (メリポ/イオニック)" },
        { name: "ルースレスストローク", attrs: ["溶解", "衝撃", "分解"], type: "短剣 (プライム)" }
    ],
    Sword: [
        { name: "ファストブレード", attrs: ["切断"], type: "片手剣 (初期)" },
        { name: "バーニングブレード", attrs: ["溶解"], type: "片手剣 (習得)" },
        { name: "レッドロータス", attrs: ["溶解", "炸裂"], type: "片手剣 (習得)" },
        { name: "フラットブレード", attrs: ["衝撃"], type: "片手剣 (習得)" },
        { name: "シャインブレード", attrs: ["切断"], type: "片手剣 (習得)" },
        { name: "セラフブレード", attrs: ["切断"], type: "片手剣 (習得)" },
        { name: "サークルブレード", attrs: ["振動", "衝撃"], type: "片手剣 (習得)" },
        { name: "スピリッツウィズイン", attrs: [], type: "片手剣 (習得)" },
        { name: "スウィフトブレード", attrs: ["重力"], type: "片手剣 (習得)" },
        { name: "ボーパルブレード", attrs: ["切断", "衝撃"], type: "片手剣 (習得)" },
        { name: "サベッジブレード", attrs: ["分解", "切断"], type: "片手剣 (クエスト)" },
        { name: "サングインブレード", attrs: [], type: "片手剣 (習得)" },
        { name: "ロズレーファタール", attrs: ["湾曲", "収縮"], type: "片手剣 (ミシック)" },
        { name: "ロイエ", attrs: ["核熱", "振動"], type: "片手剣 (レリック)" },
        { name: "エクスピアシオン", attrs: ["湾曲", "切断"], type: "片手剣 (ミシック)" },
        { name: "シャンデュシニュ", attrs: ["光", "湾曲"], type: "片手剣 (エンピ)" },
        { name: "レクイエスカット", attrs: ["重力", "切断"], type: "片手剣 (メリポ/イオニック)" },
        { name: "インペラトル", attrs: ["炸裂", "収縮", "湾曲"], type: "片手剣 (プライム)" }
    ],
    GreatSword: [
        { name: "ハードスラッシュ", attrs: ["切断"], type: "両手剣 (初期)" },
        { name: "パワースラッシュ", attrs: ["貫通"], type: "両手剣 (習得)" },
        { name: "フロストバイト", attrs: ["硬化"], type: "両手剣 (習得)" },
        { name: "フリーズバイト", attrs: ["硬化", "炸裂"], type: "両手剣 (習得)" },
        { name: "ショックウェーブ", attrs: ["振動"], type: "両手剣 (習得)" },
        { name: "クレセントムーン", attrs: ["切断"], type: "両手剣 (習得)" },
        { name: "シックルムーン", attrs: ["切断", "衝撃"], type: "両手剣 (習得)" },
        { name: "スピンスラッシュ", attrs: ["分解"], type: "両手剣 (習得)" },
        { name: "グラウンドストライク", attrs: ["分解", "湾曲"], type: "両手剣 (クエスト)" },
        { name: "ヘラクレススラッシュ", attrs: ["硬化", "炸裂", "衝撃"], type: "両手剣 (習得)" },
        { name: "スカージ", attrs: ["光", "核熱"], type: "両手剣 (レリック)" },
        { name: "トアクリーバー", attrs: ["光", "湾曲"], type: "両手剣 (エンピ)" },
        { name: "レゾルーション", attrs: ["分解", "切断"], type: "両手剣 (メリポ/イオニック)" },
        { name: "デミディエーション", attrs: ["光", "分解"], type: "両手剣 (エルゴン)" },
        { name: "フィンブルヴェト", attrs: ["炸裂", "収縮", "湾曲"], type: "両手剣 (プライム)" }
    ],
    Axe: [
        { name: "レイジングアクス", attrs: ["炸裂", "衝撃"], type: "片手斧 (初期)" },
        { name: "スマッシュ", attrs: ["硬化", "振動"], type: "片手斧 (習得)" },
        { name: "ラファールアクス", attrs: ["炸裂"], type: "片手斧 (習得)" },
        { name: "アバランチアクス", attrs: ["切断", "衝撃"], type: "片手斧 (習得)" },
        { name: "スピニングアクス", attrs: ["溶解", "切断", "衝撃"], type: "片手斧 (習得)" },
        { name: "ランページ", attrs: ["切断"], type: "片手斧 (習得)" },
        { name: "カラミティ", attrs: ["切断", "衝撃"], type: "片手斧 (習得)" },
        { name: "ミストラルアクス", attrs: ["核熱"], type: "片手斧 (習得)" },
        { name: "デシメーション", attrs: ["核熱", "振動"], type: "片手斧 (クエスト)" },
        { name: "ボーラアクス", attrs: ["炸裂", "切断"], type: "片手斧 (習得)" },
        { name: "オンズロート", attrs: ["闇", "重力"], type: "片手斧 (レリック)" },
        { name: "プライマルレンド", attrs: ["重力", "振動"], type: "片手斧 (ミシック)" },
        { name: "クラウドスプリッタ", attrs: ["闇", "分解"], type: "片手斧 (エンピ)" },
        { name: "ルイネーター", attrs: ["湾曲", "炸裂"], type: "片手斧 (メリポ/イオニック)" },
        { name: "ブリッツ", attrs: ["溶解", "衝撃", "分解"], type: "片手斧 (プライム)" }
    ],
    GreatAxe: [
        { name: "シールドブレイク", attrs: ["衝撃"], type: "両手斧 (初期)" },
        { name: "アイアンテンペスト", attrs: ["切断"], type: "両手斧 (習得)" },
        { name: "シュトルムヴィント", attrs: ["振動", "切断"], type: "両手斧 (習得)" },
        { name: "アーマーブレイク", attrs: ["衝撃"], type: "両手斧 (習得)" },
        { name: "キーンエッジ", attrs: ["収縮"], type: "両手斧 (習得)" },
        { name: "ウェポンブレイク", attrs: ["衝撃"], type: "両手斧 (習得)" },
        { name: "レイジングラッシュ", attrs: ["硬化", "振動"], type: "両手斧 (習得)" },
        { name: "フルブレイク", attrs: ["湾曲"], type: "両手斧 (習得)" },
        { name: "スチールサイクロン", attrs: ["湾曲", "炸裂"], type: "両手斧 (クエスト)" },
        { name: "フェルクリーヴ", attrs: ["切断", "炸裂"], type: "両手斧 (習得)" },
        { name: "メタトロントーメント", attrs: ["光", "核熱"], type: "両手斧 (レリック)" },
        { name: "キングズジャスティス", attrs: ["分解", "切断"], type: "両手斧 (ミシック)" },
        { name: "ウッコフューリー", attrs: ["光", "分解"], type: "両手斧 (エンピ)" },
        { name: "アップヒーバル", attrs: ["核熱", "収縮"], type: "両手斧 (メリポ/イオニック)" },
        { name: "ディザスター", attrs: ["貫通", "切断", "重力"], type: "両手斧 (プライム)" }
    ],
    Scythe: [
        { name: "スライス", attrs: ["切断"], type: "両手鎌 (初期)" },
        { name: "ダークハーベスト", attrs: ["振動"], type: "両手鎌 (習得)" },
        { name: "シャドーオブデス", attrs: ["硬化", "振動"], type: "両手鎌 (習得)" },
        { name: "ナイトメアサイス", attrs: ["収縮", "切断"], type: "両手鎌 (習得)" },
        { name: "スピニングサイス", attrs: ["振動", "切断"], type: "両手鎌 (習得)" },
        { name: "ボーパルサイス", attrs: ["貫通", "切断"], type: "両手鎌 (習得)" },
        { name: "ギロティン", attrs: ["硬化"], type: "両手鎌 (習得)" },
        { name: "クロスリーパー", attrs: ["湾曲"], type: "両手鎌 (習得)" },
        { name: "スパイラルヘル", attrs: ["湾曲", "切断"], type: "両手鎌 (クエスト)" },
        { name: "インファナルサイズ", attrs: ["収縮", "振動"], type: "両手鎌 (習得)" },
        { name: "カタストロフィ", attrs: ["闇", "重力"], type: "両手鎌 (レリック)" },
        { name: "インサージェンシー", attrs: ["核熱", "収縮"], type: "両手鎌 (メリポ/イオニック)" },
        { name: "クワイタス", attrs: ["闇", "湾曲"], type: "両手鎌 (エンピ)" },
        { name: "エントロピー", attrs: ["重力", "振動"], type: "両手鎌 (メリポ/イオニック)" },
        { name: "ジ・オリジン", attrs: ["硬化", "振動", "核熱"], type: "両手鎌 (プライム)" }
    ],
    Polearm: [
        { name: "ダブルスラスト", attrs: ["貫通"], type: "両手槍 (初期)" },
        { name: "サンダースラスト", attrs: ["貫通", "衝撃"], type: "両手槍 (習得)" },
        { name: "ライデンスラスト", attrs: ["貫通", "衝撃"], type: "両手槍 (習得)" },
        { name: "足払い", attrs: ["衝撃"], type: "両手槍 (習得)" },
        { name: "ペンタスラスト", attrs: ["収縮"], type: "両手槍 (習得)" },
        { name: "ボーパルスラスト", attrs: ["振動", "貫通"], type: "両手槍 (習得)" },
        { name: "スキュアー", attrs: ["貫通", "衝撃"], type: "両手槍 (習得)" },
        { name: "大車輪", attrs: ["核熱"], type: "両手槍 (習得)" },
        { name: "インパルスドライヴ", attrs: ["重力", "硬化"], type: "両手槍 (クエスト)" },
        { name: "ソニックスラスト", attrs: ["貫通", "切断"], type: "両手槍 (習得)" },
        { name: "ゲイルスコグル", attrs: ["光", "湾曲"], type: "両手槍 (レリック)" },
        { name: "雲蒸竜変", attrs: ["核熱", "貫通"], type: "両手槍 (ミシック)" },
        { name: "カムラン", attrs: ["光", "分解"], type: "両手槍 (エンピ)" },
        { name: "スターダイバー", attrs: ["重力", "貫通"], type: "両手槍 (メリポ/イオニック)" },
        { name: "ダーマット", attrs: ["貫通", "切断", "重力"], type: "両手槍 (プライム)" }
    ],
    Katana: [
        { name: "臨", attrs: ["貫通"], type: "片手刀 (初期)" },
        { name: "烈", attrs: ["切断"], type: "片手刀 (習得)" },
        { name: "滴", attrs: ["振動"], type: "片手刀 (習得)" },
        { name: "凍", attrs: ["硬化", "炸裂"], type: "片手刀 (習得)" },
        { name: "地", attrs: ["貫通", "衝撃"], type: "片手刀 (習得)" },
        { name: "影", attrs: ["収縮"], type: "片手刀 (習得)" },
        { name: "迅", attrs: ["炸裂", "衝撃"], type: "片手刀 (習得)" },
        { name: "天", attrs: ["重力"], type: "片手刀 (習得)" },
        { name: "空", attrs: ["重力", "貫通"], type: "片手刀 (クエスト)" },
        { name: "湧", attrs: ["振動", "切断"], type: "片手刀 (習得)" },
        { name: "生者必滅", attrs: ["闇", "分解"], type: "片手刀 (レリック)" },
        { name: "カムハブリ", attrs: ["分解", "収縮"], type: "片手刀 (ミシック)" },
        { name: "秘", attrs: ["闇", "重力"], type: "片手刀 (エンピ)" },
        { name: "瞬", attrs: ["核熱", "振動"], type: "片手刀 (メリポ/イオニック)" },
        { name: "是生滅法", attrs: ["硬化", "振動", "核熱"], type: "片手刀 (プライム)" }
    ],
    GreatKatana: [
        { name: "壱之太刀・燕飛", attrs: ["貫通", "切断"], type: "両手刀 (初期)" },
        { name: "弐之太刀・鋒縛", attrs: ["硬化"], type: "両手刀 (習得)" },
        { name: "参之太刀・轟天", attrs: ["貫通", "衝撃"], type: "両手刀 (習得)" },
        { name: "四之太刀・陽炎", attrs: ["溶解"], type: "両手刀 (習得)" },
        { name: "五之太刀・陣風", attrs: ["切断", "炸裂"], type: "両手刀 (習得)" },
        { name: "六之太刀・光輝", attrs: ["振動", "衝撃"], type: "両手刀 (習得)" },
        { name: "七之太刀・雪風", attrs: ["硬化", "炸裂"], type: "両手刀 (習得)" },
        { name: "八之太刀・月光", attrs: ["湾曲", "振動"], type: "両手刀 (習得)" },
        { name: "九之太刀・花車", attrs: ["核熱", "収縮"], type: "両手刀 (習得)" },
        { name: "十之太刀・乱鴉", attrs: ["重力", "硬化"], type: "両手刀 (クエスト)" },
        { name: "十一之太刀・鳳蝶", attrs: ["収縮", "切断"], type: "両手刀 (習得)" },
        { name: "零之太刀・回天", attrs: ["光", "分解"], type: "両手刀 (レリック)" },
        { name: "祖之太刀・不動", attrs: ["光", "湾曲"], type: "両手刀 (エンピ)" },
        { name: "十二之太刀・照破", attrs: ["分解", "収縮"], type: "両手刀 (メリポ/イオニック)" },
        { name: "絶之太刀・無名", attrs: ["炸裂", "収縮", "湾曲"], type: "両手刀 (プライム)" }
    ],
    Club: [
        { name: "シャインストライク", attrs: ["衝撃"], type: "片手棍 (初期)" },
        { name: "セラフストライク", attrs: ["衝撃"], type: "片手棍 (習得)" },
        { name: "ブレインシェイカー", attrs: ["振動"], type: "片手棍 (習得)" },
        { name: "スターライト", attrs: [], type: "片手棍 (習得)" },
        { name: "ムーンライト", attrs: [], type: "片手棍 (習得)" },
        { name: "スカルブレイカー", attrs: ["硬化", "振動"], type: "片手棍 (習得)" },
        { name: "トゥルーストライク", attrs: ["炸裂", "衝撃"], type: "片手棍 (習得)" },
        { name: "ジャッジメント", attrs: ["衝撃"], type: "片手棍 (習得)" },
        { name: "ヘキサストライク", attrs: ["核熱"], type: "片手棍 (習得)" },
        { name: "ブラックヘイロー", attrs: ["分解", "収縮"], type: "片手棍 (クエスト)" },
        { name: "フラッシュノヴァ", attrs: ["硬化", "振動"], type: "片手棍 (習得)" },
        { name: "ランドグリース", attrs: ["光", "分解"], type: "片手棍 (レリック)" },
        { name: "ミスティックブーン", attrs: [], type: "片手棍 (ミシック)" },
        { name: "ダガン", attrs: [], type: "片手棍 (エンピ)" },
        { name: "レルムレイザー", attrs: ["核熱", "衝撃"], type: "片手棍 (メリポ/イオニック)" },
        { name: "エクズデーション", attrs: ["闇", "分解"], type: "片手棍 (エルゴン)" },
        { name: "ダグダ", attrs: ["貫通", "切断", "重力"], type: "片手棍 (プライム)" }
    ],
    Staff: [
        { name: "ヘヴィスイング", attrs: ["衝撃"], type: "両手棍 (初期)" },
        { name: "ロッククラッシャー", attrs: ["衝撃"], type: "両手棍 (習得)" },
        { name: "アースクラッシャー", attrs: ["衝撃", "炸裂"], type: "両手棍 (習得)" },
        { name: "スターバースト", attrs: ["収縮", "振動"], type: "両手棍 (習得)" },
        { name: "サンバースト", attrs: ["収縮", "振動"], type: "両手棍 (習得)" },
        { name: "シェルクラッシャー", attrs: ["炸裂"], type: "両手棍 (習得)" },
        { name: "カタクリスム", attrs: ["収縮", "振動"], type: "両手棍 (習得)" },
        { name: "スピリットテーカー", attrs: [], type: "両手棍 (習得)" },
        { name: "レトリビューション", attrs: ["重力", "振動"], type: "両手棍 (クエスト)" },
        { name: "シャッターソウル", attrs: ["重力", "硬化"], type: "両手棍 (メリポ/イオニック)" },
        { name: "タルタロスベイン", attrs: ["炸裂", "溶解"], type: "両手棍 (ミシック)" },
        { name: "ヴィゾフニル", attrs: ["貫通", "振動"], type: "両手棍 (エンピ)" },
        { name: "オムニシエンス", attrs: ["重力", "貫通"], type: "両手棍 (ミシック)" },
        { name: "ガーランドオブブリス", attrs: ["核熱", "溶解"], type: "両手棍 (習得)" },
        { name: "オシャラ", attrs: ["硬化", "振動", "核熱"], type: "両手棍 (プライム)" }
    ],
    Bow: [
        { name: "フレイミングアロー", attrs: ["溶解", "貫通"], type: "弓術 (初期)" },
        { name: "ピアシングアロー", attrs: ["振動", "貫通"], type: "弓術 (習得)" },
        { name: "ダリングアロー", attrs: ["溶解", "貫通"], type: "弓術 (習得)" },
        { name: "サイドワインダー", attrs: ["振動", "貫通", "炸裂"], type: "弓術 (習得)" },
        { name: "ブラストアロー", attrs: ["硬化", "貫通"], type: "弓術 (習得)" },
        { name: "アーチングアロー", attrs: ["核熱"], type: "弓術 (習得)" },
        { name: "エンピリアンアロー", attrs: ["核熱", "貫通"], type: "弓術 (クエスト)" },
        { name: "リフルジェントアロー", attrs: ["振動", "貫通"], type: "弓術 (習得)" },
        { name: "エイペクスアロー", attrs: ["分解", "貫通"], type: "弓術 (メリポ/イオニック)" },
        { name: "南無八幡", attrs: ["光", "湾曲"], type: "弓術 (レリック)" },
        { name: "ジシュヌの光輝", attrs: ["光", "核熱"], type: "弓術 (エンピ)" },
        { name: "シャルヴ", attrs: ["貫通", "切断", "重力"], type: "弓術 (プライム)" }
    ],
    Marksmanship: [
        { name: "ホットショット", attrs: ["溶解", "貫通"], type: "射撃 (初期)" },
        { name: "スプリットショット", attrs: ["振動", "貫通"], type: "射撃 (習得)" },
        { name: "スナイパーショット", attrs: ["溶解", "貫通"], type: "射撃 (習得)" },
        { name: "スラッグショット", attrs: ["振動", "貫通", "炸裂"], type: "射撃 (習得)" },
        { name: "ブラストショット", attrs: ["硬化", "貫通"], type: "射撃 (習得)" },
        { name: "ヘヴィショット", attrs: ["核熱"], type: "射撃 (習得)" },
        { name: "デトネーター", attrs: ["核熱", "貫通"], type: "射撃 (クエスト)" },
        { name: "ナビングショット", attrs: ["硬化", "炸裂", "衝撃"], type: "射撃 (習得)" },
        { name: "カラナック", attrs: ["闇", "分解"], type: "射撃 (レリック)" },
        { name: "トゥルーフライト", attrs: ["分解", "切断"], type: "射撃 (ミシック)" },
        { name: "レデンサリュート", attrs: ["重力", "貫通"], type: "射撃 (ミシック)" },
        { name: "ワイルドファイア", attrs: ["闇", "重力"], type: "射撃 (エンピ)" },
        { name: "ラストスタンド", attrs: ["核熱", "振動"], type: "射撃 (メリポ/イオニック)" },
        { name: "ジ・エンド", attrs: ["硬化", "振動", "核熱"], type: "射撃 (プライム)" }
    ]
};

// 2. 連携ルール判定マトリクス
// [トス属性][〆属性] = 発生連携 (FFXI公式仕様に完全準拠した真のマトリクス)
const chainMatrix = {
    // === Lv1トス属性からの遷移 ===
    "溶解": {
        "溶解": "溶解",
        "炸裂": "炸裂",
        "切断": "切断",
        "衝撃": "核熱",     // 溶解 ＞ 衝撃 ＝ 核熱
        "核熱": "核熱"      // 溶解 ＞ 核熱 ＝ 核熱 (〆同調)
    },
    "硬化": {
        "硬化": "硬化",
        "炸裂": "炸裂",
        "収縮": "収縮",
        "振動": "分解",     // 硬化 ＞ 振動 ＝ 分解
        "湾曲": "湾曲"      // 硬化 ＞ 湾曲 ＝ 湾曲 (〆同調)
    },
    "炸裂": {
        "炸裂": "炸裂",
        "溶解": "溶解",
        "切断": "切断",
        "硬化": "重力",     // 炸裂 ＞ 硬化 ＝ 重力
        "分解": "分解"      // 炸裂 ＞ 分解 ＝ 分解 (〆同調)
    },
    "切断": {
        "切断": "切断",
        "溶解": "湾曲",     // 切断 ＞ 溶解 ＝ 湾曲
        "炸裂": "炸裂",
        "重力": "重力"      // 切断 ＞ 重力 ＝ 重力 (〆同調)
    },
    "貫通": {
        "貫通": "貫通",
        "硬化": "硬化",
        "衝撃": "衝撃",
        "切断": "湾曲",     // 貫通 ＞ 切断 ＝ 湾曲
        "核熱": "核熱"      // 貫通 ＞ 核熱 ＝ 核熱 (〆同調)
    },
    "衝撃": {
        "衝撃": "衝撃",
        "硬化": "硬化",
        "貫通": "貫通",
        "溶解": "溶解",
        "炸裂": "核熱",     // 衝撃 ＞ 炸裂 ＝ 核熱
        "分解": "分解"      // 衝撃 ＞ 分解 ＝ 分解 (〆同調)
    },
    "振動": {
        "振動": "振動",
        "衝撃": "衝撃",
        "貫通": "貫通",
        "切断": "分解",     // 振動 ＞ 切断 ＝ 分解
        "湾曲": "湾曲"      // 振動 ＞ 湾曲 ＝ 湾曲 (〆同調)
    },
    "収縮": {
        "収縮": "収縮",
        "衝撃": "衝撃",
        "貫通": "重力",     // 収縮 ＞ 貫通 ＝ 重力
        "重力": "重力"      // 収縮 ＞ 重力 ＝ 重力 (〆同調)
    },
    
    // === Lv2トス属性からの遷移 ===
    "重力": {
        "湾曲": "闇",       // 重力 ＞ 湾曲 ＝ 闇 (Lv3)
        "闇": "闇",         // 重力 ＞ 闇 ＝ 闇 (Lv3)
        "収縮": "重力",     // 重力 ＞ 収縮 ＝ 重力 (トス同調)
        "切断": "重力"      // 重力 ＞ 切断 ＝ 重力 (トス同調)
    },
    "分解": {
        "核熱": "光",       // 分解 ＞ 核熱 ＝ 光 (Lv3)
        "光": "光",         // 分解 ＞ 光 ＝ 光 (Lv3)
        "炸裂": "分解",     // 分解 ＞ 炸裂 ＝ 分解 (トス同調)
        "衝撃": "分解"      // 分解 ＞ 衝撃 ＝ 分解 (トス同調)
    },
    "核熱": {
        "分解": "光",       // 核熱 ＞ 分解 ＝ 光 (Lv3)
        "光": "光",         // 核熱 ＞ 光 ＝ 光 (Lv3)
        "溶解": "核熱",     // 核熱 ＞ 溶解 ＝ 核熱 (トス同調)
        "貫通": "核熱"      // 核熱 ＞ 貫通 ＝ 核熱 (トス同調)
    },
    "湾曲": {
        "重力": "闇",       // 湾曲 ＞ 重力 ＝ 闇 (Lv3)
        "闇": "闇",         // 湾曲 ＞ 闇 ＝ 闇 (Lv3)
        "振動": "湾曲",     // 湾曲 ＞ 振動 ＝ 湾曲 (トス同調)
        "硬化": "湾曲"      // 湾曲 ＞ 硬化 ＝ 湾曲 (トス同調)
    }
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
function getSkillchainResult(tossAttrs, closeAttrs, ionicMode) {
    const candidates = [];
    
    // 発生し得るすべての連携候補をリストアップ
    for (const toss of tossAttrs) {
        for (const close of closeAttrs) {
            if (chainMatrix[toss] && chainMatrix[toss][close]) {
                const chain = chainMatrix[toss][close];
                
                // 連携の強さ（レベル）を判定
                let level = 1;
                if (chain === "極光" || chain === "黒闇") level = 4;
                else if (chain === "光" || chain === "闇") level = 3;
                else if (["湾曲", "分解", "重力", "核熱"].includes(chain)) level = 2;

                candidates.push({ name: chain, level: level, toss: toss, close: close });
            }
        }
    }
    
    // イオニック究極連携 (レベル4) の動的判定
    // イオニックAM3中かつ、トスに光があり、〆に光がある場合は「極光」、闇同士なら「黒闇」が発生する
    if (ionicMode === "IONIC_AM3") {
        if (tossAttrs.includes("光") && closeAttrs.includes("光")) {
            candidates.push({ name: "極光", level: 4, toss: "光", close: "光" });
        }
        if (tossAttrs.includes("闇") && closeAttrs.includes("闇")) {
            candidates.push({ name: "黒闇", level: 4, toss: "闇", close: "闇" });
        }
    }
    
    if (candidates.length === 0) return null;
    
    // FFXI公式仕様：発生する連携のうち、最もレベルの高い連携（Lv4 ＞ Lv3 ＞ Lv2 ＞ Lv1）を最優先する。
    // レベルが同じ場合は、WSの属性優先度順（先に見つかった配列順）を優先する。
    candidates.sort((a, b) => b.level - a.level);
    return candidates[0];
}

// イオニックウェポン装備かつAM3中において、武神流秘奥義（メリポWS）に属性を追加する関数
function getModifiedAttrs(ws, ionicMode) {
    if (!ws) return [];
    let attrs = [...ws.attrs];
    if (ionicMode === "IONIC_AM3" && ws.type && ws.type.includes("メリポ/イオニック")) {
        if (ws.attrs.includes("分解") || ws.attrs.includes("核熱")) {
            if (!attrs.includes("光")) {
                attrs.push("光");
            }
        }
        if (ws.attrs.includes("湾曲") || ws.attrs.includes("重力")) {
            if (!attrs.includes("闇")) {
                attrs.push("闇");
            }
        }
    }
    return attrs;
}

// 4. 逆引き探索ロジック (通常時とイオAM3時の両方の結果を同時に計算・取得する)
function searchSkillchains(weapon1, weapon2, targetChain) {
    const tossList = weaponWSData[weapon1] || [];
    const closeList = weaponWSData[weapon2] || [];
    const results = [];

    for (const tossWS of tossList) {
        for (const closeWS of closeList) {
            // ① 通常時の属性と計算
            const tossAttrsNormal = getModifiedAttrs(tossWS, "NORMAL");
            const closeAttrsNormal = getModifiedAttrs(closeWS, "NORMAL");
            const resultNormal = getSkillchainResult(tossAttrsNormal, closeAttrsNormal, "NORMAL");

            // ② イオAM3中の属性と計算
            const tossAttrsIonic = getModifiedAttrs(tossWS, "IONIC_AM3");
            const closeAttrsIonic = getModifiedAttrs(closeWS, "IONIC_AM3");
            const resultIonic = getSkillchainResult(tossAttrsIonic, closeAttrsIonic, "IONIC_AM3");

            // どちらも連携が発生しない場合はスキップ
            if (!resultNormal && !resultIonic) continue;

            // ターゲット連携フィルター
            let isMatch = false;
            if (targetChain === "ANY") {
                isMatch = true;
            } else if (targetChain === "Lv1") {
                isMatch = ((resultNormal && resultNormal.level === 1) || (resultIonic && resultIonic.level === 1));
            } else if (targetChain === "極光" || targetChain === "黒闇") {
                // 極光・黒闇はイオAM3限定なので、ionic時の名前とマッチ
                isMatch = (resultIonic && resultIonic.name === targetChain);
            } else {
                // 通常の連携（光、闇、湾曲など）
                isMatch = ((resultNormal && resultNormal.name === targetChain) || (resultIonic && resultIonic.name === targetChain));
            }

            if (isMatch) {
                results.push({
                    tossNormal: { ...tossWS, attrs: tossAttrsNormal },
                    closeNormal: { ...closeWS, attrs: closeAttrsNormal },
                    tossIonic: { ...tossWS, attrs: tossAttrsIonic },
                    closeIonic: { ...closeWS, attrs: closeAttrsIonic },
                    chainNormal: resultNormal,
                    chainIonic: resultIonic
                });
            }
        }
    }

    // 連携レベルが高い順にソート（イオAM3時のレベルを優先）
    return results.sort((a, b) => {
        const lvA = a.chainIonic ? a.chainIonic.level : (a.chainNormal ? a.chainNormal.level : 0);
        const lvB = b.chainIonic ? b.chainIonic.level : (b.chainNormal ? b.chainNormal.level : 0);
        return lvB - lvA;
    });
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
            
            // イオAM3時の連携に応じたカードクラスの決定（イオAM3をメインデザインに）
            const mainChain = res.chainIonic || res.chainNormal;
            let chainClass = "chain-level1";
            if (mainChain.name === "光" || mainChain.name === "極光") chainClass = "chain-light";
            else if (mainChain.name === "闇" || mainChain.name === "黒闇") chainClass = "chain-dark";
            else if (mainChain.name === "核熱") chainClass = "chain-fusion";
            else if (mainChain.name === "湾曲") chainClass = "chain-distortion";
            else if (mainChain.name === "重力") chainClass = "chain-gravitation";
            else if (mainChain.name === "分解") chainClass = "chain-fragmentation";

            card.className = `sc-card ${chainClass}`;
            card.style.animationDelay = `${index * 0.05}s`;

            // MB要素の組み立て (通常時)
            const mbListNormal = res.chainNormal ? (mbElements[res.chainNormal.name] || []) : [];
            let mbNormalHTML = "";
            mbListNormal.forEach(el => {
                const elClass = elementClasses[el] || "";
                mbNormalHTML += `<span class="mb-el ${elClass}">${el}</span>`;
            });

            // MB要素の組み立て (イオAM3時)
            const mbListIonic = res.chainIonic ? (mbElements[res.chainIonic.name] || []) : [];
            let mbIonicHTML = "";
            mbListIonic.forEach(el => {
                const elClass = elementClasses[el] || "";
                mbIonicHTML += `<span class="mb-el ${elClass}">${el}</span>`;
            });

            // WS属性の文字列表記（AM3による新規追加属性には足跡マーク🐾を付与）
            function getWSAttrsHTML(normalWS, ionicWS) {
                let parts = [];
                ionicWS.attrs.forEach(attr => {
                    const isAdded = !normalWS.attrs.includes(attr);
                    if (isAdded) {
                        parts.push(`<span class="attr-added" title="イオAM3中の追加属性">${attr}🐾</span>`);
                    } else {
                        parts.push(attr);
                    }
                });
                return parts.join('/');
            }

            const tossAttrsStr = getWSAttrsHTML(res.tossNormal, res.tossIonic);
            const closeAttrsStr = getWSAttrsHTML(res.closeNormal, res.closeIonic);

            // 連携名・レベル表示文字列の決定
            const normalName = res.chainNormal ? `【${res.chainNormal.name}連携】` : "なし";
            const normalLv = res.chainNormal ? `Lv${res.chainNormal.level}` : "";
            const ionicName = res.chainIonic ? `【${res.chainIonic.name === "黒闇" ? "極闇/黒闇" : res.chainIonic.name}連携】` : "なし";
            const ionicLv = res.chainIonic ? `Lv${res.chainIonic.level}` : "";

            card.innerHTML = `
                <div class="sc-badge-row sc-double-header">
                    <div class="sc-header-side">
                        <span class="sc-mode-label">通常武器</span>
                        <span class="sc-name-small">${normalName}</span>
                        <span class="sc-level-small">${normalLv}</span>
                    </div>
                    <div class="sc-header-divider"></div>
                    <div class="sc-header-side highlight-side">
                        <span class="sc-mode-label label-ionic">イオAM3中 🐾</span>
                        <span class="sc-name-big ${chainClass}">${ionicName}</span>
                        <span class="sc-level-big">${ionicLv}</span>
                    </div>
                </div>
                
                <div class="ws-steps">
                    <div class="ws-step">
                        <span class="ws-num">1</span>
                        <div>
                            <span class="ws-name">${res.tossNormal.name}</span>
                            <span class="ws-type">（${res.tossNormal.type} ［${tossAttrsStr}］）</span>
                        </div>
                    </div>
                    <div class="ws-step">
                        <span class="ws-num">2</span>
                        <div>
                            <span class="ws-name">${res.closeNormal.name}</span>
                            <span class="ws-type">（${res.closeNormal.type} ［${closeAttrsStr}］）</span>
                        </div>
                    </div>
                </div>
                
                <div class="mb-double-row">
                    <div class="mb-half">
                        <span class="mb-label-small">🔥 通常MB:</span>
                        <div class="mb-elements-small">
                            ${mbNormalHTML || '<span class="mb-el">なし</span>'}
                        </div>
                    </div>
                    <div class="mb-half font-ionic-mb">
                        <span class="mb-label-small">🔥 AM3中MB:</span>
                        <div class="mb-elements-small">
                            ${mbIonicHTML || '<span class="mb-el">なし</span>'}
                        </div>
                    </div>
                </div>
            `;

            resultsList.appendChild(card);
        });
    });

    // 初回ロード時にも自動的に探索を実行する（親切設計）
    btnSearch.click();
});
