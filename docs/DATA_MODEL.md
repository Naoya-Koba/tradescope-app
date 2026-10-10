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

**Current**：既存の月次・履歴は固定キーまたは表示名を使用する。新しいAccount Repositoryと初期口座の純粋factoryは存在するが、設定画面、既存データのMigration、自動seed保存は未接続。

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
- **Current**：初期口座factoryは`acc_gmo_fx`、`acc_lightfx_fx`、`acc_minna_fx`、`acc_sbi_sec`、`acc_sbivc_crypto`、`acc_smbc_bank`の固定IDを返す。表示名変更で変えない。旧キーは`legacyRefs`へ保持し、自動変換しない。追加IDの技術基盤にはブラウザ標準`crypto.randomUUID()`を用意する。
- **Under consideration**：追加口座UI、provider変更の運用規則、具体的なMigration。

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
- **Decided**：SBI由来のコードなし投資信託に限り、provider・商品区分・CSV上の正式名からidentityを照合する。比較時だけJavaScriptの通常のUnicode whitespace（`\s`：半角／全角スペース、連続空白等）を除いて完全一致とする。displayName・symbol・rawFieldsの原表記は変更しない。空白以外の文字差、部分一致、類似名、fuzzy match、NFKC等の広いUnicode正規化では同一視せず、ゼロ幅文字を無制限に除去しない。Stock・コードあり照合・SBI以外へこのルールを適用しない。複数の既存IDが一致した場合は曖昧として停止し、自動統合・削除しない。特定／NISA等の預り区分はHolding属性であり、Instrument identityへ含めない。
- **Decided**：原資料が確定しないETF／個別株等の細分類を推測しない。上位分類が確定できれば、細分類が不明でも候補生成を妨げない。
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

**Decided**：観測事実と月次への採用・明示確定を分離し、後者は独立した`MonthlyAccountState`に保持する。合成値を保存する`MonthlyAccountSnapshot`は新設しない。月次確定は観測日を変更せず、近似Snapshotを正式月末値へ昇格させない。

### SBI manualと月次正本

**Decided**：外国株は既存AccountSnapshotの別recordとする。`sourceMode: manual`、`sourceScope: sbi-foreign-securities`、`accountId`、`targetMonth`、`snapshotAsOf`、`importedAt`、`valuationCurrency: JPY`、`assetValue`、`unrealizedPnl`を用いる。stable `id`を持ち、`importBatchId`、`netAssetValue`、`cashBalance`、`reportedMonthlyRealizedPnl`は混ぜない。銘柄別Instrument／HoldingSnapshotは現時点では作らず、ユーザーが確認した円換算値を保存する。為替レートや外貨金額から推測・再計算しない。

**Decided**：現金は別のmanual AccountSnapshotとし、`sourceScope: sbi-cash`、stable `id`、`accountId`、`targetMonth`、`snapshotAsOf`、`importedAt`、`valuationCurrency: JPY`、`cashBalance`を用いる。`netAssetValue`を現金残高に流用しない。対象月はInputの選択を引き継ぎ、観測日不明は`null`のまま保持する。

**Decided**：空欄・未入力を0にしない。外国株なしを確認した場合は`assetValue: "0"`、`unrealizedPnl: "0"`、現金0円は`cashBalance: "0"`として明示保存できる。manual記録は国内CSVの再取込から独立して保護する。

**Decided**：`MonthlyAccountState`は、口座・月の明示確定、採用した国内保有Batch、外国株／現金manual記録、月次台帳入力を保持する再生成不能な正本とする。保存キーは`tradeScopeMonthlyAccountStatesV1`、envelopeは`{schemaVersion: 1, records: [...], updatedAt}`。

```text
MonthlyAccountState {
  id
  accountId
  targetMonth
  confirmedAt
  domesticImportBatchId
  foreignAccountSnapshotId
  cashAccountSnapshotId
  realizedPnl
  swapPnl
  deposit
  withdrawal
}
```

**Decided**：上記11fieldは必須。`id`、`accountId`、`targetMonth`、タイムゾーン付き`confirmedAt`はnull不可。参照3fieldはIDまたは`null`（未採用）、金額4fieldはdecimal文字列または`null`（不明）とする。`"0"`は明示0であり、nullを0で補わない。recordの`schemaVersion`は既存モデル同様に省略可、存在時は`1`のみ。合計評価額・合計評価損益、`sourceAvailability`、`sourceFingerprint`、draft statusは追加しない。record存在は明示確定の記録であり、各値が既知・全取得元が揃ったことまでは意味しない。

