# Backup and Restore Specification

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

**Current**：`backupVersion: 2`を持つ完全バックアップとして、従来v1の次のデータと新Storageの6collectionを一つのJSONへ出力する。

- `tradingData`
- `yearInitialFunds`
- `yearInitialUnrealized`
- `tradeScopeTradeHistoryV1`
- `tradeScopeMemos`
- `tradeScopeSymbolListV1`
- localStorageに実在する場合のみLegacy `tradeInfo`

**Current**：新形式はAccount、Instrument、ImportBatch、RawTransaction、HoldingSnapshot、AccountSnapshotも保護する。AccountInstrumentSetting、Risk設定、TransactionAnnotation等は未実装で、空項目として新設しない。SBIの確認後保存UIは既存保存エンジンへ接続している。

**Current**：SBIの確認後保存による匿名Storage保存後も、既存v2 export／restoreでAccount・Instrument・ImportBatch・RawTransaction・HoldingSnapshotを保護する。AccountSnapshotを不要に生成せず、Backup schemaとv1復元の新モデル維持仕様は変更しない。UI接続の検証は匿名CSVだけで行った。実CSVの本番正本保存はユーザー実施済みと確認されている。通常のCSV保存ごとにバックアップ案内を追加しない。

**Current**：v2、v1、旧統合、旧損益、旧履歴の形式判定・検証・正規化・Restore plan生成基盤がある。v2は新旧双方を復元し、v1は従来対象だけを復元して新モデルの現在値を維持する。旧形式は収録項目だけを復元するLegacy部分復元で、未収録項目を維持する。

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

**Current**：上記v1は従来の保存対象を表し、新モデルを含まない。v1読込は継続するが、新しいトップexportは下記v2を使用する。

**Decided**：新データモデルへ実ユーザーデータを永続保存できるようにする前に、それらの完全バックアップ、検証、復元、journal、rollbackを実装・検証する。ParserとPreviewは永続保存なしで先行してよい。

### 実装済みv2拡張

**Current**：新exportは`backupVersion: 2`。v1の`data`へ`models`を追加し、`accounts`、`instruments`、`importBatches`、`rawTransactions`、`holdingSnapshots`、`accountSnapshots`をすべて必須とする。各値はschemaVersion 1のenvelope、または「保存キー不在」を表す`null`。未保存端末でも自動seedせずexportする。

**Current**：v2復元はenvelopeをそのまま保存し、`null`のcollectionはキー不在へ戻す完全復元。この置換・削除は確認後のv2復元に限り、v1・旧形式では新モデルキーに触れない。Legacy `tradeInfo`はv2でも未収録なら維持する。

**Current**：v2のroot、metadata、modelsの未知項目、新モデルの型・version・decimal・重複ID・参照を全検証し、`__proto__`等も拒否してからjournalを保存する。従来履歴の未知フィールドは安全なJSONとして維持し、再正規化しない。

**Current / Decided**：ダウンロード名は端末のローカル時刻で`TradeScope_YYYYMMDD_HHmm_Backup.json`とする。年4桁、月・日・24時間表記の時・分は2桁ゼロ埋めし、versionや独自連番は付けない。同名ファイルの扱いはOS／ブラウザに任せる。JSON内の`exportedAt`は従来のISO-8601仕様を維持する。復元判定はファイル名ではなくJSON内容によるため、旧名や`(1)`等の付いた名前も受理できる。Blob + downloadとFile input / FileReader、Snapshot無効化、空データdemo抑止、完了後の再読み込みは変更しない。

**Known issue**：journal分の容量も確保できなければ、正本へ書き込まず失敗する。保存権限やディスク障害等でrollback自体も失敗した場合はエラーを返してjournalを保護し、次の保存を止める。複数タブの同時書き込みを完全排他する仕組みは未実装。実データ保存解禁前に容量・実ブラウザ／iPhoneでの往復と中断復旧を追加確認する。

**Decided**：v1バックアップを復元するとき、v1に存在しない新モデルの現在値を空値で消去しない。将来の新形式復元では、新旧双方の対象を検証し、HoldingSnapshotとAccountSnapshotを含めてjournalとrollbackの保護対象にする。

### MonthlyAccountStateとv3の正式仕様

**Decided**：最新完全バックアップをv3へ拡張し、従来dataと既存6モデルに`monthlyAccountStates`を加えた7モデルを完全保護する。未作成collectionは`null`（キー不在）とする。manual外国株／現金は既存`accountSnapshots`で保護する。ファイル名・exportedAtは変更しない。

**Decided**：v2は既存6モデルの形式として固定し、7モデル形式へ意味を変更しない。過去versionの必須モデル一覧はversion別に明示し、将来のRepositoryキー一覧から自動生成しない。未知model／field／versionは拒否し、旧アプリがv3を拒否することを許容する。

| Restore形式 | 正式な適用範囲 |
|---|---|
| v1 / Legacy | 従来対象のみ。既存6モデルとMonthlyAccountStateは変更しない |
| v2 | 従来data＋既存6モデルを完全復元し、MonthlyAccountStateキーはクリアする |
| v3 | 従来data＋7モデルをバックアップ内容へ完全復元する |

**Decided**：v2復元で採用先が過去状態へ置換されるため、MonthlyAccountStateを残さない。このクリアも確認後の同じjournal／rollbackに含め、途中失敗時はStateを含めて元状態へ戻す。v3と将来の月次保存も新キーを同じtransactionで保護する。journal確保失敗では開始せず、再読込不一致はrollback、rollback不能時はjournalを保持して後続保存を止める。画面表示・Repository初期化から空モデルを自動保存しない。

**Current**：この節のv3は正式仕様であり、Storage／Restoreへの実装は次段階で行う。Input UI・実manual保存は未接続。

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
