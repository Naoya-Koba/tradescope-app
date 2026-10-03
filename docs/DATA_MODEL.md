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
| `tradeScopeRestoreJournalV1` | 復元安全制御 | 復元対象キーの適用前生文字列と存在有無。成功後に削除 | 不要 |
| `tradeScopeNewsHeadlinesV12` | キャッシュ | News | 不要 |
| `tradeScopeNewsCountryV4:*` | キャッシュ | 通貨別News | 不要 |
| `tradeScopeNewsTranslationCacheV1` | キャッシュ | 翻訳結果 | 不要 |

**Current**：一つの`tradingData`内に元データ、入力補助、派生値、保存済みフラグが混在している。

**Decided**：現在のlocalStorage構造を一括変更しない。既存キーを読みながら、後方互換性を保つ段階的移行を行う。

**Current**：`tradeScopeSymbolListV1`は読込時に、ユーザー確認済みの既知表記`EUD/USD`を`EUR/USD`へ、`ZAr/JPY`を`ZAR/JPY`へ移行し、移行後の重複を先頭の並び順を保って統合する。その他の銘柄は変更しない。この移行は再実行しても結果が変わらない。

**Decided**：FXとして新規登録・編集する`AAA/BBB`形式の通貨ペアは、前後空白を除去しASCII英字を大文字化して保存する。既知alias以外のタイプミスを推測修正せず、証券・投資信託・暗号資産等にはFX用の大文字化を適用しない。

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

**Current**：GMO、Light FX、みんなのFX、SBI、SBI VC、三井住友銀行は、月次データや取引履歴のコード内で固定キーまたは表示名として扱われている。Accountマスターと設定画面はまだ存在しない。

将来の最小概念：

```text
Account {
  id               // 表示名・配列位置・providerCodeに依存しない安定した内部ID
  displayName      // ユーザー向け表示名
  providerCode     // 金融機関・サービス提供者の識別子
  providerName     // 金融機関・サービス提供者の表示名
  accountType      // FX、証券、暗号資産、銀行等の口座種別
  enabled          // 有効 / 無効
  legacyRefs       // 現行キー・表示名との対応情報
  createdAt
  updatedAt
}
```

- **Decided**：AccountとAsset Classを分離する。
- **Decided**：表示名変更で過去データとの関連が切れないよう、安定した`id`を使う。表示名、配列位置、`providerCode`をIDとして使用しない。
- **Decided**：同じ金融機関に複数口座を持てる設計とし、Accountとproviderを同一視しない。
- **Decided**：過去データを持つAccountは原則物理削除せず、無効化する。
- **Decided**：現行の`gmo`、`GMO`等との対応は`legacyRefs`等の移行情報として保持し、新しい安定IDそのものにはしない。
- **Planned**：設定画面からAccountを追加・編集・無効化する。
- **Planned**：初期Account IDは`acc_gmo_fx`、`acc_lightfx_fx`、`acc_minna_fx`、`acc_sbi_sec`、`acc_sbivc_crypto`、`acc_smbc_bank`等を候補とする。
- **Under consideration**：Account IDの最終命名、既存固定キーとの具体的な変換規則、ユーザーによる追加口座のID生成方式。

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

**Current**：`tradeScopeSymbolListV1`はユーザー向けの銘柄候補文字列配列であり、安定IDや資産種別を持つ商品マスターではない。

**Decided**：`tradeScopeSymbolListV1`をそのまま正式なInstrumentマスターへ昇格させない。Instrumentは取引対象そのものを表し、Accountおよび口座固有の取引仕様から分離する。

将来の最小概念：

```text
Instrument {
  id               // 安定した内部ID
  assetType        // FX、Stock、ETF、Mutual Fund、Crypto、Cash等
  symbol           // canonical symbol
  displayName
  baseCurrency     // 適用可能な場合
  quoteCurrency    // 適用可能な場合
  enabled
  aliases          // 明示確認済みの別名
  userAdded
  createdAt
  updatedAt
}
```

- **Decided**：FXの`TRY/JPY`、`HUF/JPY`、`USD/JPY`等はcanonicalなInstrumentとして識別可能にする。
- **Decided**：既存のFX文字列正規化はInstrument照合前の前処理として再利用する。前後空白、ASCII英字の大文字小文字、明示確認済みaliasだけを扱い、未知のタイプミスを推測修正しない。
- **Decided**：証券、投資信託、暗号資産等へFX専用の正規化を誤適用しない。
- **Under consideration**：Instrument IDの最終形式、初期マスターの範囲、ユーザー追加Instrumentの重複判定と承認フロー。

## 6. AccountInstrumentSetting

**Decided**：Instrument自体と、特定Accountでの取引単位・業者固有表記を分離する。`contractSize`やlot sizeをInstrument固有値として固定しない。

将来の最小概念：

```text
AccountInstrumentSetting {
  id
  accountId
  instrumentId
  quantityUnit
  contractSize
  minimumQuantity
  quantityStep
  brokerSymbol
  enabled
  createdAt
  updatedAt
}
```

