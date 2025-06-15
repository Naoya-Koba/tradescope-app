// === 月別損益カードの表示エリア取得 ===
const monthContainer = document.getElementById("monthly-cards");

// === 年間損益・チャートなどの要素 ===
const totalProfitEl = document.getElementById("total-profit");
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

// === 月別カード生成 ===
months.forEach(month => {
  const card = document.createElement("div");
  card.className = "month-card";
  card.innerHTML = `
    <h3>${month}</h3>
    <label>決済損益</label>
    <input type="text" class="realized" placeholder="¥0" />
    <label>スワップ損益</label>
    <input type="text" class="swap" placeholder="¥0" />
    <label>取引手数料</label>
    <input type="text" class="fee" placeholder="¥0" />
    <label>合計</label>
    <input type="text" class="sum" value="¥0" disabled />
  `;
  monthContainer.appendChild(card);
});

// === 通貨フォーマット入力支援 ===
document.querySelectorAll('.month-card input').forEach(input => {
  if (!input.disabled) {
    input.addEventListener('beforeinput', e => {
      if (input.selectionStart === 0 && e.inputType === 'deleteContentBackward') {
        e.preventDefault();
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim() === '') {
        input.value = '¥0';
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
  }
});

function formatCurrencyInput(input) {
  const raw = input.value.replace(/[¥,]/g, '').trim();
  const num = parseInt(raw);
  if (!isNaN(num)) {
    input.value = '¥' + num.toLocaleString();
    input.classList.toggle('positive', num > 0);
    input.classList.toggle('negative', num < 0);
  } else {
    input.value = '¥0';
    input.classList.remove('positive', 'negative');
  }
}

function parseInput(value) {
  const cleaned = value.replace(/[^\d\.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatYen(value) {
  return `¥${value.toLocaleString()}`;
}

function applyColorClass(inputEl, value) {
  inputEl.classList.remove("positive", "negative");
  inputEl.classList.add(value >= 0 ? "positive" : "negative");
}

function updateTotals() {
  let total = 0;
  let balance = 1000000;
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
            label: context => `資金の移り変わり: ¥${context.raw.toLocaleString()}`
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

// 入力検知
document.addEventListener("input", (e) => {
  if (e.target.matches(".realized, .swap, .fee")) {
    updateTotals();
  }
});

document.addEventListener("blur", (e) => {
  if (e.target.matches(".realized, .swap, .fee")) {
    const value = parseInput(e.target.value);
    e.target.value = formatYen(value);
    applyColorClass(e.target, value);
  }
}, true);

// 保存処理
saveButton.addEventListener("click", () => {
  confirmDialog.classList.add("show");
});

confirmNo.addEventListener("click", () => {
  confirmDialog.classList.remove("show");
});

confirmYes.addEventListener("click", () => {
  confirmDialog.classList.remove("show");
  showToast("保存が完了しました");
});

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

updateTotals();
