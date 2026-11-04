$games = @(
    @{ name="Minecraft"; id="3041" },
    @{ name="Valorant"; id="33454" },
    @{ name="Fortnite"; id="26649" },
    @{ name="Genshin Impact"; id="36622" },
    @{ name="League of Legends"; id="2603" }
)

foreach ($g in $games) {
    $url = "https://www.steamgriddb.com/game/$($g.id)"
    try {
        $html = Invoke-RestMethod -Uri $url -Headers @{"User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        
        # Match grid images from the game asset page
        $matches = [regex]::Matches($html, 'https://cdn2\.steamgriddb\.com/grid/\d+\.(jpg|png|webp|jpeg)')
        if ($matches.Count -gt 0) {
            Write-Host "$($g.name) -> $($matches[0].Value)"
        } else {
            Write-Host "$($g.name) -> NOT FOUND"
        }
    } catch {
        Write-Host "Error for $($g.name): $_"
    }
}
