# Backup and Restore Specification

## Current — SBI残高UI／hookと固定Backup v14（v306）

Backup v14維持。国内Batch参照2metric、外国／cash Snapshot参照、独立manual scalar原値、採用／同revision補正／比較／defer／訂正は既存monthlySources v1受理範囲内。新field・component enum・record・Storage keyなし。原CSV本文・PII・金融原値の参照先複製を追加しない。

CSV canonical＋candidate、manual作成＋明示採用はそれぞれ一回のRepository journal。容量不足・参照／fingerprint不正・再読込失敗はrollback、rollback不能ならjournal保持。v14完全往復とv13以前のRestore／clear・preserve規則を維持し、旧Backupに新契約がなくてもcompatibilityで読む。匿名Memoryのみで検証し、実Backup／production Restoreは使用しない。

## Current — 採用UIと固定Backup v14（v305）

採用UIは既存monthlySourcesのsource参照・adoption・override・comparison・deferだけを保存する。新field／record／Storage key／version追加なし。旧互換sourceの確認採用も明示操作のみで、読込時migrationしない。source切替、比較記録、保留、同revision補正は既存journal／rollback／再読込保護とv14完全Backupで保持する。v13以前のRestore契約は不変。実Backup／production Restoreは検証に使わない。


## Current — SBI VC残高接続と固定v14契約（v304）

Backupはv14を維持する。新record／field／Storage key／validator受理範囲の拡張なし。SBI VC PDF保存時の原Batch／Snapshot／Holding、参照source候補、明示採用・revision補正は既存11モデル内で保護する。正式な空holding setはBatch＋AccountSnapshot scope参照で復元し、JPY明示0とnullを区別する。原金融値を新sourceへ複製しない。

候補・canonical・補正の書込みは一回のRepository journalで検証・再読込・rollbackし、rollback不能時はjournalを保持する。v13以前のclear／preserve規則は本書の既存公開契約のまま。実Backup／production Restoreを使わず匿名roundtripを検証する。


## Current / Decided — Backup v14

最新exportはv14。legacy＋既存10モデル＋monthlySourcesの11モデルを完全置換する。新envelope／record、原source参照、adoption・override・comparison・履歴chain、recordCount／SHA-256、active採用のsource fingerprintを検証する。新model key欠落、参照revision不存在、未知field／version、履歴欠落、stale active採用を拒否し、値を切捨てて旧version化しない。null modelはキー不在、null金融値はunknown、明示0は0で往復。

| 形式 | monthlySourcesのRestore |
|---|---|
| v1／Legacy部分復元 | 維持（既存canonical参照も維持） |
| v2〜v13 | 各公開済み置換／clear意味を維持し、新キーを同一journalでclear。復元前に明示 |
| v14 | 11モデルとsource／採用／補正／比較履歴を置換。nullならキー不在 |

旧Backupに新契約がなくても従来結果へ戻り、不存在を0・confirmedにしない。旧形式の新key clearはSnapshot置換後に参照切れ採用を残さないため。v1〜v13の受理範囲は固定。tradeInfo保護、事前検証、journal、全正本再読込検証、rollback、不能時journal保持、派生cache無効化を維持。本文・raw PDF／CSV・PII・filenameを追加しない。匿名Storageでv14往復／旧互換／quota／検証失敗を確認し、本番Storage・実Backupは操作しない。

## Decided — 公開済みBackup v13

公開済みv13は、既存9モデルの公開済みrecord契約を変えず、transactionReconciliationsを加えた10モデルを保存する。envelope v1／関係record v1。v13はlegacy＋10モデルを置換、nullはキー不在。関係のunknown field／version／取引全集合／口座・銘柄・事実一致／参照／重複を事前検証し、原manual・原sourceとともに復元する。manualが明示編集／削除済みなら古い関係は保持するが表示置換に適用しない。

v1／Legacyは新10モデルを維持。v2〜v12は公開済み置換・clear意味を維持し、新関係キーを同じRestore journal内でclearする。旧Backupに新関係を付け足したり、新fieldを削って旧version exportしない。tradeInfo保護、書込前validation、全正本再読込検証、rollback／不能時journal保持、derived cache無効化は維持する。PDF／CSV本文・原本・PIIを新関係へ保存しない。