**Decided**：同一`accountId + targetMonth`に複数recordを許さない。初回IDは既存`newId`で生成し、将来同じ口座・月を修正するときは同じIDを維持する。口座参照を検証し、非nullの採用先は口座・対象月を一致させる。外国株／現金参照は対応するmanual scopeかつJPYであることを要求する。国内BatchはSBIのCSVで、同じBatchに属する`sourceScope: sbi-domestic-holdings`の保有record集合が存在することを根拠とする。約定Batchや名称だけで国内保有と推測しない。

**Decided**：同じ月の全保有Batchを加算せず、`domesticImportBatchId`の集合だけを採用する。latest importedAtを自動採用しない。Input編集中Draftはメモリ上で分離し、明示保存成功時だけ正本を更新する。CSV保存だけでは月次確定にしない。2026年1〜8月を自動migrationせず、新方式とlegacyの同じ範囲を二重加算しない。

**Current**：MonthlyAccountStateのRepository・schema・参照検証は実装済み。必須11field、null可否、同一口座・月の一意性を検証し、Repository更新では同じ口座・月のID維持とIDの付け替え防止も確認する。この仕様を使用するInput UI・manual保存・月次計算への接続は未実装。2026年9月を今回確定しない。

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

**Current**：SBI国内CSVの`import.html`はallowlist項目、行番号、検証結果、原資料の合計をメモリ内のPreview Rowとして扱う。`import/model-preview.js`は新Storageを読み取り専用で参照する。表示・解析・保存可否判定ではseedも保存もしない。明示確認後の保存だけを既存`import/sbi-save.js`へ接続する。保有情報の存在を月次入力済み判定へ渡さず、既存`tradingData`やTop Snapshotを変更しない。完全バックアップのschemaは変更しない。

### 保存予定への変換Preview

**Current**：SBI証券のstable ID `acc_sbi_sec`を参照し、既存Accountの有無と将来作成が必要かを内部判定する。保有CSVと約定CSVには別のImportBatch候補を生成する。ファイル情報はブラウザ標準SHA-256とbyte sizeのみで、原文・ファイル名・絶対パス・個人識別項目はコピーしない。Parserの一箇所に定義した`version`（現在`sbi-domestic-v1`）を解析結果の`parserVersion`、Batchの既存フィールド`importerVersion`へ引き継ぎ、別versionによる再解析を追跡できる。

**Current**：銘柄コードの一意な一致を優先し、商品区分と矛盾せず有効な既存Instrumentを再利用候補にする。SBIコードなし投信はprovider・投資信託区分・正式名の空白差だけを除いた完全一致で共有し、特定／NISA間、両CSV間、次月の候補で同一Instrumentを再利用できる。比較用の空白除去は一箇所に定義し、候補生成・既存照合・曖昧判定と保存直前の再照合で同じresolverを使う。名称・rawFieldsの原表記、transaction fingerprintの構成は変更しない。現行Instrumentにはprovider属性がないため、既存のSBI Account / ImportBatchに関連するHoldingSnapshot / RawTransactionの`rawFields.product`または確認済み取引区分mappingと、`rawFields.name`を出所の根拠とする。任意のdisplayNameやaliasだけでは再利用しない。SBI由来を確認できない同名マスターは要確認、正規化後の複数IDへの一致や無効銘柄は未解決とする。既存重複のmigration・自動統合・削除は行わない。

**Current**：CSVの株式区分を現行schemaの上位`Stock`として扱い、細分類は候補側の`subtype: null`で保持する。明示的なETF区分だけでETFを確定し、名称・コード体系から分類しない。SBIの取引区分が`投信金額買付`と完全一致する場合のみ、CSVが明示した事実として`投資信託`へ分類する。一箇所のmappingを用い、原文の取引区分を保持する。この場合、コードなし投信の候補生成・再利用に現在の保有CSVとの一致は必要ない。それ以外の商品区分がない約定行は一意なコード照合、またはSBI投信の正式名identityとの一致を根拠にする。後者は参照した商品区分の確認を促すWarningとし、部分一致・類似名やコード・市場空欄だけで投信と判定しない。

**Current**：現行StorageのHoldingSnapshotは銘柄ごとのflat recordである。一取得元・一観測とはこのrecord集合の責務であり、銘柄数だけ別観測があるという意味ではない。同じCSVの全recordは同じ`importBatchId`、`accountId`、`targetMonth`、`snapshotAsOf`、`sourceScope`を共有する。`sourceType: csv`は共通ImportBatchを参照して取得し、一時グループにも明示する。recordには既存の`sourceMode: imported`を保持し、新しい永続フィールドや集約schemaは追加しない。CSVの取得範囲以外の現金・外国株等は補完せず、SBI口座全体の状態やAccountSnapshotを生成しない。投信の数量単位は保持し、価格当たり口数は推測換算しない。

