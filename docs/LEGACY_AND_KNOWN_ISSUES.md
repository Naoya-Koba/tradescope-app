# Legacy, Experimental, and Known Issues

## Current / Known limitation — SBI VC共通残高接続（v304）

現物保有集合／JPY現金の共通resolver、PDF保存のatomic参照candidate hook、旧採用／v4補正のcompatibilityを接続済み。既存データbulk migrationなし、空集合を正式sourceとして扱う。Backup v14の公開契約を変更しない。以下v303の「broker hook未接続」はSBI VC残高に限り本節へ更新し、他broker／本格採用UIは引き続き後続。

candidate取得とadoptionは別操作。PDF取得だけでmanual/common採用を切替えない。別source混在や独立manualの本格編集・採用UIは未実装で、旧PDF補正フォームから異なるsourceを上書きせず停止する。Transaction Historyのactive sourceは旧Input契約のままで、残高adoptionとは独立。fixed month balanceの期間P/L採用は今回拡張しない。

quick deposit／crypto transfer／staking／fee monthly flow／貸出は未接続、現物売り／レバレッジ実取引は実例未検証。帳票合計は完全NAVではなく、担保は別資産ではない。損益・原価を逆算しない。


## Current / Known limitation — 最小source / adoption基盤

現行はPWA v303。部分Inputのmetric単位採用で既存既知値を保持し、新採用のledger額は月途中でも年初基準が不明なら停止する。既存Input／Snapshot／State、新契約なしのlegacyは不変。以下v301は基盤追加時点の記録で、schema／Backupは同じv14のまま。

Backup v14／PWA v301で共通のsource revision・adoption・override・comparisonを永続化。PDF／CSV／manualは対等、公式自動優先なし。候補追加だけでは採用を変えず、複数sourceを加算しない。既存State／Inputの明示採用は互換維持し、2026年1〜8月をbulk migrationしない。legacyの入力日時やplaceholder zeroを推測確認しない。登録済み原金融事実は不変、訂正は新revision・新物理source。旧overrideは非継承。

本格source選択UIは未接続。既存Inputは従来契約のままで、新契約がない本番値は不変。新APIへ登録した参照原値を既存UIから上書きしようとすれば安全に停止する。後続broker接続は新revision経路へ統一する必要がある。外貨自動換算、fee等の新ledger意味、未確認FX保有集合集約、完了承認は今回未実装。保有集合の曖昧な重複Instrumentは推測統合せず候補生成を停止する。

全口座の正本・時点・入出金・unknown・current／period・比較可能性の最終統合監査は残す。以下の旧「永続統一は将来」は、この基盤追加後の口座UI接続・全体整合を意味する。

## Current / Known limitation — 表示・再読込・月次詳細の整合

損益管理のcanonical-only監視を修正し、legacy月次・年初資金・年初評価損益・関連旧キーもstorage／BFCache復帰で再評価する。編集Draftとlive Inputを保持し、表示だけで正本を変更しない。Topと年間Summaryの同義期間KPI／年間flowは共通display-resultsを参照する。Top swapの独立集計は除去した。年間純資産の部分額と直近完全額で増減／率を計算する不整合はbasis gateで「—」にする。年初sourceが未確認でも0寄与による見かけの比較を許可しない。

月次詳細は全未入力月も設定済み6口座を表示する。missing／競合／取得失敗は「—」、明示0は「0円」。安全な開設月がないため開設前除外は推測せず、行statusを保持する。8月legacyをmigrationせず、9月sourceやcurrent carryを過去月へ渡さない。

**Known limitation**：現在月に編集がある外部更新では、Draft保護のためInput grid全体を保持する。Summaryは新正本へ更新するが、入力欄の再同期は編集完了／明示画面操作後となる。Top現在残高とAnnual期間集計は別basisで、数値一致を要求しない。既存legacyの年初保存・建玉空欄・crypto集計等の`Number(...) || 0`と欠損flowの旧寄与は今回全面変更しない。既存の同月観測採用・手入力を含む永続source統一、月全体の完了承認は次工程。以前の「同一年・同一指標の共通化」は同義・同時点の期間結果に限り、current carryまで共用する意味ではない。

匿名DOM／read-only Storage検証と自動回帰を実施する。computer-use browserが利用できず、今回の390px／1280px実表示と実ブラウザConsoleは未確認。UI再検証のために実データを投入しない。PWA v300、Backup v13、永続契約変更なし。

