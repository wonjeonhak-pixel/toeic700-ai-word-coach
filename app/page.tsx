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
        <div className="focus-label">現在の重点</div>
        <div className="focus-title">TOEIC600 → 700帯</div>
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
