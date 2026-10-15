# Development Guide

## Current — Traders共通取引保存（v316）

共通serviceは`import/traders-transactions-save.js`、小さな商品設定とBatch判定は`assets/traders-source-policy.js`、provider別UI bindingは`import/traders-transactions-ui.js`。LIGHT旧入口を維持し、v315の匿名golden planとbyte-identical、保存済みcollection再確認で変更0件を検証する。みんなもparseExecutions→v3→validator→pure buildChanges→Repositoryの一回のjournalを使用する。parser／永続契約／既存History readerは変更しない。

PWA v316、asset query 20261015-5、Backup v15。追加106件／全2298テスト、JS／MJS 151件＋inline 3件、precache 90件、local HTML URL 259件・依存順を検証する。匿名Memory／DOM／VMで両provider、双方向Batch共有、transaction-only非波及、訂正／stale／rollback／journal保持、v15往復とv1〜v14 restoreを確認。production scriptのPDF選択→明示取込→History→再取込も匿名VMで通す（PDF抽出だけsyntheticへ差替え）。実みんな2025-04は7約定（新規買3・決済売4）・建玉照合3/3・realized一致・swap不一致警告、LIGHTは8／10約定をread-only planで確認。原本不変・保存0回、実ID／本文／PIIをfixtureへ入れない。

Chrome接続不可で実ブラウザPDF抽出、390px／1280px、overflow、Console、既定History回帰は未実施。Node既存PDF.jsの0文字抽出も継続し、別のread-only抽出器によるplan成功をブラウザ成功と扱わない。次回接続可能時、新実装前に確認する。以下の旧版記述は当時の工程境界。

## Current — LIGHT transaction-only保存（v315）

新moduleは`import/lightfx-transactions-save.js`と`lightfx-transactions-ui.js`。前者の純粋`buildChanges`へprospective canonical modelsを渡して、将来のSnapshot／scalar候補等と同じjournalへ合成可能。現UIでは月次保存と取引保存を分離。LIGHT previewだけparseExecutionsへ接続し、みんなは保存しない。既存取引専用Batchへ後から月次保存する場合もBatchを変更せず再利用し、旧collectionを壊さない。

PWA v315、変更asset query 20261015-4、Backup v15維持。新schema／key／migrationなし。取引保存のpostconditionは既存Repository verifyModelsを使用。テストは匿名synthetic／Memory／DOM／VMのみ。実PDFのread-only照合は原本・本文・実IDをfixture／Git／logsへ出さず、検証計画も永続化しない。

検証：追加105件／全2192 tests Pass。JS／MJS 147ファイル＋inline 3件、precache 87資産、local URL 252件・依存順・diff-check Pass。匿名Memoryでv15往復／v1〜v14 restore、各保存段階rollback／journal保持、金融projection不変、匿名DOM／browser-global VMを確認。実LIGHT 2026-03は新規買8件・TRY／HUF・建玉8件、2025-12は決済売10件・同一新規参照の複数決済・建玉なしをread-onlyで既存parser→v3→complete collection検証し、保存0回。

Node上の既存PDF.js抽出は対象2冊とも0文字となったため、実PDF計画検証は別のローカル文字抽出器を使用した。ブラウザPDF.js経路の成功確認ではなく、原因の断定・extractor変更は行わない。computer-use接続一覧は空、Chrome利用不可で390px／1280px・実Console・v313以降の指定回帰は未実施。次回接続可能時、新実装前に確認する。匿名検証プロセス終了でMemoryを破棄し、production Storage・実PDF・実Backupは未操作。

## Current — SBI VC月別残高／再取り込み（v314）

PWA v314、変更asset query 20261015-3、Backup v15維持。`sbivc-save.inspect(source,{balanceImport:true})`で明示取込用の再確認計画を返す。既存save APIの互換動作は維持し、Previewが渡すfingerprintと必要な更新確認をsaveで再検証する。same hashは原値再利用、別hashは新canonical。残高専用訂正は旧transaction active Batch／reconciliationを切り替えない。

Repositoryの非永続`verifyModels`callbackは再読込後・journal除去前のdomain postcondition用。新永続契約ではない。monthly displayの固定月facadeだけ残高取得を広げ、内部period dashboard／series／flowを維持する。検証は匿名Memory／DOM／VMのみで実データを使わない。

検証：追加64件／全2087 tests Pass。JS／MJS 144ファイル＋inline 3件、precache 85資産、local URL 250件・依存順・diff-check Pass。匿名Memoryで同一PDF再確認／不足参照補完／使用値確認／atomic rollback／journal保護／Backup v15往復、全体suiteで旧Backup restore・v313 Historyを回帰検証。実ブラウザは接続一覧が空でChromeも利用不可。390px／1280px・実Console・v313指定10項目の実ブラウザ回帰は未実施で、匿名DOM／VM Passと区別する。次回接続可能時、新実装前に確認する。匿名Memoryは検証プロセス終了で破棄し、production Storage・実PDF・実Backupは未操作。

## Current — FX v3 reader／History projection（v313）

新共有moduleは`assets/transaction-adoption-view.js`。v312 contractの後、transaction-view／History UIより前にロードする。read-only・snapshot fingerprint保護付きで、stale／conflict／brokenは旧残高sourceへ戻さない。`transaction-view.projectV3`が状態と表示rowを返し、既存resolveは旧v1／v2／manualの照合終了後にv3を追加する。v3をreconciliation v1や自動dedupeへ渡さない。production parser／save hook・position consumerは変更しない。

Historyはstorage／BFCache／再表示で正本を再読込し、filter／詳細操作でも変更されたmodelの古いv3表示を使わない。再読込はHistory部分だけで、manual編集Draft／positionsを再生成しない。必要最小限の詳細項目でnullは—、0は原通貨付き0を表示。内部IDは通常一覧へ出さない。

PWA v313、変更依存query 20261015-2、Backup v15不変。追加74件／全2023 tests Pass。匿名fixtureは`tests/fx-history-fixture.js`、実ブラウザ準備は`tests/fx-history-browser.html`／`.js`。harnessは既存History CSS／controllerを使い、GMO／SBI VC／manual＋v3、候補追加／採用切替／defer／stale／空集合をプロセス内メモリだけで操作し、終了操作で破棄する。production Storage・実PDF・実注文番号・実Backupは使用しない。

JS／MJS 143ファイル＋inline 3件、precache 85資産、HTML local URL 249件と依存順、diff-checkを確認。後続decisionの対象破損をscope filterで落として旧採用を復活させず、参照の双方向連結も検証する。v15往復／v1〜v14 Restore回帰は匿名MemoryでPass。

実ブラウザ検証は接続待ち：Chrome／アプリ内ブラウザとも利用不可、ブラウザ接続一覧は空。390px／1280px・Consoleは未確認であり、匿名DOM／browser-global VM回帰を実ブラウザ結果としない。

## Current — FX contract／Backup v15のみ（v312）

`assets/transaction-source-contract.js`は副作用なしのrecord／reference／fingerprint／history validatorと低レベルresolver。既存SHA-256 primitiveだけを再利用し、monthlySourcesの公開契約は変更しない。Repositoryはv3原rowと参照Batchの不変性、新entityのappend-only履歴、expectedModels、既存journal／再読込／rollbackを保護する。将来Batch／Snapshot／Holding／v3 rows／collection／明示decisionを一回のcommitへ合成可能。PDF保存hook・History consumer・reconciliation v2は接続しない。

PWA v312、変更依存query 20261015-1、新moduleを各production HTML／匿名harnessのdata-model-storage前へ配置しprecacheへ追加。Backup v15、v14固定11モデル、v15は12モデル。旧テストはlatest export期待値・新key不存在・追加module依存だけを更新し、旧形式の互換fixtureはその公開対象へ限定する。

`tests/fx-transaction-contract.test.js`はinvented匿名値のみ。4種action／side、巨大ID／先頭0、複数close／同order複数row、null／0／負値、collection／決定履歴、訂正／同PDF normalizer revision、stale、旧Backup互換、v15往復／破損拒否、combined commit／rollback／不能時journal保持、History非流入を検証する。全テスト・構文・precache／URL・diff-checkを確認する。production Storage・実データ・実Backup・実PDFを使用しない。実ブラウザ／Console検証は本工程では未実施（UI変更なし、匿名DOM／browser-global VM回帰で確認）。

既存journalはrollback保護であり、複数タブの完全排他やWeb Storage障害下の完全復旧保証ではない。新contractはその限界を拡大保証せず、排他方式は別工程。

検証：追加154件／全1949 tests Pass（旧1795件維持）。JS／MJS 139ファイル＋inline 3件、precache 84資産、全HTML local URL 228件と依存順、diff-check Pass。公開済み非空v14 source／採用／補正／比較往復、v1〜v14 restore、v15混在record・履歴往復、破損拒否、書込後破損／旧key clear失敗／rollback不能時journal保持を匿名Memoryで確認。localhost HTTP回帰もPass、匿名fixtureはプロセス終了で破棄。実ブラウザ／Consoleは未実施。

## Current — Traders parser-only検証（v311）

parserの既存scalar出力と非永続`parseExecutions`を分離する。新規requiredは文字列注文ID・日時・pair・action・side・原数量・価格、closeには原新規注文参照も要求する。任意blankはnull。decimal helperは小数文字列の正規化比較で、binary浮動小数の価格計算にしない。非ゼロfeeの表記は保持するが、既存scalar保存の未対応guardは維持する。

PWA v311、parser query 20261014-12、Backup v14／Storage key／validator公開契約不変。匿名fixtureは公開レイアウトとinvented values／巨大synthetic IDsのみ。既存fixtureは取引identity欄を補足したが金融集計原値は変更していない。実PDFはメモリ内read-only、原PDF・PII・実注文番号・抽出全文をfixture／ログ／Gitへ残さない。UI／transaction consumer変更なし。production Storage・実Backupは検証に使用しない。