**Current / Known issue**：現行コードにはHUF/JPY、ZAR/JPY、MXN/JPYを口座にかかわらず100,000通貨として扱う経路がある。この値は新しいAccountInstrumentSettingの正本値として引き継がない。

**Under consideration**：各業者・通貨ペアの正確な`contractSize`、最小lot、数量単位、証拠金関連情報は、実CSVおよび業者の正式仕様を確認して決定する。

**Planned**：将来、RawTransactionの数量解釈に使用したAccountInstrumentSettingとそのrevisionを追跡可能にする。

**Under consideration**：追跡フィールドは`accountInstrumentSettingId`や設定revision等を候補とする。有効期間を含む完全な版管理方式はCSV MVPの必須範囲としない。

## 7. インポート処理の境界

**Planned**：インポート処理は次の層に分ける。

```text
CSV / API / PDF / Manual Entry
  -> ImportBatch
  -> ImportRowDraft / Preview Row
  -> user confirmation / resolution
  -> RawTransaction
  -> Position reconstruction
  -> Completed Trade
  -> Analytics
```

**Decided**：照合不能、型不正、警告を含む行をRawTransactionへ直接保存しない。`mappingStatus`や`validationIssues`はImportRowDraft / Preview Rowの責務とし、RawTransactionのフィールドにしない。

**Planned**：ImportBatchは一回の取込単位を表す。候補フィールドは次のとおり。

```text
ImportBatch {
  id
  sourceType
  sourceProvider
  sourceFileMetadata
  importedAt
  importerId
  importerVersion
}
```

**Planned**：ImportRowDraft / Preview Rowは、確定前の解析・照合・警告表示を担当する。候補フィールドは`rawFields`、`rowNumber`、`mappingStatus`、`validationIssues`、`resolvedAccountId`、`resolvedInstrumentId`とする。

**Decided**：ImportRowDraftはプレビュー中だけの一時データとしてよく、永続保存を必須としない。

## 8. RawTransaction

**Decided**：RawTransactionは、CSV / API / PDF / 手入力から受理した「取引事実」を保存する正本層とする。PositionおよびCompleted TradeはRawTransactionから生成される派生データである。

候補フィールド：

```text
RawTransaction {
  schemaVersion
  id
  sourceType
  sourceProvider
  importBatchId
  sourceRowNumber | sourceLocator
  externalTransactionId
  accountId
  instrumentId
  brokerRawSymbol
  executedAt
  executedAtRaw
  side
  quantity
  quantityUnit
  price
  fee
  swap
  realizedPnl
  currency
  transactionType
  rawFields
  importedAt
}
```

- **Decided**：RawTransactionには、原資料に存在する事実だけを保存する。存在しない手数料、スワップ、実現損益、時刻、タイムゾーン等を推測して補完しない。
- **Decided**：不明値を`0`へ変換しない。`null`または欠落と、実際の数値`0`を区別する。
- **Decided**：金額、数量、価格等のdecimal値は、早期にJavaScriptの浮動小数へ変換せず、元の精度を保持できるdecimal文字列を基本候補とする。
- **Decided**：日付しかない原資料へ架空の`00:00:00`やタイムゾーンを付与しない。原文を`executedAtRaw`等で保持できるようにする。
- **Decided**：ファイル名、hash等のファイル単位情報はImportBatchへ保存し、各RawTransactionへ重複保存しない。RawTransactionは`importBatchId`と行番号またはlocatorで出典へ戻れるようにする。
- **Decided**：原資料の列は`rawFields`へ保持できる。受理後の標準フィールドと元の表現を区別する。
- **Under consideration**：取引種別ごとの必須・nullable項目、decimal文字列表現、日時の標準化、手入力をImportBatch経由にするか直接保存するか。

## 9. TransactionAnnotationとその他ユーザーメタデータ

**Decided**：戦略、Risk対象、タグ、ユーザーMemoは、再インポート可能な取引行そのものから分離し、安定した取引・ポジション識別子へ関連付ける。再インポートしてもユーザー付与情報を失ってはならない。

**Decided**：CSV/PDFに存在しない戦略、Risk設定、決済対応関係等を推測で埋めない。

**Planned**：取引単位のユーザー付与情報は、まず次の`TransactionAnnotation`として分離する。

```text
TransactionAnnotation {
  id
  rawTransactionId
  strategy
  memo
  tags
  createdAt
  updatedAt
}
```

**Decided**：CSVの備考列等、原資料に存在する情報は`rawFields`またはRawTransaction側へ保持し、TradeScope上で後から入力したMemoとは区別する。

**Planned**：Risk対象ON/OFF・基準価格・数量上書き、Position grouping、Completed Trade matching overrideは、TransactionAnnotationへ混在させず、それぞれ独立した将来モデルとして設計する。

**Under consideration**：これらのモデル名、関連先、必須フィールド、ユーザーによる上書き単位は各機能の実装前に決定する。

## 10. Duplicate protection

**Decided**：同一ファイルや同一取引を再度取り込んでも、確定済みRawTransactionを無条件に重複作成しない。

重複判定は次の二段階を基本とする。

