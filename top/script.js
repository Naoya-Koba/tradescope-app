// ===== Utility =====
const fmtJPY = (n) => {
  if (!isFinite(n)) return '-';
  const value = Math.round(Math.abs(n)).toLocaleString();
  const sign = n < 0 ? '−' : '';
  return '¥' + sign + value;
};
const setSignClass = (el, val) => {
  if (!el) return;
  el.classList.remove('positive', 'negative', 'neutral');
  el.classList.add(val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral');
};

// ===== Memo Box =====
const memoList = document.getElementById('memoList');
const addMemoBtn = document.getElementById('addMemoBtn');
const memoModal = document.getElementById('memoModal');
const memoModalBackdrop = document.getElementById('memoModalBackdrop');
const memoInput = document.getElementById('memoInput');
const saveMemoBtn = document.getElementById('saveMemoBtn');
const cancelMemoBtn = document.getElementById('cancelMemoBtn');
const closeMemoModal = document.getElementById('closeMemoModal');

function loadMemos() {
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memoList.innerHTML = memos.length === 0 
    ? '<li style="color: var(--muted); padding: 12px 0; text-align: center; font-size: 12px;">メモはまだありません</li>'
    : memos.map((memo, idx) => `
      <li class="memo-item">
        <div class="memo-content">
          <div class="memo-item-text">${memo.text}</div>
          <div class="memo-item-time">${new Date(memo.date).toLocaleDateString('ja-JP')}</div>
        </div>
        <button class="memo-delete-btn" data-idx="${idx}" aria-label="削除">−</button>
      </li>
    `).join('');
  
  document.querySelectorAll('.memo-delete-btn').forEach(btn => {
    btn.addEventListener('click', deleteMemo);
  });
}

function openModal() {
  memoInput.value = '';
  memoModal.setAttribute('aria-hidden', 'false');
  memoModalBackdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => memoInput.focus(), 100);
}

function closeModal() {
  memoModal.setAttribute('aria-hidden', 'true');
  memoModalBackdrop.setAttribute('aria-hidden', 'true');
}

function saveMemo() {
  const text = memoInput.value.trim();
  if (!text) return;
  
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memos.unshift({ text, date: new Date().toISOString() });
  memos.splice(50);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
  closeModal();
}

function deleteMemo(e) {
  const idx = parseInt(e.target.dataset.idx);
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memos.splice(idx, 1);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
}

addMemoBtn.addEventListener('click', openModal);
saveMemoBtn.addEventListener('click', saveMemo);
cancelMemoBtn.addEventListener('click', closeModal);
closeMemoModal.addEventListener('click', closeModal);
memoModalBackdrop.addEventListener('click', closeModal);
memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) saveMemo();
});

loadMemos();

// ===== Drawer Menu =====
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');
function openDrawer() {
  drawer.classList.add('open'); scrim.hidden = false;
}
function closeDrawer() {
  drawer.classList.remove('open'); scrim.hidden = true;
}
menuButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

// ===== News =====
const globalTicker = [
  'ドルは主要通貨に対して小幅高。',
  '円は安全資産として買い戻し優勢。',
  'ユーロは景気懸念で上値重い。',
  'トルコリラは中銀会合を控え小動き。',
  'メキシコペソは高金利を背景に堅調。'
];
const countryNews = {
  USD: ['米CPI発表を控えドル小動き。', 'FOMCメンバーの発言に注目。'],
  JPY: ['日銀は賃金動向を注視。', '輸出の持ち直しで円買い。'],
  EUR: ['ECB理事会議事要旨を公表。', '域内PMIはまちまちの結果。'],
  GBP: ['BOEの物価見通し発表へ。', '英小売売上は横ばい。'],
  TRY: ['トルコ中銀は金利据え置き見通し。', 'インフレ鈍化の兆し。']
};
function mountTicker(trackEl, items) {
  if (!trackEl) return;
  trackEl.innerHTML = items.concat(items).map(t => `<span class="ticker-item">${t}</span>`).join('');
}
mountTicker(document.getElementById('globalTickerTrack'), globalTicker);
const sel = document.getElementById('countrySelect');
function refreshCountryTicker() {
  const v = sel.value || 'USD';
  mountTicker(document.getElementById('countryTickerTrack'), countryNews[v] || []);
}
sel?.addEventListener('change', refreshCountryTicker);
refreshCountryTicker();

