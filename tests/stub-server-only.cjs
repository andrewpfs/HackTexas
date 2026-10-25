// Tests run in plain Node, where the "server-only" guard would throw on import.
const Module = process.getBuiltinModule("node:module");
const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...rest);
};
