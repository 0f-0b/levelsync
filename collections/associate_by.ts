export function associateBy<K, V>(
  it: Iterable<V>,
  key: (value: V) => K,
): Map<K, V> {
  const result = new Map<K, V>();
  for (const elem of it) {
    result.set(key(elem), elem);
  }
  return result;
}
