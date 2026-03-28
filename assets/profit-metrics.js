(function () {
  function getYearData(tradingData, year) {
    if (!tradingData) return {};
    return tradingData[year] || tradingData[String(year)] || {};
  }

  function getYearInitial(initialFunds, year) {
    if (!initialFunds) return {};
    return initialFunds[year] || initialFunds[String(year)] || {};
  }

  function getMonthRow(yearData, month, accountKey) {
    const monthData = yearData?.[month] || yearData?.[String(month)] || {};
    return monthData?.[accountKey] || {};
  }

  function calculateAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey) {
    const yearData = getYearData(tradingData, year);
    const yearInitial = getYearInitial(initialFunds, year);
    const initial = Number(yearInitial?.[accountKey]) || 0;

    let realized = 0;
    let swap = 0;
    let deposit = 0;
    let withdrawal = 0;

    for (let month = 1; month <= targetMonth; month += 1) {
      const row = getMonthRow(yearData, month, accountKey);
      realized += Number(row.realizedPnL) || 0;
      swap += Number(row.swapPnL) || 0;
      deposit += Number(row.deposit) || 0;
      withdrawal += Number(row.withdrawal) || 0;
    }

    return initial + realized + swap + deposit - withdrawal;
  }

  function calculateAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey) {
    const yearData = getYearData(tradingData, year);
    const yearInitial = getYearInitial(initialFunds, year);
    const initial = Number(yearInitial?.[accountKey]) || 0;

    let realized = 0;
    let swap = 0;
    let deposit = 0;
    let withdrawal = 0;

    for (let month = 1; month <= targetMonth; month += 1) {
      const row = getMonthRow(yearData, month, accountKey);
      realized += Number(row.realizedPnL) || 0;
      swap += Number(row.swapPnL) || 0;
      deposit += Number(row.deposit) || 0;
      withdrawal += Number(row.withdrawal) || 0;
    }

    const currentRow = getMonthRow(yearData, targetMonth, accountKey);
    const unrealized = Number(currentRow.unrealizedPnL) || 0;

    return initial + realized + swap + deposit - withdrawal + unrealized;
  }

  function calculateTotalConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKeys) {
    return (accountKeys || []).reduce(function (sum, accountKey) {
      return sum + calculateAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey);
    }, 0);
  }

  function calculateTotalNetAssets(tradingData, initialFunds, year, targetMonth, accountKeys) {
    return (accountKeys || []).reduce(function (sum, accountKey) {
      return sum + calculateAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey);
    }, 0);
  }

  function getNumericYears(dataObj) {
    return Object.keys(dataObj || {})
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); })
      .sort(function (a, b) { return a - b; });
  }

  window.TradeScopeProfitMetrics = {
    calculateAccountConfirmedAssets: calculateAccountConfirmedAssets,
    calculateAccountNetAssets: calculateAccountNetAssets,
    calculateTotalConfirmedAssets: calculateTotalConfirmedAssets,
    calculateTotalNetAssets: calculateTotalNetAssets,
    getNumericYears: getNumericYears
  };
})();