// ===== Demo Data =====
const demoMonthly = {
  realized: [500,520,540,560,580,600,610,620,640,660,680,700],
  total: [510,535,555,575,590,615,625,640,665,690,705,730]
};
const lotsByPair = { TRY:300, HUF:200, MXN:150, ZAR:80 };
const risk = { zero:-3280000, half:-1640000, mmr:265 };
const swapToday = { total:12300, pairs:[['TRY',7800],['HUF',2900],['MXN',1600]] };
const swapYearForecast = 532000;

// ===== Portfolio Data =====
const accountData = [
  { label: 'GMO',         amount: 1800000, color: '#3B6DFF' },
  { label: 'Light FX',    amount:  950000, color: '#74D2F5' },
  { label: 'みんなのFX',  amount: 1200000, color: '#E9C85E' },
  { label: 'SBI',         amount: 1500000, color: '#D95757' },
  { label: 'SBI VC',      amount:  568000, color: '#EAF1FF' },
  { label: '三井住友銀行', amount: 1282000, color: '#2F7A46' }
];

const portfolioData = [
  { label: 'キャリー', amount: 3650000, color: '#E9C85E' },
  { label: 'キャピタルゲイン', amount: 910000, color: '#3B6DFF' },
  { label: '暗号資産', amount: 568000, color: '#EAF1FF' },
  { label: 'NISA', amount: 1260000, color: '#D95757' },
  { label: '現金', amount: 710000, color: '#2F7A46' },
  { label: 'その他', amount: 202000, color: '#7E7A98' }
];

// ===== KPI =====
function updateKPIs() {
  const i = demoMonthly.realized.length - 1;
  const rLast = demoMonthly.realized[i]*10000;
  const tLast = demoMonthly.total[i]*10000;
  const rPrev = demoMonthly.realized[i-1]*10000;
  const tPrev = demoMonthly.total[i-1]*10000;

  const elTotal = document.getElementById('kpiTotal');
  elTotal.textContent = fmtJPY(tLast);

  const elReal = document.getElementById('kpiRealized');
  elReal.textContent = fmtJPY(rLast);

  const momNet = rPrev ? ((rLast - rPrev) / rPrev) * 100 : 0;
  const elNet = document.getElementById('growthNet');
  elNet.textContent = (momNet >= 0 ? '+' : '') + momNet.toFixed(1) + '%';
  setSignClass(elNet, momNet);

  const momTotal = tPrev ? ((tLast - tPrev) / tPrev) * 100 : 0;
  const elTotalGrowth = document.getElementById('growthTotal');
  elTotalGrowth.textContent = (momTotal >= 0 ? '+' : '') + momTotal.toFixed(1) + '%';
  setSignClass(elTotalGrowth, momTotal);
}
updateKPIs();

// ===== Swap =====
function updateSwap() {
  const elToday = document.getElementById('swapToday');
  elToday.textContent = fmtJPY(swapToday.total).replace('¥','');
  setSignClass(elToday, swapToday.total);
  document.getElementById('swapTodayPairs').innerHTML = swapToday.pairs.map(([p,v]) =>
    `<span class="${v>=0?'positive':'negative'}">${p}: ${fmtJPY(v).replace('¥','')}</span>`
  ).join(' · ');
  document.getElementById('swapYear').textContent = fmtJPY(swapYearForecast);
}
updateSwap();

// ===== Position & Risk: Right Panel =====
const pairCards = document.querySelectorAll('.pair-card');
const detailView = document.getElementById('detailView');
const detailPair = document.getElementById('detailPair');
const detailProfit = document.getElementById('detailProfit');
const detailRate = document.getElementById('detailRate');
const detailClose = document.getElementById('detailClose');

