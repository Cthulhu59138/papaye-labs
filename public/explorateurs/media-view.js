/** Pure media rules. No persistence, scheduling or DOM side effects. */
export function selectQuestionMedia(card, repetitions = 0) {
  const ids = Array.isArray(card?.questionMediaIds) ? card.questionMediaIds : [];
  if (!ids.length || ids.some(id => typeof id !== 'string' || !id)) return null;
  const index = Number.isSafeInteger(repetitions) && repetitions >= 0 ? repetitions : 0;
  return ids[index % ids.length];
}
export function freezeQuestionMedia(cards, reviews = {}) {
  return Object.freeze(cards.map(card => selectQuestionMedia(card, reviews[card.id]?.repetitions ?? 0)));
}
/** A render/retry owns one ticket. Late image events cannot unlock another card. */
export function createPhotoGate() {
  let generation = 0, key = null, status = 'idle';
  return {
    begin(nextKey) { generation += 1; key = nextKey; status = 'loading'; return Object.freeze({ generation, key }); },
    settle(ticket, loaded) {
      if (!ticket || ticket.generation !== generation || ticket.key !== key) return false;
      status = loaded ? 'ready' : 'failed'; return true;
    },
    ready(expectedKey) { return status === 'ready' && expectedKey === key; },
    invalidate() { generation += 1; key = null; status = 'idle'; }
  };
}
