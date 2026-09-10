/**
 * 洗牌抽牌：一副牌抽完才重洗，所以短期內不會抽到同一張。
 * 純隨機會連著給同一則，用起來像壞掉。
 */
export function drawFromBag(ids, bag, random = Math.random) {
  const deck = Array.isArray(bag) && bag.length ? [...bag] : shuffle(ids, random);
  const id = deck.pop();
  return { id, bag: deck };
}

function shuffle(ids, random) {
  const deck = [...ids];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