const pairDetails = {
  'USDJPY': {profit:'¥25,000', rate:'+2.3%', lots:300, avg:'3.250', now:'3.630', swap:'¥1,095,000', daily:'¥260', zero:'-¥3,280,000', mmr:'265%', note:'高スワップ維持中。利確目標は3.8。'},
  'TRYJPY': {profit:'¥1,095,000', rate:'+4.1%', lots:300, avg:'3.250', now:'3.630', swap:'¥1,095,000', daily:'¥280', zero:'-¥3,280,000', mmr:'270%', note:'安定推移中。'},
  'HUFJPY': {profit:'-¥42,000', rate:'-0.5%', lots:200, avg:'0.410', now:'0.445', swap:'¥75,000', daily:'¥95', zero:'-¥820,000', mmr:'310%', note:'金利低下懸念。'}
};

// --- カードクリックで右ペイン開く ---
pairCards.forEach(card => {
  card.addEventListener('click', () => {
    const key = card.dataset.pair;
    const data = pairDetails[key];
    if (!data) return;

    detailPair.textContent = card.querySelector('.pair-title').textContent;
    detailProfit.textContent = data.profit;
    detailRate.textContent = `(${data.rate})`;
    detailView.hidden = false;
  });
});

// ===== Chart =====
const ctx = document.getElementById('perfChart')?.getContext('2d');
if (ctx) {
  const gradBlue = ctx.createLinearGradient(0, 0, 0, 250);
  gradBlue.addColorStop(0, 'rgba(61,162,255,0.25)');
  gradBlue.addColorStop(1, 'rgba(61,162,255,0)');
  const gradGreen = ctx.createLinearGradient(0, 0, 0, 250);
  gradGreen.addColorStop(0, 'rgba(62,224,143,0.25)');
  gradGreen.addColorStop(1, 'rgba(62,224,143,0)');

  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const isMobile = window.innerWidth <= 480;
  const tickFontSize = isMobile ? 10 : 12;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Realized Balance',
          data: demoMonthly.realized,
          borderColor: '#3DA2FF',
          backgroundColor: gradBlue,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: 'Total Balance',
          data: demoMonthly.total,
          borderColor: '#3EE08F',
          backgroundColor: gradGreen,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.8)', font: { size: tickFontSize } },
          grid: { color: 'rgba(255,255,255,0.1)', borderDash: [3,3], drawBorder: false }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 12 } },
          grid: { color: 'rgba(255,255,255,0.1)', borderDash: [3,3], drawBorder: false }
        }
      }
    }
  });
}

