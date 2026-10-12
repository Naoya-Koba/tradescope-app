# Development Guide

## Current — 共通取引source基盤

`assets/transaction-view.js`はDOM／Storage非依存の表示resolver。legacy manual、SBI raw、新ImportedTransactionsを読み、adopted Snapshot→ImportBatchでactive GMO sourceを選び、latest importedAtを正本にしない。曖昧dedupeは保持する。新RepositoryキーはtradeScopeImportedTransactionsV1、Backup v9／旧1〜8互換／同一journal・rollbackで保護する。画面読込からseed・Migrationしない。月次calculatorとRisk sourceは変更しない。新取引Viewは共通履歴UIからのみ使う。

## Traders Storage / Backup v8

**Current / UI**：`import/traders-preview.js`は口座別PDF Previewとcalendar入力を担当し、保存は`import/traders-save.js`だけを呼ぶ。blankでもPDF-only partial保存可能。`assets/traders-monthly-ui.js`は保存済みPDF源をread-onlyで表示し、非永続Draftのcalendar後入力・5項目訂正を同serviceへ渡す。成功はRepository再読込検証後のみ。legacy Inputへの混入・cutover後legacy保存は拒否する。PWA v280、今回変更資産のqueryは20261012-2。匿名localhostで1280／390幅・保存・reload・再取込・Backupを検証する。実iPhoneは別途必要。

**Current**：`import/traders-save.js`は商品別口座を固定し保存直前に再検証する。一回のRepository commitでAccount遅延生成／FX Instrument再利用／Batch／観測／建玉群／MonthlyAccountInput v2／完全時だけState／cache無効化を保護する。blank swapはnull、exact hashはpartialでもno-op。後入力は保存済みInputのPDF採用先を利用し再選択不要。別hash訂正はInput／State／採用Snapshot／calendar採用値の確認一致後だけ新PDF sourceを追記する。calendar原入力・採用値はPDF訂正と独立し、complete後の手修正・reset・原値保護を維持する。Backup v8、旧v1〜v7受理範囲固定。Risk sourceは変更しない。

## Traders Securities monthly PDF

**Current**：`import/traders-parser.js`は商品別detector／mappingと共通の位置付きテキスト解析を提供する。ファイル名・PIIを判定根拠にしない。回転ページの抽出座標を読み方向へ補正し、公式PDF.js 6.4.299のUniJIS-UCS2-H CMap（25,439 bytes）を追加。getReader／local worker／公式fake-worker／safe stageは維持し、CDN・別PDFライブラリは追加しない。

## Current — 部分取込の表示層

`assets/monthly-display-view.js`はDOM／Storage非依存で、Top・年間Summary・口座配分へ同じ`dashboard`結果、Asset／Performance Trendへ月時点の同じprojection、Monthly P/Lと年間内訳へ既知値集計を返す。画面側で金融値や成長率を再計算しない。canonical ledgerは厳密なまま保持する。部分取込を旧Snapshotキャッシュから取得しない。正本変更時のstorage eventと再表示で再計算し、fingerprintに未採用観測とprojection versionも含める。

`tests/monthly-display.test.js`は匿名のGMO完全／SBI部分／旧月口座、nullと0、複数候補、指標別sourceMonth、無書込、canonical回帰を検証する。`tests/monthly-display-browser.*`はlocalhost専用の架空Storageとcleanupであり、production導線／precacheには含めない。実金融データ・実Backupを使用しない。

## Current — Inputレイアウト統一と手修正境界

Inputは口座カード内に青い全幅「保存」を置き、global保存は廃止する。legacy編集は`legacyInputData`の非永続Draftで、`assets/legacy-monthly-save.js`が最新Storageから対象口座だけを差し替える。既存month.__savedは維持し、今後の保存は口座row.__savedで明示0の証拠を付ける。他口座Draftを混入させず、expectedRow・journal・再読込検証・cache無効化で保護する。GMOは`assets/gmo-monthly-ui.js`から既存手修正serviceへ接続し、5項目編集と小さな「取込値に戻す」を提供する。SBIは既存保存serviceを維持し、swap欄なし、口座全体の既知評価値と初期折りたたみ「資産内訳」を表示する。国内評価額・評価損益もDraft、取得日はread-only。独立した「取込済み」行・個別銘柄一覧は置かない。

