"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildQuiz } from "@/lib/wordlist";
import { SpeakButton } from "@/components/SpeakButton";
import { AnalyzingIndicator } from "@/components/AnalyzingIndicator";

const FEEDBACK_LOADING_MESSAGES = [
  "AIコーチが回答を分析しています…",
  "どの単語と混同したか確認しています…",
  "ビジネス文脈での使い方を整理しています…",
];
import type {
  AnswerRecord,
  FeedbackResponse,
  MistakeType,
  Question,
  SummaryRequest,
} from "@/lib/types";

type Phase = "answering" | "feedback";

export default function QuizPage() {
  const router = useRouter();
  const questions = useMemo<Question[]>(() => buildQuiz(10), []);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const recordsRef = useRef<AnswerRecord[]>([]);
  const questionStartRef = useRef<number | null>(null);
  const elapsedTimesRef = useRef<number[]>([]);

  const current = questions[index];

  useEffect(() => {
    setSelectedIndex(null);
    setFeedback(null);
    setPhase("answering");
    setElapsedSec(null);
    questionStartRef.current = performance.now();
  }, [index]);

  async function handleSelect(choiceIdx: number) {
    if (phase !== "answering") return;
    if (questionStartRef.current !== null) {
      const sec = (performance.now() - questionStartRef.current) / 1000;
      setElapsedSec(sec);
      elapsedTimesRef.current.push(sec);
    }
    setSelectedIndex(choiceIdx);
    setPhase("feedback");
    setLoading(true);

    const userAnswer = current.choices[choiceIdx];
    const isCorrect = choiceIdx === current.correctIndex;

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: current.word.word,
          pos: current.word.pos,
          meaning: current.word.meaning,
          level: current.word.level,
          example_scene: current.word.example_scene,
          similar: current.word.similar,
          userAnswer,
          isCorrect,
        }),
      });
      const data = (await res.json()) as FeedbackResponse;
      setFeedback(data);
      recordsRef.current.push({
        question: current,
        userAnswer,
        isCorrect,
        feedback: data,
      });
    } catch {
      recordsRef.current.push({
        question: current,
        userAnswer,
        isCorrect,
        feedback: null,
      });
    } finally {
      setLoading(false);
    }
  }

  function buildSummaryInput(): SummaryRequest {
    const records = recordsRef.current;
    const total = records.length;
    const half = Math.floor(total / 2);
    const correctCount = records.filter((r) => r.isCorrect).length;
    const firstHalfCorrect = records
      .slice(0, half)
      .filter((r) => r.isCorrect).length;
    const secondHalfCorrect = records
      .slice(half)
      .filter((r) => r.isCorrect).length;

    const mistakeTypeCounts: Partial<Record<MistakeType, number>> = {};
    for (const r of records) {
      if (!r.isCorrect && r.feedback && r.feedback.is_correct === false) {
        const t = r.feedback.mistake_type;
        mistakeTypeCounts[t] = (mistakeTypeCounts[t] ?? 0) + 1;
      }
    }

    const sceneCounts = new Map<string, number>();
    for (const r of records) {
      if (!r.isCorrect) {
        const s = r.question.word.example_scene;
        sceneCounts.set(s, (sceneCounts.get(s) ?? 0) + 1);
      }
    }
    const weakScenes = [...sceneCounts.entries()]
      .map(([scene, count]) => ({ scene, count }))
      .sort((a, b) => b.count - a.count);

    const incorrectWords = records
      .filter((r) => !r.isCorrect)
      .map((r) => ({
        word: r.question.word.word,
        meaning: r.question.word.meaning,
        userAnswer: r.userAnswer,
        example_scene: r.question.word.example_scene,
        mistake_type:
          r.feedback && r.feedback.is_correct === false
            ? r.feedback.mistake_type
            : undefined,
      }));

    return {
      totalQuestions: total,
      correctCount,
      incorrectCount: total - correctCount,
      firstHalfCorrect,
      secondHalfCorrect,
      mistakeTypeCounts,
      weakScenes,
      incorrectWords,
    };
  }

  function handleNext() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    const summaryInput = buildSummaryInput();
    try {
      sessionStorage.setItem(
        "toeic700:summaryInput",
        JSON.stringify(summaryInput)
      );
      sessionStorage.setItem(
        "toeic700:records",
        JSON.stringify(
          recordsRef.current.map((r) => ({
            word: r.question.word.word,
            meaning: r.question.word.meaning,
            userAnswer: r.userAnswer,
            isCorrect: r.isCorrect,
          }))
        )
      );
      sessionStorage.setItem(
        "toeic700:elapsedTimes",
        JSON.stringify(elapsedTimesRef.current)
      );
    } catch {
      // ignore storage errors
    }
    router.push("/result");
  }

  if (!current) return null;

  const progress =
    ((index + (phase === "feedback" ? 1 : 0)) / questions.length) * 100;
  const isLast = index + 1 === questions.length;

  return (
    <>
      <header className="header">
        <h1>今日の10問</h1>
        <div className="progress-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-meta">
          <span>
            {index + 1} / {questions.length}
          </span>
          <span>TOEIC600→700レベル</span>
        </div>
      </header>

      <div className="card word-display">
        <div>
          <span className="pos-chip">{current.word.pos}</span>
          <span className="scene-chip">{current.word.example_scene}</span>
        </div>
        <div className="word">{current.word.word}</div>
      </div>

      <div className="choice-list">
        {current.choices.map((choice, i) => {
          let cls = "choice-btn";
          if (phase === "feedback") {
            cls += " disabled";
            if (i === current.correctIndex) cls += " correct";
            else if (i === selectedIndex) cls += " incorrect";
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => handleSelect(i)}
              disabled={phase !== "answering"}
            >
              <span className="choice-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="choice-text">{choice}</span>
            </button>
          );
        })}
      </div>

      {phase === "feedback" && (
        <FeedbackPanel
          key={index}
          loading={loading}
          feedback={feedback}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === "feedback" && (
        <div className="next-sticky">
          <button className="primary-btn" onClick={handleNext}>
            {isLast ? "結果を見る" : "次の問題へ"}
          </button>
        </div>
      )}
    </>
  );
}

