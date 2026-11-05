import { z } from "zod";

/**
 * Content bank schemas (content/**.json). One file = one unit:
 *  - reading / language-use / listening: one exam task (feladat) with items
 *  - writing: one task card
 *  - speaking: one oral task (interview, situation, picture, debate ...)
 *  - vocabulary: one deck (topic + level)
 *
 * Topic ids, task types and error categories are cross-checked against
 * config/exam/*.json by lib/content/validate.ts.
 */

export const SCHEMA_VERSION = 1 as const;

export const LevelSchema = z.enum(["kozep", "emelt"]);
export type Level = z.infer<typeof LevelSchema>;

export const ObjectiveSectionSchema = z.enum(["reading", "language-use", "listening"]);
export type ObjectiveSection = z.infer<typeof ObjectiveSectionSchema>;

export const SectionSchema = z.enum(["reading", "language-use", "listening", "writing", "speaking", "vocabulary", "grammar", "guide"]);
export type Section = z.infer<typeof SectionSchema>;

const nonEmpty = z.string().trim().min(1, "Nem lehet üres.");
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Csak kisbetű, szám és kötőjel lehet benne.");
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "ISO dátum kell (ÉÉÉÉ-HH-NN).");

/** Where an official task comes from (only for source: "official"). */
export const OfficialRefSchema = z.object({
  year: z.number().int().min(2005).max(2100),
  session: z.enum(["majus", "oktober", "februar", "minta"]),
  level: LevelSchema,
  partNumber: z.number().int().min(1).max(5).optional(),
  taskNumber: z.number().int().min(1).max(10).optional(),
  folder: z.string().optional(), // data/official/<folder>
  audioFile: z.string().optional(), // file name inside the folder
  audioStartSec: z.number().nonnegative().optional(),
  audioEndSec: z.number().positive().optional(),
});

const BaseSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  /** Subject id (config/subjects.json); the file lives under content/<subject>/. */
  subject: Id,
  revision: z.number().int().positive().default(1),
  level: LevelSchema,
  source: z.enum(["official", "generated"]),
  official: OfficialRefSchema.optional(),
  topic: Id,
  title: nonEmpty,
  createdAt: IsoDate,
  tags: z.array(z.string()).default([]),
  reservedFor: z.enum(["mock", "diagnostic"]).optional(),
});

/* ------------------------------------------------------------------ */
/* Objective tasks: reading, language use, listening                   */
/* ------------------------------------------------------------------ */

export const OptionSchema = z.object({
  key: z.string().regex(/^[A-Z0-9]{1,3}$/, "Az opció kulcsa nagybetű vagy szám (pl. A, B, 1)."),
  text: nonEmpty,
});
export type Option = z.infer<typeof OptionSchema>;

const ItemBase = z.object({
  id: z.string().regex(/^\d{1,3}$/, "Az item azonosítója szám (0 = példa)."),
  /** Question, sentence, line of text ... (not needed for gaps that sit inside the passage). */
  prompt: z.string().optional(),
  /** Why the correct answer is correct – in Hungarian. Required for every item. */
  explanation: nonEmpty,
  /** Exact quote from the passage / script that proves the answer (reading & listening). */
  evidence: z.string().optional(),
  /** Error / skill category id (config/exam/error-categories.json). */
  category: Id,
  points: z.number().positive().default(1),
});

/** Multiple choice with item-level options (A–D). */
export const ChoiceItemSchema = ItemBase.extend({
  kind: z.literal("choice"),
  options: z.array(OptionSchema).min(2),
  answer: nonEmpty,
  /** Why each wrong option is wrong (key -> Hungarian explanation). */
  wrongOptions: z.record(z.string(), nonEmpty).optional(),
});

/** Pick a key from the task-level option bank (headings, missing sentences, speakers ...). */
export const MatchItemSchema = ItemBase.extend({
  kind: z.literal("match"),
  answer: nonEmpty,
  wrongOptions: z.record(z.string(), nonEmpty).optional(),
});

/** True / False (/ Not given). */
export const TfItemSchema = ItemBase.extend({
  kind: z.literal("tf"),
  answer: z.enum(["T", "F", "NG"]),
});

/** Open answer: short answer, open cloze, word formation, verb form, missing word, error line. */
export const TextItemSchema = ItemBase.extend({
  kind: z.literal("text"),
  /** Accepted answers; the first one is shown as "the" correct answer. "✓" means "the line is correct". */
  answer: z.array(nonEmpty).min(1),
  /** Word to transform / verb in brackets (word formation, verb forms). */
  cue: z.string().optional(),
  maxWords: z.number().int().positive().optional(),
});

