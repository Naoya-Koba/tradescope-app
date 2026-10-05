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
- Holding Snapshots
- Account Snapshots

**Decided**：`HoldingSnapshot`と`AccountSnapshot`は、外部資料または手入力から得た「ある時点の観測事実」を保持する元データである。表示高速化用のSnapshotやキャッシュとは別物であり、名称が同じSnapshotでも削除可能な派生キャッシュとして扱わない。

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
- **Planned**：Accountを起点に、資産評価額または純資産、評価損益、月間確定損益、保有銘柄・FX建玉・暗号資産、現金残高、必要証拠金等の口座固有情報、データ取得時点を閲覧できるようにする。
- **Decided**：FX、証券、暗号資産を一つの固定項目集合へ無理に押し込まない。Account共通項目と、資産クラス・口座種別固有項目を分離する。
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

## 7. 時点別の保有・口座状態

**Decided**：取引と時点状態の責務を次のように分ける。

- `RawTransaction`：売買、新規、決済、入出金等の取引事実
- `HoldingSnapshot`：ある観測時点の銘柄・建玉・暗号資産等の保有状態
- `AccountSnapshot`：ある観測時点の口座全体の状態
- Position / Completed Trade / 集計値：上記元データから生成する派生データ

### HoldingSnapshot

**Planned**：保有証券一覧、FX建玉、暗号資産残高等を、時点付きの保有状態として保存できるようにする。

候補フィールド：

```text
HoldingSnapshot {
  schemaVersion
  id
  accountSnapshotId
  accountId
  instrumentId
  targetMonth
  snapshotAsOf
  importedAt
  sourceMode          // imported | manual
  sourceScope         // 国内保有、外国株、円現金等の取得範囲
  importBatchId
  quantity
  acquisitionPrice
  marketPrice
  marketValue
  unrealizedPnl
  currency
  rawFields
}
```

**Decided**：原資料に存在しない取得単価、現在価格、評価額、評価損益等を推測してHoldingSnapshotへ埋めない。取得できない値は欠落または`null`として扱い、実際の`0`と区別する。

**Decided**：一つのHoldingSnapshot集合は、原則として一つの取得元・一つの観測に基づく。SBI国内保有CSV、SBI外国株の手入力、円現金の手入力等を一つの観測Snapshotへ合成しない。

### AccountSnapshot

**Planned**：口座全体の状態を、観測時点と出所を伴う元データとして保存できるようにする。

候補フィールド：

```text
AccountSnapshot {
  schemaVersion
  id
  accountId
  targetMonth
  snapshotAsOf
  importedAt
  sourceMode          // imported | manual
  sourceScope         // PDF口座全体、国内保有、現金等の取得範囲
  importBatchId
  valuationCurrency
  assetValue
  netAssetValue
  cashBalance
  unrealizedPnl
  reportedMonthlyRealizedPnl
  accountSpecific    // FX・証券・暗号資産等の型別allowlist項目
}
```

- **Decided**：一つのAccountSnapshotは、原則として一つの取得元・一つの観測に基づく事実だけを保持する。取得元が口座全体を報告していない場合、そのSnapshotを口座全体の完全な状態とは扱わない。
- **Decided**：共通項目には口座識別、対象月、観測時点、保存時点、出所、取得範囲、通貨、原資料が報告する口座合計等だけを置く。
- **Decided**：必要証拠金、証拠金維持率、買付余力、預り金等は全Accountへ同じ意味で強制せず、口座種別ごとの明示的なallowlist項目として扱う。
- **Decided**：原資料が報告する口座合計と、HoldingSnapshotから算出した合計を同じ正本値として混在させない。算出値は派生結果として出所を区別する。
- **Decided**：SBI国内保有、SBI外国株、円現金・外貨現金等、複数取得元を合算した「SBI証券口座全体」等は、観測Snapshotとして保存せず、原則として派生計算または表示用Viewとして生成する。
- **Decided**：自動取込値には`importBatchId`等、手入力値には手入力記録の識別子等を関連付ける。MVPでは一つのSnapshotへ複数取得元を混在させないことで、値単位provenanceを必須にしない。
- **Under consideration**：将来、一つのSnapshot内へ複数取得元の値を混在させる要件が生じた場合は、値単位provenanceと競合解決履歴を必須にする可能性がある。

