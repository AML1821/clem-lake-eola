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

**`onnx-community/Qwen2.5-0.5B-Instruct`** (0.5 billion parameters), downloaded once:

- **WebGPU** (Chrome, Edge): `q4` weights, **786 MB**. The smaller `q4f16` build (483 MB) is deliberately not used. On WebGPU it produced garbled or echoed replies ("Mouth of your swans."), likely because its fp16 math overflows on some GPUs.
- **WASM** (other browsers): `q8` weights, **512 MB**, slower to run.

Sampling follows Qwen's own recommended settings: temperature 0.7, top_k 20, top_p 0.8, repetition penalty 1.1.

The progress bar shows the exact byte count as files arrive. The browser keeps the files in its Cache Storage, so return visits load straight from disk and work offline. The Transformers.js library itself is pinned to `@huggingface/transformers@4.3.2` from jsDelivr.

Why this model: it's the smallest widely used instruct model that reliably follows a system-prompt persona and stays in character over a few turns. Smaller options such as SmolLM2-360M tend to drop the voice or ramble.

## Keeping the context small

The model sees only the character file plus the last **3 exchanges** (`MAX_EXCHANGES` in `index.html`). Replies are capped at 120 new tokens and trimmed to four sentences. If a reply ever breaks character (mentions being an AI, for example), the page swaps in an in-character line instead.

## Publishing on GitHub Pages

The site is plain static files with no build step, so it can be served straight from the repo.

1. Merge into `main`.
2. In the repo, go to **Settings → Pages**. Under "Build and deployment," choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. After a minute or so the site is live at `https://<your-username>.github.io/clem-lake-eola/`.

Notes:

- `.nojekyll` tells Pages to serve the files as they are, without Jekyll processing.
- GitHub Pages caches files for about 10 minutes, so an edit to `character.md` can take that long to appear.
- The model files come from Hugging Face and the library from jsDelivr, so the Pages site itself stays tiny.
- After the first successful load, the page asks the browser to keep the saved model, so it isn't cleared when disk space runs low.
- GitHub Pages can't send the headers that enable multithreaded WASM. Browsers without WebGPU therefore run single-threaded, which is slower. WebGPU isn't affected.

## Running it locally

Pages can't `fetch()` files from `file://`, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
