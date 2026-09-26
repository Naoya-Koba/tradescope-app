# Data Model

## 1. データ分類

TradeScopeのデータは、概念上次の4層に分類する。

### 1. 元データ

**Decided**：ユーザー入力またはCSV/API/PDF等の外部原資料から取得され、TradeScope内部の計算によって生成された派生値ではない正本入力データ。外部原資料から再インポート可能なRaw Transactionも元データに含む。

例：

- 月次入力
- 年初資金、年初評価損益
- 口座残高
- 決済損益、スワップ、評価額、入出金
- 取引履歴
- 保有数量、取得単価、評価額
- 将来のCSV、API、PDFインポート結果
- Raw Transactions

### 2. ユーザー付与情報

**Decided**：外部取引データとは独立してユーザーが付与・編集する情報。

例：

- Risk設定
- Risk対象ON/OFF
- 将来のRisk対象数量上書き
- 戦略
- Memo
- 銘柄リスト
- タグ
- Account設定とインポート紐付け

**Decided**：CSV/PDF再インポートでユーザー付与情報を失ってはならない。

### 3. 派生データ

**Decided**：元データとユーザー付与情報から再計算できるデータ。正本として手編集しない。

例：

- 純資産、確定資産
- 年間損益、成長率
- Asset Trend
- Monthly P/L集計
- Position、Open Positions
- Completed Trades
- Risk指標とRisk状態
- Asset Allocation
- Swap集計
- Analytics

### 4. キャッシュ・UI状態

**Decided**：削除しても正本データから復旧できるデータ。

例：

- Summaryスナップショット
- News・翻訳キャッシュ
- 選択年度
- 折りたたみ状態
- 表示モード
- Service Worker Cache Storage

**Decided**：キャッシュやスナップショットを正本にしない。画面間で同一の共通計算結果を共有する実装手段としては使用できるが、無効化条件または再生成条件を持たせる。

## 2. 現在のlocalStorage

| キー | Current分類 | 内容 | 完全バックアップ要否 |
|---|---|---|---|
| `tradingData` | 元データ中心 | 年→月→口座の月次入力、保有明細 | 必須 |
| `yearInitialFunds` | 元データ | 年初資金 | 必須 |
| `yearInitialUnrealized` | 元データ | 年初評価損益 | 必須 |
| `tradeScopeTradeHistoryV1` | 元データ＋一部ユーザー情報 | 取引、戦略、Memo | 必須 |
| `tradeScopeMemos` | ユーザー付与情報 | トップMemo | 必須 |
| `tradeScopeSymbolListV1` | ユーザー付与情報 | 銘柄候補 | 必須 |
| `tradeInfo` | Legacy元データ | 旧取引情報。現在ユーザーは利用しておらず、正式機能として維持予定もない。残存データの有無は未確認 | 残存時のみ、移行・削除判断まで一時保護 |
| `tradeScopeTopSummarySnapshotV1` | 派生キャッシュ | トップ用Summary。画面間の値を揃える目的で利用 | バックアップ不要、正本から再生成する |
| `tradeScopeSelectedYear` | UI状態 | 選択年度 | 任意 |
| `tradeScopeOpenPositionsView` | UI状態 | 統合／口座別表示 | 任意 |
| `tradeScopeCollapseState:<path>` | UI状態 | セクション折りたたみ | 任意 |
| `profitSkipDemoSeed` | UI・動作状態 | ダミー再投入抑止 | 原則不要 |
| `tradeScopeNewsHeadlinesV12` | キャッシュ | News | 不要 |
| `tradeScopeNewsCountryV4:*` | キャッシュ | 通貨別News | 不要 |
| `tradeScopeNewsTranslationCacheV1` | キャッシュ | 翻訳結果 | 不要 |

**Current**：一つの`tradingData`内に元データ、入力補助、派生値、保存済みフラグが混在している。

**Decided**：現在のlocalStorage構造を一括変更しない。既存キーを読みながら、後方互換性を保つ段階的移行を行う。

## 3. 現在の月次データ概念

現在の概略形状：

```text
tradingData[year][month][accountKey] = {
  realizedPnL,
  swapPnL,
  unrealizedPnL,
  unrealizedLegs,
  maintenanceRate,
  deposit,
  withdrawal,
  monthEndBalance,
  netAssets,
  holdings
}
```

`holdings`には証券・暗号資産の`symbol`、`quantity`、`rate`または`acquisitionRate`、`valueJPY`等が保存される。

**Known issue**：`unrealizedPnL`や`netAssets`のような派生値も同じ構造に保存され、再計算値と保存値の責務が曖昧である。

## 4. Account

**Decided**：Accountを正式な基本エンティティとして扱う。

将来の最小概念：

```text
Account {
  accountId        // 表示名に依存しない安定した内部ID
  displayName      // ユーザー向け表示名
  institution      // 金融機関
  accountType      // FX、証券、暗号資産、銀行等の口座種別
  enabled          // 有効 / 無効
  importMappings   // CSV/API/PDF上の名称・番号との紐付け
}
```

- **Decided**：AccountとAsset Classを分離する。
- **Decided**：表示名変更で過去データとの関連が切れないよう、安定した`accountId`を使う。
- **Decided**：過去データを持つAccountは原則物理削除せず、無効化する。
- **Planned**：設定画面からAccountを追加・編集・無効化する。
- **Under consideration**：Account IDの具体的形式、既存固定キーからの移行方法。

## 5. Asset ClassとInstrument

**Decided**：少なくとも次を区別可能な設計とする。

- FX
- Stock
- ETF
- Mutual Fund
- Crypto Asset
- Cash / Bank Deposit
- Other

**Current**：株式、ETF、投資信託は「証券」にまとめられ、銘柄名キーワードで投資信託・ETFを推定している。

**Known issue**：銘柄名による推定は誤判定し得る。将来はInstrumentの明示属性として保持する。

## 6. Transactionとユーザーメタデータ

**Planned**：インポート処理は次の層に分ける。

```text
Import Source
  -> Raw Transaction
  -> Normalized Transaction
  -> Position reconstruction
  -> Completed Trade
  -> Analytics
```

Raw Transactionには、元ファイルの値、出典、インポート日時、行識別子を保持できる余地を持たせる。

**Decided**：戦略、Risk対象、タグ、ユーザーMemoは、再インポート可能な取引行そのものから分離し、安定した取引・ポジション識別子へ関連付ける。

**Decided**：CSV/PDFに存在しない戦略、Risk設定、決済対応関係等を推測で埋めない。

## 7. PositionとCompleted Trade

- **Decided**：Positionは取引列から再構築可能な派生データとする。
- **Decided**：Completed Tradeも原則として取引と対応付けルールから生成する派生データとする。
- **Current**：同方向追加は加重平均、反対売買は数量減算、反転時は新規側レートへ平均を切り替える。
- **Under consideration**：FIFO、総平均、口座別約定単位、手数料、税、部分決済の正式対応ルール。

## 8. 移行原則

- 旧キーを即時削除しない。
- 新形式を導入する場合は旧形式読込→正規化→新形式利用を可能にする。
- 移行前のデータを退避する。
- 移行済みバージョンを記録し、二重変換を防ぐ。
- 欠落項目には安全な初期値または`unknown`を使う。
- 既存データの意味が不明な場合は変換せず、確認対象として残す。
