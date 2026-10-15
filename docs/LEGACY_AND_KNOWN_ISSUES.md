# Legacy, Experimental, and Known Issues

## Current — Open Positions公式化の限定範囲（v318）

LIGHT／みんなのOpen Positionsだけ公式月末観測へ切替。PortfolioのFX保有比率（推定必要証拠金）とRiskはmanual由来のままで、元データの一時的不一致は既知の移行境界。manual／PDF照合、Portfolioの役割・比率、Riskの公式化は別工程。SBI VCの既存official readerとGMOのlegacy表示は変更しない。

同じPDFのNAV／価格評価損益へ一意に結び付かない場合、未対応importer、破損参照、証明できない空集合はunknownで停止表示し、manualや別月へfallbackしない。公式建玉はリアルタイムではなく基準日の観測。Chrome接続不可で実ブラウザ390px／1280px・overflow・Console・既定History回帰・PDF抽出は未確認。匿名DOM／VM成功と区別する。Backup v15、新position-set永続化なし。 以下の旧版記述は当時の工程境界。

## Current — 残高再取り込み整合（v317）

LIGHT／みんなの旧candidate-only訂正を置換し、確認後はPDF残高と受渡aggregateを一括更新する。同一PDFの不足candidate／使用判断はcanonical再利用で補完可能。manual calendar／独立manual原値は保護し、旧PDF補正は履歴に残して新PDFへ持ち越さない。由来を特定できない場合やRepository参照破損は停止し、validator回避／record削除による復旧をしない。同一hashで金融事実が異なる再解析も上書きせず停止する。

Backup v15維持。transaction保存／History／manual reconciliation／official position-set／Portfolio・Open Positions移行／Riskは今回変更しない。Chrome接続不可のため実ブラウザPDF経路、390px／1280px・overflow・Consoleと既定History回帰は未確認。匿名DOM／VMの成功と実ブラウザ確認を区別する。 以下の旧版candidate-only等の記述は当時の工程境界。

## Current / Known boundary — LIGHT／みんな共通取引保存（v316）

みんなのFXもv3 production取引保存を有効化。LIGHTのnormalizer identityを維持し、同一PDFはidempotent、訂正版・解析差は旧原値を保持して確認後に使用先を更新する。manualデータは保持し、reconciliation v2／official position-set／Portfolio・Open Positions移行は未実装。transaction-only Batchをmonthly sourceや年一覧に数えず、後日のbalance保存は既存Batchを検証して共有する。

みんな実PDFで確認済みは新規買／決済売。新規売／決済買、同一注文multiple fillsはsynthetic検証の範囲、非ゼロfeeの意味は未検証で従来どおり保存停止。深刻な参照破損の強制修復はしない。ブラウザ未接続・PDF.js実経路未確認を残し、別抽出器でのread-only検証と区別する。Backup v15維持。以下の旧版記述は当時の工程境界。

## Current / Known boundary — LIGHT取引保存（v315）

LIGHT v3 production保存と既存History表示を接続。2026-09以前はtransaction-only、残高cutover／legacy ledgerは変更しない。正常同一PDFはidempotent、候補追加だけでは使用collectionを切替えず、明示取込／更新確認のみで使用判断する。旧revisionは保持。

みんなのFX production transaction保存、manual reconciliation v2、official position-set／Portfolio・Open Positions移行は未実装。深刻な参照破損は通常再取込で修復しない。非ゼロfeeの意味・同一注文multiple fillsは実データ未検証（後者の保存契約はsyntheticで検証）。以下の旧版記述は当時の工程境界。

実ブラウザ接続不可で390px／1280px・Console・既定History回帰は未実施。実PDFのparser／v3計画検証にはローカル別抽出器を使用し、Node PDF.jsでは0文字だった。既存extractorや実ブラウザ経路の問題と断定せず未確認事項として保持する。productionデータは未操作。

## Current / Known boundary — SBI VC再取り込み（v314）

旧採用互換で残高が正常でも月別表示がmissingになる接続差を解消。同一PDFのalready-importedは金融原値保存済みを意味し、明示再取り込み時は共通参照・使用値も検査する。正常canonicalは複製せず、別PDF・補正・manualは確認なしに置換しない。訂正旧原値／共通履歴を保持する。

canonical内容の不一致・新normalizerによる再解析revision・深刻なRepository参照破損の一般復旧は対象外で、安全側で停止する。SBI VC canonical月次P/L・取得原価・cashflow・Transaction History契約は今回拡張しない。Backup v15維持。以下の旧版記述は当時の工程境界。

実ブラウザ接続不可のため、v314月別表示／再取り込みUIの390px／1280px・Consoleと、v313 History指定10項目は実機未確認。匿名DOM／VM・全2087テストのPassを実ブラウザ結果としない。次回接続可能時、新実装前に回帰確認する。