## Current / Known limitation — 未確認残高の一時表示

Top純資産／Allocationに非永続の残高状態を導入。SBIの国内／外国／現金は独立した確認月付きで直近確認値を使用でき、部分観測も直近完全月に捨てられない。SBI VCは採用保有集合を維持し0／不明数量／終了・訂正前保有を復活させない。残高のcomplete／partial／過去値使用／unknownを保持し、期間損益・確定資産・Annual Summary・過去Trend・Riskへ流さない。

**Known limitation**：SBI国内株・投信は一括Batchで、外貨現金は独立した永続sourceがない。legacy口座合計をcanonical内訳へ推測分解しない。選択年を越える残高carryは未対応。旧建玉入力の空欄→0、旧crypto集計の`Number(...) || 0`、旧年初値と欠損flowの0寄与は今回変更せず残課題。過去値が明示0かplaceholderかは推測で修復しない。正式source／採用／履歴の永続統一、月全体完了の承認契約は将来工程。

## Current / Planned — Top純資産カードの意味的整合と全体監査

current資産観測額と直近完全月ベースの変動額／成長率を同じカードへ無条件に並べる不整合は、projectionの比較可否に基づく「—」表示で局所修正済み。根拠・月・完全性を比較し、金額の偶然の一致では許可しない。期間式・他カード・月次正本は不変。

全口座canonical化後の構造的確認課題として、Top純資産・確定資産・純損益・確定損益・年間成長率・月次損益・Annual Summary・Asset Trend・Performance Trend・Asset Allocation・Portfolio・Riskを残す。各指標の正本／対象時点／入出金／unknown・partial／current・period／比較可能性を個別に記録して横断照合する。詳細と今回の非変更範囲はCALCULATIONS「全口座canonical化後の計算・データ整合監査」に集約する。UI全面改修とは別工程であり、今回legacy calculatorを削除したり全指標を移行したりしない。

## Current / Known limitation — SBI VC資産観測のTop接続

Top純資産とAllocationのSBI VC額は選択年内最新採用現物＋JPYの共通観測額へ置換済み。Portfolio／Open Positionsは全年横断最新のため、過去年選択時は時点が異なり得る。取得済み部分額を完全NAVとせず、不明成分を表示状態として保持する。レバレッジ損益・月次損益を推定しない。年間Summary・過去Trend・変動額・成長率・Riskは既存期間計算のままでTop資産観測と一致を要求しない。負額口座はTopに含み配分から除外するため全体合計差も残り得る。将来の全口座current asset統合は別工程。

## Current / Known limitation — 手入力確認統合

GMO／SBI証券／SBI VCで共通1:1／1:N確認統合を実装済み。元manualは削除・更新せず、Backup v13の独立関係で通常履歴だけ置換する。単位不明／曖昧なInstrument／複数候補は置換しない。投信の単位を推測しない。既存の未判断1:1非永続表示統合は互換維持する。両方保持の確定判断は保持し再編集／解除UIは今回追加しない。判断保留は次の同source再選択で明示確認し直せる。

同事実の訂正版は関係を再解決するが、数量内訳・公式ID・日時・手数料等が変わる訂正は、確定置換を孤立させないよう停止する。変更された約定への関係再確認UIは別工程。Open Positions／Risk／Portfolio／Allocationへ新取引sourceは接続しない。実データ・本番Storageを用いた変更は行わない。

## SBI VC現物買い取引（Current / Known limitation）

現物買いの実帳票行をread-only検証済み。明示された約定をImportedTransaction v2／Backup v12で保存・採用履歴へ表示する。現物売り・レバレッジ新規／決済・実建玉・貸出は未検証で保存停止する。月次P/L・取得原価・評価P/Lを推定しない。入出金明細のsettlement／fee legsとクイック入金は売買イベントでもcanonical月次flowでもない。

訂正旧sourceは保持し、採用Input参照だけでactive取引を選ぶ。legacy aggregate 1行と複数fillsは共通の確認統合で非破壊置換可能。削除は行わない。旧資産のみBatchに明細が欠ける場合は自動backfillせず停止する。原本PDF／PIIは保存せず、本番Storageは操作しない。実iPhone操作は未確認。Top／Portfolio／Allocation／Riskは不変。

## SBI VC月次PDF資産・保有保存

