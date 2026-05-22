"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SummaryRequest, SummaryResponse } from "@/lib/types";
import { AnalyzingIndicator } from "@/components/AnalyzingIndicator";

const SUMMARY_LOADING_MESSAGES = [
  "今日の弱点と成長を整理しています…",
  "TOEIC700への前進ポイントを分析しています…",
  "次回の学習ポイントをまとめています…",
];

type ReviewItem = {
  word: string;
  meaning: string;
  userAnswer: string;
  isCorrect: boolean;
};

export default function ResultPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<{ correct: number; total: number } | null>(
    null
  );
  const [avgElapsed, setAvgElapsed] = useState<number | null>(null);

  useEffect(() => {
    const inputRaw = sessionStorage.getItem("toeic700:summaryInput");
    const reviewsRaw = sessionStorage.getItem("toeic700:records");
    if (!inputRaw) {
      setLoading(false);
      return;
    }
    let input: SummaryRequest;
    try {
      input = JSON.parse(inputRaw) as SummaryRequest;
    } catch {
      setLoading(false);
      return;
    }
    setStats({ correct: input.correctCount, total: input.totalQuestions });
    if (reviewsRaw) {
      try {
        setReviews(JSON.parse(reviewsRaw) as ReviewItem[]);
      } catch {
        // ignore
      }
    }
    const elapsedRaw = sessionStorage.getItem("toeic700:elapsedTimes");
    if (elapsedRaw) {
      try {
        const arr = JSON.parse(elapsedRaw) as number[];
        if (Array.isArray(arr) && arr.length > 0) {
          const valid = arr.filter((n) => typeof n === "number" && isFinite(n));
          if (valid.length > 0) {
            const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
            setAvgElapsed(avg);
          }
        }
      } catch {
        // ignore
      }
    }
    (async () => {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: inputRaw,
        });
        const data = (await res.json()) as SummaryResponse;
        setSummary(data);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <header className="header">
        <h1>今日のまとめ</h1>
        <span className="sub">AIコーチによる10問の総括</span>
      </header>

      {stats && (
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-sub)" }}>正答数</div>
          <div className="summary-stats">
            <span className="big">{stats.correct}</span>
            <span className="small">/ {stats.total} 問</span>
          </div>
          {avgElapsed !== null && (
            <div className="avg-elapsed">
              平均理解時間：{avgElapsed.toFixed(1)}秒
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {loading && <AnalyzingIndicator messages={SUMMARY_LOADING_MESSAGES} />}
        {!loading && summary && (
          <>
            <div className="summary-section">
              <h3>タイトル</h3>
              <p>{summary.summary_title}</p>
            </div>
            <div className="learner-type-card">
              <div className="learner-type-label">今日のあなた</div>
              <div className="learner-type-value">
                「{summary.learner_type}」
              </div>
            </div>
            <div className="summary-section">
              <h3>弱点</h3>
              <p>{summary.weakness}</p>
            </div>
            <div className="summary-section">
              <h3>成長</h3>
              <p>{summary.growth}</p>
            </div>
            <div className="summary-section">
              <h3>次にやること</h3>
              <p>{summary.next_action}</p>
            </div>
            {reviews.some((r) => !r.isCorrect) && (
              <div className="summary-section">
                <h3 className="with-icon">
                  <svg
                    className="focus-icon"
                    viewBox="0 0 20 20"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 3h10v13l-5-3-5 3z" />
                  </svg>
                  次回の重点単語
                </h3>
                <div className="focus-words">
                  {reviews
                    .filter((r) => !r.isCorrect)
                    .slice(0, 3)
                    .map((r, i) => (
                      <div key={i} className="focus-word-tag">
                        <span className="fw-word">{r.word}</span>
                        <span className="fw-meaning">{r.meaning}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="summary-section">
              <h3>TOEIC700へ</h3>
              <p>{summary.toeic700_message}</p>
            </div>
          </>
        )}
        {!loading && !summary && !stats && (
          <div className="feedback-body">
            セッションのデータが見つかりませんでした。ホームから始めましょう。
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 10 }}>
            10問の振り返り
          </div>
          <div className="review-list">
            {reviews.map((r, i) => (
              <div key={i} className="review-item">
                <div>
                  <div className="word">{r.word}</div>
                  <div className="meaning">{r.meaning}</div>
                </div>
                <span className={`review-mark ${r.isCorrect ? "ok" : "ng"}`}>
                  {r.isCorrect ? "○" : "×"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="link-row">
        <Link href="/quiz" prefetch={false} style={{ textDecoration: "none" }}>
          <button className="primary-btn">もう10問やる</button>
        </Link>
      </div>
      <Link href="/" prefetch={false} style={{ textDecoration: "none" }}>
        <button className="ghost-btn">ホームに戻る</button>
      </Link>
    </>
  );
}
