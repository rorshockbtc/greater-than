// CommonJS shim that intercepts `require('sharp')` and returns a no-op stub.
// @xenova/transformers v2 pulls in `sharp` for image preprocessing (which we
// do not use — text feature-extraction only). On hosts where sharp's native
// libvips binding is unavailable, the eager `require('sharp')` inside
// transformers crashes the entire process. This shim is loaded via tsx's
// --import flag before transformers is evaluated, so the stub wins.
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "sharp") {
    return require.resolve("./stub-sharp.cjs", { paths: [__dirname] });
  }
  return origResolve.call(this, request, parent, ...rest);
};
function unsupported() {
  throw new Error(
    "[stub-sharp] sharp is stubbed in this process — image processing is not available. Text feature-extraction is fine.",
  );
}
const stub = function () {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        return () => stub();
      },
    },
  );
};
stub.cache = unsupported;
stub.concurrency = () => 1;
stub.counters = () => ({ queue: 0, process: 0 });
stub.simd = () => false;
stub.format = {};
stub.versions = { vips: "stub" };
stub.queue = { on: () => {} };
module.exports = stub;
module.exports.default = stub;
