import type { EvidenceCheck, UceRecord } from "../types/record";
import type { FetchLike } from "../records/loader";
import { isArweaveId, isPlainObject } from "../security/untrusted";

const ARWEAVE_GATEWAY = "https://arweave.net";
const TURBO_GATEWAY = "https://turbo-gateway.com";
const MAX_STATUS_BYTES = 16 * 1024;
const MAX_BLOCK_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const INDEX_URL = "https://turbo-gateway.com/graphql";
const MAX_INDEX_BYTES = 64 * 1024;
const MAX_BUNDLE_DEPTH = 4;
const TOTAL_TIMEOUT_MS = 25_000;

interface ArweaveStatus {
  blockHeight: number;
  blockHash: string;
  confirmations: number;
}

interface ArweaveBlock {
  height: number;
  blockHash: string;
  timestamp: number;
  transactionIds: string[];
}

class AnchorResponseError extends Error {
  constructor(
    message: string,
    readonly status: "retryable" | "unsupported" | "mismatch" = "unsupported",
    readonly source?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

interface GatewayJsonResult {
  response: Response;
  data?: unknown;
  url: URL;
}

/** Fixed metadata query; neither manifests nor index responses select URLs. */
export function arweaveIndexUrl(id: string): URL {
  if (!isArweaveId(id))
    throw new AnchorResponseError("Invalid Arweave identifier.");
  const url = new URL(INDEX_URL);
  url.searchParams.set(
    "query",
    `query{transaction(id:"${id}"){id bundledIn{id} block{id height timestamp}}}`,
  );
  return url;
}

function nonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validTimestamp(value: unknown): value is number {
  return nonnegativeInteger(value) && value <= 8_640_000_000_000;
}

function parseIndexedItem(
  value: unknown,
  requestedId: string,
): {
  parent: string | null;
  block: { height: number; blockHash: string; timestamp: number } | null;
} | null {
  if (!isPlainObject(value))
    throw new AnchorResponseError("The bundle index response was malformed.");
  if (
    value.errors !== undefined &&
    (!Array.isArray(value.errors) || value.errors.length > 0)
  ) {
    throw new AnchorResponseError(
      "The bundle index query could not complete.",
      "retryable",
    );
  }
  if (!isPlainObject(value.data))
    throw new AnchorResponseError("The bundle index response was malformed.");
  const item = value.data.transaction;
  if (item === null) return null;
  if (!isPlainObject(item) || item.id !== requestedId)
    throw new AnchorResponseError(
      "The bundle index did not return the requested item.",
    );
  let parent: string | null = null;
  if (item.bundledIn !== null) {
    if (
      !isPlainObject(item.bundledIn) ||
      typeof item.bundledIn.id !== "string" ||
      !isArweaveId(item.bundledIn.id)
    )
      throw new AnchorResponseError(
        "The bundle index returned an unsupported or malformed parent identifier.",
      );
    parent = item.bundledIn.id;
  }
  const b = item.block;
  let block = null;
  if (b !== null) {
    if (
      !isPlainObject(b) ||
      !nonnegativeInteger(b.height) ||
      !isBlockHash(b.id) ||
      !validTimestamp(b.timestamp)
    )
      throw new AnchorResponseError(
        "The bundle index returned malformed block metadata.",
      );
    block = { height: b.height, blockHash: b.id, timestamp: b.timestamp };
  }
  return { parent, block };
}

function isBlockHash(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

async function readBoundedJson(
  response: Response,
  byteLimit: number,
  controller: AbortController,
): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > byteLimit
  ) {
    controller.abort();
    throw new AnchorResponseError(
      "The gateway response exceeded its safety limit.",
    );
  }

  if (!response.body)
    throw new AnchorResponseError("The gateway returned no data.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > byteLimit) {
        void reader.cancel().catch(() => undefined);
        controller.abort();
        throw new AnchorResponseError(
          "The gateway response exceeded its safety limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new AnchorResponseError("The gateway returned invalid JSON.");
  }
}

async function fetchGatewayJsonAttempt(
  url: URL,
  fetcher: FetchLike,
  byteLimit: number,
  headers: Record<string, string> = {},
  deadline = Date.now() + TOTAL_TIMEOUT_MS,
): Promise<GatewayJsonResult> {
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new AnchorResponseError(
      "The chronology check reached its time limit. Try again later.",
      "retryable",
      url.toString(),
    );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(REQUEST_TIMEOUT_MS, remaining),
  );
  try {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: "GET",
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "error",
      });
    } catch {
      throw new AnchorResponseError(
        "The public metadata request timed out or could not complete. The date remains unresolved; no mismatch was established.",
        "retryable",
        url.toString(),
      );
    }
    if (response.url) {
      if (response.url !== url.toString()) {
        throw new AnchorResponseError(
          "The gateway redirected to an unapproved host.",
          "unsupported",
          url.toString(),
        );
      }
    }
    if (response.status === 202 || response.status === 404) {
      await response.body?.cancel();
      return { response, url };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AnchorResponseError(
        `The public metadata gateway returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500
          ? "retryable"
          : "unsupported",
        url.toString(),
        response.status,
      );
    }
    try {
      return {
        response,
        data: await readBoundedJson(response, byteLimit, controller),
        url,
      };
    } catch (error) {
      if (error instanceof AnchorResponseError && !error.source) {
        throw new AnchorResponseError(
          error.message,
          error.status,
          url.toString(),
          error.httpStatus,
        );
      }
      if (error instanceof AnchorResponseError) throw error;
      throw new AnchorResponseError(
        "The public metadata request timed out or could not complete. The date remains unresolved; no mismatch was established.",
        "retryable",
        url.toString(),
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGatewayJson(
  url: URL,
  fetcher: FetchLike,
  byteLimit: number,
  headers: Record<string, string> = {},
  deadline = Date.now() + TOTAL_TIMEOUT_MS,
  fallbackUrl?: URL,
): Promise<GatewayJsonResult> {
  try {
    return await fetchGatewayJsonAttempt(
      url,
      fetcher,
      byteLimit,
      headers,
      deadline,
    );
  } catch (error) {
    if (
      !fallbackUrl ||
      !(error instanceof AnchorResponseError) ||
      error.httpStatus === undefined ||
      (error.httpStatus !== 429 && error.httpStatus < 500)
    ) {
      throw error;
    }
    return fetchGatewayJsonAttempt(
      fallbackUrl,
      fetcher,
      byteLimit,
      headers,
      deadline,
    );
  }
}

function parseStatus(value: unknown): ArweaveStatus {
  if (!isPlainObject(value))
    throw new AnchorResponseError("The transaction status was malformed.");
  const height = value.block_height;
  const hash = value.block_indep_hash;
  const confirmations = value.number_of_confirmations;
  if (
    !Number.isSafeInteger(height) ||
    (height as number) < 0 ||
    !isBlockHash(hash) ||
    !Number.isSafeInteger(confirmations) ||
    (confirmations as number) < 0
  ) {
    throw new AnchorResponseError("The transaction status was malformed.");
  }
  return {
    blockHeight: height as number,
    blockHash: hash,
    confirmations: confirmations as number,
  };
}

function parseBlock(value: unknown): ArweaveBlock {
  if (!isPlainObject(value))
    throw new AnchorResponseError("The Arweave block was malformed.");
  const height = value.height;
  const hash = value.indep_hash;
  const timestamp = value.timestamp;
  const transactions = value.txs;
  if (
    !Number.isSafeInteger(height) ||
    (height as number) < 0 ||
    !isBlockHash(hash) ||
    !validTimestamp(timestamp) ||
    !Array.isArray(transactions) ||
    transactions.length > 100_000 ||
    !transactions.every(isArweaveId)
  ) {
    throw new AnchorResponseError("The Arweave block was malformed.");
  }
  return {
    height: height as number,
    blockHash: hash,
    timestamp: timestamp as number,
    transactionIds: transactions,
  };
}

function retryableCheck(source: string, explanation: string): EvidenceCheck {
  return {
    id: "independent_anchor",
    label: "Arweave chronology check",
    status: "retryable",
    explanation,
    source,
  };
}

function metadataUrl(base: string, path: string): URL {
  return new URL(path, `${base}/`);
}

export async function verifyArweaveChronology(
  record: UceRecord,
  fetcher: FetchLike = fetch,
): Promise<EvidenceCheck> {
  const txId = record.arweaveTxId;
  if (!txId || !isArweaveId(txId)) {
    return {
      id: "independent_anchor",
      label: "Arweave chronology check",
      status: "unsupported",
      explanation:
        "This record does not include an Arweave transaction identifier.",
    };
  }

  const path = [txId];
  const indexedBlocks: {
    height: number;
    blockHash: string;
    timestamp: number;
  }[] = [];
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let source = `${ARWEAVE_GATEWAY}/tx/${txId}/status`;
  try {
    let statusResult;
    for (;;) {
      const current = path[path.length - 1]!;
      const statusPath = `tx/${current}/status`;
      source = metadataUrl(ARWEAVE_GATEWAY, statusPath).toString();
      statusResult = await fetchGatewayJson(
        new URL(source),
        fetcher,
        MAX_STATUS_BYTES,
        {},
        deadline,
        metadataUrl(TURBO_GATEWAY, statusPath),
      );
      source = statusResult.url.toString();
      if (statusResult.response.status !== 404) break;
      source = arweaveIndexUrl(current).toString();
      const indexResult = await fetchGatewayJson(
        new URL(source),
        fetcher,
        MAX_INDEX_BYTES,
        {},
        deadline,
      );
      if (indexResult.response.status !== 200)
        throw new AnchorResponseError(
          "The public bundle index could not complete this lookup.",
          "retryable",
        );
      const item = parseIndexedItem(indexResult.data, current);
      if (!item?.parent)
        throw new AnchorResponseError(
          "The transaction status was not found, and the public index did not identify a parent bundle. Its date remains unresolved; this does not establish that the file is missing.",
          "retryable",
        );
      if (path.includes(item.parent))
        throw new AnchorResponseError(
          "The bundle index returned a cyclic parent relationship.",
        );
      if (path.length > MAX_BUNDLE_DEPTH)
        throw new AnchorResponseError(
          "The bundled item exceeds the supported parent-depth limit.",
        );
      if (item.block) indexedBlocks.push(item.block);
      path.push(item.parent);
    }
    if (statusResult.response.status === 202) {
      return retryableCheck(
        source,
        "The Arweave transaction is pending confirmation. Try this check again later.",
      );
    }
    const status = parseStatus(statusResult.data);
    const rootId = path[path.length - 1]!;
    const blockPath = `block/hash/${status.blockHash}`;
    source = metadataUrl(ARWEAVE_GATEWAY, blockPath).toString();
    const blockResult = await fetchGatewayJson(
      new URL(source),
      fetcher,
      MAX_BLOCK_BYTES,
      { "X-Block-Format": "2" },
      deadline,
      metadataUrl(TURBO_GATEWAY, blockPath),
    );
    source = blockResult.url.toString();
    if (blockResult.response.status !== 200)
      throw new AnchorResponseError(
        "The confirmed transaction's block metadata is not currently available.",
        "retryable",
      );
    const block = parseBlock(blockResult.data);

    if (
      block.height !== status.blockHeight ||
      block.blockHash !== status.blockHash ||
      !block.transactionIds.includes(rootId)
    ) {
      return {
        id: "independent_anchor",
        label: "Arweave chronology check",
        status: "mismatch",
        explanation:
          "The retrieved transaction status and block metadata do not bind this transaction to the same Arweave block.",
        source,
      };
    }

    if (
      indexedBlocks.some(
        (b) =>
          b.height !== block.height ||
          b.blockHash !== block.blockHash ||
          b.timestamp !== block.timestamp,
      )
    ) {
      throw new AnchorResponseError(
        "The gateway's indexed item date or block conflicts with the parent transaction's retrieved block metadata.",
        "mismatch",
      );
    }

    const reportedTimestamp = record.reportedArweaveBlockTimestamp
      ? Date.parse(record.reportedArweaveBlockTimestamp)
      : undefined;
    const timestampMismatch =
      reportedTimestamp !== undefined &&
      (!Number.isFinite(reportedTimestamp) ||
        Math.floor(reportedTimestamp / 1000) !== block.timestamp);
    const heightMismatch =
      record.reportedArweaveBlockHeight !== undefined &&
      record.reportedArweaveBlockHeight !== block.height;
    if (timestampMismatch || heightMismatch) {
      return {
        id: "independent_anchor",
        label: "Arweave chronology check",
        status: "mismatch",
        explanation:
          "Arweave confirmed the transaction, but its public block height or timestamp differs from the value reported by the publisher.",
        source,
      };
    }

    const bundled = path.length > 1;
    const iso = new Date(block.timestamp * 1000).toISOString();
    return {
      id: "independent_anchor",
      label: bundled
        ? "Bundled item date reported"
        : "Arweave transaction confirmed",
      status: bundled ? "reported" : "verified",
      explanation: bundled
        ? `The public gateway index reports this item inside a parent bundle anchored in block ${block.height.toLocaleString()} at ${iso}. The root transaction's status and block membership were checked. The item-to-bundle relationship is gateway-reported; cryptographic bundle inclusion and original file bytes were not checked. This is a block timestamp, not a proven creation date or exact upload time.`
        : `A public Arweave gateway bound this transaction to block ${block.height.toLocaleString()} at ${iso} (${status.confirmations.toLocaleString()} confirmation${status.confirmations === 1 ? "" : "s"}).`,
      source,
      chronologyProvenance: {
        referenceType: bundled ? "bundled_item" : "transaction",
        transactionId: txId,
        rootTransactionId: rootId,
        parentPath: path,
        block: { height: block.height, hash: block.blockHash, timestamp: iso },
        statusSource: statusResult.url.toString(),
        blockSource: blockResult.url.toString(),
        relationship: bundled ? "gateway_index" : "direct_block_membership",
        ...(bundled ? { indexSource: arweaveIndexUrl(txId).toString() } : {}),
      },
    };
  } catch (error) {
    return {
      id: "independent_anchor",
      label: "Arweave chronology check",
      source:
        error instanceof AnchorResponseError && error.source
          ? error.source
          : source,
      status: error instanceof AnchorResponseError ? error.status : "retryable",
      explanation:
        error instanceof AnchorResponseError
          ? error.message
          : "The public metadata request timed out or could not complete. The date remains unresolved; no mismatch was established.",
    };
  }
}

/** File dates use only the explicit file anchor and never inherit manifest dates. */
export async function verifyFileArweaveChronology(
  record: UceRecord,
  fetcher: FetchLike = fetch,
  verifier: (
    record: UceRecord,
    fetcher: FetchLike,
  ) => Promise<EvidenceCheck> = verifyArweaveChronology,
): Promise<EvidenceCheck> {
  const anchors = record.publicManifest?.anchors;
  const file = isPlainObject(anchors) ? anchors.fileStorage : undefined;
  if (
    !isPlainObject(file) ||
    file.provider !== "arweave" ||
    typeof file.txId !== "string" ||
    !isArweaveId(file.txId)
  ) {
    return {
      id: "file_anchor",
      label: "File transaction chronology",
      status: "unsupported",
      explanation:
        "No supported explicit Arweave file-storage identifier is recorded. Audit events and arbitrary URLs are not substituted for it.",
    };
  }
  const fileRecord = { ...record, arweaveTxId: file.txId };
  delete fileRecord.reportedArweaveBlockTimestamp;
  delete fileRecord.reportedArweaveBlockHeight;
  const result = await verifier(fileRecord, fetcher);
  return { ...result, id: "file_anchor", label: "File transaction chronology" };
}
