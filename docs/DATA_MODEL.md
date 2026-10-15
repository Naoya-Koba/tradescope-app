# Data Model

## Current — LIGHT FX transaction v3保存（v315）

LIGHTだけ`parseExecutions`→明示v3 adapter→既存validator→参照型collectionへ正式保存する。原通貨quantity／priceはdecimal string、open／closeとbuy／sellは別軸、実IDはstring／存在しないexecution IDはnull。tradeDateは約定日、targetMonthは帳票月、受渡日で月を変更しない。複数決済・同注文複数rowを統合しない。

取引専用Batchは既存importerId fieldの`lightfx-executions`で識別し、Snapshot／Holding／月次Input／Stateは作らない。同一hash Batchは検証して再利用。collection／使用判断はbalance採用と独立、訂正は旧row／collectionを残して追加。公開record／Storage key／Backup v15契約は変更しない。

## Current — SBI VC fixed-month／明示再取り込み（v314）

固定月残高は既存`sbivc-balance-adoption.fixedObservation`から取得し、旧Input v3/v4互換も使用する。balanceの取得とperiod P/Lの成立は別で、empty holding set／JPY 0／missingを区別する。current carryを固定月へ使わない。

同一PDFは既存Batch／Snapshot／Holdingを照合・再利用し、不足した共通source参照だけを追加できる。現在のmanual／別PDF／補正を使用している場合は更新確認が必要。新しい金融原値・schema・key・migrationは追加しない。同月別PDFは新canonicalと共通revision／採用履歴を保持する。残高専用の訂正は旧Inputのtransaction Batch採用を変更しない。

## Current / Decided — FX v3の非永続adoption reader／History projection（v313）

`assets/transaction-adoption-view.js`はaccount／provider／month／transaction scopeの共通読取入口。v312の公開record／validator／Repository／Backup v15を変更せず、adopted／unknown／deferred-with-current／deferred-without-current／stale／conflict／broken-referenceを返す。採用なしはtransactions=null、正式complete empty採用だけtransactions=[]／confirmedEmpty=true。同一target内の候補・履歴参照、全member、事実fingerprintを検証し、不正なら通常rowを返さず、balance採用へfallbackしない。partialは候補のみ。別targetの異常を正常targetのsource選択へ混ぜない。

readerはbalance State／Input／Snapshot／monthlySourcesを読まず、transaction Sources／rows／Batch／Account／Instrumentだけを参照する。取得時fingerprintで後続のstaleを判定し、返却rowは原値・collection順／locatorを保つ独立コピー。`transaction-view.projectV3`は状態metadataとHistory recordsを分離し、v3だけを独立readerから解決する。v1 GMO／v2 SBI VCは既存active Batch互換、manualとreconciliation v1も従来経路。v3は既存自動dedupe／manual照合へ入れない。

production LIGHT／みんな保存hook、reconciliation v2、official position-setは引き続き未実装。v3 History接続は原通貨・action／side・nullable金融値を表示するだけで、period計算／current positionsへ接続しない。以下v312の「History未接続」は当時の工程境界。

## Current / Decided — FX transaction保存契約のみ（v312）

`tradeScopeImportedTransactionsV1`はenvelope v1のままrecord v1（GMO）／v2（SBI VC spot）／v3（FX execution）を共存させる。旧recordのmigrationなし。v3の全fieldは`assets/transaction-source-contract.js`の`rowFields`に固定し、nullable fieldも明示nullで保持する。必須identityはid／collectionId／accountId／instrumentId／importBatchId、provider／PDF scope／month、action=open|closeとside=buy|sell、tradeDate、sourcePage／sourceRow、rowFingerprint、importedAt。数量は`baseCurrencyUnits`の原通貨decimal string、価格もdecimal stringで双方正。Lot変換・position方向・残存数量を保存しない。

executedAt／settlementDate、sourceOrderId／sourceExecutionId／sourceOpenOrderRef、realizedPnl／transactionSwap／fee／currency／feeCurrencyはnullable。IDはopaque stringで巨大値・先頭0を保持し公式execution IDを捏造しない。LIGHT／みんなの確認済みPDF policyのみ日時・数字の注文番号・close時の数字の新規注文参照を要求する。open realizedはnull、fee符号は原値のまま未分類。同一order／open refの複数rowを許容し、同一fingerprintでもdedupeしない。row locatorはcollection＋page＋row。fingerprintは内部ID・locator・取込日時と分離した金融事実のSHA-256で、nullableと0・decimal原表記を区別する。

新Repository entity `transactionSources`／key `tradeScopeTransactionSourcesV1`はenvelope v1（schemaVersion／records／updatedAt）。record v1は`collection`と`decision`だけ。collectionはaccount／sourceProvider／month／sourceScope／Batch／normalizerVersion／transactionIds／fingerprint／coverage／correctionOfCollectionId／createdAtを保持し、金融原値をコピーしない。scopeはgmo-fx-trades／lightfx-fx-trades／minna-fx-trades。complete＋空集合は正式0件、partial＋空集合は取得不完全であり0件確認ではない。不在はunknown。partialは候補として保存可能だが完全な取引集合として採用できない。

採用単位はaccount×month×provider×scope。decisionはadopt／keep-current／defer、collection参照と確認時fingerprint、previousId、confirmedAtを持つappend-only chain。keep-currentは有効採用がある時のみ、deferは旧採用維持／採用なしならunknown。参照はappend順・日時とも過去方向のみ。候補追加で採用は変わらない。訂正／normalizer変更は新collection＋新rowsで旧revision・Batchを保持し、同hashを同collectionと断定しない。既存v3 row・collection・decisionと参照BatchはRepositoryで不変。

balance adoption／monthlySourcesとは独立し、公開済みmonthlySources契約は拡張しない。低レベルreader／validatorのみで、LIGHT／みんなproduction保存hook、History v3表示、reconciliation v2、official position-setは未実装。Historyにはv3除外guardだけ追加し、旧v1／v2表示・reconciliation v1は維持する。Backup v15で12モデル、v14は既存11モデルに固定する。

## Current / Decided — Traders約定の非永続正規化（v311）

`traders-parser.parseExecutions(extracted, expectedBroker)`はLIGHT／みんな共通のread-only API。executionsはsourcePage／sourceRow、sourceOrderId／sourceOpenOrderRef、executionAt／settlementDate、pair、action=open/close、side=buy/sell、quantity／quantityUnit=baseCurrencyUnits、executionPrice、realizedPnl／transactionSwap／fee、note／noteStateを持つ。注文identityはstring、数量・価格はdecimal原値でLotへ変換しない。blank／dashはnull、明示0は0。closeの原新規注文参照は必須だが、任意損益・fee・受渡日を過剰requiredにしない。同じ新規参照／決済注文番号の複数rowを上書き・一意制約で排除しない。

既存scalar `parse()`の出力形・importerVersionは維持し、execution collection／auditは保存hookへ渡さない。原positionは独立観測で、約定から生成しない。自由備考はPII対策として転記せず、既知の公開金融ラベルだけ保持する。建玉・建玉／注文必要証拠金なしで明示dashの維持率はparser上null／notApplicable。既存永続Snapshot契約は拡張せず、このnullを0として保存しない。正式transaction保存・History接続は未実装。FX transaction vNext／独立transaction採用／Backup v15は別途設計承認が必要。

## Current / Decided — みんなのFX scalar共通採用（v310）

みんなのFXもaccount／marketValue（Snapshot.netAssetValue）とaccount／unrealizedPnl（価格評価損益、未決済swap除外）の2metricを正式scopeとする。`lightfx-scalar-adoption.js`の`forBroker(key)`は同じ実装で口座／provider／scopeを分離し、LIGHT既存APIとv309結果を維持する。みんなはminano／acc_minna_fx／minna／minna-monthly-report。Snapshot原値は参照のみでmonthlySourcesへ複製しない。

