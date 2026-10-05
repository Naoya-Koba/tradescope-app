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

**Current**：`backupVersion: 1`を持つ完全バックアップとして、次を一つのJSONへ出力する。

- `tradingData`
- `yearInitialFunds`
- `yearInitialUnrealized`
- `tradeScopeTradeHistoryV1`
- `tradeScopeMemos`
- `tradeScopeSymbolListV1`
- localStorageに実在する場合のみLegacy `tradeInfo`

**Current**：Risk設定、Account設定、Raw Transactions、Holding Snapshots、Account Snapshotsは現在存在しないため、v1エクスポートでは新設していない。

**Current**：v1、旧統合、旧損益、旧履歴の形式判定・検証・正規化・Restore plan生成基盤がある。v1は正式対象データを完全復元し、旧形式は収録項目だけを復元して未収録項目を維持するLegacy部分復元として扱う。

**Current**：復元前に形式、バージョン、必須項目、型を検証し、復元内容、維持内容、警告を確認画面へ表示する。ユーザーがキャンセルした場合はlocalStorageを変更しない。

**Current**：全書き込み値をメモリ上でJSON化した後、専用の`tradeScopeRestoreJournalV1`へ対象キーの存在有無と復元前の生文字列を保存する。ジャーナル保存に失敗した場合は復元を開始せず、途中失敗時は元の生文字列へロールバックする。復元成功後はジャーナルを削除する。ジャーナルは完全バックアップ対象外である。

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

現在のv1形式の概念例：

```json
{
  "product": "TradeScope",
  "backupVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "source": {
    "appVersion": "unknown-or-version",
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

**Current**：上記v1は現在実装済みの保存対象を表す。未実装のAccount、Instrument、AccountInstrumentSetting、RawTransaction、HoldingSnapshot、AccountSnapshot、TransactionAnnotationを空項目として追加してはいない。

**Decided**：新データモデルへ実ユーザーデータを永続保存できるようにする前に、それらの完全バックアップ、検証、復元、journal、rollbackを実装・検証する。ParserとPreviewは永続保存なしで先行してよい。

**Planned**：新モデルを追加するバックアップ形式は`backupVersion: 2`を候補とする。ただしv2の具体的なJSON構造、必須項目、移行規則は実装時に決定し、現時点の確定仕様とはしない。

**Decided**：v1バックアップを復元するとき、v1に存在しない新モデルの現在値を空値で消去しない。将来の新形式復元では、新旧双方の対象を検証し、HoldingSnapshotとAccountSnapshotを含めてjournalとrollbackの保護対象にする。

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
