# Calculation Specification

## Current / Decided — 採用済みsourceと共通計算

新しいmetricだけを採用した部分Inputは、既存Traders／SBIの明示採用済み月次値を互換adapterで維持する。State不存在だけを理由に既知値をnullへ落とさず、swap未入力など元から不明の項目は不明のまま。新採用がない従来monthは変えない。

新sourceのflow／評価損益からledger額を計算する際は、月途中のcutoverでも年初基準の未入力／nullを旧calculatorの0寄与で補わない。既知の月次値は表示可能だが、基準不明なら確定資産／ledger純資産はnull。新契約なしの従来legacy計算は変更しない。

monthly-source-contractがsource候補→明示adoption→指定revisionのoverride→採用値を解決する。PDF／CSV／manualを順位付けせず、候補追加や一致確認だけで採用しない。missing、deferで採用なし、stale／conflictはnullで0ではない。新判断がない月は従来resolver／SBI VC observation adoptionを使用し、新判断があるcomponent／metricだけを共通monthly resolver／monthly-displayへ渡す。Top／損益管理はdisplay-results経由で描画し、独自source選択をしない。

balanceだけをbalance-viewへ渡し過去確認値のcurrent carryを許可する。flowは当月限定、carryなし。whole totalとcomponentsは排他、同じcomponentの保有合計と評価額も二重加算しない。FXの現金componentだけなら残余unknownの小計。保有集合の0・終了・不明数量や新集合の不明評価額に旧集合合計を補完しない。原観測とderived ledgerは別basisで、観測差を利益・損失へ逆算しない。fee等の追加ledger式・外貨換算は今回導入しない。

2026年8月legacyと9月canonicalは新契約なしなら同じ数値・期間式。新manual-only月は必須flowと評価損益が採用され、年初／前期間basisが既知の場合だけ従来ledger式を使う。曖昧なlegacy zeroで必須項目を自動充足しない。MonthlyAccountStateや完了承認は自動生成しない。source／adoptionはfingerprint依存に含み、明示保存で派生cacheを同一journal内invalidateする。current carryのAnnual期間損益・過去Trend・Riskへの非波及を維持する。

## Current / Decided — 同義指標と期間比較の表示契約

`assets/display-results.js`はmonthly-displayのdashboard／yearlyTotals／monthlyPnlを読み、その共通結果をTopと損益管理へ渡す。net／confirmed／netPnl／confirmedPnlと年間realized／swap／deposit／withdrawalを画面側で再計算しない。Top swap内訳・累計・既存推定も同じ結果から生成する。計算式・正本・canonical resolverのcomplete／missing／conflictは変更しない。

Top現在純資産のcurrent balanceと、年間サマリー純資産（月次集計）は別指標。前者のcarryは後者・月次詳細・Annual期間損益・Performance Trend・過去Asset Trend・Risk・確定資産ledgerへ流さない。月次詳細は選択月の共通結果だけを使用し、6口座のmissing／conflict／読込失敗行は数値nullで保持する。既知項目のみの既存暫定合計を維持し、全未入力合計はnull、明示0だけを0表示する。

年間純資産カードの比較可否は`display-results.periodComparison`が判定する。全口座でnet／completeNetが有限・完全・非conflict、同年・同sourceMonth・同period-ledger basisである場合のみ、既存年初比delta／growthを表示する。別basisの金額が偶然一致しても不可。partial／unknown／別月なら両方null、initialNetが不明なら比較不可、0以下ならgrowthのみnull。この適格性判定はTop用current比較を流用せず、期間カードの責務として分離する。金額を比較基準に合わせて変更せず、観測との差を利益・損失へ逆算しない。

2026年1〜8月の6口座legacy計算は維持する。9月canonical／current carryから過去月へfallbackしない。同じ過去月の観測を正式採用する一般契約は次のsource／adoption基盤で整理する。下記の従来Annual指標維持とは期間式の維持であり、本節の比較不能時の「—」表示を優先する。

## Current / Decided — 現在残高の確認月と一時利用

