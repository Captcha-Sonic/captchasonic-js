/**
 * CaptchaSonic — Official TypeScript/JavaScript SDK for the CaptchaSonic API.
 *
 * ## Public Endpoints
 *
 * | Transport   | Endpoint                                   | Protocol                 |
 * |-------------|--------------------------------------------|--------------------------| 
 * | `"grpc"`    | `api.captchasonic.com:443`                 | gRPC binary (HTTP/2)     |
 * | `"connect"` | `https://api.captchasonic.com/rpc`         | ConnectRPC (fetch/JSON)  |
 * | `"http"`    | `https://api.captchasonic.com`             | REST/JSON                |
 *
 * ## Usage
 *
 * ### Node.js server-side (gRPC — default, fastest)
 * ```ts
 * import { CaptchaSonic } from "captchasonic";
 * const client = new CaptchaSonic("sonic_xxx");
 * const result = await client.solveOcr({ images: [imageBytes] });
 * ```
 *
 * ### Browser / React (ConnectRPC — recommended)
 * ```ts
 * const client = new CaptchaSonic("sonic_xxx", { transport: "connect" });
 * const result = await client.solveOcr({ images: [imageBytes] });
 * ```
 *
 * ### Browser / React (REST — fallback)
 * ```ts
 * const client = new CaptchaSonic("sonic_xxx", { transport: "http" });
 * const result = await client.solveOcr({ images: [imageBytes] });
 * ```
 *
 * ### With advanced config
 * ```ts
 * const client = new CaptchaSonic("sonic_xxx", {
 *   transport      : "connect",
 *   timeout        : 180_000,   // 3 min max poll wait
 *   pollingInterval: 5_000,     // check every 5s
 * });
 * ```
 */

import { createClient, type Client } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  SonicService,
  type CreateTaskResponse,
  type GetTaskResultResponse,
  type GetBalanceResponse,
  type HealthCheckResponse,
  type Task,
} from "./gen/captchasonic/v1/sonic_pb.js";

export type { Task, CreateTaskResponse, GetTaskResultResponse };

// Re-export the generated service descriptor so downstream packages (e.g. the
// MCP server) can build a low-level ConnectRPC/gRPC client without reaching into
// this package's internal `gen/` files.
export { SonicService } from "./gen/captchasonic/v1/sonic_pb.js";

/**
 * All accepted aliases for the Geetest sub-type.
 * Pass any of these as `type` inside {@link SolveGeetestOptions}.
 *
 * | Canonical | Accepted aliases |
 * |---|---|
 * | nine-grid  | `"nine"` `"geetest_nine"` `"9"` |
 * | click/icon | `"click"` `"geetest_click"` `"icon"` |
 * | slide      | `"slide"` `"geetest_slide"` |
 * | match      | `"match"` `"geetest_match"` |
 * | winlinze   | `"winlinze"` `"geetest_winlinze"` |
 */
export type GeetestSubtype =
  | "nine"       | "geetest_nine"    | "9"
  | "click"      | "geetest_click"   | "icon"
  | "slide"      | "geetest_slide"
  | "match"      | "geetest_match"
  | "winlinze"   | "geetest_winlinze";

/** @deprecated Use {@link GeetestSubtype} */
export type GeetestType = GeetestSubtype;

/**
 * Options object for {@link CaptchaSonic.solveGeetest}.
 */
export interface SolveGeetestOptions {
  /**
   * Geetest sub-type. Accepts canonical names or short aliases:
   * - `"nine"` / `"geetest_nine"` / `"9"` — nine-tile grid select
   * - `"click"` / `"geetest_click"` / `"icon"` — click matching objects
   * - `"slide"` / `"geetest_slide"` — slide puzzle
   * - `"match"` / `"geetest_match"` — 3×3 swap puzzle
   * - `"winlinze"` / `"geetest_winlinze"` — 5×5 swap puzzle
   */
  type: GeetestSubtype;
  /**
   * What to find / select. Required for `"nine"` and `"click"`.
   * Ignored for `"slide"`, `"match"`, `"winlinze"`.
   */
  question?: string;
  /** Challenge images — required for `"nine"`, `"click"`, `"slide"`. */
  images?: ImageInput[];
  /**
   * Reference / background images.
   * - For `"click"`: reference icons
   * - For `"slide"`: background image (puzzle base)
   */
  examples?: ImageInput[];
  /** Single slice image (alternative to `examples` for slide). */
  image?: ImageInput;
  /**
   * Geetest version. Optional — omit unless you specifically need gtv3.
   * - `3` — Geetest v3 AI solver
   * - Omit / `0` — default solver path
   */
  gtv?: number;
  /** Target website URL — affects slide pixel offset calibration. */
  websiteURL?: string;
}

