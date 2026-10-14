# Product Specification

## Current / Decided — SBI期間計算bridge（v308）

common採用された国内評価額・評価損益、外国円評価額・評価損益、JPY cashを固定月の正式期間入力へ接続する。manual／CSVの自動優先なし。existing manual flowと参照条件が揃えば、別Stateを作らずderived resolverで期間計算可能。不足はpartial／missingで、残高差をP/Lにしない。進捗UI・完了承認・holding-set・Portfolio／Open Positions移行は未実装のまま。

Top／Allocationの現在資産と固定月末観測／期間ledgerのbasis差を維持する。current carryは期間計算に使わず、入出金自動取得・internal transfer・外国数量推定は追加しない。Backup v14／Storage契約不変。

## Current / Decided — 月次進捗API（v307）

6口座の共通required policyと非永続projectionを提供する。現在のUIに完了表示・演出は追加せず、将来の月次詳細6口座行へsourceあり／採用待ち／不足／条件充足／carry／要再確認を接続可能。条件充足だけで「完了」へ昇格せず、approvalStatusはnot-recorded。残高確認とperiod計算条件を別に返し、SBI VCの残高充足を月次P/L完成と表現しない。manual sourceは対等な正式入力。

**Planned**：ユーザー完了承認・再確認・履歴は別永続契約。SBI保有は原custody別行を残して表示時に口座×銘柄集約し、国内canonical／外国legacy coverageを明示する。外国scalarから架空holdingを作らない。今回はholding-set契約・Portfolio／Open Positions・最終UIを変更しない。

## Current / Decided — SBI入力元作成・採用（v306）

SBI月次Inputの「入力元・採用を確認」で国内集計2metric、外国円評価2metric、JPY現金を個別確認・採用する。種別・対象月・基準日・revision・原値／補正後値・候補・比較／staleを表示。CSV自動優先なし。

外国評価額／評価損益／JPY現金には設定可能なscalar manual source作成UIを接続。component／metric／JPY／対象月を明示し、値とdate-only基準日を入力する。blankは未取得、0は有効、負の評価損益可。作成だけでは採用を変えず、採用なしの場合だけ明示「保存して採用」を選べる。既存採用がある場合は候補作成後に別途明示選択する。

同内容／不一致／比較不能の記録だけでadoptionを切替えない。deferは有効な採用を維持。同revision補正・原値reset・manual訂正版を扱い、旧revision／補正を保持し新revisionへ自動継承しない。stale保存を止め、入力と選択を保持。月次flow Draftもsource操作で破棄しない。

国内holding set／株・投信分割／外国数量／外貨／配当／入出金自動取得／内部振替／Portfolio・Position canonical移行／Riskは対象外。1〜8月legacyは自動migrationしない。

## Current / Decided — SBI VC入力元の確認・採用（v305）

SBI VC月次Inputに「入力元・採用を確認」を追加。現物保有集合とJPY残高の現在採用、PDF／手入力候補、基準日・対象月・revision、旧訂正版、source原値と補正後値を確認できる。候補は個別折りたたみ、明示選択後に保存で確定する。PDFを自動優先せず、保有集合とJPYを別々に採用できる。

操作はsource採用／現在採用継続／同内容確認（または不一致・比較不能記録）／判断保留。比較だけでは採用を切替えず、既存有効採用があるdeferは維持する。空集合は「保有なしを確認済み」、missingは「—」、現金明示0は「0円」。stale／競合は0化せず保存停止。cashflow・P/L・取引履歴・Riskは対象外。大規模デザイン変更・独立manual source作成フォームは今回追加しない。


## Current / Decided — SBI VCの共通残高source（v304）

SBI VC PDFの現物保有集合とJPY残高を対等source／明示adoptionへ接続する。PDF保存は原値参照candidateを取得し、既存manual採用を自動置換しない。新判断がない既存月は旧観測採用・補正を互換表示する。全保有0は「正式確認した空集合」であり、未取得とは異なる。

Position／Portfolio／Top／Allocationは同じ残高採用入口を参照する。Portfolioの現金は別明細、Top／AllocationのJPYは従来どおり暗号資産口座額に含める。帳票合計・担保評価を追加資産にしない。取引履歴と現在保有は別契約で、残高採用操作から取引採用を変更しない。月次P/L・quick deposit・staking・fee monthly flow等は未接続。


## Current / Decided — 対等なsourceと明示採用

PDF／CSV／独立manualの正式source候補を保持し、口座・月・component・metricの採用値を1つだけ選ぶ基盤を追加。公式資料を自動優先せず、一致確認でもmanual原値と採用を保持する。不一致は選択またはdefer、比較不能は別状態。独立manualとsourceに対するoverrideを区別し、訂正は新revision、旧source／判断／補正を監査用に保持する。

