import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { extractJson, getClaude, getModel } from "@/lib/claude";
import type {
  CorrectFeedback,
  FeedbackRequest,
  FeedbackResponse,
  IncorrectFeedback,
  MistakeType,
} from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_MISTAKE_TYPES: ReadonlySet<MistakeType> = new Set<MistakeType>([
  "similar_word_confusion",
  "part_of_speech_confusion",
  "vague_memory",
  "context_misunderstanding",
  "careless_mistake",
]);

const SYSTEM_PROMPT = `あなたは優しいビジネス英語コーチです。TOEIC700点突破を目指す32歳の社会人を担当しています。
- 短く、前向きで、実務文脈のあるコメントをします。
- 通勤や昼休みの短い学習でも前進を実感できるよう励まします。
- 文面はすべて日本語。例文(business_example)のみ英語。

# 出力フォーマット規律（厳守）
- 出力はJSONのみ。説明文、Markdown、コードフェンス(\`\`\`)は禁止。
- 最初の文字は { 、最後の文字は } 。前後に空白や改行を入れない。
- JSON内の文字列値に改行文字を入れない。1フィールド=1行の文字列。
- キー名、キーの並び順、型(string/boolean)を指定通りに守る。`;

function buildCorrectPrompt(req: FeedbackRequest): string {
  return `以下の単語に正解したユーザーへの短いフィードバックをJSONで返してください。

# 単語情報
- word: ${req.word}
- pos: ${req.pos}
- meaning: ${req.meaning}
- level: ${req.level}
- example_scene: ${req.example_scene}
- similar: ${req.similar}
- userAnswer: ${req.userAnswer}
- isCorrect: true

# 返却JSON（キー名・順序・型を厳守）
{
  "is_correct": true,
  "feedback_title": "<10字以内>",
  "short_comment": "<1文・40字以内>",
  "business_example": "<英語1文・12語以内・${req.word} を含む>",
  "example_translation": "<日本語1文・40字以内>"
}

# 文字数・内容ルール（厳守）
- feedback_title: 10字以内。例: "正解です" "ナイス"
- short_comment: 1文・40字以内。前向きで実務に直結。「${req.example_scene}」での使用感に触れると良い。
- business_example: 英語1文・12語以内。${req.word} を必ず含む。メール/会議/報告などの実務シーン。
- example_translation: business_example の自然な日本語訳。1文・40字以内。日本語のみを使用してください。中国語簡体字（账・报・务・资 等）は使用禁止。`;
}

function buildIncorrectPrompt(req: FeedbackRequest): string {
  return `以下の単語を間違えたユーザーへのフルAI分析をJSONで返してください。

# 単語情報
- word: ${req.word}
- pos: ${req.pos}
- meaning(正解): ${req.meaning}
- level: ${req.level}
- example_scene: ${req.example_scene}
- similar: ${req.similar}
- userAnswer(選んだ訳): ${req.userAnswer}
- isCorrect: false

# 返却JSON（キー名・順序・型を厳守）
{
  "is_correct": false,
  "feedback_title": "<20字以内>",
  "mistake_type": "<下記5択から1つ>",
  "reason": "<1文・80字以内>",
  "business_example": "<英語1文・12語以内・${req.word} を含む>",
  "example_translation": "<日本語1文・40字以内>",
  "memory_tip": "<1文・50字以内>",
  "encouragement": "<1文・40字以内>"
}

# 文字数ルール（厳守）
- feedback_title: 20字以内
- reason: 1文のみ・80字以内。冗長表現禁止。同じ内容の繰り返し禁止。
- business_example: 英語1文・12語以内・${req.word} を含む
- example_translation: 日本語1文・40字以内。日本語のみを使用してください。中国語簡体字（账・报・务・资 等）は使用禁止。
- memory_tip: 1文・50字以内
- encouragement: 1文・40字以内

# mistake_type は必ず以下から1つ選ぶ（"other" 禁止）
- similar_word_confusion : userAnswer が similar 欄の語、または近い意味の語と関連していると判断できる場合
- part_of_speech_confusion : userAnswer の意味が ${req.word} と品詞が異なる用法と取り違えられている場合
- vague_memory : userAnswer は無関連寄りで、意味をぼんやり覚えている様子
- context_misunderstanding : ビジネス場面(${req.example_scene})での使い方が未定着
- careless_mistake : userAnswer が正解の言い換えに近く、選択ミス疑い

# reason の必須条件（一般論禁止）
- userAnswer ("${req.userAnswer}") と正解 meaning ("${req.meaning}") の具体的な違いに必ず触れる。
- similar 欄 (${req.similar}) に関連語がある混同なら、その語名を出して説明する。
- 「意味の取り違えです」「覚えましょう」だけのような汎用文は禁止。

# memory_tip の条件
- ${req.word} のコアイメージ、または ${req.example_scene} 場面での典型用法を1つ示す。`;
}

