export type Word = {
  id: number;
  word: string;
  pos: string;
  meaning: string;
  level: number;
  example_scene: string;
  similar: string;
};

export type Question = {
  word: Word;
  choices: string[];
  correctIndex: number;
};

export type AnswerRecord = {
  question: Question;
  userAnswer: string;
  isCorrect: boolean;
  feedback: FeedbackResponse | null;
};

export type FeedbackRequest = {
  word: string;
  pos: string;
  meaning: string;
  level: number;
  example_scene: string;
  similar: string;
  userAnswer: string;
  isCorrect: boolean;
};

export type MistakeType =
  | "similar_word_confusion"
  | "part_of_speech_confusion"
  | "vague_memory"
  | "context_misunderstanding"
  | "careless_mistake";

export type CorrectFeedback = {
  is_correct: true;
  feedback_title: string;
  short_comment: string;
  business_example: string;
  example_translation: string;
};

export type IncorrectFeedback = {
  is_correct: false;
  feedback_title: string;
  mistake_type: MistakeType;
  reason: string;
  business_example: string;
  example_translation: string;
  memory_tip: string;
  encouragement: string;
};

export type FeedbackResponse = CorrectFeedback | IncorrectFeedback;

export type SummaryRequest = {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  firstHalfCorrect: number;
  secondHalfCorrect: number;
  mistakeTypeCounts: Partial<Record<MistakeType, number>>;
  weakScenes: { scene: string; count: number }[];
  incorrectWords: {
    word: string;
    meaning: string;
    userAnswer: string;
    example_scene: string;
    mistake_type?: MistakeType;
  }[];
};

export type SummaryResponse = {
  summary_title: string;
  learner_type: string;
  weakness: string;
  growth: string;
  next_action: string;
  toeic700_message: string;
};
