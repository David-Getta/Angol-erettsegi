import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";

/**
 * Spaced repetition with FSRS (ts-fsrs). The card state is stored as JSON in
 * cards.fsrs_state; dates are serialised as ISO strings.
 */

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 }));

export type StoredFsrs = Omit<Card, "due" | "last_review"> & { due: string; last_review?: string | null };

export function newFsrsState(now: Date = new Date()): StoredFsrs {
  return serialize(createEmptyCard(now));
}

function serialize(c: Card): StoredFsrs {
  return { ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null };
}

function deserialize(s: StoredFsrs): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined } as Card;
}

export const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

export function review(state: StoredFsrs | null | undefined, rating: 1 | 2 | 3 | 4, now: Date = new Date()): { state: StoredFsrs; due: Date } {
  const card = state ? deserialize(state) : createEmptyCard(now);
  const result = scheduler.next(card, now, rating as Grade);
  return { state: serialize(result.card), due: result.card.due };
}

/** Next intervals for each rating, for the buttons ("10 p", "3 nap"). */
export function previewIntervals(state: StoredFsrs | null | undefined, now: Date = new Date()): Record<1 | 2 | 3 | 4, string> {
  const card = state ? deserialize(state) : createEmptyCard(now);
  const prev = scheduler.repeat(card, now);
  const fmt = (d: Date) => {
    const min = Math.round((d.getTime() - now.getTime()) / 60000);
    if (min < 60) return `${Math.max(1, min)} p`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} ó`;
    const days = Math.round(h / 24);
    if (days < 31) return `${days} nap`;
    return `${Math.round(days / 30)} hó`;
  };
  return {
    1: fmt(prev[Rating.Again].card.due),
    2: fmt(prev[Rating.Hard].card.due),
    3: fmt(prev[Rating.Good].card.due),
    4: fmt(prev[Rating.Easy].card.due),
  };
}