## Decided — 公開済みBackup v12契約

公開済みv12は既存9キー・9モデル・envelope v1を維持し、ImportedTransaction record v2を正式追加する。GMO record v1、観測採用Input v3／補正v4を含む旧全recordも受理する。v1〜v11の公開済み検証範囲は固定し、v11以下へv2取引をexportせず、新fieldの切捨ても行わない。v12 Restoreはlegacy＋9モデルを置換、null collectionはキー不在へ戻す。

SBI VCの必要Instrument・Batch・資産Snapshot／Holding・採用Input・現物買い取引を同一journalで保護する。訂正前後の全source／取引、signed fee、decimal精度、nullを保持する。旧Backupの置換／clear意味、tradeInfo保護、書込前Validation、再読込一致検証、rollback／不能時journal保持、派生cache無効化は不変。PDF原本・抽出全文・PII・filenameを追加しない。

## Decided — 公開済みBackup v11契約

公開済みv11は9モデル／既存キー／envelope v1を維持し、MonthlyAccountInput record v4の観測補正・reset／訂正履歴を正式に受理する。v1〜v10の公開済み検証範囲は固定し、v10はv3まで、新v4を拒否する。新fieldを削って旧version exportしない。v11は旧全recordを受理するがImportedTransaction v2は拒否する。

v11 Restoreはlegacy＋9モデルを明示置換し、null collectionはキー不在に戻す。v1／Legacyは従来対象のみで新モデルを維持、v2〜v10の置換・未収録key clear規則は不変。原本Snapshot／Holding・active override・旧source参照と補正履歴を一緒に保護する。形式／version／型／unknown field／同一source参照を事前検証し、共通journal／再読込検証／rollback／不能時journal保持／tradeInfo保護／derived cache無効化を維持する。自動Migrationなし、PDF原本・本文・PIIは含めない。

## Decided — 公開済みBackup v10契約

公開済みv10は9モデル／既存キー／envelope v1は維持し、MonthlyAccountInput record v3（資産観測の明示採用参照・訂正履歴）を正式追加する。v9以下は公開済み旧record範囲に固定して新Inputを拒否する。新fieldを削って旧version exportしない。v10は旧全recordも受理し、未保存null collection・明示0・欠損nullを保持する。

Restore：v1／Legacyは従来対象のみで新9キーを維持。v2〜v8は従来の置換／未収録key clear規則を維持。v9は旧9モデルを置換、v10は新Inputを含む9モデルを置換する。nullはキー不在。旧BackupのRestoreは明示置換であり新観測Inputを自動維持・合成しない。tradeInfo保護、事前Validation、共通journal、全キー再読込、rollback、不能時journal保持、派生cache無効化は不変。自動Migrationなし。

SBI VCのAccount・必要Instrument・Batch・AccountSnapshot・全現物Holding・Input採用参照は一回のRepository commitで保護する。訂正前sourceもBackupへ含む。PDF binary／本文／filename／絶対パス／PIIを含めない。月次損益State、報酬・cashflow・取引を生成しない。

## Decided — 公開済みBackup v9契約

**Current**：旧GMO Batchの明細0件時の明示補完もv9の既存record契約で保護する。必要なFX InstrumentとImportedTransactionsだけを同一Repository journalへ書き、全キー再読込検証後に成功、途中失敗は両方を元の生文字列／キー不在へrollbackする。Batchと月次正本は変更せず、取引`importedAt`は既存Batchの原取込日時、envelope `updatedAt`は補完日時。Backup schema／Restore semantics／versionは変更しない。

最新exportはv14。現行11モデルを保護するためv8契約を固定する。v9だけが新collectionを受理し、v1は9モデル維持、v2〜v8は各公開済み旧範囲を復元する際に未収録ImportedTransactionsを同じjournalでクリアする（事前確認へ表示）。旧Batch／Account置換後に参照切れsourceを残さないためである。v9は9モデル完全復元。legacy部分復元は新モデルを維持。null＝キー不在、tradeInfo保護、再読込検証、rollback、派生cache無効化は維持する。filename／PDF原本／全文／PIIは保存しない。

