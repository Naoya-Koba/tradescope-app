// === 月別損益カードの表示エリア取得 ===
const monthContainer = document.getElementById("monthly-cards");

// === 年間損益・チャートなどの要素 ===
const totalProfitEl = document.getElementById("total-profit");
const totalBalanceEl = document.getElementById("total-balance");
const balanceChartEl = document.getElementById("balance-chart");
const yearSelector = document.getElementById("year");
const confirmDialog = document.getElementById("confirm-dialog");
const saveButton = document.getElementById("save-button");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");

// === 月リスト ===
const months = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月"
];

// GAS WebアプリURL（必ずご自身のURLに書き換えてください）
const GAS_WEB_APP_URL ='https://script.google.com/macros/s/AKfycbxJwqRVlKSu_3X7MI8U0RR_-o-HerrP4OGjUj2Ma5137lNYajxi4aYkKloMpsHRKZr9/exec'

// === 月別カード生成 ===
months.forEach(month => {
  const card = document.createElement("div");
  card.className = "month-card";
  card.innerHTML = `
    <h3>${month}</h3>
    <label>決済損益</label>
    <input type="text" class="realized" placeholder="\u00a50" />
    <label>スワップ損益</label>
    <input type="text" class="swap" placeholder="\u00a50" />
    <label>取引手数料</label>
    <input type="text" class="fee" placeholder="\u00a50" />
    <label>合計</label>
    <input type="text" class="sum" value="\u00a50" disabled />
  `;
  monthContainer.appendChild(card);
});

// === イベント設定 ===
document.querySelectorAll('.month-card input').forEach(input => {
  input.addEventListener('focus', () => {
    const raw = input.value.replace(/[\u00a5,]/g, '').trim();
    if (raw === "0") {
      input.value = "";
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim() === "") {
      input.value = '\u00a50';
    }
    formatCurrencyInput(input);
    updateTotals();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
});

function formatCurrencyInput(input) {
  const raw = input.value.replace(/[\u00a5,]/g, '').trim();
  const num = parseInt(raw);
  if (!isNaN(num)) {
    input.value = '\u00a5' + num.toLocaleString();
    input.classList.toggle('positive', num > 0);
    input.classList.toggle('negative', num < 0);
  } else {
    input.value = '\u00a50';
    input.classList.remove('positive', 'negative');
  }
}

function parseInput(value) {
  const cleaned = value.replace(/[^\d\.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatYen(value) {
  return `\u00a5${value.toLocaleString()}`;
}

function applyColorClass(inputEl, value) {
  inputEl.classList.remove("positive", "negative");
  inputEl.classList.add(value >= 0 ? "positive" : "negative");
}

function updateTotals() {
  let total = 0;
  let balance = 5649006;
  const balances = [];

  document.querySelectorAll(".month-card").forEach(card => {
    const realizedInput = card.querySelector(".realized");
    const swapInput = card.querySelector(".swap");
    const feeInput = card.querySelector(".fee");

    const realized = parseInput(realizedInput.value);
    const swap = parseInput(swapInput.value);
    const fee = parseInput(feeInput.value);
    const sum = realized + swap + fee;

    realizedInput.value = formatYen(realized);
    swapInput.value = formatYen(swap);
    feeInput.value = formatYen(fee);

    applyColorClass(realizedInput, realized);
    applyColorClass(swapInput, swap);
    applyColorClass(feeInput, fee);

    const sumEl = card.querySelector(".sum");
    sumEl.value = formatYen(sum);
    sumEl.className = `sum ${sum >= 0 ? "positive" : "negative"}`;

    total += sum;
    balance += sum;
    balances.push(balance);
  });

  totalProfitEl.textContent = formatYen(total);
  totalProfitEl.className = total >= 0 ? "positive" : "negative";

  totalBalanceEl.textContent = formatYen(balance);
  totalBalanceEl.className = balance >= 0 ? "positive" : "negative";

  updateChart(balances);
}

function updateChart(data) {
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(balanceChartEl, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: '資金の移り変わり',
        data: data,
        fill: true,
        backgroundColor: 'rgba(230, 221, 197, 0.05)',
        borderColor: '#e6ddc5',
        borderWidth: 1.5,
        pointRadius: 4,
        pointBackgroundColor: '#e6ddc5',
        tension: 0.2
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `資金の移り変わり: \u00a5${context.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: { color: "#e6ddc5" },
          beginAtZero: false,
          suggestedMin: 900000,
          suggestedMax: 1100000
        },
        x: {
          ticks: { color: "#e6ddc5" }
        }
      }
    }
  });
}

// 送信する損益データを収集
function collectProfitData() {
  const cards = document.querySelectorAll('.month-card');
  const data = [];
  cards.forEach(card => {
    const realized = parseInput(card.querySelector('.realized').value);
    const swap = parseInput(card.querySelector('.swap').value);
    const fee = parseInput(card.querySelector('.fee').value);
    data.push({ realized, swap, fee });
  });
  return data;
}

// GASへPOST送信
async function saveProfitData(year, data) {
  try {
    await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',        // 'no-cors' にしています。レスポンスは読めません
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, data })
    });
    // 成功は即時表示（レスポンスは読めません）
    showToast("データを送信しました");
  } catch (error) {
    showToast("通信エラーが発生しました");
    console.error(error);
  }
}

// ページ読み込み時にスプレッドシートからデータを読み込んで画面に反映する
async function loadProfitData(year) {
  try {
    const response = await fetch(`${GAS_WEB_APP_URL}?year=${year}`);
    if (!response.ok) throw new Error('データ取得に失敗しました');
    const data = await response.json();

    data.forEach((item, i) => {
      const card = monthContainer.children[i];
      card.querySelector('.realized').value = formatYen(item.realized);
      card.querySelector('.swap').value = formatYen(item.swap);
      card.querySelector('.fee').value = formatYen(item.fee);
    });

    updateTotals();
    showToast('データの取得が完了しました');
  } catch (error) {
    showToast(error.message);
    console.error(error);
  }
}

// 保存ボタン押下時の動作を修正
saveButton.addEventListener("click", () => {
  confirmDialog.classList.add("show");
});

confirmNo.addEventListener("click", () => {
  confirmDialog.classList.remove("show");
});

confirmYes.addEventListener("click", () => {
  confirmDialog.classList.remove("show");
  const year = parseInt(yearSelector.value) || new Date().getFullYear();
  const data = collectProfitData();
  saveProfitData(year, data);
});

// ページ読み込み時に自動で読み込み実行
window.addEventListener('DOMContentLoaded', () => {
  const year = parseInt(yearSelector.value) || new Date().getFullYear();
  loadProfitData(year);
});

// 年セレクターの変更時にデータ読み込み
yearSelector.addEventListener('change', () => {
  const selectedYear = parseInt(yearSelector.value) || new Date().getFullYear();
  loadProfitData(selectedYear);
});

// トースト表示関数はそのまま使用
function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = "#e6ddc5";
  toast.style.color = "#111";
  toast.style.padding = "1rem 2rem";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 0 12px rgba(0,0,0,0.3)";
  toast.style.fontWeight = "bold";
  toast.style.zIndex = "2000";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.5s ease";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 100);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

// 初期化
updateTotals();
