# TOEIC700 AI英単語コーチ

**「なぜ間違えたか」が分かり、TOEIC700への前進を実感できる、社会人向けAI英単語コーチ。**

通勤30分・昼休み15分で1セッションが完結する、10問 × AIフィードバック型の英単語アプリです。Next.js (App Router) + TypeScript + Anthropic Claude API で実装しています。

---

## 想定ユーザー

32歳の社会人。TOEIC700点を目指しているが、学習時間は通勤30分と昼休み15分しか取れない。過去に英単語アプリを3日でやめた経験があり、**「今日これをやれば前進している」という実感** を求めている。

このアプリは、毎問のAI分析で「なぜ間違えたか」を言語化し、続けるほどTOEIC700に近づいている手応えを返します。

---

## 設計思想 — quiet UX

このアプリは、強いゲーミフィケーションや連続学習の圧ではなく、「5分で終われる」「また戻ってきやすい」**quiet UX** を重視して設計しました。社会人が通勤や昼休みに無理なく開けるよう、10問完結・短いAIフィードバック・静かな前進感を重視しています。streakやバッジ、派手な達成演出を意図的に置かず、結果画面の「次回の重点単語」で次に開いたときの戻り先だけを静かに示します。

---

## 主な機能

| # | 機能 | 内容 |
|---|---|---|
| 1 | 10問クイズ | 支給JSON 300語からランダムに10問出題。英単語 → 日本語4択。1セッション約3分 |
| 2 | AI誤答分析 | 不正解時、Claude API がユーザーの選択肢と正解の差を具体的に対比し、`mistake_type`（5択）・原因・覚え方・励ましを返す |
| 3 | AI正解コメント | 正解時は短い前向きコメントとビジネス例文を返し、テンポよく次へ進める |
| 4 | AI総括（10問終了後） | 観測事実（前半/後半正答数、`mistake_type` 分布、弱点 scene）だけを根拠に弱点・成長・次にやることを総括 |
| 5 | 例文音声再生 | `business_example` を Web Speech API で英語読み上げ。「単語の意味」だけでなく「実際のビジネス英語として使う感覚」を提供 |
| 6 | AI分析中のローディング体験 | Claude API 待機中、「AIコーチが回答を分析しています…」など3パターンの文言を循環表示。3ドットの段差バウンスでAIが考えている感覚を演出 |
| 7 | フォールバック動作 | APIキー未設定／呼び出し失敗時は固定文言で動作継続（学習体験を止めない） |

---

## 画面遷移

1. **ホーム** (`/`) — 「現在の重点：TOEIC600→700帯」表示、「今日の10問を始める」ボタン
2. **クイズ** (`/quiz`) — 10問のランダム出題＋毎問のAIフィードバック。例文には🔊「聞く」ボタン
3. **結果** (`/result`) — 正答数 + AI総括（弱点 / 成長 / 次にやること / TOEIC700メッセージ）+ 10問振り返り

スマホ縦長UIを想定したダークテーマです（max-width 480px）。

---

## 技術スタック

- **Next.js 15** (App Router)
- **React 19 RC**
- **TypeScript**
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude Haiku 4.5
- **Web Speech API** — 例文音声再生（ブラウザ標準、追加依存なし）

外部DB・認証・有料サービスは一切不要。デプロイ先は **Vercel** を想定。

---

## ディレクトリ構成

```
.
├─ app/
│  ├─ page.tsx              # ホーム
│  ├─ quiz/page.tsx         # 10問クイズ + AIフィードバック + 音声再生ボタン
│  ├─ result/page.tsx       # 結果 + AI総括
│  ├─ api/
│  │  ├─ feedback/route.ts  # 毎問のAIフィードバック（Claude API呼び出し）
│  │  └─ summary/route.ts   # 10問終了後の総括（Claude API呼び出し）
│  ├─ layout.tsx
│  └─ globals.css
├─ components/
│  ├─ SpeakButton.tsx       # 例文音声再生ボタン（Web Speech API）
│  └─ AnalyzingIndicator.tsx# AI分析中の循環メッセージ + 段差バウンスドット
├─ lib/
│  ├─ types.ts              # FeedbackRequest/Response, MistakeType, SummaryRequest など
│  ├─ wordlist.ts           # ランダム10問抽出 + 誤答選択肢生成
│  └─ claude.ts             # Anthropic クライアント + JSON抽出ユーティリティ
├─ data/
│  └─ toeic_wordlist.json   # 支給JSON（300語）
├─ scripts/
│  ├─ run-quiz-test.mjs     # 開発用：10問通しでAPIを叩き出力品質を観察するスクリプト
│  └─ test-learner-type.mjs # 開発用：summary API に3プロファイル投げて learner_type の品質を観察
└─ README.md
```

---

## セットアップ（ローカル）

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、Anthropic のAPIキーを設定します。

```bash
cp .env.local.example .env.local
```

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 省略可（既定: claude-haiku-4-5-20251001）
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

