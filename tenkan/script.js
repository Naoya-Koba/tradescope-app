const container = document.getElementById("signal-container");

// 表面用の8通貨ペアリスト（最低限の情報）
const pairsFront = [
  "USD/JPY",
  "EUR/JPY",
  "AUD/JPY",
  "USD/CHF",
  "GBP/JPY",
  "CAD/JPY",
  "ZAR/JPY",
  "MXN/JPY"
];

// 裏面の詳細はUSD/JPYのみダミーデータで用意
const usdJpyDetail = {
  pair: "USD/JPY",
  currentPrice: 144.615,
  high1m: 146.153,
  low2m: 139.882,
  takeProfit: 145.715,
  stopLoss: 138.903,
  riseRate: 3.4,
  ma50: 144.475,
  ma50Compare: "上",
  rsi: 50.5,
  rsiComment: "中立",
  trend: "⬆",
  goldenCross: "⏫",
  atrRate: 1,
  atrComment: "低ボラ",
  rating: "★★☆☆☆",
  reason: "安値から3.4%＋⬆＋RSI中立＋MA50上"
};

// 詳細HTML生成関数（ラベルと値をspanで分けて表示用クラス付与）
function createDetailHTML(data) {
  if (!data) return "<div>詳細情報はありません</div>";
  return `
    <div><strong>通貨ペア:</strong> <span class="value">${data.pair}</span></div>
    <div><strong>現在価格:</strong> <span class="value">￥${data.currentPrice.toFixed(3)}</span></div>
    <div><strong>過去1ヶ月高値:</strong> <span class="value">￥${data.high1m.toFixed(3)}</span></div>
    <div><strong>過去2ヶ月安値:</strong> <span class="value">￥${data.low2m.toFixed(3)}</span></div>
    <div><strong>利確ライン（買）:</strong> <span class="value">￥${data.takeProfit.toFixed(3)}</span></div>
    <div><strong>損切りライン（買）:</strong> <span class="value">￥${data.stopLoss.toFixed(3)}</span></div>
    <div><strong>安値からの上昇率:</strong> <span class="value">${data.riseRate.toFixed(1)}%</span></div>
    <div><strong>MA50:</strong> <span class="value">￥${data.ma50.toFixed(3)} (${data.ma50Compare})</span></div>
    <div><strong>RSI(14日):</strong> <span class="value">${data.rsi.toFixed(1)} (${data.rsiComment})</span></div>
    <div><strong>トレンド:</strong> <span class="value">${data.trend}</span></div>
    <div><strong>ゴールデンクロス:</strong> <span class="value">${data.goldenCross}</span></div>
    <div><strong>ATR率:</strong> <span class="value">${data.atrRate}% (${data.atrComment})</span></div>
    <div><strong>おすすめ度:</strong> <span class="value">${data.rating}</span></div>
    <div><strong>おすすめ理由:</strong> <span class="value">${data.reason}</span></div>
  `;
}

// カード生成
pairsFront.forEach(pairName => {
  const card = document.createElement("div");
  card.className = "signal-card";

  // USD/JPYだけ詳細データを入れる、それ以外は簡易メッセージ
  const detailData = (pairName === "USD/JPY") ? usdJpyDetail : null;

  card.innerHTML = `
    <div class="signal-card-front">
      <div>${pairName}</div>
      <div>推奨度：${detailData ? detailData.rating : "情報なし"}</div>
    </div>
  `;

  card.addEventListener("click", () => {
    const modal = document.getElementById("detail-modal");
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = createDetailHTML(detailData);
    modal.style.display = "block";
    document.body.style.overflow = "hidden";  // 背景スクロール禁止
  });

  container.appendChild(card);
});

// モーダルの閉じるボタンイベント
document.getElementById("modal-close").addEventListener("click", () => {
  const modal = document.getElementById("detail-modal");
  modal.style.display = "none";
  document.body.style.overflow = "";         // 背景スクロール解除
});

// モーダル背景クリックで閉じる
window.addEventListener("click", (event) => {
  const modal = document.getElementById("detail-modal");
  if (event.target === modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";       // 背景スクロール解除
  }
});