新FX Holding由来spot候補の重複生成を停止。旧重複adoptionは履歴を残してconflictとし、silent fallback／二重加算しない。訂正版は新Batch／Snapshot／Holding／candidate revisionだけを追加し、旧Input／State・flow・calendar・採用・補正履歴を維持する。新候補だけでは採用を変えず、旧overrideを別revisionへ継承しない。Backup v14、Storage key、persistent schema、validator公開契約、legacyは不変。以下v309の「みんなnativeのみ」は当時の記録であり、現在は共通hook／resolverを使用する。

## Current / Decided — LIGHT FX scalar採用（v309）

正式対象はaccount／marketValue（AccountSnapshot.netAssetValue：帳票の純資産観測）とaccount／unrealizedPnl（価格評価損益、未決済swap除外）のJPY scalar。`lightfx-scalar-adoption.js`が共通判断／同revision補正／旧Input・State互換を一度だけ解決する。PDF保存hookは不変Snapshotへのreference sourceをcanonicalと同じjournalへ追加し、金融原値をコピーしない。既存mutable Input／Stateの受理済み参照は読むだけで、新hookでは作らない。

FX Holding集計をspot scalarとして新規candidate生成しない。既存の重複範囲adoptionは監査recordを保持したままresolverでconflictにし、account値とposition subtotalを同時加算しない。既存JPY cash-onlyのgeneric採用互換は残すが、今回のLIGHT UI／hookの対象にはしない。

LIGHT訂正版は新Batch／Snapshot／Holding／candidate revisionを追加するだけで、旧Input／State・calendar・flow・adoptionを切り替えない。source UIで残高2metricを明示選択する。初回PDFの旧互換採用は維持し、独立manualの共通採用があればPDF追加で置換しない。Backup v14／11キー／validatorの公開受理契約・persistent schemaは不変。みんなのFXは今回native保存契約のまま。

## Current / Decided — SBI derived period input（v308）

`sbi-period-input.js`は新金融recordではなく、`sbi-balance-adoption`の採用済み5metricと既存MonthlyAccountInput／Stateのmanual realized／deposit／withdrawalから固定月の入力を導く非永続bridge。共通残高判断がない月は旧State経路を維持し、共通判断のあるmetricは旧Snapshotを別優先順位で再採用しない。CSV／manual／互換sourceは同義の入力、stale／競合／参照不正／missingは有効値に戻さない。

新Stateや原値の複製を作らず、partial Inputに正式flowがあればnative外国／現金Snapshot不在でも共通scalar採用から期間入力を成立させられる。返値periodInputはflowSource、5metricのeligibility、referenceSatisfied、missingFlows／missingReferences、monthly／observation条件を持つ。SBI swapは現行固定0で、flow未取得の月へ新しい0損益を作らない。条件充足はuser approvalではない。Backup v14／11キー／persistent schema／migrationは不変。

whole accountとcomponentsは既存balance resolver内の排他を維持。既存account-scope P/L採用は5metric bridgeの範囲外として同じexclusive basisを保持し、component P/Lへ追加加算しない。SBI国内holding-set・Portfolio／Open Positions・外国銘柄別残高・外貨cash・internal transferは今回未接続。

## Current / Decided — 非永続月次進捗（v307）

`monthly-required-policy.js`が固定6口座のcurrent-balance／fixed-balance／period条件を定義し、`monthly-progress-view.js`が既存source・共通採用resolverから読む。source取得、adoption、required metric、carry、conflict／stale／invalid-reference、balance条件、period条件、user approvalを分離する。既存State・Input・balance-view.complete・monthly-display.complete・__savedの意味を変更しない。

APIは`TradeScopeMonthlyProgress.create({models, tradingData}).account(accountKey, targetMonth, {scope, currentBalance})`／`.month(targetMonth, {scope, currentBalances})`。返値はbalanceMetrics／periodMetrics、missingRequired、balanceRequirementsSatisfied／periodRequirementsSatisfied／requirementsSatisfied、sourceStatus／candidates、carriedComponents、pendingReview、approvalStatus等。manualもPDF／CSVと対等な採用済み既知値。candidateだけ・deferの採用なし・stale・参照破損は充足しない。明示0／空保有集合とmissingを区別する。source typeを優先順位にしない。

carryは既存current-asset-viewの各口座balance結果を入力するだけで、未供給はnot-evaluated、fixed／periodはnot-applicable。当月requiredを過去値で充足させず、別年carryを導入しない。approvalStatusは常にnot-recorded、approvalSupported=false。legacyはcalculationCompatible／legacyDataAvailable／approval unknownを分離し、旧全0を推測で確認済みにしない。現在残高計算・期間金融値へ進捗を逆流させず、新field／record／Storage key／migration／Backup変更はない。

scopeのrequirementsStateはnot-started／source-acquired／partial／satisfied／needs-review／unsupported。既存の`monthly-source-contract.progress()`は低レベル情報で、required policyを持つ画面用入口は新projection。基準日は原値のまま保持する。SBI CSV取得日は対象月末とは限らず、条件充足は全口座同時点の完全NAVを保証しない。

## Decided / Planned — SBI国内保有identityと移行境界

原HoldingSnapshotは預り区分別の原行とstable IDを保持し、金融原値を統合・破壊しない。Instrumentは銘柄identity、custodyはHolding属性。保存identityと表示identityを分離し、将来Portfolio／Open Positionsは口座×Instrument集約を基本としcustody別詳細を残す。数量単位・通貨・基準日・欠損の整合を確認して集約し、取得原価を評価額から推測しない。

国内canonicalと外国legacy/manualのcoverageを明示し、対象国内の旧経路を置換して取引差分を再加算しない。外国scalarから架空holdingを生成しない。現行common holding-setのinstrumentId一意／spot-holdings契約を今回拡張しない。集合採用・空集合の正式確認、完了承認履歴は後続正式契約（Backup v15候補）。Portfolio／Open Positionsは今回未変更。

## Current / Decided — SBI scalar balance adoption（v306）

`sbi-balance-adoption.js`が国内marketValue／unrealizedPnl、外国marketValue／unrealizedPnl、JPY cashBalanceの唯一の採用入口。common adoption→同revision overrideを解決し、新判断がないmetricだけ旧MonthlyAccountInput／State参照を内部compatibilityで読む。明示common判断のstale／競合／未解決は旧値へsilent fallbackしない。

国内はImportBatch＋sbi-domestic-holdings集合の参照、外国／現金は既存manual AccountSnapshot参照。原金融値をmonthlySourcesへ複製しない。新独立manual sourceだけ既存v1契約のvalueを原値として持つ。source作成とadoptionは別操作、公式自動優先なし。訂正・補正・比較・deferは既存append-only履歴を使う。

CSV＋candidateは同じjournal。bulk migrationなし、Backup v14／既存11キー／validator／record version不変。国内holding set・国内株／投信分割・外国数量推定・外貨cash・入出金自動source化・内部振替は未実装。

## Current / Decided — SBI VC残高の最小採用UI（PWA v305）

月次Input内の「入力元・採用を確認」でspot holding setとJPY cashBalanceだけを操作する。`sbivc-source-selection.js`は共通candidate／balance resolver／monthly-source-serviceを接続する非永続controller、`sbivc-source-ui.js`は表示と確認Draftだけを担当する。候補一覧の訂正前revisionは監査・明示選択用で、通常保有へ混ぜない。原金融値や旧Input履歴を複製・破壊しない。

source選択、継続、comparison、deferは保存前確認＋fingerprint guard付きの既存v14操作。旧互換採用の継続／deferはユーザーの明示確認時だけ同じ物理revisionと補正を共通判断へ結び、別revisionへoverrideを継承しない。一致確認は原値比較で採用を変更しない。新record／field／key／migrationなし。


## Current / Decided — SBI VC共通残高採用（PWA v304）