Top純資産／Asset Allocationだけは採用済み残高を非永続`balance-view`で解決する。当月未確認なら選択年内の直近確認値を一時表示できるが当月正本へコピーしない。componentのvalue／sourceMonth／snapshotAsOf／出所／currentConfirmed／carried／missing／explicitZeroを保持する。明示0は旧positiveへのfallbackを止め、競合・曖昧な採用は停止する。入力元の種類で優先順位を決めず、既存adoption policyが選んだ観測だけを共通処理へ渡す。

SBI証券は国内証券（株・投信の一括Batch）／外国証券（JPY評価）／現金・預り金ごとに採用値と確認月を解決し、前月の部分観測も利用可能。legacy口座合計は内訳へ安全に分解できないためcanonical内訳と加算しない。国内株・投信の別更新、外貨現金の独立sourceは未対応。GMO／LIGHT／みんなは口座一括値：有限の完全ledger額を維持し、ledger不足時は正式な口座観測を表示専用に使用できる。

SBI VCの保有集合は選択年内最新の採用sourceが正本。0／不明数量・終了／省略された銘柄を過去positiveから復活させない。最新の正数量保有の評価額・現金がnullなら同じ年の以前の月の採用値を参照可能。同月訂正前sourceは候補にしない。Portfolio／Open Positionsへcarryを流さず、帳票合計・担保評価は加算しない。

knownTotalは取得済み小計。全残高component既知のcomplete、partial、hasCarried、unknownComponents、当月全成分確認済みのcurrentCompleteを別に返す。残高completeは月次State complete／完全NAVではない。TopとAllocationへ同じ口座額を渡し、正額のみの配分という既存差は維持する。

確定資産・月次／年間損益・年間成長率・Annual Summary・Performance Trend・過去Asset Trend・Riskは従来の期間projectionを維持する。carryを期間計算へ入力せず、純資産カードの比較可否もcarry／unknown／観測根拠があれば「—」。月次flowは前月から引き継がない。以下の旧dashboardの当月部分額／直近完全月policyは期間consumer向けとして維持し、Top現在純資産だけ本節のViewで置換する。

## Current / Decided — Top純資産カードの期間比較可否

純資産額はcurrent asset observationを含む表示View、年初比変動額と年間成長率の原値は既存monthly dashboardの直近完全値である。この異なる根拠を同じカードへ無条件に並べない。`current-asset-view.netPeriodComparison`が表示可否・理由・口座別比較sourceを非永続で返し、Topは受け取った値を描画するだけとする。

比較可能条件は、選択年が一致し、全口座のnet／completeNetが有限・完全・非conflictで、口座ごとのsourceMonthと値が一致すること。previous complete同士は同じ口座月を参照する限り可とし、口座間の混在月を今回一律禁止しない。SBI VCのcurrent-asset-observationは期間値と異なる根拠のため、同月・同額・全成分既知でも比較不可。unknown／partial／根拠差／対象月差のどれかがあれば、このカードの変動額と年間成長率だけ「—」にする。明示0や負の比較可能な期間値は従来どおり表示する。分母が0以下等で率の原値がnullなら、比較可能でも率は「—」のまま。

これは表示適格性の局所修正であり、変動額＝直近完全純資産合計−年初純資産、成長率＝変動額÷年初純資産×100という既存式を変更しない。資産観測から新しい損益・入出金・成長率を逆算しない。確定資産・純損益・確定損益のカード、Annual Summary、両Trend、Allocation、Portfolio、Riskの既存計算・source選択は維持する。

## Planned / Known issue — 全口座canonical化後の計算・データ整合監査

legacy月次計算、canonical月次データ、current asset observation、Transaction History、Portfolio／Open Positions projectionは段階的に共存している。式が単体で正しくても参照元・対象時点・入出金・unknownの差で意味的不整合が起こり得る。今回の「—」表示はその予防であり、全体整合が完了したことを意味しない。

全口座canonical化後の独立した整合フェーズで、下表の**各指標それぞれ**について次の6項目を記録・横断照合する：1. 正本、2. 対象時点（選択年・source月・採用元・基準日）、3. 入出金の扱い、4. unknown／partialの扱い、5. current値かperiod値か、6. 他指標との比較可能性。同名の指標だけを理由に等値を要求せず、意味が一致する範囲を明示する。

