$c = Get-Content styles.css
$header = ':root {',
    '    --primary-color: #0d47a1; /* メインカラー（紺） */',
    '    --secondary-color: #1a237e; /* セカンダリカラー */',
    '    --accent-color: #ffd700; /* アクセントカラー（金） */',
    '    --text-light: #f1f1f1;',
    '    --text-dark: #333333;',
    '    --glass-bg: rgba(16, 32, 48, 0.4);',
    '    --glass-border: rgba(255, 255, 255, 0.15);',
    '    --bg-gradient: linear-gradient(135deg, #051937 0%, #004d7a 50%, #008793 100%);',
    '    --sp-color: #ffd700; /* SPアビリティ（金・発光） */',
    '    --ability-color: #4dd0e1; /* アビリティ用（水色） */',
    '    --ws-color: #ffb74d; /* WS用（オレンジ） */',
    '    --magic-color: #f48fb1; /* 魔法用（ピンク） */',
    '}',
    ''
$rest = $c[16..($c.Length - 1)]
$new = $header + $rest
Set-Content -Path styles.css -Value $new -Encoding utf8