> **重要**: `ANTHROPIC_API_KEY` は **サーバ側 API Route からのみ** 参照されます（`lib/claude.ts`）。フロントエンドのバンドルには絶対に含まれません。
> APIキー未設定でも、フォールバック文言で全画面が動作します（AIコメントは固定文）。

### 3. 開発サーバ起動

```bash
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。**スマホ表示（DevToolsのデバイスエミュレーション等）で確認するのが想定UI** です。

### 4. 本番ビルド

```bash
npm run build
npm run start
```

---

## Vercel デプロイ手順

### 前提

- GitHub アカウント
- Vercel アカウント（GitHub連携でログイン可）
- 有効な `ANTHROPIC_API_KEY`

### 1. GitHub にリポジトリを push

```bash
git init
git add .
git commit -m "Initial commit: TOEIC700 AI英単語コーチ MVP"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

`.gitignore` により `.env.local` / `node_modules` / `.next` / `scripts/test-output.json` などは push 対象外です。

### 2. Vercel でプロジェクトをインポート

1. <https://vercel.com/new> を開く
2. **「Import Git Repository」** から先ほどpushしたリポジトリを選択
3. Framework Preset は **Next.js** が自動検出される（手動設定不要）
4. **「Environment Variables」** セクションで以下を追加：

   | Name | Value | 環境 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-api03-...`（本物の鍵） | Production / Preview / Development すべて |
   | `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | 同上（省略可） |

   > Vercel の環境変数は **暗号化保存** され、サーバサイドのRoute Handler からのみ `process.env` 経由で読めます。クライアントには露出しません。

5. **「Deploy」** をクリック → 初回ビルドが走り、数分でURL発行

### 3. 動作確認

- 発行されたURL（例: `https://your-app.vercel.app`）にアクセス
- 「今日の10問を始める」→ 1問回答 → AIフィードバックが返ることを確認
- 10問完了後、AI総括が表示されることを確認

### 4. 以降の更新

`main` ブランチへの push で自動的に本番デプロイ。PR作成時は Preview デプロイURLが自動生成されます。

### 環境変数を後から変更する場合

Vercel ダッシュボード → プロジェクト → **Settings → Environment Variables** で編集後、**Deployments → ⋯ → Redeploy** で反映。

---

## API 仕様

すべてサーバサイド（Node.js runtime）で実行されます。フロントエンドはこれらの内部APIだけを呼び、Anthropic APIへは直接アクセスしません。

### `POST /api/feedback`

毎問の状況を Claude API に渡し、正解時は短いコメント、不正解時はフル分析を返します。

**リクエスト**：

```json
{
  "word": "provide",
  "pos": "動詞",
  "meaning": "提供する・与える",
  "level": 1,
  "example_scene": "メール・報告",
  "similar": "supply, offer, give",
  "userAnswer": "供給する",
  "isCorrect": false
}
```

**レスポンス（正解時）**：

```json
{
  "is_correct": true,
  "feedback_title": "正解です",
  "short_comment": "ビジネスメールで頻出の単語です。",
  "business_example": "Please provide the quarterly report by Friday.",
  "example_translation": "四半期報告書を金曜日までにお願いします。"
}
```

**レスポンス（不正解時）**：

```json
{
  "is_correct": false,
  "feedback_title": "似た単語との混同です",
  "mistake_type": "similar_word_confusion",
  "reason": "require は need に近く「必要とする」で、入手・取得を意味する obtain や acquire とは異なります。",
  "business_example": "This project requires three experienced engineers.",
  "example_translation": "このプロジェクトには経験豊かなエンジニアが3人必要です。",
  "memory_tip": "require = re(再び) + quire(求める)。足りないものを「求める」イメージ。",
  "encouragement": "次回はぐっと正解に近づきます。"
}
```

#### `mistake_type` — 5択固定（"other" は使用しない）

| 値 | 意味 |
|---|---|
| `similar_word_confusion` | `similar` 欄の語、または近い意味の語との混同 |
| `part_of_speech_confusion` | 品詞の取り違え |
| `vague_memory` | 意味をぼんやり覚えている |
| `context_misunderstanding` | ビジネス場面での使い方が未定着 |
| `careless_mistake` | 正解に近いが選択ミスの可能性 |

サーバ側 (`app/api/feedback/route.ts`) で Claude の返答に対し5択のホワイトリスト検証を行い、5択以外なら `vague_memory` にフォールバックします。`other` は仕様上発生しません。

### `POST /api/summary`

10問の結果を Claude API に渡し、観測事実だけを根拠にした総括を返します。

**リクエスト（最新スキーマ）**：

