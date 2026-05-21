import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { extractJson, getClaude, getModel } from "@/lib/claude";
import type { SummaryRequest, SummaryResponse } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは優しいビジネス英語コーチです。TOEIC700点突破を目指す32歳の社会人を担当しています。
- 1セッション10問の結果を総括し、ユーザーが「弱点が分かった」「成長している」「次にやることが分かった」「続ければTOEIC700に近づけそう」と感じる文章を書きます。
- 文面はすべて日本語、短く前向きで、実務文脈を意識します。

# 観測事実主義（厳守）
- 入力で渡された数値・配列だけを根拠に書く。入力に無い事実を作らない。
- secondHalfCorrect > firstHalfCorrect の場合のみ growth に「後半で改善」と書ける。
- 等しいまたは前半が高い場合は「後半で改善した」と書かない。
- 入力に無いユーザーの心理・努力量・学習履歴を推測しない。

# 出力フォーマット規律（厳守）
- 出力はJSONのみ。説明文、Markdown、コードフェンス(\`\`\`)は禁止。
- 最初の文字は { 、最後の文字は } 。前後に空白や改行を入れない。
- JSON内の文字列値に改行文字を入れない。1フィールド=1行の文字列。`;

function buildUserPrompt(req: SummaryRequest): string {
  const half = Math.floor(req.totalQuestions / 2);
  const firstHalfTotal = half;
  const secondHalfTotal = req.totalQuestions - half;
  const improved = req.secondHalfCorrect > req.firstHalfCorrect;
  const mistakeLines = Object.entries(req.mistakeTypeCounts)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");
  const sceneLines = req.weakScenes
    .map((s) => `  - ${s.scene}: ${s.count}`)
    .join("\n");
  const wrongLines = req.incorrectWords
    .map(
      (w, i) =>
        `  ${i + 1}. ${w.word} (${w.example_scene}) 正解=${w.meaning} / 回答=${w.userAnswer}${w.mistake_type ? ` / type=${w.mistake_type}` : ""}`
    )
    .join("\n");

  return `今日の10問の結果を、以下の観測事実だけを使って総括してください。

# 観測事実
- totalQuestions: ${req.totalQuestions}
- correctCount: ${req.correctCount}
- incorrectCount: ${req.incorrectCount}
- firstHalfCorrect: ${req.firstHalfCorrect} / ${firstHalfTotal}
- secondHalfCorrect: ${req.secondHalfCorrect} / ${secondHalfTotal}
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
- growth: 後半改善フラグが true の場合のみ「後半で改善」「後半が安定」等の表現を許可。false の場合は correctCount を根拠にした事実ベースの前向き表現にする(例: 「${req.correctCount}問正解、ビジネス語彙の積み上げが進んでいます」)。
- next_action: weakScenes の最頻 scene、または mistakeTypeCounts の最頻 type を根拠に、次回1セッションでやることを具体的に書く。複数 mistake_type が混在する場合、すべての不正解語を1種類の type に一括ラベルしないこと。**最頻 type のみに言及する**か、または **type 別に分けて書く**（例:「曖昧記憶4語と類義語混同2語」）。観測事実 (mistakeTypeCounts) と一致しないラベル付けは禁止。
- toeic700_message: TOEIC700到達に向けた前進感のある1〜2文。誇張・断定は避ける。`;
}

const LEARNER_TYPE_BY_MISTAKE: Record<string, string> = {
  similar_word_confusion: "似た意味の単語を整理すると伸びるタイプ",
  vague_memory: "単語のコアイメージを掴むと伸びるタイプ",
  context_misunderstanding: "ビジネス文脈での使い分けを強化中のタイプ",
  part_of_speech_confusion: "品詞の見極めで一段上がるタイプ",
  careless_mistake: "落ち着いて選べばしっかり取れるタイプ",
};

function fallback(req: SummaryRequest): SummaryResponse {
  const topScene = req.weakScenes[0];
  const topType = (Object.entries(req.mistakeTypeCounts).sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0)
  )[0] ?? null) as [string, number] | null;
  const improved = req.secondHalfCorrect > req.firstHalfCorrect;
  const half = Math.floor(req.totalQuestions / 2);
  const secondHalfTotal = req.totalQuestions - half;

  let weakness: string;
  if (req.incorrectCount === 0) {
    weakness = "今日は明確な弱点はなく、全問取れました。";
  } else if (topScene) {
    weakness = `「${topScene.scene}」の単語で${topScene.count}問取りこぼしがありました。`;
  } else {
    weakness = `${req.incorrectCount}問の取りこぼしがありました。`;
  }

  const growth = improved
    ? `後半は${req.secondHalfCorrect}/${secondHalfTotal}と前半より改善しました。`
    : `${req.correctCount}/${req.totalQuestions}問正解。今日の前進が積み上がっています。`;

  let next_action: string;
  if (topScene) {
    next_action = `次回は「${topScene.scene}」の単語を重点復習しましょう。`;
  } else if (topType) {
    next_action = `次回は ${topType[0]} の傾向を意識して取り組みましょう。`;
  } else {
    next_action = "次回は今日の単語の similar 欄も合わせて確認しましょう。";
  }

  let learner_type: string;
  if (req.incorrectCount === 0) {
    learner_type = "ビジネス語彙が着実に固まっているタイプ";
  } else if (topType && LEARNER_TYPE_BY_MISTAKE[topType[0]]) {
    learner_type = LEARNER_TYPE_BY_MISTAKE[topType[0]];
  } else if (topScene) {
    learner_type = `「${topScene.scene}」の語彙を強化中のタイプ`;
  } else {
    learner_type = "ビジネス語彙の積み上げが始まっているタイプ";
  }

  return {
    summary_title: "今日の学習まとめ",
    learner_type,
    weakness,
    growth,
    next_action,
    toeic700_message:
      "1日10問の積み重ねで、TOEIC700のビジネス語彙が着実に固まっていきます。",
  };
}

function validate(data: unknown): SummaryResponse | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (
    typeof o.summary_title === "string" &&
    typeof o.learner_type === "string" &&
    typeof o.weakness === "string" &&
    typeof o.growth === "string" &&
    typeof o.next_action === "string" &&
    typeof o.toeic700_message === "string"
  ) {
    return {
      summary_title: o.summary_title,
      learner_type: o.learner_type,
      weakness: o.weakness,
      growth: o.growth,
      next_action: o.next_action,
      toeic700_message: o.toeic700_message,
    };
  }
  return null;
}

export async function POST(request: Request) {
  let req: SummaryRequest;
  try {
    req = (await request.json()) as SummaryRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const fb = fallback(req);
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json({ ...fb, _source: "fallback_no_key" });
  }

  try {
    const msg = await claude.messages.create({
      model: getModel(),
      max_tokens: 700,
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
    const validated = validate(parsed);
    if (validated) {
      return NextResponse.json(validated);
    }
    return NextResponse.json({ ...fb, _source: "fallback_parse" });
  } catch (err) {
    console.error("[summary] claude error", err);
    return NextResponse.json({ ...fb, _source: "fallback_error" });
  }
}
