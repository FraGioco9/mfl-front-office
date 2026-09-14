export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
export const includes = (source, value, message) => invariant(source.includes(value), message);
export const excludes = (source, value, message) => invariant(!source.includes(value), message);
