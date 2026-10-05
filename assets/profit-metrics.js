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

  function hasStoredNumber(row, field) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, field)) return false;
    const value = row[field];
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return false;
    return Number.isFinite(Number(value));
  }

  const LEGACY_MONTHLY_INPUT_FIELDS = {
    gmo: ['realizedPnL', 'swapPnL', 'unrealizedPnL', 'deposit', 'withdrawal'],
    lightfx: ['realizedPnL', 'swapPnL', 'unrealizedPnL', 'deposit', 'withdrawal'],
    minano: ['realizedPnL', 'swapPnL', 'unrealizedPnL', 'deposit', 'withdrawal'],
    sbi: ['realizedPnL', 'deposit', 'withdrawal'],
    sbivc: ['realizedPnL', 'deposit', 'withdrawal'],
    smbc: ['monthEndBalance']
  };
  const LEGACY_UNREALIZED_LEG_ACCOUNTS = new Set(['lightfx', 'minano']);

  function getLegacyMonthlyInputFields(accountKey) {
    return LEGACY_MONTHLY_INPUT_FIELDS[accountKey]
      || ['realizedPnL', 'swapPnL', 'unrealizedPnL', 'deposit', 'withdrawal'];
  }

  function hasFiniteUnrealizedLeg(row, allowZero) {
    if (!Array.isArray(row?.unrealizedLegs)) return false;
    return row.unrealizedLegs.some(function (value) {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return false;
      const numeric = Number(value);
      return Number.isFinite(numeric) && (allowZero || numeric !== 0);
    });
  }

  function hasLegacyMonthlyInput(row, accountKey, allowZero) {
    const hasField = getLegacyMonthlyInputFields(accountKey).some(function (field) {
      return hasStoredNumber(row, field) && (allowZero || Number(row[field]) !== 0);
    });
    if (hasField) return true;
    return LEGACY_UNREALIZED_LEG_ACCOUNTS.has(accountKey)
      && hasFiniteUnrealizedLeg(row, allowZero);
  }

  function hasLegacyMonthData(yearData, month, accountKeys) {
    const monthData = yearData?.[month] || yearData?.[String(month)];
    if (!monthData || typeof monthData !== 'object' || Array.isArray(monthData)) return false;

    return (accountKeys || []).some(function (accountKey) {
      return hasLegacyMonthlyInput(monthData?.[accountKey] || {}, accountKey, false);
    });
  }

  function isMonthEntered(yearData, month, accountKeys) {
    const monthData = yearData?.[month] || yearData?.[String(month)];
    if (!monthData || typeof monthData !== 'object' || Array.isArray(monthData)) return false;
    if (monthData.__saved === true) return true;
    return hasLegacyMonthData(yearData, month, accountKeys);
  }

  function isAccountMonthEntered(yearData, month, accountKey) {
    const monthData = yearData?.[month] || yearData?.[String(month)];
    if (!monthData || typeof monthData !== 'object' || Array.isArray(monthData)) return false;
    const row = getMonthRow(yearData, month, accountKey);
    return hasLegacyMonthlyInput(row, accountKey, monthData.__saved === true);
  }

  function getLatestEnteredMonth(yearData, accountKeys) {
    for (let month = 12; month >= 1; month -= 1) {
      if (isMonthEntered(yearData, month, accountKeys)) return month;
    }
    return null;
  }

  function calculateMonthlyFieldTotal(yearData, month, accountKeys, field) {
    if (!isMonthEntered(yearData, month, accountKeys)) return null;

    let hasValue = false;
    const total = (accountKeys || []).reduce(function (sum, accountKey) {
      const row = getMonthRow(yearData, month, accountKey);
      if (!hasStoredNumber(row, field)) return sum;
      hasValue = true;
      return sum + Number(row[field]);
    }, 0);

    return hasValue ? total : null;
  }

  function hasAccountActivityThroughMonth(tradingData, initialFunds, year, targetMonth, accountKey) {
    const yearData = getYearData(tradingData, year);
    const yearInitial = getYearInitial(initialFunds, year);
    if (hasStoredNumber(yearInitial, accountKey) && Number(yearInitial[accountKey]) !== 0) return true;

    for (let month = 1; month <= targetMonth; month += 1) {
      const row = getMonthRow(yearData, month, accountKey);
      if (['realizedPnL', 'swapPnL', 'unrealizedPnL', 'deposit', 'withdrawal', 'monthEndBalance', 'netAssets']
        .some(function (field) { return hasStoredNumber(row, field) && Number(row[field]) !== 0; })) return true;
      if (Array.isArray(row.holdings) && row.holdings.some(function (holding) {
        return holding?.valueFilled === true
          || holding?.quantityManual === true
          || ['quantity', 'rate', 'acquisitionRate', 'valueJPY']
            .some(function (field) { return hasStoredNumber(holding, field) && Number(holding[field]) !== 0; });
      })) return true;
    }

    return false;
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
      if (hasStoredNumber(row, 'realizedPnL')) realized += Number(row.realizedPnL);
      if (hasStoredNumber(row, 'swapPnL')) swap += Number(row.swapPnL);
      if (hasStoredNumber(row, 'deposit')) deposit += Number(row.deposit);
      if (hasStoredNumber(row, 'withdrawal')) withdrawal += Number(row.withdrawal);
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
      if (hasStoredNumber(row, 'realizedPnL')) realized += Number(row.realizedPnL);
      if (hasStoredNumber(row, 'swapPnL')) swap += Number(row.swapPnL);
      if (hasStoredNumber(row, 'deposit')) deposit += Number(row.deposit);
      if (hasStoredNumber(row, 'withdrawal')) withdrawal += Number(row.withdrawal);
    }

    const currentRow = getMonthRow(yearData, targetMonth, accountKey);
    const hasUnrealized = hasStoredNumber(currentRow, 'unrealizedPnL');
    if (!hasUnrealized && hasAccountActivityThroughMonth(tradingData, initialFunds, year, targetMonth, accountKey)) {
      return null;
    }

    const unrealized = hasUnrealized ? Number(currentRow.unrealizedPnL) : 0;
    return initial + realized + swap + deposit - withdrawal + unrealized;
  }

  function calculateTotalConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKeys) {
    return (accountKeys || []).reduce(function (sum, accountKey) {
      return sum + calculateAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey);
    }, 0);
  }

  function calculateTotalNetAssets(tradingData, initialFunds, year, targetMonth, accountKeys) {
    let total = 0;
    for (const accountKey of (accountKeys || [])) {
      const value = calculateAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey);
      if (!Number.isFinite(value)) return null;
      total += value;
    }
    return total;
  }

  function createYearSourceFingerprint(tradingData, initialFunds, initialUnrealized, year) {
    const source = JSON.stringify([
      getYearData(tradingData, year),
      getYearInitial(initialFunds, year),
      getYearInitial(initialUnrealized, year)
    ]);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(16)}`;
  }

  function isSummarySnapshotCurrent(snapshot, sourceFingerprint, latestMonth, yearData, accountKeys) {
    const snapshotMonth = Number(snapshot?.month);
    return Boolean(snapshot)
      && Boolean(sourceFingerprint)
      && snapshot.sourceFingerprint === sourceFingerprint
      && snapshotMonth === latestMonth
      && isMonthEntered(yearData, snapshotMonth, accountKeys);
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
    getNumericYears: getNumericYears,
    hasStoredNumber: hasStoredNumber,
    isMonthEntered: isMonthEntered,
    isAccountMonthEntered: isAccountMonthEntered,
    getLatestEnteredMonth: getLatestEnteredMonth,
    calculateMonthlyFieldTotal: calculateMonthlyFieldTotal,
    createYearSourceFingerprint: createYearSourceFingerprint,
    isSummarySnapshotCurrent: isSummarySnapshotCurrent
  };
})();
