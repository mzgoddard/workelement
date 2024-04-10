const deprecatedSet = new Set();
export function deprecate(key: string, message: (key: string) => string) {
  if (!deprecatedSet.has(key)) {
    console.warn(message(key));
    deprecatedSet.add(key);
  }
}