現行Input UIは変更せず、大規模比較UI・大量の新手入力項目・完了承認UIは未実装。共通APIで作成・採用・切替・補正・確認を検証し、採用後は共通resolver／display-results／balance-viewへ接続する。取得、採用、必須値、過去値使用、完了承認は別状態。残高だけcarryし、flowを引き継がない。whole totalと内訳を二重加算しない。

既存legacy／canonicalの採用は互換adapterで維持しbulk migrationなし。原PDF／CSV・本文・PIIは保存せず、Backup v14が新契約を保護する。本番値は基盤導入だけでは変更しない。以下のv300時点の「永続基盤は次工程」は、本格source比較・採用UIと口座Input接続を後続に残す方針へ移行する。

## Current / Decided — 共通指標の表示と月次詳細

Topと損益管理は非永続の`display-results`から同義・同時点の主要指標を参照する。純資産（月次集計）・確定資産・純損益・確定損益は共通monthly dashboard、年間決済損益・swap・入金・出金は共通yearly totalsが正本から算出する。Topはこれらを独自再計算しない。Topの現在把握残高は別のcurrent balance Viewであり、年間サマリーの「純資産（月次集計）」と区別する。各口座の対象月・完全性・根拠を保持し、同額でも異なるbasisを同義と扱わない。

年間純資産カードも表示本体と比較値のbasis／対象月／完全性が一致する場合だけ増減額・成長率を表示する。不明・部分額・競合・根拠差なら「—」、年初純資産が不明または0以下なら成長率は「—」。current carryを年間／固定月末／期間損益へ流さない。

月次詳細は設定済み6口座をデータ有無によらず表示する。月全体が未入力でも行を残し、未入力・取得失敗・競合は「—」、明示0は「0円」。当月値に前月や年初額を代用せず、missing行を0として合計しない。安全な開設月情報がないため開設前の推測除外は行わない。状態は表示の有無とは別のmetadataとして保持する。2026年1〜8月のlegacyを自動migrationせず、9月以降の観測を過去月へ混ぜない。

**Planned**：PDF／CSV／独立manual sourceを対等な候補とし、採用値を1つ選ぶ正式な永続source／adoption基盤は次工程。今回の表示共通化はその永続契約を追加するものではない。

## Current / Decided — 最新資産の未確認残高

Top純資産・Asset Allocationは同じcurrent残高Viewを使用する。最新月未確認の残高は0にせず選択年内の直近確認済み残高を一時表示できる。項目ごとの確認月・以前の確認値使用中・未取得・明示0を保持し、口座tooltip／配分補助表示で確認できる。旧値を最新月へ正式保存せず、取得済み小計と全残高component確認済みを区別する。最新明示0・保有終了は旧positiveへ戻さない。

SBI証券は国内証券／外国証券／現金、PDF一括口座は口座単位で対応する。SBI VCは最新採用保有集合を維持し不明数量や終了銘柄を復活させない。Portfolio／Open Positionsは不変。月次／年間損益・確定資産・Annual Summary・過去Trend・Riskへcarryを渡さない。下記の旧部分表示policyは期間consumerとして維持し、Top純資産とAllocationの残高参照は本節を優先する。アラート・進捗・完了演出や正式入力元の永続保存統一は今回対象外。

## Current — Top純資産の比較不可能な期間指標

純資産カードの金額と既存期間値の根拠・対象月・完全性を共通projectionで照合し、比較不可能な場合は変動額／年間成長率のみ「—」にする。SBI VCの採用済み資産観測は、同額でも期間計算と同じ意味とはみなさない。資産額・Allocationと他のKPIは従来どおり。追加説明文・UI全面改修・新しい損益計算は行わない。

**Planned**：全口座canonical化後に、[CALCULATIONS](CALCULATIONS.md)の「全口座canonical化後の計算・データ整合監査」で各指標の正本・時点・入出金・unknown／partial・current／period・比較可能性を再確認する。この局所修正を全体整合の完了とは扱わない。

## Current / Decided — SBI VCのTop純資産・Asset Allocation

両表示は同じ非永続資産projectionを使用し、選択年内の最新採用現物の既知円評価額＋採用JPY残高で旧SBI VC口座額を置換する。JPYも現行の口座区分ベースの「暗号資産」に含める。対象年に採用sourceがなければ未取得で、別年・legacy・取引履歴へ戻さない。Portfolio／Open Positionsは全年横断の最新採用保有のまま。