/** Options for {@link CaptchaSonic.solvePopularCaptcha}. */
export interface SolvePopularCaptchaOptions {
  /** Challenge tile images (1–64). */
  images: ImageInput[];
  /** Challenge question text. */
  question: string;
  /**
   * Challenge sub-type:
   * - `"objectClassify"` / `"grid"` — grid select
   * - `"objectClick"` — bbox click
   * - `"objectDrag"` — drag pairs
   */
  questionType: string;
  /** Reference images for objectClick challenges. */
  examples?: ImageInput[];
  /** `true` if images are full-page screenshots. */
  screenshot?: boolean;
  /** Page URL for context. */
  websiteURL?: string;
  /** Site key for context. */
  websiteKey?: string;
}

/** Options for {@link CaptchaSonic.solveRecaptchaV2}. */
export interface SolveRecaptchaV2Options {
  /** Challenge tile images (typically 9 for 3×3 grid). */
  images: ImageInput[];
  /**
   * Challenge category — plain text or Google class code.
   * e.g. `"traffic lights"` or `"/m/015qff"`
   */
  question: string;
  /**
   * Challenge question type / layout hint:
   * - `"split_33"` — 3×3 grid, multi-select
   * - `"33"` — 3×3 grid, single-select
   * - `"44"` — 4×4 grid
   */
  questionType?: string;
  /** Page URL for analytics. */
  websiteURL?: string;
  /** Site key for analytics. */
  websiteKey?: string;
}

/** Options for {@link CaptchaSonic.solveOcr}. */
export interface SolveOcrOptions {
  /** Images to extract text from (max 50). */
  images: ImageInput[];
  /**
   * OCR module:
   * - `"common"` — general OCR (default)
   * - `"mtcaptcha"` — MTCaptcha
   * - `"bls"` / `"morocco"` — BLS/Morocco numeric digits
   */
  module?: string;
  /** Digits only. Auto-set for `"bls"`. */
  numeric?: boolean;
  /** Preserve letter case. */
  caseSensitive?: boolean;
  /** Minimum text length. */
  minLength?: number;
  /** Maximum text length. Auto-set to 3 for `"bls"`. */
  maxLength?: number;
  /** Page URL for analytics. */
  websiteURL?: string;
}

/**
 * TikTok sub-type aliases.
 * - `"click"` / `"tiktok_click"` — click matching objects
 * - `"whirl"` / `"tiktok_whirl"` — whirl/slide (examples required)
 * - `"slide"` / `"tiktok_slide"` — slide (examples required)
 */
export type TikTokSubtype =
  | "click"  | "tiktok_click"
  | "whirl"  | "tiktok_whirl"
  | "slide"  | "tiktok_slide";

/** Options for {@link CaptchaSonic.solveTikTok}. */
export interface SolveTikTokOptions {
  /** TikTok challenge sub-type. */
  type: TikTokSubtype;
  /** What to find / action description. */
  question: string;
  /** Challenge images. */
  images: ImageInput[];
  /** Reference / background images. Required for `"whirl"` and `"slide"`. */
  examples?: ImageInput[];
  /** Page URL for analytics. */
  websiteURL?: string;
}

/**
 * Binance sub-type aliases.
 * - `"grid"` / `"binance_grid"` — grid select
 * - `"slide"` / `"binance_slide"` — slide puzzle
 */
export type BinanceSubtype =
  | "grid"  | "binance_grid"
  | "slide" | "binance_slide";

/** Options for {@link CaptchaSonic.solveBinance}. */
export interface SolveBinanceOptions {
  /** Binance challenge sub-type. */
  type: BinanceSubtype;
  /** What to find. Required for `"grid"`. */
  question?: string;
  /** Challenge images. */
  images: ImageInput[];
  /** Reference images (optional for grid). */
  examples?: ImageInput[];
  /** Page URL for analytics. */
  websiteURL?: string;
}

/** Options for {@link SonicClient.solveTurnstile}. */
export interface SolveTurnstileOptions {
  /** Full URL of the page hosting the Turnstile widget. */
  websiteURL: string;
  /** Turnstile sitekey. */
  websiteKey: string;
  /** Proxy — omit for proxyless. Format: `"http://user:pass@host:port"` */
  proxy?: string;
}

/** Options for {@link SonicClient.solvePopularCaptchaToken}. */
export interface SolvePopularCaptchaTokenOptions {
  /** Full URL of the page with the CAPTCHA widget. */
  websiteURL: string;
  /** Site key. */
  websiteKey: string;
  /** Proxy — omit for proxyless. */
  proxy?: string;
  /** Enterprise metadata: `rqdata`, `rqtoken`, `fingerprint`. */
  metadata?: Record<string, string>;
}

/** Options for {@link SonicClient.solveRecaptchaV2Token}. */
export interface SolveRecaptchaV2TokenOptions {
  /** Full URL of the page with the reCAPTCHA widget. */
  websiteURL: string;
  /** reCAPTCHA v2 sitekey. */
  websiteKey: string;
  /** Proxy — omit for proxyless. */
  proxy?: string;
}

/** Options for {@link SonicClient.solveRecaptchaV3Token}. */
export interface SolveRecaptchaV3TokenOptions {
  /** Full URL of the page with the reCAPTCHA v3 widget. */
  websiteURL: string;
  /** reCAPTCHA v3 sitekey. */
  websiteKey: string;
  /** Proxy — omit for proxyless. */
  proxy?: string;
}