export const ItemSchema = z.discriminatedUnion("kind", [ChoiceItemSchema, MatchItemSchema, TfItemSchema, TextItemSchema]);
export type Item = z.infer<typeof ItemSchema>;
export type ChoiceItem = z.infer<typeof ChoiceItemSchema>;
export type TextItem = z.infer<typeof TextItemSchema>;

/**
 * A passage block. Gaps are written inline as [[n]] (n = item id, [[0]] = example).
 * `gap` puts a gap in front of the block (missing heading / paragraph beginning).
 */
export const BlockSchema = z.object({
  text: z.string(),
  gap: z.string().regex(/^\d{1,3}$/).optional(),
  heading: z.string().optional(),
});
export type Block = z.infer<typeof BlockSchema>;

export const PassageSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  sourceNote: z.string().optional(),
  blocks: z.array(BlockSchema).min(1),
});
export type Passage = z.infer<typeof PassageSchema>;

export const GlossaryEntrySchema = z.object({
  term: nonEmpty,
  meaning: nonEmpty, // Hungarian
  example: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const SpeakerSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]{1,3}$/),
  name: nonEmpty,
  gender: z.enum(["female", "male"]),
  accent: z.enum(["en-GB", "en-US", "en-AU", "en-IE", "en-CA", "en-IN"]).default("en-GB"),
  age: z.enum(["young", "adult", "older"]).default("adult"),
});

export const ScriptLineSchema = z.object({
  speaker: z.string(),
  text: nonEmpty,
});

export const ListeningSchema = z.object({
  format: z.enum(["dialogue", "interview", "announcement", "radio", "monologue", "conversation", "news"]),
  speakers: z.array(SpeakerSchema).min(1),
  script: z.array(ScriptLineSchema).min(1),
  /** Seconds to read the questions before the first play (default from config). */
  prepSeconds: z.number().int().nonnegative().optional(),
  /** Seconds between the two plays / to check answers after (default from config). */
  pauseSeconds: z.number().int().nonnegative().optional(),
  plays: z.number().int().min(1).max(3).default(2),
  /** Optional official recording in data/official/<folder>/ */
  audioFile: z.string().optional(),
});

export const ObjectiveTaskSchema = BaseSchema.extend({
  section: ObjectiveSectionSchema,
  type: Id,
  /** English instructions, as on the exam paper. */
  instructions: nonEmpty,
  instructionsHu: z.string().optional(),
  passage: PassageSchema.optional(),
  listening: ListeningSchema.optional(),
  /** Shared option bank for `match` items (headings, sentences, speakers ...). */
  options: z.array(OptionSchema).optional(),
  /** May a shared option be used for more than one item (e.g. speaker matching)? */
  optionsReusable: z.boolean().default(false),
  /** The worked example (item id "0"), shown like on the exam. */
  example: ItemSchema,
  items: z.array(ItemSchema).min(1),
  glossary: z.array(GlossaryEntrySchema).default([]),
  /** Suggested time for the task in minutes (practice timer). */
  suggestedMinutes: z.number().positive().optional(),
});
export type ObjectiveTask = z.infer<typeof ObjectiveTaskSchema>;

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export const PhraseSchema = z.object({ en: nonEmpty, hu: nonEmpty });

export const WritingTaskSchema = BaseSchema.extend({
  section: z.literal("writing"),
  type: Id, // informal-email, formal-email, blog, forum, article ...
  /** Which writing task of the exam this card belongs to (determines rubric and word limit). */
  taskNumber: z.number().int().min(1).max(10),
  /** Register of the text (languages); free text for other subjects (e.g. "formális esszé"). */
  register: z.string().optional(),
  /** The situation as on the exam (English). */
  situation: nonEmpty,
  situationHu: z.string().optional(),
  /** Optional stimulus text (an ad, a post, an e-mail you reply to ...). */
  stimulus: z.string().optional(),
  /** The guiding points (irányítási szempontok) / sub-questions – all must be covered. */
  points: z.array(z.object({ id: Id, text: nonEmpty })).min(1),
  /** Word limit (languages, essays); absent for e.g. maths solutions. */
  wordLimit: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).optional(),
  suggestedMinutes: z.number().positive(),
  usefulPhrases: z.array(PhraseSchema).default([]),
  checklistExtra: z.array(nonEmpty).default([]),
  /** A model answer at the level, shown after the student's first submission. */
  modelAnswer: z
    .object({
      /** English text within the word limit, covering every guiding point. */
      text: nonEmpty,
      /** Which part of the text covers which guiding point (verbatim quote from `text`). */
      pointsCovered: z.array(z.object({ id: Id, quote: nonEmpty })).default([]),
      /** Hungarian notes: why this answer gets full marks (structure, register, useful language). */
      notes: z.array(nonEmpty).default([]),
    })
    .optional(),
});
export type WritingTask = z.infer<typeof WritingTaskSchema>;
export type ModelAnswer = NonNullable<WritingTask["modelAnswer"]>;