### 対象月と観測時点

**Decided**：`targetMonth`、`snapshotAsOf`、`importedAt`を別概念として扱う。

- `targetMonth`：損益管理上どの月へ表示・関連付けるか
- `snapshotAsOf`：原資料が表す実際の観測日時または基準日時
- `importedAt`：TradeScopeへ保存した日時

**Decided**：`snapshotAsOf`は推測で確定せず、次の優先順位で決める。

1. ファイル内に正式な基準日・基準日時がある場合は、その値を使用する。
2. ファイル内に日時がない場合は、Import Previewでユーザーが確認または指定する。
3. `File.lastModified`等は初期候補に利用してよいが、正確な観測日時として黙って確定しない。

**Decided**：日時が不明な場合は、架空の時刻やタイムゾーンを生成しない。日付だけが確認できる場合は日付精度のまま保持する。`importedAt`は観測日時の代用にせず、TradeScopeへ実際に保存した日時として記録する。

SBI証券の保有証券CSVを2026年10月4日に取得し、2026年9月分として扱う例：

```text
targetMonth = 2026-09
snapshotAsOf = 2026-10-04
importedAt = TradeScopeへ実際に保存した日時
```

**Decided**：保有証券CSVの値を、対象月が9月であることだけを理由に9月30日の月末確定値とは扱わない。月末との乖離が大きい場合は取込前に警告し、観測日を保持したままユーザー確認後の取込を許可する。

**Decided**：「対象月への採用」「実際の観測日時」「正式月末値か近似値か」を内部的に別概念として保持する。月末PDFに正式な基準日が明記されたSnapshotと、月初取得CSVを前月分へ採用した近似Snapshotを、同じ精度・同じ意味のデータとして扱わない。

**Planned**：月末性を示す内部属性は、`officialMonthEnd`、`approximateForMonth`、`pointInTime`等を候補とする。最終名称と判定条件はImporter設計時に決定する。

**Under consideration**：警告を出す日数閾値、休日・非営業日の扱い、対象月の初期提案方法。

**Planned**：`MonthlyAccountSnapshot`は、まず`AccountSnapshot`に`targetMonth`と月次確定・確認状態を付けた月次版またはviewとして扱い、独立した永続エンティティを増やさない方向を優先する。近似Snapshotを正式月末値へ無条件に昇格させない。

**Under consideration**：月末確定・ユーザー確認済み等の状態名と、実データ要件によって`MonthlyAccountSnapshot`を別概念として公開する必要があるか。

## 8. インポート処理の境界

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

### 取得元の初期対応方針

| Account / 資産 | Planned取得元 | 備考 |
|---|---|---|
| GMO FX | 月次PDF | Parser仕様は実ファイルと公式仕様を確認して決定 |
| LIGHT FX | 月次PDF | 同上 |
| みんなのFX | 月次PDF | 同上 |
| SBI証券 国内株・投資信託 | 約定履歴CSV、保有証券一覧CSV | 取引事実と時点保有を別モデルへ保存 |
| SBI証券 外国株 | 当面手入力 | 将来Importerを追加可能にする |
| SBI VCトレード | 月次PDF | Parser仕様は実ファイル確認後に決定 |
| 入出金・資料にない不足値 | 手入力を維持 | 推測補完しない |

**Decided**：手入力機能を削除しない。自動取込値と手入力値は出所を保持し、算出値は派生データとして区別する。

**Decided**：同一Account・Instrument・対象期間・データ責務について、Import値と手入力値を黙って加算しない。重複または競合の可能性をPreviewで示し、ユーザー確認前に正本へ反映しない。

**Under consideration**：Import値と手入力値の上書き優先順位、部分的な手入力補正、競合解決、採用後の履歴保持方式。

## 9. RawTransaction

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

## 10. TransactionAnnotationとその他ユーザーメタデータ

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

## 11. Duplicate protection

**Decided**：同一ファイルや同一取引を再度取り込んでも、確定済みRawTransactionを無条件に重複作成しない。

重複判定は次の二段階を基本とする。