```json
{
  "totalQuestions": 10,
  "correctCount": 4,
  "incorrectCount": 6,
  "firstHalfCorrect": 2,
  "secondHalfCorrect": 2,
  "mistakeTypeCounts": {
    "similar_word_confusion": 2,
    "vague_memory": 3,
    "context_misunderstanding": 1
  },
  "weakScenes": [
    { "scene": "要件・依頼", "count": 1 },
    { "scene": "経理・支払", "count": 1 }
  ],
  "incorrectWords": [
    {
      "word": "require",
      "meaning": "必要とする・要求する",
      "userAnswer": "入手する・得る",
      "example_scene": "要件・依頼",
      "mistake_type": "similar_word_confusion"
    }
  ]
}
```

**ハルシネーション抑制ルール（プロンプトに明記）**：

- `secondHalfCorrect > firstHalfCorrect` の場合のみ「後半で改善」と書ける
- `mistakeTypeCounts` に複数 type が混在する場合、すべての不正解語を1種類の type に一括ラベルしない（最頻のみ言及、または分けて書く）
- 入力に無いユーザーの心理・努力量・学習履歴を推測しない

**レスポンス例**：

```json
{
  "summary_title": "ビジネス語彙の基礎固め",
  "learner_type": "類義語の使い分けを整理すると伸びるタイプ",
  "weakness": "曖昧記憶による誤答が3問で最多です。attend・strategy・incentivize が課題です。",
  "growth": "4問正解で、ビジネス語彙の定着がスタートしています。",
  "next_action": "attend・strategy・incentivize の3語を中心に実務文脈での使い方を反復学習しましょう。",
  "toeic700_message": "弱点が見える今が、集中強化のチャンスです。"
}
```

`learner_type` は性格診断風キャッチコピー（20〜40字程度、末尾「〜タイプ」）。`mistakeTypeCounts` の最頻 type または `weakScenes` の最頻 scene を根拠に、「何をすれば伸びるか」を肯定的に表現します。「苦手」「弱い」「理解力が低い」のような厳しい表現はプロンプト側で禁止しています。結果画面では `summary_title` の直下にカード表示します。

---

## AI分析中のローディング体験

`components/AnalyzingIndicator.tsx` が Claude API 待機中に「AI が考えている感覚」を演出します。

- 1.8秒ごとに循環表示する3パターンのメッセージ:
  - **毎問フィードバック中**: 「AIコーチが回答を分析しています…」「どの単語と混同したか確認しています…」「ビジネス文脈での使い方を整理しています…」
  - **10問終了後の総括中**: 「今日の弱点と成長を整理しています…」「TOEIC700への前進ポイントを分析しています…」「次回の学習ポイントをまとめています…」
- 3ドットの段差バウンスアニメ + テキスト切替時の軽いフェードイン
- `role="status"` / `aria-live="polite"` でスクリーンリーダー対応
- `prefers-reduced-motion: reduce` ユーザーにはアニメ無効化

外部ライブラリ追加なし、CSSのみで実装。

---

## 例文音声再生（Web Speech API）

`components/SpeakButton.tsx` が `business_example` を読み上げます。

- ブラウザ標準API（`window.speechSynthesis`）のみ使用、追加依存・サーバAPI不要
- `lang=en-US` / `rate=0.95` で自然な速度の英語音声
- 再生中ボタンを押すと停止（トグル動作）
- 次の問題へ進むと `useEffect` cleanup と親側の `key={index}` の二段構えで確実に停止
- `speechSynthesis` 非対応ブラウザでは何も描画しない安全フォールバック

---

## フォールバック挙動

Claude API が失敗 / APIキー未設定 / JSONパース失敗のいずれかが起きた場合、レスポンスには同じ形式のフォールバック文言が入り、`_source` フィールドに以下のいずれかが付与されます。

| `_source` | 発生条件 |
|---|---|
| `fallback_no_key` | `ANTHROPIC_API_KEY` 未設定 |
| `fallback_error` | Claude API 呼び出しが例外（タイムアウト・401など） |
| `fallback_parse` | Claude の返答が想定JSONとして解釈不能 |

UI はいずれの場合も通常通り動作し、ユーザー体験は止まりません。

---

## データ

`data/toeic_wordlist.json` に支給された **300語** をそのまま配置しています。キー名は支給形式のまま：

```json
{
  "id": 1,
  "word": "provide",
  "pos": "動詞",
  "meaning": "提供する・与える",
  "level": 1,
  "example_scene": "メール・報告",
  "similar": "supply, offer, give"
}
```

---

## 開発スクリプト

`scripts/run-quiz-test.mjs` — 10問通しで `/api/feedback` と `/api/summary` を叩き、Claude API の出力を `scripts/test-output.json` に保存する検証スクリプト。プロンプト調整時の品質回帰チェックに使用します。

```bash
# dev server を別ターミナルで起動した状態で
node scripts/run-quiz-test.mjs
```

出力ファイルは `.gitignore` 対象です。

---

## ライセンス / 利用条件

本リポジトリは社内コンペ提出用の MVP 実装です。支給JSON（`data/toeic_wordlist.json`）の二次利用については主催者のガイドラインに従ってください。