/* ------------------------------------------------------------------ */
/* Speaking                                                            */
/* ------------------------------------------------------------------ */

export const SpeakingTaskSchema = BaseSchema.extend({
  section: z.literal("speaking"),
  /** Oral task type (config task-types.json → speaking); the language types are interview, situation, picture, debate, presentation. */
  type: Id,
  /** Exam part this task practises (1-3), see the subject's structure.json → oral. */
  partNumber: z.number().int().min(1).max(3),
  instructionsHu: nonEmpty,
  /** interview: questions the examiner asks. */
  questions: z.array(z.object({ q: nonEmpty, followUps: z.array(nonEmpty).default([]) })).default([]),
  /** situation: what the candidate has to do. */
  situation: z
    .object({
      context: nonEmpty,
      candidateRole: nonEmpty,
      examinerRole: nonEmpty,
      goals: z.array(nonEmpty).min(1),
      examinerOpening: z.string().optional(),
    })
    .optional(),
  /** picture: two scenes replacing the photos + follow-up questions. */
  scenes: z.array(z.object({ description: nonEmpty })).default([]),
  /** presentation (emelt): statement or bullet points to talk about. */
  prompts: z.array(nonEmpty).default([]),
  /** debate (emelt): fixed position the candidate must defend. */
  debate: z
    .object({
      statement: nonEmpty,
      candidatePosition: z.enum(["for", "against"]),
      candidateIdeas: z.array(nonEmpty).default([]),
      examinerArguments: z.array(nonEmpty).min(2),
    })
    .optional(),
  followUpQuestions: z.array(nonEmpty).default([]),
  usefulPhrases: z.array(PhraseSchema).default([]),
  /** Sources handed to the candidate with the topic (texts, data, a described picture or diagram). */
  sources: z.array(z.object({ title: z.string().optional(), text: nonEmpty })).default([]),
  /** What a complete answer must contain (for the grader; Hungarian). */
  keyPoints: z.array(nonEmpty).default([]),
  /** Speaking time for the candidate (seconds) in practice mode. */
  speakingSeconds: z.number().int().positive(),
  prepSeconds: z.number().int().nonnegative().default(0),
  /**
   * A sample answer at the level: turns of a conversation (interview, situation,
   * debate) or a monologue (picture, presentation), with Hungarian notes.
   */
  sampleAnswer: z
    .object({
      turns: z.array(z.object({ speaker: z.enum(["examiner", "candidate"]), text: nonEmpty })).min(1),
      notes: z.array(nonEmpty).default([]),
    })
    .optional(),
});
export type SpeakingTask = z.infer<typeof SpeakingTaskSchema>;

/* ------------------------------------------------------------------ */
/* Vocabulary decks                                                    */
/* ------------------------------------------------------------------ */

export const VocabCardSchema = z.object({
  term: nonEmpty,
  meaning: nonEmpty, // Hungarian
  pos: z.enum(["n", "v", "adj", "adv", "phr", "phv", "prep", "conj", "idiom"]).optional(),
  /** English example sentence that contains the term (used for the cloze card). */
  example: nonEmpty,
  collocation: z.string().optional(),
});
export type VocabCard = z.infer<typeof VocabCardSchema>;

export const VocabDeckSchema = BaseSchema.extend({
  section: z.literal("vocabulary"),
  type: z.literal("deck"),
  cards: z.array(VocabCardSchema).min(5),
});
export type VocabDeck = z.infer<typeof VocabDeckSchema>;

/* ------------------------------------------------------------------ */
/* Grammar / strategy lessons (Szabálytár)                              */
/* ------------------------------------------------------------------ */

