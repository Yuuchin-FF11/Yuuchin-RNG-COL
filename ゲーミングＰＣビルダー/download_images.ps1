$dir = "c:\Users\user\OneDrive\デスクトップ\HP\game-pc-builder\images"
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force
}

$urls = @{
    "minecraft" = "https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,dpr_2.0,f_auto,g_center,w_600/bcom/ja_JP/games/switch/m/minecraft-switch/hero"
    "apex_legends" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg"
    "counter_strike_2" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg"
    "valorant" = "https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt12c6ab8f070fb6cb/5ebbca8997ef054a1d7fbb5a/VALORANT_1920x1080_Red.jpg"
    "fortnite" = "https://cdn2.unrealengine.com/fortnite-battle-royale-key-art-1920x1080-2a8d11c79a95.jpg"
    "pubg" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg"
    "monster_hunter_wilds" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg"
    "rust" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg"
    "gta5" = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg"
    "genshin" = "https://fastcdn.hoyoverse.com/content-v2/gip/100414/0971a81dc1c1f4ab986cb0075d9f04bb.jpg"
    "lol" = "https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt5be56d7870a41d99/5db06037a35607062402d689/game_icon_lol.jpg"
}

foreach ($key in $urls.Keys) {
    $url = $urls[$key]
    $outPath = Join-Path $dir "$key.jpg"
    Write-Host "Downloading $key..."
    try {
        # Use Invoke-WebRequest with User-Agent to bypass standard hotlinking blocks
        Invoke-WebRequest -Uri $url -OutFile $outPath -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        Write-Host "Success: $key"
    } catch {
        Write-Host "Failed: $_"
    }
}
