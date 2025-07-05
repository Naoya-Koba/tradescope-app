const container = document.getElementById("signal-container");

// 通貨ペアデータ（おすすめ度は★の数、0〜5で管理）
const pairs = [
  { name: "USD/JPY", price: 145.23, ratingStars: 3, ratingStr: "★★★☆☆", details: "RSI: 55<br>13MA > 25MA: ゴールデンクロス<br>損切り: ￥143.00<br>利確: ￥148.00" },
  { name: "EUR/JPY", price: 156.78, ratingStars: 2, ratingStr: "★★☆☆☆", details: "RSI: 42<br>13MA < 25MA: デッドクロス<br>損切り: ￥155.00<br>利確: ￥159.00" },
  { name: "AUD/JPY", price: 101.15, ratingStars: 4, ratingStr: "★★★★☆", details: "RSI: 60<br>13MA > 25MA: ゴールデンクロス<br>損切り: ￥99.50<br>利確: ￥103.00" },
  { name: "USD/CHF", price: 0.93, ratingStars: 1, ratingStr: "★☆☆☆☆", details: "RSI: 40<br>13MA < 25MA: デッドクロス<br>損切り: ￥0.92<br>利確: ￥0.95" },
  { name: "GBP/JPY", price: 190.55, ratingStars: 5, ratingStr: "★★★★★", details: "RSI: 70<br>13MA > 25MA: ゴールデンクロス<br>損切り: ￥188.00<br>利確: ￥195.00" },
  { name: "CAD/JPY", price: 110.20, ratingStars: 2, ratingStr: "★★☆☆☆", details: "RSI: 50<br>13MA ≈ 25MA: 横ばい<br>損切り: ￥109.00<br>利確: ￥112.00" },
  { name: "ZAR/JPY", price: 7.50, ratingStars: 3, ratingStr: "★★★☆☆", details: "RSI: 58<br>13MA > 25MA: ゴールデンクロス<br>損切り: ￥7.20<br>利確: ￥7.80" },
  { name: "MXN/JPY", price: 6.40, ratingStars: 1, ratingStr: "★☆☆☆☆", details: "RSI: 38<br>13MA < 25MA: デッドクロス<br>損切り: ￥6.10<br>利確: ￥6.60" }
];

// 昇順／降順トグル用フラグ
let ascending = false;

// カードを再描画する関数
function renderCards() {
  // ソート
  pairs.sort((a, b) => ascending ? a.ratingStars - b.ratingStars : b.ratingStars - a.ratingStars);

  // コンテナ内をクリア
  container.innerHTML = "";

  pairs.forEach(pair => {
    const cardContainer = document.createElement("div");
    cardContainer.className = "signal-card-container";

    const card = document.createElement("div");
    card.className = "signal-card";

    card.innerHTML = `
      <div class="signal-card-front">
        <div>${pair.name}</div>
        <div>￥${pair.price.toFixed(2)}</div>
        <div>推奨度：${pair.ratingStr}</div>
      </div>
      <div class="signal-card-back">${pair.details}</div>
    `;

    cardContainer.appendChild(card);
    container.appendChild(cardContainer);

    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
    });
  });
}

// ソート切替ボタンを設置する関数
function setupSortButton() {
  const app = document.querySelector(".app");
  const btn = document.createElement("button");
  btn.textContent = "おすすめ度ソート ▼";
  btn.style.margin = "1rem";
  btn.style.padding = "0.5rem 1rem";
  btn.style.fontSize = "1rem";
  btn.style.cursor = "pointer";
  app.insertBefore(btn, container);

  btn.addEventListener("click", () => {
    ascending = !ascending;
    btn.textContent = ascending ? "おすすめ度ソート ▲" : "おすすめ度ソート ▼";
    renderCards();
  });
}

// 初期処理
setupSortButton();
renderCards();