/** Options for {@link CaptchaSonic.solveCloudflare}. */
export interface SolveCloudflareOptions {
  /** Full URL of the Cloudflare-protected page. */
  websiteURL: string;
  /** Cloudflare sitekey. */
  websiteKey: string;
  /** Proxy — required for Cloudflare. Format: `"http://user:pass@host:port"` */
  proxy: string;
}

/** Options for {@link CaptchaSonic.solveSlideImage}. */
export interface SolveSlideImageOptions {
  /**
   * 1–2 images:
   * - Single image with transparent piece overlay, OR
   * - `[background, piece]` as separate images
   */
  images: ImageInput[];
}

/** Default production endpoint for gRPC transport: full HTTPS URL. */
export const DEFAULT_GRPC_URL = "https://api.captchasonic.com";

/** Default ConnectRPC base URL for the `"connect"` transport. */
export const DEFAULT_CONNECT_URL = "https://api.captchasonic.com/rpc";

/** Default base URL for REST (`"http"`) transport. */
export const DEFAULT_HTTP_URL = "https://api.captchasonic.com";

/** @deprecated Use {@link DEFAULT_GRPC_URL} / {@link DEFAULT_CONNECT_URL} / {@link DEFAULT_HTTP_URL} */
export const DEFAULT_URL = "https://api.captchasonic.com";


/**
 * Accepted image inputs for convenience methods.
 * - `Uint8Array` / `Buffer` — used as-is
 * - `string` — file path (Node.js only, loaded synchronously)
 */
export type ImageInput = Uint8Array | Buffer | string;

function loadImage(src: ImageInput): Uint8Array<ArrayBuffer> {
  const bytes =
    typeof src === "string"
      ? ((): Uint8Array => {
          // Node.js file path — dynamic import to stay browser-safe at import time
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { readFileSync } = require("node:fs") as typeof import("node:fs");
          return readFileSync(src);
        })()
      : src;
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) as Uint8Array<ArrayBuffer>;
}

function loadImages(srcs: ImageInput[]): Uint8Array[] {
  return srcs.map(loadImage);
}

function normalizeGeetestSubtype(t: GeetestSubtype): "nine" | "click" | "slide" | "match" | "winlinze" {
  switch (t) {
    case "nine": case "geetest_nine": case "9":         return "nine";
    case "click": case "geetest_click": case "icon":    return "click";
    case "slide": case "geetest_slide":                 return "slide";
    case "match": case "geetest_match":                 return "match";
    case "winlinze": case "geetest_winlinze":           return "winlinze";
  }
}


/** Validate API key at construction — no network needed. */
function validateApiKey(key: string): void {
  if (!key) throw new SonicError("apiKey is required", -1);
  if (!key.startsWith("sonic_")) throw new SonicError('apiKey must start with "sonic_"', -1);
  if (key.length < 12) throw new SonicError("apiKey is too short", -1);
}


/**
 * Encode Uint8Array images to base64 strings for HTTP/connect transport.
 * REST and ConnectRPC transports send images as plain base64 strings.
 * gRPC binary transport sends raw binary (zero base64 overhead).
 */
function encodeTaskForHttp(task: Partial<Task>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(task as Record<string, unknown>) };
  const b64List = (imgs: Uint8Array[] | undefined): string[] | undefined =>
    imgs?.length ? imgs.map((img) => Buffer.from(img).toString("base64")) : undefined;
  // Billing REST handler reads images via TaskPayload.Images() which maps from
  // the JSON key "queries" — NOT "images". Rename on the way out for HTTP only.
  if (task.images?.length) {
    out["queries"] = b64List(task.images as Uint8Array[]);
    delete out["images"];
  }
  if (task.examples?.length) {
    out["examples"] = b64List(task.examples as Uint8Array[]);
  }
  if ((task.image as Uint8Array)?.length)
    out["image"] = Buffer.from(task.image as Uint8Array).toString("base64");
  return out;
}

/**
 * Normalize a raw server response into a consistent shape:
 *   { errorId, taskId, status, solution, typedSolution }
 *
 * The server returns two shapes:
 *   Shape A (image solvers): { code:200, msg:"", answers:[...] }
 *   Shape B (token/async):   { errorId:0, taskId:"...", status:"processing" }
 *
 * gRPC path wraps answers as: solution["answers"] = Go fmt.Sprint string
 *   e.g. "[true false true]" — NOT valid JSON, needs conversion.
 */
function normalizeResponse(
  data: Record<string, unknown>,
  questionType?: string,
): Record<string, unknown> {
  // Already normalized (has errorId field) — just parse typedSolution if present
  if ("errorId" in data) {
    // gRPC/Connect path: solution is map[string]string — parse answers
    const sol = data["solution"] as Record<string, string> | undefined;
    if (sol?.answers && !data["typedSolution"]) {
      data["typedSolution"] = parseAnswers(sol.answers, questionType);
    }
    return data;
  }

  // Shape A: HTTP { code, msg, answers }
  const code = (data["code"] as number) ?? 0;
  const msg  = (data["msg"] as string) ?? "";
  if (code !== 0 && code !== 200) {
    // Error case — re-throw as SonicError via errorId
    return { errorId: 1, errorCode: String(code), errorDescription: msg };
  }
  const answers = data["answers"];
  return {
    ...data,
    errorId: 0,
    typedSolution: parseAnswers(answers, questionType),
  };
}

