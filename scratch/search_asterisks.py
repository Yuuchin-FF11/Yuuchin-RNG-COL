import os

def search_files(directory):
    encodings = ['utf-8', 'shift_jis', 'euc-jp', 'cp932']
    target_extensions = ['.md', '.html', '.js', '.css']
    
    for root, dirs, files in os.walk(directory):
        if '.git' in root or '.vscode' in root or '.agent' in root:
            continue
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in target_extensions:
                continue
            
            filepath = os.path.join(root, file)
            # Try different encodings
            content = None
            for encoding in encodings:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        content = f.read()
                        break
                except UnicodeDecodeError:
                    continue
            
            if content is None:
                print(f"Could not read {filepath}")
                continue
                
            # Search for ※※ or ※
            if '※※' in content:
                print(f"FOUND ※※ in {filepath}:")
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if '※※' in line:
                        print(f"  Line {i+1}: {line}")
            
            # Also count single ※ occurrence to see if there's any pattern like ※text※
            # Let's search for a pattern where a word is surrounded by ※
            import re
            matches = re.findall(r'※[^※\n]+※', content)
            if matches:
                print(f"FOUND ※text※ pattern in {filepath}:")
                for match in matches:
                    print(f"  Match: {match}")

search_files(r'c:\Users\user\OneDrive\デスクトップ\HP')