## Current — 固定Backup v8互換

旧v8はTradersのPDF-only partial source／calendar missing／明示採用参照／訂正履歴をMonthlyAccountInput record v2で保護する公開済み契約。8モデルを受理し、v7は新Inputを拒否する。null swapを0へ変換せず、partialではState不在を保つ。最新v14では明示GMO取引sourceとFX Instrumentも同一Repository journal・rollback・再読込検証で保護する。旧v1〜v8の検証範囲は拡張しない。

## Traders Storage / Backup v7

**Current / 固定v7互換**：v7はTradersのState v4／Snapshot v2／FX Holding v2までを受理する公開済み契約。v6の意味も固定する。新キーは追加せず従来8正本モデルを同一Journal・rollback・再読込検証で保護する。v1は8モデル維持、v2は6モデル置換＋State／Input clear、v3〜v5は旧7モデル置換＋Input clear、v6は旧8モデル置換、v7は上記recordも含む8モデル置換。null＝キー不存在、tradeInfo保護、派生cache無効化は不変。PDF原本・全文・PII・filenameは含めない。

## Current — GMO保存・訂正の保護

GMOのPDF ImportBatch・AccountSnapshot・MonthlyAccountState record v2／v3と明示取引sourceを最新v14で保護する。取込・訂正・Input手修正は各専用serviceから一回のRepository commitで行い、Top派生cache削除も同じjournalに含める。新規FX Instrument／ImportedTransactionsも同一操作に含む。保存前Validation・expectedModels・全キー再読込一致後だけ成功とする。失敗は旧生文字列とキー不在へrollbackし、不能時はjournal保持で次の保存を停止する。匿名保存→Export→空Storage相当→Restore→resolver／再Export一致を検証する。原本・PIIは含めない。

## 完全バックアップv6（固定された読込互換仕様）

最新Exportはv14。v6は既存7モデルと8番目のMonthlyAccountInputの原値・採用値・部分入力を保護する公開済み範囲に固定する。v5の受理範囲も公開済み7モデルとState v3までに固定する。v3は旧State field／省略またはv1、v4は旧record＋State v2に受理範囲を固定する。新fieldを旧versionとして出力・切捨てしない。

| version | Restore |
|---|---|
| v1 | 旧正本を復元、新モデル11キーを維持 |
| v2 | 旧正本＋6モデルを置換、月次状態とMonthlyAccountInputを同じjournalでclear |
| v3 | 旧正本＋7モデルを置換、公開済み旧recordのみ。MonthlyAccountInputをclear |
| v4 | 旧正本＋7モデルを置換、旧recordとState v2のみ受理。MonthlyAccountInputをclear |
| v5 | 旧正本＋7モデルを置換、旧record・State v2・State v3原値／採用値／差分を受理。MonthlyAccountInputをclear |
| v6 | 旧正本＋8モデルを置換、v5範囲＋MonthlyAccountInputを受理 |
| v7 | 旧正本＋8モデルを置換、v6範囲＋Traders State v4／AccountSnapshot v2／FX HoldingSnapshot v2を受理 |
| v8 | 旧正本＋8モデルを置換、v7範囲＋Traders MonthlyAccountInput v2（nullable swap／partial history）を受理 |
| v9 | 旧正本＋9モデルを置換、v8範囲＋ImportedTransactionsを受理 |
| v10 | 旧正本＋9モデルを置換、v9範囲＋観測採用Input v3を受理 |
| v11 | 旧正本＋9モデルを置換、v10範囲＋観測補正Input v4・補正履歴を受理 |
| v12 | 旧正本＋9モデルを置換、v11範囲＋ImportedTransaction record v2を受理 |

v2〜v8は未収録ImportedTransactionsを同一journalでクリアし、復元前に明示する。v1／Legacyはこのキーも維持する。履歴ページの部分Backupはmanual entriesだけであり、imported／SBI raw sourceは完全Backupを使用する。

