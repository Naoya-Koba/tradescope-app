// === トップページ用 JavaScript（ニュースティッカー含む） ===

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".feature-button");

  // ボタンアニメーション（ふわっと表示）
  buttons.forEach((button, index) => {
    button.style.opacity = 0;
    button.style.transform = "translateY(20px)";
    setTimeout(() => {
      button.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      button.style.opacity = 1;
      button.style.transform = "translateY(0)";
    }, 300 + index * 150);
  });

  // === ニュースティッカー用アニメーション（requestAnimationFrame方式） ===
  const scrollTicker = (element) => {
    let x = element.offsetWidth;
    const speed = 1.0;

    const animate = () => {
      x -= speed;
      if (x < -element.scrollWidth) {
        x = element.offsetWidth;
      }
      element.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(animate);
    };

    element.style.whiteSpace = "nowrap";
    element.style.display = "inline-block";
    element.style.position = "relative";
    element.style.willChange = "transform";
    animate();
  };

  scrollTicker(document.getElementById("general-news"));
  scrollTicker(document.getElementById("country-news"));

  // === 国別ニュース切り替え ===
  const countrySelect = document.getElementById("country-select");
  const countryNews = document.getElementById("country-news");

  const newsMap = {
    TRY: "トルコ中銀が金利据え置き決定／政局不安が再燃／IMFの警告報道も",
    USD: "FRBが利下げの可能性を示唆／雇用統計が市場予想を下回る",
    JPY: "日銀の政策修正観測強まる／円安圧力が続く",
    EUR: "ECBが利下げを示唆／独経済の回復に遅れ",
    GBP: "英中銀が金利維持／インフレ再燃の懸念",
    CHF: "スイスフランが安全資産として買われる展開",
    CAD: "カナダ中銀が年内利上げを否定／住宅市場に注目",
    AUD: "豪州の雇用統計が強い結果に／金利据え置き濃厚",
    NZD: "NZ中銀がインフレ抑制に前向きな姿勢",
    ZAR: "南アの電力問題が経済に影響／政策金利維持",
    MXN: "メキシコの成長率予測が上方修正／ペソが堅調"
  };

  countrySelect.addEventListener("change", (e) => {
    const val = e.target.value;
    countryNews.textContent = newsMap[val] || "関連ニュースが見つかりません。";
  });
});