**Current**：約定行はRawTransaction候補へ変換する。受渡日、取引、預り、市場、税額、`settlementOrPnl`等は金融事実のallowlistに限って`rawFields`へ保持する。混在列を`realizedPnl`へ変換しない。数値はdecimal文字列、空欄は`null`で、売買方向・通貨等を推測しない。`targetMonth`と`snapshotAsOf`を分離し、近似値を正式月末値へ昇格しない。

**Current**：取引事実の型検証とInstrument解決を分離する。Instrument未解決でも`transactionCandidates`内の`facts`を保持し、`instrumentStatus: unresolved`、`saveEligible: false`、Warning／要確認とする。未解決IDは`null`で、Storageへ書けるrecordではない。事実自体が不正な行も問題行として残し、正常な値を捏造しない。`transactions`は検証済みの保存可能候補のみで、要確認・不正行は含めない。Parser件数、取引候補件数、保存可能件数、要確認件数を別集計する。全件解決時はUIを簡潔にし、要確認時のみ保存可能／要確認件数を併記する。

**Current**：候補IDはメモリ内sessionに限定し、日付変更の再表示では維持する。保存時点を表す`importedAt`は候補に含めない。必須保存日時を要求する現行Storageとの型・参照検証では、メモリ内検証用の日時だけを補い、結果へコピーしない。保存可能なenvelopeではなく、将来の確定処理前のDraftである。

**Current**：同一file hash、同じ対象月・観測日の既存保有Batch、既存取引の事実fingerprint一致は重複候補として示すだけで、自動除外・統合しない。Storageが不正・未対応schemaの場合は空マスターとみなさず変換を止め、元のCSV Previewは維持する。閉じる・会社パネルを閉じる・文字コード変更・離脱時に全候補を破棄する。

**Under consideration**：未解決銘柄の照合・承認UI、国内コードの識別範囲、細分類の追加取得は未実装。現行CSVには確認済みexternal transaction ID列がないため、取引ID照合は推測せず、既存の事実fingerprintで候補を比較する。商品区分のない約定CSVに、照合できないコードなし銘柄がある場合の分類確認フローも未実装である。

### SBI保存エンジンと確認後保存UI

**Decided**：1ファイル＝1 ImportBatch＝1保存トランザクション。保有CSVは必要なAccount・Instrument・Batch・HoldingSnapshot群、約定CSVは必要なAccount・Instrument・Batch・RawTransaction群を一括検証して保存する。一部行だけの保存、置換、訂正、取消は今回実装しない。

**Current**：`import/sbi-save.js`は明示注入したAdapterを使う独立serviceで、取込画面だけが接続する。`inspect`は`save`と同じ非破壊の検証・照合を使用し、保存可否と保存済み・競合を返す。1ファイルのParser結果とmetadataを受け、最新Repositoryの読み取り結果で既存の`model-preview.js`による照合を再実行する。古いPreview planをそのまま保存しない。実保存直前に`importedAt`を生成し、Batchと全recordで共有する。対象月・観測日は保持し、近似値を正式月末へ昇格しない。

**Decided / Current**：`acc_sbi_sec`が存在しない場合のみ保存トランザクション内でcanonical Accountを追加する。存在時はdisplayName・legacyRefs等の編集内容を上書きせず再利用し、provider・種別の矛盾または無効口座では停止する。InstrumentはPreviewと同じコード完全一致／SBI投信正式名identityを使い、一意一致だけを再利用する。既存recordやenvelopeは更新せず、ユーザー情報を置換しない。曖昧一致、出所不明、無効銘柄、Parser／変換警告、未解決・不正行があるファイルは保存しない。

**Decided / Current**：同じAccount・SBI CSV取得元のfile hash一致は`already-imported`として追加せず全キーを維持する。同Account・CSV・対象月・観測日の既存保有観測に別hashがある場合は`conflict`、既存取引のfingerprint候補一致は`review-required`でファイル全体を停止する。自動統合・削除・上書き・部分保存はしない。file hashは取引同一性の根拠とはしない。

**Current**：Repositoryの全schema／参照検証、既存journal、複数キーwrite、生文字列検証とrollbackを使用する。非同期照合中に新モデルが変わった場合はcommit前の比較で停止する。journal削除前にRepositoryから全モデルを再読込し、schema・参照と期待内容の一致を確認する。容量不足／journal確保失敗では正本書き込みを始めず、途中失敗は以前の生文字列・キー不在状態へ戻す。rollback不能時はjournalを保持して後続保存を停止する。複数タブの完全排他やWeb Storage以上のatomic性は保証しない。