/**
 * Parse a raw answers value (any shape the server may return) into typedSolution.
 * Handles:
 *   - Go fmt.Sprint string: "[true false true]" → parses to boolean[]
 *   - JSON string: "[true,false,true]"
 *   - Already-parsed array/object
 */
function parseAnswers(
  answers: unknown,
  _questionType?: string,
): Record<string, unknown> | undefined {
  if (answers === undefined || answers === null) return undefined;

  let parsed: unknown = answers;

  // Parse if string — try JSON first, then Go fmt.Sprint
  if (typeof parsed === "string") {
    const raw = parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Go fmt.Sprint format: "[true false true]" → "[true,false,true]"
      const fixed = raw.trim().replace(/\s+/g, ",");
      try { parsed = JSON.parse(fixed); } catch { return undefined; }
    }
  }

  if (!Array.isArray(parsed)) {
    // Slide: { x: 87 } or { solution: [x,y], offset: 87 }
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj["x"] === "number") return { slide: { x: obj["x"] } };
      if (typeof obj["offset"] === "number") return { slide: { x: obj["offset"] } };
    }
    return undefined;
  }

  if (parsed.length === 0) return undefined;

  const first = parsed[0];
  // boolean[] → grid
  if (typeof first === "boolean")
    return { grid: { objects: parsed as boolean[] } };
  // number[] → recaptcha tile indices
  if (typeof first === "number")
    return { grid: { objects: parsed as number[] } };
  // string[] → OCR texts
  if (typeof first === "string")
    return { text: { texts: parsed as string[] } };
  // [{x,y},...] → click coords
  if (typeof first === "object" && first !== null && "x" in (first as object))
    return { click: { groups: parsed as Array<{ x: number; y: number }> } };
  // [[{start,end}],...] → drag pairs
  if (Array.isArray(first))
    return { drag: { pairs: parsed as unknown[][] } };

  return undefined;
}


const ERROR_NAMES: Record<number, string> = {
  1: "InvalidApiKeyError",
  2: "InsufficientBalanceError",
  3: "DailyLimitExceededError",
  4: "MinuteLimitExceededError",
  5: "QuotaExceededError",
  6: "PlanExpiredError",
};

export class SonicError extends Error {
  constructor(
    message: string,
    public readonly errorId: number = -1,
  ) {
    super(message);
    this.name = ERROR_NAMES[errorId] ?? "SonicError";
  }
}


const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS   = 2_000;
const POLL_MAX_WAIT_MS   = 120_000;
const RETRY_ATTEMPTS     = 3;


/**
 * Normalise a user-supplied URL into a fully-qualified `https://` (or `http://`
 * for local/insecure) URL that ConnectRPC and fetch both accept.
 *
 * Accepted input formats:
 *   "api.captchasonic.com"          → "https://api.captchasonic.com"
 *   "api.captchasonic.com:443"      → "https://api.captchasonic.com:443"
 *   "https://api.captchasonic.com"  → "https://api.captchasonic.com"
 *   "localhost:50052"               → "http://localhost:50052"
 *   "127.0.0.1:50052"               → "http://127.0.0.1:50052"
 *   "http://localhost:50052"         → "http://localhost:50052"
 */
function resolveUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  // Already has a scheme — use as-is.
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // No scheme — infer from host.
  const host = trimmed.split(":")[0];
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return isLocal ? `http://${trimmed}` : `https://${trimmed}`;
}

/**
 * Ensure the connect transport URL ends with `/rpc`.
 * The server routes `/rpc/captchasonic.v1.SonicService/Method` to the ConnectRPC handler.
 * If the user already provides a path (e.g. `"https://api.captchasonic.com/rpc"`), leave it untouched.
 */
function appendRpcPath(base: string): string {
  // If URL already has a non-root path (user supplied /rpc or custom), keep it.
  try {
    const u = new URL(base);
    if (u.pathname !== "/" && u.pathname !== "") return base;
  } catch {
    // not a valid URL — fall through
  }
  return base.replace(/\/$/, "") + "/rpc";
}