export const LessonPracticeItemSchema = z.discriminatedUnion("kind", [ChoiceItemSchema, TextItemSchema]);
export type LessonPracticeItem = z.infer<typeof LessonPracticeItemSchema>;

/**
 * One lesson per error category (config/exam/error-categories.json): the rule
 * in Hungarian with English examples, typical Hungarian-speaker mistakes and a
 * short self-check. Level independent: stored under content/grammar/kozep/,
 * rules needed only at emelt are marked `emeltOnly`.
 */
export const GrammarLessonSchema = BaseSchema.extend({
  section: z.literal("grammar"),
  type: z.literal("lesson"),
  topic: z.literal("nyelvtan").default("nyelvtan"),
  /** Error category this lesson explains. */
  category: Id,
  /** 2–4 Hungarian sentences: what this is and where it costs points on the exam. */
  summaryHu: nonEmpty,
  rules: z
    .array(
      z.object({
        title: nonEmpty,
        explanation: nonEmpty,
        emeltOnly: z.boolean().default(false),
        examples: z.array(z.object({ en: nonEmpty, hu: z.string().optional(), note: z.string().optional() })).min(1),
      }),
    )
    .min(1),
  /** Typical mistakes of Hungarian learners: wrong → right, and why (Hungarian). */
  commonMistakes: z.array(z.object({ wrong: nonEmpty, right: nonEmpty, why: nonEmpty })).default([]),
  /** Hungarian: where it appears on the exam and how to handle it. */
  examTips: z.array(nonEmpty).default([]),
  /** Short self-check; every item has a Hungarian explanation of the correct answer and why. */
  practice: z.array(LessonPracticeItemSchema).default([]),
  relatedCategories: z.array(Id).default([]),
});
export type GrammarLesson = z.infer<typeof GrammarLessonSchema>;

/* ------------------------------------------------------------------ */
/* Guides (Útmutatók): writing text types, speaking task types, exam parts */
/* ------------------------------------------------------------------ */

/**
 * How to write a text type / handle a speaking task / approach an exam part.
 * Level independent (content/guide/kozep/gd-<type>-<target>.json); level
 * specific advice goes into `levelNotes`.
 */
export const GuideSchema = BaseSchema.extend({
  section: z.literal("guide"),
  /** writing: target = writing text type; speaking: target = speaking task type; exam: target = exam part id. */
  type: z.enum(["writing", "speaking", "exam"]),
  target: Id,
  topic: z.literal("utmutato").default("utmutato"),
  /** 2–4 Hungarian sentences: what this is and what the examiner looks for. */
  summaryHu: nonEmpty,
  /** The structure / procedure step by step (Hungarian). */
  steps: z.array(z.object({ title: nonEmpty, explanation: nonEmpty, tips: z.array(nonEmpty).default([]) })).min(2),
  /** Ready-made English phrases with Hungarian meaning, grouped (e.g. "Megszólítás", "Érvelés"). */
  phrases: z.array(z.object({ group: nonEmpty, en: nonEmpty, hu: nonEmpty })).default([]),
  /** Typical mistakes: wrong → right → why (Hungarian). */
  mistakes: z.array(z.object({ wrong: nonEmpty, right: nonEmpty, why: nonEmpty })).default([]),
  /** Self-check list before handing in / at the end (Hungarian). */
  checklist: z.array(nonEmpty).default([]),
  /** Time management advice (Hungarian). */
  timing: z.string().optional(),
  /** Short annotated example (English text, Hungarian notes). */
  example: z.object({ title: z.string().optional(), text: nonEmpty, notes: z.array(nonEmpty).default([]) }).optional(),
  levelNotes: z.object({ kozep: z.string().optional(), emelt: z.string().optional() }).default({}),
});
export type Guide = z.infer<typeof GuideSchema>;

/* ------------------------------------------------------------------ */

export const ContentSchema = z.discriminatedUnion("section", [
  ObjectiveTaskSchema.extend({ section: z.literal("reading") }),
  ObjectiveTaskSchema.extend({ section: z.literal("language-use") }),
  ObjectiveTaskSchema.extend({ section: z.literal("listening") }),
  WritingTaskSchema,
  SpeakingTaskSchema,
  VocabDeckSchema,
  GrammarLessonSchema,
  GuideSchema,
]);
export type Content = z.infer<typeof ContentSchema>;

export function isObjective(c: Content): c is ObjectiveTask & { section: ObjectiveSection } {
  return c.section === "reading" || c.section === "language-use" || c.section === "listening";
}
