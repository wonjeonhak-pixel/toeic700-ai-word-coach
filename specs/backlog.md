# Backlog — TOEIC700 AI英単語コーチ

本ドキュメントは、`strategy.md` / `prd.md` に基づいて Claude Code と分担した実装タスクを、AI-DLC（AI-Driven Lifecycle）的な小さな単位で整理したものです。すべて MVP として完了済みです。

---

## データ層

- [x] 支給JSON `data/toeic_wordlist.json`（300語）の読み込み
- [x] `Word` 型定義（`id` / `word` / `pos` / `meaning` / `level` / `example_scene` / `similar`）

## 出題ロジック

- [x] 10問ランダム出題（Fisher-Yates シャッフル）
- [x] 4択選択肢生成（同 `pos` 優先 → `similar` 欄優先 → 近い `level` で補完）
- [x] 正解位置のランダム化

## クイズ画面

- [x] 1問1画面のレイアウト（`pos` / `example_scene` chip + 単語表示）
- [x] 4択ボタン UI（タップ後は正解緑 / 誤答赤に色分け）
- [x] 進捗バー + 「{i}/10 問」表示
- [x] 「次の問題へ」/「結果を見る」スティッキーボタン

## Claude API 連携

- [x] `lib/claude.ts` で Anthropic クライアントを `process.env.ANTHROPIC_API_KEY` から初期化
- [x] `extractJson<T>` ユーティリティ（コードフェンス・前後ノイズ除去）
- [x] サーバサイド API Route 化（`runtime = "nodejs"`）
- [x] フロントエンドへのキー露出回避（クライアントから直接 SDK を呼ばない設計）

## `/api/feedback` 実装

- [x] 正解時プロンプト（短いコメント + business_example + 翻訳）
- [x] 不正解時プロンプト（フル分析：mistake_type / reason / 例文 / 覚え方 / 励まし）
- [x] アシスタント prefill `{` で JSON 出力強制
- [x] 文字数ルール明文化（feedback_title / reason / business_example / etc）
- [x] `example_translation` の中国語簡体字禁止ルール
- [x] `reason` の一般論禁止ルール（userAnswer と meaning の差に必ず触れる）

## `/api/summary` 実装

- [x] 観測事実主義プロンプト（入力で渡した数値・配列だけを根拠に書く）
- [x] 後半改善フラグの厳密ルール（`secondHalfCorrect > firstHalfCorrect` の場合のみ言及可）
- [x] `next_action` 一括ラベル禁止ルール（複数 mistake_type の lump-labeling 防止）
- [x] `weakScenes` / `mistakeTypeCounts` / `incorrectWords` を入力スキーマ化

## JSON パース保険

- [x] アシスタント prefill による JSON 強制
- [x] `extractJson<T>` の3段クリーンアップ（前置ノイズ・コードフェンス・末尾切れ）
- [x] サーバ側 `validate()` で型・必須フィールド検査

## フォールバック実装

- [x] APIキー未設定時の固定文言レスポンス（`_source: fallback_no_key`）
- [x] Claude API 例外時の固定文言（`_source: fallback_error`）
- [x] JSON 解釈不能時の固定文言（`_source: fallback_parse`）
- [x] UI 側は `_source` を意識せず同一型で描画継続

## `mistake_type` 5択制御

- [x] 5値の `MistakeType` 型定義（`other` を型レベルで排除）
- [x] プロンプト側で5択を明示・`other` 禁止と明記
- [x] サーバ側 `ALLOWED_MISTAKE_TYPES` ホワイトリストで再検証
- [x] 想定外値の `vague_memory` フォールバック

## `learner_type` 追加

- [x] `SummaryResponse` 型に `learner_type` を追加
- [x] プロンプトに 20〜40字・末尾「〜タイプ」・厳しい表現禁止ルールを明記
- [x] `LEARNER_TYPE_BY_MISTAKE` 辞書でフォールバック文言を mistake_type 別に用意
- [x] 結果画面に `learner-type-card` UI を追加（`summary_title` 直下）
- [x] 開発検証スクリプト `scripts/test-learner-type.mjs` で 3 プロファイルの品質を観察

## SpeakButton 実装

- [x] `window.speechSynthesis` を使用（外部ライブラリ追加なし）
- [x] `lang=en-US` / `rate=0.95` の英語読み上げ
- [x] 再生中の pulse アニメと停止トグル
- [x] `useEffect` cleanup + 親側 `key={index}` の二段構え停止
- [x] `speechSynthesis` 非対応ブラウザでの安全フォールバック（`null` 描画）
- [x] 38px のタッチターゲット確保

## AnalyzingIndicator 実装

- [x] Claude API 待機中の循環メッセージ表示（1.8秒ごと）
- [x] 毎問フィードバック中の3メッセージ
- [x] 10問総括中の3メッセージ
- [x] 3ドット段差バウンス + テキスト切替フェード
- [x] `role="status"` / `aria-live="polite"` でスクリーンリーダー対応
- [x] `prefers-reduced-motion: reduce` でアニメ無効化

## 結果画面の「次回の重点単語」表示

- [x] `sessionStorage` の既存 records から不正解語を再利用（新API追加なし）
- [x] 最大3語を `word + meaning` の小タグで縦並び表示
- [x] 不正解語0件のときはセクションごと非表示
- [x] `summary-section` の既存リズムに馴染ませる CSS

## quiet UX 文言調整

- [x] ホーム sub 「通勤30分・昼休み15分で前進」→「今日の10問だけ、静かに前進」
- [x] summary fallback growth の「積み上げを続けましょう」→「今日の前進が積み上がっています」（命令形 → 観測表現）
- [x] 「毎日 / 連続 / 必ず続け / 達成 / 頑張」系の煽り文言点検（不検出を確認）
- [x] streak / バッジ / ランキング / 派手な達成演出を意図的に非実装

## README 更新

- [x] 想定ユーザー記載
- [x] 主な機能（7行表）
- [x] 設計思想 — quiet UX セクション
- [x] 画面遷移
- [x] 技術スタック
- [x] ディレクトリ構成
- [x] Vercel デプロイ手順
- [x] API 仕様（feedback / summary）
- [x] `mistake_type` 5択表
- [x] `learner_type` 仕様
- [x] AI分析中ローディング体験セクション
- [x] 例文音声再生セクション
- [x] フォールバック挙動表

## ビルド・デプロイ準備

- [x] `npm run build` が型エラーなく完了することを最終確認
- [x] `.gitignore` 設定（`.env.local` / `*.xlsx` / `*.pdf` / `scripts/test-output.json`）
- [x] `git check-ignore -v` で `.env.local` の除外を機械検証
- [x] `git add . && git diff --cached --name-only` で staged 22 ファイルの中身を点検
- [x] Initial commit 作成（22 files / 6,701 insertions）

## ドキュメント整備（本フェーズ）

- [x] `specs/strategy.md` 追加
- [x] `specs/prd.md` 追加
- [x] `specs/backlog.md` 追加（本ファイル）
- [x] README に `specs/` への参照を追記
