(function () {
  const STORAGE_KEY = 'tradeScopeTradeHistoryV1';
  const FX_CONTRACT_SIZE_DEFAULT = 10000;

  const CARRY_PAIRS = ['TRY/JPY', 'HUF/JPY', 'MXN/JPY', 'ZAR/JPY', 'CZK/JPY'];
  const HUF_PAIR = 'HUF/JPY';
  const HUF_CONTRACT_SIZE = 100000;
  const HUF_RISK_RATE = 0.1; // 1円では利益方向のため0.1円時を基準に  const LARGE_LOT_PAIRS = ['HUF/JPY', 'ZAR/JPY', 'MXN/JPY']; // 10万通貨/ロット
  function normalizeSymbolKey(symbol) {
    return String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function isCarryPair(symbol) {
    const key = normalizeSymbolKey(symbol);
    return CARRY_PAIRS.some(p => normalizeSymbolKey(p) === key);
  }

  function resolveDefaultContractSize(assetType, symbol) {
    if (assetType !== 'FX') return 1;
    const key = normalizeSymbolKey(symbol);
    return LARGE_LOT_PAIRS.some(p => normalizeSymbolKey(p) === key)
      ? HUF_CONTRACT_SIZE
      : FX_CONTRACT_SIZE_DEFAULT;
  }

  function parseEntries() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .map((entry, idx) => normalizeEntry(entry, idx))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function normalizeEntry(entry, idx) {
    if (!entry || typeof entry !== 'object') return null;
    const date = String(entry.date || '').trim();
    const account = String(entry.account || '').trim();
    const symbol = String(entry.symbol || '').trim();
    const side = entry.side === 'sell' ? 'sell' : 'buy';
    const category = String(entry.category || 'new').trim() || 'new';
    const rawAssetType = String(entry.assetType || 'FX').trim() || 'FX';
    const assetType = rawAssetType === 'NISA' ? '証券' : rawAssetType;
    const strategy = String(entry.strategy || '').trim();
    const quantity = Number(entry.quantity);
    const rate = Number(entry.rate);
    const memo = String(entry.memo || '').trim();
    const createdAt = Number(entry.createdAt) || Date.now() + idx;
    const id = String(entry.id || `${createdAt}-${idx}`);
    const contractSize = Number(entry.contractSize);
    const defaultContractSize = resolveDefaultContractSize(assetType, symbol);

    if (!date || !account || !symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
      return null;
    }

    return {
      id,
      date,
      account,
      symbol,
      side,
      category,
      assetType,
      strategy,
      quantity,
      rate,
      memo,
      createdAt,
      contractSize: Number.isFinite(contractSize) && contractSize > 0 ? contractSize : defaultContractSize
    };
  }

  function saveEntries(entries) {
    const normalized = (entries || [])
      .map((entry, idx) => normalizeEntry(entry, idx))
      .filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function addEntry(entry) {
    const entries = parseEntries();
    const normalized = normalizeEntry({
      ...entry,
      id: entry?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: entry?.createdAt || Date.now()
    }, entries.length);
    if (!normalized) return null;
    entries.push(normalized);
    saveEntries(entries);
    return normalized;
  }

  function removeEntry(id) {
    const entries = parseEntries();
    const next = entries.filter((entry) => entry.id !== id);
    saveEntries(next);
    return next;
  }

  function getSortedEntries(entries, sortOrder) {
    const dir = sortOrder === 'oldest' ? 1 : -1;
    return [...(entries || [])].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA < dateB) return -1 * dir;
      if (dateA > dateB) return 1 * dir;
      return (Number(a.createdAt) - Number(b.createdAt)) * dir;
    });
  }

  function filterEntries(entries, filters) {
    const f = filters || {};
    return (entries || []).filter((entry) => {
      if (f.account && entry.account !== f.account) return false;
      if (f.symbol && entry.symbol !== f.symbol) return false;
      if (f.strategy && entry.strategy !== f.strategy) return false;
      if (f.category && entry.category !== f.category) return false;
      if (f.assetType && entry.assetType !== f.assetType) return false;
      return true;
    });
  }

  function calculateOpenPositions(entries) {
    const sorted = getSortedEntries(entries || [], 'oldest');
    const map = new Map();

    sorted.forEach((entry) => {
      const key = `${entry.account}::${entry.symbol}::${entry.assetType}`;
      const signedQty = entry.side === 'buy' ? Number(entry.quantity) : -Number(entry.quantity);
      if (!Number.isFinite(signedQty) || signedQty === 0) return;

      const current = map.get(key) || {
        account: entry.account,
        symbol: entry.symbol,
        assetType: entry.assetType,
        strategy: entry.strategy,
        quantity: 0,
        avgRate: 0,
        contractSize: entry.contractSize || resolveDefaultContractSize(entry.assetType, entry.symbol)
      };

      const nextQty = current.quantity + signedQty;

      if (current.quantity === 0 || Math.sign(current.quantity) === Math.sign(signedQty)) {
        const currentAbs = Math.abs(current.quantity);
        const addAbs = Math.abs(signedQty);
        const weighted = ((current.avgRate * currentAbs) + (entry.rate * addAbs)) / (currentAbs + addAbs);
        current.quantity = nextQty;
        current.avgRate = Number.isFinite(weighted) ? weighted : entry.rate;
      } else {
        if (Math.abs(nextQty) < 1e-12) {
          current.quantity = 0;
          current.avgRate = 0;
        } else if (Math.sign(nextQty) === Math.sign(current.quantity)) {
          current.quantity = nextQty;
        } else {
          current.quantity = nextQty;
          current.avgRate = entry.rate;
        }
      }

      if (entry.strategy) current.strategy = entry.strategy;
      current.contractSize = entry.contractSize || current.contractSize || resolveDefaultContractSize(entry.assetType, entry.symbol);
      map.set(key, current);
    });

    return Array.from(map.values())
      .filter((position) => Math.abs(position.quantity) > 1e-12)
      .map((position) => ({
        ...position,
        side: position.quantity >= 0 ? 'buy' : 'sell',
        absQuantity: Math.abs(position.quantity)
      }));
  }

  function calculateFxRisk(openPositions) {
    // リスク計算対象は主要キャリーペア（TRY/JPY, HUF/JPY, MXN/JPY, ZAR/JPY, CZK/JPY）のみ
    const carryPositions = (openPositions || []).filter(
      (position) => position.assetType === 'FX' && isCarryPair(position.symbol)
    );

    let fxOneYenLoss = 0;      // HUF以外のキャリー: 1円時損失
    let fxHufPointOneLoss = 0; // HUF/JPYのみ: 0.1円時損失（1円 > 現レートのため）
    let fxZeroYenLoss = 0;     // 全キャリー: 0円時損失（想定最大）

    carryPositions.forEach((position) => {
      const isHuf = normalizeSymbolKey(position.symbol) === normalizeSymbolKey(HUF_PAIR);
      const isLargeLot = LARGE_LOT_PAIRS.some(p => normalizeSymbolKey(p) === normalizeSymbolKey(position.symbol));
      // HUF/ZAR/MXN等の10万通貨ペアは過去の登録内容にかかわらず常に100000で上書き
      const contractSize = isLargeLot
        ? HUF_CONTRACT_SIZE
        : (Number(position.contractSize) || FX_CONTRACT_SIZE_DEFAULT);
      const signedUnits = Number(position.quantity) * contractSize;
      const entryRate = Number(position.avgRate) || 0;

      if (isHuf) {
        fxHufPointOneLoss += Math.max(0, -((HUF_RISK_RATE - entryRate) * signedUnits));
      } else {
        fxOneYenLoss += Math.max(0, -((1 - entryRate) * signedUnits));
      }
      fxZeroYenLoss += Math.max(0, -((0 - entryRate) * signedUnits));
    });

    return { fxOneYenLoss, fxHufPointOneLoss, fxZeroYenLoss };
  }

  function calculateRiskSummary(entries, cryptoValue) {
    const openPositions = calculateOpenPositions(entries);
    const fxRisk = calculateFxRisk(openPositions);
    const cryptoZeroYenLoss = Math.max(0, Number(cryptoValue) || 0);
    // 最大損失 = FX全キャリー0円時 + 暗号資産0円時
    const maxLoss = fxRisk.fxZeroYenLoss + cryptoZeroYenLoss;

    // トップ表示用: 現在建玉中のキャリーシンボル・暗号資産シンボルを抽出
    const activeCarrySymbols = [...new Set(
      openPositions
        .filter(p => p.assetType === 'FX' && isCarryPair(p.symbol))
        .map(p => p.symbol.toUpperCase().trim())
    )];
    const activeCryptoSymbols = [...new Set(
      openPositions
        .filter(p => p.assetType === '暗号資産')
        .map(p => p.symbol.trim())
    )];

    return {
      maxLoss,
      fxOneYenLoss: fxRisk.fxOneYenLoss,
      fxHufPointOneLoss: fxRisk.fxHufPointOneLoss,
      fxZeroYenLoss: fxRisk.fxZeroYenLoss,
      cryptoZeroYenLoss,
      openPositions,
      activeCarrySymbols,
      activeCryptoSymbols
    };
  }

  const TRADING_DATA_STORAGE_KEY = 'tradingData';
  const SBI_ACCOUNT_NAMES = ['SBI', 'SBI証券'];

  function isSbiAccount(accountName) {
    const normalized = String(accountName || '').trim().toUpperCase().replace(/\s+/g, '');
    return normalized === 'SBI' || normalized.includes('SBI証券');
  }

  function isSecuritiesAssetType(assetType) {
    const t = String(assetType || '').trim();
    return t === '証券' || t === 'NISA';
  }

  /**
   * SBI証券のOpen Positionsを「月次スナップショット＋差分」で構築する。
   *
   * ロジック:
   *   1. tradingDataから最新の保存済み月(snapshot)を検索
   *   2. snapshotのsbi.holdingsをベースラインとして取得
   *   3. Trade HistoryからsnapshotのYYYY-MM以降のSBI証券エントリのみ抽出して差分計算
   *   4. ベースライン + 差分 = Open Positions として返す
   *
   * snapshotがない場合はTrade History全件でcalculateOpenPositions()を使う（従来通り）。
   */
  function buildSecuritiesOpenPositions(entries) {
    const tradingData = (function () {
      try { return JSON.parse(localStorage.getItem(TRADING_DATA_STORAGE_KEY) || '{}'); } catch { return {}; }
    })();

    // --- 最新の保存済み月を探す ---
    let snapshotYear = null;
    let snapshotMonth = null;
    let snapshotHoldings = null;

    const years = Object.keys(tradingData)
      .map(Number).filter(Number.isFinite).sort((a, b) => b - a);

    outer: for (const year of years) {
      const yearData = tradingData[year] || tradingData[String(year)] || {};
      for (let month = 12; month >= 1; month -= 1) {
        const monthData = yearData[month] || yearData[String(month)];
        if (!monthData?.__saved) continue;
        const holdings = monthData?.sbi?.holdings;
        if (!Array.isArray(holdings) || holdings.length === 0) continue;
        snapshotYear = year;
        snapshotMonth = month;
        snapshotHoldings = holdings;
        break outer;
      }
    }

    // --- snapshotがない場合は従来通り ---
    if (!snapshotHoldings) {
      return calculateOpenPositions(
        (entries || []).filter(e => isSbiAccount(e.account) && isSecuritiesAssetType(e.assetType))
      );
    }

    // スナップショット月の末日（YYYY-MM形式の比較用）
    const snapshotYM = `${snapshotYear}-${String(snapshotMonth).padStart(2, '0')}`;

    // --- ベースラインをMapに展開 ---
    // スナップショットのacquisitionRateを信頼できる基準値として使用する。
    // avgRateの単位: 万口単位（例: 34,715円/万口）で統一。
    const TRUST_KEYWORDS_UC = ['オール・カントリー', 'オールカントリー', 'EMAXIS', '投信', 'インデックス', 'ファンド', 'スリム'];
    const posMap = new Map();
    snapshotHoldings.forEach((h) => {
      const symbol = String(h?.symbol || '').trim();
      if (!symbol) return;
      const qty = Number(h.quantity) || 0;
      if (qty <= 0) return;
      const isTrust = TRUST_KEYWORDS_UC.some((kw) => symbol.toUpperCase().includes(kw));
      const unitMultiplier = isTrust ? 10000 : 1;
      const valueJPY = h.valueFilled === true ? (Number(h.valueJPY) || 0) : 0;
      // avgRate優先順: acquisitionRate（万口単位） → valueJPY÷qty×unitMultiplier → rate×unitMultiplier
      let avgRate = 0;
      if (h.acquisitionRate != null && Number(h.acquisitionRate) > 0) {
        avgRate = Number(h.acquisitionRate); // 万口単位のまま使用
      } else if (valueJPY > 0 && qty > 0) {
        avgRate = (valueJPY / qty) * unitMultiplier; // per口→万口単位に変換
      } else {
        avgRate = (Number(h.rate) || 0) * unitMultiplier; // per口→万口単位に変換
      }
      posMap.set(symbol, { symbol, quantity: qty, avgRate, valueJPY, fromSnapshot: true });
    });

    // --- snapshot月より後のTrade Historyエントリを差分として適用 ---
    // 買い増しは加重平均でavgRateを更新、売りは数量のみ減算
    const deltaEntries = (entries || []).filter((e) => {
      if (!isSbiAccount(e.account)) return false;
      if (!isSecuritiesAssetType(e.assetType)) return false;
      const entryYM = String(e.date || '').slice(0, 7); // YYYY-MM
      return entryYM > snapshotYM;
    });

    const sortedDelta = getSortedEntries(deltaEntries, 'oldest');
    sortedDelta.forEach((e) => {
      const symbol = String(e.symbol || '').trim();
      if (!symbol) return;
      const signedQty = e.side === 'buy' ? Number(e.quantity) : -Number(e.quantity);
      if (!Number.isFinite(signedQty) || signedQty === 0) return;
      const entryRate = Number(e.rate) || 0; // Trade Historyのrateは万口単位

      if (posMap.has(symbol)) {
        const current = posMap.get(symbol);
        if (signedQty > 0) {
          // 買い増し: 加重平均でavgRateを更新
          const currentAbs = Math.abs(current.quantity);
          const addAbs = signedQty;
          const weighted = ((current.avgRate * currentAbs) + (entryRate * addAbs)) / (currentAbs + addAbs);
          current.avgRate = Number.isFinite(weighted) ? weighted : entryRate;
        }
        current.quantity += signedQty;
        if (Math.abs(current.quantity) < 1e-12) current.quantity = 0;
      } else {
        // スナップショットにない銘柄がdeltaで登場した場合
        posMap.set(symbol, { symbol, quantity: signedQty, avgRate: entryRate, valueJPY: 0, fromSnapshot: false });
      }
    });

    // --- 結果を返す ---
    return Array.from(posMap.values())
      .filter((p) => Math.abs(p.quantity) > 1e-12)
      .map((p) => ({
        account: 'SBI',
        symbol: p.symbol,
        assetType: '証券',
        side: p.quantity >= 0 ? 'buy' : 'sell',
        absQuantity: Math.abs(p.quantity),
        quantity: p.quantity,
        avgRate: p.avgRate,
        contractSize: 1,
        strategy: '',
        valueJPY: p.valueJPY,
        fromSnapshot: p.fromSnapshot === true
      }));
  }

  window.TradeScopeHistory = {
    STORAGE_KEY,
    FX_CONTRACT_SIZE_DEFAULT,
    CARRY_PAIRS,
    HUF_PAIR,
    HUF_CONTRACT_SIZE,
    HUF_RISK_RATE,
    normalizeSymbolKey,
    isCarryPair,
    parseEntries,
    saveEntries,
    addEntry,
    removeEntry,
    filterEntries,
    getSortedEntries,
    calculateOpenPositions,
    calculateRiskSummary,
    buildSecuritiesOpenPositions
  };
})();