検証：追加75件／全1795 tests Pass。JS／MJS 137ファイル＋inline 3件、precache 83資産、HTML local参照179件、diff-check Pass。実LIGHTの新規月／決済月、みんなの新規・決済混在月と旧8月／9月の計5冊をread-only確認し、全冊parse valid、旧HEADとのscalar出力形／金融原値／warnings一致を確認。みんな混在月のswap不一致は正規化APIだけに診断を保持する。匿名Memoryで既存scalar保存／Backup v14往復にexecution・auditが混入しないことを確認。production Storage・実Backup未操作。UI変更なしのため新しいブラウザ／Console検証は未実施。実PDFのコピー・一時ファイルは作成していない。

## Current — みんなのFX scalar横展開（v310）

既存LIGHT facadeをbroker設定で共用する。公開LIGHT APIは互換のまま、monthly resolverは共通tradersScalarsを返す。traders-saveの候補計画・guard・atomic commit、traders-monthly-uiの既存scalar-source-selection／scalar-source-uiをみんなへ再利用し、provider固有の独自adoptionを作らない。入力元操作でもdirty flow Draftを保持し、古いguardでの保存は停止する。訂正previewは候補追加であり採用切替ではないと表示する。

PWA v310、変更module query 20261014-11、Backup v14維持。`tests/minna-scalar.test.js`は匿名Memory／DOMで候補・重複排他・採用・訂正・補正・比較／defer・stale・rollback・Backup・current carry／historical no-carryを検証し、既存LIGHT／SBI／SBI VC回帰も全維持する。localhost harnessに匿名みんな準備を追加。production Storage・実Backupは使用しない。実みんな8月／9月PDFはread-only parser回帰のみで、原値をfixtureへ転記しない。

検証：追加70件／全1720 tests Pass。JS／MJS構文135ファイル＋inline 3件、precache 83資産、production 122＋匿名harness 57 local参照、diff-checkを確認。実みんな8月／9月PDFは各2ページ・建玉14行・当月取引0件・残高／価格評価損益／入出金／settled・未決済swapの取得とparser内部照合Pass。匿名localhostでmanual→PDF明示採用、同内容確認後の採用維持、defer、別タブ更新後のstale停止／Draft保持、390px／1280px横overflowなし、Console Error／Warningなしを確認。current carryのsourceMonthとfixed month不足を区別し、Top／Allocationの採用値反映後も金融正本18キーは不変。匿名Memoryでatomic rollback・rollback不能時journal保持・Backup v14往復／v13互換を確認。匿名Storage／SW／cache・tab／viewport override／serverはcleanup済み。

## Current — LIGHT scalar resolver／hook／最小UI（v309）

`assets/lightfx-scalar-adoption.js`が2metricの正式scopeを定義し、monthly resolver／required進捗診断／scalar UIはこのfacadeを使用する。既存scalar-source-selection／scalar-source-uiをLIGHT月次Inputへ再利用する。選択はDraft、保存でのみ共通serviceを呼ぶ。current source／candidate／基準日／revision／原値／補正／比較／保留を表示し、独立manual作成UIの拡大はしない。金融flow Draftとsource選択は分離し、外部更新・source操作でも未保存flowを破棄しない。

Traders保存はLIGHTだけSnapshot参照candidate計画を合成して一回commit。previewの確認fingerprintとcommitの全model／legacy guardを検証する。source追加で採用を変更せず、訂正版の確認にも候補追加であることを表示する。source判断がある価格評価損益の補正は共通UIを使い、native flow保存へ共通overrideをコピーしない。先行account recordがない明示deferは共通serviceで標準Account依存だけをatomic追加し、金融source／値は作らない。

PWA v309、変更資産query 20261014-10、Backup v14不変。匿名`tests/lightfx-scalar.test.js`とlocalhost harnessで重複排他・候補／採用・訂正・補正・stale／Draft・atomic／rollback・Backup・current／periodを検証する。実PDFは8月／9月read-only parser回帰だけで、原値をfixtureへ転記しない。production Storage・実Backupは使用しない。

検証：追加67件／全1650 tests Pass。JS／MJS構文134ファイル＋production inline 3件、precache 83資産、production 122＋匿名harness 22 local参照、diff-checkを確認。実LIGHT 8月／9月PDFは各2ページ・建玉11行・parser内部照合Pass。computer-useの匿名localhostでmanual→PDF明示切替・同内容確認後の採用維持・defer・別タブ更新後のstale停止／Draft保持、390px／1280px、横overflowなし・Console Error／Warningなしを確認。Top表示後も全金融正本18キーの値／不在状態は不変。匿名Memoryでatomic rollback・journal保持・v14往復／v13互換を確認。検証用Storage／SW／cache・tab／viewport override／serverはcleanup済み。

## Current — SBI derived period input（v308）

新module `assets/sbi-period-input.js`は既存balance facadeから渡された金融観測とnative manual flowだけを評価する。monthly-account-resolverのSBI共通判断あり分岐から一度だけ呼び、Monthly／Annual／Trendに個別source選択を追加しない。progressのperiodReferenceも同じ結果を読み、financial calculatorへ逆流しない。新State・金融原値コピー・Storage書込・current carry依存なし。partial InputのBatch／Snapshot参照もcalculator fingerprintへ含め、採用参照・原観測変更後のcacheを再利用しない。

`tests/sbi-period-input.test.js`は匿名MemoryでStateなしperiod成立、5metric原参照、manual／CSV対等、flow missing、0／負値、stale／参照破損／競合、whole排他、固定月no-carry、8月／9月互換、Summary／Trend、current金額不変、Backup v14往復・Storage不変を検証する。PWA v308、変更module query 20261014-9、Backup v14／persistent schema不変。Portfolio／Open Positions／Transaction History／Risk／SBI VCのsource契約は変更しない。

検証：追加58件／全1583 tests Pass。JS／MJS構文132ファイル＋production inline 3件、precache 82資産、production 119＋匿名harness 19 local参照、diff-checkを確認。匿名MemoryでBackup v14往復・原model／Storage不変、匿名localhostでStateなしSBI period条件充足と翌月carryの当月非充足を確認した。既存Top／損益管理を390px／1280pxで確認し横overflow・Console Error／Warningなし。匿名Storage不変確認後、テストStorage／Service Worker／cacheをcleanupし、temporary tab／viewport override／serverを終了。本番Storage・実データ・実Backupは未操作。

## Current — required policy／progress（v307）

新共有moduleは`assets/monthly-required-policy.js`と`assets/monthly-progress-view.js`。index／損益管理で依存resolverの後にロードし、UIはまだ呼び出さずAPIを提供する。PWA v307、query 20261014-8、Backup v14／永続契約変更なし。`tests/monthly-progress.test.js`は匿名Memoryで6口座、calendar swap、common manual／CSV、空集合、0／missing、stale／conflict／broken reference、carryの当月非充足、legacy互換、金融結果／Backup／Storage不変を検証する。

progress APIはmodels／tradingDataを読むだけで、Storage・DOM・networkへアクセスしない。current carryを評価する際は既存current-asset-viewの口座balance結果を渡す。未供給のcarryを推測せず、fixed／periodには渡さない。requirementsSatisfiedは指定scopeに対する条件充足で、月次承認ではない。SBI custody-aware契約・user approval永続化は別工程。

検証：追加83件／全1525 tests Pass。JS／MJS構文128ファイル＋production inline 3件、precache 81資産、production 116＋匿名harness 17 local参照、diff-checkを確認。通常sandboxでlocalhost接続がEACCESとなる2テストは、許可された匿名loopback環境で全件通過。`tests/monthly-progress-browser.*`はfresh localhost専用で6口座・9月明示0／採用・10月carry／当月非充足・Storage不変を確認する。production／precacheへharnessは含めない。

computer-use browserで既存Top／損益管理の390px／1280pxを確認し、横overflow・Console Error／Warningなし。匿名originの金融Storage不変確認後、テストStorage／Service Worker／cacheをcleanupし、temporary tab／viewport override／serverを終了した。本番Storage・実データ・実Backupは未操作。

## Current — SBI scalar resolver／UI（PWA v306）

`sbi-balance-adoption.js`は5metricのscope・provider・参照型を検証し、共通判断と旧Input／Stateを一回で解決する。monthly resolver／monthly-display／native Input provenanceは同じ入口を使用し、原Batch集計／Snapshotを別source値へコピーしない。

`scalar-source-selection.js`は口座／target／read-view設定を受けるDOM非依存controller、`scalar-source-ui.js`は小さいrenderer。作成／revision訂正／同revision補正／採用／comparison／deferは既存monthly-source-serviceを使用。全model＋legacy fingerprintを保存直前に再確認し、staleはDraft保持で停止する。source編集中Inputをstorage／BFCacheで再構築せず、source保存で月次flow Draftをclearしない。

SBI CSV保存は仮canonicalへcandidate buildChangesを合成し一回commit。PreviewにもsourceFingerprint guardを渡す。same hash no-op、訂正版は旧record保持、候補だけで採用しない。旧月次フォームは共通採用済みbalance変更を拒否しsource UIへ案内。flow・取引確認統合・Portfolio／Position／Riskの契約は不変。

asset query 20261014-7、PWA v306。Backup v14／既存キー／validator不変。匿名Memory／DOM／localhostで作成・採用・比較・保留・stale・atomic rollback・Backup互換を確認しcleanup。実CSV・production Storage・実データ・実Backupは使用しない。browser一覧が空のため390px／1280px・実Consoleは未実施。

検証：追加86件、全1442 tests Pass。JavaScript構文126ファイル、precache 79資産（重複なし）、production HTMLのJS／CSS 112参照を確認。browser-global module初期化・匿名DOMの明示保存／Draft保持、v14往復・v13互換・rollbackを検証し、diff-checkは問題なし。匿名localhost server／Memoryはcleanup済み。

## Current — SBI VC source adoption UI（PWA v305）

既存月次Inputの小さい折りたたみsectionへ採用操作を追加。controller（source-selection）とDOM renderer（source-ui）を分離し、最終UI overhaulでrendererを交換可能。候補取得／比較はread-only、候補選択はメモリDraft、保存でのみmonthly-source-service.operateへ渡す。source原値を新modelへコピーしない。

