// ===== Drawer Menu =====
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');
function openDrawer() { drawer.classList.add('open'); scrim.hidden = false; }
function closeDrawer() { drawer.classList.remove('open'); scrim.hidden = true; }
menuButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

// ===== Year Button (ダミー選択) =====
document.getElementById('yearButton').addEventListener('click', () => {
  alert("年度切替機能は後日実装予定です。");
});

// ===== Sample Rate Data =====
const rateData = [
  { flag: "🇯🇵", country: "Japan", code: "JPY", rate: 0.1, forecast: 0.5, comment: "緩やかな利上げ継続" },
  { flag: "🇺🇸", country: "United States", code: "USD", rate: 5.25, forecast: 4.50, comment: "利下げ開始の可能性" },
  { flag: "🇹🇷", country: "Turkey", code: "TRY", rate: 43.0, forecast: 30.0, comment: "利下げフェーズ移行へ" },
  { flag: "🇪🇺", country: "Eurozone", code: "EUR", rate: 4.0, forecast: 3.25, comment: "慎重な利下げ局面" },
  { flag: "🇲🇽", country: "Mexico", code: "MXN", rate: 10.75, forecast: 9.00, comment: "高金利維持も利下げ観測" },
  { flag: "🇭🇺", country: "Hungary", code: "HUF", rate: 7.75, forecast: 6.50, comment: "インフレ鈍化で利下げ余地" },
  { flag: "🇬🇧", country: "United Kingdom", code: "GBP", rate: 5.25, forecast: 4.75, comment: "年後半に利下げ見通し" },
  { flag: "🇨🇭", country: "Switzerland", code: "CHF", rate: 1.75, forecast: 1.50, comment: "低金利維持" },
];

// ===== Render Cards =====
function renderRateCards() {
  const grid = document.getElementById('rateGrid');
  grid.innerHTML = rateData.map(d => {
    const trendClass = d.forecast > d.rate ? "forecast-up" : d.forecast < d.rate ? "forecast-down" : "";
    return `
      <div class="rate-card glass">
        <span class="flag-single">${d.flag}</span>
        <div class="country-name">${d.country} (${d.code})</div>
        <div class="rate-values">
          <span class="current">${d.rate.toFixed(2)}%</span>
          <span class="${trendClass}">→ ${d.forecast.toFixed(2)}%</span>
        </div>
        <div class="rate-comment">${d.comment}</div>
      </div>
    `;
  }).join('');
}
renderRateCards();

// ===== Summary Calculation =====
function updateSummary() {
  const avgRate = rateData.reduce((a,b)=>a+b.rate,0)/rateData.length;
  const avgForecast = rateData.reduce((a,b)=>a+b.forecast,0)/rateData.length;
  const diff = avgForecast - avgRate;
  document.getElementById('avgRate').textContent = avgForecast.toFixed(2) + "%";
  const diffEl = document.getElementById('rateChange');
  diffEl.textContent = (diff>0?'+':'') + diff.toFixed(2) + "pt";
  diffEl.style.color = diff>0 ? "var(--green)" : diff<0 ? "var(--red)" : "var(--muted)";
  document.getElementById('trendComment').textContent =
    diff>0 ? "利上げ局面へ移行中" :
    diff<0 ? "利下げ局面に移行中" : "横ばい傾向";
  document.getElementById('lastUpdated').textContent = "最終更新: 2025/10/15";
}
updateSummary();