null collectionはキー不在へ戻す。未収録tradeInfo保護、全検証後の共通journal、rollback、再読込一致確認、派生Snapshot無効化を維持する。v3 Restore時にGMO採用先を推測・維持しない。v4 Restoreでも収録v2をそのまま復元し、v3へ自動昇格しない。v5の途中失敗も旧キーと新7キーを同じjournalで復元する。

## 1. 目的

**Decided**：再生成できないユーザーデータを、一つの「完全バックアップ」から復元できることを正式要件とする。

バックアップはPC故障、ブラウザデータ消失、PWA再インストール、公開URL変更、端末移行、データ形式変更に備える。

## 2. 現在のバックアップ

### 損益管理バックアップ

**Current**：次だけをJSON出力する。

- `tradingData`
- `yearInitialFunds`
- `yearInitialUnrealized`

### 取引履歴バックアップ

**Current**：`tradeScopeTradeHistoryV1`相当の`entries`だけをJSON出力する。

### トップの完全バックアップ

**Current**：`backupVersion: 14`を持つ完全バックアップとして、従来v1の次のデータと新Storageの11collection（既存10＋monthlySources）を一つのJSONへ出力する。

- `tradingData`
- `yearInitialFunds`
- `yearInitialUnrealized`
- `tradeScopeTradeHistoryV1`
- `tradeScopeMemos`
- `tradeScopeSymbolListV1`
- localStorageに実在する場合のみLegacy `tradeInfo`

**Current**：新形式はAccount、Instrument、ImportBatch、RawTransaction、HoldingSnapshot、AccountSnapshot、MonthlyAccountState、MonthlyAccountInput、ImportedTransactions、TransactionReconciliations、monthlySourcesも保護する。AccountInstrumentSetting、Risk設定、TransactionAnnotation等は未実装で、空項目として新設しない。SBIの確認後保存UIは既存保存エンジンへ接続し、MonthlyAccountStateのInput接続・manual保存UIも実装済み。

**Current**：SBIの確認後保存内容は最新v14 export／restoreで保護する。AccountSnapshotやMonthlyAccountStateをCSV保存だけで生成せず、v1復元では新モデルを維持する。UI接続の検証は匿名CSVだけで行った。実CSVの本番正本保存はユーザー実施済みと確認されている。通常のCSV保存ごとにバックアップ案内を追加しない。

**Current**：v14、v13、v12、v11、v10、v9、v8、v7、v6、v5、v4、v3、v2、v1、旧統合、旧損益、旧履歴の形式判定・検証・正規化・Restore plan生成基盤がある。v6〜v8は各record受理範囲を固定した8モデル、v3〜v5は7モデル、v2は既存6モデルを完全復元し月次状態をクリアする。v2〜v5は新Inputをクリアする。v1は従来対象だけを復元して新モデルの現在値を維持する。旧形式は収録項目だけを復元するLegacy部分復元で、未収録項目を維持する。

**Current**：復元前に形式、バージョン、必須項目、型を検証し、復元内容、維持内容、警告を確認画面へ表示する。ユーザーがキャンセルした場合はlocalStorageを変更しない。

**Current**：全値をメモリ上でJSON化した後、`tradeScopeRestoreJournalV1`へ対象キーの存在有無と適用前の生文字列を保存する。`assets/storage-transaction.js`でRepositoryと復元が同じ安全処理を使う。journal保存失敗時は開始せず、途中失敗時は元の生文字列へrollbackし、元々不在のキーは削除する。成功・rollbackとも再読込一致を検証してjournalを削除する。journalはバックアップ対象外。

**Current**：復元経路は取引履歴を再正規化せず、検証済み配列を直接保存して未知フィールドを保持する。復元成功時は`tradeScopeTopSummarySnapshotV1`を無効化し、完了表示後にページを再読み込みする。

**Current**：空の損益データが正式に復元される場合は、`profitSkipDemoSeed`を`1`にして2025年ダミーデータの自動投入を抑止する。既存の明示的な「ダミーデータ再投入」機能は変更しない。

**Current**：復元中断後にジャーナルが残っている場合、新しい復元は開始しない。ユーザー確認後にジャーナルから復元前状態へ戻し、改めてファイル選択を求める。

