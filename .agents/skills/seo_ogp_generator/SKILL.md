---
name: seo_ogp_generator
description: 攻略記事やツールの新規作成・更新時に、検索流入（SEO）やSNSシェア（X/Twitter等）で見栄えを最大化するためのOGPメタタグ・要約文を自動生成・検証するスキル。
---

# SEO・OGP自動生成スキル

## このスキルの目的
新しい攻略記事やアプリが公開された際、検索エンジンやSNS（X等）で魅力的に表示されるように、適切なメタタグ（Title, Description, OGP, Twitter Card）を自動生成・設定する。

## 発動契機
- 攻略記事（`記事/*.md`）を作成または更新したとき
- HTMLページ（`index.html`, `article.html` 等）を新設または更新したとき
- 「SEO設定をして」「SNSシェアの設定をして」と指示されたとき

## 実行手順
1. 【要約文（Description）の作成】:
   - 記事またはページの内容を精査し、検索結果でクリックしたくなる100〜120文字の要約文を生成する。
2. 【OGPタグの構成】:
   ```html
   <meta name="description" content="【要約文】">
   <meta property="og:title" content="【ページタイトル】 | Hunt & Gamble">
   <meta property="og:description" content="【要約文】">
   <meta property="og:type" content="article">
   <meta property="og:image" content="https://yuuchin-ff11.github.io/Yuuchin-RNG-COL/【画像パス】">
   <meta name="twitter:card" content="summary_large_image">
   ```
3. 【画像（og:image）の適切な選定】:
   - 記事に応じた適切なサムネイル画像（`画像素材/` 配下の公式素材や生成画像）を特定し、ダミーリンクではなく実在する画像パスを割り当てる。
4. 【日英両対応の同期】:
   - 英語版（`*_en`）がある場合は、英語用の description および og:title も同様に生成・反映する。
