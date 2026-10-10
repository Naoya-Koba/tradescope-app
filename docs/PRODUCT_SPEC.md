# Product Specification

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
| データ取込 | Current / Planned | SBI国内CSVの確認後保存。その他Account・PDF対応は将来実装 |

## 4. 画面の役割

### トップページ

**Current**：News、Summary、Asset Trend、Asset Allocation、Portfolio、Risk、Swap、Backup、Memoを表示する。

**Decided**：他画面の情報を集約するダッシュボードとする。トップ専用の計算式や独立保存値を正本として持たせない。

**Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する手段としてTop Summary Snapshotを使う経路が導入されている。

**Current**：Summary、Asset Trend、Asset Allocation、Riskは、対象となる正本データがない場合に固定値を使わず空状態を表示する。

**Current**：Top Summary Snapshotは正本データのfingerprintと最新入力済み月が一致する場合だけ利用し、不一致または旧形式のSnapshotは正本データから再計算する。

**Known issue**：トップと損益管理には計算ロジックの重複が残っている。

### 損益管理

**Current**：年初資金、年初評価損益、月次の決済損益、スワップ、評価損益、入出金、残高、保有明細を入力・集計する。

**Decided**：投資運用成績および総資産推移の主要入力・分析画面として維持する。ただし計算ロジックの正本は画面ファイルではなく共有層へ置く。

### SBI月次入力の接続方針

**Decided**：取込済み国内保有をInputへ表示し、不足する外国株の円換算評価額・評価損益、現金残高を既存Input内で補完する。専用手入力ページは作らない。編集中Draftは正本から分離し、ユーザーの明示保存成功時だけMonthlyAccountStateで口座・月の採用元と台帳入力を確定する。CSV保存だけでは月次確定にしない。未入力と確認済み0を区別し、内部モデル名や説明文を通常UIへ追加しない。

**Planned**：Input接続とmanual保存UIは後続フェーズで実装する。今回、既存月次・Summary・Top・Asset Trendには接続せず、2026年1〜8月の自動migrationや9月の確定は行わない。

### 取引履歴

**Current**：手入力、編集、削除、決済登録、Open Positions再構築、履歴バックアップを提供する。

**Decided**：正式機能として維持する。

**Planned**：入力優先順位は `CSV → API → PDF → 手入力` とする。概念フローは次のとおり。

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

**Current**：入口は会社・サービス単位の一覧とし、SBI証券を同じ画面内で開くと2種類のCSV選択欄を表示する。GMOクリック証券、LIGHT FX、みんなのFX、SBI VCトレードは準備中。SBIの明細ヘッダーでファイル種別を確認し、取り違え・不明形式は簡潔なエラーとし、正常なPreviewへ進めない。PCは選択欄を2列、スマホは縦積みとし、スマホの明細も縦方向で確認できる。

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
