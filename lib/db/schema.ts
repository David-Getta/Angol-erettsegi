import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Progress database (data/app.db). Task content lives in content/*.json and is
 * mirrored into the `tasks` table by the idempotent seeder (lib/content/seed.ts).
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** Single-row JSON settings document (validated by lib/settings.ts). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Small key/value store for bookkeeping (last feedback import, last seed, dismissed tips ...). */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    section: text("section").notNull(), // reading | language-use | listening | writing | speaking | vocabulary
    type: text("type").notNull(),
    level: text("level").notNull(), // kozep | emelt
    source: text("source").notNull(), // official | generated
    topic: text("topic").notNull(),
    title: text("title").notNull(),
    content: text("content", { mode: "json" }).notNull().$type<unknown>(),
    answerKey: text("answer_key", { mode: "json" }).$type<unknown>(),
    tags: text("tags", { mode: "json" }).notNull().$type<string[]>().default([]),
    categories: text("categories", { mode: "json" }).notNull().$type<string[]>().default([]),
    itemCount: integer("item_count").notNull().default(0),
    reservedFor: text("reserved_for"), // mock | diagnostic | null
    contentFile: text("content_file").notNull(),
    contentHash: text("content_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("tasks_section_level").on(t.section, t.level), index("tasks_subject").on(t.subject)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    taskId: text("task_id").notNull(),
    section: text("section").notNull(),
    level: text("level").notNull(),
    mode: text("mode").notNull(), // practice | exam | mock | diagnostic | targeted
    answers: text("answers", { mode: "json" }).notNull().$type<Record<string, string>>(),
    results: text("results", { mode: "json" }).notNull().$type<unknown>(),
    score: real("score").notNull(),
    maxScore: real("max_score").notNull(),
    durationSec: integer("duration_sec").notNull().default(0),
    mockExamId: integer("mock_exam_id"),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_task").on(t.taskId), index("attempts_section").on(t.section, t.level)],
);

/** Single-item answers from targeted practice (items picked across many tasks). */
export const itemAttempts = sqliteTable(
  "item_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    taskId: text("task_id").notNull(),
    itemId: text("item_id").notNull(),
    category: text("category").notNull(),
    section: text("section").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    answer: text("answer").notNull(),
    mode: text("mode").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("item_attempts_category").on(t.category)],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    kind: text("kind").notNull(), // writing | speaking
    taskId: text("task_id").notNull(),
    level: text("level").notNull(),
    text: text("text").notNull(),
    version: integer("version").notNull().default(1),
    parentId: text("parent_id"),
    rootId: text("root_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | graded
    mode: text("mode").notNull().default("practice"),
    durationSec: integer("duration_sec").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    transcriptSource: text("transcript_source"), // app-asr | claude-voice | typed (speaking only)
    feedback: text("feedback", { mode: "json" }).$type<unknown>(),
    score: real("score"),
    maxScore: real("max_score"),
    gradedBy: text("graded_by"),
    mockExamId: integer("mock_exam_id"),
    createdAt: createdAt(),
    gradedAt: integer("graded_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("submissions_status").on(t.status), index("submissions_root").on(t.rootId)],
);

export const errors = sqliteTable(
  "errors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    category: text("category").notNull(),
    original: text("original").notNull(),
    corrected: text("corrected").notNull(),
    explanation: text("explanation").notNull(),
    context: text("context"),
    sourceType: text("source_type").notNull(), // language-use | reading | listening | writing | speaking
    sourceId: text("source_id").notNull(), // attempt id or submission id
    taskId: text("task_id"),
    itemId: text("item_id"),
    createdAt: createdAt(),
  },
  (t) => [index("errors_category").on(t.category), index("errors_created").on(t.createdAt)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    noteKey: text("note_key").notNull(), // normalized term; all card types of one word share it
    front: text("front").notNull(), // English term
    back: text("back").notNull().default(""), // Hungarian meaning
    example: text("example"),
    collocation: text("collocation"),
    type: text("type").notNull(), // en-hu | hu-en | cloze | collocation
    incomplete: integer("incomplete", { mode: "boolean" }).notNull().default(false),
    fsrsState: text("fsrs_state", { mode: "json" }).$type<unknown>(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    isNew: integer("is_new", { mode: "boolean" }).notNull().default(true),
    suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
    topic: text("topic"),
    level: text("level"),
    sourceType: text("source_type").notNull(), // bank | reading | listening | writing | speaking | manual
    sourceId: text("source_id"),
    context: text("context"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cards_subject_note_type").on(t.subject, t.noteKey, t.type), index("cards_due").on(t.dueAt)],
);

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull(),
  rating: integer("rating").notNull(), // 1 again, 2 hard, 3 good, 4 easy
  wasNew: integer("was_new", { mode: "boolean" }).notNull().default(false),
  durationMs: integer("duration_ms").notNull().default(0),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Full written mock exams and diagnostic tests share this table (kind). */
export const mockExams = sqliteTable("mock_exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
  kind: text("kind").notNull().default("mock"), // mock | diagnostic
  level: text("level").notNull(),
  status: text("status").notNull(), // in-progress | awaiting-writing | done | abandoned
  plan: text("plan", { mode: "json" }).notNull().$type<unknown>(),
  currentPart: integer("current_part").notNull().default(0),
  partStartedAt: integer("part_started_at", { mode: "timestamp_ms" }),
  sectionScores: text("section_scores", { mode: "json" }).$type<unknown>(),
  totalPct: real("total_pct"),
  result: text("result", { mode: "json" }).$type<unknown>(),
  createdAt: createdAt(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

/** Practice time log; drives the streak and the weekly practice time. */
export const activity = sqliteTable(
  "activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull().default("angol"), // config/subjects.json id
    day: text("day").notNull(), // YYYY-MM-DD local date
    section: text("section").notNull(),
    seconds: integer("seconds").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_day").on(t.day)],
);

export type TaskRow = typeof tasks.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type ErrorRow = typeof errors.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type MockExamRow = typeof mockExams.$inferSelect;