## Current / Known limitation — FX v3 History reader（v313）

共通adoption readerとv3 History projectionを接続。balance採用とは独立し、unknown／defer／正式空集合／stale／conflict／参照切れを区別する。v3は既存reconciliation v1と自動dedupeの対象外。GMO v1／SBI VC v2は旧active Batch互換を維持しmigrationなし。

LIGHT／みんなproduction保存hook、reconciliation v2、official position-set／Portfolio・Open Positions移行は未実装。History表示は匿名synthetic検証であり、新規売／決済買・multiple fills・非ゼロfeeの実PDF検証完了を意味しない。実ブラウザ390px／1280px・Console確認はブラウザ接続不可で未実施。以下v312の未接続記述は当時の工程境界。

## Current / Planned — FX transaction契約と未接続境界（v312）

record v3・参照型collection・append-only adoption／defer・Backup v15は実装済み。既存v1／v2をbulk migrationせず、monthlySources／reconciliation v1／旧採用・金融計算を維持する。Historyのv3除外は誤流入防御だけでconsumer対応ではない。

**Planned**：共通transaction reader／History projection、LIGHTのatomic candidate保存・明示採用、実運用照合要件を確認後のreconciliation拡張、みんな保存、将来GMO新sourceのv3化。今回reconciliation v2はv15へ入れないため、正式追加時のBackup versioningは改めて判断する。過去月の2026-09 cutover解除、official position-set、Portfolio／Open Positions移行は別工程。

**Known limitation**：新規売／決済買、同一close order multiple fills、非ゼロfee符号はsynthetic契約検証であり実PDF確認済みではない。実例のswap差の理由・未確認帳票・ページ跨ぎ論理行は未確定。partial collectionはcandidate-only、完全採用不可。production save未有効、UIなし、実ブラウザ未検証。複数タブの完全排他は既存限界。

## Current / Known limitation — Traders実約定parser-only（v311）

LIGHTの新規8行／決済10行、みんなの新規3行／決済4行をread-only実PDFで確認し、共通execution正規化を追加。LIGHT新規8行・みんな新規3行は公式月末建玉と全件照合。LIGHTの決済realized／swap／fee合計は受渡集計と一致。みんなのrealized／feeは一致、transaction swapは帳票行の明示0と受渡集計の非0が一致しない。数値欄の読み取りを再確認済みで、差を勝手に補正・calendar化せず警告を保持する。追加swapの発生理由は未確定。

新規行の空欄金融値と建玉なし維持率dash、小数同値比較を修正。今回の実例は新規買・決済売、同一新規注文への複数決済。新規売／決済買や同一決済注文のmultiple fillsはsynthetic検証のみ、非ゼロfee符号も実未検証。完全決済状態や元新規数量を推定しない。別ページにまたがる一つの論理行や未確認帳票形式は追加確認対象。維持率nullを既存保存schemaへ拡張する工程ではなく、保存guardは従来契約を維持する。正式取引保存／History／position-set／Portfolio／Open Positions／Risk移行は非接続で、FX transaction vNext／Backup v15候補は次工程。以下旧版の実約定未確認記述は当時の検証範囲。

## Current / Known limitation — みんなのFX scalar接続（v310）

account scalar候補・共通採用resolver・既存UI・atomic hookをLIGHTと同じ実装で接続済み。旧account／spotの重複adoptionは履歴を保持してconflictで停止し、専用解消UI／自動削除・migrationは追加しない。みんなの訂正版もcandidate-onlyとなり、旧Input／State・flow／calendarは維持する。v309の「みんなはnativeのみ」「LIGHTに限り候補追加」は当時の記録であり、現在は両broker同じ契約。

確認済みみんな8月／9月実PDFは各2ページ・当月取引0件・月末建玉14行、parser内部照合Pass。実約定／partial close／multiple fills／取引ID identityは未検証。PDF約定Transaction History、公式建玉Portfolio／Open Positions、FX position-setは後続。calendarはmanualのみ、入出金event／internal transfer／cashback分類は未追加。Riskは将来の製品設計監査。user completion approval／進捗UI／全体計算統合も本工程の対象外。

## Current / Known limitation — LIGHT scalar接続（v309）

2metricのcommon候補・採用resolver・最小UI・atomic hookを追加。accountとFX Holding由来spotの同一評価損益が同時加算される潜在経路を新candidate生成とresolverで排他した。旧重複adoptionが存在する場合はconflictで停止し、履歴削除や自動採用解除は行わない。その監査付き解消操作は今回追加しない。

確認済み8月／9月LIGHT PDFは当月約定0件・建玉11行。parser内部照合と残高観測の確認であり、実約定・partial close・multiple fillsの実対応完了ではない。PDF約定のTransaction History、公式月末建玉のPortfolio／Open Positions、FX position-setは未接続。calendarは独立manual、cashback／internal transferのevent分類は未追加。Risk製品設計は後の全セクション監査、みんなのFX横展開は次工程。

