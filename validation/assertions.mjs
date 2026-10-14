export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
export const includes = (source, value, message) => invariant(source.includes(value), message);
export const excludes = (source, value, message) => invariant(!source.includes(value), message);

export function createStubbedHandlerLoader(require) {
  return (path, stubs) => {
    const restored = [];
    for (const [file, exports] of Object.entries(stubs)) {
      const id = require.resolve(file);
      restored.push([id, require.cache[id]]);
      require.cache[id] = { id, filename: id, loaded: true, exports };
    }
    const id = require.resolve(path);
    restored.push([id, require.cache[id]]);
    delete require.cache[id];
    try {
      return require(path);
    } finally {
      for (const [key, previous] of restored) {
        if (previous) require.cache[key] = previous;
        else delete require.cache[key];
      }
    }
  };
}