| 確認対象 | 現行の責務・将来の照合焦点 |
| --- | --- |
| Top純資産 | 最新把握資産と期間純資産の根拠・時点差、観測額の重複加算防止 |
| 確定資産 | 台帳の累積値、年初基準と外部資金移動、欠損伝播 |
| 純損益 | 年初評価損益・入出金調整・銀行除外、資産観測との差額を利益にしない |
| 確定損益 | 確定ベースの年初値・入出金調整と採用source |
| 年間成長率 | 4カードの分子／分母・参照時点・資金移動・比較可否の違い |
| 月次損益 | 明示採用した月次flow、missingと明示0、年累積値との関係 |
| Annual Summary | 選択年内の期間値・口座別source月とTop指標との比較範囲 |
| Asset Trend | 過去seriesの正本・時点・partial、最新観測と履歴を混同しない |
| Performance Trend | 入出金調整済み期間損益、欠損伝播と各成長率との関係 |
| Asset Allocation | 口座区分・正額のみの分母・不明成分、Topの負額を含む合計との差 |
| Portfolio | 全年横断最新採用holding／現金・overrideと選択年Topの時点差、原価不明 |
| Risk | 現行の取引・口座資産等の参照元と保有観測の役割差、重複・不明値の扱い |

**Decided / 今回の境界**：全面的な式変更、全指標canonical化、legacy calculator削除、共通エンジンへの全面移行は行わない。将来の比較根拠が確定したらprojectionの比較可否契約を更新し、UI文言／DOMへ金融判定を移さない。原本・Storage・Backupを変更しない。

## Current / Decided — 選択年のSBI VC資産観測

`assets/current-asset-view.js`は共通採用resolverの選択年内最新holdings／cashBalanceを使用する。正数量の既知marketValue＋既知cashBalanceをdecimalで一度だけ合算し、旧dashboardのSBI VC資産行だけを置換した口座集合からTop純資産を再合算する。同じ口座額をAllocation一覧・円グラフへ渡し、JPYは暗号資産口座区分に含める。0数量・不明数量を推定保有にせず、nullを0にしない。全成分不明はnull、全保有0＋現金明示0は0。既知0＋不明成分は完全0とは区別し、取得済み部分額として保持する。

Topの純資産額だけはこの資産観測Viewを使用する。既存dashboard／topSeries／月次calculator、年間Summary・年間損益・変動額・成長率・両Trend・Riskは変更しない。従来のTop／年間Summary／Trend一致記述は期間計算部分について維持するが、今回接続したTop純資産観測額はその期間値と一致するとは限らない。他口座は同じ値とsource月を保持し、Topは負額も含む既知額合計、Allocationは正額だけの比率という既存差を維持する。帳票資産合計・担保評価・取引履歴を加算しない。

## Current — 共通logical transaction set

ユーザー確認済みの手入力置換だけを共通取引集合から除外し、採用取込約定を全件使用する。1:Nのquantity照合はdecimal係数／桁数による正確な合計であり、損益や取得原価を生成する処理ではない。keep-both／defer／未一致は別recordとして維持する。原manualは不変、訂正版の同事実は採用sourceへ再解決し、解決不能な訂正は保存停止する。月次State／台帳／Top／Trendの金融式は変更しない。まだ未接続のOpen Positions／Portfolio／Allocation／Riskへ新しい取引consumerを接続しない。

## Decided — Monthly canonicalと取引内訳の分離

月次損益の正本は既存MonthlyAccountStateと正式採用source。個別売買損益はdrill-down／auditであり、合計や不一致を理由に公式月間損益・Stateを上書きしない。GMO個別P/Lは明示JPY損益または明示円換算損益のみ、価格差から算出しない。quantity単位・contract sizeも推測変換しない。HoldingSnapshotは時点保有で、約定日時があっても当月Transactionにはしない。新取引source／表示resolverは共通履歴UIだけへ接続し、Top・Summary・Trend・Allocation・Portfolio・Risk consumerへ接続しない。SBIの受渡金額／決済損益混在列も個別realizedPnlへ変換しない。

## Traders Storage / Backup v8

