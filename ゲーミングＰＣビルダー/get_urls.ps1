$files = @(
    "File:Minecraft cover art1.3.png",
    "File:Minecraft key art.jpg",
    "File:Valorant key art.jpg",
    "File:Valorant cover art.jpg",
    "File:Valorant concept art.jpg",
    "File:Fortnite battle royale carrier.jpg",
    "File:Fortnite cover art.jpg",
    "File:Fortnite key art.jpg",
    "File:Genshin Impact key art.jpg",
    "File:Genshin Impact cover art.jpg",
    "File:Genshin Impact cover.jpg"
)

foreach ($f in $files) {
    $encoded = [Uri]::EscapeDataString($f)
    $url = "https://commons.wikimedia.org/w/api.php?action=query&titles=$encoded&prop=imageinfo&iiprop=url&format=json"
    try {
        $resp = Invoke-RestMethod -Uri $url -Headers @{"User-Agent"="Mozilla/5.0"}
        $pages = $resp.query.pages
        foreach ($key in $pages.PSObject.Properties.Name) {
            $page = $pages.$key
            if ($page.imageinfo) {
                Write-Host "$f -> $($page.imageinfo[0].url)"
            }
        }
    } catch {
        Write-Host "Error: $_"
    }
}