export interface CaptchaSonicOptions {
  /**
   * Server URL. All formats are accepted — scheme and port are optional.
   *
   * Per-transport defaults (when omitted):
   * - `"grpc"`    — `"api.captchasonic.com:443"` (scheme auto-handled for gRPC dial)
   * - `"connect"` — `"https://api.captchasonic.com/rpc"`
   * - `"http"`    — `"https://api.captchasonic.com"`
   *
   * All these formats work for any transport:
   * ```
   * "api.captchasonic.com"               // scheme auto-added
   * "api.captchasonic.com:443"            // host:port, scheme auto-added
   * "https://api.captchasonic.com"        // full URL
   * "https://api.captchasonic.com/rpc"    // connect transport with /rpc path
   * "localhost:50052"                     // local dev, http:// auto-used
   * "http://localhost:50052"              // explicit local
   * ```
   */
  url?: string;
  /** Alias for url. */
  baseUrl?: string;
  /**
   * Transport (default: `"grpc"`):
   * - `"grpc"`    — Native gRPC binary, HTTP/2. **Node.js only** (server-side). Fastest.
   * - `"connect"` — ConnectRPC protocol (HTTP/1.1 + JSON via fetch). **Browser + Node.js ✅**. Recommended for React.
   * - `"http"`    — Plain JSON REST via fetch. **Browser + Node.js ✅**. Simple fallback.
   */
  transport?: "grpc" | "connect" | "http";
  /** Per-call request timeout in ms (default 30 000). */
  timeoutMs?: number;
  /** Alias for timeoutMs. Also sets the maximum wait duration for polling tasks. */
  timeout?: number;
  /** Polling interval in ms (default 2 000). */
  pollingInterval?: number;
}


export class CaptchaSonic {
  protected readonly apiKey: string;
  protected readonly timeoutMs: number;
  protected readonly pollingInterval: number;
  protected readonly pollingTimeoutMs: number;
  protected readonly transport: "grpc" | "connect" | "http";
  protected readonly httpUrl?: string;
  protected readonly rpc?: Client<typeof SonicService>;

  constructor(apiKey: string, opts?: CaptchaSonicOptions) {
    validateApiKey(apiKey);
    this.apiKey    = apiKey;
    this.timeoutMs = opts?.timeoutMs ?? opts?.timeout ?? DEFAULT_TIMEOUT_MS;
    this.pollingTimeoutMs = opts?.timeout ?? opts?.timeoutMs ?? POLL_MAX_WAIT_MS;
    this.pollingInterval = opts?.pollingInterval ?? POLL_INTERVAL_MS;
    this.transport = opts?.transport ?? "grpc";

    const targetUrl = opts?.url ?? opts?.baseUrl;

    if (this.transport === "http") {
      this.httpUrl = resolveUrl(targetUrl ?? DEFAULT_HTTP_URL);
    } else if (this.transport === "connect") {
      // Connect transport uses the /rpc/ path. Auto-append /rpc if user gives bare domain.
      const base = resolveUrl(targetUrl ?? DEFAULT_CONNECT_URL);
      const connectUrl = appendRpcPath(base);
      this.rpc = createClient(SonicService, createConnectTransport({ baseUrl: connectUrl }));
    } else {
      // gRPC binary — HTTP/2, Node.js only.
      this.rpc = createClient(SonicService, createGrpcTransport({ baseUrl: resolveUrl(targetUrl ?? DEFAULT_GRPC_URL) }));
    }
  }



  /**
   * Submit a task. Automatically polls if status is "processing".
   *
   * For HTTP transport, raw `Uint8Array` images are auto-encoded to base64.
   * For gRPC transport, images are sent as raw binary (zero overhead).
   */
  async createTask(task: Partial<Task>): Promise<CreateTaskResponse | Record<string, unknown>> {
    const questionType = task.questionType;

    if (this.transport === "http") {
      const data = await this.fetchJSON<Record<string, unknown>>("POST", "/createTask", {
        apiKey: this.apiKey,
        task: encodeTaskForHttp(task), // base64 queries for REST
      });
      // Server returns { code, msg } or { errorId, errorDescription }
      const errId  = (data.errorId as number) || (data.code as number) || 0;
      const errMsg = (data.errorDescription as string) || (data.msg as string) || "";
      if (errId !== 0 && errId !== 200) {
        throw new SonicError(errMsg || `Server error (errorId=${errId})`, errId);
      }
      if (data.taskId && ["processing", "pending", "idle"].includes(data.status as string)) {
        return this.pollTaskHttp(data.taskId as string);
      }
      // Normalize Shape A (code/answers) → consistent { errorId, typedSolution }
      return normalizeResponse(data, questionType);
    }

    // gRPC / Connect path
    const response = await this.callWithRetry<CreateTaskResponse>(() =>
      this.rpc!.createTask({ apiKey: this.apiKey, task: task as Task }, { timeoutMs: this.timeoutMs }),
    );
    if (response.errorId !== 0) {
      throw new SonicError(response.errorDescription || `Server error (errorId=${response.errorId})`, response.errorId);
    }
    if (response.taskId && ["processing", "pending", "idle"].includes(response.status)) {
      return this.pollTask(response.taskId) as unknown as Promise<CreateTaskResponse>;
    }
    // Parse gRPC solution.answers (Go fmt.Sprint string) → typedSolution
    return normalizeResponse(response as unknown as Record<string, unknown>, questionType);
  }

  /** Manually poll for an async task result. */
  async getTaskResult(taskId: string): Promise<GetTaskResultResponse | Record<string, unknown>> {
    if (this.transport === "http") {
      return this.fetchJSON("POST", "/getTaskResult", { apiKey: this.apiKey, taskId });
    }
    return this.callWithRetry(() =>
      this.rpc!.getTaskResult({ apiKey: this.apiKey, taskId }, { timeoutMs: this.timeoutMs }),
    );
  }