### 旧トップ統合バックアップ

**Legacy**：旧形式は、次を`profitData`と`historyData`に分けて出力していた。

- `tradingData`
- `yearInitialFunds`
- `yearInitialUnrealized`
- 取引履歴`entries`

Memo、銘柄リスト、Legacy `tradeInfo`は含まれない。

**Current**：旧統合、旧損益、旧履歴バックアップの復元では、各ファイルに収録された項目だけを復元し、未収録のMemo、銘柄リスト、Legacy `tradeInfo`等は現在値を維持する。

**Current / Confirmed**：2026年9月23日に、現行の統合バックアップ形式で `tradescope-all-backup-2026-09-23.json` を出力済みである。

**Current / Confirmed**：このファイルにはMemo、銘柄リスト等が含まれず、本仕様で定義する「完全バックアップ」の要件を満たさない。新しいv1エクスポートとは別形式である。

**Unknown**：上記ファイルの外部媒体上の恒久的な保存場所は未確認である。

## 3. 完全バックアップ対象

**Decided**：少なくとも次を保存する。

- `tradingData`相当の月次元データ
- 年初資金
- 年初評価損益
- 取引履歴
- 将来のRaw Transactions
- 将来のHolding Snapshots、Account Snapshots
- 将来のAccount、Instrument、AccountInstrumentSetting
- 将来のImportBatch（出典追跡のため永続化する場合）
- Risk設定
- TransactionAnnotationを含む戦略、タグ、取引Memo等のユーザーメタデータ
- トップMemo
- 銘柄リスト
- Account設定
- インポート紐付け情報
- その他、再生成不能なユーザー編集設定

**Decided**：PDF / CSV原本、PDF全文、CSV全文、個人情報を含む解析前データは永続保存しないため、完全バックアップ対象にも含めない。バックアップする`rawFields`はImporterで選別済みのallowlist項目に限定する。

Legacy `tradeInfo`の扱い：

- **Current / Confirmed**：現在ユーザーは利用しておらず、将来の正式機能として維持する予定もない。
- **Unknown**：localStorageに過去データが残存しているかは未確認である。
- **Decided**：残存している場合は、明示的な移行・削除判断を行うまで一時的な保護対象とし、その期間のバックアップから欠落させない。
- **Decided**：この一時保護を恒久要件とはせず、移行または削除の判断後にバックアップ対象を見直す。

**Decided**：次は原則保存不要とする。

- Newsキャッシュ
- 翻訳キャッシュ
- Service Workerキャッシュ
- 再計算可能なSummary
- Asset Trendスナップショット
- Position、Completed Trades、Risk集計等の派生データ
- 一時的な表示状態

UI状態を利便性のため含める場合は、ユーザーデータと分離し、復元失敗が本体データへ影響しないようにする。

## 4. バックアップ形式

**Decided**：`backupVersion`を必須とする。

互換対応を継続するv1形式の概念例：

```json
{
  "product": "TradeScope",
  "backupVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "source": {
    "origin": "optional"
  },
  "data": {
    "monthly": {},
    "initialFunds": {},
    "initialUnrealized": {},
    "transactions": [],
    "memos": [],
    "symbols": [],
    "legacy": {}
  }
}
```

**Current**：上記v1は従来の保存対象を表し、新モデルを含まない。v1読込は継続するが、新しいトップexportはv5を使用する。

**Decided**：新データモデルへ実ユーザーデータを永続保存できるようにする前に、それらの完全バックアップ、検証、復元、journal、rollbackを実装・検証する。ParserとPreviewは永続保存なしで先行してよい。

### 実装済みv2拡張

**Current**：既存`backupVersion: 2`はv1の`data`へ`models`を追加した6モデル形式。`accounts`、`instruments`、`importBatches`、`rawTransactions`、`holdingSnapshots`、`accountSnapshots`をすべて必須とする。各値はschemaVersion 1のenvelope、または「保存キー不在」を表す`null`。読込互換を維持し、最新exportはv10とする。

