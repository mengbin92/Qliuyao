import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

// Exercise the actual TS modules without a running Next server or API key.
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const cache = new Map();
function loadSource(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const cjsModule = { exports: {} };
  cache.set(filename, cjsModule);
  const require = createRequire(filename);
  const localRequire = (name) => {
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const target = name.startsWith("@/") ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
    return path.extname(target) ? require(target) : loadSource(`${target}.ts`);
  };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  new Function("require", "module", "exports", outputText)(localRequire, cjsModule, cjsModule.exports);
  return cjsModule.exports;
}

const { readSSEData } = loadSource(path.join(sourceRoot, "lib/sse.ts"));
const { classifyYao, yaosToBinary } = loadSource(path.join(sourceRoot, "lib/quantum.ts"));
const { POST } = loadSource(path.join(sourceRoot, "app/api/interpret/route.ts"));
const { loadHistory, saveHistory } = loadSource(path.join(sourceRoot, "lib/history.ts"));
const encoder = new TextEncoder();
const streamOf = (text, bytewise = false) => new ReadableStream({
  start(controller) {
    const bytes = encoder.encode(text);
    if (bytewise) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    else controller.enqueue(bytes);
    controller.close();
  },
});
const collect = async (stream) => {
  const out = [];
  for await (const item of readSSEData(stream)) out.push(item);
  return out;
};
const yaos = [7, 0, 1, 3, 1, 3].map(classifyYao);
const { ben, bian } = yaosToBinary(yaos);
const valid = { question: "接口回归测试", yaos, benBin: ben, bianBin: bian };
const request = (body = valid, signal) => new Request("http://localhost/api/interpret", {
  method: "POST", body: JSON.stringify(body), signal,
});

test("SSE preserves UTF-8, CRLF boundaries, multiline data and the final record", async () => {
  const input = ': heartbeat\r\ndata: {"text":\r\ndata: "六爻🌿"}\r\n\r\ndata: [DONE]';
  const stream = streamOf(input, true);
  assert.deepEqual(await collect(stream), ['{"text":\n"六爻🌿"}', '[DONE]']);
  assert.equal(stream.locked, false);
  assert.deepEqual(await collect(streamOf("data: a\r\rdata: b\n\n")), ["a", "b"]);
});

test("breaking at DONE cancels a still-open SSE response", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); },
    cancel() { canceled = true; },
  });
  for await (const payload of readSSEData(stream)) {
    assert.equal(payload, "[DONE]");
    break;
  }
  assert.equal(canceled, true);
  assert.equal(stream.locked, false);
});

test("stream failures propagate and release the reader lock", async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error("disconnected")); } });
  await assert.rejects(collect(stream), /disconnected/);
  assert.equal(stream.locked, false);
});

test("malformed stored history cannot break rendering or saving new records", (t) => {
  const entry = { id: "test", castAt: "2026-09-05T00:00:00.000Z", question: "测试", benName: "乾", benSymbol: "䷀", benBinary: "111111", moving: [0] };
  let stored = JSON.stringify([null, {}, { ...entry, moving: null }, entry]);
  const originals = [Object.getOwnPropertyDescriptor(globalThis, "window"), Object.getOwnPropertyDescriptor(globalThis, "localStorage")];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => stored, setItem: (_, value) => { stored = value; },
  } });
  t.after(() => ["window", "localStorage"].forEach((key, i) => {
    if (originals[i]) Object.defineProperty(globalThis, key, originals[i]);
    else delete globalThis[key];
  }));
  assert.deepEqual(loadHistory(), [entry]);
  saveHistory({ ...entry, id: "new" });
  assert.deepEqual(loadHistory().map((item) => item.id), ["new", "test"]);
});

test("invalid request shapes and inconsistent hexagrams return JSON 400", async () => {
  for (const input of [null, 1, {}, { ...valid, question: 1 }, { ...valid, question: " " },
    { ...valid, question: "字".repeat(201) }, { ...valid, yaos: [null, null, null, null, null, null] },
    { ...valid, benBin: "bad" }, { ...valid, bianBin: "111111" },
    { ...valid, yaos: yaos.map((yao) => ({ ...yao, index: 0 })) }]) {
    const response = await POST(request(input));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal((await POST(new Request("http://localhost/api/interpret", { method: "POST", body: "{" }))).status, 400);
});

function fakeKey(t) {
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "local-test-only";
  t.after(() => {
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  });
}

test("upstream connection failure returns a retryable JSON 502", async (t) => {
  fakeKey(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("connection refused"); });
  const response = await POST(request());
  assert.equal(response.status, 502);
  assert.equal(typeof (await response.json()).error, "string");
});

test("aborting before upstream headers arrive cancels the upstream request", async (t) => {
  fakeKey(t);
  let upstreamSignal;
  t.mock.method(globalThis, "fetch", async (_, { signal }) => {
    upstreamSignal = signal;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const response = POST(request(valid, controller.signal));
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  assert.equal((await response).status, 499);
  assert.equal(upstreamSignal.aborted, true);
});

test("DONE without a final newline is forwarded; empty completion stops heartbeat", async (t) => {
  fakeKey(t);
  const timers = new Set();
  t.mock.method(globalThis, "setInterval", () => { const timer = {}; timers.add(timer); return timer; });
  t.mock.method(globalThis, "clearInterval", (timer) => timers.delete(timer));
  t.mock.method(globalThis, "fetch", async () => new Response(streamOf("data: [DONE]", true)));
  const response = await POST(request());
  assert.deepEqual(await collect(response.body), ["[DONE]"]);
  assert.equal(timers.size, 0);
});

test("valid upstream text and DONE survive bytewise chunking", async (t) => {
  fakeKey(t);
  t.mock.method(globalThis, "fetch", async () => new Response(streamOf('data: {"choices":[{"delta":{"content":"纯文本解读🌿"}}]}\r\n\r\ndata: [DONE]', true)));
  const response = await POST(request());
  assert.deepEqual(await collect(response.body), [JSON.stringify({ text: "纯文本解读🌿" }), "[DONE]"]);
});

test("truncated streams and provider errors never claim successful completion", async (t) => {
  fakeKey(t);
  for (const input of ['data: {"choices":[{"delta":{"content":"尚未完成"}}]}\n\n', 'data: {"error":{"message":"unavailable"}}\n\n']) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(streamOf(input)));
    const response = await POST(request());
    const events = await collect(response.body);
    assert.equal(events.includes("[DONE]"), false);
    assert.equal(typeof JSON.parse(events.at(-1)).error, "string");
    mock.mock.restore();
  }
});

test("canceling the downstream stream aborts a waiting upstream body", async (t) => {
  fakeKey(t);
  let upstreamSignal;
  t.mock.method(globalThis, "fetch", async (_, { signal }) => {
    upstreamSignal = signal;
    return new Response(new ReadableStream({
      start(controller) {
        signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      },
    }));
  });
  const response = await POST(request());
  await response.body.cancel();
  assert.equal(upstreamSignal.aborted, true);
});
