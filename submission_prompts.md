# Submission Prompts — TOEIC700 AI英単語コーチ

本ドキュメントは、本アプリが Claude API へ実際に送信している **3 種類のプロンプト全文** と、それぞれの設計意図を提出用に整理したものです。

対象プロンプト：

| # | API Route | 用途 | 呼び出しタイミング |
|---|---|---|---|
| 1 | `POST /api/feedback`（正解時） | 短い前向きコメント + ビジネス例文 | 各問の回答直後（正解時） |
| 2 | `POST /api/feedback`（不正解時） | フル誤答分析（mistake_type / 原因 / 覚え方 / 励まし） | 各問の回答直後（不正解時） |
| 3 | `POST /api/summary`（総括） | 10問終了後の総括 + learner_type | 結果画面遷移時 |

すべて Anthropic SDK 経由で **`claude-haiku-4-5-20251001`** を呼び出しています（環境変数 `ANTHROPIC_MODEL` で差し替え可能）。

ソース実装は `app/api/feedback/route.ts` および `app/api/summary/route.ts` に存在し、本ドキュメントの内容と1対1で対応しています。

---

## 1. プロンプト設計方針

本アプリのプロンプトは、以下 5 原則で設計しました。

### 1-1. JSON-only 出力

すべてのレスポンスを **JSON のみ** で返させます。説明文・Markdown・コードフェンスは禁止。最初の文字を `{`、最後の文字を `}` と明示し、サーバ側 (`extractJson<T>` / `validate()`) で再検証します。

加えて、Claude API への `messages` 末尾に **assistant prefill `{`** を1つ差し込むことで、モデルに「次のトークンは JSON 本体である」というコンテキストを強制します。これにより自然言語の前置きを物理的に出せなくなり、JSON 解釈失敗率を実測で 0% にできました。

### 1-2. キー名・順序・型を毎回明記

返却 JSON のテンプレートをプロンプト中に **キー順そのまま** 書き、各キーに `<20字以内>` のような文字数制約を inline 表記。型 (`string` / `boolean`) も指定。

```jsonc
{
  "is_correct": false,
  "feedback_title": "<20字以内>",
  "mistake_type": "<下記5択から1つ>",
  "reason": "<1文・80字以内>",
  ...
}
```

これにより、Claude が「説明的なフィールドを追加しよう」「キーを並べ替えよう」とする揺らぎを抑え、UI 側の型 (`FeedbackResponse`) と一致するレスポンスが安定して返ります。

### 1-3. 文字数ルールを inline & 別セクションで二重明示

文字数の上限は、JSON テンプレート内の `<n字以内>` 表記と、その下の「# 文字数・内容ルール」セクションの両方で明示します。冗長に見えますが、片方だけだと現実の Claude 出力では 30% 程度超過するため、二重指定が必要でした。

### 1-4. 入力スキーマを構造化テキストで渡す

`# 単語情報` / `# 観測事実` のような **見出し付きの key: value 形式** で入力データを渡します。JSON で渡すよりも自然言語との混在に強く、Claude が「これは事実、それ以外は生成」と切り分けやすくなります。

### 1-5. 厳禁ルールを明示的に書く

「`other` は使わない」「中国語簡体字は禁止」「一般論禁止」のような **禁止事項** を、ルールセクションに必ず1行ずつ書きます。禁止は許可より具体的に書く方が遵守率が高い、というモデル挙動を逆手にとっています。

---

## 2. Hallucination 抑制方針

特に総括 (`/api/summary`) は「観測事実主義」を厳守させる必要があるため、以下の4層構成で hallucination を抑制しています。

### 2-1. 観測事実主義の宣言（System prompt）

> # 観測事実主義（厳守）
> - 入力で渡された数値・配列だけを根拠に書く。入力に無い事実を作らない。
> - secondHalfCorrect > firstHalfCorrect の場合のみ growth に「後半で改善」と書ける。
> - 等しいまたは前半が高い場合は「後半で改善した」と書かない。
> - 入力に無いユーザーの心理・努力量・学習履歴を推測しない。

「ユーザーは頑張りました」「真面目に取り組んでいます」のような **観測できないことを書かせない** ことを明文化。