**Current — GMO内訳照合**：取引明細と決済詳細の一意照合で明示されたJPY損益のみを取得する。円換算「-」は0ではなく、元損益が明示JPYの時だけ換算不要の原値を使う。全件取得時のみ公式月間realizedと検算する。不完全coverageは合計比較しない。個別スワップ・月次入出金を売買履歴へ入れない。公式月次値／ledgerは内訳不一致でも変更しない。

**Current / Decided — PDF-only partial**：PDF由来のrealized／deposit／withdrawalはMonthlyAccountInput v2の原値・採用値を共通表示層で読む。価格評価損益・純資産観測も当月partialとして表示し、Monthly P/L／年間内訳は既知値だけの暫定集計を行う。swap nullはcanonicalの0と同一視しない。Stateなしの厳密ledgerはmissingのまま、後からcalendar入力を保存すると共有表示とfingerprintを更新する。観測netAssetValueをledgerへ加算しない。

**Decided**：calendar「スワップ付与」は月ごとに独立したsource。前月末未決済swap basis・前月PDF・8月legacyのswap認識根拠は、9月以降の保存／計算条件ではない。8月の一致確認はhistorical consistency checkに限定する。PDF settled＋当月未決済−前月未決済によるcanonical計算は行わない。

**Current / Input**：2026-09以降のLIGHT／みんなはPDF集計値とcalendar swapを同じFX5項目フォームに表示する。入力イベントはDraftのみ、口座単位の明示保存で採用値と訂正履歴を更新する。建玉別の旧手入力は2026-08以前だけ残し、Risk consumerは今回変更しない。

**Current**：LIGHT FX／みんなのFXは2026-08以前legacy、2026-09以降official-account adapterで明示採用Stateを解決する。Stateなしはmissing、非ゼロlegacy併存はconflict。共通ledgerはrealized＋calendar accrual swap＋外部入出金を累積し、純資産にはprice unrealizedのみ加える。PDF netAssetValue・settled swap・未決済swapを追加加算しない。全Summary／Trend／Monthly P/L／Allocation／口座一覧／pieは既存shared calculator/projectionを使用する。

## Traders Securities monthly PDF

**Decided**：トレイダーズ証券のrealizedは月次PDFの売買損益、unrealizedは全建玉の価格評価損益合計（未決済スワップ除外）。口座報告評価損益＝価格評価損益＋未決済スワップとして検算する。canonical swapは収益カレンダー「スワップ付与」の月間発生額でありPDF受渡済みスワップではない。前月末swap basisによる算出は採用しない。外部入出金は明示行を正負別に集計する。

## Current / Decided — 部分取込の表示用View

`assets/monthly-display-view.js`は共有月次calculatorとは別の、非永続・読み取り専用の表示層である。既存dashboard／seriesは同一年内の新方式データが存在する最新月を基準とし、当月完全値、当月取得済み成分だけの暫定額、当月データがない場合だけ直近完全確定月を使用する。これら期間consumerへ前月componentを補完しない。Topの現在純資産／Allocationは上記「現在残高」に従い、追加APIのbalanceHistoryとcurrent-asset-viewで未確認残高だけ以前の確認値を参照する。既知成分をdecimal合計し表示時だけNumberへ変換する。nullを正本の0へ変換しない。

Top純資産・口座一覧・円グラフは同一current projectionの口座額を使う。確定資産、純損益、確定損益、年初比・成長率の計算自体は口座別の直近完全確定値と既存calculatorから維持し、各metricにsourceMonthとcurrent complete／current partial／previous complete／unavailableを保持する。必要な完全値がなければそのmetricはunknown。純資産カードの期間指標は上記比較条件を満たす場合だけ表示する。混在月・部分取込・過去残高使用は「最新値・一部暫定」とする。観測純資産をledgerへ加算しない。

年間Summaryは既存`dashboard(year)`の期間指標を表示する。Topの確定資産・損益はその結果を維持するが、現在純資産／Allocationはcurrent残高Viewで置換し、期間比較は比較可能時に限る。Asset Trendの各月点は既存`dashboard(year, throughMonth)`、Performanceも同じ指標別の完全値由来の結果を使用する。実データが存在しない月はnull点で、未来月・欠損月を補間しない。月次確定とledgerは従来の厳密calculatorを維持し、表示projectionを保存入力へ戻さない。