  /** Fetch account balance (USD). */
  async getBalance(): Promise<number> {
    if (this.transport === "http") {
      const data = await this.fetchJSON<{ status: string; balance: number; errorId?: number; errorDescription?: string }>(
        "GET", `/balance?apiKey=${encodeURIComponent(this.apiKey)}`,
      );
      if (data.status !== "ok") throw new SonicError(data.errorDescription ?? "Balance error", data.errorId ?? -1);
      return data.balance;
    }
    const response = await this.callWithRetry<GetBalanceResponse>(() =>
      this.rpc!.getBalance({ apiKey: this.apiKey }, { timeoutMs: this.timeoutMs }),
    );
    if (response.errorId !== 0) throw new SonicError(`Balance error (errorId=${response.errorId})`, response.errorId);
    return response.balance;
  }

  /** Check server health. */
  async healthCheck(): Promise<HealthCheckResponse | Record<string, unknown>> {
    if (this.transport === "http") return this.fetchJSON("GET", "/health").catch(() => this.fetchJSON("GET", "/"));
    return this.callWithRetry(() => this.rpc!.healthCheck({}, { timeoutMs: this.timeoutMs }));
  }


  /**
   * Solve a popular CAPTCHA image classification challenge (grid / bbox selection).
   *
   * **Task type:** `PopularCaptchaImage`
   * **Billing:** `grid`/`objectClassify` = ⌈images.length/9⌉ credits; `bbox`/`objectClick` = images.length credits
   *
   * `questionType` values (server may override via text inference):
   * - `"objectClassify"` — grid select (most common). Returns `typedSolution.grid.objects` `boolean[]`
   * - `"objectClick"` — bbox click per image. Returns `typedSolution.click`
   * - `"objectDrag"` — drag pairs. Returns `typedSolution.drag`
   * - `"grid"` — same as objectClassify
   *
   * @param images - Tile images (1–64). `Uint8Array`, `Buffer`, or file path string.
   * @param question - Challenge question text, e.g. `"Please click each image containing a cat"`.
   * @param questionType - Client hint: `"objectClassify"` | `"objectClick"` | `"objectDrag"` | `"grid"`
   * @param opts.examples - Reference images for bbox/objectClick challenges.
   * @param opts.screenshot - Whether images are full-page screenshots (default `false`).
   * @param opts.websiteURL - Page URL for analytics.
   * @param opts.websiteKey - Site key for analytics.
   *
   * @example
   * ```ts
   * const result = await client.solvePopularCaptcha({
   *   images      : tiles,
   *   question    : "Click each image with a cat",
   *   questionType: "objectClassify",
   *   websiteURL  : "https://example.com",
   * });
   * console.log(result.typedSolution?.grid?.objects); // [false, true, false, ...]
   * ```
   */
  async solvePopularCaptcha(opts: SolvePopularCaptchaOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    const task: Partial<Task> = {
      type        : "PopularCaptchaImage",
      images      : loadImages(opts.images),
      question    : opts.question,
      questionType: opts.questionType,
      screenshot  : opts.screenshot ?? false,
    };
    if (opts.examples?.length) task.examples  = loadImages(opts.examples);
    if (opts.websiteURL)       task.websiteURL = opts.websiteURL;
    if (opts.websiteKey)       task.websiteKey = opts.websiteKey;
    return this.createTask(task);
  }

  /**
   * Solve a reCAPTCHA v2 image classification challenge.
   * @param opts - {@link SolveRecaptchaV2Options}
   * @example
   * ```ts
   * await client.solveRecaptchaV2({ images: tiles, question: "traffic lights" });
   * await client.solveRecaptchaV2({ images: tiles, question: "/m/015qff" });
   * ```
   */
  async solveRecaptchaV2(opts: SolveRecaptchaV2Options): Promise<CreateTaskResponse | Record<string, unknown>> {
    const task: Record<string, unknown> = {
      type: "RecaptchaV2Classification",
      images: loadImages(opts.images),
      question: opts.question,
    };
    if (opts.questionType) task.questionType = opts.questionType;
    if (opts.websiteURL)   task.websiteURL   = opts.websiteURL;
    if (opts.websiteKey)   task.websiteKey   = opts.websiteKey;
    return this.createTask(task);
  }

