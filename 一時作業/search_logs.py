import os
import json

search_dir = r"C:\Users\user\.gemini\antigravity\brain"
keywords = ["ビックリ", "制限", "リセット", "赤の剣", "剣", "画像生成"]

print("Searching in:", search_dir)

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith("transcript.jsonl") or file.endswith("transcript_full.jsonl"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        for kw in keywords:
                            if kw in line:
                                try:
                                    data = json.loads(line)
                                    content = data.get("content", "")
                                    if kw in content:
                                        # 不要なメタデータを省く
                                        if "USER_REQUEST" in content or "MODEL" in data.get("source", ""):
                                            print(f"File: {os.path.basename(os.path.dirname(os.path.dirname(filepath)))} / {file} (Line {line_num})")
                                            print(f"Found keyword '{kw}':")
                                            idx = content.find(kw)
                                            start = max(0, idx - 100)
                                            end = min(len(content), idx + 200)
                                            print(f"...{content[start:end]}...")
                                            print("-" * 50)
                                except Exception:
                                    if kw in line:
                                        print(f"File: {filepath} (Line {line_num})")
                                        print(f"Raw match '{kw}': {line[:200]}")
                                        print("-" * 50)
            except Exception as e:
                pass