**Decided / Current**：新モデル保存から旧月次・旧履歴・Summary Snapshot・月次入力判定へ反映しない。AccountSnapshotも生成しない。allowlistのcanonical dataだけを保存し、原CSV・ファイル名・パス・非allowlist PIIはコピーしない。CSVごとに確認後保存し、成功の検証完了後に操作ボタンを消して「保存済み」を表示する。再選択・再読込後もStorageを参照して判定する。競合・重複候補に上書き・強制・部分保存経路を設けない。

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

### 実装済みStorage基盤（Previewは読み取りのみ）

**Current**：`assets/data-model-storage.js`のRepositoryはAdapterを注入して使用する。実装済みcollectionとキーは次の7つ。

| collection | 保存キー | 責務 |
|---|---|---|
| `accounts` | `tradeScopeAccountsV1` | stable ID、口座、provider、有効状態 |
| `instruments` | `tradeScopeInstrumentsV1` | 商品識別。銘柄候補リストとは別物 |
| `importBatches` | `tradeScopeImportBatchesV1` | 取込単位、最小出所metadata |
| `rawTransactions` | `tradeScopeRawTransactionsV1` | 取引事実。戦略・Risk・ユーザーMemoは受理しない |
| `holdingSnapshots` | `tradeScopeHoldingSnapshotsV1` | 一取得元・一観測の保有状態 |
| `accountSnapshots` | `tradeScopeAccountSnapshotsV1` | 一取得元・一観測が報告する口座状態／取得範囲 |
| `monthlyAccountStates` | `tradeScopeMonthlyAccountStatesV1` | 口座・月の明示確定、採用先参照、月次台帳入力。合計値は保存しない |

**Current**：キーが存在する場合は`{schemaVersion: 1, records: [...], updatedAt: ISO日時}`。キー不在は読み込み・バックアップ上`null`で表し、空envelope、架空の更新日時、Account seedを自動保存しない。recordの`schemaVersion`は省略可、存在時は`1`のみ。すべてのrecordにstable `id`を要求する。

**Current**：`read` / `list`は非破壊。`commit`は複数envelopeを全検証後に保存し、`save`と同一IDへの`upsert`も同じ入口を使う。既存Account IDを落とす更新は拒否し、無効化を優先する。Migration、別IDへの暗黙統合はしない。Account / Instrument / Batch / 関連Snapshotの参照、重複IDを検証する。imported Snapshotは一つのBatchへ関連付け、口座・保存時点・観測時点・対象月を照合する。同じAccountSnapshotに属するHoldingの取得範囲・出所も一致させ、複数ソースを合成保存しない。

**Current**：数値はdecimal文字列または`null`／欠落で、浮動小数Numberを拒否する。日付のみ、タイムゾーン不明、`snapshotAsOf: null`はその精度のまま保持する。混在列は`rawFields.settlementOrPnl`として保持できるが、実現損益に変換しない。`accountSpecific`は現段階でFXの`requiredMargin` / `maintenanceRate`、証券の`buyingPower` / `depositBalance`のみを受理する。

**Current**：ImportBatchは`id`、`accountId`、`sourceType`、`sourceProvider`、`importedAt`を必須とする。任意の`targetMonth`、`snapshotAsOf`、`importerId` / `importerVersion`、`sourceFileMetadata: {hash, size}`のみを追加できる。原本、ファイル名、絶対パス、個人識別情報、全行原文は受理しない。架空のparser versionも補完しない。

**Current**：未知field、非allowlistの`rawFields`、不正日付・型・schema version・prototype制御キーは拒否し、黙って捨てない。`sourceLocator`も絶対パス・URLを受理しない。rawFieldsの許可項目は保有・約定Parserの金融事実列に限定する。ただし銘柄名等の許可文字列に個人情報が混入していないかを自動判定する機能ではなく、将来Importerでも抽出元確認が必要。

**Current**：Accountと外部取引IDの重複、同一Batch・行番号の再登録は拒否し、既存行を削除・統合しない。IDなしでは`dedupeCandidate`がブラウザ標準SHA-256でversion付き候補を作るだけ。正当な同一事実の複数約定は別ID・別行で維持できる。file hashを取引ID代わりにしない。

**Under consideration**：fingerprintの最終構成、decimal表記差、日時精度、訂正・取消、locatorだけの重複解決、手入力競合は未確定。現在の候補は口座・商品・日時・売買・取引種別・数量・単位・価格・通貨を比較する技術基盤に限定する。月末性の正式名称・根拠確認フローも未確定で、候補属性`observationType`（`officialMonthEnd` / `approximateForMonth` / `pointInTime`）は指定時のみ保存し、自動付与・昇格しない。

**Current**：Instrument照合は保存予定Previewと確認後保存エンジンで共有する。AccountInstrumentSetting、TransactionAnnotation、Risk設定のRepository／UIは未実装。新モデルは既存の月次・履歴・Summary計算へ接続しない。

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
