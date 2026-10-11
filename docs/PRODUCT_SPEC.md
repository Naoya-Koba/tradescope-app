# Product Specification

## Current / Decided — 最新把握額と選択月の部分表示

Topは全口座が同一月まで確定した決算ではなく、現在把握できる最新資産状況を表示する。基準月の完全口座は確定値、部分取込口座は当月取得済み成分のみ、基準月にデータがない口座は直近完全確定値を使用する。不足成分を前月値で補わず、「最新値・一部暫定」を控えめに表示し、その補助情報で口座ごとの月・確定／暫定を確認できる。純資産・口座一覧・pieは同じ表示用Viewを利用する。損益・成長率は完全確定値からのみ表示する。

Top Summaryと年間Summaryの同一年の4指標・変動額・成長率は共通projectionで一致する。Asset Trendは各月時点の同じSummary値、Performance Trendは同じ損益値を使用する。実データのない月に点を生成しない。年間決済・swap・入出金は取得済み月の値を順次反映する。

Monthly Summary／Monthly P/Lは選択月だけを見る。取込済み観測がある口座をState未確定だけで非表示にせず、SBI国内評価額・評価損益も表示する。未入力は「—」、明示保存済み0だけを0円とする。未完成の合計は「暫定」で、前月値を混ぜない。表示だけで月次確定・正本書換えを行わない。

## Current — GMO月次保存と訂正

GMO FXneoの月次PDFはPreviewだけでは保存せず、確認後に月次採用を確定する。同一ファイルは保存済み、同月別ファイルは明示訂正し旧観測を保持する。未対応・照合失敗・旧入力競合では保存しない。取込後のInputは5項目を編集可能とし、口座内「保存」で原PDF値を保持した採用値を確定する。

## Current — GMO月次PDF Preview

GMO FXneoは月次の取引残高報告書PDFだけをローカル解析する。Previewは対象月、月末日、決済損益、スワップ、入出金、評価損益、現金残高、純資産、必要証拠金を表示し、個人情報を表示しない。明示確認後にPDF Batch・口座Snapshot・月次Stateを同時保存する。正式合計と取得できた明細・区分別小計・残高式を照合し、不一致、必須値不足、未知区分、非ゼロ手数料、締後移動、未対応の外貨残高は保存不可とする。

**Current**：完全バックアップの最新出力はv5。旧record、State v2、手修正State v3の原値・採用値・変更metadataを保護し、v1〜v4互換を維持する。GMO PDF取込UI・月次保存は接続済み。手修正は原Snapshotを保持し、明示編集保存だけでv3化するserviceを用意し、表示だけでは旧v2を変更しない。

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

**Current**：InputのSBI口座内保存と共有resolver・計算は接続済み。Top／Monthlyの部分表示は非永続Viewを使用する。外国証券・現金・月次入力が完全な場合のみ保存可能。保存後は控えめな「保存済み」、再編集で保存操作へ戻る。空欄を0にせず、スワップは編集不可。既存1〜8月を移行・削除しない。

**Current**：Inputは口座全体の月次確認・編集を中心とする。FXは決済・swap・評価・入出金、SBIは評価額・評価損益・実現損益・入出金。SBIの初期折りたたみ「資産内訳」に国内read-only、外国／現金manualを置く。各カード最下部は共通文言「保存」、ページ末尾global保存を廃止する。他口座のDraftを保存しない。GMO原値保護の編集と小さな「取込値に戻す」を接続済み。独立した取込済み行・内部用語・冗長な説明は追加しない。個別銘柄の表示場所は後のブラッシュアップで決定する。

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

**Current**：入口は会社・サービス単位の一覧とし、SBI証券を同じ画面内で開くと2種類のCSV選択欄を表示する。GMO FXneoを開くと月次報告書PDF選択とPreview・保存を表示する。LIGHT FX、みんなのFX、SBI VCは準備中。SBIの明細ヘッダーでファイル種別を確認し、取り違え・不明形式は簡潔なエラーとし、正常なPreviewへ進めない。PCは選択欄を2列、スマホは縦積みとし、スマホの明細も縦方向で確認できる。

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

- **Decided**：既存データを失わずに更新できること。
- **Decided**：バックアップから後方互換復元できること。
- **Decided**：同じ入力に対して全画面で同じ計算結果になること。
- **Decided**：外部API障害時に実データと偽の数値を混同させないこと。
- **Decided**：モバイル・PWA利用を維持すること。
- **Planned**：計算、マイグレーション、バックアップ互換性に自動テストを導入すること。

**Known issue / Data protection note**：iPhoneのホーム画面Web Appと通常のSafariではストレージが分離される可能性がある。片方でデータが見えないことをデータ消失と即断せず、初期化前に利用形態とバックアップを確認する。
