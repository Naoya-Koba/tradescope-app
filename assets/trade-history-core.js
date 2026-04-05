(function () {
  const STORAGE_KEY = 'tradeScopeTradeHistoryV1';
  const FX_CONTRACT_SIZE_DEFAULT = 10000;

  const CARRY_PAIRS = ['TRY/JPY', 'HUF/JPY', 'MXN/JPY', 'ZAR/JPY', 'CZK/JPY'];
  const HUF_PAIR = 'HUF/JPY';
  const HUF_CONTRACT_SIZE = 100000;
  const HUF_RISK_RATE = 0.1; // 1円では利益方向のため0.1円時を基準に

  function normalizeSymbolKey(symbol) {
    return String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function isCarryPair(symbol) {
    const key = normalizeSymbolKey(symbol);
    return CARRY_PAIRS.some(p => normalizeSymbolKey(p) === key);
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
    const assetType = String(entry.assetType || 'FX').trim() || 'FX';
    const strategy = String(entry.strategy || '').trim();
    const quantity = Number(entry.quantity);
    const rate = Number(entry.rate);
    const memo = String(entry.memo || '').trim();
    const createdAt = Number(entry.createdAt) || Date.now() + idx;
    const id = String(entry.id || `${createdAt}-${idx}`);
    const contractSize = Number(entry.contractSize);

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
      contractSize: Number.isFinite(contractSize) && contractSize > 0 ? contractSize : FX_CONTRACT_SIZE_DEFAULT
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
        contractSize: entry.contractSize || FX_CONTRACT_SIZE_DEFAULT
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
      current.contractSize = entry.contractSize || current.contractSize || FX_CONTRACT_SIZE_DEFAULT;
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
      // HUF/JPYは10万通貨/ロット。履歴入力時にcontractSize=100000が設定されているが念のため上書き
      const contractSize = isHuf
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
    calculateRiskSummary
  };
})();