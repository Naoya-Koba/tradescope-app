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

// 詳細HTML生成関数
function createDetailHTML(data) {
  if (!data) return "詳細情報はありません";
  return `
    <strong>詳細情報</strong><br>
    通貨ペア: ${data.pair}<br>
    現在価格: ￥${data.currentPrice.toFixed(3)}<br>
    過去1ヶ月高値: ￥${data.high1m.toFixed(3)}<br>
    過去2ヶ月安値: ￥${data.low2m.toFixed(3)}<br>
    利確ライン（買）: ￥${data.takeProfit.toFixed(3)}<br>
    損切りライン（買）: ￥${data.stopLoss.toFixed(3)}<br>
    安値からの上昇率: ${data.riseRate.toFixed(1)}%<br>
    MA50: ￥${data.ma50.toFixed(3)} (${data.ma50Compare})<br>
    RSI(14日): ${data.rsi.toFixed(1)} (${data.rsiComment})<br>
    トレンド: ${data.trend}<br>
    ゴールデンクロス: ${data.goldenCross}<br>
    ATR率: ${data.atrRate}% (${data.atrComment})<br>
    おすすめ度: ${data.rating}<br>
    おすすめ理由: ${data.reason}
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
    <div class="signal-card-back">
      ${createDetailHTML(detailData)}
    </div>
  `;

  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });

  container.appendChild(card);
});
