# Legacy, Experimental, and Known Issues

この文書は、2026-09-26時点のコード読取結果を記録する。ここへの記載は修正済みを意味しない。

## 1. 重要な仕様差異・既知の問題

### 完全バックアップv1とLegacy部分復元

- **Current**：トップのエクスポートは`backupVersion: 1`の完全バックアップとなり、損益データ、年初資金、年初評価損益、取引履歴、Memo、銘柄リスト、存在する場合のLegacy `tradeInfo`を保存する。
- **Current**：v1と旧3形式の判定・検証・正規化・Restore plan生成基盤は存在する。
- **Current**：v1は完全復元し、旧統合・旧損益・旧履歴は収録項目だけを部分復元する。未収録項目は現在値を維持する。
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

### Top Summary Snapshotの陳腐化

- **Current**：トップは`tradeScopeTopSummarySnapshotV1`が有効形状なら、元の`tradingData`より先に利用する。
- **Current**：過去にTopと損益管理でAsset Trend等の差異が発生したため、同じ値を利用する手段としてSnapshotを使う経路が導入された。
- **Known issue**：元データrevisionや有効期限がなく、インポート、削除、別画面更新後に古い値が残る可能性がある。
- **Decided**：Snapshotやキャッシュの利用自体は禁止しない。同一指標は同一の正本データまたは同一の共通計算結果を利用し、Snapshotは非正本として、元データ更新後に古い値を表示しない。

### 計算ロジックの重複

- **Current**：確定資産、純資産、Performance等が`assets/profit-metrics.js`、`profit/soneki.js`、`top/script.js`に重複する。
- **Known issue**：修正漏れにより画面間で値がずれる可能性がある。
- **Decided**：同一指標は共有計算ロジックへ一本化する。

### dummy / fallback値

- **Current**：データが空の場合に2025年ダミー損益が自動投入される。
- **Current**：トップSummary、Asset Allocation、Riskに固定フォールバック値がある。
- **Current**：Position Detailsのチャート、累積スワップ、平均スワップ等に固定表示がある。
- **Current**：政策金利予測と転換シグナルは固定サンプル値である。
- **Known issue**：実値と誤認される可能性がある。
- **Decided**：サンプル・フォールバックを実データのように表示しない。

### Chart.jsバージョン差異

- **Current**：トップはChart.js `4.4.1`固定。
- **Current**：損益管理は`https://cdn.jsdelivr.net/npm/chart.js`でバージョン未固定。
- **Known issue**：更新により画面間の挙動が変わる可能性がある。
- **Planned / Development guidance**：画面間のバージョン差異を解消する。検証済みの同一固定バージョンを推奨するが、採用バージョンと更新方針は実装時に決定する。

### 存在しないページへのリンク

- **Current**：`settings.html`と`oshime.html`へのリンクがある。
- **Known issue**：対象ファイルは存在しない。主要画面では準備中・操作不可だが、Legacy/Experimental画面には通常リンクが残る。
- **Planned / Under consideration**：設定画面はPlanned。押し／戻り機能の正式採否は未確定。

### データ削除処理の残存キー

- **Current**：「保存データ削除」は`tradingData`と`yearInitialFunds`を削除するが、`yearInitialUnrealized`とTop Summary Snapshot等を削除しない。
- **Current**：「ダミーデータ再投入」も`yearInitialUnrealized`を削除しないため、再投入条件を満たさない可能性がある。
- **Known issue**：削除後も旧値が表示される、またはダミー再投入が期待どおり動かない可能性がある。
- **Decided**：削除対象を明示し、正本削除とキャッシュ破棄を分ける。実装時は事前バックアップを必須とする。

### tradeInfoの利用状況

- **Current**：`tradeinfo/`は独自`tradeInfo`キーを使い、損益を`価格差 × lot × 10000`で計算する。
- **Current**：現在の主要ナビゲーションからはリンクされていない。
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

- **Current**：現在レートに平均建値を表示し、証拠金維持率は`---`、チャートは固定値である。
- **Known issue**：見た目上は実データ詳細に見える。
- **Decided**：実データで算出できない項目は未取得・未実装と明示する。

### FX必要証拠金が概算

- **Current**：平均建値と履歴上の換算レートまたは固定換算値を使い、想定元本の4%で計算する。
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

### 自動テストがない

- **Current**：計算、データ移行、バックアップ互換性の自動テストがない。
- **Known issue**：重複計算やlocalStorage変更の回帰を検出しにくい。
- **Planned**：共有計算とバックアップから優先的にテストする。

## 3. Legacy / Experimental一覧

| 対象 | 分類 | 方針 |
|---|---|---|
| `tradeinfo/` | Legacy | 現在は未使用で、正式機能として維持しない。残存時のみ移行・削除判断まで一時保護 |
| `analysis/rates.*` | Experimental | 固定サンプル。正式データ源未決定 |
| `tenkan/*` | Experimental | 固定ダミー。売買推奨機能として扱わない |
| Position Details固定チャート | Experimental / placeholder | 実データ化または未実装表示へ変更予定 |
| OCR UI | Planned placeholder | CSV優先方針の後でPDF/OCRを検討 |
| `tmp_sbi_diff.txt` | Legacy diagnostic artifact | 実行時未使用。削除可否は別途判断 |
| `input/` | Empty / unknown | 現在空。将来用途は不明 |

## 4. 判断不能事項

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
