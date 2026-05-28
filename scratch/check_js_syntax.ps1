# Verify JavaScript bracket structure by removing comments, string literals, and regex literals to ensure syntax health.

function Verify-JsSyntax ($filePath) {
    Write-Host "--- Verification of $filePath ---"
    
    $content = Get-Content -Raw -Path $filePath
    $js = [regex]::Match($content, '(?s)<script type="module">(.*?)</script>').Groups[1].Value
    
    if (-not $js) {
        Write-Host "Error: <script type='module'> block not found."
        return
    }

    # 1. Remove block comments (/* ... */)
    $js = $js -replace '(?s)/\*.*?\*/', ''

    # 2. Remove single line comments (// ...)
    $js = $js -replace '//.*?\r?\n', "`n"

    # 3. Remove template literals (`...`)
    $js = $js -replace '(?s)`.*?`', '``'

    # 4. Remove double quoted strings ("...")
    $js = $js -replace '"(?:[^"\\]|\\.)*"', '""'

    # 5. Remove single quoted strings ('...')
    $js = $js -replace "'(?:[^'\\]|\\.)*'", "''"

    # 6. Remove regular expressions (/.../)
    $js = $js -replace '/(?:[^/\\\r\n]|\\.)+/g?', '/'

    # 7. Check structural brackets
    $chars = $js.ToCharArray()
    $stackBrace = [System.Collections.Generic.Stack[int]]::new()
    $stackBracket = [System.Collections.Generic.Stack[int]]::new()
    $stackParen = [System.Collections.Generic.Stack[int]]::new()
    
    $errors = 0
    $lineNum = 1
    $colNum = 0

    for ($i = 0; $i -lt $chars.Length; $i++) {
        $char = $chars[$i]
        $colNum++
        if ($char -eq "`n") {
            $lineNum++
            $colNum = 0
            continue
        }

        # Braces {}
        if ($char -eq '{') {
            $stackBrace.Push($lineNum)
        } elseif ($char -eq '}') {
            if ($stackBrace.Count -eq 0) {
                Write-Host "Syntax Error: Too many closing braces '}' at Line $lineNum"
                $errors++
            } else {
                [void]$stackBrace.Pop()
            }
        }

        # Brackets []
        if ($char -eq '[') {
            $stackBracket.Push($lineNum)
        } elseif ($char -eq ']') {
            if ($stackBracket.Count -eq 0) {
                Write-Host "Syntax Error: Too many closing brackets ']' at Line $lineNum"
                $errors++
            } else {
                [void]$stackBracket.Pop()
            }
        }

        # Parens ()
        if ($char -eq '(') {
            $stackParen.Push($lineNum)
        } elseif ($char -eq ')') {
            if ($stackParen.Count -eq 0) {
                Write-Host "Syntax Error: Too many closing parens ')' at Line $lineNum"
                $errors++
            } else {
                [void]$stackParen.Pop()
            }
        }
    }

    # Report unclosed brackets
    while ($stackBrace.Count -gt 0) {
        $line = $stackBrace.Pop()
        Write-Host "Syntax Error: Unclosed brace '{' opened at Line $line"
        $errors++
    }
    while ($stackBracket.Count -gt 0) {
        $line = $stackBracket.Pop()
        Write-Host "Syntax Error: Unclosed bracket '[' opened at Line $line"
        $errors++
    }
    while ($stackParen.Count -gt 0) {
        $line = $stackParen.Pop()
        Write-Host "Syntax Error: Unclosed paren '(' opened at Line $line"
        $errors++
    }

    if ($errors -eq 0) {
        Write-Host "Result: SUCCESS! All bracket pairs match perfectly. Syntax errors: 0"
    } else {
        Write-Host "Result: FAILED. Syntax errors found: $errors"
    }
    Write-Host "-------------------------------------------`n"
}

Verify-JsSyntax "article.html"
Verify-JsSyntax "article_en.html"