1. 業者が安定した`externalTransactionId`を提供する場合は、AccountとそのIDを第一識別子とする。
2. IDがない場合は、原資料に存在する口座、日時、銘柄、売買、数量、価格等からversion付きrow fingerprintを生成する。

- **Decided**：source file hashだけを取引重複判定には使用しない。同一取引が別ファイルへ再収録される場合があるためである。
- **Decided**：完全一致に見える正当な複数約定を自動削除しない。曖昧な一致は「重複候補」としてユーザー確認へ回す。
- **Under consideration**：最初の実CSVを確認するまで、fingerprintの最終構成フィールド、時刻精度、取引IDの安定性、訂正・取消取引の扱いは確定しない。

## 11. PositionとCompleted Trade

- **Decided**：Positionは取引列から再構築可能な派生データとする。
- **Decided**：Completed Tradeも原則として取引と対応付けルールから生成する派生データとする。
- **Current**：同方向追加は加重平均、反対売買は数量減算、反転時は新規側レートへ平均を切り替える。
- **Under consideration**：FIFO、総平均、口座別約定単位、手数料、税、部分決済の正式対応ルール。

## 12. 現行データとの並行運用と移行

**Current**：次の現行キーが正本またはユーザー付与情報として利用されている。

- `tradingData`
- `tradeScopeTradeHistoryV1`
- `tradeScopeSymbolListV1`
- `yearInitialFunds`
- `yearInitialUnrealized`

**Decided**：新モデル導入時もこれらを即時一括置換しない。RawTransaction等の新モデルと並行運用を開始し、同等性を確認してから段階移行する。

**Current / Known issue**：`tradeScopeTradeHistoryV1`は取引事実、戦略、Memo、口座表示名、`contractSize`等を一つのentryに混在させる。保存時の正規化で未知フィールドを失う経路もある。

**Planned**：既存履歴を将来移行する際は、元entryを保護したうえで、取引事実をRawTransactionへ、戦略・Memo等をTransactionAnnotationへ分離する。AccountまたはInstrumentを根拠なく推測できない行は未解決としてユーザー確認対象にする。

**Planned**：移行前後で件数、数量、金額、Position、Risk等を照合し、同等性が確認できるまで旧キーを削除しない。

## 13. 保存境界とlocalStorageキー案

**Decided**：画面や計算処理が`localStorage`キーを直接前提にしないよう、Repository / Storage Adapterを介して読み書きする。これにより将来のIndexedDBまたはcloud syncへの移行余地を保つ。

**Planned**：新モデルをlocalStorageへ保存する段階では、次のキーを候補とする。

- `tradeScopeAccountsV1`
- `tradeScopeInstrumentsV1`
- `tradeScopeAccountInstrumentSettingsV1`
- `tradeScopeRawTransactionsV1`
- `tradeScopeTransactionAnnotationsV1`
- `tradeScopeRiskSettingsV1`
- `tradeScopeDataModelMetaV1`
- `tradeScopeImportBatchesV1`（ImportBatchを永続化する場合のみ）

各保存値は、`schemaVersion`とrecordsを持つJSON envelopeを基本候補とする。

```text
{
  schemaVersion,
  records,
  updatedAt
}
```

**Known issue**：RawTransaction件数の増加によりlocalStorage容量上限へ達する可能性がある。

**Under consideration**：CSV MVPで直ちに全面IndexedDB化はしないが、実データ量を確認しながら保存先移行の時期を決める。Repository境界とstable IDを先に導入し、移行を妨げない。

## 14. Riskとの分離

**Decided**：Risk設定はInstrumentおよびAccountInstrumentSettingと分離する。Instrumentの存在やlot sizeだけを理由にRisk対象へしない。

**Planned**：Risk対象ON/OFF、耐性基準価格、個別ポジション上書き等は、`RISK_SPEC.md`に従う独立モデルとして管理する。

## 15. 実装範囲と順序

**Planned**：CSV MVP前後の推奨実装順序は次のとおり。

1. Entity定義とvalidator
2. 現行6口座のAccount seedと`legacyRefs`
3. canonical Instrument seedとresolver
4. AccountInstrumentSetting
5. Repository / Storage Adapter
6. 新モデルを含む完全バックアップ対応
7. RawTransaction repository
8. ImportBatchとImportRowDraft / preview
9. duplicate detection
10. 1業者・1形式に限定したCSV MVP
11. TransactionAnnotation
12. Position projection
13. `tradeScopeTradeHistoryV1`の段階移行

**Under consideration / 今回実装しない**：Position / Completed Tradeの正式対応アルゴリズム、FIFO税計算、cloud syncと認証、全面IndexedDB移行、API / PDF / OCR、実時間価格、高度な証拠金モデル、曖昧一致による銘柄自動補正、自動戦略・Risk分類、複雑な同期競合解決。

## 16. 移行原則

- 旧キーを即時削除しない。
- 新形式を導入する場合は旧形式読込→正規化→新形式利用を可能にする。
- 移行前のデータを退避する。
- 移行済みバージョンを記録し、二重変換を防ぐ。
- 欠落項目には安全な初期値または`unknown`を使う。
- 既存データの意味が不明な場合は変換せず、確認対象として残す。