**Current**：v2復元は6モデルのenvelopeをそのまま保存し、`null`のcollectionはキー不在へ戻す完全復元。MonthlyAccountStateも同一transactionでクリアする。v1・旧形式では新モデルキーに触れない。Legacy `tradeInfo`はv2でも未収録なら維持する。

**Current**：v2のroot、metadata、modelsの未知項目、新モデルの型・version・decimal・重複ID・参照を全検証し、`__proto__`等も拒否してからjournalを保存する。従来履歴の未知フィールドは安全なJSONとして維持し、再正規化しない。

**Current / Decided**：ダウンロード名は端末のローカル時刻で`TradeScope_YYYYMMDD_HHmm_Backup.json`とする。年4桁、月・日・24時間表記の時・分は2桁ゼロ埋めし、versionや独自連番は付けない。同名ファイルの扱いはOS／ブラウザに任せる。JSON内の`exportedAt`は従来のISO-8601仕様を維持する。復元判定はファイル名ではなくJSON内容によるため、旧名や`(1)`等の付いた名前も受理できる。Blob + downloadとFile input / FileReader、Snapshot無効化、空データdemo抑止、完了後の再読み込みは変更しない。

**Known issue**：journal分の容量も確保できなければ、正本へ書き込まず失敗する。保存権限やディスク障害等でrollback自体も失敗した場合はエラーを返してjournalを保護し、次の保存を止める。複数タブの同時書き込みを完全排他する仕組みは未実装。実データ保存解禁前に容量・実ブラウザ／iPhoneでの往復と中断復旧を追加確認する。

**Decided**：v1バックアップを復元するとき、v1に存在しない新モデルの現在値を空値で消去しない。将来の新形式復元では、新旧双方の対象を検証し、HoldingSnapshotとAccountSnapshotを含めてjournalとrollbackの保護対象にする。

### MonthlyAccountStateとv3の正式仕様

**Current**：SBI月次保存serviceは外国証券／現金のmanual AccountSnapshotとMonthlyAccountStateを既存schemaのまま同時保存する。訂正で残る旧Snapshotもv3の`accountSnapshots`で保護される。SBI既存recordに新しいRestore規則は不要で、v1維持／v2 Stateクリア／v3完全復元の意味は変えない。実保存service経由の匿名保存・訂正→v3 export→空の匿名Storageへrestore→共有計算一致を検証済み。実機Restoreは今回行わない。

**Decided（v3公開仕様）**：完全バックアップv3は、従来dataと既存6モデルに`monthlyAccountStates`を加えた7モデルを完全保護する。未作成collectionは`null`（キー不在）とする。manual外国株／現金は既存`accountSnapshots`で保護する。ファイル名・exportedAtは変更しない。

**Decided**：v2は既存6モデルの形式として固定し、7モデル形式へ意味を変更しない。過去versionの必須モデル一覧はversion別に明示し、将来のRepositoryキー一覧から自動生成しない。未知model／field／versionは拒否し、旧アプリがv3を拒否することを許容する。

| Restore形式 | 正式な適用範囲 |
|---|---|
| v1 / Legacy | 従来対象のみ。既存6モデルとMonthlyAccountStateは変更しない |
| v2 | 従来data＋既存6モデルを完全復元し、MonthlyAccountStateキーはクリアする |
| v3 | 従来data＋7モデルをバックアップ内容へ完全復元する |

**Decided**：v2復元で採用先が過去状態へ置換されるため、MonthlyAccountStateを残さない。このクリアも確認後の同じjournal／rollbackに含め、途中失敗時はStateを含めて元状態へ戻す。v3と将来の月次保存も新キーを同じtransactionで保護する。journal確保失敗では開始せず、再読込不一致はrollback、rollback不能時はjournalを保持して後続保存を止める。画面表示・Repository初期化から空モデルを自動保存しない。

**Current（v3互換）**：v3は`data.models`に既存6モデルと`monthlyAccountStates`を必須とし、各値はenvelopeまたは`null`。version別の固定一覧を使って全schema・参照を検証する。v2のState削除とv3の7モデル復元を共通journalで保護し、journal削除前に全モデルを再読込・一致確認する。Inputからのmanual／月次確定保存も接続済み。SBI既存recordのschema・復元規則は維持する。

