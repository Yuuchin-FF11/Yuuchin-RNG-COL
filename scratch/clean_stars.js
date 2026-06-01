const fs = require('fs');
const path = require('path');

const articlesDir = 'c:\\Users\\user\\OneDrive\\デスクトップ\\HP\\articles';

// articlesディレクトリ内の日本語版マークダウンファイル（_en.md 以外の .md）を取得
const files = fs.readdirSync(articlesDir)
  .filter(file => file.endsWith('.md') && !file.endsWith('_en.md'))
  .map(file => path.join(articlesDir, file));

// ワークスペース直下のHTMLファイルを追加
const rootDir = 'c:\\Users\\user\\OneDrive\\デスクトップ\\HP';
const htmlFiles = fs.readdirSync(rootDir)
  .filter(file => file.endsWith('.html') && !file.endsWith('_en.html'))
  .map(file => path.join(rootDir, file));

const allFiles = [...files, ...htmlFiles];

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // マークダウンの太字表現をカギカッコや強調なしに綺麗に置換します
  content = content.replace(/\*\*「([^」]+)」\*\*/g, '「$1」');
  content = content.replace(/「([^」]+)」\*\*/g, '「$1」');
  content = content.replace(/\*\*「([^」]+)」/g, '「$1」');

  // *   **項目**: -> *   項目: のパターン
  content = content.replace(/\*\s+\*\*([^*:\s]+)\*\*:/g, '*   $1:');

  // 残った **テキスト** を「テキスト」に置換
  content = content.replace(/\*\*([^*]+)\*\*/g, '「$2」'); 
  // ※ もしマッチがズレた場合は $1 にしますので、以下のように汎用的な置換を行います
  content = content.replace(/\*\*([^*]+)\*\*/g, (match, p1) => {
    return `「${p1}」`;
  });

  // 二重カギカッコ 「「テキスト」」 のクリーンアップ
  content = content.replace(/「「([^」]+)」」/g, '「$1」');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned stars in: ${path.basename(filePath)}`);
  }
});

console.log("All stars cleaned successfully!");