これは把握済み現物・現金の観測額であり完全NAV・月次損益確定ではない。実際のsource月と、必要なら「評価額取得分の比率」を表示する。帳票合計・担保評価を追加せず、原本・Storage・Backup v13は不変。年間損益・変動額・成長率・Trend・Annual Summary・Riskは既存期間計算を維持し、この観測額との差を損益にしない。他口座の額・source選択は維持する。負額口座の配分除外等によりTopと配分全体の合計差は残り得る。

## Current — SBI VC Open Positions / Portfolio

最新採用済み現物保有の数量・評価レート・公式円評価額を表示する。Inputで保存された手動補正も反映し、原本値は変更しない。評価レートは平均取得レートと区別し、取得原価・評価損益は「—」。0／不明数量・訂正前保有・担保評価を現在保有として表示しない。保有観測行から手入力決済を生成しない。取引履歴とは責務を分離し、他口座の既存集計と他画面の計算は維持する。

Portfolioの暗号資産タブも同じ最新採用保有を使用し、Topの年選択に左右されない。「JPY（現金）」は補正後cashBalanceを別明細として含む。帳票資産合計・担保評価を加算せず、一覧と円グラフは同じ評価額を使用する。数量・評価レート・評価額はdecimal精度を維持し、一部評価額／数量が不明な場合は「評価額取得分の比率」とする。最新0件・採用なし・読込失敗でもlegacy SBI VC保有／取引へ戻さない。詳細は数量／取得原価／評価レート／評価損益を区別し、取得原価・評価損益は「—」。Top純資産・Asset Allocationは上記の選択年資産Viewを使用する。Risk・Transaction History・月次計算には資産観測を流さない。

## Current — 取込時の手入力比較

GMO PDF／SBI証券CSV／SBI VC PDFの保存確認内で、共通照合候補があれば口座・銘柄・売買、手入力概要、取込件数と合計を表示する。「手入力のデータと一致します」と「手入力のデータと一致する可能性があります」を使い分け、操作は「PDFデータに置き換える」／「CSVデータに置き換える」、「両方残す」、「今回は判断しない」。強一致では置換を初期選択するが、保存確認なしに確定しない。曖昧候補は置換不可。内部IDやモデル用語は表示しない。

置換した手入力は監査用に原recordのまま保持し、共通Transaction Historyの通常集合からだけ除外する。取込約定は全件残す。未一致・保留・両方保持は通常集合に残る。判断保留は同じsourceの再選択時に確認し直せる。保存済みの同じsourceも関係だけ追加確認可能。訂正版の取引事実が一致する場合は採用sourceへ再照合し、置換を孤立させる変更は保存停止する。Backup v13で関係と原本を保護する。Open Positions等への追加接続は今回行わない。

## SBI VC月次PDF Preview

**Current / Decided**：標準入口は月次報告書PDF一つ。SBI VCカードでローカル解析し、対象月・date-only基準日・JPY残高・帳票上の資産合計・現物数量／評価レート／公式円換算額を確認する。残高0の銘柄とレバレッジ口座・入出庫／報酬は折りたたむ。共通「PDF原本を確認」を使用する。資産合計を完全な純資産と呼ばず、現物取得原価・月次損益を推定／0表示しない。

**Current**：Previewで確認後「保存」から資産・現物保有・検証済み現物買いを保存する。成功後は取引があれば「資産・保有・取引情報を保存済み」、なければ「資産・保有情報を保存済み」。同一PDFは全原本保存内容照合後no-op、訂正版は確認後に採用sourceを切り替えて旧sourceと補正履歴を残す。Inputは共通accordion内で対象月・基準日・JPY残高・帳票資産合計と採用sourceの現物を通常read-only表示し、「修正」で値だけを非永続Draftへ編集する。「保存」で補正を確定、「キャンセル」で元の採用値に戻る。「PDF値に戻す」も最後の保存まで永続変更しない。補正があれば控えめに「手動補正あり」と表示する。原本値・identity・対象月・基準日は編集しない。訂正版の新公式値に旧補正を自動適用しない。損益未確定でありMonthlyAccountStateは作らない。Backup v12で保護し、legacy・Risk・Top／月次consumerは不変。ZIP／CSVを標準フローへ追加しない。

**Known limitation / Planned**：現物買いのみ実帳票検証済み。現物売り／レバレッジ／建玉／貸出行は未検証。現物原価・実現／評価損益、報酬・cashflowのcanonical化、未検証取引、暗号資産partial projectionは別工程。帳票資産合計をレバレッジ込み完全純資産として扱わない。

