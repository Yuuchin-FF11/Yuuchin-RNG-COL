import re
import os

def fix_updates_html(path):
    if not os.path.exists(path):
        print(f"Error: {path} not found.")
        return
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 1. flex-wrap: wrap を align-items: flex-start に文字列置換
    content = content.replace("display: flex; flex-wrap: wrap;", "display: flex; align-items: flex-start;")
    
    # 2. min-width: 100px; を min-width: 100px; flex-shrink: 0; に文字列置換
    content = content.replace("min-width: 100px;\"", "min-width: 100px; flex-shrink: 0;\"")
    content = content.replace("min-width: 100px;\">", "min-width: 100px; flex-shrink: 0;\">")
    
    # 3. リンクやテキストを <div style="flex: 1;"> で包む
    pattern = re.compile(
        r'(?s)(<li style="[^"]*display:\s*flex;\s*align-items:\s*flex-start;[^"]*">\s*'
        r'<span style="[^"]*flex-shrink:\s*0;[^"]*">.*?</span>)\s*'
        r'(.*?)\s*'
        r'(</li>)'
    )
    
    def repl(match):
        part1 = match.group(1)
        part2 = match.group(2)
        part3 = match.group(3)
        
        # すでに包まれている場合は置換しない
        if 'div style="flex: 1;"' in part2 or "div style='flex: 1;'" in part2:
            return match.group(0)
            
        return f"{part1}\n                            <div style=\"flex: 1;\">\n                                {part2.strip()}\n                            </div>\n                        {part3}"
        
    content = re.sub(pattern, repl, content)
    
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
        
    print(f"Successfully upgraded updates layout in {path}!")

fix_updates_html("index.html")
fix_updates_html("index_en.html")