Monthly Summary／Monthly P/Lは選択月だけを見る。State未確定でも取得済み国内保有等を表示し、未入力は「—」。月間決済・swapは既知値のみ集計し、年間決済・swap・入出金も既知月の値を積み上げる。他口座の欠損で既知値を非表示にせず、未完成合計は暫定とする。前月fallback・0永続化は行わない。

表示fingerprintはprojection version、従来calculator依存、対象年のState／MonthlyAccountInput／AccountSnapshot／HoldingSnapshot／ImportBatchに依存する。未採用の国内取込も反映する。TopはこのViewを都度read-only再計算し、古いTop Snapshotで上書きせず、hash用の元データ複製を永続保存・ログ・外部送信しない。

**Current**：Inputは口座単位の確認・編集・保存とする。FXは決済・swap・評価・入出金、SBIは評価額・評価損益・実現損益・入出金を表示しswap欄を設けない。SBI口座全体の表示値は取得済み国内＋外国＋現金の既知成分合計で、資産内訳は初期折りたたみ。未確定DraftはSummary計算へ入れず、GMOは原値を保持して明示保存した採用値だけを使用する。

**Current / 手修正基盤**：GMO State v3では原値5項目と採用値を分離し、resolverは採用評価損益を含む5項目だけを計算へ渡す。報告決済損益／評価損益とsource baselineは一致必須。採用との差は明示overrideFieldsの正確な差分集合がある場合だけ許容する。未編集v2の一致規則は維持し、原SnapshotのnetAssetValueをledgerへ加算しない。保存後の全consumerとfingerprintは同じ採用Stateを参照する。

## Current / Decided — GMO共有計算

GMOは2026-08までlegacy、2026-09からState record v2とadoptedAccountSnapshotIdを使用する。realizedPnlはPDF月間取引損益、swapPnlは月間スワップ、入出金は外部移動、unrealizedPnlは月末建玉評価損益。前月末swap基準値・累計swapの加算は不要。observed netAssetValueは口座状態／照合用だけでledgerへ加算しない。確定資産＝年初資金＋累計決済＋累計swap＋累計入金−累計出金、純資産＝確定資産＋当月評価損益、月次損益＝決済＋swapの式を維持する。

月次確定はcreateCalculatorを使用し、Summary／両Trendはその結果を使う共通表示projectionを参照する。State不在はcanonical計算ではmissing、意味のあるlegacy値併存はconflictで、placeholderへ戻さない。必要な月が欠損ならその口座の厳密累積値はunknown。表示用の直近完全値と既知観測は指標別sourceMonth付きで扱う。保存・訂正時は派生Top Snapshotを同一journal内で削除し、元データ／採用先／Batch／計算・policy versionのfingerprintも照合する。

## Current — GMO PDF内照合

GMO Previewでは残高明細の月間取引損益／スワップ合計をprimaryとし、入出金明細の取引損益／スワップ損益および終端区分別小計と照合する。入金・出金は分類済み全明細の外部移動を別々に集計し、差引0から推定しない。前月末現金＋月間取引損益＋月間スワップ＋入金−出金＝当月現金、当月現金＋建玉評価損益＝時価評価総額も照合する。取得可能な適用必要証拠金明細合計を正式合計と比較する。累計スワップは加算しない。不明値は0にせず、照合不能は保存候補にしない。

**Current / 共通月次基盤**：cutover、State、欠損伝播、累積ledger、採用先依存fingerprintを共有resolverへ集約する。SBI観測合成と単一公式AccountSnapshot adapterを分離し、GMOも2026-09から有効。観測純資産をledgerへ加算しない。

## 1. 共通原則

