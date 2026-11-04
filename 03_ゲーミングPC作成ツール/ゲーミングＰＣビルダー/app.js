// Global variables to hold data
let partsData = null;
let gamesData = null;

// Application State
const state = {
  selectedGame: null,
  selectedTarget: null,
  currentConfig: {
    cpu: null,
    gpu: null,
    motherboard: null,
    memory: null,
    storage: null,
    power: null,
    case: null
  }
};

// DOM Elements
const gameListEl = document.getElementById("game-list");
const categoryTabsContainer = document.getElementById("category-tabs-container");
const stepTargetEl = document.getElementById("step-target");
const gameBriefBoxEl = document.getElementById("game-info");
const targetListEl = document.getElementById("target-list");
const stepPartsEl = document.getElementById("step-parts");
const partsContainerEl = document.getElementById("parts-selector-container");
const btnResetEl = document.getElementById("btn-reset");
const totalPriceEl = document.getElementById("total-price");
const compatibilityAlertEl = document.getElementById("compatibility-alert-box");
const configStatusTagEl = document.getElementById("config-status-tag");

// Diagnosis DOM Elements
const diagSuitabilityEl = document.getElementById("diag-suitability");
const diagGpuStatusEl = document.getElementById("diag-gpu-status");
const diagMemoryStatusEl = document.getElementById("diag-memory-status");

// Price Check DOM Elements
const btnCheckPricesEl = document.getElementById("btn-check-prices");
const priceCheckResultsEl = document.getElementById("price-check-results");
const priceCheckLoadingEl = document.querySelector(".price-check-loading");
const priceLinksContainerEl = document.querySelector(".price-links-container");
const shopLinksUlEl = document.getElementById("shop-links-ul");

// Initial Setup: Fetch JSON data with cache busting
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const timestamp = Date.now();
    const [partsResponse, gamesResponse] = await Promise.all([
      fetch(`parts.json?t=${timestamp}`),
      fetch(`games.json?t=${timestamp}`)
    ]);
    
    partsData = await partsResponse.json();
    gamesData = await gamesResponse.json();
    
    setupCategoryTabs();
    renderGames();
    

  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
    gameListEl.innerHTML = '<div class="loading-spinner" style="color: var(--danger-color)">データの読み込みに失敗しました。ファイルパスまたはローカルサーバーの設定を確認してください。</div>';
  }
});

// Reset Button Handler
btnResetEl.addEventListener("click", () => {
  // Deselect games and targets
  document.querySelectorAll(".game-card").forEach(card => card.classList.remove("selected"));
  
  stepTargetEl.classList.add("hidden");
  stepPartsEl.classList.add("hidden");
  priceCheckResultsEl.classList.add("hidden");
  
  state.selectedGame = null;
  state.selectedTarget = null;
  
  // Reset tabs to all
  const tabs = categoryTabsContainer.querySelectorAll(".tab-btn");
  tabs.forEach(t => t.classList.remove("active"));
  tabs[0].classList.add("active");
  renderGames("all");
  
  // Clear config
  for (const category in state.currentConfig) {
    state.currentConfig[category] = null;
  }
  
  updateSummary();
});

// Set up Category Tabs click events
function setupCategoryTabs() {
  const tabs = categoryTabsContainer.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const category = tab.dataset.category;
      renderGames(category);
    });
  });
}

// Render Games Grid (Step 1)
function renderGames(filterCategory = "all") {
  gameListEl.innerHTML = "";
  
  const filteredGames = filterCategory === "all" 
    ? gamesData 
    : gamesData.filter(g => g.category === filterCategory);
    
  if (filteredGames.length === 0) {
    gameListEl.innerHTML = '<div class="loading-spinner">該当するゲームが見つかりませんでした。</div>';
    return;
  }
  
  filteredGames.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    if (state.selectedGame && state.selectedGame.id === game.id) {
      card.classList.add("selected");
    }
    
    const imgClass = game.isLogo ? `game-banner-img logo-mode ${game.invertLogo ? "invert-logo" : ""}` : "game-banner-img";
    
    card.innerHTML = `
      <div class="game-banner-wrapper">
        <img src="${game.bannerUrl}" class="${imgClass}" alt="${game.name}" loading="lazy">
      </div>
      <span class="game-name">${game.name}</span>
    `;
    
    card.addEventListener("click", () => {
      // Highlight selected card
      document.querySelectorAll(".game-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      
      selectGame(game);
    });
    
    gameListEl.appendChild(card);
  });
}

