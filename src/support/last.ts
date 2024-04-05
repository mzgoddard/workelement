function last<T>(items: [T, ...T[]]): T;
function last<T>(items: []): undefined;
function last<T>(items: T[]): T | undefined;
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}
