# captchasonic

Official CaptchaSonic library for Node.js and TypeScript environments.

The CaptchaSonic Node.js SDK is a modern, Promise-based library designed for high-throughput automation. It features first-class TypeScript support, multi-transport flexibility, and automatic retry logic.

Works in **Node.js** and **modern browsers**.  
Compatible with frameworks such as Express, Fastify, React, Next.js, Vue, and Vite.

---

## Installation

```bash
npm install captchasonic
# or
yarn add captchasonic
```

---

## Quick Start

```js
const { CaptchaSonic } = require("captchasonic");

const solver = new CaptchaSonic("YOUR_API_KEY");

const result = await solver.solveRecaptchaV2({
  images  : [tile1, tile2, tile3],
  question: "traffic lights",
});

console.log(result.typedSolution?.grid?.objects); // [2, 4, 7]
```

---

## Usage — Geetest (nine-grid)

```js
const { CaptchaSonic } = require("captchasonic");

const solver = new CaptchaSonic("YOUR_API_KEY");

async function run() {
  try {
    const result = await solver.solveGeetest({
      type    : "nine",
      question: "Select all bicycles",
      images  : tiles,           // Uint8Array[] | Buffer[] | file paths
    });

    console.log("Solution:", result.typedSolution);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
```

---

## TypeScript

The SDK ships full type definitions for all options and responses.

```ts
import { CaptchaSonic } from "captchasonic";
import type { SolveGeetestOptions, SolveOcrOptions } from "captchasonic";

const solver = new CaptchaSonic("YOUR_API_KEY");

const opts: SolveGeetestOptions = {
  type    : "nine",
  question: "Select all bicycles",
  images  : tiles,
};

const result = await solver.solveGeetest(opts);
```

---

## Configuration

```ts
const solver = new CaptchaSonic("YOUR_API_KEY", {
  transport?: "grpc"        // Optional. Default: "grpc" — binary HTTP/2. Node.js only.
            | "connect"     // Node.js and browsers — ConnectRPC over fetch.
            | "http",       // Node.js and browsers — plain REST/JSON.

  url?            : string, // Override the API endpoint. Optional.
  baseUrl?        : string, // Alias for url. Optional.
  timeout?        : number, // Request/polling timeout in ms. Default: 30000 / 120000.
  timeoutMs?      : number, // Alias for timeout. Optional.
  pollingInterval?: number, // Polling frequency in ms. Default: 2000.
});
```

**Transport guide:**

| Transport | Environments | Protocol |
|---|---|---|
| `grpc` | Node.js only | gRPC binary over HTTP/2 — lowest latency |
| `connect` | Node.js and browsers | ConnectRPC over `fetch` |
| `http` | Node.js and browsers | Plain REST/JSON over `fetch` |

> **Browser users:** use `connect` (recommended) or `http`. Native gRPC requires Node.js.

---

## Solve Methods

All methods accept a single typed options object.

### `solvePopularCaptcha(opts)`

```ts
await solver.solvePopularCaptcha({
  images      : ImageInput[],
  question    : string,           // e.g. "Select all traffic lights"
  questionType: string,           // "objectClassify" | "objectClick" | "objectDrag" | "grid"
  examples?   : ImageInput[],
  screenshot? : boolean,
  websiteURL? : string,
  websiteKey? : string,
});
```

### `solveRecaptchaV2(opts)`

```ts
await solver.solveRecaptchaV2({
  images      : ImageInput[],
  question    : string,               // "traffic lights" or "/m/015qff"
  questionType: string,               // "split_33" | "33" | "44". Optional.
  websiteURL? : string,               // optional
  websiteKey? : string,               // optional
});
```

### `solveGeetest(opts)`

```ts
await solver.solveGeetest({
  type      : GeetestSubtype,     // "nine" | "click" | "slide" | "match" | "winlinze"
  question? : string,             // required for "nine" and "click"
  images?   : ImageInput[],       // required for "nine", "click", "slide"
  examples? : ImageInput[],
  gtv?      : number,             // Geetest version (e.g. 3)
  websiteURL?: string,
});

// Type aliases also accepted:
// "nine"     → "geetest_nine" | "9"
// "click"    → "geetest_click" | "icon"
// "slide"    → "geetest_slide"
// "match"    → "geetest_match"
// "winlinze" → "geetest_winlinze"
```

### `solveOcr(opts)`