保留前に旧互換採用がある場合は同revision／補正の確認採用＋deferを一回のjournalで記録する。採用なしはunresolved。比較だけではadoptionを変更しない。review中のInputを外部更新／BFCache再読込から保護し、古いfingerprintは保存停止、表示と選択を保持する。ユーザーの再確認操作でのみ新guardを取得する。

関連module／CSSはquery 20261014-6、PWA v305へ同期。比較のv14受理契約は変更せず、SBI VC残高状態から期間P/Lを欠損化しない境界のみ整理する。匿名DOM／Memory／browser-global初期化で採用・比較・defer・stale・rollback・Backupを検証する。production／実PDF／実Backupを使わない。

検証：追加51件、全1356 tests Pass。JS構文122ファイル、precache 76資産（重複なし）、production HTMLのJS／CSS 107参照整合、diff-checkを確認。匿名Memory／localhostの検証データ・serverはcleanup済み。computer-useのbrowser一覧が空のため390px／1280px実表示・実ブラウザConsoleは未実施。Backup v14、persistent schema／Storage keyは変更なし。production Storage・実データ・実Backupは未操作。


## Current — SBI VC balance hook（PWA v304）

`monthly-source-service.buildChanges(base, operation, {at,newId})`はStorageを操作しない純粋planner。sbivc-saveはcanonical仮modelからholding set／JPY cash／reported totalの参照candidateを組み立て、最後に一回だけRepository.commitする。別operateによる二段commitは禁止。PreviewのsourceFingerprintを保存直前に再照合し、staleは停止してPreviewを保持する。旧same-hash importを自動migrationしない。

`sbivc-balance-adoption`が唯一の残高採用入口。旧observation-adoptionは内部compatibility、旧Inputの取引active Batch選択は変更しない。旧補正の同source修正・resetはInput監査履歴と共通override判断を同journalで保存し、別sourceを古いフォームから上書きしない。PDF候補追加のみではmanual/common採用を変更しない。本格採用比較UIは後続。

`tests/sbivc-common-balance.test.js`は匿名Memoryで空集合・別source・補正・stale・atomic rollback・v14／v13 restore・非接続eventを検証する。production・実Backupを使わず、依存順序／precache／URLも検証する。金融原値・取引schema・Backupは既存v14内。

検証：追加68件、全1305 tests Pass。JS構文119ファイル、precache 74資産、production HTMLのJS／CSS 105参照整合、diff-checkを確認。匿名Memory／localhost／browser-global初期化のみで検証・cleanup。computer-useのbrowser一覧が空のため390px／1280px実表示・実ブラウザConsoleは未実施。production Storage・実データ・実Backupを操作していない。


## Current — 共通source / adoption（PWA v303）

monthly-source-contract.jsはDOM／Storage／network非依存のvalidator、SHA-256、candidate／legacy adapter、採用／補正resolver、comparison、audit、進捗metadataを提供する。source種類で採用・carry順位を作らない。monthly-source-service.jsの明示注入Adapterをinspect→operateで使用し、inspect.fingerprintを必須guardとして全model＋legacy正本を保存直前に照合する。stale時は保存停止し呼出元Draftを変更しない。

operateのsources／overrides／adoptions／comparisonsと必要な標準Account依存は、一回のRepository commit／既存journalでatomic保存する。全recordはappend-only、登録済み原金融事実は不変。cache削除・再読込検証・rollbackも同じ保護下で行い、rollback不能ならjournal保持。loadだけで新キーを作らず、legacy全件変換なし。

既存broker parser／金融原値／SBI VC補正・訂正／取引確認統合は維持。SBI CSV Previewの全model仮検証だけ新source envelopeを再生成せず既存値／nullで引き継ぐよう対応。PWA v301、変更資産query 20261014-2、precache 73資産。Backup v14は既存10＋新1モデルで、公開済みv1〜v13 schemaは固定。`tests/monthly-source.test.js`は原値保護、採用／defer、stale、履歴欠落、journal／rollback、旧Backup、匿名localhost/subpath・disposable Memory Storageを検証し、server／memoryをcleanupする。本番originへ接続しない。

本格比較／採用Input UI、broker保存接続、完了承認は後続。mutatable Input／Stateの原値を新sourceへ登録した場合も以後その参照原値は上書き不可。後続の訂正は新物理source／独立manual revisionで実装する。暗号資産取引・cashflow／Riskへ今回新契約を広げない。

部分Inputに新しいmetricだけを採用する場合、Traders v2の既知adoptedValuesとSBI v1の既知月次入力を互換adapterで保持する。元Input／Snapshot／Stateは更新しない。source-adapter versionをfingerprintへ含め、PWA v302、resolver／monthly-display query 20261014-3へ同期。上記v301は基盤追加時の記録。

現行v303ではsource adapter v3／resolver query 20261014-4とし、新採用のledger計算で年初基準が不明なら1月だけでなく月途中も停止する。既知flowを消さず、旧legacyには非波及。上記v302は部分Input互換追加時の記録。Backupはv14のまま。

今回の検証：追加102件／全1237 tests Pass。JS構文115ファイル、precache 73資産・HTML URL整合、git diff --check、匿名localhostのv14往復／cleanupを確認。computer-use browserが利用できず390px／1280px実表示・実ブラウザConsoleは未実施（module初期化テストとは区別する）。本番Storage・実データ・実Backupは未操作。

## Current — 共通表示結果と外部変更の再読込

`assets/display-results.js`がperiod dashboard／年間flow／月次表示／比較可否をまとめ、Topと損益管理は同義の主要指標をこの結果から描画する。画面側で同じ金融値を再計算しない。current balanceはoptional factoryで別に生成し、損益管理は呼ばない。年間カードのbasis・口座別sourceMonth・完全性を保持し、比較不能なら増減・率だけ非表示。年初sourceの未入力／null／空欄を旧calculatorの0寄与で隠さず、純資産カード比較を停止する。SMBCの年初評価損益は要求しない。

`assets/display-read-state.js`が読込対象を明示する：tradingData、yearInitialFunds、yearInitialUnrealized、全canonical keys、tradeScopeTradeHistoryV1、tradeScopeSymbolListV1、tradeInfo。storage（clearを含む）とpersisted pageshowで再読込し、Summary／月次／チャートを再描画する。Storage write・全画面reload・デモ投入はしない。不正Storageは未知表示で停止し、初回デモ投入も禁止する。

未保存の口座Draftは口座／月のdirty tokenで従来メモリ値を保持する。外部変更時は正本だけ新しく読み、dirty legacy行を編集用コピーへ残す。cleanなcanonical Draft cacheだけを破棄し、dirty cacheを維持する。現在月に編集があればInput grid全体を再生成しないため、live controlsと保存前の競合検証用sourceを勝手に差し替えない。年初Draftも未保存ならフォームを再描画しない。Summaryは新正本を表示し、Draftを自動保存しない。

`tests/display-consistency.test.js`は匿名read-only Storage、production storage／BFCache handler、月次詳細DOM、比較basis、6口座legacy8月と9月非混入、共通結果の参照identityを検証する。PWA v300、変更資産query 20261014-1、precache 71資産。Backup v13／永続schema／キーは不変。実ブラウザ390px／1280px・Console確認は今回computer-use browserが利用できず未実施（匿名DOM実行とは区別する）。本番Storageは未操作。

**Planned**：正式source／adoption永続基盤は次工程。read-only表示結果に採用判断やmigrationを実装せず、将来同じ採用済み値から共通計算へ接続する。current値と固定月末値の意味差まで同じ数字へ強制しない。

## Current — 残高projectionの責務分離

`balance-view.js`は採用済み観測配列を受けるDOM／Storage非依存の共通処理。出所種別の優先順位を持たずcomponentごとに当月値／直近確認値／missing／明示0を返す。`monthly-display-view.balanceHistory`は既存adoption policyからSBI内訳／口座一括観測を供給する追加read-only APIで、既存dashboard／series／monthlyPnlを変更しない。`current-asset-view` v3はTopだけでこのAPIを受け同じ口座集合を純資産とAllocationへ配る。crypto保有集合は既存latestObservationを維持し、以前の月の採用値だけを参照候補にする。

complete／partial／hasCarried／unknownComponents／currentComplete／monthlyCompleteは別の表示metadata。将来の進捗UIはこの状態と必須項目policyから導出しDOM・文言を判定根拠にしない。fingerprintはprojection version・選んだcomponent／出所・従来正本依存を含む。表示だけで書かず、PDF／CSV／手入力を正式sourceへ統一する永続方式は別工程。

匿名`balance-view.test.js`／`current-balance-view.test.js`でcarry・0・partial・SBI内訳・Traders partial・SBI VC採用／補正／訂正・Storage／Backup不変・期間consumer非波及を検証する。`current-balance-browser.*`は隔離localhost専用でproduction/precacheから参照しない。PWA v299、balance-view／current-asset-view／monthly-display-view／top scriptはquery 20261013-7でHTML/precacheを同期。永続schema／Backup v13は不変。下記v298は比較可否修正時の記録で、現行は本節のv299。

## Current — 純資産カードの比較可否契約

`current-asset-view.js` v3はv2で導入したread-only overlayの`netPeriodComparison`契約を維持し、comparable／理由／口座別current・period source／表示用delta・growthを返す。今回carry／unknownの比較不可条件を追加する。理由は表示用metadataで正本ではなく、Storage・DOM・特定文言に依存しない。Topは比較条件を再実装せずこの2値を描画する。既存dashboardの値は変更しない。将来の全体整合フェーズの範囲と6確認軸はCALCULATIONSへ集約し、UI改修から独立して比較根拠を更新できる構造を維持する。

匿名`tests/current-asset-period.test.js`で完全値・前月完全値・partial・unknown・別月／別年・conflict・観測と期間の根拠差・明示0・負値・UI「—」・既存期間計算不変を検証する。既存のStorage／Backup不変テストも維持。PWA v298、変更したcurrent-asset-view／top scriptだけquery 20261013-6へ更新し、HTMLとprecacheを同期する。

## Current — Top純資産／Allocationの共通資産overlay