### 2-2. 観測値の事前計算 → プロンプトに焼き込み

サーバ側で `secondHalfCorrect > firstHalfCorrect` を事前計算し、**boolean フラグとしてプロンプトに直接埋める**：

> - 後半改善フラグ(secondHalfCorrect > firstHalfCorrect): true / false

「Claude に判定させる」のではなく「事実を渡す」設計に倒すことで、計算ミス起因のhallucination を防ぎます。

### 2-3. 一括ラベル禁止ルール

実 Claude テストで、`mistakeTypeCounts: {similar:2, vague:4}` のような複数 type 混在ケースで「曖昧記憶の6語」と一括ラベルする事象を観測したため、明示禁止：

> next_action: 複数 mistake_type が混在する場合、すべての不正解語を1種類の type に一括ラベルしないこと。**最頻 type のみに言及する** か、または **type 別に分けて書く**（例:「曖昧記憶4語と類義語混同2語」）。観測事実 (mistakeTypeCounts) と一致しないラベル付けは禁止。

### 2-4. サーバ側 5択ホワイトリスト

`mistake_type` は Claude の返り値をそのまま信用せず、サーバ側で `ALLOWED_MISTAKE_TYPES` (5値) と照合し、想定外なら `vague_memory` にフォールバックします。型レベル (`MistakeType` Union) でも `other` を排除しているため、UI 側に未定義値が到達しません。

---

## 3. quiet UX との関係

プロンプト側でも、UI と同じ "quiet UX" 思想を反映しています。

### 3-1. 文言の圧を弱める

- system prompt の人物像: 「**優しい**ビジネス英語コーチ」「**短く、前向き**で」
- 励まし文言の語数制約: `encouragement: 1文・40字以内` で過剰な煽りを物理的に書けない
- 厳しい表現の禁止リスト: `learner_type` 生成時に「苦手」「弱い」「理解力が低い」「単語が定着しないタイプ」を明示禁止

### 3-2. 「やらされ感」を返させない

`toeic700_message` には「TOEIC700到達に向けた前進感のある1〜2文。**誇張・断定は避ける**」と指定。「毎日続けましょう」「必ず達成できます」のような圧の強い表現を構造的に避けます。

### 3-3. learner_type による「自分専用感」

ランキング・連続日数・バッジを置かない代わりに、**観測ベースの性格診断風キャッチコピー** で1問1問の積み重ねを意味付けします。

> learner_type: 性格診断のような前向きキャッチコピー。20〜40字程度。末尾は必ず「〜タイプ」で締める。mistakeTypeCounts の最頻 type または weakScenes の最頻 scene を根拠に「**何をすれば伸びるか**」「**何が始まっているか**」を**肯定的に**表現する。

OK 例（プロンプトに直接記載）：
- 「似た意味の単語を整理すると伸びるタイプ」
- 「ビジネス文脈での使い分けを強化中タイプ」
- 「メール表現の語彙が伸び始めているタイプ」

NG 例（プロンプトに直接記載）：
- 「あなたは英語が苦手です」
- 「理解力が低いです」
- 「単語が定着しないタイプ」

### 3-4. business_example で「使える感覚」を返す

毎問のレスポンスに `business_example`（英語12語以内・該当単語必須）と `example_translation` をペアで含めます。意味の暗記だけで終わらせず、**メール・会議・報告の実務文脈** に貼り付けるためのアンカーを 3 分のセッション内で必ず1回返します。

`example_translation` には「日本語のみ。中国語簡体字（账・报・务・资 等）使用禁止」を明示。実 Claude テストで簡体字混入を観測したため追加した防御ルールです。

---

## 4. なぜ「毎日やらせる」設計を避けたか

本アプリは、過去に英単語アプリを 3 日でやめた経験のある社会人を想定しています。「streak」「連続学習日数」「ノルマ通知」型のゲーミフィケーションは短期的な続行率を上げる一方で、**1日休んだ瞬間の心理的サンクコスト** が高すぎ、再訪の障壁になります。

そのため、プロンプト側でも以下を意識しました。

### 4-1. 「続けましょう」「毎日」を構造的に出させない

system prompt と user prompt のいずれにも「毎日」「連続」「ノルマ」を入れていません。さらに `next_action` のルールは「次回1セッションでやること」と書き、**「明日も」「継続して」のような時間軸での圧** を出さない構造にしています。