訂正版の操作契約はLIGHTに限り候補追加へ変更。旧版の「訂正保存でnative採用切替」は履歴であり、currentでは既存Input／State・flow・calendarを維持し、残高source UIで明示採用する。全体の計算統合・user completion approval・進捗UIは今回の目的に含めない。

## Current / Known limitation — SBI period input bridge（v308）

正式common balance採用と既存manual monthly flowからderived period inputを作る。旧native外国／現金Snapshotだけを必須にする橋渡し不足は解消し、新MonthlyAccountStateは作らない。common判断がない月は旧契約、8月legacyはmigrationしない。部分残高やflow missingでcompleteにならず、stale／競合／参照破損は旧値へ戻さない。

flow入力UI／保存契約は既存のままで、domestic CSV等のnative入力参照が全くない月にflowを新規作成するgeneric UIは今回対象外。progress UI／user approval persistence／SBI holding-set・Portfolio／Open Positions移行は後続。Top／Allocationはcommon current balance、Portfolio／Open Positionsはlegacy＋manual差分という保有移行課題を維持する。SBI VC・Risk・cashflow architecture・外貨cashは未変更。旧版記述の「State自動完成橋渡しなし」は履歴であり、現在は非永続period bridgeを用いる。

## Current / Known limitation — 非永続月次進捗（v307）

required policy／progress APIを追加。financial completeと入力条件／user approvalは別。carryは既存current balance結果の入力時だけ表示用として評価し、当月充足へ使わない。legacy __saved／計算互換から新完了承認や未知zero根拠を推測しない。SBIの採用manual残高を評価できるが、native period Stateの自動完成橋渡しは未実装。SBI VC canonical period P/Lは未完成、SMBCは銀行残高scopeのみ。

進捗表示UI・承認永続化・承認stale履歴は未実装。SBI国内は原custody別Snapshot保持＋将来consumer銘柄集約を正式方針とし、common集合identity／正式な空集合／Portfolio・Open Positions移行は後続。foreign scalarとのcoverage差を恒久仕様にしない。金融計算・Risk・Transaction History・cashflowは今回未変更。Backup v14／キー／schema不変。

## Current / Known limitation — SBI scalar adoption（v306）

国内集計2metric・外国円評価2metric・JPY現金はcommon adoption／compatibility入口へ接続済み。独立manual scalarの作成・採用・比較・保留・補正・訂正UIはSBIへ接続。他口座UIは後続だがcontroller／rendererは口座非依存のtarget設定で再利用可能。旧補正は同じ原revisionを明示継続した場合のみcommon overrideへ接続する。

国内holding set、同一Instrumentの特定／NISA複数行identity、株／投信の独立更新、空の国内集合の正式確認は後続。国内CSV同月同基準日の訂正版はcommon国内採用がある場合に別candidateとして追加可能。採用なしの既存観測は従来どおり競合停止し、先に現候補を確認・採用する。訂正版追加だけではadoptionを変更しない。

Top／AllocationとPortfolio／Open PositionsのSBI残高sourceはまだ完全統一されていない。後者はlegacy holdings＋manual取引差分の移行途中で、恒久仕様ではない。外国Holding／数量推定、外貨残高・換算、入出金自動取得、internal transfer、配当、corporate action、Risk新sourceは未実装。口座flowを全体external cashflowと推測確定しない。独立manual残高採用だけでMonthlyAccountStateを完成させる橋渡しも行わない。

current carryは同一年内、固定historical月には混ぜない。8月legacy／9月canonicalは互換。browser一覧が空のため390px／1280px実表示・実Console未実施。匿名DOM検証とは区別する。

## Current / Known limitation — SBI VC最小採用UI（v305）

保有集合／JPYの既存候補を確認・採用・比較・継続・保留するUIを接続済み。下記v304の「本格採用UIは後続」は、今回の2component以外、独立manual source作成、最終デザイン、他broker UIを指す。旧source・履歴を残し、訂正候補の追加だけでcommon採用を切替えない。原値比較と補正後採用値は別表示。

保有集合comparisonは固定v14の原値一致判定で、小数表記差も差として残す。数値／表記正規化による比較契約拡張は今回行わない。旧補正フォームは同じ原sourceの修正だけ再利用し、別manual／別revisionの編集は引き続き後続。quick deposit／internal transfer／crypto transfer／staking／fee／売り／レバレッジ／損益・原価は未接続。

computer-useのbrowser一覧が空のため390px／1280px実表示と実ブラウザConsoleは未実施。匿名DOM検証とは区別する。本番Storage・実データ・実Backupは操作しない。


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