**Current**：`assets/gmo-monthly-save.js`は初回明示編集だけv3化し原値5項目と採用値の差分metadataを保存する。原Snapshotは更新しない。GMO Inputはこのserviceだけを呼び、expectedModelsとjournalによるState＋cache無効化／再読込一致後に表示を更新する。未編集保存は無書込。取込値へ戻す操作はまずDraftだけを更新し、明示保存で採用値を戻す。Backup v8、旧v4〜v7範囲固定、v1〜v8／rollback／PII拒否を匿名fixtureで検証する。

## Current — GMO月次取込の完成範囲

口座保存は各カードの「保存」を明示クリックしたときだけ実行する。GMO・SBI・legacyとも追加のネイティブ確認ダイアログを挟まない。空欄、stale data、quota等の検証をserviceで行い、他口座は書き換えない。取込／訂正や削除の既存確認とは別責務である。

`import/gmo-parser.js`は帳票判定とallowlist出口、`import/gmo-preview.js`は選択・Preview・確認、`import/gmo-save.js`は取込保存／明示訂正を担当する。Input手修正は別のgmo-monthly-save serviceで原Snapshotを保持する。画面側に独自Storage writeや金融計算を置かず、全画面で共有resolver／表示projectionを使用する。PDF保存だけでlegacy monthly・履歴を変更しない。

PDFの読み取り検証とlocalhost／匿名操作を用い、実PDFはparser-onlyのローカル確認に限定する。`tests/gmo-*.test.js`とPDF／PWA integrity testsを既存全テストへ追加する。`tests/gmo-browser-smoke.html`はlocalhost専用の匿名fixture／状態確認／cleanup／ローカルPDF解析用で、production画面・precacheから参照しない。実iPhone PWA、他社帳票、OCRは未確認／未対応である。

## Current — GMO parser / Preview

共通extractorの位置付きtext itemsをGMO固有parserで読む。ページ番号に依存せず帳票・見出し・ヘッダー位置を確認する。parserの出口は金融値と対象月・月末日だけのallowlistであり、入出金明細末尾の日付／両替レートなしの区分別小計は明細との検算に使い、二重加算しない。実PDFはローカル読み取り検証だけに使用し、テストは架空の金額と構造で実施する。GMO保存は専用serviceで明示確認後に行う。

**Current / 共通PDF基盤**：PDF.js 6.4.299 legacyのmain／local workerと実帳票で必要だった日本語CMap二つを固定vendorし、公式SHA-256を照合した。LICENSEを保持する。`import/pdf-extractor.mjs`はページ番号・文字列・位置だけを一時メモリへ返し、broker解釈・描画・保存・外部送信をしない。20MB／100ページ／150000 item上限と中止・worker cleanupを持つ。CSPは同一origin静的資産とworkerのみ許可し、unsafe-eval／CDN／WASMを使わない。オフラインnavigationは要求されたキャッシュ済みページを先に返す。実iPhone未確認。