**Current / Decided**：残高表の0行はPreviewで確認可能なまま、保存対象は正の保有と同じ口座の採用済み正の保有履歴に根拠がある明示0に限定する。同月訂正の正→0も保持する。未保有の0列挙だけでInstrumentを登録しない。確認画面の銘柄件数は保存対象数とし、省略した0行をエラー扱いしない。帳票資産合計は公式値を維持し、Backup契約・他画面への接続は変更しない。

## Current / Decided — 共通取引履歴

FXの一覧・詳細は「約定レート」とquote通貨を明示し、原価格の精度を維持する。日付のみの取引に時刻を補わない。詳細は「取引詳細」「原本・監査情報」に分け、FX数量は「1Lot（10,000通貨）」のように統合する。出典／確認可能な原本位置／注文番号は後半へまとめ、FXの資産種別や重複する取得元表示は省く。

**Current**：manual legacy／SBI RawTransaction／GMO・SBI VC imported sourceを非破壊でnormalizeする共通resolverとBackup v12を使用する。GMO PDF保存は明示された約定内訳を月次sourceと同じ操作で保護する。履歴一覧は短縮日時・口座・銘柄・売買／区分・数量または金額・明示個別損益のコンパクトな行とし、タップで1件だけ詳細展開する。取得元／監査参照・注文番号・資産種別・戦略／メモ・手入力編集は詳細側へ置き、空の任意項目は表示しない。対象月・口座は常設、銘柄・戦略・区分・取得元・並び順は「絞り込み」へ収納し、閉じても適用状態を維持して有効数を示す。50件単位の追加表示と既存filter／dedupe結果は維持する。件数は全件表示なら「44件」、途中なら「100件中50件表示」。取込行は読み取り専用、元sourceを保持し月次canonicalとは分離する。履歴ページのBackupは引き続き手入力だけ、取込データはTopの完全Backupに含む。Top／Allocation／Portfolio UI、Risk、PDF Viewerは共通基盤を維持する。

**Current / Decided — 表示要約**：Lotは単位が判明した数量から表示時だけ換算し、未知単位は原数量を維持する。国内株式の株数・1株単価が明確な場合だけ金額を概算し「約」を付ける。原資料に明示された取引／受渡金額を優先し、混在する受渡金額／決済損益列はその名称を詳細に保持してrealizedPnlへ変換しない。投信は口数×基準価額を計算せず、外貨は元通貨のまま。個別損益は決済の明示値だけを符号付きで表示し、nullは非表示、明示0は0円。数量・元資料・保存形式・共通月次計算は変更しない。

## Traders PDF-only partial保存 / Backup v8

**Current / Decided**：LIGHT FX／みんなのFXはswap空欄でも確認後にPDF原値・建玉・部分入力を保存できる。空欄はmissingで、MonthlyAccountStateを作らない。後からInputで収益カレンダー「スワップ付与」月間合計を入力し、口座内「保存」で完全時だけ確定する。正数・負数・明示0を受理し、PDF＋swapの同時確定も可能。成功後は「保存済み」、同一hashはpartialでも無書込。訂正版は明示確認が必要で、既存calendar原入力／採用値はPDF訂正だけでは消さない。Inputは同じFX5項目・非永続Draft・口座単位保存を維持する。2026-09以降は建玉別手入力を表示せず、2026-08以前は不変。

**Current**：未確定PDFの観測純資産・価格評価損益・既知flowは共通partial projectionへ反映する。未入力swapは「—」、取得済み値の合計は暫定であり、月次確定や0保存とは区別する。

## Traders Securities monthly PDF

**Current**：トレイダーズ証券の共通月次PDF ParserはLIGHT FX／みんなのFXを帳票の口座商品で区別し、異なる口座への保存を拒否する。GMOと同じローカルPDF.js・Preview・確認後保存を利用する。SBI VCは対象外。

## Current / Decided — 最新把握額と選択月の部分表示

Topは全口座が同一月まで確定した決算ではなく、現在把握できる最新資産状況を表示する。純資産・口座一覧・pieは上記「現在残高」の同じ表示用Viewを利用し、最新未確認の残高は確認月付きで直近確認値を一時使用できる。「最新値・一部暫定」を控えめに表示し、その補助情報で項目の確認月／過去値使用／未取得／明示0を確認できる。損益・成長率は完全な期間値からのみ計算し、純資産の期間比較は比較可能時だけ表示する。

年間Summary／Asset Trendは既存の期間projection、Performance Trendは同じ損益値を使用する。Topの確定資産・損益はその期間結果を維持するが、現在純資産／Allocationは残高Viewで置換するため過去series・年間Summaryとの単純一致を要求しない。実データのない月に点を生成しない。年間決済・swap・入出金は取得済み月の値を順次反映し、carry残高を加算しない。