**Current**：月次PDFの資産・現物保有・レバレッジ口座観測・入出庫／ステーキング対象月をPreviewする。確認保存は資産・現物保有と検証済み現物買い。Inputは旧観測採用v3／補正v4を読み、通常read-only、明示「修正」時だけ採用値を編集する。原本Snapshotは不変、active補正と訂正履歴はBackup v12で保護し、v1〜v11も復元可能。帳票資産合計を完全純資産にせず、共通原本Viewerを使い、legacy履歴を変更せずRisk／月次consumerへ資産観測を流さない。Top純資産／Allocationは上記の選択年Viewのみ使用する。

**Known limitation**：前工程の該当なし帳票に加え現物買い実行行を検証済み。現物売り／レバレッジ／建玉／貸出の実行行は未検証。月次canonical P/L、現物原価・実現／評価P/Lは生成不可。未知取引区分・不整合は保存前停止する。実iPhone Safari／Home Screen PWAの今回の操作は未確認。

**Planned**：未検証取引行の確認、共通crypto cashflow／月次P/L、観測範囲を超えるcrypto partial projection。レバレッジ建玉・報酬・cashflowは今回は永続化しない。ZIP／CSV対応・永続archiveは今回追加しない。

## Current / Known issue — 共通取引source

**Current / Known issue — 履歴の数量表示**：一覧をコンパクト化し、監査情報はタップ後の1件詳細へ移動する。明示数量単位と公式brokerルールが揃う場合だけ表示用Lotを計算する。GMO帳票の約定数は通貨数量とユーザー確認済み（2026-10-12、約定数×約定単価＝約定金額の整合）で、GMO PDF取引sourceの表示時だけLotへ換算する。既存数量やresolver／dedupe単位は変更しない。投信の単価当たり口数は推測せず、外貨を自動円換算しない。persistent schema／Backup v9／月次consumerは不変。

ImportedTransactionsの新モデル・非破壊resolver・Backup v9を追加。legacy manual／SBI raw原本を維持し、HoldingSnapshotは売買履歴に変換しない。GMO parser保存と共通履歴UIは接続済み。GMOの帳票「約定数」は保存原値・単位を維持し、Lot換算は表示層のみ。manual FXとの照合は明示contractSizeで安全に数量を比較できる場合だけ共通確認UIへ出し、単位不明は重複表示を優先する。既存同一hashは通常no-opだが、旧Batchの明細0件・同一sourceの一意照合・再解析／原観測／損益検算成功時だけ、ユーザー確認後に明細と必要Instrumentを追加できる。月次正本は変更しない。選択だけでは自動補完せず、非ゼロの不完全／不一致集合は停止し修復しない。Risk／Position consumerの統合は別工程。LIGHT／みんなの既知2026-09 PDFの明示取引欄は0件で、月末建玉から当月全売買は復元できないため今回は取引sourceを生成しない。将来明示イベントがある帳票の対応は別工程。

## Traders Storage / Backup v8

**Current**：建玉はFX HoldingSnapshot v2に原資料の数量単位で保存する。**Planned**：Position画面／Riskへの新建玉consumer接続は別工程で取得元の排他・lot仕様を監査する。今回Riskのtransactions sourceは変えない。**Known issue**：8月以前の旧swap欄は手入力値だけで、発生／受渡基準を識別するsource metadataがない。過去の一致確認はhistorical consistency checkであり、9月以降の保存・計算条件ではない。calendarは月単位で独立し、前月PDF／未決済basis不要。差を自動補正しない。

## Traders Securities monthly PDF

**Current / 検証**：前工程で指定されたLIGHT FX／みんなのFXの2026-09 private PDFをread-onlyで解析し内部照合は一致した。今回Parser金融ロジックは不変、匿名PDFだけでpartial保存・後入力を検証する。実PDF・PII・実数値はfixtureへコピーしない。PDF純資産は独立した観測値でledgerへ加算／差額補正しない。8月認識根拠の確認を9月以降の計算依存にしない。Chart.js幅切替の既知問題は別件。

**Current**：PDF-only partialはMonthlyAccountInput v2とBackup v8で保護する。Stateなしでも既知観測・flowを共通projectionへ反映し、swap nullを保存／表示上の0へ確定しない。completeは後入力または同時入力で全必須採用値が揃った場合だけ。LIGHT／みんなは商品識別で分離し、wrong PDFは保存前停止する。

## Current — 部分取込でTop全体が欠損になる表示を改善

