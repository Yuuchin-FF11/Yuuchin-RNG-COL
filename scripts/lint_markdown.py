import sys
import re

def lint_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        match = re.match(r'^(\s*)・(.*)', line)
        if match:
            indent = match.group(1)
            rest = match.group(2)
            line = f"{indent}- {rest}"
            modified = True
            
        if line.strip().startswith('#####') or line.strip().startswith('######'):
            print(f"[Warning] Line {i+1}: Found Level 5 or higher heading. Headings above Level 4 may display incorrectly. Please consider changing to Level 4 (####).")
            print(f"          -> {line}")
            
        new_lines.append(line)
        
    i = 0
    final_lines = []
    while i < len(new_lines):
        current_line = new_lines[i]
        
        if current_line.strip().startswith('-'):
            if len(final_lines) > 0:
                prev_line = final_lines[-1]
                if prev_line.strip() != "" and not prev_line.strip().startswith('-') and not prev_line.strip().startswith('#'):
                    final_lines.append("")
                    modified = True
                    
        final_lines.append(current_line)
        i += 1
        
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(final_lines))
        print(f"[SUCCESS] Automatically fixed markdown style issues in '{filepath}'.")
        return True
    else:
        print(f"[SUCCESS] No critical style issues found in '{filepath}'.")
        return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python lint_markdown.py <filepath>")
        sys.exit(1)
        
    success = lint_file(sys.argv[1])
    sys.exit(0 if success else 1)
