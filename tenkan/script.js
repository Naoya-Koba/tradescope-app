const container = document.getElementById("signal-container");

// 仮のサンプルデータ（後でGAS APIに置き換え）
const pairs = [
  {
    name: "USD/JPY",
    price: 145.23,
    rating: "★★★☆☆",
    details: `
      RSI: 55<br>
      13MA > 25MA: ゴールデンクロス<br>
      損切りライン: ￥143.00<br>
      利確ライン: ￥148.00
    `
  },
  {
    name: "EUR/JPY",
    price: 156.78,
    rating: "★★☆☆☆",
    details: `
      RSI: 42<br>
      13MA < 25MA: デッドクロス<br>
      損切りライン: ￥155.00<br>
      利確ライン: ￥159.00
    `
  }
];

// カードを動的に生成して表示
pairs.forEach(pair => {
  const cardContainer = document.createElement("div");
  cardContainer.className = "signal-card-container";

  const card = document.createElement("div");
  card.className = "signal-card";

  card.innerHTML = `
    <div class="signal-card-front">
      <div>${pair.name}</div>
      <div>￥${pair.price.toFixed(2)}</div>
      <div>推奨度：${pair.rating}</div>
    </div>
    <div class="signal-card-back">${pair.details}</div>
  `;

  cardContainer.appendChild(card);
  container.appendChild(cardContainer);

  // クリック/タップでフリップ＆拡大切替
  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });
});