`sbivc-balance-adoption.js`を現物保有集合／JPY現金の唯一の採用入口とする。共通判断があるcomponentはmonthlySourcesの指定revision／overrideを解決し、ないcomponentだけMonthlyAccountInput v3/v4＋observation-adoptionをcompatibility adapterとして読む。明示deferで前判断なし、stale、競合を旧Inputへ戻さない。原値はBatchのholding scope／AccountSnapshot.cashBalanceへの参照のみ。空Holding集合は既存Batch＋同scope AccountSnapshotで正式観測でき、架空HoldingやInstrumentを作らない。保有集合と現金のsource month／参照を別々に保持する。帳票assetValueはreportedAssetTotal候補のみで資産合成へ加算しない。

PDF確認保存はcanonical recordsと3参照candidateを一回のjournalで追加する。candidate取得だけではcommon adoptionを変更せず、既存PDF採用は互換契約を維持する。旧source／Input補正履歴をbulk migrationしない。共通明示選択は既存source APIで行う。旧補正フォームは同じ物理revisionへの補正だけ共通override／adoptionとatomic同期し、別manual／訂正前sourceへの変更は停止する。原金融値は複製せず、既存v14のsource／adoption／override型、validator、11キーを維持する。


## Current / Decided — 最小共通source / adoption（Backup v14）

PDF／CSV／独立manualは対等な正式source候補。公式自動優先・manual格下扱い・複数候補の同時加算をしない。既存canonical原値はコピーせず参照する。新キー `tradeScopeMonthlySourcesV1`（entity monthlySources）を追加し、既存10モデルのrecord schemaは不変。新envelope v1はschemaVersion、records、updatedAt、recordCount、recordsFingerprint（canonical JSONのSHA-256）。履歴欠落、未知field／version、参照不正を拒否する。全recordはappend-only。

- source v1：id（revision ID）、sourceId、revisionOf、accountId、targetMonth、component、metric、temporalType、currency、unit、scope、asOf、sourceType、createdAt、confirmedAt、value、reference、fingerprint。独立manualはdecimal／null／保有集合の原valueを保存。PDF／CSVはvalue=nullで既存AccountSnapshot、Holding集合のImportBatch、原sourceValuesへのallowlist参照を保持する。derived ledger・adoptedValuesを原観測へ昇格しない。金融事実・範囲・date-only基準日・安全なBatch metadataをSHA-256で結び、本文・filename・PIIを保存しない。
- adoption v1：account×targetMonth×component×metric×currency×unitごとに1つのactive chain。decision=adopt／defer、revisionId、revisionFingerprint、overrideId、previousId、confirmedAtを保持。切替は新record、旧判断は保持。deferは前の有効採用を維持し、採用なしならunresolved。公開済みState／Inputの明示採用は互換adapterで維持する。
- override v1：revisionId／revisionFingerprint、previousId、value、confirmedAt。特定revisionへ所属し、adoptionが参照した補正だけ適用。独立manualと区別し、原値を上書きしない。resetは補正なしの新adoption。保有補正で別Instrumentや別保有集合を発明しない。
- comparison v1：leftId／rightId、両fingerprint、equivalent／different／incomparable、confirmedAt。同範囲・通貨・unit・基準日の原値を比較し、一致確認でも採用を変更しない。audit APIで現行／stale／deferredを再評価する。

componentはaccount／domestic／foreign／cash／spot。balance／flow／holdingsを分け、whole-account marketValueとcomponent資産のactive adoptionは排他。同componentの保有合計と評価額も加算しない。0数量・終了銘柄は復活させず、新集合の不明評価額を旧集合合計で補完しない。通貨は採用キーで区別し、自動円換算しない。

訂正は同sourceの新revisionを追加し確認後に採用参照を切替える。旧overrideを自動継承しない。参照済み金融原値のRepository上書きは拒否し、新物理sourceへ訂正する。外部破損・変更はstaleで停止。legacyの不明入力日時はnull、bulk migrationやplaceholder zeroの確認済み昇格はしない。取得・採用・必須値・carry・ユーザー完了承認は別状態。今回完了承認record／UIを追加しない。Transaction reconciliationとは別契約でkeep-bothを月次加算へ流用しない。

以下のv300までの「schema／Backup不変」「永続基盤は次工程」は当時の記録で、現行の新基盤は本節を優先する。

## Current — 非永続の共通表示結果・未入力口座

`display-results`はperiod dashboard、年間flow集計、選択月6口座のView、期間比較可否を保持するメモリ上の表示契約。current balanceは別のoptional Viewで、損益管理の期間結果には入力しない。月次行のstatus（missing／partial／complete／conflict／read-failure）は数値やDOM行の有無とは分離する。missingはnull、明示0は0で、過去値・年初値による穴埋めはしない。Accountに安全な開設月／有効期間契約がないため設定済み6口座を過去月にも行表示し、開設時点を推測しない。

正本再読込はStorage readのみ。未保存編集は従来の画面内Draftのまま保護し、表示更新で保存・破棄・初期化しない。新Storage key・persistent schema・record version・migrationはなく、Backup v13を維持する。source候補と採用判断を永続化する共通基盤は次工程。

## Current / Decided — 非永続の残高確認状態

`balance-view`のcomponentはvalue（decimal／null）、sourceMonth、snapshotAsOf、source、currentConfirmed、carried、missing、explicitZeroを持つ表示属性。確認月は対象月と区別し、出所と採用判断を分離する。全成分既知／小計のみ／過去確認値あり／不明成分ありを同時に判定できる。旧値は表示対象年内の参照に限りInput／State／Snapshotへ保存しない。新model／Storage key／record schema／Backup変更はなくv13を維持する。

SBI国内／外国／現金は現行source単位、FXは口座一括単位。SBI VC保有集合は最新採用sourceのみで、正数量保有の評価額・現金だけ必要時に以前の月の採用値を参照できる。最新0／不明数量・保有終了を補完しない。同月訂正前source・取引履歴・帳票資産合計・担保を加算しない。残高completeはMonthlyAccountState確定ではない。以下のSBI VC最新source契約は保有集合について維持し、Top／Allocationの未確認残高には本節の参照状態を追加する。

## Current / Decided — SBI VC選択年資産View

Top純資産／Asset AllocationはMonthlyAccountInput v3／v4 → 採用AccountSnapshot → Batch → HoldingSnapshotを共通helperで解決し、active補正後の正数量保有の既知円評価額＋JPY現金を使用する。選択年内最新targetMonthのみ採用し、別年・legacyへfallbackしない。source存在・sourceMonth・holdings・cashBalance・knownAssetTotal・不明成分・観測成分completenessはメモリ上のView属性であり、新しい永続fieldではない。観測成分が既知でもMonthlyAccountState確定や完全NAVを意味しない。帳票合計・担保・取引を追加せず、永続schema・キー・Backup v13は不変。Portfolio／Open Positionsの全年横断選択は維持する。

## Current / Decided — SBI VC現在保有と取引履歴

Open Positions／PortfolioのSBI VC現在保有は、最新対象月のMonthlyAccountInput v3／v4 → 明示採用AccountSnapshot → ImportBatch → 同じsourceのHoldingSnapshotを正本とする。共通observation-adoptionでquantity／marketPrice／marketValueのactive補正を解決し、正の採用数量だけ表示する。最新が0／不明なら過去の正数量へ戻さず、訂正前source・未保有0列挙を混ぜない。ImportedTransaction／legacy手入力は売買履歴であり現在保有を再計算する根拠にしない。原価・損益・レバレッジ建玉を推測せず、担保評価を別資産へ加算しない。Portfolioの現金明細は同じ採用Snapshotの補正後cashBalanceのみ。assetValueは帳票観測として保持し、明細合計へ重複加算しない。採用sourceが空／不明／エラーでもlegacy SBI VC保有を復活させない。これらは非永続projectionであり、永続schema／Backup v13は不変。Top純資産／Asset Allocationは上記の選択年資産Viewを使用する。Risk／月次計算は変更しない。

## Current / Decided — 手入力と取込取引の確認統合