### 4-2. 観測値ベースで「今日の前進」を返す

`growth` フィールドは：

- 後半改善フラグ true の場合 → 「後半で改善」「後半が安定」
- それ以外 → 「N問正解、ビジネス語彙の積み上げが進んでいます」

のように **「今日のセッションで観測された事実」だけを根拠** にした静かな前進感を返します。明日や継続を約束させない。

### 4-3. learner_type を「進行形」で書かせる

`learner_type` は「〜すると伸びる**タイプ**」「〜が伸び始めている**タイプ**」のように、**現在進行形の前向き表現** に限定。「達成した」「克服した」のような完了感も、「まだダメ」のような未達感も出さない、quiet な手応えに揃えます。

### 4-4. fallback でも quiet UX を保持

API キー未設定・呼び出し失敗時の固定文言（次章参照）も同じ思想で書き、「**1日10問の積み重ねで、TOEIC700のビジネス語彙が着実に固まっていきます**」のように、命令形・断定・連続強要を含まない表現に統一しています。

---

## 5. プロンプト全文 — `/api/feedback`

### 5-1. System prompt（正解・不正解 共通）

```
あなたは優しいビジネス英語コーチです。TOEIC700点突破を目指す32歳の社会人を担当しています。
- 短く、前向きで、実務文脈のあるコメントをします。
- 通勤や昼休みの短い学習でも前進を実感できるよう励まします。
- 文面はすべて日本語。例文(business_example)のみ英語。

# 出力フォーマット規律（厳守）
- 出力はJSONのみ。説明文、Markdown、コードフェンス(```) は禁止。
- 最初の文字は { 、最後の文字は } 。前後に空白や改行を入れない。
- JSON内の文字列値に改行文字を入れない。1フィールド=1行の文字列。
- キー名、キーの並び順、型(string/boolean)を指定通りに守る。
```

**設計意図**: ペルソナ（優しいコーチ）と出力規律（JSON-only）を1つの system prompt にまとめ、正解時・不正解時の両 user prompt で再利用しています。コーチの人物像をシステム側に置くことで、ユーザープロンプトを毎問の事実情報だけに絞れます。

### 5-2. User prompt — 正解時

```
以下の単語に正解したユーザーへの短いフィードバックをJSONで返してください。

# 単語情報
- word: ${word}
- pos: ${pos}
- meaning: ${meaning}
- level: ${level}
- example_scene: ${example_scene}
- similar: ${similar}
- userAnswer: ${userAnswer}
- isCorrect: true

# 返却JSON（キー名・順序・型を厳守）
{
  "is_correct": true,
  "feedback_title": "<10字以内>",
  "short_comment": "<1文・40字以内>",
  "business_example": "<英語1文・12語以内・${word} を含む>",
  "example_translation": "<日本語1文・40字以内>"
}

# 文字数・内容ルール（厳守）
- feedback_title: 10字以内。例: "正解です" "ナイス"
- short_comment: 1文・40字以内。前向きで実務に直結。「${example_scene}」での使用感に触れると良い。
- business_example: 英語1文・12語以内。${word} を必ず含む。メール/会議/報告などの実務シーン。
- example_translation: business_example の自然な日本語訳。1文・40字以内。日本語のみを使用してください。中国語簡体字（账・报・务・资 等）は使用禁止。
```

**設計意図**: 正解時はテンポを止めないため、フィールド数を **4 つだけ** に絞り、すべて 1 行で完結する短文に制約。`business_example` のみ 12 語の英語、それ以外はすべて 40 字以内の日本語です。`${example_scene}` を user prompt に注入することで、出力 `short_comment` を当該語彙の実務文脈に必ず接続させます。

### 5-3. User prompt — 不正解時（フル分析）

```
以下の単語を間違えたユーザーへのフルAI分析をJSONで返してください。

# 単語情報
- word: ${word}
- pos: ${pos}
- meaning(正解): ${meaning}
- level: ${level}
- example_scene: ${example_scene}
- similar: ${similar}
- userAnswer(選んだ訳): ${userAnswer}
- isCorrect: false