```ts
await solver.solveOcr({
  images        : ImageInput[],
  module?       : "common" | "mtcaptcha" | "bls" | "morocco",
  numeric?      : boolean,
  caseSensitive?: boolean,
  minLength?    : number,
  maxLength?    : number,
  websiteURL?   : string,
});
// Returns: typedSolution.text.texts[0]
```

### `solveTikTok(opts)`

```ts
await solver.solveTikTok({
  type      : "click" | "whirl" | "slide",  // or "tiktok_click" etc.
  question  : string,
  images    : ImageInput[],
  examples? : ImageInput[],                // required for "whirl" and "slide"
  websiteURL?: string,
});
```

### `solveBinance(opts)`

```ts
await solver.solveBinance({
  type      : "grid" | "slide",             // or "binance_grid" etc.
  question? : string,                      // required for "grid"
  images    : ImageInput[],
  examples? : ImageInput[],
  websiteURL?: string,
});
```

### `solveSlideImage(opts)`

```ts
await solver.solveSlideImage({ images: [background, piece] });
// Returns: typedSolution.slide.x — pixel offset
```

### Token Automation Methods

These submit a task and poll until a token is returned (up to 120 s).

```ts
await solver.solveTurnstile({ websiteURL, websiteKey, proxy? });
await solver.solvePopularCaptchaToken({ websiteURL, websiteKey, proxy?, metadata? });
await solver.solveRecaptchaV2Token({ websiteURL, websiteKey, proxy? });
await solver.solveRecaptchaV3Token({ websiteURL, websiteKey, proxy? });
await solver.solveCloudflare({ websiteURL, websiteKey, proxy });   // proxy required
```

---

## Account Methods

```ts
const balance = await solver.getBalance();   // → number (USD)
await solver.healthCheck();                  // → { healthy: boolean, version: string }
```

---

## Image Input

```ts
type ImageInput = Uint8Array | Buffer | string;

// File path — Node.js only
await solver.solveOcr({ images: ["./captcha.png"] });

// Uint8Array — Node.js and browsers
const bytes = new Uint8Array(await fetch(url).then(r => r.arrayBuffer()));
await solver.solveOcr({ images: [bytes] });

// Node.js Buffer
await solver.solveOcr({ images: [fs.readFileSync("captcha.png")] });
```

> `grpc` sends images as raw binary — zero base64 overhead.  
> `connect` and `http` auto-encode images to base64 before sending.

---

## Error Handling

```ts
import { CaptchaSonic, SonicError } from "captchasonic";

try {
  const result = await solver.solveGeetest({ type: "nine", question: "bicycles", images });
} catch (err) {
  if (err instanceof SonicError) {
    console.error(err.errorId);   // 1–6
    console.error(err.name);      // "InvalidApiKeyError" | "InsufficientBalanceError" | ...
    console.error(err.message);
  }
}
```

| `errorId` | `name` | Meaning |
|---|---|---|
| 1 | `InvalidApiKeyError` | API key not valid |
| 2 | `InsufficientBalanceError` | Insufficient credits |
| 3 | `DailyLimitExceededError` | Daily quota exceeded |
| 4 | `MinuteLimitExceededError` | Rate limit hit |
| 5 | `QuotaExceededError` | Plan quota exceeded |
| 6 | `PlanExpiredError` | Subscription expired |

Transient gRPC errors are retried automatically with exponential backoff — up to 3 attempts.

---

## All Exported Types

```ts
import type {
  CaptchaSonicOptions,
  SonicClientOptions,
  ImageInput,
  SolvePopularCaptchaOptions,
  SolveRecaptchaV2Options,
  SolveGeetestOptions,
  SolveOcrOptions,
  SolveTikTokOptions,
  SolveBinanceOptions,
  SolveTurnstileOptions,
  SolvePopularCaptchaTokenOptions,
  SolveRecaptchaV2TokenOptions,
  SolveRecaptchaV3TokenOptions,
  SolveCloudflareOptions,
  SolveSlideImageOptions,
  GeetestSubtype,
  TikTokSubtype,
  BinanceSubtype,
  Task,
  CreateTaskResponse,
  GetTaskResultResponse,
} from "captchasonic";
```

---

## Requirements

- **Node.js** ≥ 18.0.0 — required for `grpc` transport
- **Browser** — any modern browser with `fetch` support; use `connect` or `http` transport
- **Module format** — ES Module (`"type": "module"`)
- **Bundlers** — Vite, Webpack 5, esbuild, Rollup, Next.js

---

## License

MIT — see [LICENSE](./LICENSE)