// ===== Portfolio Chart & List =====
function renderPortfolio() {
  // Calculate total
  const total = portfolioData.reduce((sum, item) => sum + item.amount, 0);
  
  // Sort by amount (descending) - keep original data unchanged
  const sortedData = portfolioData.slice().sort((a, b) => b.amount - a.amount);
  
  // Render list
  const listContainer = document.getElementById('portfolioItems');
  if (listContainer) {
    listContainer.innerHTML = sortedData.map(item => {
      const pct = ((item.amount / total) * 100).toFixed(1);
      return `
        <div class="portfolio-item" style="--item-color: ${item.color}">
          <span class="portfolio-label">${item.label}</span>
          <span class="portfolio-amount">${fmtJPY(item.amount)}</span>
          <span class="portfolio-percent">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  // Render doughnut chart
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) {
    const hexToRgba = (hex, alpha = 0.75) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const doughnutOpts = (dataTotal) => ({
      maintainAspectRatio: false,
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,12,26,0.9)',
          titleColor: 'rgba(255,255,255,0.9)',
          bodyColor: 'rgba(255,255,255,0.85)',
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label: (ctx) => `${fmtJPY(ctx.parsed)} (${((ctx.parsed / dataTotal) * 100).toFixed(1)}%)`
          }
        }
      }
    });

    new Chart(portfolioCtx, {
      type: 'doughnut',
      data: {
        labels: sortedData.map(d => d.label),
        datasets: [{
          data: sortedData.map(d => d.amount),
          backgroundColor: sortedData.map(d => hexToRgba(d.color)),
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1
        }]
      },
      options: doughnutOpts(total)
    });

    // ==== 口座別配分チャート ====
    const accountTotal = accountData.reduce((s, d) => s + d.amount, 0);
    const sortedAccount = accountData.slice().sort((a, b) => b.amount - a.amount);

    const accountListEl = document.getElementById('accountItems');
    if (accountListEl) {
      accountListEl.innerHTML = sortedAccount.map(item => {
        const pct = ((item.amount / accountTotal) * 100).toFixed(1);
        return `
          <div class="portfolio-item" style="--item-color: ${item.color}">
            <span class="portfolio-label">${item.label}</span>
            <span class="portfolio-amount">${fmtJPY(item.amount)}</span>
            <span class="portfolio-percent">${pct}%</span>
          </div>`;
      }).join('');
    }

    const accountCtx = document.getElementById('accountChart')?.getContext('2d');
    if (accountCtx) {
      new Chart(accountCtx, {
        type: 'doughnut',
        data: {
          labels: sortedAccount.map(d => d.label),
          datasets: [{
            data: sortedAccount.map(d => d.amount),
            backgroundColor: sortedAccount.map(d => hexToRgba(d.color)),
            borderColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1
          }]
        },
        options: doughnutOpts(accountTotal)
      });
    }
  }
}
renderPortfolio();

// ===== Pair Detail Panel 開閉（右ペイン版）=====
document.querySelectorAll('.pair-card').forEach(card => {
  card.addEventListener('click', () => {
    const panel = document.getElementById('pairDetailPanel');
    if (!panel) return;
    const title = card.querySelector('.pair-title')?.textContent || '';
    panel.querySelector('#detailTitle').textContent = title;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  });
});

// ===== （右スライドで閉じるアニメーション付き） =====
document.getElementById('detailClose')?.addEventListener('click', () => {
  const panel = document.getElementById('pairDetailPanel');
  if (!panel) return;
  panel.style.transition = 'transform 0.35s ease';
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.style.transform = '';
    panel.style.transition = '';
  }, 350);
});

// ================================
// スワイプで右ペインを閉じる
// ================================
(() => {
  const detail = document.querySelector('.pair-detail');
  if (!detail) return;

  let startX = 0;
  let currentX = 0;
  let isSwiping = false;

  detail.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    isSwiping = true;
    detail.style.transition = 'none';
  });

  detail.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    if (diffX > 0) {
      detail.style.transform = `translateX(${Math.min(diffX, 150)}px)`;
    }
  });

  detail.addEventListener('touchend', () => {
    if (!isSwiping) return;
    const diffX = currentX - startX;
    detail.style.transition = 'transform 0.35s ease';

    if (diffX > 100) {
      detail.style.transform = 'translateX(100%)';
      setTimeout(() => {
        detail.classList.remove('open');
        detail.style.transform = '';
      }, 350);
    } else {
      detail.style.transform = 'translateX(0%)';
    }
    isSwiping = false;
  });
})();
document.querySelectorAll('.rate-change').forEach(el => {
  const val = parseFloat(el.textContent);
  el.classList.remove('positive', 'negative', 'neutral');
  if (val > 0) el.classList.add('positive');
  else if (val < 0) el.classList.add('negative');
  else el.classList.add('neutral');
});
// ===== 利率カラー適用 =====
window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.rate-change').forEach(el => {
    const val = parseFloat(el.textContent.replace(/[^\d.-]/g, ''));
    el.classList.remove('positive', 'negative', 'neutral');
    if (val > 0) el.classList.add('positive');
    else if (val < 0) el.classList.add('negative');
    else el.classList.add('neutral');
  });
});
// 括弧を削除（利率表示整形）
document.querySelectorAll('.rate-change').forEach(el => {
  el.textContent = el.textContent.replace(/[()]/g, '');
});
/* =========================
   iPhone Safari用：右ペイン高さを完全フィットさせる
========================= */
function adjustDetailHeight() {
  const pane = document.querySelector('.pair-detail');
  if (!pane) return;

  // 実際の見える範囲（ビジュアルビューポート）を優先
  const realHeight = document.documentElement.clientHeight || window.innerHeight;

  // 高さをCSSに反映（!importantで強制）
  pane.style.setProperty('height', `${realHeight}px`, 'important');
  pane.style.setProperty('min-height', `${realHeight}px`, 'important');
  pane.style.setProperty('max-height', `${realHeight}px`, 'important');
}

// 初期化とイベント監視
window.addEventListener('load', adjustDetailHeight);
window.addEventListener('resize', adjustDetailHeight);
window.addEventListener('orientationchange', adjustDetailHeight);
setTimeout(adjustDetailHeight, 200); // Safari対策で遅延実行
