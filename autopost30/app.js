// AutoPost30 クライアント側スクリプト - 全業種・全客層対応マトリックスエンジン
// アスタリスク文字および絵文字の完全不使用ルールに準拠

document.addEventListener("DOMContentLoaded", function () {
  const industrySelect = document.getElementById("industry-select");
  const customIndustryGroup = document.getElementById("custom-industry-group");
  const customIndustryInput = document.getElementById("custom-industry");
  const targetAudienceInput = document.getElementById("target-audience");
  const monthlyThemeInput = document.getElementById("monthly-theme");
  const toneSelect = document.getElementById("tone-select");
  const emojiOption = document.getElementById("emoji-option");
  const executionMode = document.getElementById("execution-mode");
  const apiKeyGroup = document.getElementById("api-key-group");
  const apiKeyInput = document.getElementById("gemini-api-key");
  const generatorForm = document.getElementById("generator-form");
  const generateBtn = document.getElementById("generate-btn");
  const postsContainer = document.getElementById("posts-container");
  const statsSummary = document.getElementById("stats-summary");
  const copyAllBtn = document.getElementById("copy-all-btn");
  const downloadCsvBtn = document.getElementById("download-csv-btn");
  const loadingSpinner = document.getElementById("loading-spinner");
  const loadingMessage = document.getElementById("loading-message");
  const tabListView = document.getElementById("tab-list-view");
  const tabCalendarView = document.getElementById("tab-calendar-view");
  const calendarContainer = document.getElementById("calendar-container");
  const calendarGrid = document.getElementById("calendar-grid");

  let currentPosts = [];

  // 表示タブ切替イベント
  tabListView.addEventListener("click", function () {
    switchView("list");
  });

  tabCalendarView.addEventListener("click", function () {
    switchView("calendar");
  });

  function switchView(viewName) {
    if (viewName === "calendar") {
      tabCalendarView.classList.add("active");
      tabListView.classList.remove("active");
      calendarContainer.classList.remove("hidden");
      postsContainer.classList.add("hidden");
    } else {
      tabListView.classList.add("active");
      tabCalendarView.classList.remove("active");
      postsContainer.classList.remove("hidden");
      calendarContainer.classList.add("hidden");
    }
  }

  // 全13業種対応のリアルプリセット辞書
  const industryPresets = {
    beauty: {
      name: "美容室・ヘアサロン",
      target: "30代から40代の働く女性・近隣住民",
      theme: "紫外線ダメージ補修と頭皮スッキリ炭酸スパ"
    },
    seitai: {
      name: "整体院・カイロプラクティック・整骨院",
      target: "デスクワークで首肩こりや腰痛に悩む30代から50代の社会人",
      theme: "長時間の座り仕事による骨盤の歪みリセットと姿勢改善"
    },
    nail: {
      name: "ネイルサロン・まつ毛・アイラッシュ",
      target: "身だしなみや指先の美しさを保ちたい20代から40代の女性",
      theme: "自爪を傷めないパラジェルケアと初夏の上品シンプルデザイン"
    },
    esthetic: {
      name: "エステサロン・脱毛・リラクゼーション",
      target: "肌のくすみや毛穴、日々の疲労感をリフレッシュしたい女性",
      theme: "毛穴の黒ずみ徹底洗浄と高濃度ビタミンCイオン導入"
    },
    cafe: {
      name: "カフェ・ベーカリー・スイーツ店",
      target: "落ち着いた時間を過ごしたい地域住民・週末のカフェ巡り層",
      theme: "自家焙煎深煎りコーヒーと季節限定フルーツタルトのこだわり"
    },
    restaurant: {
      name: "居酒屋・ダイニング・飲食店",
      target: "美味しい料理とお酒で一日の疲れを癒したい近隣の会社員・家族連れ",
      theme: "産地直送の旬魚お造りと厳選地酒のペアリング提案"
    },
    gym: {
      name: "パーソナルジム・ヨガ・ピラティス",
      target: "自己流の運動や食事制限で挫折した20代から40代の男女",
      theme: "無理な糖質制限なしで基礎代謝を引き上げる体幹トレーニング"
    },
    builder: {
      name: "地域密着工務店・リフォーム・外壁塗装",
      target: "築15年以上の戸建てに住む40代から60代のファミリー・シニア層",
      theme: "電気代を劇的に抑える高断熱窓リフォームと最新の補助金活用術"
    },
    realestate: {
      name: "地域密着不動産・賃貸・売買",
      target: "初めてのマイホーム購入を検討中の子育て世代・転勤者",
      theme: "失敗しない学区選びのポイントと住宅ローン控除の上手な使い方"
    },
    lawyer: {
      name: "士業（税理士・行政書士・社労士）",
      target: "会社設立を検討中の起業家・日々の帳簿付けに追われる個人事業主",
      theme: "知っておかないと損をする経費計上の境界線とインボイス実務"
    },
    lesson: {
      name: "習い事教室・スクール・学習塾",
      target: "子どもの学習意欲や集中力を伸ばしたい保護者様",
      theme: "勉強嫌いを克服する小さな成功体験の積み重ねと褒め方のコツ"
    },
    pet: {
      name: "ペットサロン・トリミング・動物病院",
      target: "大切な愛犬・愛猫の健康と可愛らしさを保ちたい飼い主様",
      theme: "換毛期の抜け毛スッキリハーブパックと皮膚トラブル予防ケア"
    },
    ec: {
      name: "ハンドメイド・物販・ネットショップ",
      target: "既製品にはない温もりや特別な贈り物を探している方",
      theme: "長く愛用できる上質レザーの手縫いステッチと経年変化の魅力"
    },
    custom: {
      name: "カスタム業種",
      target: "自社サービスを最も必要としている主要なお客様層",
      theme: "今月一番お客様に喜ばれている主力プラン・季節のこだわり"
    }
  };

  // 業種変更時の連動
  industrySelect.addEventListener("change", function () {
    const val = industrySelect.value;
    if (val === "custom") {
      customIndustryGroup.classList.remove("hidden");
      customIndustryInput.focus();
    } else {
      customIndustryGroup.classList.add("hidden");
    }

    if (industryPresets[val]) {
      targetAudienceInput.value = industryPresets[val].target;
      monthlyThemeInput.value = industryPresets[val].theme;
    }
  });

  // モード変更時のAPIキー欄表示切替
  executionMode.addEventListener("change", function () {
    if (executionMode.value === "gemini") {
      apiKeyGroup.classList.remove("hidden");
    } else {
      apiKeyGroup.classList.add("hidden");
    }
  });

  // フォーム送信時
  generatorForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const selectedIndustryKey = industrySelect.value;
    let industryName = industryPresets[selectedIndustryKey].name;
    if (selectedIndustryKey === "custom") {
      industryName = customIndustryInput.value.trim() || "カスタム業種";
    }

    const targetAudience = targetAudienceInput.value.trim();
    const monthlyTheme = monthlyThemeInput.value.trim();
    const tone = toneSelect.value;
    const emojiSetting = emojiOption.value;
    const mode = executionMode.value;

    if (!targetAudience || !monthlyTheme) {
      alert("ターゲット層と今月のテーマを入力してください。");
      return;
    }

    setLoading(true);
    postsContainer.innerHTML = "";
    statsSummary.textContent = "生成中...";
    copyAllBtn.disabled = true;
    downloadCsvBtn.disabled = true;

    try {
      if (mode === "gemini") {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          alert("Gemini APIキーを入力してください。デモを行う場合は「即時デモ生成」を選択してください。");
          setLoading(false);
          return;
        }
        loadingMessage.textContent = "Gemini APIに接続し、全30日分の個別原稿を生成しています...";
        currentPosts = await generateViaGemini(apiKey, industryName, targetAudience, monthlyTheme, tone, emojiSetting);
      } else {
        loadingMessage.textContent = "業種特性と黄金比率を計算し、30日分完全個別原稿を構築中...";
        await sleep(500);
        currentPosts = generatePresetPosts(industryName, targetAudience, monthlyTheme, tone, emojiSetting);
      }

      renderPosts(currentPosts);
      renderCalendar(currentPosts);
      updateStats(currentPosts);
      copyAllBtn.disabled = false;
      downloadCsvBtn.disabled = false;
    } catch (err) {
      alert("生成中にエラーが発生しました: " + err.message);
      statsSummary.textContent = "エラーが発生しました";
    } finally {
      setLoading(false);
    }
  });

  // 全日一括コピー
  copyAllBtn.addEventListener("click", function () {
    if (currentPosts.length === 0) return;

    let fullText = "【AutoPost30 - 30日分SNS投稿計画書】\n\n";
    currentPosts.forEach(function (post) {
      fullText += "━━━━━━━━━━━━━━━━━━━━\n";
      fullText += "【" + post.day + "日目】 " + post.category + "\n";
      fullText += "タイトル: " + post.title + "\n";
      fullText += "本文:\n" + post.content + "\n";
      fullText += "ハッシュタグ: " + post.hashtags + "\n";
      fullText += "画像イメージ指示: " + post.imagePrompt + "\n\n";
    });

    navigator.clipboard.writeText(fullText).then(function () {
      alert("全30日分の原稿をクリップボードにコピーしました！");
    }).catch(function () {
      alert("クリップボードへのコピーに失敗しました。");
    });
  });

  // CSVダウンロード（UTF-8 BOM付きでExcel文字化けゼロ）
  downloadCsvBtn.addEventListener("click", function () {
    if (currentPosts.length === 0) return;

    let csvContent = "\uFEFF";
    csvContent += '"日付","カテゴリ","投稿タイトル","本文","ハッシュタグ","画像イメージ指示"\n';

    currentPosts.forEach(function (post) {
      const row = [
        post.day + "日目",
        post.category,
        escapeCsv(post.title),
        escapeCsv(post.content),
        escapeCsv(post.hashtags),
        escapeCsv(post.imagePrompt)
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "AutoPost30_SNS投稿30日分計画.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  function escapeCsv(text) {
    if (!text) return '""';
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function setLoading(isLoading) {
    if (isLoading) {
      loadingSpinner.classList.remove("hidden");
      generateBtn.disabled = true;
    } else {
      loadingSpinner.classList.add("hidden");
      generateBtn.disabled = false;
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function renderPosts(posts) {
    postsContainer.innerHTML = "";

    posts.forEach(function (post) {
      const card = document.createElement("div");
      card.className = "post-card";

      let tagClass = "tag-knowledge";
      if (post.category.indexOf("共感") !== -1 || post.category.indexOf("悩み") !== -1) {
        tagClass = "tag-empathy";
      } else if (post.category.indexOf("裏側") !== -1 || post.category.indexOf("日常") !== -1 || post.category.indexOf("振り返り") !== -1 || post.category.indexOf("雑談") !== -1) {
        tagClass = "tag-behind";
      } else if (post.category.indexOf("案内") !== -1 || post.category.indexOf("告知") !== -1) {
        tagClass = "tag-sales";
      }

      card.innerHTML =
        '<div class="post-card-header">' +
          '<span class="day-badge">' + post.day + '日目の投稿</span>' +
          '<span class="category-tag ' + tagClass + '">' + post.category + '</span>' +
        '</div>' +
        '<div class="post-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
        '<div class="post-meta">' +
          '<div class="post-tags">' + escapeHtml(post.hashtags) + '</div>' +
          '<div class="post-image-prompt">◆ 画像推奨: ' + escapeHtml(post.imagePrompt) + '</div>' +
        '</div>' +
        '<div class="post-actions">' +
          '<button class="btn btn-secondary btn-sm copy-single-btn">この投稿をコピー</button>' +
        '</div>';

      const singleCopyBtn = card.querySelector(".copy-single-btn");
      singleCopyBtn.addEventListener("click", function () {
        const textToCopy = post.content + "\n\n" + post.hashtags;
        navigator.clipboard.writeText(textToCopy).then(function () {
          singleCopyBtn.textContent = "コピー完了！";
          setTimeout(function () {
            singleCopyBtn.textContent = "この投稿をコピー";
          }, 1500);
        });
      });

      postsContainer.appendChild(card);
    });
  }

  // 月間カレンダーグリッド描画
  function renderCalendar(posts) {
    calendarGrid.innerHTML = "";

    posts.forEach(function (post) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";

      let tagClass = "tag-knowledge";
      let shortTag = "豆知識";
      if (post.category.indexOf("共感") !== -1 || post.category.indexOf("悩み") !== -1) {
        tagClass = "tag-empathy";
        shortTag = "共感・悩み";
      } else if (post.category.indexOf("裏側") !== -1 || post.category.indexOf("日常") !== -1 || post.category.indexOf("振り返り") !== -1 || post.category.indexOf("雑談") !== -1) {
        tagClass = "tag-behind";
        shortTag = "裏側・日常";
      } else if (post.category.indexOf("案内") !== -1 || post.category.indexOf("告知") !== -1) {
        tagClass = "tag-sales";
        shortTag = "ご案内";
      }

      cell.innerHTML =
        '<div class="cell-header">' +
          '<span class="cell-day">' + post.day + '日</span>' +
          '<span class="cell-tag ' + tagClass + '">' + shortTag + '</span>' +
        '</div>' +
        '<div class="cell-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="cell-footer">詳細を表示 →</div>';

      // クリックすると詳細リスト表示に切り替えて該当位置にスクロール
      cell.addEventListener("click", function () {
        switchView("list");
        const targetCards = postsContainer.querySelectorAll(".post-card");
        if (targetCards[post.day - 1]) {
          targetCards[post.day - 1].scrollIntoView({ behavior: "smooth", block: "start" });
          targetCards[post.day - 1].style.borderColor = "var(--accent-primary)";
          setTimeout(function () {
            targetCards[post.day - 1].style.borderColor = "";
          }, 1500);
        }
      });

      calendarGrid.appendChild(cell);
    });
  }

  function updateStats(posts) {
    let knowledgeCount = 0;
    let empathyCount = 0;
    let behindCount = 0;
    let salesCount = 0;

    posts.forEach(function (p) {
      if (p.category.indexOf("豆知識") !== -1 || p.category.indexOf("ノウハウ") !== -1) knowledgeCount += 1;
      else if (p.category.indexOf("共感") !== -1 || p.category.indexOf("悩み") !== -1) empathyCount += 1;
      else if (p.category.indexOf("裏側") !== -1 || p.category.indexOf("日常") !== -1 || p.category.indexOf("振り返り") !== -1 || p.category.indexOf("雑談") !== -1) behindCount += 1;
      else salesCount += 1;
    });

    statsSummary.textContent = "生成完了：合計30日分（お役立ち豆知識: " + knowledgeCount + "日 / 悩み解決・共感: " + empathyCount + "日 / 店舗の裏側・日常: " + behindCount + "日 / サービス案内・成約: " + salesCount + "日）";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 30日間すべて異なる内容を生み出す「動的マトリックス生成エンジン」
  function generatePresetPosts(industry, target, theme, tone, emojiSetting) {
    const list = [];
    const prefix = emojiSetting === "light" ? "◎ " : "・";
    const cleanTag = industry.replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠]/g, "");

    // 30日分の個別設計マトリックス（全日程でテーマ・視点を変化）
    const dayBlueprints = [
      // 1日目: 豆知識 (基本原則)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【プロが直伝】" + theme + "で最初に知っておくべき基本の3原則",
        body: "いつもご覧いただきありがとうございます。" + industry + "です。\n\n" +
              target + "の皆様とお話ししていると、「何から始めればいいかわからない」というお声を多くいただきます。\n\n" +
              "まずは以下の3原則を意識するだけで、日々の負担が大きく減ります。\n\n" +
              prefix + "1. 一度に完璧を目指さず、できることから1つずつ始めること\n" +
              prefix + "2. 自己流で無理をせず、正しい基本の手順を守ること\n" +
              prefix + "3. 違和感や疲れを感じたらすぐに立ち止まること\n\n" +
              "焦らず一歩ずつ進めていきましょう。応援しています！",
        tag: "#" + cleanTag + " #基本知識 #プロの知恵 #セルフケア",
        img: industry + "の清潔感のある明るい店内、またはスタッフが笑顔でお客様を迎える風景"
      },
      // 2日目: 共感・悩み
      {
        cat: "お客様の悩み解決（共感）",
        title: "「朝起きた瞬間から疲れている...」そんな日、ありませんか？",
        body: "今週もお仕事やご家庭の用事、本当にお疲れ様です。\n\n" +
              target + "の皆様は、毎日誰かのために全力で頑張っていらっしゃいます。\n\n" +
              "「寝ても疲れが取れない」「なんとなく気分が晴れない」\n" +
              "それは体が発している『少し休んでね』の大切なサインです。\n\n" +
              "頑張り屋のあなたほど、自分のケアを後回しにしがちです。今日は湯船にゆっくり浸かるなど、自分を一番に甘やかしてあげてくださいね。",
        tag: "#お疲れ様です #自分をいたわる #" + cleanTag + " #休息の大切さ",
        img: "温かいハーブティーや自然光が差し込む落ち着いた癒しの空間"
      },
      // 3日目: 豆知識 (NG行動)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【実は逆効果？】良かれと思ってやってしまうNGな習慣",
        body: "こんにちは！" + industry + "です。\n\n" +
              "「" + theme + "」に取り組む際、熱心な方ほど陥りやすい落とし穴があります。\n\n" +
              "× NGな行動：短期間で結果を出そうとして過剰に負荷をかけること\n\n" +
              "強い刺激や極端な我慢は、かえって体や心に余計な緊張を与えてしまいます。\n" +
              "プロの視点から言えば、『少し物足りないくらいで継続する』のが最も近道です。\n\n" +
              "心当たりがある方は、ぜひ今日からペースを緩めてみてくださいね。",
        tag: "#" + cleanTag + " #NG行動 #正しい習慣 #見直し",
        img: "真剣な表情でアドバイスを行っているカウンセリング風景"
      },
      // 4日目: 店舗の裏側
      {
        cat: "スタッフ・店舗の裏側（親近感）",
        title: "【開店前の風景】私たちが毎朝欠かさず行っている準備",
        body: "おはようございます！" + industry + "です。\n\n" +
              "当院・当店では、毎朝オープン前の30分間、器具の衛生点検と空間の空気入れ替えを徹底しています。\n\n" +
              "ドアを開けた瞬間に「あ、ここなら落ち着けるな」と" + target + "の皆様に感じていただけるよう、見えない細部まで整えてお待ちしています。\n\n" +
              "本日も皆様のご来訪を心よりお待ちしております！",
        tag: "#お店の裏側 #空間へのこだわり #" + cleanTag + " #朝の準備",
        img: "綺麗に整えられた施術台やカウンター、磨かれた道具の並び"
      },
      // 5日目: 豆知識 (時短テクニック)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【忙しいあなたへ】1日たった2分でできる簡単セルフケア",
        body: "毎日バタバタと忙しい" + target + "の皆様へ。\n\n" +
              "「まとまった時間が取れない」という方でも実践できる、2分間の簡単リセット法をご紹介します。\n\n" +
              prefix + "深呼吸を3回行い、肩の力をストンと抜く\n" +
              prefix + "コップ1杯の常温の水をゆっくり飲む\n" +
              prefix + "首筋や手首を軽く回して血の巡りを意識する\n\n" +
              "これだけでも自律神経が整い、午後の集中力が大きく変わります。仕事の合間にぜひお試しください！",
        tag: "#簡単セルフケア #時短習慣 #リフレッシュ #" + cleanTag,
        img: "デスクワークの合間に軽く伸びをしている爽やかな人物イラスト"
      },
      // 6日目: サービス案内
      {
        cat: "商品・サービス案内（成約促進）",
        title: "【今月のおすすめ】「" + theme + "」集中サポートコースのご案内",
        body: "いつもご利用いただき誠にありがとうございます。\n\n" +
              target + "の皆様から特にご要望の多かった「" + theme + "」に特化した集中コースのご案内です。\n\n" +
              "「自分一人ではなかなか改善しない」「専門家にしっかり見てもらいたい」という方に、個別の状態に合わせた最適なプランをご提案します。\n\n" +
              "【お問い合わせ・ご予約】\n" +
              "プロフィールのリンクまたはメッセージよりお気軽にご連絡ください。初めての方も丁寧に対応いたします。",
        tag: "#特別コース #おすすめメニュー #ご予約受付中 #" + cleanTag,
        img: "上品なコース案内パネル、または施術のハイライト写真"
      },
      // 7日目: 週末の振り返り
      {
        cat: "週末の振り返り・雑談（親近感）",
        title: "今週もお疲れ様でした！今週お客様からいただいた嬉しいお声",
        body: "今週も一週間、本当にお疲れ様でした！\n\n" +
              "今週、あるお客様から「ここに来ると本当にホッとする」という温かいお言葉をいただき、スタッフ一同胸が熱くなりました。\n\n" +
              "私たちの仕事は、技術を提供するだけでなく、皆様が日々の活力を取り戻せる場所であることだと改めて実感した瞬間でした。\n\n" +
              "週末はどうぞ肩の力を抜いて、穏やかな時間をお過ごしくださいね。",
        tag: "#お客様の声 #感謝 #週末のひととき #" + cleanTag,
        img: "温かい手書きのメッセージカードや、スタッフ一同の笑顔写真"
      },
      // 8日目: 豆知識 (季節の悩み)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【季節の変わり目】知らず知らずのうちに溜まるダメージのサイン",
        body: "こんにちは！" + industry + "です。\n\n" +
              "季節の変わり目は、気温や気圧の変化によって自律神経が乱れやすくなります。\n\n" +
              "「最近ちょっとしたことでイライラする」「肌や体の調子がいつもと違う」\n" +
              "これは季節の変わり目特有のストレス反応です。\n\n" +
              "無理に普段通りのパフォーマンスを出そうとせず、睡眠時間をいつもより30分増やすことから始めてみてくださいね。",
        tag: "#季節の変わり目 #体調管理 #" + cleanTag + " #セルフケア",
        img: "季節の草花や、落ち着いたトーンの寝室イメージ"
      },
      // 9日目: 共感・悩み
      {
        cat: "お客様の悩み解決（共感）",
        title: "「私の悩みなんて、相談するほどでもないかも」と思っていませんか？",
        body: "「こんな些細な違和感でお店に行っていいのかな...」\n" +
              "ご来店前、そう迷われていたお客様がとても多くいらっしゃいます。\n\n" +
              "ですが、大きなトラブルも最初は小さな違和感から始まります。\n" +
              "「なんとなく調子が悪い」「ちょっと気になる」段階でケアすることが、実は一番早く楽に解決する方法です。\n\n" +
              "どんな小さなお悩みでも遠慮なくお聞かせくださいね。",
        tag: "#些細なお悩み歓迎 #相談しやすいお店 #" + cleanTag,
        img: "優しい笑顔でお客様の話をじっくり聞いているスタッフの写真"
      },
      // 10日目: 豆知識 (選び方の基準)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【失敗しない】" + industry + "を選ぶときに必ず見るべき3つの基準",
        body: "たくさんの選択肢がある中で、自分に合ったお店をどう選べばいいか迷った経験はありませんか？\n\n" +
              "業界の視点から、後悔しないためのチェックポイントをお伝えします。\n\n" +
              prefix + "1. 施術やサービス前のカウンセリングに時間を割いてくれるか\n" +
              prefix + "2. メリットだけでなく、注意点やリスクも正直に説明してくれるか\n" +
              prefix + "3. あなたの生活リズムに合わせた現実的な提案をしてくれるか\n\n" +
              "価格の安さだけで選ばず、『話をしっかり聞いてくれるか』を大切にしてみてくださいね。",
        tag: "#お店選びのコツ #失敗しない選び方 #" + cleanTag + " #プロのアドバイス",
        img: "丁寧なカウンセリングシートと筆記用具のクローズアップ"
      },
      // 11日目: 店舗の裏側 (道具のこだわり)
      {
        cat: "スタッフ・店舗の裏側（親近感）",
        title: "【こだわりの道具紹介】私たちがこれを選び続ける理由",
        body: "こんにちは！" + industry + "です。\n\n" +
              "本日は、当院・当店で毎日愛用している専門の道具（アイテム）について少しだけご紹介します。\n\n" +
              "直接肌や体に触れるものだからこそ、成分の安全性や手触り、素材の質感を徹底的にテストし、自分たちが心から納得したものだけを厳選しています。\n\n" +
              "「肌トラブルが起きない」「使っていて心地よい」というお声をいただけることが、私たちの最大の誇りです。",
        tag: "#道具へのこだわり #プロ仕様 #安心の理由 #" + cleanTag,
        img: "厳選されたオイルや器具、上質なタオルが整然と並ぶ写真"
      },
      // 12日目: 豆知識 (習慣化のコツ)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【三日坊主を防ぐ】良いケアを習慣化させる小さなコツ",
        body: "「教えてもらったケア、三日坊主で終わっちゃいました...」\n" +
              "そんな告白をよくいただきますが、ご安心ください。それはあなたの意志が弱いからではありません！\n\n" +
              "習慣化のコツは『既存のルーティンにくっつけること』です。\n\n" +
              prefix + "歯磨きをしている間に、かかとの上げ下げをする\n" +
              prefix + "お風呂から上がったら、座る前に深呼吸を1回する\n\n" +
              "新しい時間をわざわざ作ろうとせず、普段の行動のおまけにくっつけてみてください。驚くほど続きますよ！",
        tag: "#習慣化のコツ #三日坊主卒業 #継続は力なり #" + cleanTag,
        img: "洗面台や日常のワンシーンを切り取ったナチュラルな写真"
      },
      // 13日目: サービス案内 (初めての方へ)
      {
        cat: "商品・サービス案内（成約促進）",
        title: "【初めての方へ】ご来店からお帰りまでの流れを詳しく解説",
        body: "「初めてのお店は緊張する...」という" + target + "の皆様へ。\n\n" +
              "当院・当店では、初めてのお客様でも不安なくお過ごしいただけるよう、丁寧な案内を心がけています。\n\n" +
              "1. ご来店・温かいお茶でリラックス\n" +
              "2. カウンセリングシートをもとに現状のお悩みをじっくりヒアリング\n" +
              "3. お客様に最適なオーダーメイド施術・サービスのご提供\n" +
              "4. 自宅でできる簡単アフターケアのご説明\n\n" +
              "無理な勧誘や押し売りは一切ございません。どうぞ安心していらしてくださいね。",
        tag: "#初めての方へ #施術の流れ #安心サポート #" + cleanTag,
        img: "落ち着いた受付カウンターでお客様を温かくお迎えしている様子"
      },
      // 14日目: 週末の振り返り
      {
        cat: "週末の振り返り・雑談（親近感）",
        title: "今週もお疲れ様でした！スタッフのおすすめ週末リフレッシュ法",
        body: "一週間の締めくくりですね。本当にお疲れ様でした！\n\n" +
              "今週末、スタッフの一人は近場の温泉へ、もう一人は美味しいパン屋さん巡りをする予定です。\n\n" +
              "皆様はどんな週末を過ごされる予定ですか？\n" +
              "「家でひたすら寝る！」「家族と公園に行く！」など、ぜひ心を満たす時間をお過ごしください。\n\n" +
              "皆様にとって素敵な週末になりますように！",
        tag: "#週末の過ごし方 #スタッフの日常 #リフレッシュ #" + cleanTag,
        img: "美味しそうなパンやコーヒー、または休日の青空写真"
      },
      // 15日目: 豆知識 (食と水分)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【内側からのケア】意外と見落としがちな水分の正しい摂り方",
        body: "こんにちは！" + industry + "です。\n\n" +
              "「" + theme + "」を考える上で、外側からのケアと同じくらい大切なのが内側の水分補給です。\n\n" +
              "冷たい水を一気に飲むと内臓が冷えて代謝が落ちてしまいます。\n" +
              "おすすめは『常温のお水を、コップ半分ずつ、こまめに飲むこと』です。\n\n" +
              "体の巡りが良くなり、老廃物の排出や肌の透明感アップにもつながります。ぜひ試してみてくださいね。",
        tag: "#水分補給の知恵 #内側からのケア #健康美 #" + cleanTag,
        img: "透明なグラスに注がれた清涼感のあるお水とレモンの写真"
      },
      // 16日目: 共感・悩み
      {
        cat: "お客様の悩み解決（共感）",
        title: "「昔はこんな疲れ方しなかったのに...」と感じていませんか？",
        body: "年齢とともに、体の変化を感じるのはごく自然なことです。\n\n" +
              "ですが、「もう歳だから仕方ない」と諦める必要は全くありません。\n\n" +
              "若い頃と同じケアを続けるのではなく、今のあなたの体に合った『大人のための正しいいたわり方』に変えていくだけで、驚くほど身軽になります。\n\n" +
              "今のあなたの状態にぴったりのケアを、一緒に見つけていきましょう。",
        tag: "#大人のメンテナンス #年齢に負けない体づくり #" + cleanTag,
        img: "穏やかな笑顔で遠くを見つめる魅力的な大人の女性・男性写真"
      },
      // 17日目: 豆知識 (睡眠の質)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【ぐっすり眠る】寝る前30分のスマホ断ちがもたらす驚きの変化",
        body: "ベッドに入ってからもついついスマホを見てしまう...\n" +
              "そんな夜が続いていませんか？\n\n" +
              "ブルーライトは脳を昼間だと錯覚させ、睡眠ホルモンの分泌を妨げてしまいます。\n\n" +
              "寝る前の30分だけスマホを別の部屋に置き、好きな香りを嗅いだりストレッチをするだけで、翌朝の目覚めのスッキリ感が劇的に変わります。\n\n" +
              "今夜からぜひ試してみてくださいね。",
        tag: "#睡眠の質向上 #スマホ断ち #朝スッキリ #" + cleanTag,
        img: "間接照明に照らされた心地よいベッドサイドとアロマオイル"
      },
      // 18日目: 店舗の裏側 (勉強会)
      {
        cat: "スタッフ・店舗の裏側（親近感）",
        title: "【技術の向上】定休日に開催したスタッフ技術研修の様子",
        body: "こんにちは！" + industry + "です。\n\n" +
              "先日の定休日、外部の講師をお招きして最新技術と接遇の勉強会を実施しました。\n\n" +
              "どんなに経験を積んでも、学びを止めてはいけないと私たちは考えています。\n" +
              "「" + target + "」の皆様に、常に最高峰の安心と実感をお届けできるよう、日々腕を磨き続けています。\n\n" +
              "新しく学んだ手技も早速取り入れていますので、ぜひ楽しみにしていてくださいね！",
        tag: "#技術向上 #日々勉強 #妥協のないサービス #" + cleanTag,
        img: "熱心にメモを取りながら実技の練習に励むスタッフたちの写真"
      },
      // 19日目: 豆知識 (呼吸法)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【緊張を緩める】たった4秒吸って8秒吐く「脱力呼吸法」",
        body: "仕事中、肩にギュッと力が入っていることに気づく瞬間はありませんか？\n\n" +
              "ストレスを感じている時、人の呼吸は浅く短くなっています。\n\n" +
              "そんな時は【4秒かけて鼻から吸い、8秒かけて口から細く長く吐く】呼吸を3回繰り返してみてください。\n\n" +
              "吐く時間を2倍にすることで副交感神経が優位になり、全身の筋肉がフワッと緩みます。大切な商談の前などにもおすすめですよ！",
        tag: "#脱力呼吸法 #ストレス解消 #自律神経ケア #" + cleanTag,
        img: "公園の木漏れ日の中で深呼吸をしている人物の心地よい写真"
      },
      // 20日目: サービス案内 (平日限定・特典)
      {
        cat: "商品・サービス案内（成約促進）",
        title: "【平日ゆったり時間】午後の隙間時間を有効活用しませんか？",
        body: "いつもありがとうございます！\n\n" +
              "「土日は予約が埋まりやすいので、平日にゆっくり相談したい」というお客様のために、平日の昼下がり限定の特別枠を設けております。\n\n" +
              "静かな空間でじっくりお話を伺いながら、贅沢なメンテナンス時間をお過ごしいただけます。\n\n" +
              "今週の平日枠も残りわずかとなってまいりました。ご希望の日時がある方はお早めにお声がけくださいね。",
        tag: "#平日限定 #ゆったり予約 #自分時間 #" + cleanTag,
        img: "自然光が降り注ぐ昼下がりの静かで上質な空間写真"
      },
      // 21日目: 週末の振り返り
      {
        cat: "週末の振り返り・雑談（親近感）",
        title: "今週もお疲れ様でした！今週の院内・店内の小さなお花",
        body: "今週もたくさんのご縁をいただき、心より感謝申し上げます。\n\n" +
              "今週、受付にお迎えしたお花は、鮮やかな季節の草花です。\n\n" +
              "ご来院・ご来店されたお客様が「あ、綺麗なお花ですね」と笑顔になってくださる瞬間が、私たちの何よりの癒しです。\n\n" +
              "明日からの週末も、どうぞ心温まる素敵な時間をお過ごしください。",
        tag: "#季節の花 #癒しの空間 #感謝の毎日 #" + cleanTag,
        img: "一輪挿しに生けられた可愛らしい季節の花の写真"
      },
      // 22日目: 豆知識 (姿勢と骨盤)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【座り姿勢チェック】足を組む癖が体に与える意外な影響",
        body: "椅子に座ると、無意識に足を組んでしまっていませんか？\n\n" +
              "実は、足を組む姿勢は骨盤の左右バランスを大きく崩し、腰や背中の筋肉に偏った負荷をかけ続けてしまいます。\n\n" +
              "対策としては、足の裏全体をしっかり床につけ、骨盤を立てて座る意識を持つこと。\n\n" +
              "最初は少し違和感があるかもしれませんが、1日10分から意識するだけで、夕方の腰の重だるさが大きく軽減されますよ！",
        tag: "#姿勢改善 #骨盤ケア #デスクワークの悩み #" + cleanTag,
        img: "正しい姿勢で椅子に腰掛けている横姿のシルエット"
      },
      // 23日目: 共感・悩み
      {
        cat: "お客様の悩み解決（共感）",
        title: "「誰にも言えなかった悩み、聞いてもらえて涙が出そうでした」",
        body: "先日、初めていらしたお客様からいただいたお言葉です。\n\n" +
              "「痛いのが当たり前」「つらいのは自分だけじゃないから我慢しなきゃ」と、ずっと一人で抱え込んでいらっしゃいました。\n\n" +
              "あなたのつらさは、決して我慢するべきものではありません。\n\n" +
              "私たちは、あなたの声に誰よりも真剣に耳を傾けます。一人で抱え込まず、いつでも頼ってくださいね。",
        tag: "#寄り添うケア #我慢しないで #安心できる居場所 #" + cleanTag,
        img: "優しく両手で包み込むような温かい手の重なり写真"
      },
      // 24日目: 豆知識 (入浴法)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【芯まで温まる】シャワー派の方に知ってほしい38度入浴の魔法",
        body: "忙しい毎日、「お風呂はシャワーだけで済ませている」という方も多いのではないでしょうか。\n\n" +
              "ですが、深部体温を上げて自律神経を整えるには、やはり湯船に浸かるのが一番です。\n\n" +
              "ポイントは【38度から40度のぬるめのお湯に、15分間ゆっくり浸かること】。\n\n" +
              "熱すぎるお湯は交感神経を高めてしまいますが、ぬるめのお湯なら副交感神経が刺激され、驚くほど深い眠りへ導かれます。週末だけでもぜひ湯船をためてみてくださいね。",
        tag: "#入浴の知恵 #疲労回復 #快眠メソッド #" + cleanTag,
        img: "湯気がほんのり立ち上る清潔なバスルームと入浴剤"
      },
      // 25日目: 店舗の裏側 (クレンリネス)
      {
        cat: "スタッフ・店舗の裏側（親近感）",
        title: "【見えない場所こそ丁寧に】月イチの徹底清掃と環境メンテナンス",
        body: "こんにちは！" + industry + "です。\n\n" +
              "本日は月末恒例の徹底クリーニングDAYでした！\n\n" +
              "エアコンフィルターの分解洗浄から、床のワックス掛け、換気設備の総点検まで、普段手の届かない場所をピカピカに磨き上げました。\n\n" +
              "お客様が深呼吸できる清潔な空気環境を守ることも、私たちのプロとしての責務です。\n\n" +
              "生まれ変わったクリアな空間で、皆様をお待ちしております！",
        tag: "#徹底清掃 #クレンリネス #空気まで美しく #" + cleanTag,
        img: "磨き上げられた床や清潔なフィルターのビフォーアフター写真"
      },
      // 26日目: 豆知識 (Q&A形式)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【よくある質問】「どれくらいの頻度で通うのがベストですか？」",
        body: "よくいただくご質問にお答えします！\n\n" +
              "Q: メンテナンスはどれくらいのペースで通えば良いですか？\n\n" +
              "A: お悩みの深さによりますが、最初は『2週間に1回程度』でベースを整え、安定してきたら『月1回の定期メンテナンス』に移行するのが理想的です。\n\n" +
              "お車と同じで、完全に故障してから直すよりも、定期点検を続けるほうが時間も費用もずっと少なく済みます。\n\n" +
              "無理のない通いやすいスケジュールを一緒に考えていきましょう。",
        tag: "#よくある質問 #通い方の目安 #定期メンテナンス #" + cleanTag,
        img: "カレンダーを見ながらお客様と相談している丁寧なシーン"
      },
      // 27日目: サービス案内 (翌月の先行予約)
      {
        cat: "商品・サービス案内（成約促進）",
        title: "【来月のご予約受付スタート】ご希望の日時を優先確保いたします",
        body: "いつもご愛顧いただき誠にありがとうございます。\n\n" +
              "来月のご予約受付を本日より優先的に開始いたしました！\n\n" +
              "特に週末や平日の夕方以降は早めに埋まりやすくなっております。\n" +
              "「この日に行きたい」「来月はこの週にリフレッシュしたい」というご予定がある方は、ぜひお早めの確保をおすすめいたします。\n\n" +
              "皆様の来月のご来院・ご来店を心より楽しみにお待ちしております！",
        tag: "#先行予約受付中 #来月のご案内 #予約確保 #" + cleanTag,
        img: "上品な予約カードと手帳が置かれたカフェ風デスク写真"
      },
      // 28日目: 週末の振り返り
      {
        cat: "週末の振り返り・雑談（親近感）",
        title: "今週もお疲れ様でした！今月の終わりに寄せて",
        body: "早いもので、今月も最後の週末を迎えましたね。\n\n" +
              "この一ヶ月、皆様にとってどんな日々でしたでしょうか？\n\n" +
              "うまくいった日も、思うようにいかなかった日もあったかと思いますが、一ヶ月間走り抜けたご自身を、どうかたくさん褒めてあげてください。\n\n" +
              "皆様の毎日が少しでも心地よく軽やかなものになるよう、来月も全力でサポートさせていただきます！",
        tag: "#月末の振り返り #自分を褒める #感謝 #" + cleanTag,
        img: "夕暮れ時の街並みや、ホッとする温かい光のイメージ"
      },
      // 29日目: 豆知識 (継続の価値)
      {
        cat: "お役立ち豆知識（信頼獲得）",
        title: "【未来の自分への投資】3ヶ月後の変化を楽しむための心構え",
        body: "こんにちは！" + industry + "です。\n\n" +
              "人の体や習慣は、およそ3ヶ月（約100日）かけてゆっくりと新しく生まれ変わると言われています。\n\n" +
              "日々の小さなケアは、すぐに目に見える劇的な変化には見えないかもしれません。\n\n" +
              "ですが、確実に3ヶ月後のあなたの笑顔や身軽さの土台を作っています。\n\n" +
              "未来の自分を楽しみにしながら、今日できる小さなケアを楽しんでいきましょう！",
        tag: "#体質改善 #継続の力 #未来への投資 #" + cleanTag,
        img: "芽吹いた若葉や、清々しい朝日を浴びる並木道写真"
      },
      // 30日目: サービス案内 (感謝と総括)
      {
        cat: "商品・サービス案内（成約促進）",
        title: "今月も本当にありがとうございました！来月も皆様の笑顔をお待ちしています",
        body: "本日で今月も最終日を迎えました。\n\n" +
              target + "のたくさんの皆様とお会いでき、温かい笑顔や励ましをいただけたこと、スタッフ一同心より感謝申し上げます。\n\n" +
              "「" + theme + "」をはじめ、皆様が毎日をより前向きに心地よく過ごしていただけるよう、来月も新しい取り組みや心地よい空間をご用意してお待ちしております。\n\n" +
              "来月もどうぞよろしくお願いいたします！お困りごとはいつでもお気軽にご相談くださいね。",
        tag: "#今月の感謝 #ご来店ありがとうございました #来月もよろしくお願いします #" + cleanTag,
        img: "満開の笑顔で手を振るスタッフ一同、または温かい感謝の文字ボード"
      }
    ];

    for (let day = 1; day <= 30; day += 1) {
      const bp = dayBlueprints[day - 1];
      list.push({
        day: day,
        category: bp.cat,
        title: bp.title,
        content: bp.body,
        hashtags: bp.tag,
        imagePrompt: bp.img
      });
    }

    return list;
  }

  // Gemini API直接通信
  async function generateViaGemini(apiKey, industry, target, theme, tone, emojiSetting) {
    const prompt =
      "あなたはスモールビジネス特化のプロSNSマーケターです。\n" +
      "業種: " + industry + "\n" +
      "ターゲット層: " + target + "\n" +
      "今月の強化テーマ: " + theme + "\n" +
      "語調: " + tone + "\n" +
      "絵文字設定: " + emojiSetting + "\n\n" +
      "上記条件に基づき、30日分のSNS投稿計画を以下のJSON配列形式で厳密に出力してください。\n" +
      "1日目から30日目まで、30個すべて異なる具体的な切り口・エピソード・アドバイスを生成してください。\n" +
      "マークダウンの記号や不要な前置きは一切出力せず、純粋なJSONのみを返してください。\n" +
      "フォーマット例:\n" +
      "[\n" +
      "  {\n" +
      '    "day": 1,\n' +
      '    "category": "お役立ち豆知識",\n' +
      '    "title": "タイトル",\n' +
      '    "content": "投稿本文",\n' +
      '    "hashtags": "#タグ1 #タグ2",\n' +
      '    "imagePrompt": "画像指示"\n' +
      "  }\n" +
      "]";

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error ? errData.error.message : "API通信エラーが発生しました");
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawText);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("生成データが配列形式ではありませんでした。");
    }

    return parsed;
  }
});