Top／年間Summary／両Trendは非永続の共通表示projectionを使用する。同一年・同一指標の値と成長率を共通化し、部分観測は既知成分だけ、当月データが全くない口座だけ直近完全月を使用する。Monthlyは選択月限定、年間内訳は既知月次値の積み上げで、State未確定のSBI国内保有も表示する。null／0と厳密なcanonical ledgerは維持する。

**Known issue**：複数国内候補の選択、実iPhoneでの表示確認は別工程とする。部分Viewは月次確定の代替ではない。GMO手修正UI／原値保護／State v3／最新Backup v9は接続済み。

**Current**：GMO Inputの5項目編集、SBI口座全体表示＋折りたたみ内訳、口座単位保存を実装済み。legacy Draftを正本から分離し他口座を巻き込まない。原値と採用値はmetadataで区別し、明示保存だけState v3にする。独立した取込済み行／global保存／SBI swap欄を除去した。

## Current / Known issue — GMO PDF

**Current / Safari互換**：一部Safariで未対応の`ReadableStream[Symbol.asyncIterator]`をPDF.js legacyの`getTextContent()`が使用し、document／page読込後のtext extractionで失敗する経路を匿名fixtureで再現した。公開Stream reader経路へ切替済み。固定safe codeで失敗段階を識別し、PDF本文・PII・元例外は露出しない。worker／CMap／CSPを原因と断定せず、実iPhoneでの修正後確認は未実施。

GMO FXneoの月次PDF解析・Preview・保護された保存／訂正・共通集計を実装済み。実PDFのローカルparser検証と匿名ブラウザ保存だけを実施し、本番Storage・実PDF保存・実Backup Restoreは実施しない。実iPhone Safari／Home Screen PWAは未確認。PDF.jsは同一versionのlegacy main／workerと必要な日本語CMapのみ固定vendorし、他CMap／フォントを必要とする未確認帳票、OCR／画像だけのPDF、完全な明細を確認できない空帳票は保存不可とする。

非ゼロ手数料・締後移動・未対応外貨・未知入出金区分・合計不一致は推定補完せず停止する。複数タブの完全排他、quota・中断・実機PWAは引き続きリスクとして扱う。未対応の他brokerへ自動拡張しない。

**Current / v1〜v9互換**：最新Exportはv10。SBI部分入力も9collectionで保護し、v6の旧8collection・v5の7collection範囲は固定する。原値・採用値・override metadataを保護し、v4は旧record＋State v2に固定、v3は旧record限定、v2はStateクリア、v1は新モデル維持。自動Migration・PII・原本保存は行わない。

この文書は、2026-09-26時点のコード読取結果と、その後のCurrent更新を記録する。ここへの記載は修正済みを意味しない。

## 1. 重要な仕様差異・既知の問題

### SBI月次cutover

- **Decided**：2026-08以前はlegacyを維持、2026-09以降は月次状態と明示採用先を用いる。意味のあるlegacy月次入力があればconflictで停止し、placeholderや他口座由来の`__saved`ではSBI確定にしない。欠損月を累積値へ0で補わない。
- **Current**：共有resolver・completeness・保存service・訂正・canonical依存fingerprintとSBI Input UI／Summary／Top／Trendは接続済み。
- **Known issue**：旧全ゼロ月の入力由来は保存形状だけでは確定できない。自動Migration・削除はせず、直接月次入力の有限な非ゼロ値をlegacy conflictの根拠とする。複数タブ完全排他・容量・実機iPhoneは引き続き別途確認する。

### 完全バックアップv3・v2／v1互換とLegacy部分復元

- **Current**：トップexportは`backupVersion: 9`。従来正本とAccount、Instrument、ImportBatch、RawTransaction、HoldingSnapshot、AccountSnapshot、MonthlyAccountState、MonthlyAccountInputを保存する。SBI CSVの確認後保存は接続済みだが、SBIの2026年9月以降のInput UI・manual月次保存・共有集計も接続済み。
- **Current**：v3、v2、v1と旧3形式の判定・検証・正規化・Restore plan生成基盤は存在する。
- **Current**：v3は7モデルを完全復元し、v2は従来6モデルを復元して月次状態を同一journalでクリアする。v1は従来対象を復元して9モデルを維持する。旧形式は部分復元で未収録項目を維持する。
- **Current**：復元前ジャーナル、書き込み後検証、失敗時ロールバック、Summary Snapshot無効化、空データ復元時のダミー投入抑止を行う。
- **Current**：未完了ジャーナルが残る場合は新しい復元を開始せず、ユーザー確認後に復元前状態へ戻す。
- **Current / Confirmed**：2026年9月23日に現行統合形式の `tradescope-all-backup-2026-09-23.json` を出力済みである。
- **Current / Confirmed**：このファイルはMemo、銘柄リスト等を含まず、新仕様上の完全バックアップではない。新しいv1エクスポートとは別形式である。
- **Unknown**：この既存バックアップの外部媒体上の恒久的な保存場所は未確認である。
- **Decided**：再生成不能データを一つにまとめる完全バックアップへ統合する。