function FeedbackPanel({
  loading,
  feedback,
  elapsedSec,
}: {
  loading: boolean;
  feedback: FeedbackResponse | null;
  elapsedSec: number | null;
}) {
  const [showExample, setShowExample] = useState(false);

  const elapsedLine =
    elapsedSec !== null ? (
      <div className="feedback-elapsed">
        意味が浮かぶまで：{elapsedSec.toFixed(1)}秒
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="feedback-card">
        <AnalyzingIndicator messages={FEEDBACK_LOADING_MESSAGES} />
        {elapsedLine}
      </div>
    );
  }
  if (!feedback) {
    return (
      <div className="feedback-card">
        <div className="feedback-body">
          フィードバックの取得に失敗しました。次へ進みましょう。
        </div>
        {elapsedLine}
      </div>
    );
  }

  const correct = feedback.is_correct;

  if (correct) {
    return (
      <div className="feedback-card correct">
        <div className="feedback-title correct">○ {feedback.feedback_title}</div>
        <div className="feedback-body">{feedback.short_comment}</div>
        {showExample ? (
          <div className="feedback-example">
            <div className="feedback-example-row">
              <div className="en">{feedback.business_example}</div>
              <SpeakButton text={feedback.business_example} />
            </div>
            <div className="ja">{feedback.example_translation}</div>
          </div>
        ) : (
          <button
            className="example-toggle"
            type="button"
            onClick={() => setShowExample(true)}
          >
            例文を見る
          </button>
        )}
        {elapsedLine}
      </div>
    );
  }

  return (
    <div className="feedback-card incorrect">
      <div className="feedback-title incorrect">× {feedback.feedback_title}</div>
      <div className="feedback-row">
        <div className="label">なぜ間違えたか</div>
        <div className="value">{feedback.reason}</div>
      </div>
      <div className="feedback-example">
        <div className="feedback-example-row">
          <div className="en">{feedback.business_example}</div>
          <SpeakButton text={feedback.business_example} />
        </div>
        <div className="ja">{feedback.example_translation}</div>
      </div>
      <div className="feedback-row">
        <div className="label">覚え方</div>
        <div className="value">{feedback.memory_tip}</div>
      </div>
      <div className="feedback-row">
        <div className="label">コーチから</div>
        <div className="value">{feedback.encouragement}</div>
      </div>
      {elapsedLine}
    </div>
  );
}