Monthly Summary／Monthly P/Lは選択月だけを見る。取込済み観測がある口座をState未確定だけで非表示にせず、SBI国内評価額・評価損益も表示する。未入力は「—」、明示保存済み0だけを0円とする。未完成の合計は「暫定」で、前月値を混ぜない。表示だけで月次確定・正本書換えを行わない。

## Current — GMO月次保存と訂正

GMO FXneoの月次PDFはPreviewだけでは保存せず、確認後に月次採用を確定する。同一ファイルは保存済み、同月別ファイルは明示訂正し旧観測を保持する。未対応・照合失敗・旧入力競合では保存しない。取込後のInputは5項目を編集可能とし、口座内「保存」で原PDF値を保持した採用値を確定する。

## Current — GMO月次PDF Preview

GMO FXneoは月次の取引残高報告書PDFだけをローカル解析する。Previewは対象月、月末日、決済損益、スワップ、入出金、評価損益、現金残高、純資産、必要証拠金を表示し、個人情報を表示しない。明示確認後にPDF Batch・口座Snapshot・月次Stateを同時保存する。正式合計と取得できた明細・区分別小計・残高式を照合し、不一致、必須値不足、未知区分、非ゼロ手数料、締後移動、未対応の外貨残高は保存不可とする。

**Current**：完全バックアップの最新出力はv10。旧record、State v2、手修正State v3の原値・採用値・変更metadataとSBI部分入力を保護し、v1〜v7互換を維持する。GMO PDF取込UI・月次保存は接続済み。手修正は原Snapshotを保持し、明示編集保存だけでv3化するserviceを用意し、表示だけでは旧v2を変更しない。

## 1. 製品定義

**Decided**：TradeScopeは、FX、株式、ETF、投資信託、暗号資産、銀行預金等を横断して管理し、資産、損益、ポジション、Riskを把握する個人向け資産管理Webアプリである。

**Decided**：家計簿ではなく、投資・資産管理を主目的とする。日常消費の分類や家計簿機能は中核スコープに含めない。

**Current**：HTML、CSS、Vanilla JavaScriptによる静的Webアプリであり、ブラウザの`localStorage`を主要保存先としている。PWA用ManifestとService Workerを持つ。