  /**
   * Solve a Geetest challenge.
   *
   * **Task type:** `GeetestClassification`
   *
   * @param opts - {@link SolveGeetestOptions}
   *
   * @example
   * ```ts
   * await client.solveGeetest({ type: "nine", question: "Select all bicycles", images });
   * await client.solveGeetest({ type: "click", question: "the bear", images: tiles });
   * await client.solveGeetest({ type: "slide", images: [puzzlePiece], examples: [background] });
   * await client.solveGeetest({ type: "match" });
   * await client.solveGeetest({ type: "winlinze" });
   * ```
   */
  async solveGeetest(opts: SolveGeetestOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    const canonical = normalizeGeetestSubtype(opts.type);

    if ((canonical === "click" || canonical === "nine") && !opts.question?.trim()) {
      throw new Error(`solveGeetest: 'question' is required for type "${opts.type}"`);
    }
    if ((canonical === "click" || canonical === "slide" || canonical === "nine") && !opts.images?.length) {
      throw new Error(`solveGeetest: 'images' is required for type "${opts.type}"`);
    }

    let q: string;
    if (canonical === "click") q = `geetest_click:${opts.question!.trim()}`;
    else if (canonical === "nine") q = `geetest_nine:${opts.question!.trim()}`;
    else q = `geetest_${canonical}`;

    const task: Partial<Task> = {
      type    : "GeetestClassification",
      question: q,
      ...(opts.gtv !== undefined ? { gtv: opts.gtv } : { gtv: 0 }),
    };
    if (opts.images?.length)   task.images    = loadImages(opts.images);
    if (opts.examples?.length) task.examples  = loadImages(opts.examples);
    if (opts.image != null)    task.image     = loadImage(opts.image);
    if (opts.websiteURL)       task.websiteURL = opts.websiteURL;
    return this.createTask(task);
  }

