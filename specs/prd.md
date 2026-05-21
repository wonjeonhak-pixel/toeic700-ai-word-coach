# PRD — TOEIC700 AI英単語コーチ

本ドキュメントは、Claude Code に実装・改善を依頼する際の根拠仕様書（Product Requirements Document）です。`strategy.md` で定義した戦略を、実装可能な粒度の要求に落とし込みます。

---

## スコープ

社会人向け、TOEIC700帯のビジネス英単語を **1セッション10問** で学習するWebアプリ。Next.js + Claude API + Vercel デプロイの構成で MVP を完成させる。

---

## プロダクト要求

### P-1. 1プレイ10問

- 1セッションは固定で 10問。中断・再開・スキップは設けない。
- 想定所要時間は約3分（1問あたり15〜20秒目安）。

### P-2. 英単語 → 日本語4択

- 出題は英単語（例: `provide`）を見せ、日本語訳を4択から選ばせる形式。
- 4択のうち1つは正解、3つは誤答（distractor）。
- 誤答は同じ品詞（`pos`）から優先抽出、`similar` 欄の語を最優先、続いて近い `level` の語から補完する。

### P-3. 支給JSON 300語を使用

- データソースは支給された `data/toeic_wordlist.json`（300語）のみ。
- スキーマ: `id` / `word` / `pos` / `meaning` / `level` / `example_scene` / `similar`
- 外部DB・外部API（辞書API等）への依存は持たない。

### P-4. Claude APIによる正解時コメント

- 正解時、Claude API から以下の項目を JSON で返す。
  - `is_correct: true` / `feedback_title`（10字以内）/ `short_comment`（40字以内）/ `business_example`（英語12語以内、当該単語を含む）/ `example_translation`（40字以内、日本語のみ）
- 目的: 正解の手応えを残しつつ、テンポよく次へ進めるUX。

### P-5. Claude APIによる不正解時フル分析

- 不正解時、Claude API から以下の項目を JSON で返す。
  - `is_correct: false` / `feedback_title`（20字以内）/ `mistake_type`（5択固定）/ `reason`（80字以内・1文）/ `business_example` / `example_translation` / `memory_tip`（50字以内）/ `encouragement`（40字以内）
- `reason` は一般論禁止。ユーザーの選んだ訳と正解の差に必ず触れる。
- `example_translation` は日本語のみ。中国語簡体字（账・报・务・资 等）を禁止する。

### P-6. Claude APIによる10問終了後の総括

- 10問終了後、Claude API から以下の項目を JSON で返す。
  - `summary_title` / `learner_type` / `weakness` / `growth` / `next_action` / `toeic700_message`
- 観測事実主義（厳守）: 入力で渡した数値・配列（`firstHalfCorrect` / `secondHalfCorrect` / `mistakeTypeCounts` / `weakScenes` / `incorrectWords`）だけを根拠に書く。入力に無い事実を作らない。
- 後半改善の言及は `secondHalfCorrect > firstHalfCorrect` の場合のみ許可。
- `next_action` は、複数 `mistake_type` が混在する場合に全不正解語を1種類に一括ラベルしない。

### P-7. `mistake_type` 5択固定

以下の5値のみ許容。`other` は禁止。

| 値 | 意味 |
|---|---|
| `similar_word_confusion` | `similar` 欄の語、または近い意味の語との混同 |
| `part_of_speech_confusion` | 品詞の取り違え |
| `vague_memory` | 意味をぼんやり覚えている |
| `context_misunderstanding` | ビジネス場面での使い方が未定着 |
| `careless_mistake` | 正解に近いが選択ミスの可能性 |

- サーバ側でホワイトリスト検証を行い、想定外の値は `vague_memory` にフォールバック。

### P-8. `learner_type` 生成

