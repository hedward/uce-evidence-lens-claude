import { ValidationError, isPlainObject } from "../security/untrusted";

export type RecognizedManifestVersion = "1.0.0" | "1.1.0" | "2.0.0" | "2.1.0";

export type LocalSignatureVerificationCapability =
  | "supported_flat_es256_only"
  | "supported_extended_es256"
  | "unsupported_hybrid"
  | "unsupported_hybrid_extended_critical";

export interface ManifestCompatibilityCapability {
  readable: true;
  profile: "standard" | "extended-v1";
  signatureShape: "flat-es256" | "hybrid-es256-ml-dsa-65";
  localSignatureVerification: LocalSignatureVerificationCapability;
  independentHashRecomputation: boolean;
  displayNote: string;
}

export const MANIFEST_COMPATIBILITY: Readonly<
  Record<RecognizedManifestVersion, ManifestCompatibilityCapability>
> = Object.freeze({
  "1.0.0": Object.freeze({
    readable: true,
    profile: "standard",
    signatureShape: "flat-es256",
    localSignatureVerification: "supported_flat_es256_only",
    independentHashRecomputation: true,
    displayNote:
      "CbyUCE manifest 1.0.0 supports positive-only Standard recomputation when its public projection reproduces the digest. Coverage is narrow: work/title, rights policy, AI disclosures and file names are excluded. Historical non-matches remain unresolved, not tampering verdicts.",
  }),
  "1.1.0": Object.freeze({
    readable: true,
    profile: "extended-v1",
    signatureShape: "flat-es256",
    localSignatureVerification: "supported_extended_es256",
    independentHashRecomputation: true,
    displayNote:
      "CbyUCE manifest 1.1.0 supports independent Extended-profile recomputation and critical-profile ES256 verification when its input and trusted key match the reviewed contract. Coverage excludes audit and manifest anchoring fields; assertions remain claims.",
  }),
  "2.0.0": Object.freeze({
    readable: true,
    profile: "standard",
    signatureShape: "hybrid-es256-ml-dsa-65",
    localSignatureVerification: "unsupported_hybrid",
    independentHashRecomputation: false,
    displayNote:
      "CbyUCE manifest 2.0.0 is readable. Hybrid verification is implemented locally but awaits real publisher-issued qualification records; no runtime hybrid or hash pass is claimed.",
  }),
  "2.1.0": Object.freeze({
    readable: true,
    profile: "extended-v1",
    signatureShape: "hybrid-es256-ml-dsa-65",
    localSignatureVerification: "unsupported_hybrid_extended_critical",
    independentHashRecomputation: false,
    displayNote:
      "CbyUCE manifest 2.1.0 is readable. Hybrid verification and its Extended hash projection are implemented locally but await real publisher-issued qualification records; no runtime hybrid or hash pass is claimed.",
  }),
});

// A version match is necessary but not sufficient for local signature
// verification. Callers must also reject unknown/critical protected headers.
export const SIGNATURE_VERIFICATION_VERSIONS: readonly RecognizedManifestVersion[] =
  Object.freeze(["1.0.0", "1.1.0"]);

// Standard is positive-only; no historical timestamp recovery or recipe search.
export const HASH_RECOMPUTATION_VERSIONS: readonly RecognizedManifestVersion[] =
  Object.freeze(["1.0.0", "1.1.0"]);

export function recognizedManifestVersion(
  value: string,
): RecognizedManifestVersion | undefined {
  return Object.prototype.hasOwnProperty.call(MANIFEST_COMPATIBILITY, value)
    ? (value as RecognizedManifestVersion)
    : undefined;
}

const MAX_PUBLIC_MANIFEST_UTF8_BYTES = 256 * 1024;
const MAX_PUBLIC_MANIFEST_DEPTH = 16;
const MAX_PUBLIC_MANIFEST_ARRAY_ITEMS = 100;
const MAX_PUBLIC_MANIFEST_OBJECT_KEYS = 150;
const MAX_PUBLIC_MANIFEST_NODES = 5_000;
const MAX_PUBLIC_MANIFEST_STRING_CHARS = 65_536;

function validUnicode(value: string): boolean {
  return !Array.from(value).some(
    (unit) =>
      unit.length === 1 &&
      unit.charCodeAt(0) >= 0xd800 &&
      unit.charCodeAt(0) <= 0xdfff,
  );
}

/**
 * Validate and detach the complete public manifest before deriving a smaller
 * display projection. Unknown JSON fields are retained for future profile
 * review, but executable/non-JSON values and resource-exhaustion shapes fail.
 */
export function retainBoundedPublicManifest(
  value: unknown,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new ValidationError("manifest must be a JSON object.");
  }

  let nodes = 0;
  const inspect = (candidate: unknown, depth: number, label: string): void => {
    nodes += 1;
    if (
      nodes > MAX_PUBLIC_MANIFEST_NODES ||
      depth > MAX_PUBLIC_MANIFEST_DEPTH
    ) {
      throw new ValidationError(
        "Manifest exceeds the safe public manifest limit.",
      );
    }
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      typeof candidate === "string"
    ) {
      if (
        typeof candidate === "string" &&
        (candidate.length > MAX_PUBLIC_MANIFEST_STRING_CHARS ||
          !validUnicode(candidate))
      ) {
        throw new ValidationError(
          `${label} exceeds the safe public manifest limit.`,
        );
      }
      return;
    }
    if (typeof candidate === "number") {
      if (
        !Number.isFinite(candidate) ||
        (Number.isInteger(candidate) && !Number.isSafeInteger(candidate))
      ) {
        throw new ValidationError(`${label} must be a finite JSON number.`);
      }
      return;
    }
    if (Array.isArray(candidate)) {
      if (candidate.length > MAX_PUBLIC_MANIFEST_ARRAY_ITEMS) {
        throw new ValidationError(
          `${label} exceeds the safe public manifest limit.`,
        );
      }
      for (let index = 0; index < candidate.length; index++) {
        if (!Object.hasOwn(candidate, index))
          throw new ValidationError("Sparse arrays are not JSON.");
        inspect(candidate[index], depth + 1, `${label}[${index}]`);
      }
      return;
    }
    if (isPlainObject(candidate)) {
      const keys = Object.keys(candidate);
      if (keys.length > MAX_PUBLIC_MANIFEST_OBJECT_KEYS) {
        throw new ValidationError(
          `${label} exceeds the safe public manifest limit.`,
        );
      }
      for (const key of keys) {
        if (
          !validUnicode(key) ||
          ["__proto__", "constructor", "prototype"].includes(key)
        )
          throw new ValidationError("Unsupported public object field name.");
        if (candidate[key] === undefined) {
          throw new ValidationError(`${label}.${key} is not a JSON value.`);
        }
        inspect(candidate[key], depth + 1, `${label}.${key}`);
      }
      return;
    }
    throw new ValidationError(`${label} is not a JSON value.`);
  };

  inspect(value, 0, "manifest");
  const serialized = JSON.stringify(value);
  if (
    new TextEncoder().encode(serialized).byteLength >
    MAX_PUBLIC_MANIFEST_UTF8_BYTES
  ) {
    throw new ValidationError(
      "Manifest exceeds the safe public manifest limit.",
    );
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}