function buildUserPrompt(req: FeedbackRequest): string {
  return req.isCorrect ? buildCorrectPrompt(req) : buildIncorrectPrompt(req);
}

function fallbackCorrect(req: FeedbackRequest): CorrectFeedback {
  return {
    is_correct: true,
    feedback_title: "正解です",
    short_comment: `${req.example_scene}でよく使う重要語です。`,
    business_example: `Please ${req.word} the report by Friday.`,
    example_translation: "金曜日までに報告書をお願いします。",
  };
}

function fallbackIncorrect(req: FeedbackRequest): IncorrectFeedback {
  return {
    is_correct: false,
    feedback_title: "もう一歩でした",
    mistake_type: "vague_memory",
    reason: `${req.word} の正解は「${req.meaning}」。userAnswer と意味の重なりが薄いです。`,
    business_example: `Could you ${req.word} the latest figures?`,
    example_translation: "最新の数値をお願いできますか。",
    memory_tip: `${req.word} のコアイメージを${req.example_scene}の場面とセットで覚える。`,
    encouragement: "1問の間違いは大きな前進。次で取り戻せます。",
  };
}

function validate(req: FeedbackRequest, data: unknown): FeedbackResponse | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (req.isCorrect) {
    if (
      typeof obj.feedback_title === "string" &&
      typeof obj.short_comment === "string" &&
      typeof obj.business_example === "string" &&
      typeof obj.example_translation === "string"
    ) {
      return {
        is_correct: true,
        feedback_title: obj.feedback_title,
        short_comment: obj.short_comment,
        business_example: obj.business_example,
        example_translation: obj.example_translation,
      };
    }
    return null;
  }
  if (
    typeof obj.feedback_title === "string" &&
    typeof obj.mistake_type === "string" &&
    typeof obj.reason === "string" &&
    typeof obj.business_example === "string" &&
    typeof obj.example_translation === "string" &&
    typeof obj.memory_tip === "string" &&
    typeof obj.encouragement === "string"
  ) {
    const mt = ALLOWED_MISTAKE_TYPES.has(obj.mistake_type as MistakeType)
      ? (obj.mistake_type as MistakeType)
      : "vague_memory";
    return {
      is_correct: false,
      feedback_title: obj.feedback_title,
      mistake_type: mt,
      reason: obj.reason,
      business_example: obj.business_example,
      example_translation: obj.example_translation,
      memory_tip: obj.memory_tip,
      encouragement: obj.encouragement,
    };
  }
  return null;
}

export async function POST(request: Request) {
  let req: FeedbackRequest;
  try {
    req = (await request.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const fallback = req.isCorrect ? fallbackCorrect(req) : fallbackIncorrect(req);
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json({ ...fallback, _source: "fallback_no_key" });
  }

  try {
    const msg = await claude.messages.create({
      model: getModel(),
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt(req) },
        { role: "assistant", content: "{" },
      ],
    });
    const text = msg.content
      .filter(
        (b): b is Extract<Anthropic.ContentBlock, { type: "text" }> =>
          b.type === "text"
      )
      .map((b) => b.text)
      .join("\n");
    const rejoined = text.trimStart().startsWith("{") ? text : "{" + text;
    const parsed = extractJson<Record<string, unknown>>(rejoined);
    const validated = validate(req, parsed);
    if (validated) {
      return NextResponse.json(validated);
    }
    return NextResponse.json({ ...fallback, _source: "fallback_parse" });
  } catch (err) {
    console.error("[feedback] claude error", err);
    return NextResponse.json({ ...fallback, _source: "fallback_error" });
  }
}