- **Decided**：計算の入力は正本データとユーザー付与情報とする。
- **Decided**：同一指標をトップ、損益管理、その他画面で重複実装しない。同一の正本データまたは同一の共通計算結果を各画面で利用する。
- **Decided**：共通計算ロジックは一箇所に置き、各画面は同じ結果を表示する。
- **Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する目的でSnapshotを使う経路が導入されている。
- **Decided**：Snapshotやキャッシュを共通結果の共有・表示高速化に使用してよく、廃止を要件とはしない。ただし正本にはせず、入力変更時に無効化または即時再生成する。
- **Current**：月次データは旧month.__saved、口座別の明示保存を表すrow.__saved、または旧形式の有限非ゼロ月次入力で判定する。口座別の全0保存はその口座だけを有効にし、他口座placeholderを入力済みにしない。holdings・自動生成値・描画由来の全ゼロ月は根拠にしない。既存month.__savedは保持し、Migrationしない。
- **Current**：Top Summary Snapshotは対象年の正本データから生成したfingerprintと最新入力済み月を照合し、不一致または旧形式のSnapshotは使用せず正本データから再計算する。
- **Current**：Top・年間Summary・Trend・配分の同一指標は共有projectionで統一する。旧入力由来の銘柄別評価・Riskなど別責務の計算は、今回の最新資産projectionとは分離して保持する。

## 2. 確定資産

### SBI共有resolver・計算基盤

**Current**：`assets/monthly-account-resolver.js`はlegacy／canonical／missing／conflict、明示確定、月次・観測のcompleteness、採用ID、台帳入力と観測Viewを一箇所で解決する。`createCalculator`はDOM／Storage非依存で、既存`profit-metrics.js`のlegacy計算を保持し、SBI／GMOの新方式を口座policyで切り替える。Input、Monthly Summary、年間Summary、Top、Asset／Performance Trendはこの共有計算を参照する。画面独自のcutover・欠損判定は置かない。

**Decided**：SBI cutoverは2026-09。State不在・legacy conflictを0として補わない。採用国内保有＋外国manualの評価損益が不完全なら口座評価損益はunknown。観測資産合計は国内評価額＋外国評価額＋現金、観測評価損益は国内＋外国。decimal合計は既存BigInt処理で行い、表示用の既存台帳計算へ渡す時点でのみNumberへ変換する。観測額を台帳へ加算せず、差額から損益・入出金を逆算しない。

**Decided**：必要なcutover後の月次flowが一月でも欠ける場合、後続月の累積確定資産・純資産・年間Performanceはunknown。その月の月次損益自体は、Stateの月次入力が完全なら局所値として表示できる。例：9月missing／10月completeでは10月Monthly P/Lのみ既知、累積値はnull。欠損は0で飛ばさず、画面ごとに判定しない。

**Current**：fingerprintは計算version／policy version、legacy入力、対象年State、採用国内Batchと保有群、採用外国／現金record、GMO採用AccountSnapshotと関連PDF ImportBatchに依存する。保存成功時のキャッシュ削除に失敗してもfingerprint不一致で旧Snapshotを拒否できる。hash用元データ複製の永続化・ログ・外部送信は行わない。

**Decided**：確定資産は、評価損益を除いた確定ベースの現在資産である。

```text
確定資産
= 年初資金
+ 累計決済損益
+ 累計スワップ
+ 累計入金
- 累計出金
```

**Current**：`assets/profit-metrics.js`および各画面のフォールバック実装はこの式を使用している。

## 3. 純資産

```text
純資産
= 確定資産
+ 対象時点の評価損益
```

- **Decided**：総資産としての純資産には銀行預金を含める。
- **Current**：評価損益は対象月の値のみを加え、過去月の評価損益を累積しない。
- **Decided**：この非累積扱いを維持する。

## 4. 年間損益と成長率

**Decided**：年間損益は、銀行を除いた投資資産について、入出金の影響を除外した年初からの資産増減である。

```text
年間純損益
= 現在の投資口座純資産
- 年初の投資口座純資産
- 年間入金
+ 年間出金

年初の投資口座純資産
= 年初資金 + 年初評価損益
```

```text
年間確定損益
= 現在の投資口座確定資産
- 年初の投資口座確定資産
- 年間入金
+ 年間出金
```

- **Decided**：銀行預金は総資産に含めるが、投資運用成績に含めない。
- **Decided**：年初評価損益を年間純損益の基準に含める。
- **Current**：三井住友銀行は`bankOnly`として年間運用成績の対象外である。

成長率：

```text
年間純損益成長率 = 年間純損益 ÷ 年初の投資口座純資産 × 100
年間確定損益成長率 = 年間確定損益 ÷ 年初の投資口座確定資産 × 100
```