### Service Workerの欠損ファイル参照

- **Current**：存在しない`assets/chart.js`はprecache対象から除外済み。トップ画面のCSS / JavaScriptはHTMLと同じバージョン付きURLをprecacheし、Cache version更新時に旧キャッシュを削除する。
- **Decided**：precache対象の存在検証を必須とする。

### ZAR/MXNのcontractSize不整合

- **Current**：新規登録時はHUF/JPY、ZAR/JPY、MXN/JPYを10万通貨として扱う。
- **Current**：履歴編集時はHUF/JPYだけを10万通貨判定し、ZAR/MXNは標準1万通貨になるコード経路がある。
- **Current**：Risk計算はHUF/ZAR/MXNを強制的に10万通貨として扱う。
- **Known issue**：Portfolio必要証拠金、Open Positions、Riskで異なる契約数量を使う可能性がある。
- **Decided**：商品・契約単位の正本を一箇所へ集約する。

### Top Summary Snapshotの整合性

- **Current**：トップは対象年の正本データが存在し、`tradeScopeTopSummarySnapshotV1`のfingerprintと最新入力済み月が正本データに一致する場合だけSnapshotを利用する。正本データがない場合、または不一致の場合はSnapshotだけを根拠に表示しない。
- **Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する手段としてSnapshotを使う経路が導入された。
- **Current**：fingerprintを持たない旧Snapshot、元データ変更後の古いSnapshot、無効な月を指すSnapshotは使用せず、正本データから再計算する。
- **Decided**：Snapshotやキャッシュの利用自体は禁止しない。同一指標は同一の正本データまたは同一の共通計算結果を利用し、Snapshotは非正本として、元データ更新後に古い値を表示しない。

### 計算ロジックの重複

- **Current**：確定資産、純資産、Performance等が`assets/profit-metrics.js`、`profit/soneki.js`、`top/script.js`に重複する。
- **Known issue**：修正漏れにより画面間で値がずれる可能性がある。
- **Decided**：同一指標は共有計算ロジックへ一本化する。

### dummy / fallback値

- **Current**：空データ時の2025年ダミー損益の自動投入は廃止済み。「ダミーデータ再投入」はユーザーが明示操作した場合だけ実行する。
- **Current**：トップSummary、Asset Allocation、Riskの固定フォールバック値は削除済みで、正本データがない場合は空状態を表示する。
- **Current**：Position Detailsの固定チャート、固定Swap、平均建値を現在価格として表示する代用は削除済みで、取得元がない項目は「未取得」または「データなし」を表示する。
- **Current**：Portfolioは取引履歴や月次保有明細に存在しない統合ポジションを資産残高から捏造しない。換算レートを取得できないクロス通貨の必要証拠金は「未取得」とする。
- **Decided**：サンプル・フォールバックを実データのように表示しない。

### Chart.jsバージョン差異

- **Current**：トップはChart.js `4.4.1`固定。
- **Current**：損益管理は`https://cdn.jsdelivr.net/npm/chart.js`でバージョン未固定。
- **Known issue**：更新により画面間の挙動が変わる可能性がある。
- **Planned / Development guidance**：画面間のバージョン差異を解消する。検証済みの同一固定バージョンを推奨するが、採用バージョンと更新方針は実装時に決定する。

### 存在しないページへのリンク（解消済み）

- **Current**：`settings.html`と`oshime.html`へのリンクおよび準備中メニューは、主要画面を含む残存実装から削除済み。
- **Planned / Under consideration**：設定画面はPlanned。押し／戻り機能の正式採否は未確定。

### データ削除処理の残存キー

