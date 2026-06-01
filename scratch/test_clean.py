import re
import os

file_path = r"c:\Users\user\OneDrive\デスクトップ\HP\articles\sortie_corsair_aminon.md"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines, 1):
    original = line
    # 1. 22行目の特殊ケース
    if i == 22:
        line = line.replace("戦闘中「常にアブゾタックを交互に回し続け、敵のTPを完全に0に吸い取り続ける」**ことが", "戦闘中「常にアブゾタックを交互に回し続け、敵のTPを完全に0に吸い取り続ける」ことが")
    # 2. 42行目の特殊ケース
    if i == 42:
        line = line.replace("通常時は意図的に「後ろ向き」になってオートアタックを完全に遮断（不発）させつつ**、", "通常時は意図的に「後ろ向き」になってオートアタックを完全に遮断（不発）させつつ、")

    # 3. **「...」** や **「...」 のようなケースの太字解除
    line = re.sub(r'\*\*「([^」]+)」\*\*', r'「\1」', line)
    line = re.sub(r'「([^」]+)」\*\*', r'「\1」', line)
    line = re.sub(r'\*\*「([^」]+)」', r'「\1」', line)

    # 4. 箇条書きのキーにおける太字解除: *   **項目**: -> *   項目:
    line = re.sub(r'\*\s+\*\*([^*:\s]+)\*\*:', r'*   \1:', line)
    # インデントされた箇条書き
    line = re.sub(r'(\s+)\*\s+\*\*([^*:\s]+)\*\*:', r'\1*   \2:', line)

    # 5. 表の中の太字解除: | **サポ竜 (DRG)** | -> | サポ竜 (DRG) |
    line = re.sub(r'\|\s+\*\*([^*]+)\*\*\s+\|', r'| \1 |', line)

    # 6. その他の太字を「」に置き換える、あるいはそのまま平文にする
    # 個別に設定する
    if i == 3:
        line = line.replace("**Aminon (Hard Mode / 強バージョン)**", "「Aminon (Hard Mode / 強バージョン)」")
    elif i == 9:
        line = line.replace("**物理削り＆アブゾタックTP管理構成**", "「物理削り＆アブゾタックTP管理構成」")
    elif i == 48:
        line = line.replace("**Aminonの極めて高い魔法回避率（魔回避）の前では、生半可な状態ではアブゾタックは高確率でレジスト（失敗）されます。**", "Aminonの極めて高い魔法回避率（魔回避）の前では、生半可な状態ではアブゾタックは高確率でレジスト（失敗）されます。")
    elif i == 54:
        line = line.replace("**フラズル (Frazzle)**", "「フラズル (Frazzle)」")
    elif i == 55:
        line = line.replace("**闇のスレノディ (Dark Threnody / 闇スレ)**", "「闇のスレノディ (Dark Threnody / 闇スレ)」")
    elif i == 70:
        line = line.replace("**物理命中 ＋90** ＆ **魔法命中（魔命） ＋90**", "物理命中 ＋90 ＆ 魔法命中（魔命） ＋90")
    elif i == 73:
        line = line.replace("**タック担当メンバー（コ・赤・吟・風）全員**", "「タック担当メンバー（コ・赤・吟・風）全員」")
    elif i == 77:
        line = line.replace("**ナイト (PLD)** や **踊り子 (DNC)**", "ナイト (PLD) や 踊り子 (DNC)")
        line = line.replace("**それぞれの役割に特化した個別個人の食事（別の食事）**", "それぞれの役割に特化した個別個人の食事（別の食事）")
    elif i == 91:
        line = line.replace("**ジャンプ系アビリティ**", "「ジャンプ系アビリティ」")
    elif i == 92:
        line = line.replace("**ステップ**", "「ステップ」")
        line = line.replace("**FM（フィニッシングムーブ）**", "「FM（フィニッシングムーブ）」")
    elif i == 93:
        line = line.replace("**R.フラリッシュ (Reverse Flourish)**", "「R.フラリッシュ (Reverse Flourish)」")
    elif i == 94:
        line = line.replace("**C.フラリッシュ (Climactic Flourish)**", "「C.フラリッシュ (Climactic Flourish)」")
    elif i == 97:
        line = line.replace("**スーパージャンプ (Super Jump)**", "「スーパージャンプ (Super Jump)」")
    elif i == 101:
        line = line.replace("**後衛・支援陣（コ・赤・吟・風）は戦闘中, 絶対にAminonを通常攻撃（オートアタック）で殴ってはいけません。**", "後衛・支援陣（コ・赤・吟・風）は戦闘中、絶対にAminonを通常攻撃（オートアタック）で殴ってはいけません。")
    elif i == 102:
        line = line.replace("**タクティクスロールによる自動リゲイン ＋ アブゾタック（吸い取ったTPが自身に入る効果） ＋ クイックドロー**", "「タクティクスロールによる自動リゲイン ＋ アブゾタック（吸い取ったTPが自身に入る効果） ＋ クイックドロー」")
    elif i == 112:
        line = line.replace("**インデアチューン**", "「インデアチューン」")
        line = line.replace("**インデプレシジョン**", "「インデプレシジョン」")
    elif i == 115:
        line = line.replace("**ボルスター**", "「ボルスター」")
        line = line.replace("**「戦闘開始直後（開幕から）」**", "「戦闘開始直後（開幕から）」")
    elif i == 126:
        line = line.replace("**メヌエットV、メヌエットIV、メヌエットIII**", "「メヌエットV」「メヌエットIV」「メヌエットIII」")
    elif i == 127:
        line = line.replace("**剣豪のマドリガル**", "「剣豪のマドリガル」")
        line = line.replace("**騎兵のマドリガル**", "「騎兵のマドリガル」")
    elif i == 131:
        line = line.replace("**「戦闘中の2回目の歌をかけ直す時」**", "「戦闘中の2回目の歌をかけ直す時」")
    elif i == 136:
        line = line.replace("**「ワイルドカード」**", "「ワイルドカード」")
    elif i == 138:
        line = line.replace("**「その直前の瞬間」**", "「その直前の瞬間」")
        line = line.replace("**ソウルボイスを発動して5曲の歌をボス戦の後半に向けて完璧にかけ直します。**", "ソウルボイスを発動して5曲の歌をボス戦の後半に向けて完璧にかけ直します。")
    elif i == 142:
        line = line.replace("**吟遊詩人が今まさに使用したばかりの「ソウルボイス」のリキャストが即座にリセット（0分）**", "吟遊詩人が今まさに使用したばかりの「ソウルボイス」のリキャストが即座にリセット（0分）")
    elif i == 146:
        line = line.replace("**最も難易度が高く過酷なのは「赤魔道士」**", "最も難易度が高く過酷なのは「赤魔道士」")
    elif i == 147:
        line = line.replace("**ヘイストII**、**ファランクスII**、**リフレシュIII**", "「ヘイストII」「ファランクスII」「リフレシュIII」")
    elif i == 150:
        line = line.replace("**インパクト**", "「インパクト」")
    elif i == 167:
        line = line.replace("**クルケッドカード**", "「クルケッドカード」")
    elif i == 168:
        line = line.replace("**ランダムディール**", "「ランダムディール」")
    elif i == 169:
        line = line.replace("**クルケッドカード**", "「クルケッドカード」")
    elif i == 178:
        line = line.replace("**タクティクスロール**", "「タクティクスロール」")
    elif i == 179:
        line = line.replace("**クイックドロー**", "「クイックドロー」")
    elif i == 182:
        line = line.replace("**「同じウェポンスキル（WS）を連続で撃ち続けると、そのWSに対する強烈な累積耐性がつき、与ダメージが著しく低下する」**", "「同じウェポンスキル（WS）を連続で撃ち続けると、そのWSに対する強烈な累積耐性がつき、与ダメージが著しく低下する」")
    elif i == 190:
        line = line.replace("**ロイエ**", "「ロイエ」")
        line = line.replace("**WSは撃たなくても問題ありません。**", "WSは撃たなくても問題ありません。")
    elif i == 191:
        line = line.replace("**サベッジブレード**", "「サベッジブレード」")
    elif i == 192:
        line = line.replace("**ルースレスストローク**", "「ルースレスストローク」")
        line = line.replace("**ルドラストーム**", "「ルドラストーム」")
    elif i == 193:
        line = line.replace("**ブラックヘイロー**", "「ブラックヘイロー」")
    elif i == 194:
        line = line.replace("**モーダントライム**", "「モーダントライム」")
    elif i == 195:
        line = line.replace("**ジャッジメント**", "「ジャッジメント」")
        line = line.replace("**フラッシュノヴァ**", "「フラッシュノヴァ」")
    elif i == 211:
        line = line.replace("**ライトショット**", "「ライトショット」")
    elif i == 212:
        line = line.replace("**アイスショット**", "「アイスショット」")
    elif i == 215:
        line = line.replace("**必ずエンピリアン足防具（ＣＳソルレット+3 / シャスーソルレット+3等）を装備**", "必ずエンピリアン足防具（ＣＳソルレット+3 / シャスーソルレット+3等）を装備")
    elif i == 253:
        line = line.replace("**過剰な被ダメカットによる「王将の手袋」ペナルティの相殺**", "過剰な被ダメカットによる「王将の手袋」ペナルティの相殺")
    elif i == 256:
        line = line.replace("**一瞬の被弾すら力に変えるTP効率の追求**", "一瞬の被弾すら力に変えるTP効率の追求")
    elif i == 258:
        line = line.replace("**無駄を削ぎ落とした「魔防」アクセサリーの組み込み**", "無駄を削ぎ落とした「魔防」アクセサリーの組み込み")
    elif i == 320:
        line = line.replace("**前衛で立ち回りつつサポ暗アブゾタックを通すための限界ブースト**", "前衛で立ち回りつつサポ暗アブゾタックを通すための限界ブースト")
    elif i == 322:
        line = line.replace("**エンピリアン最上位「ＣＳ装束+3」のフル採用による魔命の圧倒的暴力**", "エンピリアン最上位「ＣＳ装束+3」のフル採用による魔命の圧倒的暴力")
    elif i == 324:
        line = line.replace("**「無シリーズ（喉輪・外装・腰当）」の3点コンプリートによる最上位魔命ブースト**", "「無シリーズ（喉輪・外装・腰当）」の3点コンプリートによる最上位魔命ブースト")
    elif i == 326:
        line = line.replace("**「昏黄の耳」「シャスーピアス+2」＆「スティキニリング+1」のダブル装備**", "「昏黄の耳」「シャスーピアス+2」＆「スティキニリング+1」のダブル装備")
    elif i == 328:
        line = line.replace("**⚠️ 実戦における極めて重要なパーティ連携**", "⚠️ 実戦における極めて重要なパーティ連携")

    # その他の残った ** を削除
    line = line.replace("**", "")

    if original != line:
        print(f"Line {i}:")
        print(f"  - {original.strip()}")
        print(f"  + {line.strip()}")
    
    new_lines.append(line)

# テストなので、問題なければ書き換えを行う
# with open(file_path, "w", encoding="utf-8") as f:
#     f.writelines(new_lines)
