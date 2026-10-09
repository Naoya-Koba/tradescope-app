# Development Guide

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
  import.html                SBI domestic CSV preview (no persistence)
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

**Current**：トップの「データを取り込む」から`import.html`を開く。既存の損益・履歴・バックアップモジュールはこの画面に読み込まない。保存ボタン、Repository接続、storageアクセス、ネットワーク送信処理は存在しない。閉じる・ページ離脱時にメモリ上のPreviewと明細DOMを破棄する。

- `import/csv-core.js`：引用符、escaped quote、値中カンマ・改行、CRLF / LF、BOMを扱うCSV解析。ブラウザ標準`TextDecoder`でUTF-8を検証後、失敗時にShift_JIS（ブラウザのCP932系対応）を試す。手動指定も可能。UTF-16には未対応。
- `import/sbi-parser.js`：明示した日本語ヘッダーだけを照合し、allowlist項目の一時Preview Rowを生成する。未知列・前書き・ファイル名・個人識別情報を中間データへコピーしない。ヘッダーを曖昧補正しない。
- `detectKind()`は同じヘッダー定義を使い、保有証券／約定履歴の必須明細ヘッダーが揃うかを確認する純粋関数。種別不一致・不明・両形式の混在はPreview前に止める。ファイル名やタイトルだけで推測しない。将来の保存経路でもこの判定の成功を前提にするが、現段階では保存処理は接続しない。
- 会社選択はネイティブの`details`による同画面内展開。SBIを閉じると一時Previewを破棄し、読み込み途中の結果も採用しない。未対応会社は無効な「準備中」表示のみ。PCはCSV選択を2列、スマホは縦積み・明細の項目別表示とし、safe-areaとreduced-motionを考慮する。
- 数値はdecimal文字列、空欄は`null`。合計はdecimalの桁合わせとBigInt加算で検算する。CSV合計行と明細の値を勝手に補正しない。問題行を除く集計には注意を表示する。
- 保有証券の必須ヘッダーは銘柄、数量、評価額。約定履歴は約定日、銘柄、取引、数量、単価（内部モデル名は`transactionType`）。欠落・重複ヘッダーはError、不正値・必須値欠落は行Error、未知列・合計不一致はWarning。正常な任意項目の空欄・`--`は`null`とし、不要なWarningを出さない。正常行と問題行を明細で分けて確認できる。
- 実ファイルで確認した保有証券形式は複数セクションで、商品・預り区分は見出しから取得する。株式の`銘柄名称`、投信の`ファンド名`、特定・NISA成長／つみたて投資枠に対応する。別ブロックの`評価額合計` / `評価損益合計`を同じ区分の明細と照合する。`売却注文中`の空欄や投信のコード欠落は正常である。
- 投信の`保有口数`の末尾`口`は数値と単位に分離し、原表記は一時`rawFields`へ保持する。価格当たり口数の推測換算はしない。符号・末尾空白・小数を扱う。
- 約定履歴の前置きから、明示された検索期間・明細数・明細指定範囲だけを抽出する。ページ分割時は明細指定範囲の件数、範囲がなければ明細数と実行数を検算する。検索期間と実際の約定期間は区別し、検索期間を保有の観測日にはしない。`銘柄` / `取引` / `預り` / `手数料/諸経費等` / `税額` / `期限` / `課税`を明示照合する。商品区分・注文種別の列がないことや、投信のコード・市場空欄は異常としない。
- `受渡金額 / 決済損益`は`settlementOrPnl`として保持し、実現損益へ変換・合計しない。原資料の列名もallowlistの`sourceHeaders`で保持する。数量の単位や投信の価格当たり口数を推測して換算しない。
- `基準日` / `基準日時`の明示行は4桁年の日付・日時を取得する。時刻・タイムゾーンがなければ追加しない。日時がない場合は取得日をユーザーが指定する（`File.lastModified`を確定値に使わない）。対象月は別の一時選択値で、既存月次へ反映しない。
- 描画は`textContent`、10MBまでのファイル、明細は100行ずつ表示。CSPは`connect-src 'none'`。新画面のアセットは同一originのみ。公式取得案内リンクはユーザーが開いた場合のみ別タブへ移動する。

**Current / 検証**：`node --test tests/sbi-import.test.js`で架空の最小CSVとDOM harnessを使う。禁止storage・送信・console APIに接続したら失敗するテストを含む。実ブラウザでの実ファイル確認とは区別する。

**Current / 実形式検証**：ローカルに残っていた保有証券一覧・約定履歴の2ファイルをリポジトリへコピーせずread-onlyで解析し、Shift_JIS系デコード、日本語ヘッダー、セクション別合計と明細件数の一致を確認した。両ファイルはError / Warningなしで解析できた。実データはfixture・ログ・storageへ複製していない。テストには公開ヘッダー構造だけを用い、全明細値を独立した架空値で作成する。

**Under consideration / Known issue**：確認済み2ファイル以外のSBIダウンロード形式・文字コード・区分の全網羅は未確認。年2桁の日付の根拠は未確定であり、世紀を推測しない。銘柄とコードが一つのセルに併記される場合はその文字列を保持し、コードを推測分割しない。未知商品・区分行は黙って国内合計へ混ぜない。実ブラウザ / iPhone PWAでのファイル選択、表示、consoleエラーの確認は未完了。

**Planned**：追加形式と実機での対応範囲をプライバシー保護下で検証する。正式なモデル照合・重複検知・Storage・完全バックアップ対応後にのみ永続保存を解禁する。対象月末と取得日の乖離警告の閾値は未決定であり、この段階では保存や月末値への昇格をしない。

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

- precache対象は存在確認する。
- HTMLが実際に参照する資産とService Worker一覧を同期する。
- Cache version更新時は旧キャッシュ削除とデータ保存を混同しない。
- Cache Storage削除は`localStorage`正本を削除してはならない。

**Current**：`service-worker.js`のprecache対象は実在するファイルに限定し、トップ画面が読み込むCSS / JavaScriptと同じバージョン付きURLを使用する。PWA資産を変更した場合はCache versionも更新する。

## 13. UI Design System

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