- **Current**：「保存データ削除」は`tradingData`と`yearInitialFunds`を削除するが、`yearInitialUnrealized`とTop Summary Snapshot等を削除しない。
- **Current**：「ダミーデータ再投入」も`yearInitialUnrealized`を削除しないため、再投入条件を満たさない可能性がある。
- **Known issue**：削除後も旧値が表示される、またはダミー再投入が期待どおり動かない可能性がある。
- **Decided**：削除対象を明示し、正本削除とキャッシュ破棄を分ける。実装時は事前バックアップを必須とする。

### tradeInfoの利用状況

- **Current**：`tradeinfo/`の旧ページ実装とナビゲーションは削除済み。
- **Current / Compatibility**：`tradeInfo`のlocalStorageキーと、存在する場合に`legacy.tradeInfo`として保存・復元する完全バックアップv1互換処理は維持している。
- **Current / Confirmed**：現在ユーザーは`tradeInfo`を利用していない。
- **Unknown**：localStorage内に過去の`tradeInfo`データが残存しているかは、コードだけでは確認できない。
- **Decided**：`tradeinfo/`は正式機能ではなくLegacyとして扱い、将来の正式機能として維持しない。残存データが確認された場合は、明示的な移行・削除判断まで一時的に保護し、その期間のバックアップから欠落させない。恒久的な完全バックアップ対象とは確定しない。
- **Under consideration**：残存データがある場合のTransaction Historyへの移行またはread-only保存方法。

## 2. 追加で確認された問題

### 暗号資産RiskにJPY現金が含まれる可能性

- **Current**：トップRiskはSBI VC口座の`accountData.amount`全体を暗号資産0円時損失へ渡す。
- **Known issue**：SBI VCの純資産にはJPY保有を含むため、正式仕様より最大損失が過大になる可能性がある。
- **Decided**：暗号資産0円時損失は暗号資産評価額だけとし、JPY現金を除外する。

### Top Position Detailsが実ポジション詳細になっていない

- **Current**：現在レート、Swap、証拠金維持率、損益推移チャートは正式な実データ源がないため、「未取得」または「データなし」を表示する。平均建値や固定値による代用はしない。
- **Known issue**：これらの実データ取得・計算機能自体は未実装である。
- **Decided**：実データで算出できない項目は未取得・未実装と明示する。

### FX必要証拠金が概算

- **Current**：平均建値と履歴上の換算レートを使い、想定元本の4%で計算する。必要な換算レートが履歴から取得できない場合は計算しない。
- **Known issue**：現在レート、口座固有ルール、実際の必要証拠金と一致しない可能性がある。
- **Decided**：概算は概算と明示し、将来の口座別Riskとは分離する。

### 投資信託・ETF判定が銘柄名依存

- **Current**：`eMAXIS`、`ファンド`、`ETF`等の文字列で単位を推定する。
- **Known issue**：誤分類すると取得原価が1万倍単位でずれる可能性がある。
- **Planned**：InstrumentにAsset Classと価格単位を明示保存する。

### Manifestの重複と不整合

- **Current**：Active Manifestは`manifest.webmanifest`へ一本化済み。未参照だった`manifest.json`は削除し、192x192宣言には実寸192x192の`assets/icon-192.png`を使用する。

### 公開環境とリポジトリ内デプロイ設定

