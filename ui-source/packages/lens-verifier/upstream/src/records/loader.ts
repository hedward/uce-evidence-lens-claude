import { demoRecord, DEMO_RECORD_ID, DEMO_VERIFICATION_URL } from "./demo";
import { parseUceRecord } from "./parser";
import type { UceRecord } from "../types/record";
import {
  ValidationError,
  isArweaveId,
  isSha256,
  parseUntrustedJson,
  safeHttpsUrl,
} from "../security/untrusted";

export const MAX_RESPONSE_BYTES = 1_000_000;
const ALLOWED_HOSTS = ["cbyuce.com", "arweave.net"] as const;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class PublicRecordError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_input"
      | "network"
      | "cors"
      | "http"
      | "invalid_response"
      | "unsupported",
  ) {
    super(message);
    this.name = "PublicRecordError";
  }
}

async function readBoundedText(
  response: Response,
  controller: AbortController,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_RESPONSE_BYTES
  ) {
    void response.body?.cancel().catch(() => undefined);
    controller.abort();
    throw new PublicRecordError(
      "Public response exceeds the 1 MB safety limit.",
      "invalid_response",
    );
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        void reader
          .cancel("Response exceeded the safety limit.")
          .catch(() => undefined);
        controller.abort();
        throw new PublicRecordError(
          "Public response exceeds the 1 MB safety limit.",
          "invalid_response",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function fetchJson(
  url: URL,
  fetcher: FetchLike,
  expectedArweaveTxId?: string,
): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok)
      throw new PublicRecordError(
        `Public source returned HTTP ${response.status}.`,
        "http",
      );
    if (response.url) {
      const finalUrl = safeHttpsUrl(response.url, ALLOWED_HOSTS);
      if (expectedArweaveTxId) {
        const finalTxId = finalUrl.pathname.split("/").filter(Boolean)[0];
        if (finalTxId !== expectedArweaveTxId) {
          throw new PublicRecordError(
            "The Arweave response URL does not match the requested transaction.",
            "invalid_response",
          );
        }
      }
    }
    const text = await readBoundedText(response, controller);
    if (!text.trim()) {
      throw new PublicRecordError(
        "Public response has no JSON body.",
        "invalid_response",
      );
    }
    try {
      return parseUntrustedJson(text);
    } catch (error) {
      throw new PublicRecordError(
        error instanceof Error
          ? error.message
          : "Public response was not valid JSON.",
        "invalid_response",
      );
    }
  } catch (error) {
    if (error instanceof PublicRecordError) throw error;
    if (timedOut) {
      throw new PublicRecordError(
        "The public source did not finish responding within 10 seconds.",
        "network",
      );
    }
    const message =
      error instanceof Error ? error.message : "Network request failed.";
    const likelyCors = /fetch|cors|network/i.test(message);
    throw new PublicRecordError(
      likelyCors
        ? "Live retrieval is unavailable from this browser origin. Use the bundled demo, an Arweave URL, or paste public JSON."
        : "The public source could not be reached.",
      likelyCors ? "cors" : "network",
    );
  } finally {
    clearTimeout(timeout);
  }
}

interface ClassifiedInput {
  url: URL;
  loadedFrom: UceRecord["loadedFrom"];
  expectedId?: string;
  sourceArweaveTxId?: string;
}

export function classifyPublicInput(
  input: string,
): ClassifiedInput | { demo: true } {
  const value = input.trim();
  if (
    !value ||
    value.toLowerCase() === "demo" ||
    value === DEMO_RECORD_ID ||
    value === DEMO_VERIFICATION_URL
  ) {
    return { demo: true };
  }
  if (isSha256(value)) {
    return {
      url: new URL(
        `https://cbyuce.com/verify/${value.toLowerCase()}?format=json`,
      ),
      expectedId: value.toLowerCase(),
      loadedFrom: "cbyuce",
    };
  }
  let url: URL;
  try {
    url = safeHttpsUrl(value, ALLOWED_HOSTS);
  } catch (error) {
    throw new PublicRecordError(
      error instanceof Error
        ? error.message
        : "Unsupported public record input.",
      "invalid_input",
    );
  }
  if (url.hostname === "cbyuce.com") {
    const match = /^\/verify\/([a-f0-9]{64})\/?$/i.exec(url.pathname);
    const expectedId = match?.[1]?.toLowerCase();
    if (!expectedId) {
      throw new PublicRecordError(
        "Only public CbyUCE /verify/<record-hash> URLs are supported.",
        "unsupported",
      );
    }
    url.search = "?format=json";
    return { url, loadedFrom: "cbyuce", expectedId };
  }
  const txId = url.pathname.split("/").filter(Boolean)[0];
  if (!txId || !isArweaveId(txId)) {
    throw new PublicRecordError(
      "Arweave URLs must identify one 43-character public transaction.",
      "unsupported",
    );
  }
  return {
    url: new URL(`https://arweave.net/${txId}`),
    loadedFrom: "arweave",
    sourceArweaveTxId: txId,
  };
}

export async function loadPublicRecord(
  input: string,
  fetcher: FetchLike = fetch,
): Promise<UceRecord> {
  const classified = classifyPublicInput(input);
  if ("demo" in classified) return structuredClone(demoRecord);
  const data = await fetchJson(
    classified.url,
    fetcher,
    classified.sourceArweaveTxId,
  );
  try {
    return parseUceRecord(data, {
      source: classified.url.toString(),
      loadedFrom: classified.loadedFrom,
      expectedId: classified.expectedId,
      sourceArweaveTxId: classified.sourceArweaveTxId,
    });
  } catch (error) {
    throw new PublicRecordError(
      error instanceof Error
        ? error.message
        : "Unsupported public record response.",
      error instanceof ValidationError ? "invalid_response" : "unsupported",
    );
  }
}

export function loadPastedRecord(text: string): UceRecord {
  const data = parseUntrustedJson(text);
  return parseUceRecord(data, {
    source: "Pasted public JSON (not independently retrieved)",
    loadedFrom: "pasted_json",
  });
}
