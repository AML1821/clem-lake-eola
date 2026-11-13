# Clem of Lake Eola

Chat with Clementine "Clem" Featherby, the ghost of Lake Eola's 1950s swan keeper. The language model runs entirely in the visitor's browser with [Transformers.js](https://huggingface.co/docs/transformers.js). It uses WebGPU when the browser has it and falls back to WebAssembly (WASM) when it doesn't. No server or API key is needed, and nothing a visitor types leaves their device.

## Files

| File | What it is |
|---|---|
| `character.md` | **Clem's personality, rules, greeting and example lines. Edit this one to change her.** |
| `index.html` | The page: download button, progress bar, chat window and styling. |
| `worker.js` | Loads and runs the model in a background thread so the page stays responsive. |

## Editing Clem

Open `character.md` on GitHub, click the pencil icon, edit, and commit. The page reads the file each time it loads, so the change is live after your next deploy.

- `## Greeting` is Clem's opening line.
- `## Example conversation` lines (`**Visitor:**` / `**Clem:**`) teach the model her voice. Small models imitate these closely, so this section is the strongest lever you have.
- Every other `##` section is sent to the model as its instructions.
- Keep it short. Every line you add uses up the model's limited memory.

## The model

**`onnx-community/Qwen2.5-0.5B-Instruct`** (0.5 billion parameters, 4-bit), about **500 MB**, downloaded once.

- With WebGPU it loads the `q4f16` weights, or `q4` if the GPU lacks fp16 support.
- With WASM it loads the `q8` weights, which are also roughly 500 MB but slower to run.

The progress bar shows the exact byte count as files arrive. The browser keeps the files in its Cache Storage, so return visits load straight from disk and work offline. The Transformers.js library itself is pinned to `@huggingface/transformers@4.3.2` from jsDelivr.

Why this model: it's the smallest widely used instruct model that reliably follows a system-prompt persona and stays in character over a few turns. Smaller options such as SmolLM2-360M tend to drop the voice or ramble.

## Keeping the context small

The model sees only the character file plus the last **3 exchanges** (`MAX_EXCHANGES` in `index.html`). Replies are capped at 120 new tokens and trimmed to four sentences. If a reply ever breaks character (mentions being an AI, for example), the page swaps in an in-character line instead.

## Running it

Pages can't `fetch()` files from `file://`, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. To publish, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from branch, root folder).