- **Current / Confirmed**：現在はGitHub Pagesで [https://naoya-koba.github.io/tradescope-app/index.html](https://naoya-koba.github.io/tradescope-app/index.html) を公開している。`localStorage`のWeb originは `https://naoya-koba.github.io` である。
- **Current / Confirmed**：主な利用形態はiPhoneのホーム画面に追加したPWA / Web Appである。
- **Current**：リポジトリ内に、GitHub Actions等の明示的なデプロイworkflowは確認できない。
- **Unknown**：GitHub Pagesの公開元branch / folder等のリポジトリ外設定、実際の更新手順、利用中の正確なSafari / WebKitバージョンは未確認である。
- **Known issue / Data protection note**：iPhoneのホーム画面Web Appと通常のSafariでは、同じURLでもストレージが分離される可能性がある。データが見えない場合も初期化前に利用形態とバックアップを確認する。
- **Planned**：Codex中心開発へ移行する前後で、起動・公開・ロールバック手順を文書化する。

### 自動テストと未検証範囲

- **Current**：CSV Preview、Storage、新旧バックアップ互換・rollbackの匿名自動テストを追加済み。
- **Known issue**：計算全体、Migration、実ブラウザ／iPhoneでの月次状態・v3往復、容量上限、複数タブ排他は未確認。今回の月次状態は匿名MemoryStorageで検証し、実データ・本番Storageへは接続していない。
- **Planned**：共有計算と実環境の容量・中断復旧を追加検証する。保存基盤の追加だけで実CSV保存を解禁しない。

## 3. Legacy / Experimental一覧

| 対象 | 分類 | 方針 |
|---|---|---|
| `tradeinfo/` | Removed Legacy implementation | 旧ページ実装は削除済み。`tradeInfo`キーとバックアップ互換処理は別途判断まで維持 |
| `analysis/rates.*` | Removed Experimental implementation | 固定サンプルによる旧実装は削除済み。将来採用時は正式なデータ源から再設計 |
| `tenkan/*` | Removed Experimental implementation | 固定ダミーによる旧実装は削除済み。将来採用時は正式仕様から再設計 |
| Position Details固定チャート | Removed placeholder | 固定チャートは削除済み。正式なデータ源が実装されるまでは空状態を表示 |
| OCR UI | Planned placeholder | CSV優先方針の後でPDF/OCRを検討 |
| `tmp_sbi_diff.txt` | Legacy diagnostic artifact | 実行時未使用。削除可否は別途判断 |
| `input/` | Empty / unknown | 現在空。将来用途は不明 |

## 4. 判断不能事項

**Current / PDF原本確認**：GMO／LIGHT FX／みんなのFXで共通のセッション内Viewerを使用する。原本は永続化せず、Backup v9・月次計算・Transaction Historyは変更しない。現在ページだけ描画し、終了時はdocumentの解放完了後にworkerを止める。匿名localhostのPC1280／mobile390と実PDFのローカルread-only描画を確認する。実iPhone Safari／Home Screen PWAでの原本Viewer操作・メモリ負荷は未確認。

**Under consideration**：PDF永続archive、履歴からの原本ページnavigation、検索／text selection／thumbnail。現時点ではreload後の原本復元や履歴の原本リンクは提供しない。

- 利用中の正確なSafari / WebKitバージョン
- iPhoneのホーム画面Web Appと通常Safariにおける、現在の実データの保存先・分離状況
- `tradeInfo`に過去データが残っているか
- `tradescope-all-backup-2026-09-23.json`の外部媒体上の恒久的な保存場所
- GitHub Pagesの公開元branch / folder等のリポジトリ外設定と実際の更新手順
- 口座名変更・統合に関する過去の設計意図
- Completed Tradesの決済対応方式
- クロス通貨・ショートの正式Risk式
- 手数料、税、配当、分配金等の現在の入力慣行
- 政策金利予測、転換シグナル、押し／戻りの正式採否とデータ源

不明点は推測で埋めず、実装開始前に確認する。

**Current / SBI月次接続**：2026-09以降は未確定をlegacy placeholderで補わない。Top／Summary／Trendは共有resolverを参照し、Stateと採用元を含むfingerprintで古いキャッシュを拒否する。保存済みの旧全ゼロ値が実入力かplaceholderかは既存recordだけでは区別不能であり、Migrationせず非ゼロ直接入力を競合の証拠とする。複数国内候補の解決UI、同時タブの完全排他、実機iPhoneの保存／容量／中断検証は今回追加しない。

## Current / Known issue — SBI国内部分保存

国内集計の手修正はMonthlyAccountInputと最新Backup v9で保護し原Holding・取得日・legacyを変更しない。必要な外国／現金／月次値が不足している間はStateを作らない。旧CSV再取込と手入力履歴は共通確認統合で非破壊照合する。canonical削除UIは追加しない。実機iPhoneでの保存・容量・中断確認は別途必要。

**Known issue / 要再現確認**：匿名localhostで390pxから1280pxへ連続切替した際、既存CDNのChart.jsでnull contextの`save`例外を1回観測した。通常のTop表示では再発せず、原因は未確定。今回のInput保存修正とは分離し、チャート処理は変更していない。

**Known issue / 匿名QA**：一時iframeのTop→Input遷移を含む検証中に`MutationObserver.observe`へ非Nodeが渡る例外を1件観測した。既存`assets/transitions.js`にdocument.bodyを直接observeする経路があるが、発生箇所・再現条件は未確定。単独Inputの保存ではConsole Error／Warningなし。今回のpartial保存・Backupとは分離し、共通遷移コードは変更しない。
