const pairs = [
  { name: "USD/JPY", price: 145.23, rating: "★★★☆☆", rsi: 55, cross: "ゴールデンクロス", stopLoss: 143.00 },
  { name: "EUR/JPY", price: 156.78, rating: "★★☆☆☆", rsi: 42, cross: "デッドクロス", stopLoss: 155.00 },
  // 追加ペア...
];

const container = document.getElementById("signal-container");

pairs.forEach(pair => {
  const card = document.createElement("div");
  card.className = "signal-card";
  card.innerHTML = `
    <div class="card-front">
      <div class="pair-name">${pair.name}</div>
      <div class="current-price">￥${pair.price.toFixed(2)}</div>
      <div class="recommendation">推奨度：${pair.rating}</div>
    </div>
    <div class="card-back" style="display:none;">
      <p>RSI: ${pair.rsi}</p>
      <p>13MA > 25MA: ${pair.cross}</p>
      <p>損切りライン: ￥${pair.stopLoss.toFixed(2)}</p>
    </div>
  `;

  // 詳細表示は今後アニメーション等で実装予定
  container.appendChild(card);
});
