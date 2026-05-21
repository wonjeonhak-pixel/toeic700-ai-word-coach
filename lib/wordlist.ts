import rawWords from "@/data/toeic_wordlist.json";
import type { Question, Word } from "./types";

export const words: Word[] = rawWords as Word[];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseSimilar(s: string): string[] {
  return s
    .split(/[,、，]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

function pickDistractors(target: Word, pool: Word[]): string[] {
  const similarTokens = new Set(parseSimilar(target.similar));
  const samePos = pool.filter(
    (w) => w.id !== target.id && w.pos === target.pos
  );
  const nearLevel = pool.filter(
    (w) => w.id !== target.id && Math.abs(w.level - target.level) <= 1
  );

  const similarFirst = samePos.filter((w) =>
    similarTokens.has(w.word.toLowerCase())
  );

  const ranked = [
    ...shuffle(similarFirst),
    ...shuffle(samePos),
    ...shuffle(nearLevel),
    ...shuffle(pool.filter((w) => w.id !== target.id)),
  ];

  const seen = new Set<string>([target.meaning]);
  const picked: string[] = [];
  for (const w of ranked) {
    if (seen.has(w.meaning)) continue;
    seen.add(w.meaning);
    picked.push(w.meaning);
    if (picked.length === 3) break;
  }
  return picked;
}

export function buildQuiz(count = 10): Question[] {
  const picked = shuffle(words).slice(0, count);
  return picked.map((w) => {
    const distractors = pickDistractors(w, words);
    const choices = shuffle([w.meaning, ...distractors]);
    return {
      word: w,
      choices,
      correctIndex: choices.indexOf(w.meaning),
    };
  });
}