共通`assets/transaction-reconciliation.js`で口座・一意なInstrument・売買／取引意味・日付（明示時刻があれば時刻）・数量単位・decimal数量合計・価格・通貨を厳密照合する。同一Batch内の同条件の全約定集合を対象とし、任意の部分集合・価格許容差・類似名で統合しない。1:1／1:Nとも新しい永続関係はユーザー確認が必要。数量はBigIntによるdecimal演算。FX手入力の明示contractSizeとGMO通貨数量、明示株数とSBI国内株式／ETF CSVの株数・JPY単価だけを比較用に解釈し、原数量・単位へ書き戻さない。投信や単位不明は推測しない。

`tradeScopeTransactionReconciliationsV1`（envelope v1／record v1）をBackup v13の10番目の正本モデルとして追加する。recordはschemaVersion、id、manualId、decision（replace／keep-both／defer）、sourceType、facts、members、confirmedAt。factsはaccountId、instrumentId、tradeDate、side、semantic、quantity、quantityUnit、price、currency。membersはrawTransactions／importedTransactionsのentityとstable idで全約定を参照する。array indexやPDF本文をidentityにしない。既存tradeScopeTradeHistoryV1のrecord／metadata／生JSONは変更・削除しない。確定した置換／両方保持の関係は不変。判断保留だけは同じstable IDで次の明示確認へ進める。手入力を編集した場合は古いfactsと一致しなくなるため非適用とする。

`imported data > confirmed replaced manual`を共通logical setで適用する。keep-both／defer／不確かな一致は別取引のまま。既存の未判断1:1非永続表示統合は互換維持するが、新しい1:Nは自動置換しない。訂正前source・関係を残し、採用sourceの一意な全集合で公式ID・日時・数量・価格・手数料・個別損益等が同じ場合だけ再解決する。既に有効な置換を孤立させる訂正は保存停止。自動関係書換え／削除はしない。

取込と関係は同一Repository journalで保存し、保存前／再読込時に手入力の生JSONも照合する。同一hashの保存済みsourceも、取込recordを変更せず関係だけ明示確定できる。Open Positions／Portfolio／Allocation／Risk／月次計算へ新しいconsumer接続は行わない。

## ImportedTransaction record v2 / Backup v12（Current / Decided）

既存`tradeScopeImportedTransactionsV1`とenvelope v1を維持し、record v1のGMO FX契約は変更しない。record v2は既存必須fieldに`marketType`と`feeSemantics`を追加する。現物はmarketType=spot、normalizedTransactionType=spot-buy／spot-sell、quantityUnit=baseAssetUnitsで、FX open／closeへ変換しない。公式execution／order IDは非空文字列を受理し、provider・account・Batch contextの内側で識別する。同じ公式IDを訂正前後の別Batchに保持可能。decimal文字列と日時の原精度を維持する。

現在のv2保存policyはacc_sbivc_crypto／sbivc／PDF／sbivc-spot-trades／sbivc-monthly Batch／Crypto ASSET/JPYのみ。`feeSemantics=receipt-positive-payment-negative`で、手数料は受取り正・支払い負の原符号を維持する。realizedPnlはnull、P/L・原価・MonthlyAccountStateを生成しない。policy helperと共通record検証を分ける。v12がv1／v2を受理し、公開済みv1〜v11の受理範囲は固定する。

`import/sbivc-transactions-parser.js`は共通extractorの位置付き行と帳票見出しから2行構成の現物買いを読む。実帳票検証済みはspot buyのみ。spot sell／レバレッジ新規・決済／建玉／貸出は未検証で推測保存しない。物理PDFページはsourcePage、sourceRowは認識順で物理行ではない。手数料符号の帳票説明も確認し、取得できた入出金明細のJPY／crypto／fee legsは公式IDで照合する。legsとクイック入金を売買イベントや月次flowとして保存しない。

保存は必要Instrument・Batch・資産観測・採用Input・全約定を一回のexpectedModels／journal保護commitに含める。same-sourceは原値・取引集合まで一致する場合だけno-op。不完全な旧資産のみBatchへ自動backfillしない。訂正前source・取引を残し、履歴はMonthlyAccountInput v3／v4 → 採用AccountSnapshot → Batchの明示参照だけを使用する。補正値は取引原値へ反映しない。legacy aggregate 1行と公式複数fillsをmany-to-one統合／削除しない。Top／Portfolio／Allocation／Risk、月次P/Lへは接続しない。

## SBI VC観測採用の手動補正（Current / Decided）

明示的な補正保存時のみMonthlyAccountInput record v4を使用し、旧v3は表示・再読込だけで更新しない。v4はv3の全fieldにobservationOverrides／overrideUpdatedAt／overrideHistoryを追加する。既存9キー・envelope v1・Snapshot／Holding schemaは維持し、Backup v11で正式受理する。新しいpartialキーやMonthlyAccountStateは作らない。

observationOverridesはaccount（cashBalance／assetValueの疎な差分）とholdings配列を持つ。各holding差分はholdingSnapshotId＋instrumentId＋values（quantity／marketPrice／marketValue）で現在の採用Snapshotへ厳密に紐付ける。原値はimmutableなAccountSnapshot／HoldingSnapshotに一度だけ保存し、共通observation-adoption helperが原値＋active overrideを解決する。未知field・別source／別Instrument・配列順identity・重複参照を拒否する。

GMOと同じdecimal比較で原値と同値のfieldは差分から外す。数値は非負decimal文字列、末尾精度を保持し、空欄はnull／不明、明示0は0。差分なしfieldは原値を採用する。補正・resetは非永続Draftであり「保存」でのみInputを一回のexpectedModels／journal保護commitにより更新する。overrideHistoryは旧adoptedAccountSnapshotId／observationOverrides／overrideUpdatedAtを追記し、原値は参照で復元できる。reset後も履歴を削除しない。

訂正版PDFは旧sourceHistoryと補正履歴を保持し、新公式sourceを採用してactive overrideを空にする。旧sourceの補正を新sourceへ自動適用しない。保存前確認後に補正内容が変化した場合も再確認を要求する。same-hash照合は補正値ではなく原本値を検証しno-opを維持する。未保存の無関係な0銘柄は補正対象外。損益・原価・取引は生成しない。資産観測consumerは上記のViewでactive補正を解決する。

## SBI VC資産観測保存（Decided — 公開済みv3契約）

既存9キーを維持し、MonthlyAccountInputに観測採用専用record v3を追加する。必須fieldはschemaVersion=3、id、accountId、targetMonth、adoptedAccountSnapshotId、adoptedAt、sourceHistory。履歴は旧adoptedAccountSnapshotId／adoptedAtのみ。損益入力・overrideを持たず、SBI input v1／Traders input v2へ未知値を補完しない。口座・月の一意性、参照先、provider policy、PDF Batch、officialMonthEnd・date-only月末日、JPYを検証する。今回はsbivc policyのみ有効。新しいpartial専用キーやMonthlyAccountStateは作らない。envelope v1、他record schemaは不変、Backup v10で正式に受理する。

`sbivc-monthly` Batchはacc_sbivc_crypto／pdf／sbivc、Parser version、対象月、基準日、hash／size／importedAtのみ。report typeは月次専用importer IDで区別する。Accountは保存時だけ必要なら生成。Crypto Instrumentは明示tickerのASSET/JPY完全一致を再利用し、複数ID一致／無効銘柄は停止する。新InstrumentはquoteCurrency=JPY、baseCurrencyを保存せずUSDC等も切り詰めない。既存metadataを書き換えない。

AccountSnapshot v1のcashBalanceはJPY現金、assetValueは帳票「総資産円換算額」という取得範囲内の資産観測値。sourceScope=sbivc-monthly-assets、sourceMode=imported、observationType=officialMonthEnd。netAssetValue／unrealizedPnl／reportedMonthlyRealizedPnlはnull。レバレッジ含み損益を含む完全純資産とは断定せずledgerへ加算しない。現物HoldingSnapshot v1は同じBatch／AccountSnapshot／月／基準日を共有し、quantity／marketPrice／marketValueへ公式数量／レート／JPY換算額を精度維持して保存する。acquisitionPrice／unrealizedPnlはnull、rawFieldsを保存しない。明示0・空欄nullを区別する。

