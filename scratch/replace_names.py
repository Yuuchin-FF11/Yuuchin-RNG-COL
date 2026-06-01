import re

file_path = "articles/sortie_corsair_aminon.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. ソーティ（Sortie） -> ソーティ
content = content.replace("ソーティ（Sortie）", "ソーティ")

# 2. Aminon (Hard Mode / 強バージョン) -> アミノン（強バージョン）
content = content.replace("Aminon (Hard Mode / 強バージョン)", "アミノン（強バージョン）")

# 3. Aminon (Hard Mode) -> アミノン（強バージョン）
content = content.replace("Aminon (Hard Mode)", "アミノン（強バージョン）")

# 4. アミノン（Aminon） -> アミノン
content = content.replace("アミノン（Aminon）", "アミノン")

# 5. コルセア（COR） -> コルセア
content = content.replace("コルセア（COR）", "コルセア")

# 6. その他の Aminon -> アミノン
content = re.sub(r'Aminon', 'アミノン', content, flags=re.IGNORECASE)

with open(file_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Replacement complete for Japanese article!")
