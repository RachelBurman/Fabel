function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function topKNeighbours(
  key: string,
  allVectors: Record<string, number[]>,
  k: number
): string[] {
  const vec = allVectors[key];
  if (!vec) return [];
  return Object.entries(allVectors)
    .filter(([name]) => name !== key)
    .map(([name, v]) => ({ name, score: cosineSimilarity(vec, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ name }) => name);
}

export function deriveFlavourTerritory(
  preferredKeys: string[],
  allVectors: Record<string, number[]>,
  k = 10
): string[] {
  if (preferredKeys.length === 0) return [];

  const preferredSet = new Set(preferredKeys);
  const frequency: Record<string, number> = {};
  let firstNeighbours: string[] = [];

  for (const key of preferredKeys.slice(0, 5)) {
    const neighbours = topKNeighbours(key, allVectors, k).filter(
      (n) => !preferredSet.has(n)
    );
    if (key === preferredKeys[0]) firstNeighbours = neighbours;
    for (const n of neighbours) {
      frequency[n] = (frequency[n] ?? 0) + 1;
    }
  }

  const candidates = Object.entries(frequency)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k.replace(/_/g, " "));

  if (candidates.length >= 2) return candidates;

  return firstNeighbours.slice(0, 3).map((k) => k.replace(/_/g, " "));
}