年初値が0以下の場合の表示仕様は、**Under consideration**とする。**Current**：共有dashboardの率はnull、Topは「—」と表示する。nullを明示0%へ変換しない。

## 5. Monthly P/L

**Decided**：現行定義を正式に維持する。

```text
Monthly P/L = 当月決済損益 + 当月スワップ損益
```

- 評価損益とその月間変動は含めない。
- 入出金は含めない。
- Total表示は上記合計。
- Breakdown表示は決済損益とスワップ損益を分けて表示する。

**Under consideration**：将来、Monthly P/Lグラフの現在の表示である「Total」「Breakdown」に加え、3つ目の表示候補として「月間パフォーマンス」を追加する。月間パフォーマンスはAsset Trend Performanceの月間差分を利用する。これは表示・分析項目の追加候補であり、`決済損益 + スワップ損益`というMonthly P/L自体の定義は変更しない。

### 口座状態と月次指標の区別

**Decided**：次の指標を混同しない。

- 月間確定損益：対象月に実現した売買・決済等の利益または損失。現行Monthly P/Lでは、これに当月スワップ損益を加えて表示する。
- 評価損益：観測時点で保有中の資産・建玉に対する未実現損益。
- 時価評価額：観測時点の保有資産の評価額。利益額そのものではない。
- 月間パフォーマンス：入出金の影響を除く月間の運用成績。将来の別指標候補であり、Monthly P/Lの定義を置き換えない。

**Decided**：`AccountSnapshot`または`HoldingSnapshot`に記録された観測値と、RawTransaction等から算出した値を同一の正本値として二重加算しない。報告値、手入力値、算出値の出所を区別する。

**Decided**：SBI国内保有CSV、外国株手入力、現金手入力等を合算した口座全体値は、複数の観測元データから生成する派生計算または表示用Viewとする。複数ソースを合成した観測Snapshotとして保存しない。

**Under consideration**：SBI証券の約定履歴CSVから実現損益を自動算出する正式方法は未確定である。手数料、税、取得原価、部分売却、譲渡益税明細等を確認するまで、推測計算を正式仕様にしない。

## 6. Asset Trend

### SBI観測Viewと台帳式の境界

**Decided**：SBI観測資産額は「採用した国内保有BatchのmarketValue合計 + 外国株manual assetValue + 現金manual cashBalance」、SBI観測評価損益は「同BatchのunrealizedPnl合計 + 外国株manual unrealizedPnl」とする。複数取得元からの派生Viewであり、合計を正本保存しない。不足成分を0として補わず、同じ月の全Batchを加算しない。

**Decided**：既存の確定資産・純資産の台帳式は維持する。観測資産額と台帳式純資産を同じ値と扱わず、観測額を台帳式へ加算しない。差額から実現損益、入出金、その他金融値を逆算しない。MonthlyAccountStateの台帳入力と明示採用元は共有resolverからSummary／Top／Asset Trendへ接続済み。未確定は欠損として扱う。

### Asset

**Decided**：実際の資産額推移を表示し、入出金を含む。

- Total Equity：各時点の純資産
- Net Balance：各時点の確定資産
- 年初点を含む

### Performance

**Decided**：年初を0として、入出金の影響を除いた運用成績を表示する。

```text
純資産Performance
= 対象月純資産
- 年初純資産
- 年初から対象月までの累計入金
+ 年初から対象月までの累計出金
```

```text
確定資産Performance
= 対象月確定資産
- 年初確定資産
- 年初から対象月までの累計入金
+ 年初から対象月までの累計出金
```

- **Decided**：純資産ベースと確定資産ベースの両系列を維持する。
- **Decided**：Topと損益管理で同じ計算結果を使う。
- **Known issue**：現在は両画面に別実装が残る。Top Summary Snapshotの鮮度検証は共通化されたが、計算ロジック自体の重複は残っている。

## 7. 月次集計

**Current / Decided**：口座合計は、対象月の各口座値を合算する。

```text
当月決済損益合計 = Σ 各口座.realizedPnL
当月スワップ合計 = Σ 各口座.swapPnL
当月評価損益合計 = Σ 各口座.unrealizedPnL
```