**Current / Decided — holding選別**：Parser／Previewは残高表の全行を保持する。保存層だけでquantity > 0を常に選び、明示0は同じSBI VC口座・canonical Crypto symbolについて対象月以前の採用中sourceに正のHoldingSnapshotがある場合だけ選ぶ。Instrument登録や他口座、legacy取引、未採用／訂正済み旧sourceだけでは根拠にしない。同月訂正の正→0は訂正前の採用sourceを根拠に保持する。以前の月の採用中sourceに正の保有があれば以降の明示0も保持可能。無関係な0はInstrument／Holdingを生成しない。公式cashBalance／assetValueは選別後のholding合計で再計算しない。既存0レコードの自動削除・migrationは行わない。

同一account・provider・PDF種別・importer/version・月・基準日・hashの一意一致に加えsize／観測／保存対象holding／採用履歴参照を照合し、完全保存済みだけno-op。省略した無関係な0行は欠損ではない。再取込では同月の採用履歴の直前sourceと、保存時点で採用されていた過去月sourceから選別根拠を再現し、その後の訂正を混ぜない。不完全集合は停止する。同月別hashは明示確認と最新採用参照guard一致後に新Batch／Snapshot／Holdingを追記し、Input ID維持＋履歴追記＋参照切替を同一journalで保存する。旧sourceを削除せず、Input表示は明示採用先のholdingだけを読む。表示／reloadだけでは書かない。MonthlyAccountInput v3／Backup v10／永続schemaは不変。

**Known limitation / Planned**：レバレッジ建玉・報酬・入出庫は永続化しない。現物買いは上記v2契約で保存する。MonthlyAccountState・損益・原価を推定せずRiskへ接続しない。Top純資産／Allocationは上記の現物＋JPY観測Viewのみ使用する。Portfolioは上記の現物・現金観測のみ使用する。未検証取引／cashflow／月次P/L／partial projectionは別工程で検証する。

## SBI VC read-only parser result（Current / Decided）

`import/sbivc-parser.js`の結果は永続modelではない。report（provider／reportType／periodStart／periodEnd／targetMonth／snapshotAsOf）、accountObservations、spotHoldings、leverageSummary、leveragePositions、transactions、cashflows、rewards、lending、sections、errors／warningsをメモリ上だけで扱う。完全な月初〜月末期間と正式基準日の一致を検証し、EOD基準日はdate-onlyで保持する。架空timestampを作らない。

JPY残高とassetTotalObservation（帳票「総資産円換算額」）は区別し、後者をnetAssetValueにしない。現物の数量・評価レート・officialJPYValueはdecimal文字列で保持する。JPY評価表の明示tickerだけをCryptoの`ASSET/JPY`候補にし、USDC等を3文字へ切らず、baseAssetは一時候補属性で既存baseCurrencyへ保存しない。明示保存時のみ上記契約へ変換し、legacy ETH/JPY取引は変更しない。

現物とレバレッジは別collection。列の空欄はnull／missing、`-`等はnull／notApplicable、明示0は数値文字列、該当なしtableはemptyであり0イベントを生成しない。現物原価・実現／評価P/Lを推定しない。JPY入出金・暗号資産入出庫・報酬は分離し、暗号資産移動をJPY deposit／withdrawalへ変換しない。報酬はrecordedAtと明示された対象月を分離しswapにしない。自由な備考・PIIを出口へ含めない。

**Current / Known limitation**：現物買い実行行は上記Parserで検証済み。現物売り／レバレッジ／建玉／貸出行は未検証。emptyはイベントを生成せず、未対応の取引行は保存前停止する。取引をFX open／closeへ変換しない。Parser結果全体は永続化せず、allowlistの資産・現物保有・明示約定だけを別保存serviceへ渡す。

## Current / Decided — Transaction derived presentation

FXは一覧・詳細とも「約定レート」と表示し、canonical InstrumentのquoteCurrency（未設定なら安全に識別できる通貨ペア）を単位とする。損益通貨からJPYを推測せず、原source価格の小数桁・末尾0を保持する。日時sourceが日付のみなら時刻を生成しない。表示のために保存値・並び順を変更しない。

詳細は「取引詳細」と「原本・監査情報」に分離する。FX数量は判明した場合だけLotと原通貨数量を1行にまとめ、出典と原本位置は重複させない。GMOのsourceRowは認識した明細順で原本の物理行ではないため、原本位置はPDFページまでとする。SBIのsourceRowNumberはCSVの物理開始行として表示可能。位置不明は非表示、任意値のnullと明示0は区別する。

`assets/transaction-display.js`は共通resolverが返す同じ論理取引集合に対する非永続の表示層。原source参照を読み、decimal文字列をBigIntの係数／桁数として計算し、Lot／株式概算だけを生成する。Instrument・quantity・quantityUnit・contractSize・dedupe identity・月次計算・Backup v9契約へ書き戻さない。明示金額を優先し、SBI国内CSV由来でStock／ETF・株数・JPY単価の意味が明確な場合のみ数量×単価を「約」として表示する。投信の基準価額単位や外貨換算を推測しない。

Lot sizeはbroker／canonical pairごとの表示ルールに一元化。GMOは通常10,000通貨、HUF/JPY・ZAR/JPY・MXN/JPYは100,000通貨。LIGHT FX／みんなのFXは通常10,000通貨、RUB/JPY・HUF/JPY・HUF/JPY LIGHTは100,000通貨。未対応provider／pairまたは数量単位未確認なら換算しない。明示されたLot数量は再度割らず、通貨数量が明示された時だけLotへ換算する。GMO PDFの`gmo-reported-count`は、約定数×約定単価＝約定金額の整合により通貨数量とユーザー確認済み（2026-10-12）。GMO口座／provider／PDF取引sourceが一致する原recordに限り表示時だけLotへ換算し、保存済み約定数・数量単位・resolver／dedupeの既存挙動は変えない。

