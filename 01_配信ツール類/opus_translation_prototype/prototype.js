import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// ローカルブラウザストレージのキャッシュを有効化
env.allowLocalModels = false;
env.useBrowserCache = true;

// パイプライン保持変数
let translatorJaEn = null;
let translatorEnJa = null;

// UI要素の取得
const statusJaEn = document.getElementById('status-ja-en');
const progressJaEn = document.getElementById('progress-ja-en');
const progressTextJaEn = document.getElementById('progress-text-ja-en');

const statusEnJa = document.getElementById('status-en-ja');
const progressEnJa = document.getElementById('progress-en-ja');
const progressTextEnJa = document.getElementById('progress-text-en-ja');

const btnLoadModels = document.getElementById('btn-load-models');
const btnTranslate = document.getElementById('btn-translate');
const inputText = document.getElementById('input-text');
const outputText = document.getElementById('output-text');
const timeElapsed = document.getElementById('time-elapsed');
const sampleButtons = document.querySelectorAll('.btn-sample');

// プログレスコールバック関数
function createProgressCallback(statusBadge, progressBar, progressText, modelLabel) {
  return function(progress) {
    if (progress.status === 'initiate') {
      statusBadge.textContent = '初期化中...';
      statusBadge.className = 'badge badge-loading';
      progressText.textContent = `${progress.file} の準備中...`;
    } else if (progress.status === 'download') {
      statusBadge.textContent = 'ダウンロード中...';
      statusBadge.className = 'badge badge-loading';
      progressText.textContent = `${progress.file} をダウンロード中...`;
    } else if (progress.status === 'progress') {
      const percent = Math.round(progress.progress || 0);
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${progress.file}: ${percent}% (${Math.round((progress.loaded || 0) / 1024 / 1024 * 10) / 10} MB / ${Math.round((progress.total || 0) / 1024 / 1024 * 10) / 10} MB)`;
    } else if (progress.status === 'done') {
      progressText.textContent = `${progress.file} 読み込み完了`;
    } else if (progress.status === 'ready') {
      statusBadge.textContent = '準備完了';
      statusBadge.className = 'badge badge-ready';
      progressBar.style.width = '100%';
      progressText.textContent = `${modelLabel} のロードが完了しました（キャッシュ済み）`;
    }
  };
}

// モデル読み込み処理
async function loadModels() {
  btnLoadModels.disabled = true;
  btnLoadModels.textContent = 'モデルをロード中...';

  try {
    // 1. 日本語 -> 英語 モデルの読み込み
    if (!translatorJaEn) {
      statusJaEn.textContent = 'ロード開始...';
      statusJaEn.className = 'badge badge-loading';
      const cbJaEn = createProgressCallback(statusJaEn, progressJaEn, progressTextJaEn, '日本語 → 英語');
      translatorJaEn = await pipeline('translation', 'Xenova/opus-mt-ja-en', { progress_callback: cbJaEn });
      statusJaEn.textContent = '準備完了';
      statusJaEn.className = 'badge badge-ready';
      progressJaEn.style.width = '100%';
      progressTextJaEn.textContent = 'ロード完了（メモリ展開済み）';
    }

    // 2. 英語 -> 日本語 モデルの読み込み
    if (!translatorEnJa) {
      statusEnJa.textContent = 'ロード開始...';
      statusEnJa.className = 'badge badge-loading';
      const cbEnJa = createProgressCallback(statusEnJa, progressEnJa, progressTextEnJa, '英語 → 日本語');
      translatorEnJa = await pipeline('translation', 'Xenova/opus-mt-en-jap', { progress_callback: cbEnJa });
      statusEnJa.textContent = '準備完了';
      statusEnJa.className = 'badge badge-ready';
      progressEnJa.style.width = '100%';
      progressTextEnJa.textContent = 'ロード完了（メモリ展開済み）';
    }

    btnLoadModels.textContent = '全モデルロード完了';
  } catch (error) {
    console.error('モデルロードエラー:', error);
    alert('モデルのロード中にエラーが発生しました。コンソールをご確認ください。: ' + error.message);
    btnLoadModels.disabled = false;
    btnLoadModels.textContent = '再試行';
  }
}

// 翻訳実行処理
async function runTranslation() {
  const text = inputText.value.trim();
  if (!text) {
    alert('翻訳するテキストを入力してください。');
    return;
  }

  const selectedDirection = document.querySelector('input[name="direction"]:checked').value;
  btnTranslate.disabled = true;
  outputText.value = 'ローカルAI推論中...';

  const startTime = performance.now();

  try {
    let result = '';
    if (selectedDirection === 'ja-en') {
      if (!translatorJaEn) {
        outputText.value = '日本語 → 英語モデルを初期化中...';
        await loadModels();
      }
      const output = await translatorJaEn(text);
      result = output[0]?.translation_text || '';
    } else {
      if (!translatorEnJa) {
        outputText.value = '英語 → 日本語モデルを初期化中...';
        await loadModels();
      }
      const output = await translatorEnJa(text);
      result = output[0]?.translation_text || '';
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    outputText.value = result;
    timeElapsed.textContent = duration;
  } catch (error) {
    console.error('翻訳エラー:', error);
    outputText.value = '翻訳エラーが発生しました: ' + error.message;
  } finally {
    btnTranslate.disabled = false;
  }
}

// イベントリスナー設定
btnLoadModels.addEventListener('click', loadModels);
btnTranslate.addEventListener('click', runTranslation);

// サンプル文章ボタンのクリック設定
sampleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetDir = btn.getAttribute('data-dir');
    const text = btn.getAttribute('data-text');
    
    const radio = document.querySelector(`input[name="direction"][value="${targetDir}"]`);
    if (radio) radio.checked = true;
    
    inputText.value = text;
  });
});