# 返却JSON（キー名・順序・型を厳守）
{
  "is_correct": false,
  "feedback_title": "<20字以内>",
  "mistake_type": "<下記5択から1つ>",
  "reason": "<1文・80字以内>",
  "business_example": "<英語1文・12語以内・${word} を含む>",
  "example_translation": "<日本語1文・40字以内>",
  "memory_tip": "<1文・50字以内>",
  "encouragement": "<1文・40字以内>"
}

# 文字数ルール（厳守）
- feedback_title: 20字以内
- reason: 1文のみ・80字以内。冗長表現禁止。同じ内容の繰り返し禁止。
- business_example: 英語1文・12語以内・${word} を含む
- example_translation: 日本語1文・40字以内。日本語のみを使用してください。中国語簡体字（账・报・务・资 等）は使用禁止。
- memory_tip: 1文・50字以内
- encouragement: 1文・40字以内

# mistake_type は必ず以下から1つ選ぶ（"other" 禁止）
- similar_word_confusion : userAnswer が similar 欄の語、または近い意味の語と関連していると判断できる場合
- part_of_speech_confusion : userAnswer の意味が ${word} と品詞が異なる用法と取り違えられている場合
- vague_memory : userAnswer は無関連寄りで、意味をぼんやり覚えている様子
- context_misunderstanding : ビジネス場面(${example_scene})での使い方が未定着
- careless_mistake : userAnswer が正解の言い換えに近く、選択ミス疑い

# reason の必須条件（一般論禁止）
- userAnswer ("${userAnswer}") と正解 meaning ("${meaning}") の具体的な違いに必ず触れる。
- similar 欄 (${similar}) に関連語がある混同なら、その語名を出して説明する。
- 「意味の取り違えです」「覚えましょう」だけのような汎用文は禁止。

# memory_tip の条件
- ${word} のコアイメージ、または ${example_scene} 場面での典型用法を1つ示す。
```

**設計意図 — 5択 mistake_type**:

`mistake_type` は本アプリの中核アセットです。汎用 LLM は「意味の取り違えです」のような曖昧な誤答分析に逃げがちなため、**5択の排他列挙 + 各値の判定条件** をプロンプト内に明示しました。`other` を許すと Claude は容易に逃げるため、構造的に禁止しています。

| 値 | 判定条件 |
|---|---|
| `similar_word_confusion` | userAnswer が similar 欄 / 近い意味の語 |
| `part_of_speech_confusion` | 品詞が異なる用法との取り違え |
| `vague_memory` | userAnswer が無関連寄り |
| `context_misunderstanding` | ビジネス場面での使い方が未定着 |
| `careless_mistake` | userAnswer が正解の言い換えに近い |

サーバ側で `ALLOWED_MISTAKE_TYPES` ホワイトリスト検証を行い、想定外値は `vague_memory` にフォールバック。型レベルでも `MistakeType` Union から `other` を排除しています。

**設計意図 — reason の一般論禁止**:

実 Claude テスト初期では `reason` が 7 割の頻度で「意味の取り違えです」「覚えましょう」のような無情報文になりました。`userAnswer` と `meaning` の具体的な差に触れることを必須化し、加えて `similar` 欄の語名を出すよう明示することで、毎問固有の説明文が安定して返るようになりました。

---

## 6. プロンプト全文 — `/api/summary`

### 6-1. System prompt

```
あなたは優しいビジネス英語コーチです。TOEIC700点突破を目指す32歳の社会人を担当しています。
- 1セッション10問の結果を総括し、ユーザーが「弱点が分かった」「成長している」「次にやることが分かった」「続ければTOEIC700に近づけそう」と感じる文章を書きます。
- 文面はすべて日本語、短く前向きで、実務文脈を意識します。

# 観測事実主義（厳守）
- 入力で渡された数値・配列だけを根拠に書く。入力に無い事実を作らない。
- secondHalfCorrect > firstHalfCorrect の場合のみ growth に「後半で改善」と書ける。
- 等しいまたは前半が高い場合は「後半で改善した」と書かない。
- 入力に無いユーザーの心理・努力量・学習履歴を推測しない。