**Current**：GitHub Pagesの [https://naoya-koba.github.io/tradescope-app/index.html](https://naoya-koba.github.io/tradescope-app/index.html) で公開され、`localStorage`のWeb originは `https://naoya-koba.github.io` である。主な利用形態はiPhoneのホーム画面に追加したPWA / Web Appである。

## 2. 製品原則

- **Decided**：実ユーザーデータの保護を最優先する。
- **Decided**：トップページは各機能のダッシュボードであり、独立した会計台帳ではない。
- **Decided**：同じ指標を複数画面で表示する場合、同一の正本データまたは同一の共通計算結果から生成し、画面ごとに独立した計算ロジックを持たせない。
- **Decided**：キャッシュやスナップショットを正本にしない。
- **Decided**：キャッシュやスナップショットを、画面間で同一結果を共有する実装手段として使用することは禁止しない。
- **Decided**：元データ変更後に、トップと詳細画面で古い値や異なる値を残さない。
- **Decided**：不明な金融データを推測して補完しない。
- **Decided**：ダミー値・フォールバック値は実データと明確に区別する。

## 3. 正式機能

| 機能 | 状態 | 仕様上の位置付け |
|---|---|---|
| Summary | Current / Decided | 純資産、確定資産、年間損益等の要約 |
| Asset Trend | Current / Decided | AssetとPerformanceの2表示 |
| Monthly P/L | Current / Decided | 決済損益＋スワップ損益 |
| Asset Allocation | Current / Decided | 資産クラス・口座別配分 |
| Portfolio / Open Positions | Current / Decided | 現在保有ポジションと保有明細 |
| Risk | Current / Decidedに差異あり | 将来仕様は`RISK_SPEC.md`を正本とする |
| Swap | Current / Decided | 月次・累積・年間想定の把握 |
| Transaction History | Current / Decided | 手入力を維持しつつインポート中心へ移行 |
| Backup / Restore | Current / Decidedに差異あり | 完全バックアップへ統合予定 |
| Memo | Current / Decided | 再生成不能なユーザー情報として保護 |
| 銘柄リスト等のユーザー設定 | Current / Decided | 完全バックアップ対象 |
| Account設定 | Planned | 追加、編集、無効化、インポート紐付け |
| Account別資産管理 | Planned | 各口座の現在・各時点の資産、損益、保有状態、口座固有情報を閲覧 |
| データ取込 | Current / Planned | SBI国内CSVとGMO FXneo月次PDFの確認後保存。他社PDF対応は将来実装 |

## 4. 画面の役割

### トップページ

**Current**：News、Summary、Asset Trend、Asset Allocation、Portfolio、Risk、Swap、Backup、Memoを表示する。

**Decided**：他画面の情報を集約するダッシュボードとする。トップ専用の計算式や独立保存値を正本として持たせない。

**Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する手段としてTop Summary Snapshotを使う経路が導入されている。

**Current**：Summary、Asset Trend、Asset Allocation、Riskは、対象となる正本データがない場合に固定値を使わず空状態を表示する。

**Current**：Top Summary Snapshotは正本データのfingerprintと最新入力済み月が一致する場合だけ利用し、不一致または旧形式のSnapshotは正本データから再計算する。

**Current**：Top・年間Summary・両Trend・配分の同一指標を共有projectionへ統一した。銘柄別情報など今回のモデルから算出できないものは推測しない。

### 損益管理

**Current**：年初資金、年初評価損益、月次の決済損益、スワップ、評価損益、入出金、残高、保有明細を入力・集計する。

**Decided**：投資運用成績および総資産推移の主要入力・分析画面として維持する。ただし計算ロジックの正本は画面ファイルではなく共有層へ置く。

### SBI月次入力の接続方針

**Decided**：SBIは2026-09以降を新月次正本へcutoverする。未確定は不明、旧月次競合は停止する。必要な国内・外国・現金・月次値の明示保存で確定し、Draftは集計へ反映しない。SBI内部swapは従来どおり保存時0固定だが、Inputにはswap欄を表示しない。

**Current**：InputのSBI口座内保存と共有resolver・計算は接続済み。Top／Monthlyの部分表示は非永続Viewを使用する。国内手修正はpartialでも保存可能で、全必須入力が揃う場合のみ月次確定する。保存後も「保存」を維持しInputの独立した「保存済み」行は置かない。空欄を0にせず、スワップは編集不可。既存1〜8月を移行・削除しない。

**Current**：Inputは口座全体の月次確認・編集を中心とする。FXは決済・swap・評価・入出金、SBIは評価額・評価損益・実現損益・入出金。SBIの初期折りたたみ「資産内訳」に国内評価額・評価損益の編集フォームとread-only取得日、外国／現金manualを置く。各カード最下部は共通文言「保存」、ページ末尾global保存を廃止する。他口座のDraftを保存しない。GMO原値保護の編集と小さな「取込値に戻す」を接続済み。独立した取込済み行・内部用語・冗長な説明は追加しない。個別銘柄の表示場所は後のブラッシュアップで決定する。

**Decided**：取込済み国内保有をInputへ表示し、不足する外国株の円換算評価額・評価損益、現金残高を既存Input内で補完する。専用手入力ページは作らない。編集中Draftは正本から分離し、ユーザーの明示保存成功時だけMonthlyAccountStateで口座・月の採用元と台帳入力を確定する。CSV保存だけでは月次確定にしない。未入力と確認済み0を区別し、内部モデル名や説明文を通常UIへ追加しない。

**Current**：国内取込の表示やDraft編集だけでは月次確定しない。取得日を月末値へ昇格させず、厳密集計では明示保存したStateと採用元を使用する。未確定月の観測はTop／Monthlyの表示Viewに限り暫定表示する。確定保存は不足項目・従来入力競合・複数国内候補で安全側に停止する。

### 取引履歴

**Current**：手入力、編集、削除、決済登録、Open Positions再構築、履歴バックアップを提供する。

**Decided**：正式機能として維持する。

**Planned**：取得可能な取引事実では `CSV → API → PDF → 手入力` を検討する。ただしGMO月次確定の正式取込元は月次PDFのみであり、この一般案より優先する。概念フローは次のとおり。

`CSV / API / PDF / 手入力 → ImportBatch → ImportRowDraft / Preview → ユーザー確認 → RawTransaction → Position reconstruction → Completed Trades → Analytics`

**Decided**：RawTransactionは受理した取引事実の正本とし、照合状態・検証警告・戦略・Memo・Risk設定を混在させない。PositionおよびCompleted TradeはRawTransactionから再構築する派生データとして扱う。

**Planned**：勝率、平均利益・平均損失、戦略別、通貨ペア・銘柄別、保有期間、キャリー／キャピタル別の分析に利用する。

**Decided**：インポート元に存在しない情報は推測して補完しない。

### Account別資産管理

**Planned**：Accountを起点として、現在または選択時点の次の情報を閲覧できる画面を設ける。

- 資産評価額または純資産
- 評価損益
- 月間確定損益
- 保有銘柄、FX建玉、暗号資産
- 現金残高
- 必要証拠金等の口座固有情報
- 必要な場合に限り、値の基準日

**Decided**：FX、証券、暗号資産の固有情報を共通項目へ無理に押し込まない。共通のAccount概要と、資産クラス・口座種別別の詳細表示を分ける。

**Decided**：月間確定損益、評価損益、時価評価額、月間パフォーマンスを別指標として扱う。定義は`CALCULATIONS.md`を正本とする。

**Decided**：`targetMonth`、`snapshotAsOf`、provenance、`MonthlyAccountSnapshot`等は内部仕様であり、その用語や仕組みを通常UIへそのまま表示しない。通常表示は「2026年9月分」「評価額」「評価損益」等に限定し、必要な場合だけ「10/4時点」のような短い基準日を補足する。

**Planned**：対象月末と観測日が大きく離れている場合のみ、専門用語を使わない短い警告を表示する。

### データ取込

**Current**：主要3画面のハンバーガー「データ取込」からSBI国内CSVをブラウザ内で解析・検証・Previewし、確認後にファイルごとに保存できる。損益管理Inputの右にも共通ショートカットを設け、ボトムナビには追加しない。取得方法、対象月・取得日、主要集計と任意展開の明細を表示する。実CSVの形式別対応確認は継続調査事項で、保存UIの検証には匿名CSVのみを用いる。

**Current**：入口は会社・サービス単位の一覧とし、SBI証券を同じ画面内で開くと2種類のCSV選択欄を表示する。GMO FXneoを開くと月次報告書PDF選択とPreview・保存を表示する。LIGHT FX／みんなのFXはそれぞれ月次PDFとスワップ付与月間合計の入力・Preview・保存を表示する。SBI VCは月次PDFの資産・現物保有・検証済み現物買いPreviewと確認保存を表示する。SBIの明細ヘッダーでファイル種別を確認し、取り違え・不明形式は簡潔なエラーとし、正常なPreviewへ進めない。PCは選択欄を2列、スマホは縦積みとし、スマホの明細も縦方向で確認できる。

**Current**：CSV Previewの下に「保存予定内容」を表示する。未解決の約定も消さず要確認として残す。保存可能ファイルだけに「保存」を表示し、簡潔なモーダルで確認する。検証完了後は操作ボタンを消して「保存済み」を表示し、再選択・再読込後もStorageから判定する。競合は「同じ月・同じ取得日のデータが保存されています」、重複候補は「既存の取引と重複する可能性があります」と示し、保存できない。強制・上書き・一部保存は提供しない。正常時はエラー0等を表示せず、月次への自動反映もしない。

**Decided / Current**：ユーザー向けの正式入口名は「データ取込」とする。Accountを選ぶと必要なファイルを簡潔に案内する。SBIのユーザー指定日には「取得日」を使い、原資料に正式な日付がある場合は「基準日」と出し分ける。内部ではsnapshotAsOfを維持する。

**Planned**：「取得方法を見る」は主操作より目立たない補助導線とし、タップ時に簡潔なモーダルを表示する。適切な公式ページがある場合は、検証済みの証券会社・金融機関公式ページへのリンクを設ける。

**Decided**：取込UIへ不要な技術用語や長い説明を常時表示しない。未解決項目、観測日のずれ、重複・競合等、ユーザー判断が必要な情報は確認画面で簡潔に表示する。

**Decided**：手入力を廃止しない。Importerが対応していない資産や資料にない値は、推測せず手入力で補える状態を維持する。

## 5. 対象資産と口座

**Current**：資産区分はFX、証券、暗号資産、その他。証券内で株式、ETF、投資信託を銘柄名から判定する処理がある。口座はGMO、Light FX、みんなのFX、SBI、SBI VC、三井住友銀行に固定されている。

**Decided**：口座と資産クラスを分離する。SBI証券はAccount、株式・ETF・投資信託はAsset Classである。

**Decided**：Instrumentと、その口座での`contractSize`、数量単位、業者固有symbol等を分離し、後者はAccountInstrumentSettingとして扱う。Risk設定もこれらとは別概念とする。

**Planned**：設定画面からAccountを追加・編集・無効化できるようにする。

**Planned**：将来の設定画面では、Account、Instrument、Accountごとの取引仕様、Risk設定を責務ごとに管理する。具体的なUIはデータモデル実装後に設計する。

## 6. Legacy / Experimental

| 対象 | 分類 | 現状 |
|---|---|---|
| `tradeinfo/` | Removed Legacy implementation | 旧ページ実装は削除済み。`tradeInfo`キーと旧v1バックアップ互換処理は、別途移行・廃止判断するまで維持する |
| 政策金利予測 | Removed Experimental implementation / Under consideration | 固定サンプルによる旧実装は削除済み。将来必要になった場合は正式なデータ源と仕様を決めて作り直す |
| 転換（反転）シグナル | Removed Experimental implementation / Under consideration | 固定ダミーによる旧実装は削除済み。将来必要になった場合は正式仕様を決めて作り直す |
| Position Details内チャート | Current / 未実装 | 固定ダミーデータは削除済み。実データ源がないため「データなし」を表示する |
| OCR | Planned UI placeholder | 現在は無効ボタンのみ |
| 押し／戻り | Under consideration | 画面実装とナビゲーションはなく、正式採否は未決定 |
| 設定 | Planned | 画面実装とナビゲーションは未作成 |

## 7. UI名称

**Decided / Current**：口座の通常UI表示名はGMO FXneo、SBI証券、LIGHT FX、みんなのFX、SBI VC、三井住友銀行に統一する。Inputの新旧方式、口座円グラフ・凡例・tooltip、履歴・取込の表示で共通のUI専用mappingを用いる。内部キー、旧口座文字列、履歴optionのvalue、Accountの保存済みdisplayName・legacyRefs、計算・Backup識別子は変更しない。旧Summary Snapshotのlabelも表示時のみ変換し、Snapshotを書き換えない。short labelは今回は導入しない。

**Current**：Summary、Asset Trend、Monthly P/L等、英語見出しが多い。

**Under consideration**：将来的な日本語化を検討する。現在の英語名を最終的な正式名称とは扱わない。

名称変更時も、データキーや内部IDを表示名と連動して安易に変更しない。

**Planned**：TradeScopeはモバイルアプリとしての完成度を重視する。Disney+等の高品質アプリを参考に、操作性、画面遷移、モーション、階層感、タップフィードバック、一貫性を高める。ただし完全コピーは行わず、金融情報の視認性とTradeScope独自UIを優先し、将来は共通のUI Design Systemを整備する。

## 8. 非機能要件

**Current — 取込中のPDF原本確認**：GMO FXneo／LIGHT FX／みんなのFXは選択PDFの読み取り成功後に「PDF原本を確認」を表示し、共通の「PDF原本」dialogを開く。前後移動、ページ番号指定、幅合わせ、簡単な拡大縮小に対応する。mobileではsafe-area付き全画面相当、PCではmodalとし、閉じる／ESCで取込画面へ戻る。原本表示はread-onlyで取込値・対象月・手修正・swap空欄・保存確認を変えず、保存後も同一画面中だけ再表示できる。帳票の取込可否と原本の表示可否は別であり、異なるproviderのPDFを表示できても保存は許可しない。

**Decided**：原本は端末内で現在ページだけ描画し、永続保存・外部送信しない。検索・選択用text layer・OCR・annotation・thumbnailは追加しない。破損PDFや未対応のパスワード付きPDFは簡潔なエラーとし、内部stackや本文は表示しない。

**Under consideration**：永続原本archiveと履歴からの原本ページ移動。現在のViewerは取込中のセッション限定であり、再起動後に過去PDFを開く機能ではない。

- **Decided**：既存データを失わずに更新できること。
- **Decided**：バックアップから後方互換復元できること。
- **Decided**：同じ入力に対して全画面で同じ計算結果になること。
- **Decided**：外部API障害時に実データと偽の数値を混同させないこと。
- **Decided**：モバイル・PWA利用を維持すること。
- **Planned**：計算、マイグレーション、バックアップ互換性に自動テストを導入すること。

**Known issue / Data protection note**：iPhoneのホーム画面Web Appと通常のSafariではストレージが分離される可能性がある。片方でデータが見えないことをデータ消失と即断せず、初期化前に利用形態とバックアップを確認する。

## Current — SBI国内値の編集

「資産内訳」の国内証券は評価額・評価損益を編集可能とし、取得日は小さくread-only表示する。各項目に「取込値に戻す」を置き明示保存後だけ共通表示へ反映する。上段評価額は国内採用額＋入力済み外国＋現金、評価損益は国内採用値＋入力済み外国の合計。不足成分は加算しないがStorageへ0を書かない。国内のみ保存しても月次未確定のまま。個別銘柄編集は追加せず、Importの保存済み表示は別用途として維持する。
