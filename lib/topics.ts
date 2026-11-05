import type { Level } from "@/lib/content/schema";
import { examConfig, type Topic } from "@/lib/exam/config";
import { listTasks, type TaskSummary } from "@/lib/tasks";
import { deckStatuses, type DeckStatus } from "@/lib/vocab/cards";

export const TOPIC_SECTIONS = ["reading", "language-use", "listening", "writing", "speaking"] as const;
export type TopicSection = (typeof TOPIC_SECTIONS)[number];


export type TopicOverview = {
  topic: Topic;
  tasks: Record<TopicSection, TaskSummary[]>;
  total: number;
  done: number;
  deck: DeckStatus | null;
};

/** Practice tasks (not the ones reserved for the mock exam / diagnostic) and the vocabulary deck of every topic. */
export function topicOverviews(level: Level): TopicOverview[] {
  const bySection = Object.fromEntries(TOPIC_SECTIONS.map((s) => [s, listTasks(s, level).filter((x) => !x.reservedFor)])) as Record<TopicSection, TaskSummary[]>;
  const decks = deckStatuses(level);
  return examConfig.topics().topics.map((topic) => {
    const tasks = Object.fromEntries(TOPIC_SECTIONS.map((s) => [s, bySection[s].filter((x) => x.topic === topic.id)])) as Record<TopicSection, TaskSummary[]>;
    const all = Object.values(tasks).flat();
    return {
      topic,
      tasks,
      total: all.length,
      done: all.filter((x) => x.attempts > 0).length,
      deck: decks.find((d) => d.topic === topic.id) ?? null,
    };
  });
}