  /**
   * Solve an AWS WAF image challenge.
   * @param images - Challenge tile images.
   * @param question - Format: `"type:category:target"`, e.g. `"grid:vehicles:cars"`.
   */
  async solveAwsWaf(images: ImageInput[], question: string): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({ type: "AwsWafClassification", images: loadImages(images), question });
  }

  /**
   * Solve an OCR / image-to-text task.
   * @param opts - {@link SolveOcrOptions}
   * @example
   * ```ts
   * await client.solveOcr({ images: [img] });
   * await client.solveOcr({ images: [img], module: "mtcaptcha", maxLength: 4 });
   * await client.solveOcr({ images: imgs, module: "bls", numeric: true, maxLength: 3 });
   * ```
   */
  async solveOcr(opts: SolveOcrOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({
      type         : "ImageToTextTask",
      images       : loadImages(opts.images),
      numeric      : opts.numeric ?? false,
      caseSensitive: opts.caseSensitive ?? false,
      ...(opts.module     && { module    : opts.module }),
      ...(opts.minLength  && { minLength : opts.minLength }),
      ...(opts.maxLength  && { maxLength : opts.maxLength }),
      ...(opts.websiteURL && { websiteURL: opts.websiteURL }),
    });
  }

  /**
   * Solve a TikTok CAPTCHA challenge.
   * @param opts - {@link SolveTikTokOptions}
   * @example
   * ```ts
   * await client.solveTikTok({ type: "click", question: "Select the shape", images });
   * await client.solveTikTok({ type: "whirl", question: "Rotate to match", images, examples });
   * await client.solveTikTok({ type: "slide", question: "Slide to fit", images, examples });
   * ```
   */
  async solveTikTok(opts: SolveTikTokOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    const subtype = opts.type === "click" ? "tiktok_click"
                  : opts.type === "whirl" ? "tiktok_whirl"
                  : opts.type === "slide" ? "tiktok_slide"
                  : opts.type; // already canonical alias
    const q = `${subtype}:${opts.question}`;
    const task: Partial<Task> = { type: "TikTokClassification", question: q, images: loadImages(opts.images) };
    if (opts.examples?.length) task.examples   = loadImages(opts.examples);
    if (opts.websiteURL)       task.websiteURL = opts.websiteURL;
    return this.createTask(task);
  }

  /**
   * Solve a Binance CAPTCHA challenge.
   * @param opts - {@link SolveBinanceOptions}
   * @example
   * ```ts
   * await client.solveBinance({ type: "grid", question: "Select the bicycle", images });
   * await client.solveBinance({ type: "slide", images: [puzzle], examples: [bg] });
   * ```
   */
  async solveBinance(opts: SolveBinanceOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    const subtype = opts.type === "grid"  ? "binance_grid"
                  : opts.type === "slide" ? "binance_slide"
                  : opts.type; // already canonical alias
    const q = opts.question ? `${subtype}:${opts.question}` : subtype;
    const task: Partial<Task> = { type: "BinanceSlideTask", question: q, images: loadImages(opts.images) };
    if (opts.examples?.length) task.examples   = loadImages(opts.examples);
    if (opts.websiteURL)       task.websiteURL = opts.websiteURL;
    return this.createTask(task);
  }

  /**
   * Solve a Cloudflare Turnstile token challenge (async — polls until ready, up to 120s).
   * @param opts - {@link SolveTurnstileOptions}
   * @example
   * ```ts
   * await client.solveTurnstile({ websiteURL: "https://example.com", websiteKey: "0x4AAAAAAA" });
   * await client.solveTurnstile({ websiteURL: "https://example.com", websiteKey: "0x4AAAAAAA", proxy: "http://u:p@1.2.3.4:8080" });
   * ```
   */
  async solveTurnstile(opts: SolveTurnstileOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({
      type      : opts.proxy ? "AntiTurnstileTask" : "AntiTurnstileTaskProxyless",
      websiteURL: opts.websiteURL,
      websiteKey: opts.websiteKey,
      ...(opts.proxy && { proxy: opts.proxy }),
    });
  }

  /**
   * Solve a popular CAPTCHA token challenge via browser automation (async — polls until ready).
   * @param opts - {@link SolvePopularCaptchaTokenOptions}
   * @example
   * ```ts
   * await client.solvePopularCaptchaToken({ websiteURL: "https://example.com", websiteKey: "a9b5fb07-..." });
   * ```
   */
  async solvePopularCaptchaToken(opts: SolvePopularCaptchaTokenOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({
      type      : opts.proxy ? "PopularTask" : "PopularTaskProxyless",
      websiteURL: opts.websiteURL,
      websiteKey: opts.websiteKey,
      ...(opts.proxy    && { proxy   : opts.proxy }),
      ...(opts.metadata && { metadata: opts.metadata }),
    });
  }

  /**
   * Solve a reCAPTCHA v2 token challenge via browser automation (async — polls until ready).
   * @param opts - {@link SolveRecaptchaV2TokenOptions}
   * @example
   * ```ts
   * await client.solveRecaptchaV2Token({ websiteURL: "https://example.com", websiteKey: "6Le-wvkS..." });
   * ```
   */
  async solveRecaptchaV2Token(opts: SolveRecaptchaV2TokenOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({
      type      : opts.proxy ? "RecaptchaV2Task" : "RecaptchaV2TaskProxyless",
      websiteURL: opts.websiteURL,
      websiteKey: opts.websiteKey,
      ...(opts.proxy && { proxy: opts.proxy }),
    });
  }

  /**
   * Solve a reCAPTCHA v3 token challenge via browser automation (async — polls until ready).
   * @param opts - {@link SolveRecaptchaV3TokenOptions}
   * @example
   * ```ts
   * await client.solveRecaptchaV3Token({ websiteURL: "https://example.com", websiteKey: "6LdyC2cU..." });
   * ```
   */
  async solveRecaptchaV3Token(opts: SolveRecaptchaV3TokenOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({
      type      : opts.proxy ? "RecaptchaV3Task" : "RecaptchaV3TaskProxyless",
      websiteURL: opts.websiteURL,
      websiteKey: opts.websiteKey,
      ...(opts.proxy && { proxy: opts.proxy }),
    });
  }

  /**
   * Solve a Cloudflare challenge via browser automation (async — polls until ready).
   * Proxy is always required.
   * @param opts - {@link SolveCloudflareOptions}
   * @example
   * ```ts
   * await client.solveCloudflare({ websiteURL: "https://example.com", websiteKey: "key", proxy: "http://u:p@1.2.3.4:8080" });
   * ```
   */
  async solveCloudflare(opts: SolveCloudflareOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({ type: "AntiCloudflareTask", websiteURL: opts.websiteURL, websiteKey: opts.websiteKey, proxy: opts.proxy });
  }

  /**
   * Solve a slide CAPTCHA using local contour detection (no AI).
   * Returns `typedSolution.slide.x` — pixel offset.
   * @param opts - {@link SolveSlideImageOptions}
   * @example
   * ```ts
   * const r = await client.solveSlideImage({ images: ["slide_bg.png", "piece.png"] });
   * console.log(r.typedSolution?.slide?.x); // e.g. 142
   * ```
   */
  async solveSlideImage(opts: SolveSlideImageOptions): Promise<CreateTaskResponse | Record<string, unknown>> {
    return this.createTask({ type: "SlideImage", images: loadImages(opts.images) });
  }
  private async fetchJSON<T = Record<string, unknown>>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const url = `${this.httpUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined && method === "POST" && { body: JSON.stringify(body) }),
    });
    if (res.status === 503) throw new SonicError("Server busy, retry later", 21);
    if (!res.ok) throw new SonicError(`HTTP ${res.status} from ${url}`, res.status);
    return res.json() as Promise<T>;
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        const isTransient = msg.includes("unavailable") || msg.includes("resource_exhausted") || msg.includes("deadline_exceeded");
        if (isTransient && attempt < RETRY_ATTEMPTS - 1) {
          await sleep(2 ** attempt * 1000);
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  private async pollTask(taskId: string): Promise<GetTaskResultResponse> {
    const deadline = Date.now() + this.pollingTimeoutMs;
    while (Date.now() < deadline) {
      const result = await this.getTaskResult(taskId) as GetTaskResultResponse;
      if (result.status === "ready") return result;
      await sleep(this.pollingInterval);
    }
    throw new SonicError(`Task ${taskId} timed out after ${this.pollingTimeoutMs / 1000}s`);
  }

  private async pollTaskHttp(taskId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + this.pollingTimeoutMs;
    while (Date.now() < deadline) {
      const result = await this.getTaskResult(taskId) as Record<string, unknown>;
      if (result.status === "ready") return result;
      await sleep(this.pollingInterval);
    }
    throw new SonicError(`Task ${taskId} timed out after ${this.pollingTimeoutMs / 1000}s`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

