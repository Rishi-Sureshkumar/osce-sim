/**
 * Similarity thresholds for the deterministic language layer (Phase 4 M1). Tuned on the chat
 * fixtures (tests/fixtures/chat) and the labelled grading transcripts; see the open questions in
 * docs/PLAN-phase4.md (who signs these off).
 */
export const THRESHOLDS = {
  /** chat: accept the best target at this combined score… */
  accept: 0.6,
  /** …if it beats the runner-up (a different target) by this much */
  margin: 0.04,
  /** bonuses added to the embedding similarity */
  keywordPerWord: 0.04,
  keywordMax: 0.1,
  pattern: 0.1,
  /** case facts/negatives beat generic bank entries at equal similarity */
  priorityStep: 0.02,
  /** follow-ups of the fact just answered, and that fact itself */
  recencyFollowUp: 0.05,
  recencyFact: 0.02,
  /** grading (mark-sheet `match` items): credit at ≥ credit, needs_review in [review, credit) */
  credit: 0.7,
  review: 0.63,
} as const;