`open-positions-view.latestObservation(models, {year})`は省略時の全年横断APIを保持し、年指定時だけ対象年の最新採用Inputを選ぶ。`assets/current-asset-view.js`が採用quantity／marketPrice／marketValueとcashBalance、既知decimal合計、不明成分・観測completenessを返す。旧dashboardを変更せずSBI VCのnet行だけを置換し、同じ口座集合をTop額とAllocationへ配る。純資産カードの取得可否はこのViewで判定し、SBI VC観測しかない場合も表示できる。その他のKPIは旧dashboard、Risk／両Trendは旧topSeries等のまま。

fingerprintはprojection version・選択年・既存dashboard依存・採用source／holdings／cash／overrideに依存する。非永続・read-only再計算、既存storage event／pageshowで更新し、表示で正本を書かない。PWAは上記v298、変更JSのqueryとprecacheを同期。Backup／永続schema変更なし。匿名testsで年切替・訂正・補正・null／0・他口座／期間指標の非波及を検証する。

## Current — Open Positions / Portfolioの保有観測projection

`assets/open-positions-view.js`はRepositoryで検証したmodelsをread-onlyで受け、最新対象月のSBI VC採用Inputを`observation-adoption.resolve`へ渡す。decimal文字列をNumberへ変換せず数量／評価レート／円評価額を表示し、補正後quantityが正の現物だけ返す。legacy SBI VC取引をOpen Positionsの取引nettingから除外し、他口座の既存集計は維持する。観測行は平均取得価格の加重平均や手入力決済へ渡さない。Snapshot／Input／Storage write／Backup変更なし。

共通`latestObservation(models)`が採用sourceの有無・対象月・基準日・補正後cashBalance・正数量holdings・不明数量の有無を返す。既存`resolve()`は現物配列を返す互換APIのまま。`top/script.js`のPortfolio用adapterが同じhelperを読み、SBI VC legacy取引をnetting前に除外し、legacy月次holdingsは使用しない。読込失敗は当該観測だけを停止し、他口座を維持する。現金は別明細、帳票合計／担保評価は不使用。一覧／詳細はdecimal文字列、Chart.jsと表示比率だけNumberへ変換する。不明評価額／数量は「評価額取得分の比率」、詳細の取得原価／評価損益は「—」でRisk値を生成しない。Topの年選択に関係なく最新採用月を使用し、既存canonical storageイベント／pageshowで再読込する。

Portfolio導入時のPWA v296／query 20261013-4から、現行は上記v297の参照へ整合し、indexでは共通採用helperを先にロードする。history.htmlは共有projectionのURLだけ同期し、Open Positionsの挙動は不変。Backup v13／永続schema／保存処理は変更なし。Top純資産／Asset Allocationへの資産接続は上記Viewに限定し、Risk／Transaction History／月次計算には流さない。匿名`tests/portfolio-view.test.js`で採用・訂正・全0・override・decimal・null・現金・比率・年切替・Storage／Backup不変と他口座を検証する。

## Current — 共通取引確認統合

matching／全約定group／確定関係不変・保留再確認／訂正continuityは`assets/transaction-reconciliation.js`、共通logical setは`assets/transaction-view.js`、比較DOMは`import/transaction-confirmation.js`に分離する。GMO／SBI証券／SBI VCのinspectはread-only、save-timeで同じ照合を再実行する。Previewの一時IDではなくsource factsで選択を再照合し、手入力rawの保存前／verification guardとexpectedModelsを使う。source＋関係を同じRepository journalへ入れ、同一hashの関係確認ではsourceを再保存しない。

Backup v13に10番目の正本キーを正式追加。旧recordを変更せず公開済みv1〜v12のvalidation／Restore意味を固定する。PWA v294、変更資産query 20261013-1、共通照合をStorage・view・saveより先に読み込む。PDF.js／parser／月次台帳計算は変更しない。

匿名`tests/transaction-reconciliation.test.js`で1:1／1:N、3選択、訂正・同一hash・曖昧候補・manual変更guard、decimal精度、原本保持、全書込段階rollback／journal、v1〜v13互換／roundtrip、unknown fieldと参照検証、比較UIを確認する。単位不明は候補を作らず、自動推測・migrationを行わない。Position／Risk／Portfolio／Allocationの新consumerは別工程。

**Current / 検証**：既存891件を含む955 tests Pass。匿名localhostで既存Preview／確認UIに合成sourceを注入し、1対4の置換、原manual保持、reload／same-source no-op、同事実訂正後も旧sourceを残した4件表示、両方保持／判断保留を確認。1280px／390pxは横overflowなし。関係／取引をBackup v13へ含むこととlegacy不変を確認し、匿名Storageをcleanupした。実PDF・本番Storageは使用せず、iPhone実機確認とは扱わない。

## SBI VC現物買い取引 / Backup v12（Current）

`import/sbivc-transactions-parser.js`は帳票見出しと列位置で現物買い2行を読む純粋Parser。共通PDF.js／Safari reader／Viewerは変更しない。手数料符号説明と公式IDに対応したsettlement legsを検証し、PIIや自由備考を結果へ渡さない。実帳票で検証済みはspot buyのみで、spot sell／レバレッジ／貸出の推測対応はしない。

`sbivc-save.js`は資産保存と同じRepository操作に必要InstrumentとImportedTransaction v2を含め、expectedModels／journal／全キー再読込でatomic保存する。v1 GMOは維持。SBI VC active sourceはMonthlyAccountInput → AccountSnapshot → Batchで共通transaction resolverが解決し、訂正前recordは残す。manual aggregateと複数fillsの自動統合なし。UIは現物・買・暗号資産単位・精度保持の約定レート・受取＋／支払−の手数料と物理PDFページを表示する。sourceRowは内部認識順で原本行として表示しない。

完全Backup v12は同じ9モデルのImportedTransaction v2を受理し、旧v1〜v11範囲は固定する。SBI VC Input補正v4／採用v3は不変。新取引は月次P/L・外部入出金・Top／Portfolio／Allocation／Riskへ接続しない。cashflow legsから追加取引を生成しない。匿名testsでsigned fee、精度、訂正採用、manual共存、same-source no-op、全依存rollback、旧Backup互換を検証する。実PDFはread-only解析のみ、本番Storage・実Restore・実PDF保存なし。PWA v293、変更資産query 20261012-16、PDF.js資産は不変。

## SBI VC月次PDF資産・保有保存（Current）

**Current — 手動補正**：`assets/observation-adoption.js`がimmutable原本＋疎なoverrideを共通解決し、`assets/observation-override-save.js`がGMOと同じCSV decimal処理／Storage decimal同値比較／Repository expectedModels／journalを使用する。UIは独自Storage writeを持たず、修正・reset・キャンセルは画面内Draft、明示保存だけInput v4へ更新する。holding ID＋Instrument ID＋採用Snapshotで参照を検証し、補正履歴は原本参照＋旧差分を追記する。訂正版PDFではactive補正を空にして新公式値を採用し、旧補正は残す。MonthlyAccountState／取引／損益／下流consumerへ接続しない。Backup v12、旧v1〜v11の検証意味を維持。PWA v293、手動補正資産query 20261012-15は変更なし。

**Current — 補正検証**：既存766＋追加54の全820 testsを検証。匿名localhostの実ブラウザで補正保存／reload／reset／cancel／訂正版／容量不足相当rollbackを確認し、原本不変・State不在・旧補正履歴保持を確認する。PC1280／mobile390は横overflowなし、Console Error／Warningなし。本番Storage・実PDF・実Backupは使用しない。実iPhoneは未確認。

`import/sbivc-parser.js`は位置付きtext itemsの純粋Parser／Validation、`import/sbivc-preview.js`は安全なtextContent表示・選択中止・メモリ解放・確認保存を担当する。既存PDF.js extractor／Safari getReader経路／local workerと共通PDF Viewerを再利用し、新dependency・CDNを追加しない。`import/sbivc-save.js`が保存直前再検証、Instrument解決、same-source検算、訂正guard、全レコードのatomic journal保存を担当する。Inputの`assets/observation-input-ui.js`はMonthlyAccountInput v3／v4の採用先を通常read-only表示し、共通account cardの開閉処理を利用する。初期状態は閉じ、保存済みstatusと観測内容は展開内に置く。開閉状態は永続化しない。PWA v294、observation Input／soneki資産query 20261012-15、変更save／preview資産query 20261013-1、その他資産／PDF.jsは不変。

保存層の`persistableHoldings`で正の保有と、同じ口座の採用済み正の保有履歴に根拠がある明示0だけを選ぶ。ParserはStorageを参照せず全行を保持する。訂正／same-hash照合も同じ選別を使用し、再取込時は採用履歴から保存当時の根拠を再現する。無関係な0についてInstrument／Holdingを作らず、旧データの削除・schema変更は行わない。匿名45行（正1／0が44）、全0、過去保有、訂正、口座分離、no-op、rollback、Backup v10を回帰検証する。

匿名fixturesで複数ticker、長いdecimal、明示0／欠損／該当なし、報酬対象月、入出庫、レバレッジ観測、PII除外、wrong provider、破損表、中止／closeを検証する。保存は匿名localhostだけで検証し、実PDFはローカルread-only Parser／保存plan確認のみ。現物買いだけ実帳票検証済みとし、未検証取引・建玉・貸出のParser完成と報告しない。月次計算・legacy履歴・Riskは不変。

**Planned**：現物売り等の未検証行のsource validation、共通crypto cashflow／月次P/L、暗号資産partial projection。原PDF／全文／PIIの保存は行わない。最新Backup v13は旧観測採用Input v3／補正v4と取引v2を正式受理し、旧versionの検証意味を固定する。

**Current / 検証**：既存746件を含む761 tests Pass。匿名localhostでfixtureを注入した既存Preview／保存UIから、45行のうち1保有保存・reload・same-source・同月正→0訂正・再取込no-op・cleanupを確認。保存層のrollback／Backup v10 roundtripも回帰検証。PC1280／mobile390は横overflowなし、最終確認でConsole Error／Warningなし。実PDFはread-onlyで45行（正1／明示0が44）を維持し、空のregistryを想定したメモリ上の選別でInstrument 1／Holding 1となる。実値の保存・fixture化は行わない。実iPhoneの保存操作は未確認。