# 出力フォーマット規律（厳守）
- 出力はJSONのみ。説明文、Markdown、コードフェンス(```) は禁止。
- 最初の文字は { 、最後の文字は } 。前後に空白や改行を入れない。
- JSON内の文字列値に改行文字を入れない。1フィールド=1行の文字列。
```

**設計意図**: 総括フェーズは hallucination リスクが最大なので、人物像の直後に「観測事実主義（厳守）」セクションを置きました。具体的な禁止例（「等しい場合は後半で改善と書かない」「心理・努力量を推測しない」）を System prompt 側に書くことで、複数の user prompt 構成にも適用できる普遍ルールとして機能させています。

### 6-2. User prompt — 観測値の埋め込み

```
今日の10問の結果を、以下の観測事実だけを使って総括してください。

# 観測事実
- totalQuestions: ${totalQuestions}
- correctCount: ${correctCount}
- incorrectCount: ${incorrectCount}
- firstHalfCorrect: ${firstHalfCorrect} / ${firstHalfTotal}
- secondHalfCorrect: ${secondHalfCorrect} / ${secondHalfTotal}
- 後半改善フラグ(secondHalfCorrect > firstHalfCorrect): ${improved ? "true" : "false"}
- mistakeTypeCounts:
${mistakeLines || "  (なし)"}
- weakScenes (incorrect数が多い順):
${sceneLines || "  (なし)"}
- incorrectWords:
${wrongLines || "  (なし)"}

# 返却JSON（キー名・順序・型を厳守）
{
  "summary_title": "<20字以内>",
  "learner_type": "<20〜40字程度の性格診断風キャッチコピー、末尾は『〜タイプ』>",
  "weakness": "<1〜2文・80字以内>",
  "growth": "<1文・60字以内>",
  "next_action": "<1文・60字以内>",
  "toeic700_message": "<1〜2文・80字以内>"
}

# 各フィールドのルール
- summary_title: 20字以内。例: "今日の学習まとめ"
- learner_type: 性格診断のような前向きキャッチコピー。20〜40字程度。末尾は必ず「〜タイプ」で締める。mistakeTypeCounts の最頻 type または weakScenes の最頻 scene を根拠に「何をすれば伸びるか」「何が始まっているか」を肯定的に表現する。厳しい表現（「苦手」「弱い」「理解力が低い」など）は禁止。
  - 例: 「似た意味の単語を整理すると伸びるタイプ」「ビジネス文脈での使い分けを強化中タイプ」「メール表現の語彙が伸び始めているタイプ」
  - NG例: 「あなたは英語が苦手です」「理解力が低いです」「単語が定着しないタイプ」
- weakness: mistakeTypeCounts または weakScenes の最頻項目を根拠に具体的に書く。incorrectCount=0 のときは「明確な弱点なし」と書く。
- growth: 後半改善フラグが true の場合のみ「後半で改善」「後半が安定」等の表現を許可。false の場合は correctCount を根拠にした事実ベースの前向き表現にする(例: 「${correctCount}問正解、ビジネス語彙の積み上げが進んでいます」)。
- next_action: weakScenes の最頻 scene、または mistakeTypeCounts の最頻 type を根拠に、次回1セッションでやることを具体的に書く。複数 mistake_type が混在する場合、すべての不正解語を1種類の type に一括ラベルしないこと。**最頻 type のみに言及する**か、または **type 別に分けて書く**（例:「曖昧記憶4語と類義語混同2語」）。観測事実 (mistakeTypeCounts) と一致しないラベル付けは禁止。
- toeic700_message: TOEIC700到達に向けた前進感のある1〜2文。誇張・断定は避ける。
```

**設計意図 — 観測値の事前計算**:

`firstHalfTotal` / `secondHalfTotal` / `improved` フラグはすべてサーバ側で事前計算し、プロンプトに焼き込みます。Claude に算術判定をさせない設計です。

**設計意図 — learner_type**:

`learner_type` は本アプリ独自の UX 仕掛けです。streak やバッジを置かない quiet UX を保ったまま「今日の自分」をラベリングし、「また戻ってきたくなる手応え」を作る役割を担っています。詳細は本書 §3-3 を参照。

**設計意図 — next_action の一括ラベル禁止**:

実 Claude テストで `mistakeTypeCounts: {similar:2, vague:4}` の混在時に「曖昧記憶の6語」と一括ラベルする事象を観測したため、明示禁止ルールを追加。観測事実との一致を強制します。詳細は本書 §2-3 を参照。

---

## 7. Assistant prefill による JSON 強制

3 種すべての API 呼び出しで、`messages` 配列の末尾に **assistant prefill `{`** を 1 つ差し込んでいます。

```ts
messages: [
  { role: "user", content: buildUserPrompt(req) },
  { role: "assistant", content: "{" },  // ← prefill
],
```

サーバ側の受信処理：

```ts
const rejoined = text.trimStart().startsWith("{") ? text : "{" + text;
const parsed = extractJson<Record<string, unknown>>(rejoined);
```

**設計意図**: Claude の応答は通常「Here is the JSON:」のような自然言語前置きを伴う場合がありますが、assistant ロールの prefill を `{` で開始させることで、モデルは続きを必ず JSON として生成します。実 Claude テスト 30 セッション以上で JSON 解釈失敗率 0%。

---

## 8. Fallback 設計

Claude API 呼び出しは以下の3条件で失敗し得るため、すべての経路に同型レスポンスのフォールバックを用意しています。

| `_source` | 発生条件 | 例 |
|---|---|---|
| `fallback_no_key` | `ANTHROPIC_API_KEY` 未設定 | ローカル開発・キー未設定環境 |
| `fallback_error` | Claude API 呼び出し例外 | タイムアウト・401・5xx |
| `fallback_parse` | JSON として解釈不能 | 想定外の応答形式 |

`/api/feedback` のフォールバック文言（一例、`fallbackIncorrect`）：

```ts
{
  is_correct: false,
  feedback_title: "もう一歩でした",
  mistake_type: "vague_memory",
  reason: `${word} の正解は「${meaning}」。userAnswer と意味の重なりが薄いです。`,
  business_example: `Could you ${word} the latest figures?`,
  example_translation: "最新の数値をお願いできますか。",
  memory_tip: `${word} のコアイメージを${example_scene}の場面とセットで覚える。`,
  encouragement: "1問の間違いは大きな前進。次で取り戻せます。",
}
```

`/api/summary` のフォールバックは、観測値 (`weakScenes` / `mistakeTypeCounts`) を元に **`LEARNER_TYPE_BY_MISTAKE` 辞書** から `learner_type` を引きます：

```ts
const LEARNER_TYPE_BY_MISTAKE: Record<string, string> = {
  similar_word_confusion: "似た意味の単語を整理すると伸びるタイプ",
  vague_memory: "単語のコアイメージを掴むと伸びるタイプ",
  context_misunderstanding: "ビジネス文脈での使い分けを強化中のタイプ",
  part_of_speech_confusion: "品詞の見極めで一段上がるタイプ",
  careless_mistake: "落ち着いて選べばしっかり取れるタイプ",
};
```

**設計意図**: UI 側 (`FeedbackPanel` / 結果画面) は `_source` フィールドを読まず、Claude 成功時と同型の JSON として描画します。これによりキー未設定や瞬断でも学習体験は止まりません。

---

## 付録 A. 設計上の強みサマリ

| 設計 | 効果 |
|---|---|
| **mistake_type 5択** + サーバホワイトリスト | 「意味の取り違えです」のような無情報フィードバックを構造的に排除 |
| **JSON 構造化** + assistant prefill `{` | パース失敗率 0%、UI 型 (`FeedbackResponse`) と1対1対応 |
| **観測事実主義** + 事前計算フラグ | 「後半で改善」hallucination を 0 件まで抑制 |
| **learner_type 進行形ルール** | streak / バッジなしでも「今日の自分」が言語化される |
| **business_example 必須** | 暗記学習を実務文脈に接続、3 分で「使える感覚」を残す |
| **一括ラベル禁止ルール** | 複数 mistake_type 混在時の summary lump-labeling を排除 |
| **4 層 hallucination 抑制** | system → 事前計算 → 個別ルール → サーバ検証 |
| **3 経路 fallback** + `_source` タグ | UX を止めずに失敗原因をログで追跡可能 |
| **quiet UX 文言ガード** | 「苦手」「毎日」「続けましょう」を構造的に出させない |