- 10問終了後の総括 JSON に `learner_type` を含める。
- 20〜40字程度、末尾は必ず「〜タイプ」。
- `mistakeTypeCounts` の最頻 type または `weakScenes` の最頻 scene を根拠に「何をすれば伸びるか」を肯定的に表現する。
- 「苦手」「弱い」「理解力が低い」「定着しない」のような厳しい表現は禁止。
- 結果画面では `summary_title` の直下にカード表示する。

### P-9. Web Speech API による英語例文音声再生

- `business_example` を Web Speech API（`window.speechSynthesis`）で読み上げる。
- 正解時・不正解時の双方で再生ボタンを表示。
- `lang=en-US` / `rate=0.95`。再生中はボタンに pulse アニメ。
- 次の問題に進むと `useEffect` cleanup と親側の `key={index}` の二段構えで確実に停止。
- `speechSynthesis` 非対応ブラウザでは何も描画しない安全フォールバック。
- 外部ライブラリ追加禁止（ブラウザ標準APIのみ）。

### P-10. AnalyzingIndicator による AI 分析中表示

- Claude API 待機中、3パターンのメッセージを1.8秒ごとに循環表示する。
- 毎問フィードバック中の例: 「AIコーチが回答を分析しています…」「どの単語と混同したか確認しています…」「ビジネス文脈での使い方を整理しています…」
- 総括中の例: 「今日の弱点と成長を整理しています…」「TOEIC700への前進ポイントを分析しています…」「次回の学習ポイントをまとめています…」
- 3ドットの段差バウンスアニメ + テキスト切替時の軽いフェードイン。
- `role="status"` / `aria-live="polite"` でスクリーンリーダー対応。
- `prefers-reduced-motion: reduce` ユーザーにはアニメ無効化。

### P-11. 結果画面の「次回の重点単語」

- 結果画面の `summary` カード内、`next_action` の直下に表示。
- 不正解語が1問以上あるときのみ表示（0問なら非表示）。
- 不正解語のうち先頭3語を、`word + meaning` の小さなタグカードで縦並びに表示。
- 新APIコール追加なし。`sessionStorage` 内の既存 `records` を再利用する。
- 目的: 再訪時の戻り先を静かに示し、quiet UX における「また戻ってきやすさ」を担保する。

### P-12. Vercel デプロイ前提

- Next.js 15（App Router）。API Route は Node.js runtime で実行。
- Vercel に GitHub リポジトリを Import して自動デプロイ。
- `main` ブランチへの push で本番、PR で Preview デプロイが自動生成される構成。

### P-13. APIキーは環境変数管理

- `ANTHROPIC_API_KEY` はサーバサイドの API Route からのみ `process.env` 経由で参照する。
- フロントエンドのバンドルには絶対に含めない（クライアントコンポーネントから直接 Anthropic SDK を呼ばない）。
- `.env.local` は `.gitignore` に登録し、リポジトリに含めない。
- Vercel ダッシュボードでは Production / Preview / Development の3環境すべてに登録する。
- フォールバック: APIキー未設定でも全画面が動作する。APIキー未設定・呼び出し失敗・JSONパース失敗いずれの場合も、サーバ側で固定文言を返し、`_source` フィールドに `fallback_no_key` / `fallback_error` / `fallback_parse` のいずれかを付与する。

---

## 制約

- 外部DB・認証・有料サービスは追加しない。
- 外部ライブラリの追加は最小限（Anthropic SDK 以外を増やさない）。
- アプリ本体は1セッション完結型。学習履歴の永続化は行わない（`sessionStorage` のみ）。

---

## 受け入れ基準

- `npm run build` が型エラー・lint エラーなく完了する。
- `.env.local` を空・誤値・正しいキーのいずれにしても、UIが破綻せず10問完走できる。
- 不正解時のAI `reason` が、ユーザーの選択肢に具体的に触れている（汎用文ではない）。
- 10問総括の `growth` が、後半改善フラグ true のときだけ「後半で改善」と書く。
- `learner_type` が必ず「〜タイプ」で終わる。
- 結果画面で「次回の重点単語」が、不正解語0問のときは非表示、1問以上のときは最大3語表示される。