// Select Game and load Step 2
function selectGame(game) {
  state.selectedGame = game;
  state.selectedTarget = null;
  
  // Hide lower steps first
  stepPartsEl.classList.add("hidden");
  priceCheckResultsEl.classList.add("hidden");
  
  // Update Game Info Box
  gameBriefBoxEl.innerHTML = `
    <strong>${game.name} の解説:</strong><br>
    ${game.description}
  `;
  
  // Render Target options (FPS settings)
  targetListEl.innerHTML = "";
  game.targets.forEach(target => {
    const targetCard = document.createElement("div");
    targetCard.className = "target-card";
    
    targetCard.innerHTML = `
      <div class="target-fps">${target.fps}</div>
      <div class="target-desc">${target.description}</div>
    `;
    
    targetCard.addEventListener("click", () => {
      document.querySelectorAll(".target-card").forEach(tc => tc.classList.remove("selected"));
      targetCard.classList.add("selected");
      
      selectTarget(target);
    });
    
    targetListEl.appendChild(targetCard);
  });
  
  // Show Step 2
  stepTargetEl.classList.remove("hidden");
  stepTargetEl.scrollIntoView({ behavior: "smooth" });
}

// Select Target (FPS) and auto-select components
function selectTarget(target) {
  state.selectedTarget = target;
  priceCheckResultsEl.classList.add("hidden");
  
  // Auto-select parts based on game requirements
  autoSelectConfig(target);
  
  // Render selectors in Step 3
  renderPartsSelectors();
  
  // Show Step 3
  stepPartsEl.classList.remove("hidden");
  stepPartsEl.scrollIntoView({ behavior: "smooth" });
  
  updateSummary();
}

// Auto-config algorithm based on target spec requirements
function autoSelectConfig(target) {
  // 1. CPU Selection
  state.currentConfig.cpu = partsData.cpu.find(c => c.performanceClass === target.cpuClass) || partsData.cpu[0];
  
  // 2. GPU Selection
  if (target.gpuClass === 1) {
    state.currentConfig.gpu = partsData.gpu.find(g => g.isNone) || partsData.gpu[0];
  } else {
    // Select normal GPU matching the performance class
    state.currentConfig.gpu = partsData.gpu.find(g => !g.isNone && g.performanceClass === target.gpuClass) || partsData.gpu[1];
  }
  
  // 3. Motherboard Selection (Must match CPU Socket)
  const requiredSocket = state.currentConfig.cpu.socket;
  state.currentConfig.motherboard = partsData.motherboard.find(m => m.socket === requiredSocket) || partsData.motherboard[0];
  
  // 4. Memory Selection (Match size recommendation)
  if (target.ramGb >= 32) {
    state.currentConfig.memory = partsData.memory.find(m => m.id === "mem_32gb_dual") || partsData.memory[0];
  } else {
    state.currentConfig.memory = partsData.memory.find(m => m.id === "mem_16gb_dual") || partsData.memory[1];
  }
  
  // 5. Storage Selection (Heavier configurations get 2TB)
  if (target.cpuClass >= 3 || target.ramGb >= 32) {
    state.currentConfig.storage = partsData.storage.find(s => s.id === "ssd_2tb") || partsData.storage[0];
  } else {
    state.currentConfig.storage = partsData.storage.find(s => s.id === "ssd_1tb") || partsData.storage[1];
  }
  
  // 6. Power Selection (Non-GPU gets 650W, RTX 5070 gets 850W, other GPUs get 750W/650W)
  if (state.currentConfig.gpu.isNone) {
    state.currentConfig.power = partsData.power.find(p => p.id === "power_650w") || partsData.power[2];
  } else if (state.currentConfig.gpu.id === "gpu_rtx5070") {
    state.currentConfig.power = partsData.power.find(p => p.id === "power_850w") || partsData.power[0];
  } else if (state.currentConfig.gpu.performanceClass >= 3) {
    state.currentConfig.power = partsData.power.find(p => p.id === "power_750w") || partsData.power[1];
  } else {
    state.currentConfig.power = partsData.power.find(p => p.id === "power_650w") || partsData.power[2];
  }
  
  // 7. Case Selection (Match Motherboard format)
  // Z790/X670 are standard ATX. PRO B760M / B650M are Micro-ATX.
  const isATX = state.currentConfig.motherboard.id === "mb_z790" || state.currentConfig.motherboard.id === "mb_x670";
  if (isATX) {
    state.currentConfig.case = partsData.case.find(c => c.id === "case_atx") || partsData.case[0];
  } else {
    state.currentConfig.case = partsData.case.find(c => c.id === "case_matx") || partsData.case[1];
  }
}

