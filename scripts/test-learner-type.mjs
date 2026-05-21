const profiles = [
  {
    label: "A. similar_word_confusion 偏重",
    body: {
      totalQuestions: 10,
      correctCount: 5,
      incorrectCount: 5,
      firstHalfCorrect: 3,
      secondHalfCorrect: 2,
      mistakeTypeCounts: { similar_word_confusion: 4, vague_memory: 1 },
      weakScenes: [
        { scene: "メール・報告", count: 2 },
        { scene: "要件・依頼", count: 2 },
        { scene: "経理・支払", count: 1 },
      ],
      incorrectWords: [
        { word: "require", meaning: "必要とする・要求する", userAnswer: "入手する・得る", example_scene: "要件・依頼", mistake_type: "similar_word_confusion" },
        { word: "provide", meaning: "提供する・与える", userAnswer: "供給する・補給する", example_scene: "メール・報告", mistake_type: "similar_word_confusion" },
        { word: "expand", meaning: "拡大する・広げる", userAnswer: "延長する・伸ばす", example_scene: "メール・報告", mistake_type: "similar_word_confusion" },
        { word: "assign", meaning: "割り当てる・任命する", userAnswer: "割り当てる・配分する", example_scene: "要件・依頼", mistake_type: "similar_word_confusion" },
        { word: "invoice", meaning: "請求書", userAnswer: "支払い・経費", example_scene: "経理・支払", mistake_type: "vague_memory" },
      ],
    },
  },
  {
    label: "B. vague_memory 偏重 + 後半改善",
    body: {
      totalQuestions: 10,
      correctCount: 5,
      incorrectCount: 5,
      firstHalfCorrect: 1,
      secondHalfCorrect: 4,
      mistakeTypeCounts: { vague_memory: 4, context_misunderstanding: 1 },
      weakScenes: [
        { scene: "経営・マーケティング", count: 2 },
        { scene: "営業・人事", count: 2 },
        { scene: "メール・報告", count: 1 },
      ],
      incorrectWords: [
        { word: "incentivize", meaning: "動機付けする", userAnswer: "回避する・迂回する", example_scene: "営業・人事", mistake_type: "vague_memory" },
        { word: "strategy", meaning: "戦略・方針", userAnswer: "予測・見通し", example_scene: "経営・マーケティング", mistake_type: "vague_memory" },
        { word: "attend", meaning: "出席する・参加する", userAnswer: "照合する・和解させる", example_scene: "メール・報告", mistake_type: "vague_memory" },
        { word: "leverage", meaning: "活用する", userAnswer: "緩和する", example_scene: "経営・マーケティング", mistake_type: "vague_memory" },
        { word: "delegate", meaning: "委任する", userAnswer: "辞退する", example_scene: "営業・人事", mistake_type: "context_misunderstanding" },
      ],
    },
  },
  {
    label: "C. 全問正解",
    body: {
      totalQuestions: 10,
      correctCount: 10,
      incorrectCount: 0,
      firstHalfCorrect: 5,
      secondHalfCorrect: 5,
      mistakeTypeCounts: {},
      weakScenes: [],
      incorrectWords: [],
    },
  },
];

for (const p of profiles) {
  const t0 = Date.now();
  const res = await fetch("http://localhost:3000/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p.body),
  });
  const data = await res.json();
  const elapsed = Date.now() - t0;
  console.log(`\n=== ${p.label} [${elapsed}ms, source=${data._source || "real"}] ===`);
  console.log("learner_type   :", JSON.stringify(data.learner_type));
  console.log("                 length:", [...(data.learner_type || "")].length, "字");
  console.log("                 ends with タイプ?", (data.learner_type || "").endsWith("タイプ"));
  console.log("summary_title  :", data.summary_title);
  console.log("weakness       :", data.weakness);
  console.log("growth         :", data.growth);
  console.log("next_action    :", data.next_action);
  console.log("toeic700_msg   :", data.toeic700_message);
}
