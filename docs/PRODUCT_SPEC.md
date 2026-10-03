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

## 4. 画面の役割

### トップページ

**Current**：News、Summary、Asset Trend、Asset Allocation、Portfolio、Risk、Swap、Backup、Memoを表示する。

**Decided**：他画面の情報を集約するダッシュボードとする。トップ専用の計算式や独立保存値を正本として持たせない。

**Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する手段としてTop Summary Snapshotを使う経路が導入されている。

**Current**：Summary、Asset Trend、Asset Allocation、Riskは、対象となる正本データがない場合に固定値を使わず空状態を表示する。

**Known issue**：Snapshot自体を廃止対象とはしないが、現在は元データのrevisionや有効期限がなく、正本データが存在する年では古いSnapshotが元データより優先され続ける可能性がある。また、トップと損益管理には計算ロジックの重複が残っている。

### 損益管理

**Current**：年初資金、年初評価損益、月次の決済損益、スワップ、評価損益、入出金、残高、保有明細を入力・集計する。

**Decided**：投資運用成績および総資産推移の主要入力・分析画面として維持する。ただし計算ロジックの正本は画面ファイルではなく共有層へ置く。

### 取引履歴

**Current**：手入力、編集、削除、決済登録、Open Positions再構築、履歴バックアップを提供する。

**Decided**：正式機能として維持する。

**Planned**：入力優先順位は `CSV → API → PDF → 手入力` とする。概念フローは次のとおり。

`CSV / API / PDF / 手入力 → ImportBatch → ImportRowDraft / Preview → ユーザー確認 → RawTransaction → Position reconstruction → Completed Trades → Analytics`

**Decided**：RawTransactionは受理した取引事実の正本とし、照合状態・検証警告・戦略・Memo・Risk設定を混在させない。PositionおよびCompleted TradeはRawTransactionから再構築する派生データとして扱う。

**Planned**：勝率、平均利益・平均損失、戦略別、通貨ペア・銘柄別、保有期間、キャリー／キャピタル別の分析に利用する。

**Decided**：インポート元に存在しない情報は推測して補完しない。

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
