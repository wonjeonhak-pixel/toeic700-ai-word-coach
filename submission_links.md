# Submission Links — QuietStep

社内コンペ提出時に審査員へ案内する URL とリソースをここに集約します。提出フォームへの転記用一覧。

---

## 提出 URL

| # | 種別 | URL | 備考 |
|---|---|---|---|
| 1 | **GitHub Repository** | https://github.com/wonjeonhak-pixel/toeic700-ai-word-coach | 本プロジェクトのソース一式・コミット履歴・specs |
| 2 | **Vercel Production URL** | https://toeic700-ai-word-coach.vercel.app | 本番デプロイ。提出前にハードリロードで最新コミット反映を確認 |
| 3 | **制作メモ** | [`making_note.md`](./making_note.md) | TOEIC学習思想 / quiet UX 採用理由 / AI 共創プロセス |
| 4 | **Demo Video**（optional） | <!-- TODO: 録画する場合のみ追記。例: YouTube limited / Loom 共有リンク --> | 任意。1〜2 分の操作動画があれば提出フォームに添付 |

---

## 提出パッケージ内訳

| カテゴリ | ファイル | 役割 |
|---|---|---|
| 紹介 | [`README.md`](./README.md) | プロダクト概要・技術仕様・API スキーマ |
| 設計 | [`specs/strategy.md`](./specs/strategy.md) | コンセプト・ターゲット・5価値・非ゴール |
| 設計 | [`specs/prd.md`](./specs/prd.md) | 13 項目の要求仕様と受け入れ基準 |
| 設計 | [`specs/backlog.md`](./specs/backlog.md) | AI-DLC 実装タスク（全完了） |
| AI | [`submission_prompts.md`](./submission_prompts.md) | Claude API プロンプト全文と設計意図 |
| 思想 | [`making_note.md`](./making_note.md) | TOEIC学習思想と quiet UX 採用の制作メモ |
| 画像 | [`docs/screenshots/`](./docs/screenshots/) | 提出用スクリーンショット 6 枚（home / quiz / feedback / result_summary / focus_words / result_footer） |

---

## 提出前最終チェック

- [x] `main` ブランチが最新コミットを GitHub に push 済み
- [x] Vercel 本番デプロイが最新コミットで Ready
- [x] Vercel Production URL を本ファイル `#2` に記載
- [x] `docs/screenshots/` に 6 枚配置（01_home / 02_quiz / 03_feedback / 04_result_summary / 05_focus_words / 06_result_footer）
- [ ] 本ファイルの「提出 URL」表を提出フォームへ転記