## Current — 共通取引source基盤

**Current — GMO旧取込の明細補完**：`gmo-save.js`のinspectは非破壊。完全一致する一意Batch・明細0件・再解析／原観測照合成功時のみ`backfill-ready`を返し、UIの「取引明細を追加」確認後に同serviceが再検証する。通常取込と共通のInstrument依存補完・取引生成を使用し、必要Instrumentと全取引を一回のjournalで保存する。月／backfill専用の銘柄identityは作らない。既存月次正本・Top cacheは不変。partialな既存明細は停止、全件一致はno-op、別hashは既存訂正経路を維持する。匿名テストで選択／キャンセル非破壊、再取込、曖昧照合、失敗rollback、訂正原値維持、v9 roundtripを検証する。PWA v284、GMO save／preview queryは20261012-7。

`assets/transaction-view.js`はDOM／Storage非依存の表示resolver。legacy manual、SBI raw、新ImportedTransactionsを読み、adopted Snapshot→ImportBatchでactive GMO sourceを選び、latest importedAtを正本にしない。曖昧dedupeは保持する。新RepositoryキーはtradeScopeImportedTransactionsV1、Backup v9／旧1〜8互換／同一journal・rollbackで保護する。画面読込からseed・Migrationしない。月次calculatorとRisk sourceは変更しない。新取引Viewは共通履歴UIからのみ使う。

**Current — 履歴UI**：`history/transaction-ui.js`は安全なtextContentでコンパクトな一覧を描画し、1件のみ展開する。詳細DOMは展開時だけ生成し、閉じた時に破棄する。絞込後50件、「さらに表示」で50件追加し、追加時は開いていた1件を維持する。`assets/transaction-display.js`にbroker Lot size／単位確認／精度を落とさない表示計算／原source金額参照をまとめ、共通resolverとdedupeは変更しない。FXはquote通貨付き「約定レート」と原価格精度を維持し、日付のみのsourceに時刻を生成しない。詳細は取引／監査の2区分とし、Lot・通貨数量を統合、GMOの内部明細順は原本行として表示せずPDFページだけ、SBIは保存済みCSV物理行を表示する。詳細filterはnative detailsに収納し、閉じてもselect値・適用数を維持する。`history.js`のread-only読込、旧parseEntries／Open Positions／manual編集・履歴部分Backupは維持し、取込編集やRisk接続を追加しない。匿名2,000件／月500件、DOM50件、PC1280／mobile390、Consoleと正本不変を検証し実iPhoneとは区別する。PWA v286、display／transaction-ui／history CSSはquery 20261012-9でHTMLとprecacheへ同期する。

## Traders Storage / Backup v8

**Current — GMO取引抽出**：`import/gmo-transactions-parser.js`は見出し／正式ヘッダー由来の列境界で明示約定だけを返し、`gmo-parser.js`の月次計算は変更しない。決済詳細は注文番号＋日時＋ペア＋売買＋数量＋価格が双方一意の時だけ結合する。全決済P/L coverageが揃う場合だけ公式月次と照合し、不一致はaudit警告、月次値の補正はしない。構造不明は取引保存を停止する。実PDFはread-only parser確認のみ。匿名fixturesとatomic失敗／訂正／旧同一hash no-opテストで検証する。

**Current / UI**：`import/traders-preview.js`は口座別PDF Previewとcalendar入力を担当し、保存は`import/traders-save.js`だけを呼ぶ。blankでもPDF-only partial保存可能。`assets/traders-monthly-ui.js`は保存済みPDF源をread-onlyで表示し、非永続Draftのcalendar後入力・5項目訂正を同serviceへ渡す。成功はRepository再読込検証後のみ。legacy Inputへの混入・cutover後legacy保存は拒否する。PWA v280、今回変更資産のqueryは20261012-2。匿名localhostで1280／390幅・保存・reload・再取込・Backupを検証する。実iPhoneは別途必要。

**Current**：`import/traders-save.js`は商品別口座を固定し保存直前に再検証する。一回のRepository commitでAccount遅延生成／FX Instrument再利用／Batch／観測／建玉群／MonthlyAccountInput v2／完全時だけState／cache無効化を保護する。blank swapはnull、exact hashはpartialでもno-op。後入力は保存済みInputのPDF採用先を利用し再選択不要。別hash訂正はInput／State／採用Snapshot／calendar採用値の確認一致後だけ新PDF sourceを追記する。calendar原入力・採用値はPDF訂正と独立し、complete後の手修正・reset・原値保護を維持する。Backup v8、旧v1〜v7受理範囲固定。Risk sourceは変更しない。

## Traders Securities monthly PDF

**Current**：`import/traders-parser.js`は商品別detector／mappingと共通の位置付きテキスト解析を提供する。ファイル名・PIIを判定根拠にしない。回転ページの抽出座標を読み方向へ補正し、公式PDF.js 6.4.299のUniJIS-UCS2-H CMap（25,439 bytes）を追加。getReader／local worker／公式fake-worker／safe stageは維持し、CDN・別PDFライブラリは追加しない。

## Current — 部分取込の表示層

`assets/monthly-display-view.js`はDOM／Storage非依存で、Top・年間Summary・口座配分へ同じ`dashboard`結果、Asset／Performance Trendへ月時点の同じprojection、Monthly P/Lと年間内訳へ既知値集計を返す。画面側で金融値や成長率を再計算しない。canonical ledgerは厳密なまま保持する。部分取込を旧Snapshotキャッシュから取得しない。正本変更時のstorage eventと再表示で再計算し、fingerprintに未採用観測とprojection versionも含める。

`tests/monthly-display.test.js`は匿名のGMO完全／SBI部分／旧月口座、nullと0、複数候補、指標別sourceMonth、無書込、canonical回帰を検証する。`tests/monthly-display-browser.*`はlocalhost専用の架空Storageとcleanupであり、production導線／precacheには含めない。実金融データ・実Backupを使用しない。

## Current — Inputレイアウト統一と手修正境界

Inputは口座カード内に青い全幅「保存」を置き、global保存は廃止する。legacy編集は`legacyInputData`の非永続Draftで、`assets/legacy-monthly-save.js`が最新Storageから対象口座だけを差し替える。既存month.__savedは維持し、今後の保存は口座row.__savedで明示0の証拠を付ける。他口座Draftを混入させず、expectedRow・journal・再読込検証・cache無効化で保護する。GMOは`assets/gmo-monthly-ui.js`から既存手修正serviceへ接続し、5項目編集と小さな「取込値に戻す」を提供する。SBIは既存保存serviceを維持し、swap欄なし、口座全体の既知評価値と初期折りたたみ「資産内訳」を表示する。国内評価額・評価損益もDraft、取得日はread-only。独立した「取込済み」行・個別銘柄一覧は置かない。

**Current**：`assets/gmo-monthly-save.js`は初回明示編集だけv3化し原値5項目と採用値の差分metadataを保存する。原Snapshotは更新しない。GMO Inputはこのserviceだけを呼び、expectedModelsとjournalによるState＋cache無効化／再読込一致後に表示を更新する。未編集保存は無書込。取込値へ戻す操作はまずDraftだけを更新し、明示保存で採用値を戻す。Backup v8、旧v4〜v7範囲固定、v1〜v8／rollback／PII拒否を匿名fixtureで検証する。

## Current — GMO月次取込の完成範囲

口座保存は各カードの「保存」を明示クリックしたときだけ実行する。GMO・SBI・legacyとも追加のネイティブ確認ダイアログを挟まない。空欄、stale data、quota等の検証をserviceで行い、他口座は書き換えない。取込／訂正や削除の既存確認とは別責務である。

`import/gmo-parser.js`は帳票判定とallowlist出口、`import/gmo-preview.js`は選択・Preview・確認、`import/gmo-save.js`は取込保存／明示訂正を担当する。Input手修正は別のgmo-monthly-save serviceで原Snapshotを保持する。画面側に独自Storage writeや金融計算を置かず、全画面で共有resolver／表示projectionを使用する。PDF保存だけでlegacy monthly・履歴を変更しない。

PDFの読み取り検証とlocalhost／匿名操作を用い、実PDFはparser-onlyのローカル確認に限定する。`tests/gmo-*.test.js`とPDF／PWA integrity testsを既存全テストへ追加する。`tests/gmo-browser-smoke.html`はlocalhost専用の匿名fixture／状態確認／cleanup／ローカルPDF解析用で、production画面・precacheから参照しない。実iPhone PWA、他社帳票、OCRは未確認／未対応である。

## Current — GMO parser / Preview

共通extractorの位置付きtext itemsをGMO固有parserで読む。ページ番号に依存せず帳票・見出し・ヘッダー位置を確認する。parserの出口は金融値と対象月・月末日だけのallowlistであり、入出金明細末尾の日付／両替レートなしの区分別小計は明細との検算に使い、二重加算しない。実PDFはローカル読み取り検証だけに使用し、テストは架空の金額と構造で実施する。GMO保存は専用serviceで明示確認後に行う。

**Current / 共通PDF基盤**：PDF.js 6.4.299 legacyのmain／local workerと実帳票で必要だった日本語CMap三つを固定vendorし、公式SHA-256を照合した。LICENSEを保持する。`import/pdf-extractor.mjs`の共通document loaderを抽出と原本Viewerで共有し、同一worker／CMap設定を使用する。抽出はページ番号・文字列・位置だけを一時メモリへ返し、broker解釈・描画・保存・外部送信をしない。20MB／100ページ／150000 item上限と中止・worker cleanupを持つ。CSPは同一origin静的資産とworkerのみ許可し、unsafe-eval／CDN／WASMを使わない。オフラインnavigationは要求されたキャッシュ済みページを先に返す。実iPhone未確認。

