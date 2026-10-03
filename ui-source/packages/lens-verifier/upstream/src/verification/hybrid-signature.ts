import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import type { EvidenceCheck, UceRecord } from "../types/record";
import { retainBoundedPublicManifest } from "../records/manifest-compatibility";
import { isPlainObject } from "../security/untrusted";
import {
  TRUSTED_PLATFORM_KEYS,
  type TrustedPlatformKey,
} from "../security/trusted-platform-keys";
import {
  TRUSTED_QUANTUM_KEYS,
  type TrustedQuantumKey,
} from "../security/trusted-quantum-keys";
import {
  hexToBytes,
  isExtendedHeader,
  readProtectedHeader,
  sha256Bytes,
  verifyEs256ManifestSignature,
} from "./crypto";

// A reviewed key and synthetic interoperability tests do not replace a real
// publisher-issued positive fixture. Only a reviewed release changes this list.
export const QUALIFIED_HYBRID_VERSIONS: readonly string[] = Object.freeze([]);
export const HYBRID_QUALIFICATION_LIMIT =
  "Hybrid ES256 + ML-DSA-65 verification is implemented and tested locally, but this format is not release-qualified until a real publisher-issued public record passes paired verification. No hybrid verification pass is claimed.";

function object(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value))
    throw new Error("Malformed hybrid signature object.");
  return value;
}