出典（2026-10-12確認）：[GMO FXネオ取引ルール](https://www.click-sec.com/corp/guide/fxneo/rule/)、[LIGHT FXサービス概要](https://lightfx.jp/service/outline/)、[みんなのFXサービス概要](https://min-fx.jp/lineup/fx/service/outline/)。サービス変更時は表示helperの一箇所を更新し、正本や履歴の統合条件は別途扱う。

## Current / Decided — Imported trade source / Backup v9

**Current / Decided — 旧取込の明細補完**：同一PDFの再選択は通常no-op。ただし口座・provider・PDF種別・importer・対象月・月末日・hash（保存済みsizeがあればsizeも）が一致するBatchが一意で、そのBatchのImportedTransactionsが0件の場合だけ、現在のParserで再検証した明示取引をユーザー確認後に追加できる。原Snapshotの報告値との一致、完全な取引明細取得を要求し、個別決済損益が完全取得できる場合は公式月次合計と照合する。不一致・曖昧Instrumentは停止する。1件以上の不完全／不一致集合は自動補完しない。全明細が既存と一致すればno-op。

**Current / Decided**：取引は既存Batch IDとその`importedAt`を継承し、追加時刻はenvelopeの`updatedAt`だけに反映する。通常新規取込と同じ依存レコード補完で、明示されたFXペアを既存のcanonical正規化で一意に解決し、既存Instrumentを必ず再利用する。必要な未登録Instrumentだけを取引と同じjournalで追加し、失敗時は両方rollbackする。Batch／全Snapshot／月次Input／State／確定日時／採用参照／原値・訂正履歴／legacy／月次計算／Top cacheは変更しない。旧source補完後も履歴表示はStateの明示採用Batchだけを使用する。schema・キー・Backup v9契約は不変、Migration・自動統合・削除は行わない。

`tradeScopeImportedTransactionsV1`を追加し、envelope v1／record v1で明示的なGMO約定イベントを保持する。必須fieldはid、accountId、instrumentId、importBatchId、sourceProvider、sourceType、sourceScope、targetMonth、tradeDate、executedAt、side、normalizedTransactionType、rawTransactionType、quantity、quantityUnit、price、realizedPnl、fee、feeCurrency、currency、providerExecutionId、providerOrderId、sourcePage、sourceRow、importedAt、schemaVersion。日時・個別損益・手数料／通貨・公式IDはnull可。decimalは文字列。現在の許可sourceはGMO PDF／gmo-fx-trades、数量は帳票の約定数（gmo-reported-count）でLotへ推測換算しない。

旧RawTransactionは口座全体のexternal ID一意制約があるため、同一公式IDを含み得る訂正前後のPDF source保持へ無理に流用しない。新モデルはBatch内execution ID／page-row重複と口座・銘柄・Batch・月・日付の参照を検証する。旧legacy／SBI rawは移行・削除しない。表示Viewはmanual／SBI raw／adopted GMO sourceを共通化し、原source refsとmanual metadataを保持する。HoldingSnapshot、月次swap、入出金から売買イベントを生成しない。

**Current**：`assets/transaction-view.js`は非永続resolver。公式ID優先でも値不一致・同一source内の複数候補は統合しない。manual/importは口座・銘柄・売買・日付・明示数量単位・数量・価格・open/closeが一致し候補が双方一意の場合のみ表示統合。数量単位不明、部分一致、価格許容差、曖昧候補は統合しない。物理削除なし。過去表示名はsource当時表記を保持する。

**Current**：公式IDなしのimported同士は、同一provider・口座・商品・完全日時・売買・数量単位・数量・価格・種別が一致し、異なるBatchで双方一意の場合だけ表示統合する。日付だけ・単位不明・不一致・複数候補は維持する。訂正版の表示はStateが採用したSnapshotのBatchだけとし旧recordは削除しない。取引recordの`currency: JPY`は個別損益の表示通貨で、FX価格のquote currencyはInstrumentにある。新履歴UIから正本を変更せず、既存manual編集だけは従来serviceへ渡す。

## Traders PDF-only partial保存 / Backup v8

**Current — GMO取引保存**：`gmo-fx-monthly-v2`は取引明細と決済取引明細を分離して読む。注文番号は保持するがexecution ID／一意な約定IDとは断定しない。日時は帳票の日時（タイムゾーン付加なし）、数量は約定数の原値。明示JPY取引損益または明示円換算額だけを個別P/Lとし、未取得はnull。スワップは加えない。手数料0は原値を保持し通貨不明はnull、非ゼロは現状保存停止。新規FX Instrumentのみ遅延生成し既存の表記差を照合、複数ID一致は停止する。Batch／Snapshot／State／Instrument／取引を同一journalで保存する。

**Current / Decided**：1ファイルのPDF観測・全FX Holding・PDF月次原値の採用参照を同一保存操作で保護する。calendar swapは独立したmanual sourceで、空欄はnull。PDFだけのpartial保存ではStateを作らず、後入力または同時入力で全5項目が揃った時だけState v4を確定する。PDF訂正は新Batch／新Snapshot／新Holdingへ明示切替し、calendar原値・採用値・履歴と既存State IDを保持する。表示・月切替でseed／保存しない。

**Current / Decided**：新キーを追加せず`tradeScopeMonthlyAccountInputsV1`のTraders専用record v2をBackup v8で導入する。必須fieldはschemaVersion、id、accountId、targetMonth、adoptedAccountSnapshotId、sourceValues、adoptedValues、fieldSources、overrideFields、overrideUpdatedAt、sourceHistory、pdfObservations。2つのValuesはrealizedPnl／swapPnl／unrealizedPnl／deposit／withdrawal、swapだけnull可。他4原値は採用Snapshotの報告値と一致必須。pdfObservationsはfee／otherの照合済み0だけを受理し、非ゼロはParser／保存で停止する。fieldSourcesはPDF由来4項目とmanual-income-calendar-swap-accrualを明示する。旧SBI input v1の意味は不変。

**Current**：口座・月は一意でInput IDを維持する。原calendarは最初の明示入力時にのみnullから数値へ設定し、以後同じsourceの原値を変更しない。nullable sourceHistoryに旧採用Snapshot ID・sourceValues・adoptedValues・overrideUpdatedAtを追記し、partial→completeとPDF訂正を復元可能にする。完全Stateとの5項目・source・採用先一致を検証し、swap missingのState／参照不正／未知fieldを拒否する。旧v7のInputなし完全Stateも読め、表示だけでは新Inputを作らない。明示訂正時に必要なInputを作る。State v4／Snapshot v2／FX Holding v2／envelope v1は変更しない。

**Current / Decided**：Backup v7でTraders専用AccountSnapshot record v2、FX HoldingSnapshot record v2、MonthlyAccountState record v4を導入する（8キー／envelope v1は不変）。State v4は既存採用5項目・sourceValues・overrideFieldsに加えfieldSourcesとsourceHistoryを必須とする。swapの出所は`manual-income-calendar-swap-accrual`、他4項目は`imported-monthly-pdf`。original entered swapは同一採用で不変、採用値訂正／PDF訂正前のsource/adopted値・Snapshot参照・確定日時を追記履歴として保護する。Snapshot accountSpecificはrequiredMargin、orderRequiredMargin、maintenanceRate、transferableAmount、unsettledAmount、reportedAccountEvaluationPnl、monthEndUnsettledSwap、reportedSettledSwapPnl、reportedDeposit、reportedWithdrawal。FX Holdingは共通観測参照とquantity／acquisitionPrice／marketPrice／price unrealizedにfxPosition（orderId／executedAt／side／quantityUnit=reportedQuantity／unsettledSwap／requiredMargin）を保持し、FXのmarketValueを捏造しない。数量のロット換算は行わない。

## Traders Securities monthly PDF

**Current / Decided**：LIGHT FX／みんなのFXの2026-09以降は月次PDFと収益カレンダー「スワップ付与」月間合計を組み合わせる。口座／Batch／観測／Stateは独立する。PDF建玉原値はFX HoldingSnapshot v2へ保存し、原本・全文・PIIは含めない。

## Current / Decided — 非永続の部分観測View

月次Stateのcomplete／missing／conflictは変更しない。未確定の国内HoldingSnapshot群等から読み取り専用のpartial-month viewとlatest-dashboard projectionを生成する。同一月の国内候補Batchは1件のみなら採用表示可能で、複数なら合算・latest選択をせず停止する。完全Stateがある場合は明示採用先を優先する。対象月・取得元・口座を検証した同一観測群だけを合計し、必要値不足の群合計はnullを保つ。

共通SummaryはmetricごとにsourceMonthと使用状態をメモリに保持し、Top／年間Summary／月時点のTrendへ同じ結果を配る。選択月Viewと年間内訳はその期間の既知値だけを集計する。未入力成分の非加算は暫定表示だけの意味であり、0保存、legacyコピー、State生成をしない。表示Viewのための保存キー・schema・Backup変更はない。

## Current / Decided — PDF原値とユーザー採用値の分離

GMO PDF保存のState v2はそのまま読め、表示／未編集保存で書き換えない。最初の明示手修正だけでState record v3へ昇格する。v2では手修正機能がなかったため、既存Stateの決済・swap・入出金と採用Snapshotの評価損益を原値baselineにする。Snapshotは破壊更新しない。PDF取込は引き続きv2を生成し、Inputの5項目編集は専用serviceで採用Stateだけを保存する。

v3はv2 fieldに`sourceValues`（realizedPnl／swapPnl／unrealizedPnl／deposit／withdrawalの5 decimal）、`adoptedUnrealizedPnl`、`overrideFields`（原値と数値的に異なる項目の完全な集合）、`overrideUpdatedAt`を必須追加する。採用決済・swap・入出金は従来fieldを使う。sourceの決済・評価損益はSnapshot報告値と一致必須、差分なしなら採用値も一致必須。原値の変更・同じ採用先でのv3→v2降格をRepositoryで拒否する。元へ戻す場合は原値を保ったv3と空の差分集合になる。GMO envelope／recordは変更せず、最新Backup v9で原値・採用値・metadataを保護する（v5の受理範囲は固定）。v4の受理範囲は旧recordとv2に固定する。

## Current / Decided — GMO正式月末採用

GMOの正本取込元は月次取引残高報告書PDFのみ。明示保存でImportBatch（sourceType=pdf／sourceProvider=gmo／hash・size／importerVersionのみ、sourceScope・filename・原本なし）、AccountSnapshot（imported／gmo-fx-monthly-report／officialMonthEnd／JPY）、MonthlyAccountState record v2を一回のRepository transactionで追加・確定する。Accountは保存時だけ必要なら作成する。

SnapshotのcashBalance／netAssetValue／unrealizedPnl／reportedMonthlyRealizedPnl／accountSpecific.requiredMarginはPDF観測値。assetValueに純資産を重複保存しない。StateのrealizedPnl／swapPnl／deposit／withdrawalはその月のledgerへの明示採用値で、reportedMonthlyRealizedPnlとの数値一致を必須とする。StateはadoptedAccountSnapshotIdを参照しSBI専用3参照はnull。targetMonthと正式月末日snapshotAsOfを一致検証する。保存日時は保存開始時に付与する。

同一hashは通常取込済みで変更なし（旧Batchの明細0件時の明示補完条件は上記）。同月別hashは自動採用せず、ユーザーの訂正確認後だけ新Batch・新Snapshotへ切り替える。State IDは保持しconfirmedAtを更新し、旧観測・Batchは削除しない。legacyへコピーせず、2026-09以降のState不在はmissing、有限非ゼロの旧GMO月次入力はconflict。

## 汎用月次採用参照（Current / Decided）

MonthlyAccountState record v2は旧11fieldに`schemaVersion: 2`と`adoptedAccountSnapshotId`を追加する。GMO採用ではSBI専用3参照をnullとし、同一口座・月、PDF Batch、`gmo-fx-monthly-report`、imported、JPY、正式月末日・officialMonthEnd、報告損益と採用損益の一致を検証する。旧SBI record・保存キー・envelope v1は維持し、Migrationしない。GMO PDF UI／明示保存／共通集計は接続済み。

**Decided**：現在保有はstable Instrument ID／code／tickerで同一性を維持し、表示名を現在名へ更新できる。名称変更だけで別Instrumentを作らない。過去取引は取引当時の名称を保持する。7606のユナイテッドアローズ→TABAYA HDは説明例であり、既存履歴を書き換えない。

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

**Decided / SBI cutover**：`acc_sbi_sec`は2026-08以前のlegacy正本を維持し、2026-09以降はMonthlyAccountStateと明示採用先だけを月次正本とする。State不在は未確定で、legacy placeholderへfallbackしない。月全体の`__saved`だけではSBI入力の証拠にならない。SBIの直接月次入力（決済・スワップ・入出金）に有限な非ゼロ値があればlegacy conflictとして停止する。holdings、派生評価損益、netAssets、全ゼロplaceholderはこの証拠としない。旧全ゼロ値の入力由来を一意に復元するMigrationは行わない。

**Decided**：今回のSBI保存UIでは、国内採用Batchと全保有の評価額・評価損益・取得日、外国証券評価額・評価損益・取得日、現金残高・取得日、実現損益・入金・出金がすべて必要。明示0は有効、blank／nullは不完全とする。`acc_sbi_sec`の新方式に限り`swapPnl: "0"`を固定し、他証券口座・旧月へ一般化しない。schemaのnull許容は変えない。

**Current**：`assets/sbi-monthly-save.js`は表示時の国内採用IDと最新モデルを再照合し、複数Batchを停止する。外国証券・現金のmanual AccountSnapshotとMonthlyAccountStateを一回の`repo.commit(..., {expectedModels})`で保存・再読込検証する。manualには`observationType: approximateForMonth`を付け、月末日でも正式月末へ昇格しない。訂正ではState IDを維持してconfirmedAtを更新し、変更したmanual値／日付は新Snapshot IDへ参照を切り替え、旧recordを保持する。未変更の採用先は再利用できる。Inputの口座内保存UIとMonthly Summary／Top／Asset Trendは同じ共有resolver／計算へ接続済み。

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

**Decided**：上記11fieldは必須。id／accountId／targetMonth／タイムゾーン付きconfirmedAtはnull不可。参照3fieldはIDまたはnull、金額4fieldはdecimal文字列またはnullで、明示0と不明を区別する。旧recordのschemaVersionは省略または1、汎用採用は2＋adoptedAccountSnapshotId、手修正は3＋本書のsource/adopted/override必須fieldを持つ。合計評価額・Draft・表示fingerprintは追加保存しない。record存在だけで全項目既知とはしない。

**Decided**：同一`accountId + targetMonth`に複数recordを許さない。初回IDは既存`newId`で生成し、将来同じ口座・月を修正するときは同じIDを維持する。口座参照を検証し、非nullの採用先は口座・対象月を一致させる。外国株／現金参照は対応するmanual scopeかつJPYであることを要求する。国内BatchはSBIのCSVで、同じBatchに属する`sourceScope: sbi-domestic-holdings`の保有record集合が存在することを根拠とする。約定Batchや名称だけで国内保有と推測しない。

**Decided**：同じ月の全保有Batchを加算せず、`domesticImportBatchId`の集合だけを採用する。latest importedAtを自動採用しない。Input編集中Draftはメモリ上で分離し、明示保存成功時だけ正本を更新する。CSV保存だけでは月次確定にしない。2026年1〜8月を自動migrationせず、新方式とlegacyの同じ範囲を二重加算しない。

**Current**：MonthlyAccountStateのRepository・schema・参照検証は実装済み。必須11field、null可否、同一口座・月の一意性を検証し、Repository更新では同じ口座・月のID維持とIDの付け替え防止も確認する。Inputでは2026年9月以降のSBI口座を新方式に分離し、国内保有不在でもlegacyへ戻さない。月次状態が未保存なら対象月・口座・国内保有scopeが一致するBatchが1件のときのみ表示候補として読み、複数なら選択せず表示を停止する。月次状態の明示採用先がある場合はその参照だけを読む。金額は既存の共通decimal加算で集計し、必要値のnull／欠損・JPY以外は不明とする。AccountSnapshotや月次状態を表示のために作成しない。

**Current**：新方式SBIの決済・入出金編集は月別のメモリ上Draftのみとし、legacy `tradingData`へのコピー・既存保存ボタンからの保存を行わない。国内採用値・入力済み外国証券／現金／月次値を口座内の「保存」で同時保存し、全必須入力が揃った場合のみ月次確定し、Summary／Top／Asset Trendへ接続する。2026年9月は国内値の表示だけでは入力済み・確定にならない。2026年1〜8月は従来のlegacy Inputを維持する。9月以降の未確定月をplaceholderへ戻さず、自動migrationしない。

**Current / Decided**：正常に解決した`acc_sbi_sec`・`imported`・`sbi-domestic-holdings`の国内保有Batch集合に限り、既存保存経路が省略していた`currency`の未設定／`null`をInput読込時に後方互換として許容する。明示的なJPY以外は表示を停止し、空文字はschema不正として拒否する。通貨をrecordへ補完せず、他口座・他取得範囲・AccountSnapshotへ一般化しない。金額の欠損を0にせず、表示によるmigration・月次確定は行わない。

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
| GMO FXneo | 月次取引残高報告書PDFのみ | ローカル解析・照合・明示保存・月次State採用を実装済み |
| LIGHT FX | 月次PDF | 同上 |
| みんなのFX | 月次PDF | 同上 |
| SBI証券 国内株・投資信託 | 約定履歴CSV、保有証券一覧CSV | 取引事実と時点保有を別モデルへ保存 |
| SBI証券 外国株 | 当面手入力 | 将来Importerを追加可能にする |
| SBI VCトレード | 月次PDF | 資産／現物保有・現物買いのParser／確認保存／採用取引履歴を実装。月次P/Lは未接続 |
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

**Current**：`assets/data-model-storage.js`のRepositoryはAdapterを注入して使用する。実装済みcollectionとキーは次の9つ。

| collection | 保存キー | 責務 |
|---|---|---|
| `accounts` | `tradeScopeAccountsV1` | stable ID、口座、provider、有効状態 |
| `instruments` | `tradeScopeInstrumentsV1` | 商品識別。銘柄候補リストとは別物 |
| `importBatches` | `tradeScopeImportBatchesV1` | 取込単位、最小出所metadata |
| `rawTransactions` | `tradeScopeRawTransactionsV1` | 取引事実。戦略・Risk・ユーザーMemoは受理しない |
| `holdingSnapshots` | `tradeScopeHoldingSnapshotsV1` | 一取得元・一観測の保有状態 |
| `accountSnapshots` | `tradeScopeAccountSnapshotsV1` | 一取得元・一観測が報告する口座状態／取得範囲 |
| `monthlyAccountStates` | `tradeScopeMonthlyAccountStatesV1` | 口座・月の明示確定、採用先参照、月次台帳入力。合計値は保存しない |
| `monthlyAccountInputs` | `tradeScopeMonthlyAccountInputsV1` | 月次のpartial／原値／採用値／訂正履歴 |
| `importedTransactions` | `tradeScopeImportedTransactionsV1` | PDF等の明示売買source。月次・時点保有とは分離 |

**Current**：キーが存在する場合は`{schemaVersion: 1, records: [...], updatedAt: ISO日時}`。キー不在は読み込み・バックアップ上`null`で表し、空envelope、架空の更新日時、Account seedを自動保存しない。recordの`schemaVersion`は原則省略可／`1`。MonthlyAccountStateの汎用採用recordは明示`2`、手修正recordは明示`3`。すべてのrecordにstable `id`を要求する。

**Current**：`read` / `list`は非破壊。`commit`は複数envelopeを全検証後に保存し、`save`と同一IDへの`upsert`も同じ入口を使う。既存Account IDを落とす更新は拒否し、無効化を優先する。Migration、別IDへの暗黙統合はしない。Account / Instrument / Batch / 関連Snapshotの参照、重複IDを検証する。imported Snapshotは一つのBatchへ関連付け、口座・保存時点・観測時点・対象月を照合する。同じAccountSnapshotに属するHoldingの取得範囲・出所も一致させ、複数ソースを合成保存しない。

**Current**：数値はdecimal文字列または`null`／欠落で、浮動小数Numberを拒否する。日付のみ、タイムゾーン不明、`snapshotAsOf: null`はその精度のまま保持する。混在列は`rawFields.settlementOrPnl`として保持できるが、実現損益に変換しない。`accountSpecific`は現段階でFXの`requiredMargin` / `maintenanceRate`、証券の`buyingPower` / `depositBalance`のみを受理する。

**Current**：ImportBatchは`id`、`accountId`、`sourceType`、`sourceProvider`、`importedAt`を必須とする。任意の`targetMonth`、`snapshotAsOf`、`importerId` / `importerVersion`、`sourceFileMetadata: {hash, size}`のみを追加できる。原本、ファイル名、絶対パス、個人識別情報、全行原文は受理しない。架空のparser versionも補完しない。

**Current**：未知field、非allowlistの`rawFields`、不正日付・型・schema version・prototype制御キーは拒否し、黙って捨てない。`sourceLocator`も絶対パス・URLを受理しない。rawFieldsの許可項目は保有・約定Parserの金融事実列に限定する。ただし銘柄名等の許可文字列に個人情報が混入していないかを自動判定する機能ではなく、将来Importerでも抽出元確認が必要。

**Current**：Accountと外部取引IDの重複、同一Batch・行番号の再登録は拒否し、既存行を削除・統合しない。IDなしでは`dedupeCandidate`がブラウザ標準SHA-256でversion付き候補を作るだけ。正当な同一事実の複数約定は別ID・別行で維持できる。file hashを取引ID代わりにしない。

**Under consideration**：fingerprintの最終構成、decimal表記差、日時精度、訂正・取消、locatorだけの重複解決、手入力競合は未確定。現在の候補は口座・商品・日時・売買・取引種別・数量・単位・価格・通貨を比較する技術基盤に限定する。月末性の正式名称・根拠確認フローも未確定で、候補属性`observationType`（`officialMonthEnd` / `approximateForMonth` / `pointInTime`）は指定時のみ保存し、自動付与・昇格しない。

**Current**：Instrument照合は保存予定Previewと確認後保存エンジンで共有する。AccountInstrumentSetting、TransactionAnnotation、Risk設定のRepository／UIは未実装。RawTransactionは既存履歴へ自動反映しない。SBIの月次確定・明示採用データのみ共有月次計算へ接続する。

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

**Current / Decided — PDF原本のセッション参照**：取込中のGMO／LIGHT FX／みんなのFXの選択Fileは画面内メモリだけで共有Viewerへ渡す。reload／pagehide後に復元しない。PDF binary、Blob、ArrayBuffer、base64、object URLをStorage／Backupへ追加しない。ImportBatchや永続schemaは変更せず、完全Backup v9を維持する。共通extractorの`pages.number`、保存された`sourcePage`、Viewerの`initialPage`はPDF.jsの物理ページ番号（1始まり）であり、帳票内の印字ページ番号とは別である。

**Under consideration**：永続PDF archiveとTransaction Historyから原本ページへの移動は別仕様・別工程。現時点で履歴から開ける原本参照は追加しない。

- 旧キーを即時削除しない。
- 新形式を導入する場合は旧形式読込→正規化→新形式利用を可能にする。
- 移行前のデータを退避する。
- 移行済みバージョンを記録し、二重変換を防ぐ。
- 欠落項目には安全な初期値または`unknown`を使う。
- 既存データの意味が不明な場合は変換せず、確認対象として残す。

**Current / SBI Input**：外国証券の評価額・評価損益・取得日、現金残高・取得日、実現損益・入金・出金を非永続Draftとして編集する。0 placeholderは使わず明示0を受理する。検証済み保存後も「保存」ボタンを維持し独立した「保存済み」行は置かない。編集中の集計は直前の正本から計算する。

## Current / Decided — SBI国内採用値と部分入力

保存キーは`tradeScopeMonthlyAccountInputsV1`、entityは`monthlyAccountInputs`。envelope v1／record v1。必須fieldはschemaVersion、id、accountId、targetMonth、domesticImportBatchId、sourceValues、adoptedValues、overrideFields、overrideUpdatedAt、foreignAccountSnapshotId、cashAccountSnapshotId、realizedPnl、deposit、withdrawal。2つのValuesはmarketValue／unrealizedPnlのdecimal文字列、手入力参照・月次3値はnull可。口座・月は一意でIDを維持する。sourceValuesは同一国内BatchのHoldingSnapshot集計と厳密一致し、overrideFieldsは原値との差の正確な集合である。

MonthlyAccountInputは編集採用値の正本であり、観測Snapshotでも月次確定Stateでもない。国内原値・個別Holding・取得日は変更せず、原値はBatch＋Holdingから再構築できる。partialでも採用値を保存できるが、不足外国／現金／月次項目を0へ変換せず偽のStateを作らない。入力済みmanual Snapshotと参照・月次値を一回のRepository transactionで保存する。既存Stateとの参照・月次値一致、scope・取得元・通貨を検証し、原値・IDの書換えとmetadataの虚偽を拒否する。表示・Draft編集・readでは保存しない。国内2項目のフォームは編集可能、取得日はread-onlyとする。