// Render dynamic selectors for step 3 customization
function renderPartsSelectors() {
  partsContainerEl.innerHTML = "";
  
  const categories = [
    { key: "cpu", label: "CPU (頭脳)" },
    { key: "gpu", label: "グラボ (映像)" },
    { key: "motherboard", label: "マザーボード (基板)" },
    { key: "memory", label: "メモリ (記憶時)" },
    { key: "storage", label: "SSD (保存先)" },
    { key: "power", label: "電源ユニット (給電)" },
    { key: "case", label: "PCケース (外装)" }
  ];
  
  categories.forEach(cat => {
    const row = document.createElement("div");
    row.className = "part-row";
    
    // Part category title
    const label = document.createElement("div");
    label.className = "part-label";
    label.textContent = cat.label;
    row.appendChild(label);
    
    // Select wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "part-select-wrapper";
    
    const select = document.createElement("select");
    select.className = "part-select";
    select.id = `select-${cat.key}`;
    
    // Load options for this category
    const list = partsData[cat.key];
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.name} (${formatPrice(item.price)})`;
      if (state.currentConfig[cat.key] && state.currentConfig[cat.key].id === item.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    
    // Description text below select box
    const descNote = document.createElement("div");
    descNote.className = "part-desc-note";
    descNote.id = `desc-${cat.key}`;
    descNote.textContent = state.currentConfig[cat.key] ? state.currentConfig[cat.key].details : "";
    
    select.addEventListener("change", (e) => {
      const selectedId = e.target.value;
      const partObj = list.find(item => item.id === selectedId);
      
      state.currentConfig[cat.key] = partObj;
      descNote.textContent = partObj.details;
      
      updateSummary();
    });
    
    wrapper.appendChild(select);
    row.appendChild(wrapper);
    
    // Price badge
    const priceBadge = document.createElement("div");
    priceBadge.className = "part-price-badge";
    priceBadge.id = `price-${cat.key}`;
    priceBadge.textContent = state.currentConfig[cat.key] ? formatPrice(state.currentConfig[cat.key].price) : "¥0";
    row.appendChild(priceBadge);
    
    // Append desc note as new row content
    row.appendChild(descNote);
    
    partsContainerEl.appendChild(row);
  });
}

// Format Price to Japanese Yen notation
function formatPrice(num) {
  return "¥" + num.toLocaleString();
}

// Main logic to update prices, run compatibility check and performance diagnostics
function updateSummary() {
  let total = 0;
  let hasInvalidComponents = false;
  
  // Calculate total price
  for (const cat in state.currentConfig) {
    const item = state.currentConfig[cat];
    if (item) {
      total += item.price;
      
      // Update individual price labels if they exist
      const badge = document.getElementById(`price-${cat}`);
      if (badge) badge.textContent = formatPrice(item.price);
    } else {
      hasInvalidComponents = true;
    }
  }
  
  // Update total price display
  animatePrice(total);
  
  if (hasInvalidComponents) {
    totalPriceEl.textContent = "0";
    configStatusTagEl.textContent = "未完成";
    configStatusTagEl.className = "summary-status-tag status-danger";
    diagSuitabilityEl.textContent = "パーツ未決定";
    diagGpuStatusEl.textContent = "パーツ未決定";
    diagMemoryStatusEl.textContent = "パーツ未決定";
    compatibilityAlertEl.classList.add("hidden");
    return;
  }
  
  // Run Compatibility Check
  const alerts = checkCompatibility();
  
  // Render Alerts
  if (alerts.errors.length > 0) {
    configStatusTagEl.textContent = "構成エラーあり";
    configStatusTagEl.className = "summary-status-tag status-danger";
    
    compatibilityAlertEl.className = "alert-box alert-danger";
    compatibilityAlertEl.innerHTML = alerts.errors.map(err => `・${err}`).join("<br>");
    compatibilityAlertEl.classList.remove("hidden");
  } else if (alerts.warnings.length > 0) {
    configStatusTagEl.textContent = "構成注意";
    configStatusTagEl.className = "summary-status-tag status-warning";
    
    compatibilityAlertEl.className = "alert-box alert-warning";
    compatibilityAlertEl.innerHTML = alerts.warnings.map(wrn => `・${wrn}`).join("<br>");
    compatibilityAlertEl.classList.remove("hidden");
  } else {
    configStatusTagEl.textContent = "構成良好";
    configStatusTagEl.className = "summary-status-tag";
    
    compatibilityAlertEl.className = "alert-box alert-success";
    compatibilityAlertEl.textContent = "互換性の問題は検出されませんでした。組み立て可能です。";
    compatibilityAlertEl.classList.remove("hidden");
  }
  
  // Update Diagnostics
  updateDiagnostics(alerts);
}

// Animation for price counter
function animatePrice(targetVal) {
  const currentVal = parseInt(totalPriceEl.textContent.replace(/,/g, "")) || 0;
  if (currentVal === targetVal) return;
  
  const duration = 400; // ms
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    if (elapsed >= duration) {
      totalPriceEl.textContent = targetVal.toLocaleString();
      return;
    }
    
    const progress = elapsed / duration;
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const currentPrice = Math.round(currentVal + (targetVal - currentVal) * easeProgress);
    
    totalPriceEl.textContent = currentPrice.toLocaleString();
    requestAnimationFrame(update);
  }
  
  requestAnimationFrame(update);
}

// Hardcoded rules for parts compatibility checking
function checkCompatibility() {
  const errors = [];
  const warnings = [];
  
  const cpu = state.currentConfig.cpu;
  const gpu = state.currentConfig.gpu;
  const mb = state.currentConfig.motherboard;
  const mem = state.currentConfig.memory;
  const pwr = state.currentConfig.power;
  const cs = state.currentConfig.case;
  
  if (!cpu || !gpu || !mb || !mem || !pwr || !cs) {
    return { errors, warnings };
  }
  
  // Rule 1: GPU None but CPU doesn't have internal graphics
  if (gpu.isNone && !cpu.hasGraphics) {
    errors.push(`【映像が出力されません】選択されたCPU「${cpu.name}」には内蔵グラフィックス機能がありません。グラフィックボードを追加するか、映像出力機能を持ったCPUを選んでください。`);
  }
  
  // Rule 2: CPU Socket vs Motherboard Socket
  if (cpu.socket !== mb.socket) {
    errors.push(`【規格が異なります】CPUのソケット規格「${cpu.socket}」とマザーボードの「${mb.socket}」が一致しません。この組み合わせでは組み立てられません。`);
  }
  
  // Rule 3: Motherboard Size vs Case Size
  // Z790 and X670 motherboards are standard ATX, case_matx is Micro-ATX only
  const isATXMb = mb.id === "mb_z790" || mb.id === "mb_x670";
  if (isATXMb && cs.id === "case_matx") {
    errors.push(`【サイズ不適合】標準ATXサイズのマザーボード「${mb.name}」は、Micro-ATXミニタワーケース「${cs.name}」に入りません。ATX対応のミドルタワーケースに変更してください。`);
  }
  
  // Rule 4: Memory Single Channel for On-board setup
  if (gpu.isNone && !mem.isDualChannel) {
    warnings.push(`【グラフィックス性能低下】グラボなし（内蔵グラフィックス）構成では、メモリが1枚構成（シングルチャネル）だとゲームの描画速度が極端に落ちます。必ず2枚組（デュアルチャネル）のメモリを選ぶことを強く推奨します。`);
  }
  
  return { errors, warnings };
}

// Evaluate suitability of configuration for the chosen game and requirements
function updateDiagnostics(alerts) {
  const cpu = state.currentConfig.cpu;
  const gpu = state.currentConfig.gpu;
  const mem = state.currentConfig.memory;
  const target = state.selectedTarget;
  
  if (!cpu || !gpu || !mem || !target) return;
  
  // 1. Suitability check
  if (alerts.errors.length > 0) {
    diagSuitabilityEl.textContent = "動作不可 (エラーあり)";
    diagSuitabilityEl.style.color = "var(--danger-color)";
  } else {
    // Evaluate if user manually selected lower tier parts than required
    const isCpuLower = cpu.performanceClass < target.cpuClass;
    
    // GPU class comparison (treat None as class 1)
    const currentGpuClass = gpu.isNone ? 1 : gpu.performanceClass;
    const isGpuLower = currentGpuClass < target.gpuClass;
    
    // RAM check
    const currentRamGb = mem.id === "mem_32gb_dual" ? 32 : 16;
    const isRamLower = currentRamGb < target.ramGb;
    
    if (isCpuLower || isGpuLower) {
      diagSuitabilityEl.textContent = "動作が重くなる可能性あり";
      diagSuitabilityEl.style.color = "var(--warning-color)";
    } else if (isRamLower) {
      diagSuitabilityEl.textContent = "メモリ不足の懸念あり";
      diagSuitabilityEl.style.color = "var(--warning-color)";
    } else {
      diagSuitabilityEl.textContent = "目標動作スペック達成！";
      diagSuitabilityEl.style.color = "var(--success-color)";
    }
  }
  
  // 2. Graphics status check
  if (gpu.isNone) {
    if (cpu.hasGraphics) {
      diagGpuStatusEl.textContent = `内蔵GPU使用中 (${cpu.name.includes("Ryzen") ? "Radeon" : "Intel UHD"})`;
      diagGpuStatusEl.style.color = "var(--text-main)";
    } else {
      diagGpuStatusEl.textContent = "映像出力なし";
      diagGpuStatusEl.style.color = "var(--danger-color)";
    }
  } else {
    diagGpuStatusEl.textContent = `独立グラボ搭載 (${gpu.name.replace("NVIDIA ", "").replace("AMD ", "")})`;
    diagGpuStatusEl.style.color = "var(--accent-color)";
  }
  
  // 3. Memory speed status check
  if (mem.isDualChannel) {
    diagMemoryStatusEl.textContent = "高速 (デュアルチャネル動作中)";
    diagMemoryStatusEl.style.color = "var(--success-color)";
  } else {
    diagMemoryStatusEl.textContent = "低速 (シングルチャネル動作中)";
    diagMemoryStatusEl.style.color = "var(--warning-color)";
  }
}

// Latest Price Check Button Click Handler with loading screen simulation
btnCheckPricesEl.addEventListener("click", () => {
  priceCheckResultsEl.classList.remove("hidden");
  priceCheckLoadingEl.classList.remove("hidden");
  priceLinksContainerEl.classList.add("hidden");
  
  shopLinksUlEl.innerHTML = "";
  
  // Auto scroll down to see results
  priceCheckResultsEl.scrollIntoView({ behavior: "smooth" });
  
  // Simulate API fetch delay (3 seconds)
  setTimeout(() => {
    priceCheckLoadingEl.classList.add("hidden");
    priceLinksContainerEl.classList.remove("hidden");
    
    generateShopLinks();
  }, 1800);
});

// Generate direct search links for each part in the configuration
function generateShopLinks() {
  shopLinksUlEl.innerHTML = "";
  
  for (const cat in state.currentConfig) {
    const item = state.currentConfig[cat];
    if (!item || item.price === 0) continue; // Skip empty or free dummy parts
    
    const li = document.createElement("li");
    li.className = "shop-link-item-row";
    
    // Clean component name slightly for search query optimization
    const queryName = encodeURIComponent(item.name);
    
    li.innerHTML = `
      <div class="shop-part-name" title="${item.name}">${item.name}</div>
      <div class="shop-btn-group">
        <a class="shop-link-btn amazon" href="https://www.amazon.co.jp/s?k=${queryName}" target="_blank" rel="noopener">Amazon</a>
        <a class="shop-link-btn dospara" href="https://www.dospara.co.jp/products/all-item?q=${queryName}" target="_blank" rel="noopener">ドスパラ</a>
        <a class="shop-link-btn tsukumo" href="https://shop.tsukumo.co.jp/search?keyword=${queryName}" target="_blank" rel="noopener">ツクモ</a>
      </div>
    `;
    
    shopLinksUlEl.appendChild(li);
  }
}
