import Link from "next/link";
import { words } from "@/lib/wordlist";

export default function Home() {
  const total = words.length;
  return (
    <>
      <header className="header">
        <h1>TOEIC700 AI英単語コーチ</h1>
        <span className="sub">今日の10問だけ、静かに前進</span>
      </header>

      <div className="card focus-card">
        <div className="focus-label">
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
            <path d="M3 4.5c2-0.6 4.5-0.6 7 0.8v11.2c-2.5-1.4-5-1.4-7-0.8v-11.2z" />
            <path d="M17 4.5c-2-0.6-4.5-0.6-7 0.8v11.2c2.5-1.4 5-1.4 7-0.8v-11.2z" />
          </svg>
          現在の重点
        </div>
        <div className="focus-title">TOEIC600→700レベル</div>
        <p className="focus-note">
          メール・会議・報告で頻出のビジネス語彙を10問×1セッションで定着。
          単語を「思い出す」から「すぐ分かる」へ。
        </p>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, color: "var(--text-sub)", marginBottom: 12 }}>
          今日の1セッション
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 800 }}>10</span>
          <span style={{ color: "var(--text-sub)" }}>問 / 約3分</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-sub)" }}>
          収録語彙 {total} 語からランダム出題
        </div>
      </div>

      <Link href="/quiz" prefetch={false} style={{ textDecoration: "none" }}>
        <button className="primary-btn">今日の10問を始める</button>
      </Link>

      <div style={{ fontSize: 12, color: "var(--text-sub)", textAlign: "center" }}>
        AIフィードバックは毎問の回答後に表示されます
      </div>
    </>
  );
}