## 5. 安全な復元フロー

**Decided**：復元は次の順序で行う。

1. JSONとして解析できるか検証する。
2. TradeScopeバックアップか判定する。
3. `backupVersion`と対応可否を確認する。
4. 必須フィールド、型、値域、重複IDを検証する。
5. 現在データを自動退避する。
6. メモリ上または一時領域で新状態を構築する。
7. 全検証成功後に正本データを復元する。
8. 派生データ、Summary、Asset Trend、Position、Riskを再計算する。
9. キャッシュとスナップショットを破棄または再生成する。
10. 復元結果と警告をユーザーへ表示する。

**Decided**：検証途中で失敗した場合、現在データを変更しない。

## 6. 後方互換性

**Decided**：新しいTradeScopeは、旧形式の以下バックアップを読み込めることを正式要件とする。

- 現行損益管理バックアップ
- 現行取引履歴バックアップ
- 現行統合バックアップ
- 今後リリース済みとなる過去`backupVersion`

古いバックアップに存在しない新項目は、次のルールに従う。

- 推測値を設定しない。
- 空配列、空オブジェクト、`null`、`unknown`、機能既定値等の安全な初期値を使う。
- Risk対象を根拠なくONにしない。
- Account紐付け不能時は、未割当としてユーザー確認対象にする。
- 戦略、タグ、取引対応関係を自動推測しない。

## 7. インポート方式

**Decided**：通常ユーザー向けバックアップUIは、将来的に「完全バックアップ」一本へ統合する。

**Under consideration**：損益のみ、履歴のみ等の部分インポートを高度な操作として残すかどうか。

部分インポートを残す場合も、対象外データを消去しないこと、派生キャッシュを適切に無効化することを必須とする。

## 8. localStorageとオリジン

**Current**：現在の公開URLは [https://naoya-koba.github.io/tradescope-app/index.html](https://naoya-koba.github.io/tradescope-app/index.html)、`localStorage`のWeb originは `https://naoya-koba.github.io` である。主な利用形態はiPhoneのホーム画面に追加したPWA / Web Appである。

**Decided**：公開URL、ホスト名、ポートを変更する前に完全バックアップを要求または強く案内する。

**Known issue**：別ポートや別ドメインへ移動すると、同じブラウザでも既存データが見えず、初期状態やダミーデータが表示される可能性がある。また、iPhoneのホーム画面Web Appと通常のSafariでは、同じURLでもストレージが分離される可能性がある。

**Decided**：別の利用形態でデータが見えない場合も初期化や再入力を急がず、利用中のWeb App / Safari、公開URL、バックアップを確認する。端末移行やPWA再インストールの前には、端末外へバックアップを保存する。

**Unknown**：利用中の正確なSafari / WebKitバージョンは未確認である。

## 9. 検証要件

完全バックアップ実装時は、少なくとも次を検証する。

- 空データの往復
- 現行実データ形状を匿名化したfixtureの往復
- 各旧形式からの復元
- 未知の新しい`backupVersion`の拒否
- 壊れたJSON、型不正、欠落項目
- 復元失敗時に現在データが維持されること
- 復元後に派生値が再計算されること
- Memo、Risk、Account、銘柄リストが失われないこと
- Instrument、AccountInstrumentSetting、RawTransaction、TransactionAnnotationが失われないこと
- HoldingSnapshot、AccountSnapshotおよびその出所・観測時点が失われないこと
- v1復元で、v1に収録されない新モデルの現在値が消去されないこと
- キャッシュを復元しなくても同じ正本結果になること

実ユーザーデータそのものをテストfixtureに使用しない。

## Current / Decided — v6部分入力の復元保護

v6はmonthlyAccountInputsを必須collectionとし、nullはキー不在を表す。v1は全9新キーを維持する。v2〜v5に存在しない新Inputは、置換後の観測へ古い採用値を残さないため同じjournalでキー不在へ戻す（復元前に案内する）。v6も旧キーと全8モデルを一つのjournalで保護し、partial・null・decimal・override metadataを再読込一致で確認する。旧versionのschemaを拡張せず、原本・PII・ファイル名は含めない。
