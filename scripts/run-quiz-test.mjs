import { readFileSync, writeFileSync } from "node:fs";

const words = JSON.parse(
  readFileSync(new URL("../data/toeic_wordlist.json", import.meta.url), "utf8")
);
const byId = new Map(words.map((w) => [w.id, w]));

// 10 cases mixing correct and incorrect, varied pos/level/scene.
// userAnswer chosen to exercise different mistake_type buckets.
const cases = [
  { id: 1, isCorrect: true }, // provide
  { id: 2, isCorrect: false, distractor_from: "need" }, // require -> similar "need"
  { id: 5, isCorrect: true }, // increase
  { id: 27, isCorrect: false, distractor_from: "extend" }, // expand -> similar
  { id: 50, isCorrect: false, distractor_from: "lower" }, // need to check
  { id: 14, isCorrect: false, generic: true }, // attend -> pick something unrelated
  { id: 8, isCorrect: true }, // confirm
  { id: 100, isCorrect: false, distractor_from: "" },
  { id: 200, isCorrect: true },
  { id: 250, isCorrect: false, generic: true },
];

function findByWord(token) {
  const t = token.toLowerCase();
  return words.find((w) => w.word.toLowerCase() === t);
}

function pickUserAnswer(target, spec) {
  if (spec.isCorrect) return target.meaning;
  // Try similar-word distractor first
  if (spec.distractor_from) {
    const similarWord = findByWord(spec.distractor_from);
    if (similarWord) return similarWord.meaning;
  }
  // Find a similar word in wordlist that exists
  const simTokens = (target.similar || "")
    .split(/[,、，]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const t of simTokens) {
    const sim = findByWord(t);
    if (sim) return sim.meaning;
  }
  // Otherwise pick same pos but distant level (generic / unrelated meaning)
  const candidates = words.filter(
    (w) => w.id !== target.id && w.pos === target.pos
  );
  return candidates[Math.floor(Math.random() * candidates.length)].meaning;
}

async function callFeedback(target, userAnswer, isCorrect) {
  const body = {
    word: target.word,
    pos: target.pos,
    meaning: target.meaning,
    level: target.level,
    example_scene: target.example_scene,
    similar: target.similar,
    userAnswer,
    isCorrect,
  };
  const res = await fetch("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), input: body };
}

async function callSummary(summaryInput) {
  const res = await fetch("http://localhost:3000/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(summaryInput),
  });
  return { status: res.status, body: await res.json(), input: summaryInput };
}

const results = [];
let firstHalfCorrect = 0;
let secondHalfCorrect = 0;
const mistakeTypeCounts = {};
const sceneCounts = {};
const incorrectWords = [];

console.log("=== 10-question Claude API test ===\n");
for (let i = 0; i < cases.length; i++) {
  const spec = cases[i];
  const target = byId.get(spec.id);
  if (!target) {
    console.log(`Q${i + 1}: id=${spec.id} NOT FOUND, skipping`);
    continue;
  }
  const userAnswer = pickUserAnswer(target, spec);
  const t0 = Date.now();
  const r = await callFeedback(target, userAnswer, spec.isCorrect);
  const elapsed = Date.now() - t0;
  const fb = r.body;
  const src = fb._source || "real";
  results.push({ idx: i + 1, target, userAnswer, isCorrect: spec.isCorrect, response: fb, elapsed });

  if (spec.isCorrect) {
    if (i < 5) firstHalfCorrect++;
    else secondHalfCorrect++;
  } else {
    sceneCounts[target.example_scene] = (sceneCounts[target.example_scene] || 0) + 1;
    if (fb.is_correct === false) {
      const mt = fb.mistake_type;
      mistakeTypeCounts[mt] = (mistakeTypeCounts[mt] || 0) + 1;
      incorrectWords.push({
        word: target.word,
        meaning: target.meaning,
        userAnswer,
        example_scene: target.example_scene,
        mistake_type: mt,
      });
    } else {
      incorrectWords.push({
        word: target.word,
        meaning: target.meaning,
        userAnswer,
        example_scene: target.example_scene,
      });
    }
  }

  console.log(
    `Q${i + 1} [${spec.isCorrect ? "○" : "×"}] ${target.word} (${target.pos}, ${target.example_scene}) -> ${userAnswer} [${elapsed}ms, source=${src}]`
  );
  console.log("  ", JSON.stringify(fb));
  console.log();
}

const totalQuestions = cases.length;
const correctCount = cases.filter((c) => c.isCorrect).length;
const summaryInput = {
  totalQuestions,
  correctCount,
  incorrectCount: totalQuestions - correctCount,
  firstHalfCorrect,
  secondHalfCorrect,
  mistakeTypeCounts,
  weakScenes: Object.entries(sceneCounts)
    .map(([scene, count]) => ({ scene, count }))
    .sort((a, b) => b.count - a.count),
  incorrectWords,
};

console.log("=== Summary input ===");
console.log(JSON.stringify(summaryInput, null, 2));
console.log();

const sumT0 = Date.now();
const sr = await callSummary(summaryInput);
const sumElapsed = Date.now() - sumT0;
console.log(`=== Summary response [${sumElapsed}ms, source=${sr.body._source || "real"}] ===`);
console.log(JSON.stringify(sr.body, null, 2));

writeFileSync(
  "scripts/test-output.json",
  JSON.stringify(
    {
      feedback: results,
      summary: { input: summaryInput, response: sr.body, elapsed: sumElapsed },
    },
    null,
    2
  )
);
console.log("\nSaved -> scripts/test-output.json");