評価損益合計は表示できるが、Monthly P/Lには加えない。

## 8. 銀行口座

**Current**：月末残高と前月末残高の差を入出金へ変換し、決済損益、スワップ、評価損益を0にする。

```text
差額 = 当月末残高 - 前月末残高
差額 > 0: 入金 = 差額
差額 < 0: 出金 = abs(差額)
```

**Decided**：銀行は総資産に含め、投資運用成績から除外する原則を維持する。

**Under consideration**：利息を単純入金と分離する将来分類。

## 9. 証券評価損益

**Current**：SBI保有明細では次の式を使う。

```text
取得原価 = 取得単価 × 数量 ÷ unitDivider
評価損益 = 現在評価額 - 取得原価
評価損益率 = 評価損益 ÷ 取得原価 × 100
```

- 投資信託系：`unitDivider = 10000`
- 株式・ETF系：`unitDivider = 1`
- `預り金`：評価損益対象外

**Known issue**：投資信託・ETF判定は銘柄名キーワードに依存する。

## 10. 暗号資産

**Current**：

```text
暗号資産口座純資産
= 口座内JPY現金
+ 各暗号資産の現在評価額合計

暗号資産口座評価損益
= 暗号資産口座純資産 - 暗号資産口座確定資産
```

**Decided**：総資産計算ではJPY現金を含める。Risk上の暗号資産0円時損失ではJPY現金を除外する。詳細は`RISK_SPEC.md`を正本とする。

## 11. Position reconstruction

**Current**：

- 同方向追加：数量加重平均で平均建値を更新
- 反対売買で同方向数量が残る：平均建値を維持
- 全決済：数量と平均建値を0
- 反転：反転を起こした取引レートを新しい平均建値にする

**Under consideration**：上記は現行コードの動作記録であり、正式なPosition / Completed Trade対応ルールとして採用済みとは扱わない。CSV/API等によるインポート設計前に、口座・商品別の約定対応、部分決済、平均建値、全決済、反転の正式ルールを決定する。

## 12. Swap

**Current**：

- 前月スワップ：最新の入力済み月の口座別スワップ合計
- 年間累計：入力済み月のスワップ合計
- 年間想定：入力済み月平均 × 12か月相当

```text
年間想定 = 累積スワップ + 平均月次スワップ × 未入力月数
```

**Under consideration**：入力月が連続していない場合の「未入力月数」の扱い。

## 13. 将来の収益分類

**Planned**：以下を外部からの単純な入金と分離して保存・集計できる設計にする。

- 配当
- 分配金
- 貸株金利
- ステーキング報酬
- 口座利息
- その他投資収益

これらを入出金として扱うと運用成績が歪むため、Cash FlowとInvestment Incomeを分離する。

## 14. 丸めと精度

- **Current**：画面表示は円単位に丸める箇所が多いが、内部値はJavaScript Numberで保持する。
- **Decided**：保存値と計算値の丸めタイミングを指標ごとに明文化するまで、途中計算で不要な丸めを追加しない。
- **Under consideration**：小数通貨、暗号資産数量、投資信託口数、外貨換算の精度ルール。

**Current**：確定後に各表示を再計算し、編集中のDraftは計算へ渡さない。競合する旧SBI入力がある場合はInputとSummaryに具体的な短い案内を表示する。未確定月は欠損点のまま、累積欠損をnullとして表示し、nullの減算・表示を0へ変換しない。Chart.jsの欠損接続は無効（spanGapsの既定false）を維持する。

## Current — SBI国内手修正の共通反映

国内観測群の原値にMonthlyAccountInputの採用値を適用する共通resolver helperをInput／partial View／確定月計算で使用する。保存後のTop、年間Summary、Asset Trend、Monthly Summary、Allocation、口座一覧・pie、Riskの口座資産額は同じprojectionを使用する。Performance Trend等の損益は完全月の安全な計算を維持し、国内評価額だけのpartialから実現損益・成長を逆算しない。国内採用評価損益は選択月表示へ直ちに反映するが未入力実現・入出金等はnullのまま。Draft編集時はInput上段だけ更新し、保存・cache無効化後に共通表示へ反映する。