**Current / Safari互換修正**：`getTextContent()`内部のStream非同期反復を使わず、同じ公開`streamTextContent()`を`getReader().read()`で読み取る（[PDF.js公式issue #20973](https://github.com/mozilla/pdf.js/issues/20973)）。通常のmodule workerとPDF.js公式fake-worker fallbackは維持し、UA分岐・global polyfill・vendor改変を行わない。worker readiness・document load・text extractionを分離し、中止／終了時にreader・page・task・workerを解放する。

読み取り失敗はfile／engine／worker／document／text／GMO detector／parser／validation／保存前確認を区別する固定codeと短い文言で表示する。診断は画面内のstage／codeのみとし、例外message・stack・PDF本文・PII・URLを出力／保存しない。金融Parser・保存・Backup仕様は変更しない。実iPhone Safari／PWAでの修正後確認は別途必要。

**Current / resolver基盤**：口座policyとadapterを分離し、画面別broker計算を追加しない。SBIは従来結果を維持し、GMOも2026-09からproduction計算で有効。State・採用Snapshot・関連Batch・policy versionをfingerprintへ含める。

## 月次schema互換（Current）

汎用採用参照はMonthlyAccountState record v2、envelope v1、Backup v4とする。v3の旧record Validatorを固定し、Repository拡張で旧Backupの受理範囲を広げない。GMO PDF取込・保存・集計は実装済みであり、既存SBI接続は維持する。

**Decided**：銘柄表示名更新はstable ID／code／tickerと分離する。現在保有の表示名は更新可能、過去取引の名称は当時表記を保持し、名称変更だけのInstrument増殖・履歴上書きを行わない。

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
  import.html                SBI domestic CSV preview and confirmed save
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

**Current**：`assets/data-model-storage.js`がAccount、Instrument、ImportBatch、RawTransaction、HoldingSnapshot、AccountSnapshot、MonthlyAccountState、MonthlyAccountInputのschema検証・Repository・注入式localStorage Adapterを提供する。module読込・Repository生成・readでseedやMigrationはしない。具体的なallowlist・参照制約はコードと`DATA_MODEL.md`のCurrentを参照する。

**Current**：`assets/storage-transaction.js`は複数キー保存、再読込一致確認、生文字列rollbackを共通化する。中断journalがあれば保存を拒否する。最新完全バックアップv8は8collectionを保護する。v1は8キー維持、v2は6collection復元＋Stateと新Inputクリア、v3〜v5は公開済み7collection復元＋新Inputクリア。各versionの受理範囲を固定する。

**Current**：SBI Previewと保存可否判定は新Storageを読み取り専用で参照する。確認後保存だけを既存保存serviceへ接続する。UI独自のRepository commitやStorage writeは設けない。Summary / Asset Trend / Risk / 月次入力判定のデータ源も変更しない。

**Current**：`import/sbi-save.js`の保存エンジンは1ファイルずつ処理し、既存Preview resolverとRepositoryを再利用する。Adapter・clock・cryptoを注入でき、module読込・構築・read・inspectではseedしない。保存時のみAccountを必要に応じて追加し、既存Account／Instrumentは上書きしない。重複・競合・不正／要確認があれば全ファイルを停止する。取込UIは同じ検証の`inspect`で事前判定し、確認モーダル後に`save`を呼ぶ。

**Current**：Repositoryの`commit(changes, {expectedModels})`は非同期判定中の変更を検知する。journal保護中にbyte一致確認に加え全モデル再読込・schema／参照・期待内容一致を検証し、失敗時は同じrollbackを行う。v1復元の既存維持仕様は変更しない。完全排他ではなく、タブ競合・Storage障害の既存限界を保持する。

**Known issue / Planned**：journalも含むlocalStorage容量を計測し、将来のIndexedDB移行と複数タブ排他を別途設計する。保存権限喪失等でrollbackまで失敗した場合、Web Storageだけで完全復旧は保証できないためjournalを保護して新規保存を止める。現在の同期Adapterを非同期DBへ移す際はRepository APIも調整する。

### 月次正本の実装境界

**Decided / SBI月次確定**：2026-08以前・他口座は従来計算を維持する。2026-09以降のSBIは共有resolverのmissing／conflictを含む判定だけを用い、legacy placeholderへ戻さない。必要入力が完全な場合だけUI保存を許可し、null許容schema自体は変更しない。

**Current**：`assets/monthly-account-resolver.js`と`assets/sbi-monthly-save.js`を追加。後者はAccountSnapshotとMonthlyAccountStateを一回の既存Repository transactionで保護し、採用国内データの再検証・expectedModels・訂正履歴保持を行う。Repository／Backup schema変更、Migration、seedはない。`tests/sbi-monthly.test.js`はcutover、legacy conflict、completeness、欠損伝播、訂正、atomic保存・失敗rollback、canonical fingerprintを匿名fixtureで確認する。`assets/sbi-monthly-ui.js`は保存serviceを通して確定し、Input／Summary／Top／Trendを同じ共有計算へ同時接続する。匿名テストで保存・訂正後のv3往復とUI状態遷移も確認する。

**Decided**：MonthlyAccountStateは観測Snapshotと分離した口座・月の明示確定記録とする。共通Repositoryへ統合し、7モデルを保護するBackup v4、version別Validation、journal／rollbackを先に検証する。v2は6モデル形式を固定し、v2 Restore時のStateクリアも同一transactionに含める。v1／Legacy RestoreではStateを維持する。

**Current**：MonthlyAccountStateのStorage・検証・Backup v4への統合は完了。`assets/sbi-input-draft.js`はread-only Repository経由でSBI国内保有の候補を読み、既存CSV共通処理のdecimal加算を利用する。Inputの新方式SBIだけを月別の非永続Draftへ分離し、国内値を安全なDOMプロパティでフォームへ表示する。候補Batchを合算・latest自動採用しない。表示・月切替・Draft編集では金融Storageとlegacyメモリを変更せず、既存月次保存からもDraftを除外する。2026年1〜8月はlegacyを維持し、9月以降のSBIは未取込でも新方式Draftとする。国内採用値・入力済み外国証券／現金manualは口座内で明示保存し、全必須値が揃った場合のみ月次状態を更新する。集計は共有計算へ接続し、旧月次へのコピーは行わない。

**Decided**：表示・read・初期化でseedしない。Input Draftはメモリ上に分離し、明示保存でのみMonthlyAccountInputと入力済みmanual AccountSnapshotを更新し、必要値が揃う場合だけ月次状態を更新する。国内値の表示・partial採用値保存だけを月次確定や台帳更新と混同せず、legacy monthlyへコピーしない。既存台帳式を維持し、観測Viewから差額損益を逆算しない。schema・一意性・参照・null／0・version別復元・新キー途中失敗／再読込不一致／rollback不能を匿名fixtureで検証する。

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

**Current**：主要3画面のハンバーガー「データ取込」と損益管理Inputの共通ショートカットから`import.html`を開く。ボトムナビは変更しない。既存の損益・履歴・バックアップモジュールはこの画面に読み込まない。確認前のPreviewは非破壊で、保存は既存serviceに限定する。閉じる・ページ離脱時にメモリ上の候補と明細DOMを破棄する。

- `import/csv-core.js`：引用符、escaped quote、値中カンマ・改行、CRLF / LF、BOMを扱うCSV解析。ブラウザ標準`TextDecoder`でUTF-8を検証後、失敗時にShift_JIS（ブラウザのCP932系対応）を試す。手動指定も可能。UTF-16には未対応。
- `import/sbi-parser.js`：明示した日本語ヘッダーだけを照合し、allowlist項目の一時Preview Rowを生成する。未知列・前書き・ファイル名・個人識別情報を中間データへコピーしない。ヘッダーを曖昧補正しない。Parser versionは一箇所に定義し、解析結果からBatchの`importerVersion`へ引き継ぐ。仕様変更時はこのversionとPWA資産URLを更新する。
- `import/model-preview.js`：Parser結果と明示した対象月・観測日をImportBatch / Instrument / HoldingSnapshot / RawTransactionの一時候補へ変換する。SBI Accountは未保存でもseedしない。コード一致を優先し、コードなしSBI投信は出所・商品区分・正式名の完全一致で共有／再利用する。`投信金額買付`の完全一致だけを一箇所のmappingで投資信託へ分類し、保有CSVを必須にせず、原文の取引区分を保持する。未知の区分や類似名を推測分類しない。Instrument未解決の約定も取引事実DraftとしてPreviewに残し、解決状態・保存可能性を分離する。未確認の出所、曖昧一致・重複候補は自動統合せず、未解決・不正行は保存可能候補からのみ除外する。Storageのrecord・参照検証を再利用し、保存日時はDraftに含めない。既存のflat HoldingSnapshot集合は共通Batch・口座・月・日時・取得範囲とBatchのsourceTypeで一観測として扱い、保存schemaを変えない。株式系の細分類不明は候補の`subtype: null`とし、上位分類が分かる行まで除外しない。
- 「保存予定内容」は件数・対象月・取得日・必要な注意だけを表示し、候補明細は任意展開とする。Parser取引件数と、要確認も含む取引候補件数・保存可能件数・要確認件数を区別し、要確認がある場合だけ追加件数を表示する。同じ種類の注意はまとめ、内部ID・JSON全文を表示しない。2種類のCSVを同じsessionで確認でき、両方の件数を同時表示し、詳細は切り替える。指定した日付は切り替え時と同一hashファイルの再選択時だけ維持し、別ファイルへ引き継がない。閉じる・会社を閉じる・文字コード変更・離脱で両方破棄する。非同期処理の完了が閉じたPreviewを再表示しないようtokenを確認する。
- `detectKind()`は同じヘッダー定義を使い、保有証券／約定履歴の必須明細ヘッダーが揃うかを確認する純粋関数。種別不一致・不明・両形式の混在はPreview前に止め、保存へ進めない。ファイル名やタイトルだけで推測しない。
- 会社選択はネイティブの`details`による同画面内展開。SBIを閉じると一時Previewを破棄し、読み込み途中の結果も採用しない。未対応会社は無効な「準備中」表示のみ。PCはCSV選択を2列、スマホは縦積み・明細の項目別表示とし、safe-areaとreduced-motionを考慮する。
- 数値はdecimal文字列、空欄は`null`。合計はdecimalの桁合わせとBigInt加算で検算する。CSV合計行と明細の値を勝手に補正しない。問題行を除く集計には注意を表示する。
- 保有証券の必須ヘッダーは銘柄、数量、評価額。約定履歴は約定日、銘柄、取引、数量、単価（内部モデル名は`transactionType`）。欠落・重複ヘッダーはError、不正値・必須値欠落は行Error、未知列・合計不一致はWarning。正常な任意項目の空欄・`--`は`null`とし、不要なWarningを出さない。正常行と問題行を明細で分けて確認できる。
- 実ファイルで確認した保有証券形式は複数セクションで、商品・預り区分は見出しから取得する。株式の`銘柄名称`、投信の`ファンド名`、特定・NISA成長／つみたて投資枠に対応する。別ブロックの`評価額合計` / `評価損益合計`を同じ区分の明細と照合する。`売却注文中`の空欄や投信のコード欠落は正常である。
- 投信の`保有口数`の末尾`口`は数値と単位に分離し、原表記は一時`rawFields`へ保持する。価格当たり口数の推測換算はしない。符号・末尾空白・小数を扱う。
- 約定履歴の前置きから、明示された検索期間・明細数・明細指定範囲だけを抽出する。ページ分割時は明細指定範囲の件数、範囲がなければ明細数と実行数を検算する。検索期間と実際の約定期間は区別し、検索期間を保有の観測日にはしない。`銘柄` / `取引` / `預り` / `手数料/諸経費等` / `税額` / `期限` / `課税`を明示照合する。商品区分・注文種別の列がないことや、投信のコード・市場空欄は異常としない。
- `受渡金額 / 決済損益`は`settlementOrPnl`として保持し、実現損益へ変換・合計しない。原資料の列名もallowlistの`sourceHeaders`で保持する。数量の単位や投信の価格当たり口数を推測して換算しない。
- `基準日` / `基準日時`の明示行は4桁年の日付・日時を取得する。時刻・タイムゾーンがなければ追加しない。日時がない場合は取得日をユーザーが指定する（`File.lastModified`を確定値に使わない）。対象月は別の一時選択値で、既存月次へ反映しない。
- 描画は`textContent`、10MBまでのファイル、明細は100行ずつ表示。CSPはPDF補助資産用に`connect-src 'self'`へ限定し、外部接続は許可しない。新画面のアセットは同一originのみ。公式取得案内リンクはユーザーが開いた場合のみ別タブへ移動する。

**Current**：上記のコードなしSBI投信の正式名identityは、比較時のみJavaScriptの`\s`に該当する空白差を除いた完全一致とする。共通resolverでPreviewと保存直前の再照合を揃え、原表記を保持する。空白以外の曖昧一致や複数既存IDの自動選択、既存重複のmigrationは行わない。

**Current / 検証**：`node --test tests/sbi-import.test.js tests/sbi-model-preview.test.js`で架空の最小CSVとDOM harnessを使う。読み取り専用Storageを注入し、storage書き込み・送信・console APIに接続したら失敗するテストを含む。両CSV変換、null / 0、日付分離、銘柄照合・曖昧一致、重複候補、参照検証、PII項目除外、候補表示と破棄、既存月次状態不変を確認する。実ブラウザでの実ファイル確認とは区別する。

**Current / Storage・復元検証**：`node --test tests/*.test.js`で匿名Storageの往復、decimal、quota／journal／rollback、v1〜v8互換、未知field／version、PII拒否を確認する。gmo-monthly-override／gmo-monthly-ui／account-monthly-save testsで原値保護、未編集v2不変、初回昇格、採用値反映、口座単位保存と他Draft非混入を確認する。実Storage・実CSV・実Backup・本番PWAに接続しない。

**Current / 保存エンジン・UI検証**：`node --test tests/*.test.js`は`tests/sbi-save.test.js`も含む。匿名Adapterで遅延追加・再利用、file単位保存、重複停止、quota／journal失敗、再読込検証、rollback、最新v8 export／restore、v1互換、旧月次非変更を確認する。DOM harnessで保存表示条件、確認・キャンセル、検証完了後の保存済み表示、連打防止、再読込後の判定と導線を確認する。UI接続の実ブラウザ検証には隔離localhostと架空CSVだけを使用し、実CSVを保存しない。

**Current / 実形式検証**：ローカルに残っていた保有証券一覧・約定履歴の2ファイルをリポジトリへコピーせずread-onlyで解析し、Shift_JIS系デコード、日本語ヘッダー、セクション別合計と明細件数の一致を確認した。両ファイルはError / Warningなしで解析できた。実データはfixture・ログ・storageへ複製していない。テストには公開ヘッダー構造だけを用い、全明細値を独立した架空値で作成する。

**Under consideration / Known issue**：確認済み2ファイル以外のSBIダウンロード形式・文字コード・区分の全網羅は未確認。年2桁の日付の根拠は未確定であり、世紀を推測しない。銘柄とコードが一つのセルに併記される場合はその文字列を保持し、コードを推測分割しない。未知商品・区分行は黙って国内合計へ混ぜない。匿名localhostの実ブラウザで保存・再読込・競合停止とPC／スマホ幅を確認した。OSのファイル選択画面および実機iPhone PWAでの操作は別途確認する。

**Known issue**：内蔵ブラウザの画面遷移で`ViewTransition opt-in disabled`が断続的に記録された。取込画面にも既存の共通遷移CSSを読み込むが、発生条件の全解消は未確認。遷移・保存操作は完了し、保存処理中のJavaScriptエラーとは区別する。

**Planned**：追加形式と実機での対応範囲をプライバシー保護下で検証する。対象月末と取得日の乖離警告の閾値は未決定であり、近似値を正式月末値へ昇格しない。実データ初回保存前のバックアップ取得は運用手順で扱い、通常のCSV保存ごとに案内を増やさない。

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

**Current / Decided**：`assets/account-ui.js`の`displayAccountName`はUI表示専用とする。計算・照合・集約・保存には従来の識別子を使い、履歴selectはvalueと表示テキストを分離する。口座名を含む派生キャッシュも表示時だけ変換し、正本やキャッシュの更新を表示名変更の条件にしない。

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

**Current / UI検証**：`tests/sbi-monthly-ui.test.js`は匿名DOMで国内編集、partial保存、明示0、常設保存ボタン、取得日保持、reset、再読込と失敗表示を検証する。PC 1280／mobile 390で内訳・保存・Summary・Top・Trendを確認し、パネル高さは変更後も更新する。PWAはv276で変更資産のqueryとprecacheを同期する。

## Current — SBI部分保存・Input状態

SBI国内2項目の変更は非永続Draft、各「取込値に戻す」もDraftだけを変更する。口座内「保存」でsbi-monthly-save serviceだけを呼び、MonthlyAccountInput＋変更のあるmanual Snapshot＋完全時だけStateを一つのexpectedModels／journal保護操作で保存する。cache無効化失敗もrollbackする。取得日、raw Holding、他口座・他月・legacyは変更しない。GMO／SBI Inputは保存後もボタンを維持し独立した保存済みstatusを出さない。Importの保存済み表示は別用途として維持する。

**Known issue / 読み取り監査**：旧手入力履歴（tradeScopeTradeHistoryV1）とcanonical rawTransactions間の相互重複検知は未実装。CSV保存は旧履歴を消さず、取引履歴UIは旧履歴のみを読む。旧履歴は個別削除可、canonical取引／Batchのユーザー向け削除UIはない。約定CSVは旧月でも選択可能であり同一hashは無書込、異なるhashでcanonical重複候補があればfile全体を停止する。将来の統合履歴表示・cross-store重複解決は別仕様とする。
