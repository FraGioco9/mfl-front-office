export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
export const includes = (source, value, message) => invariant(source.includes(value), message);
export const excludes = (source, value, message) => invariant(!source.includes(value), message);

export function createStubbedHandlerLoader(requireFn) {
  return (path, stubs) => {
    const restored = [];
    for (const [file, exports] of Object.entries(stubs)) {
      const id = requireFn.resolve(file);
      restored.push([id, requireFn.cache[id]]);
      requireFn.cache[id] = { id, filename: id, loaded: true, exports };
    }
    const id = requireFn.resolve(path);
    restored.push([id, requireFn.cache[id]]);
    delete requireFn.cache[id];
    try {
      return requireFn(path);
    } finally {
      for (const [key, previous] of restored) {
        if (previous) requireFn.cache[key] = previous;
        else delete requireFn.cache[key];
      }
    }
  };
}
