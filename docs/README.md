# TradeScope Documentation

このディレクトリは、TradeScopeの製品仕様、データ、計算、Risk、バックアップ、開発ルールを正本化するための文書群である。

## 状態ラベル

- **Current**：現在のコードに存在する実装・動作
- **Decided**：今回正式に採用した仕様
- **Planned**：将来実装することが決まっている内容
- **Under consideration / Known issue**：将来検討事項または既知の問題

CurrentとDecidedが異なる場合、差異を隠さず記載する。Decidedは今後の実装目標だが、この文書作成だけを理由に既存データやコードを自動変更してはならない。

## 現在の公開環境

- **Current**：GitHub Pagesで [https://naoya-koba.github.io/tradescope-app/index.html](https://naoya-koba.github.io/tradescope-app/index.html) を公開している。
- **Current**：`localStorage`のWeb originは `https://naoya-koba.github.io` である。
- **Current**：主な利用形態は、iPhoneのホーム画面へ追加したPWA / Web Appである。
- **Unknown**：利用中の正確なSafari / WebKitバージョンは未確認である。
- **Data protection note**：iPhoneのホーム画面Web Appと通常のSafariでは、同じURLでもストレージが分離される可能性がある。両者でデータが見えない場合も初期化せず、利用形態とバックアップを確認する。

## 文書一覧

- [PRODUCT_SPEC.md](PRODUCT_SPEC.md)：製品の目的、対象機能、画面の役割
- [DATA_MODEL.md](DATA_MODEL.md)：正本データ、派生データ、Account、取引データ設計
- [CALCULATIONS.md](CALCULATIONS.md)：資産、損益、Asset Trend等の計算仕様
- [RISK_SPEC.md](RISK_SPEC.md)：耐性基準時損失、最大損失、Risk状態
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md)：完全バックアップ、後方互換、復元手順
- [DEVELOPMENT.md](DEVELOPMENT.md)：構成、開発・検証・移行ルール
- [LEGACY_AND_KNOWN_ISSUES.md](LEGACY_AND_KNOWN_ISSUES.md)：Legacy、Experimental、既知の問題
- [../AGENTS.md](../AGENTS.md)：リポジトリ全体に適用する作業ルール

## 仕様の優先関係

1. 実ユーザーデータの保護
2. `AGENTS.md` の安全・開発ルール
3. 本ディレクトリの Decided 仕様
4. Currentとして記録された既存挙動

金融計算やデータ移行に曖昧さがある場合、推測で実装せず、仕様上の不明点として確認する。

## 現在の主要ソース対応

- トップ：`index.html`、`top/script.js`、`top/style.css`
- 損益管理：`profit/soneki.html`、`profit/soneki.js`、`profit/soneki.css`
- 取引履歴：`history.html`、`history/history.js`、`assets/trade-history-core.js`
- 共通損益計算：`assets/profit-metrics.js`
- PWA：`manifest.webmanifest`、`service-worker.js`

**Known issue**：同一指標の計算がまだ複数ファイルに重複しており、文書のDecided原則を満たしていない。詳細は `LEGACY_AND_KNOWN_ISSUES.md` を参照する。