/** Strict, padded RFC 4648 standard base64, with canonical pad bits. */
export function decodeHybridBase64(value: unknown, bytes: number): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length !== Math.ceil(bytes / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error("Malformed hybrid signature or public-key encoding.");
  const binary = atob(value);
  if (binary.length !== bytes || btoa(binary) !== value)
    throw new Error("Non-canonical hybrid signature or public-key encoding.");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Local cryptographic engine. UI/agent activation is separately release-gated.
 * Registry arguments are for offline tests, NEVER data from a manifest/tool.
 * Both primitives must verify the same 32-byte recorded digest. Key refs and
 * libraryVersion are unsigned hints; they never select code, fetches or trust.
 */
export async function verifyHybridManifestSignatures(
  record: UceRecord,
  classicalRegistry: readonly TrustedPlatformKey[] = TRUSTED_PLATFORM_KEYS,
  quantumRegistry: readonly TrustedQuantumKey[] = TRUSTED_QUANTUM_KEYS,
): Promise<EvidenceCheck> {
  const base = {
    id: "platform_signature",
    label: "Platform hybrid ES256 + ML-DSA-65 signatures",
    source: record.source,
  };
  let classical: Record<string, unknown>;
  let quantum: Record<string, unknown>;
  let header: Record<string, unknown>;
  let jws: string;
  const extended = record.schemaVersion === "2.1.0";
  try {
    const raw = retainBoundedPublicManifest(record.publicManifest);
    if (
      !["2.0.0", "2.1.0"].includes(record.schemaVersion) ||
      raw.schema !== "uce.evidence.manifest" ||
      raw.schema !== record.schema ||
      raw.schemaVersion !== record.schemaVersion ||
      object(raw.hashes).manifestHash !== record.manifestHash ||
      !/^[a-f0-9]{64}$/.test(record.manifestHash) ||
      Object.hasOwn(object(raw.hashes), "profile")
    )
      throw new Error("Unsupported or inconsistent hybrid manifest contract.");
    const signatures = object(raw.signatures);
    if (
      ["platformSignature", "platformKeyKid", "platformPublicKeyRef"].some(
        (key) => Object.hasOwn(signatures, key),
      )
    )
      throw new Error(
        "Mixed flat and hybrid signature shapes are not supported.",
      );
    classical = object(signatures.classical);
    quantum = object(signatures.postQuantum);
    if (
      classical.algorithm !== "ES256" ||
      quantum.algorithm !== "ML-DSA-65" ||
      typeof classical.jws !== "string" ||
      classical.jws.length > 2000
    )
      throw new Error("Unsupported hybrid algorithms or JWS shape.");
    jws = classical.jws;
    header = readProtectedHeader(jws);
    if (
      extended
        ? !isExtendedHeader(header) ||
          object(raw.recordDetails).format !== "extended-v1"
        : Object.hasOwn(raw, "recordDetails") ||
          header.crit !== undefined ||
          header.uceRecordFormat !== undefined ||
          header.b64 !== undefined
    )
      throw new Error("Unsupported or downgraded hybrid signature profile.");
    if (
      header.alg !== "ES256" ||
      header.typ !== "JWS" ||
      (header.kid !== undefined &&
        (typeof header.kid !== "string" || !header.kid.length)) ||
      (extended && typeof header.kid !== "string")
    )
      throw new Error(
        "An unsupported ES256 protected key identifier was supplied.",
      );
    const allowed = extended
      ? ["alg", "typ", "kid", "crit", "uceRecordFormat"]
      : ["alg", "typ", "kid"];
    if (Object.keys(header).some((key) => !allowed.includes(key)))
      throw new Error("Unreviewed protected hybrid header.");
  } catch (error) {
    return {
      ...base,
      status: "unsupported",
      explanation:
        error instanceof Error ? error.message : "Unsupported hybrid input.",
    };
  }

  const components: NonNullable<EvidenceCheck["signatureComponents"]> = [];
  // Kidless standard issuance is only accepted with exactly one reviewed key.
  // A manifest's unsigned key hint cannot break a registry ambiguity.
  const candidates =
    header.kid === undefined
      ? classicalRegistry
      : classicalRegistry.filter(
          (key) =>
            key.kid === header.kid ||
            `urn:ietf:params:oauth:jwk-thumbprint:sha-256:${key.jwkThumbprint}` ===
              header.kid,
        );
  if (classicalRegistry.length > 64 || candidates.length !== 1) {
    components.push({
      algorithm: "ES256",
      status: "unsupported",
      explanation:
        "No unique reviewed classical key matches the protected identifier.",
    });
  } else {
    const key = candidates[0]!;
    const result =
      key.status === "revoked"
        ? {
            status: "mismatch" as const,
            explanation: "The classical signing key is revoked.",
          }
        : await verifyEs256ManifestSignature(
            jws,
            record.manifestHash,
            header.kid as string | undefined,
            [
              {
                ...key.jwk,
                kid: (header.kid as string | undefined) ?? key.kid,
              },
            ],
            extended ? "extended-v1" : "standard",
            header.kid === undefined,
          );
    components.push({
      algorithm: "ES256",
      status: result.status,
      explanation: result.explanation,
      keyId: key.kid,
      keyFingerprint: key.jwkThumbprint,
      publicKeySource: key.publicKeySource,
      reviewedAt: key.verifiedAt,
    });
  }

  let signature: Uint8Array | undefined;
  try {
    signature = decodeHybridBase64(quantum.signature, 3309);
  } catch {
    components.push({
      algorithm: "ML-DSA-65",
      status: "mismatch",
      explanation:
        "The required ML-DSA-65 signature is missing, malformed or non-canonical.",
    });
  }
  if (signature)
    try {
      const digest = hexToBytes(record.manifestHash);
      if (!quantumRegistry.length || quantumRegistry.length > 64)
        throw new Error(
          "No bounded reviewed ML-DSA-65 key registry is available.",
        );
      let matched: TrustedQuantumKey | undefined;
      for (const key of quantumRegistry) {
        const publicKey = decodeHybridBase64(key.publicKeyBase64, 1952);
        if (
          (await sha256Bytes(new Uint8Array(publicKey).buffer)) !== key.sha256
        )
          throw new Error(
            "Pinned post-quantum public-key fingerprint mismatch.",
          );
        // 0.7.1 argument order: signature, message, publicKey. Empty context;
        // no prehash or external-mu mode. 0.4.1 publisher interop is tested.
        if (ml_dsa65.verify(signature, digest, publicKey)) {
          if (matched) throw new Error("Ambiguous post-quantum key registry.");
          matched = key;
        }
      }
      components.push({
        algorithm: "ML-DSA-65",
        status: matched?.status === "active" ? "verified" : "mismatch",
        explanation:
          matched?.status === "active"
            ? "The reviewed ML-DSA-65 public key validated the signature over the recorded 32-byte manifest hash."
            : matched
              ? "The matching post-quantum key is revoked."
              : "No reviewed ML-DSA-65 key validates this signature.",
        ...(matched
          ? {
              keyId: matched.kid,
              keyFingerprint: matched.sha256,
              publicKeySource: matched.publicKeySource,
              reviewedAt: matched.reviewedAt,
            }
          : {}),
      });
    } catch (error) {
      components.push({
        algorithm: "ML-DSA-65",
        status: "unsupported",
        explanation:
          error instanceof Error
            ? error.message
            : "Post-quantum verification could not be completed.",
      });
    }
  const status = components.some((part) => part.status === "mismatch")
    ? "mismatch"
    : components.every((part) => part.status === "verified")
      ? "verified"
      : "unsupported";
  return {
    ...base,
    status,
    signatureComponents: components,
    explanation:
      status === "verified"
        ? "Both reviewed platform keys independently validated ES256 and ML-DSA-65 signatures over the same recorded manifest hash. The separate hash-recomputation check determines covered-content integrity."
        : status === "mismatch"
          ? "At least one required hybrid signature did not validate. A pass from the other algorithm cannot substitute for it."
          : "Both required hybrid signatures could not be verified. No hybrid signature pass is claimed.",
  };
}
