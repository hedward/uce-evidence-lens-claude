import { retainBoundedPublicManifest } from "../records/manifest-compatibility";
import { isPlainObject } from "../security/untrusted";

export const STANDARD_HASH_COVERAGE =
  "Recomputation covers the recorded schema/version, optional complete source, one file's byte count and SHA-256 digest, Merkle root, identity assurance and its exact recorded timestamp, and complete attestations. It excludes work, policy, AI disclosures, file names and other descriptors, generation fields, hybrid metadata, audit events, actual signatures and anchors, the manifest's own hash, and other unlisted fields. A match does not establish authorship, ownership, the truth of assertions, or hybrid signature validity.";

function object(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value))
    throw new Error(`${label} must be a public object.`);
  return value;
}

function validUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function arrayIndex(key: string): boolean {
  const value = Number(key);
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value < 4294967295 &&
    String(value) === key
  );
}

/** The publisher's historical sort-then-object serializer, not strict JCS. */
export function canonicalStandardJson(value: unknown): string {
  const seen = new Set<object>();
  const write = (item: unknown, depth: number): string => {
    if (depth > 40) throw new Error("Standard hash input is too deep.");
    if (typeof item === "string") {
      if (!validUnicode(item))
        throw new Error("Invalid Unicode in hash input.");
      return JSON.stringify(item);
    }
    if (item === null || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (
        !Number.isFinite(item) ||
        (Number.isInteger(item) && !Number.isSafeInteger(item))
      )
        throw new Error("Unsafe number in hash input.");
      return JSON.stringify(item);
    }
    if (typeof item !== "object" || seen.has(item))
      throw new Error("Non-JSON or repeated value in hash input.");
    seen.add(item);
    if (Array.isArray(item)) {
      const values: string[] = [];
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index))
          throw new Error("Sparse hash input array.");
        values.push(write(item[index], depth + 1));
      }
      return `[${values.join(",")}]`;
    }
    const entry = object(item, "Hash input");
    const keys = Object.keys(entry).sort();
    for (const key of keys) {
      if (
        !validUnicode(key) ||
        ["__proto__", "constructor", "prototype"].includes(key)
      )
        throw new Error("Unsupported hash input key.");
    }
    const ordered = [
      ...keys
        .filter(arrayIndex)
        .sort((left, right) => Number(left) - Number(right)),
      ...keys.filter((key) => !arrayIndex(key)),
    ];
    return `{${ordered
      .map((key) => `${JSON.stringify(key)}:${write(entry[key], depth + 1)}`)
      .join(",")}}`;
  };
  return write(value, 0);
}

/** Build only the reviewed standard 1.0/2.0 preliminary hash input. */
export function standardHashInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const manifest = retainBoundedPublicManifest(raw);
  const hashes = object(manifest.hashes, "hashes");
  if (
    manifest.schema !== "uce.evidence.manifest" ||
    (manifest.schemaVersion !== "1.0.0" &&
      manifest.schemaVersion !== "2.0.0") ||
    hashes.algorithm !== "sha256" ||
    hashes.canonicalization !== "RFC8785" ||
    Object.hasOwn(hashes, "profile") ||
    Object.hasOwn(manifest, "recordDetails") ||
    typeof hashes.merkleRoot !== "string" ||
    !/^[a-f0-9]{64}$/.test(hashes.merkleRoot)
  ) {
    throw new Error(
      "This manifest does not match the reviewed Standard hash input.",
    );
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== 1)
    throw new Error("Standard hash input requires exactly one recorded file.");
  const file = object(manifest.files[0], "files[0]");
  if (
    !Number.isSafeInteger(file.bytes) ||
    (file.bytes as number) < 0 ||
    typeof file.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  ) {
    throw new Error("The recorded file digest or size is unsupported.");
  }
  const assurance = object(
    object(manifest.identity, "identity").assurance,
    "identity.assurance",
  );
  if (
    assurance.level !== "IAL1" ||
    !Array.isArray(assurance.methods) ||
    assurance.methods.length !== 1 ||
    typeof assurance.methods[0] !== "string" ||
    assurance.methods[0].length === 0 ||
    typeof assurance.verifiedAt !== "string" ||
    assurance.verifiedAt.length === 0
  ) {
    throw new Error("Original standard identity hash input is unavailable.");
  }
  const attestations = object(manifest.attestations, "attestations");
  const result: Record<string, unknown> = {
    schema: manifest.schema,
    schemaVersion: manifest.schemaVersion,
  };
  if (Object.hasOwn(manifest, "source"))
    result.source = object(manifest.source, "source");
  result.files = [{ bytes: file.bytes, sha256: file.sha256 }];
  result.hashes = {
    merkleRoot: hashes.merkleRoot,
    algorithm: "sha256",
    canonicalization: "RFC8785",
  };
  result.identity = {
    assurance: {
      level: "IAL1",
      methods: assurance.methods,
      verifiedAt: assurance.verifiedAt,
    },
  };
  result.anchors = { arweave: { txId: "" } };
  result.audit = [];
  result.attestations = attestations;
  result.signatures = {
    platformSignature: "",
    platformPublicKeyRef: "dev-platform-key",
  };
  return result;
}