1. 業者が安定した`externalTransactionId`を提供する場合は、AccountとそのIDを第一識別子とする。
2. IDがない場合は、原資料に存在する口座、日時、銘柄、売買、数量、価格等からversion付きrow fingerprintを生成する。

- **Decided**：source file hashだけを取引重複判定には使用しない。同一取引が別ファイルへ再収録される場合があるためである。
- **Decided**：完全一致に見える正当な複数約定を自動削除しない。曖昧な一致は「重複候補」としてユーザー確認へ回す。
- **Under consideration**：最初の実CSVを確認するまで、fingerprintの最終構成フィールド、時刻精度、取引IDの安定性、訂正・取消取引の扱いは確定しない。

## 12. PositionとCompleted Trade

- **Decided**：Positionは取引列から再構築可能な派生データとする。
- **Decided**：Completed Tradeも原則として取引と対応付けルールから生成する派生データとする。
- **Current**：同方向追加は加重平均、反対売買は数量減算、反転時は新規側レートへ平均を切り替える。
- **Under consideration**：FIFO、総平均、口座別約定単位、手数料、税、部分決済の正式対応ルール。

## 13. 現行データとの並行運用と移行

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

## 14. 保存境界とlocalStorageキー案

**Decided**：画面や計算処理が`localStorage`キーを直接前提にしないよう、Repository / Storage Adapterを介して読み書きする。これにより将来のIndexedDBまたはcloud syncへの移行余地を保つ。

**Planned**：新モデルをlocalStorageへ保存する段階では、次のキーを候補とする。

- `tradeScopeAccountsV1`
- `tradeScopeInstrumentsV1`
- `tradeScopeAccountInstrumentSettingsV1`
- `tradeScopeRawTransactionsV1`
- `tradeScopeHoldingSnapshotsV1`
- `tradeScopeAccountSnapshotsV1`
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

**Known issue**：RawTransactionおよび時点別Snapshotの件数増加によりlocalStorage容量上限へ達する可能性がある。

**Under consideration**：CSV MVPで直ちに全面IndexedDB化はしないが、実データ量を確認しながら保存先移行の時期を決める。Repository境界とstable IDを先に導入し、移行を妨げない。

## 15. Riskとの分離

**Decided**：Risk設定はInstrumentおよびAccountInstrumentSettingと分離する。Instrumentの存在やlot sizeだけを理由にRisk対象へしない。

**Planned**：Risk対象ON/OFF、耐性基準価格、個別ポジション上書き等は、`RISK_SPEC.md`に従う独立モデルとして管理する。

## 16. 実装範囲と順序

**Planned**：既存データの破壊と二重計上を防ぐため、次の順序を基本とする。

1. 正本文書更新
2. 共通Parser / Validation / Preview基盤
3. SBI証券国内CSV Parser
4. Account、Instrument、RawTransaction、HoldingSnapshot、AccountSnapshot等の新モデルStorage
5. 新モデルを含む完全バックアップ / Restore対応
6. 新モデルへの永続保存解禁
7. SBI証券国内の対象月データ取込
8. Accountを中心とした口座情報表示
9. FX月次PDF Importer
10. SBI VCトレード月次PDF Importer

**Decided**：ParserとPreviewは永続保存なしで先行実装してよいが、新モデルを実ユーザーデータとして永続保存する前に完全バックアップと復元を対応させる。

**Planned**：Account seed、canonical Instrument resolver、AccountInstrumentSetting、Repository / Storage Adapter、duplicate detection、TransactionAnnotation等は、上記各段階で必要になる最小範囲を実装する。

**Under consideration / 今回実装しない**：Position / Completed Tradeの正式対応アルゴリズム、FIFO税計算、cloud syncと認証、全面IndexedDB移行、API / PDF / OCR、実時間価格、高度な証拠金モデル、曖昧一致による銘柄自動補正、自動戦略・Risk分類、複雑な同期競合解決。

## 17. 移行原則

- 旧キーを即時削除しない。
- 新形式を導入する場合は旧形式読込→正規化→新形式利用を可能にする。
- 移行前のデータを退避する。
- 移行済みバージョンを記録し、二重変換を防ぐ。
- 欠落項目には安全な初期値または`unknown`を使う。
- 既存データの意味が不明な場合は変換せず、確認対象として残す。
