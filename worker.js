// Runs the language model off the main thread so the page stays smooth.
// Messages in:  {type:"load"} | {type:"generate", messages} | {type:"stop"}
// Messages out: {type:"progress"|"status"|"ready"|"token"|"done"|"error", ...}

import {
  pipeline,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";

// Smallest instruct model that reliably holds a persona in the browser.
const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

let generator = null;
let device = null;
const stopper = new InterruptableStoppingCriteria();

async function pickBackend() {
  if (typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        // Plain 4-bit weights with fp32 math. The smaller q4f16 build gives garbled
        // or echoed replies on some GPUs, so we don't use it.
        return { device: "webgpu", dtype: "q4" };
      }
    } catch (_) { /* fall through to WASM */ }
  }
  return { device: "wasm", dtype: "q8" };
}

function makeProgressReporter() {
  const files = {};
  return (p) => {
    if (p.status === "progress_total") {
      self.postMessage({ type: "progress", loaded: p.loaded, total: p.total });
    } else if (p.status === "progress" && p.total) {
      // Fallback aggregation in case the total event isn't emitted.
      files[p.file] = { loaded: p.loaded, total: p.total };
      let loaded = 0, total = 0;
      for (const f of Object.values(files)) { loaded += f.loaded; total += f.total; }
      self.postMessage({ type: "progress", loaded, total, partial: true });
    }
  };
}

async function load() {
  if (generator) { self.postMessage({ type: "ready", device }); return; }
  const first = await pickBackend();
  const attempts = first.device === "webgpu" ? [first, { device: "wasm", dtype: "q8" }] : [first];

  for (const opt of attempts) {
    try {
      self.postMessage({ type: "status", text: `Downloading the model (${opt.device === "webgpu" ? "WebGPU" : "WASM"})…` });
      generator = await pipeline("text-generation", MODEL_ID, {
        device: opt.device,
        dtype: opt.dtype,
        progress_callback: makeProgressReporter(),
      });
      device = opt.device;
      self.postMessage({ type: "status", text: "Warming up…" });
      // A tiny warm-up compiles GPU shaders so the first real reply isn't sluggish.
      await generator([{ role: "user", content: "Hi" }], { max_new_tokens: 1 });
      self.postMessage({ type: "ready", device });
      return;
    } catch (err) {
      generator = null;
      if (opt === attempts[attempts.length - 1]) throw err;
      self.postMessage({ type: "status", text: "WebGPU wasn't available, so we're switching to WASM…" });
    }
  }
}

async function generate(messages) {
  stopper.reset();
  let text = "";
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      text += chunk;
      self.postMessage({ type: "token", text });
    },
  });
  await generator(messages, {
    // Qwen2.5's recommended sampling settings (from the model's generation_config.json).
    max_new_tokens: 120,       // ~4 short sentences
    do_sample: true,
    temperature: 0.7,
    top_k: 20,
    top_p: 0.8,
    repetition_penalty: 1.1,
    streamer,
    stopping_criteria: stopper,
  });
  self.postMessage({ type: "done", text });
}

self.addEventListener("message", async ({ data }) => {
  try {
    if (data.type === "load") await load();
    else if (data.type === "generate") await generate(data.messages);
    else if (data.type === "stop") stopper.interrupt();
  } catch (err) {
    self.postMessage({ type: "error", text: String(err?.message || err) });
  }
});
