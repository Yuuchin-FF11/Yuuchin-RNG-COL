# SEO・OGP自動生成スキル (SEO & OGP Auto-Generator)

## 概要
新しい記事（Markdown等）が作成されたり、内容が大幅に更新されたりした際に、その記事の内容を要約し、検索エンジン（SEO）やSNS（Twitter等）でシェアされた際の見栄えを良くするための OGP (Open Graph Protocol) タグや Meta Description を自動生成・付与するスキルです。

## 発動条件
- ユーザーから「SEOの設定をして」「Twitterでシェアできるようにして」「OGPを追加して」と指示されたとき。
- 新しい攻略記事（例：ソーティ攻略、ジェール攻略など）を作成・完成させたとき。

## アクション内容
1. 記事の内容を読み込み、100文字〜120文字程度の魅力的な要約文（description）を自動生成する。
2. 対象記事がHTMLファイルに変換されるか、既存の `index.html` などの `<head>` 内に以下のようなメタタグを追記する処理を行う。
   ```html
   <meta name="description" content="【自動生成された要約文】">
   <meta property="og:title" content="【記事のタイトル】 | Hunt & Gamble">
   <meta property="og:description" content="【自動生成された要約文】">
   <meta property="og:type" content="article">
   <meta property="og:image" content="https://your-domain.com/assets/images/【適切な画像名】.jpg">
   <meta name="twitter:card" content="summary_large_image">
   ```
3. OGPの画像が指定されていない場合は、既存の `assets/images/` の中から最も適切な画像（ボス画像やジョブ画像）を自動選択して割り当てる。
4. 処理完了後、自動コミット＆プッシュを行い、「検索エンジンやTwitter向けのシェア設定（OGP）を完了したよ！」と報告する。