**Current / Safari互換修正**：`getTextContent()`内部のStream非同期反復を使わず、同じ公開`streamTextContent()`を`getReader().read()`で読み取る（[PDF.js公式issue #20973](https://github.com/mozilla/pdf.js/issues/20973)）。通常のmodule workerとPDF.js公式fake-worker fallbackは維持し、UA分岐・global polyfill・vendor改変を行わない。worker readiness・document load・text extractionを分離し、中止／終了時にreader・page・task・workerを解放する。

読み取り失敗はfile／engine／worker／document／text／GMO detector／parser／validation／保存前確認を区別する固定codeと短い文言で表示する。診断は画面内のstage／codeのみとし、例外message・stack・PDF本文・PII・URLを出力／保存しない。金融Parser・保存・Backup仕様は変更しない。実iPhone Safari／PWAでの修正後確認は別途必要。

**Current / resolver基盤**：口座policyとadapterを分離し、画面別broker計算を追加しない。SBIは従来結果を維持し、GMOも2026-09からproduction計算で有効。State・採用Snapshot・関連Batch・policy versionをfingerprintへ含める。

## 月次schema互換（Current）

汎用採用参照はMonthlyAccountState record v2、envelope v1、Backup v4とする。v3の旧record Validatorを固定し、Repository拡張で旧Backupの受理範囲を広げない。GMO PDF取込・保存・集計は実装済みであり、既存SBI接続は維持する。

**Decided**：銘柄表示名更新はstable ID／code／tickerと分離する。現在保有の表示名は更新可能、過去取引の名称は当時表記を保持し、名称変更だけのInstrument増殖・履歴上書きを行わない。

## 1. 現在の技術構成

**Current**：

- HTML5
- CSS
- Vanilla JavaScript
- Chart.js CDN
- Google Fonts
- Web App Manifest
- Service Worker
- `localStorage` / `sessionStorage`

npm、bundler、フレームワークは現在導入されていない。CSV基盤の匿名テストは開発環境のNode.js標準テストランナーを使う（アプリ実行時には不要）。

## 2. ディレクトリ構成

```text
TradeScope/
  index.html                 Top dashboard
  history.html               Transaction History
  import.html                SBI domestic CSV preview and confirmed save
  import/                    CSV grammar, SBI adapter, preview UI
  tests/                     Anonymous dependency-free CSV tests
  top/                       Top JS/CSS
  profit/                    Profit management
  history/                   History page JS/CSS
  assets/                    Shared logic, UI, images
  service-worker.js          PWA cache
  manifest.webmanifest       Active manifest
  docs/                      Product and development specifications
```

## 3. 起動と公開

**Current**：ビルド工程はなく、リポジトリルートを静的HTTPサーバーで配信する構成である。

**Current / Confirmed**：現在はGitHub Pagesで [https://naoya-koba.github.io/tradescope-app/index.html](https://naoya-koba.github.io/tradescope-app/index.html) を公開している。`localStorage`のWeb originは `https://naoya-koba.github.io` である。

**Current / Confirmed**：主な利用形態は、iPhoneのホーム画面に追加したPWA / Web Appである。

**Current**：リポジトリ内に、GitHub Actions等の明示的なデプロイworkflowは確認できない。これは現在GitHub Pagesで公開されていないという意味ではない。

**Unknown**：GitHub Pagesの公開元branch / folder等のリポジトリ外設定、実際の更新手順、ローカル確認に通常使うサーバー、利用中の正確なSafari / WebKitバージョンは未確認である。

**Decided**：公開方法を変更する際は、`localStorage`のオリジン変更とPWAキャッシュへの影響を調査し、事前バックアップを行う。

**Data protection note**：iPhoneのホーム画面Web Appと通常のSafariでは、同じURLでもストレージが分離される可能性がある。データが見えない場合は初期化せず、どちらで利用・保存したかを確認する。

## 4. 作業フロー

1. `git status --short --branch`で開始状態を確認する。
2. 対象機能のHTML、画面JS、共有JS、保存キー、バックアップ処理を横断調査する。
3. CurrentとDecidedの差を確認する。
4. 変更目的と影響範囲を限定する。
5. 必要なら後方互換・マイグレーションを先に設計する。
6. 小さな単位で実装する。
7. 関連計算と既存データ読込を検証する。
8. `git diff --check`、`git diff`、`git status`を確認する。

## 5. データ安全

- 実ブラウザの`localStorage`を開発・テストで初期化しない。
- 削除ボタンや初期化処理のテストは、隔離したオリジンとfixtureで行う。
- 新しい保存形式は旧形式を読み込める状態で導入する。
- 保存前に入力を正規化しても、意味の分からない値を黙って捨てない。
- migration前後の件数、ID、金額合計等を照合できるようにする。
- importは全検証成功後に適用する。

## 6. データアクセスとインポート境界

**Decided**：新しいAccount、Instrument、AccountInstrumentSetting、RawTransaction、TransactionAnnotationは、画面から`localStorage`へ直接アクセスせず、Repository / Storage Adapterを介して扱う。

**Decided**：Entity IDは表示名、配列位置、providerCodeから独立したstable IDとする。保存形式には`schemaVersion`を持たせ、JSON export/importと将来の保存先変更を可能にする。

**Decided**：インポートは`ImportBatch → ImportRowDraft / Preview → ユーザー確認 → RawTransaction`の境界を守る。未解決行、検証警告、重複候補はRawTransactionへ確定保存する前に扱う。

**Decided**：CSV等に存在しない値を推測してRawTransactionへ埋めない。数値の欠落を`0`へ変換せず、原資料に存在するdecimal値の精度を早期のJavaScript変換で失わない。

**Decided**：取引事実とTransactionAnnotation等のユーザーメタデータを別Repositoryで扱い、再インポートで後者を消去しない。

**Planned**：localStorageを最初の保存先として使う場合も、RawTransaction増加時の容量を計測し、Repositoryを介してIndexedDB等へ移行可能にする。CSV MVPで全面移行は行わない。

**Current**：`assets/data-model-storage.js`がAccount、Instrument、ImportBatch、RawTransaction、HoldingSnapshot、AccountSnapshot、MonthlyAccountState、MonthlyAccountInputのschema検証・Repository・注入式localStorage Adapterを提供する。module読込・Repository生成・readでseedやMigrationはしない。具体的なallowlist・参照制約はコードと`DATA_MODEL.md`のCurrentを参照する。

**Current**：`assets/storage-transaction.js`は複数キー保存、再読込一致確認、生文字列rollbackを共通化する。中断journalがあれば保存を拒否する。最新完全バックアップv10は9collectionを保護する。v1は9キー維持、v2は6collection復元＋Stateと新Inputクリア、v3〜v5は公開済み7collection復元＋新Inputクリア。各versionの受理範囲を固定する。

**Current**：SBI Previewと保存可否判定は新Storageを読み取り専用で参照する。確認後保存だけを既存保存serviceへ接続する。UI独自のRepository commitやStorage writeは設けない。Summary / Asset Trend / Risk / 月次入力判定のデータ源も変更しない。

**Current**：`import/sbi-save.js`の保存エンジンは1ファイルずつ処理し、既存Preview resolverとRepositoryを再利用する。Adapter・clock・cryptoを注入でき、module読込・構築・read・inspectではseedしない。保存時のみAccountを必要に応じて追加し、既存Account／Instrumentは上書きしない。重複・競合・不正／要確認があれば全ファイルを停止する。取込UIは同じ検証の`inspect`で事前判定し、確認モーダル後に`save`を呼ぶ。

**Current**：Repositoryの`commit(changes, {expectedModels})`は非同期判定中の変更を検知する。journal保護中にbyte一致確認に加え全モデル再読込・schema／参照・期待内容一致を検証し、失敗時は同じrollbackを行う。v1復元の既存維持仕様は変更しない。完全排他ではなく、タブ競合・Storage障害の既存限界を保持する。

**Known issue / Planned**：journalも含むlocalStorage容量を計測し、将来のIndexedDB移行と複数タブ排他を別途設計する。保存権限喪失等でrollbackまで失敗した場合、Web Storageだけで完全復旧は保証できないためjournalを保護して新規保存を止める。現在の同期Adapterを非同期DBへ移す際はRepository APIも調整する。

### 月次正本の実装境界

**Decided / SBI月次確定**：2026-08以前・他口座は従来計算を維持する。2026-09以降のSBIは共有resolverのmissing／conflictを含む判定だけを用い、legacy placeholderへ戻さない。必要入力が完全な場合だけUI保存を許可し、null許容schema自体は変更しない。

**Current**：`assets/monthly-account-resolver.js`と`assets/sbi-monthly-save.js`を追加。後者はAccountSnapshotとMonthlyAccountStateを一回の既存Repository transactionで保護し、採用国内データの再検証・expectedModels・訂正履歴保持を行う。Repository／Backup schema変更、Migration、seedはない。`tests/sbi-monthly.test.js`はcutover、legacy conflict、completeness、欠損伝播、訂正、atomic保存・失敗rollback、canonical fingerprintを匿名fixtureで確認する。`assets/sbi-monthly-ui.js`は保存serviceを通して確定し、Input／Summary／Top／Trendを同じ共有計算へ同時接続する。匿名テストで保存・訂正後のv3往復とUI状態遷移も確認する。

**Decided**：MonthlyAccountStateは観測Snapshotと分離した口座・月の明示確定記録とする。共通Repositoryへ統合し、7モデルを保護するBackup v4、version別Validation、journal／rollbackを先に検証する。v2は6モデル形式を固定し、v2 Restore時のStateクリアも同一transactionに含める。v1／Legacy RestoreではStateを維持する。

**Current**：MonthlyAccountStateのStorage・検証・Backup v4への統合は完了。`assets/sbi-input-draft.js`はread-only Repository経由でSBI国内保有の候補を読み、既存CSV共通処理のdecimal加算を利用する。Inputの新方式SBIだけを月別の非永続Draftへ分離し、国内値を安全なDOMプロパティでフォームへ表示する。候補Batchを合算・latest自動採用しない。表示・月切替・Draft編集では金融Storageとlegacyメモリを変更せず、既存月次保存からもDraftを除外する。2026年1〜8月はlegacyを維持し、9月以降のSBIは未取込でも新方式Draftとする。国内採用値・入力済み外国証券／現金manualは口座内で明示保存し、全必須値が揃った場合のみ月次状態を更新する。集計は共有計算へ接続し、旧月次へのコピーは行わない。

**Decided**：表示・read・初期化でseedしない。Input Draftはメモリ上に分離し、明示保存でのみMonthlyAccountInputと入力済みmanual AccountSnapshotを更新し、必要値が揃う場合だけ月次状態を更新する。国内値の表示・partial採用値保存だけを月次確定や台帳更新と混同せず、legacy monthlyへコピーしない。既存台帳式を維持し、観測Viewから差額損益を逆算しない。schema・一意性・参照・null／0・version別復元・新キー途中失敗／再読込不一致／rollback不能を匿名fixtureで検証する。

## 7. Importerのセキュリティとプライバシー

- **Decided**：PDF / CSVは原則としてブラウザ内で解析し、原本を外部サービスへ送信しない。
- **Decided**：PDF / CSV原本を`localStorage`、IndexedDB等へ永続保存しない。
- **Decided**：PDF全文、CSV全文、解析前の全行を保存しない。
- **Decided**：氏名、住所、口座番号、ユーザーID等、取引・資産管理に不要な個人情報を保存しない。
- **Decided**：永続化する`rawFields`はallowlist方式とし、必要な取引・保有事実だけを選択して保存する。
- **Decided**：ファイルの絶対パスを保存しない。出典追跡に必要なファイル情報は、個人情報を含まない名称、hash、サイズ、更新日時等のうち必要最小限へ限定する。
- **Decided**：実データ、実PDF / CSV、解析結果をGitHubへcommitしない。
- **Decided**：consoleへ実ユーザーデータ、PDF全文、CSV全文、raw rowを大量出力しない。
- **Decided**：エラー表示、例外、診断ログへ不要な氏名、口座番号、残高、取引明細等を含めない。
- **Decided**：Importer用の外部ライブラリまたはCDNを追加する場合、機能・容量だけでなく、配布元、固定バージョン、改ざん対策、オフライン動作、供給網リスクを確認する。
- **Decided**：将来cloud syncを導入する場合は、ローカル保存の延長として扱わず、認証、認可、アクセス制御、通信・保存時暗号化、鍵管理、削除、監査を別途設計する。

**Planned**：Parserは原本から必要なallowlist項目だけをImportRowDraftへ抽出し、ValidationとPreview完了前には正本Repositoryへ書き込まない。

**Decided**：Parserはファイル内の正式な基準日・基準日時と、その取得根拠を優先して抽出する。日時がない場合、`File.lastModified`等を候補として提示してよいが、ユーザー確認なしに観測日時として確定しない。架空の時刻・タイムゾーンも補完しない。

**Decided**：内部モデル名、`targetMonth`、`snapshotAsOf`、provenance、月末性判定等を通常UIの説明文へそのまま露出させない。画面側は対象月、主要な金融数値、必要時の短い基準日・警告だけを表示する。

### SBI国内CSV Preview基盤

**Current**：主要3画面のハンバーガー「データ取込」と損益管理Inputの共通ショートカットから`import.html`を開く。ボトムナビは変更しない。既存の損益・履歴・バックアップモジュールはこの画面に読み込まない。確認前のPreviewは非破壊で、保存は既存serviceに限定する。閉じる・ページ離脱時にメモリ上の候補と明細DOMを破棄する。

- `import/csv-core.js`：引用符、escaped quote、値中カンマ・改行、CRLF / LF、BOMを扱うCSV解析。ブラウザ標準`TextDecoder`でUTF-8を検証後、失敗時にShift_JIS（ブラウザのCP932系対応）を試す。手動指定も可能。UTF-16には未対応。
- `import/sbi-parser.js`：明示した日本語ヘッダーだけを照合し、allowlist項目の一時Preview Rowを生成する。未知列・前書き・ファイル名・個人識別情報を中間データへコピーしない。ヘッダーを曖昧補正しない。Parser versionは一箇所に定義し、解析結果からBatchの`importerVersion`へ引き継ぐ。仕様変更時はこのversionとPWA資産URLを更新する。
- `import/model-preview.js`：Parser結果と明示した対象月・観測日をImportBatch / Instrument / HoldingSnapshot / RawTransactionの一時候補へ変換する。SBI Accountは未保存でもseedしない。コード一致を優先し、コードなしSBI投信は出所・商品区分・正式名の完全一致で共有／再利用する。`投信金額買付`の完全一致だけを一箇所のmappingで投資信託へ分類し、保有CSVを必須にせず、原文の取引区分を保持する。未知の区分や類似名を推測分類しない。Instrument未解決の約定も取引事実DraftとしてPreviewに残し、解決状態・保存可能性を分離する。未確認の出所、曖昧一致・重複候補は自動統合せず、未解決・不正行は保存可能候補からのみ除外する。Storageのrecord・参照検証を再利用し、保存日時はDraftに含めない。既存のflat HoldingSnapshot集合は共通Batch・口座・月・日時・取得範囲とBatchのsourceTypeで一観測として扱い、保存schemaを変えない。株式系の細分類不明は候補の`subtype: null`とし、上位分類が分かる行まで除外しない。
- 「保存予定内容」は件数・対象月・取得日・必要な注意だけを表示し、候補明細は任意展開とする。Parser取引件数と、要確認も含む取引候補件数・保存可能件数・要確認件数を区別し、要確認がある場合だけ追加件数を表示する。同じ種類の注意はまとめ、内部ID・JSON全文を表示しない。2種類のCSVを同じsessionで確認でき、両方の件数を同時表示し、詳細は切り替える。指定した日付は切り替え時と同一hashファイルの再選択時だけ維持し、別ファイルへ引き継がない。閉じる・会社を閉じる・文字コード変更・離脱で両方破棄する。非同期処理の完了が閉じたPreviewを再表示しないようtokenを確認する。
- `detectKind()`は同じヘッダー定義を使い、保有証券／約定履歴の必須明細ヘッダーが揃うかを確認する純粋関数。種別不一致・不明・両形式の混在はPreview前に止め、保存へ進めない。ファイル名やタイトルだけで推測しない。
- 会社選択はネイティブの`details`による同画面内展開。SBIを閉じると一時Previewを破棄し、読み込み途中の結果も採用しない。未対応会社は無効な「準備中」表示のみ。PCはCSV選択を2列、スマホは縦積み・明細の項目別表示とし、safe-areaとreduced-motionを考慮する。
- 数値はdecimal文字列、空欄は`null`。合計はdecimalの桁合わせとBigInt加算で検算する。CSV合計行と明細の値を勝手に補正しない。問題行を除く集計には注意を表示する。
- 保有証券の必須ヘッダーは銘柄、数量、評価額。約定履歴は約定日、銘柄、取引、数量、単価（内部モデル名は`transactionType`）。欠落・重複ヘッダーはError、不正値・必須値欠落は行Error、未知列・合計不一致はWarning。正常な任意項目の空欄・`--`は`null`とし、不要なWarningを出さない。正常行と問題行を明細で分けて確認できる。
- 実ファイルで確認した保有証券形式は複数セクションで、商品・預り区分は見出しから取得する。株式の`銘柄名称`、投信の`ファンド名`、特定・NISA成長／つみたて投資枠に対応する。別ブロックの`評価額合計` / `評価損益合計`を同じ区分の明細と照合する。`売却注文中`の空欄や投信のコード欠落は正常である。
- 投信の`保有口数`の末尾`口`は数値と単位に分離し、原表記は一時`rawFields`へ保持する。価格当たり口数の推測換算はしない。符号・末尾空白・小数を扱う。
- 約定履歴の前置きから、明示された検索期間・明細数・明細指定範囲だけを抽出する。ページ分割時は明細指定範囲の件数、範囲がなければ明細数と実行数を検算する。検索期間と実際の約定期間は区別し、検索期間を保有の観測日にはしない。`銘柄` / `取引` / `預り` / `手数料/諸経費等` / `税額` / `期限` / `課税`を明示照合する。商品区分・注文種別の列がないことや、投信のコード・市場空欄は異常としない。
- `受渡金額 / 決済損益`は`settlementOrPnl`として保持し、実現損益へ変換・合計しない。原資料の列名もallowlistの`sourceHeaders`で保持する。数量の単位や投信の価格当たり口数を推測して換算しない。
- `基準日` / `基準日時`の明示行は4桁年の日付・日時を取得する。時刻・タイムゾーンがなければ追加しない。日時がない場合は取得日をユーザーが指定する（`File.lastModified`を確定値に使わない）。対象月は別の一時選択値で、既存月次へ反映しない。
- 描画は`textContent`、10MBまでのファイル、明細は100行ずつ表示。CSPはPDF補助資産用に`connect-src 'self'`へ限定し、外部接続は許可しない。新画面のアセットは同一originのみ。公式取得案内リンクはユーザーが開いた場合のみ別タブへ移動する。

**Current**：上記のコードなしSBI投信の正式名identityは、比較時のみJavaScriptの`\s`に該当する空白差を除いた完全一致とする。共通resolverでPreviewと保存直前の再照合を揃え、原表記を保持する。空白以外の曖昧一致や複数既存IDの自動選択、既存重複のmigrationは行わない。

**Current / 検証**：`node --test tests/sbi-import.test.js tests/sbi-model-preview.test.js`で架空の最小CSVとDOM harnessを使う。読み取り専用Storageを注入し、storage書き込み・送信・console APIに接続したら失敗するテストを含む。両CSV変換、null / 0、日付分離、銘柄照合・曖昧一致、重複候補、参照検証、PII項目除外、候補表示と破棄、既存月次状態不変を確認する。実ブラウザでの実ファイル確認とは区別する。

**Current / Storage・復元検証**：`node --test tests/*.test.js`で匿名Storageの往復、decimal、quota／journal／rollback、v1〜v8互換、未知field／version、PII拒否を確認する。gmo-monthly-override／gmo-monthly-ui／account-monthly-save testsで原値保護、未編集v2不変、初回昇格、採用値反映、口座単位保存と他Draft非混入を確認する。実Storage・実CSV・実Backup・本番PWAに接続しない。

**Current / 保存エンジン・UI検証**：`node --test tests/*.test.js`は`tests/sbi-save.test.js`も含む。匿名Adapterで遅延追加・再利用、file単位保存、重複停止、quota／journal失敗、再読込検証、rollback、最新v10 export／restore、v1互換、旧月次非変更を確認する。DOM harnessで保存表示条件、確認・キャンセル、検証完了後の保存済み表示、連打防止、再読込後の判定と導線を確認する。UI接続の実ブラウザ検証には隔離localhostと架空CSVだけを使用し、実CSVを保存しない。

**Current / 実形式検証**：ローカルに残っていた保有証券一覧・約定履歴の2ファイルをリポジトリへコピーせずread-onlyで解析し、Shift_JIS系デコード、日本語ヘッダー、セクション別合計と明細件数の一致を確認した。両ファイルはError / Warningなしで解析できた。実データはfixture・ログ・storageへ複製していない。テストには公開ヘッダー構造だけを用い、全明細値を独立した架空値で作成する。

**Under consideration / Known issue**：確認済み2ファイル以外のSBIダウンロード形式・文字コード・区分の全網羅は未確認。年2桁の日付の根拠は未確定であり、世紀を推測しない。銘柄とコードが一つのセルに併記される場合はその文字列を保持し、コードを推測分割しない。未知商品・区分行は黙って国内合計へ混ぜない。匿名localhostの実ブラウザで保存・再読込・競合停止とPC／スマホ幅を確認した。OSのファイル選択画面および実機iPhone PWAでの操作は別途確認する。

**Known issue**：内蔵ブラウザの画面遷移で`ViewTransition opt-in disabled`が断続的に記録された。取込画面にも既存の共通遷移CSSを読み込むが、発生条件の全解消は未確認。遷移・保存操作は完了し、保存処理中のJavaScriptエラーとは区別する。

**Planned**：追加形式と実機での対応範囲をプライバシー保護下で検証する。対象月末と取得日の乖離警告の閾値は未決定であり、近似値を正式月末値へ昇格しない。実データ初回保存前のバックアップ取得は運用手順で扱い、通常のCSV保存ごとに案内を増やさない。

## 8. 共通計算の実装方針

**Decided**：次の計算を画面ファイルから共有計算層へ集約する。

- 確定資産
- 純資産
- 年間損益・成長率
- Monthly P/L
- Asset Trend Asset / Performance
- Position reconstruction
- Asset Allocation
- Swap集計
- Risk

共有計算関数は、DOMや`localStorage`を直接参照せず、明示的な入力を受け取って結果を返す純粋関数を優先する。

```text
storage/import adapter -> normalized model -> shared calculations -> page rendering
```

画面固有コードは、データ読込、ユーザー操作、表示形式に限定する。

## 9. 状態とキャッシュ

- 正本データ更新時に派生キャッシュを無効化する。
- Snapshotやキャッシュは、複数画面で同一の共通計算結果を利用する実装手段として使用できる。廃止を前提としない。
- キャッシュには元データのrevisionまたはhashを関連付ける。
- キャッシュが欠落・破損しても元データから再生成できるようにする。
- キャッシュ値を正本へ逆流させない。

**Current**：Top Summary Snapshotは対象年の正本データfingerprintと最新入力済み月を保持し、トップ表示時に両方を照合する。不一致またはfingerprintを持たない旧Snapshotは利用しない。

## 10. テスト方針

**Planned**：ビルドシステム導入とは独立して、まず共有計算の自動テストを用意する。

優先テスト：

1. 確定資産・純資産
2. 入出金を除く年間Performance
3. Monthly P/L
4. Asset TrendのTop／損益管理一致
5. Position reconstructionと部分決済
6. contractSizeと通貨単位
7. 耐性基準時損失・最大損失・状態境界
8. バックアップ旧形式の読込
9. migrationの再実行安全性
10. ImportRowDraftの検証完了前にRawTransactionが保存されないこと
11. 同一CSV再取込、external transaction ID、row fingerprint、曖昧な重複候補
12. decimal文字列、`null`と`0`、日付のみ、タイムゾーン不明の保持
13. 再インポート後もTransactionAnnotationが維持されること
14. `targetMonth`、`snapshotAsOf`、`importedAt`が混同されないこと
15. Import値と手入力値が黙って二重計上されないこと
16. PDF / CSV原本、個人情報、非allowlist列が永続化・console出力されないこと
17. v1復元がHoldingSnapshot、AccountSnapshot等の新モデルを削除しないこと
18. 一つのSnapshotへ異なる取得元が黙って合成されず、口座全体表示が派生Viewとして生成されること
19. ファイル内基準日を優先し、日時欠落時の`File.lastModified`がユーザー確認なしに確定値にならないこと
20. 正式月末Snapshotと対象月へ採用した近似Snapshotを区別し、近似値を無条件に月末確定値へ昇格させないこと

fixtureは匿名の最小データを新規作成し、実ユーザーデータを使用しない。

## 11. 外部依存

**Current**：Chart.js、Google Fonts、Google News RSS、AllOrigins、rss2json、MyMemory Translationに依存する。

**Known issue**：トップはChart.js 4.4.1固定、損益管理はバージョン未固定である。

**Planned / Development guidance**：Chart.jsの画面間バージョン差異を解消する。特別な互換性理由がない限り、検証済みの同一バージョンへ揃えて固定することを推奨するが、これは現時点でユーザー決定済みの製品仕様ではない。採用バージョンと更新方針は実装時に決定する。

外部APIが失敗した場合、取得失敗を明示し、金融数値のダミー値へ置き換えない。

## 12. PWA

**Current / PDF原本Viewer**：PWA v287。`pdf-viewer.mjs`／`pdf-viewer-ui.js`／`pdf-viewer.css`、共通extractor、GMO／Traders Previewはquery `20261012-10`でHTML・dynamic import・precacheを同期する。PDF.js main／worker／CMapは既存の固定資産を再利用し、依存・CSPを追加しない。

**Current / Viewer lifecycle**：選択Fileの参照を画面内メモリだけに保持する。workerへ転送済みの抽出bufferを再利用せず、原本を開く時だけFileから読み直す。現在ページのcanvasだけを描画し、ページ移動／閉じる時にcancel・sequence guard・page cleanup・canvas寸法0化を行う。document destroyの完了を待ってworkerを解放し、abortとcloseが同じ一回の終了処理を共有する。DPR上限2、canvas上限4百万pixel／各辺4096。100%は幅合わせ、拡大は200%まで。閉じる／ESCで背面scrollとfocusを戻す。ページ番号はEnterまたはchangeで確定する。失敗は固定codeと短い文言だけを表示し、元例外・本文を出さない。

**Decided / 検証境界**：原本確認のブラウザ検証は匿名localhostを使用し、実PDFはローカルread-only確認だけに使う。実PDFの画面・本文・金融値を証跡へ残さず保存操作をしない。iPhone実機確認とPCの390px表示確認は区別する。

- precache対象は存在確認する。
- HTMLが実際に参照する資産とService Worker一覧を同期する。
- Cache version更新時は旧キャッシュ削除とデータ保存を混同しない。
- Cache Storage削除は`localStorage`正本を削除してはならない。

**Current**：`service-worker.js`のprecache対象は実在するファイルに限定し、トップ画面が読み込むCSS / JavaScriptと同じバージョン付きURLを使用する。PWA資産を変更した場合はCache versionも更新する。

## 13. UI Design System

**Current / Decided**：`assets/account-ui.js`の`displayAccountName`はUI表示専用とする。計算・照合・集約・保存には従来の識別子を使い、履歴selectはvalueと表示テキストを分離する。口座名を含む派生キャッシュも表示時だけ変換し、正本やキャッシュの更新を表示名変更の条件にしない。

**Planned**：モバイルアプリとしての完成度を重視し、操作性、画面遷移、モーション、階層感、タップフィードバック、一貫性を共通のUI Design Systemとして整備する。Disney+等の高品質アプリは体験設計の参考とするが、完全コピーではなく、金融アプリとしての視認性とTradeScope独自UIを優先する。

## 14. Git運用

- 1変更1目的を基本とする。
- 無関係なユーザー変更を上書きしない。
- 自動生成物やバックアップJSONに実データが含まれる場合はcommitしない。
- commit、push、deployは明示依頼時のみ行う。
- 作業完了時は変更ファイル一覧と`git diff`要約を報告する。

## 15. ドキュメント更新

- 仕様変更時は該当docsを同じ変更で更新する。
- Currentだけが変わる場合でも、Decidedとの差が変化するならKnown issueを更新する。
- docsとコードの矛盾を発見したら報告し、判断なしにどちらかを正しいと決めない。
- UI表示名変更と内部データ名変更を分離する。

**Current / UI検証**：`tests/sbi-monthly-ui.test.js`は匿名DOMで国内編集、partial保存、明示0、常設保存ボタン、取得日保持、reset、再読込と失敗表示を検証する。PC 1280／mobile 390で内訳・保存・Summary・Top・Trendを確認し、パネル高さは変更後も更新する。PWAはv276で変更資産のqueryとprecacheを同期する。

## Current — SBI部分保存・Input状態

SBI国内2項目の変更は非永続Draft、各「取込値に戻す」もDraftだけを変更する。口座内「保存」でsbi-monthly-save serviceだけを呼び、MonthlyAccountInput＋変更のあるmanual Snapshot＋完全時だけStateを一つのexpectedModels／journal保護操作で保存する。cache無効化失敗もrollbackする。取得日、raw Holding、他口座・他月・legacyは変更しない。GMO／SBI Inputは保存後もボタンを維持し独立した保存済みstatusを出さない。Importの保存済み表示は別用途として維持する。

**Current**：旧手入力履歴（tradeScopeTradeHistoryV1）とcanonical rawTransactionsは共通確認統合で照合する。CSV保存は旧履歴を消さず、取引履歴UIは共通logical setを読む。旧履歴は個別削除可、canonical取引／Batchのユーザー向け削除UIはない。約定CSVは旧月でも選択可能であり同一hashは無書込、異なるhashでcanonical重複候補があればfile全体を停止する。確定置換の関係をBackup v13で保護する。canonical削除は提供しない。
