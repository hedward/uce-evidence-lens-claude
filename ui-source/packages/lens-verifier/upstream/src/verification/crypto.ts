import type {
  EvidenceCheck,
  LocalFileDigest,
  PublicJwk,
} from "../types/record";
import { parseStrictJson } from "../security/strict-json";
import { isPlainObject } from "../security/untrusted";

const MAX_LOCAL_FILE_BYTES = 512 * 1024 * 1024;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0)
    throw new Error("Invalid hexadecimal input.");
  const output = new Uint8Array(hex.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

export function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value))
    throw new Error("Invalid base64url input.");
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function sha256Bytes(data: BufferSource): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashLocalFile(file: File): Promise<LocalFileDigest> {
  if (file.size > MAX_LOCAL_FILE_BYTES) {
    throw new Error(
      "This browser-only demo limits local hashing to 512 MB to avoid exhausting memory.",
    );
  }
  const bytes = await file.arrayBuffer();
  return {
    name: file.name,
    bytes: file.size,
    sha256: await sha256Bytes(bytes),
    computedAt: new Date().toISOString(),
  };
}

export function readProtectedHeader(
  compactJws: string,
): Record<string, unknown> {
  const encoded = compactJws.split(".")[0];
  if (!encoded || encoded.length > 8192) throw new Error("Invalid JWS header.");
  const header = parseStrictJson(
    new TextDecoder("utf-8", { fatal: true }).decode(base64UrlToBytes(encoded)),
    { maxChars: 8192 },
  );
  if (!isPlainObject(header)) throw new Error("Invalid JWS header.");
  return header;
}

export function isExtendedHeader(header: Record<string, unknown>): boolean {
  return (
    header.alg === "ES256" &&
    typeof header.kid === "string" &&
    header.typ === "JWS" &&
    header.uceRecordFormat === "extended-v1" &&
    Array.isArray(header.crit) &&
    header.crit.length === 1 &&
    header.crit[0] === "uceRecordFormat" &&
    Object.keys(header).every((key) =>
      ["alg", "kid", "typ", "uceRecordFormat", "crit"].includes(key),
    )
  );
}

export async function verifyEs256ManifestSignature(
  compactJws: string,
  expectedManifestHash: string,
  expectedKid: string | undefined,
  keys: PublicJwk[],
  profile: "standard" | "extended-v1" = "standard",
  allowKidlessStandard = false,
): Promise<EvidenceCheck> {
  const parts = compactJws.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return {
      id: "platform_signature",
      label: "Platform ES256 signature",
      status: "mismatch",
      explanation: "The compact JWS is malformed.",
    };
  }
  try {
    const header = readProtectedHeader(compactJws);
    // Do not downgrade extended records or ignore critical JWS semantics.
    // A profile must be implemented explicitly before its signature can pass.
    if (
      profile === "extended-v1"
        ? !isExtendedHeader(header)
        : header.crit !== undefined ||
          header.uceRecordFormat !== undefined ||
          header.b64 !== undefined
    ) {
      return {
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: "unsupported",
        explanation:
          "This signature declares an extension that this Lens build does not verify. Its critical or payload-encoding requirements must not be ignored.",
      };
    }
    const kidless =
      allowKidlessStandard &&
      profile === "standard" &&
      header.kid === undefined &&
      expectedKid === undefined &&
      keys.length === 1;
    if (
      header.alg !== "ES256" ||
      (!kidless && typeof header.kid !== "string")
    ) {
      return {
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: "mismatch",
        explanation:
          "The JWS header does not declare a supported ES256 key identifier.",
      };
    }
    if (expectedKid && header.kid !== expectedKid) {
      return {
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: "mismatch",
        explanation:
          "The JWS key identifier does not match the record's public-key identifier.",
      };
    }
    const signedDigest = bytesToHex(base64UrlToBytes(parts[1]));
    if (signedDigest !== expectedManifestHash.toLowerCase()) {
      return {
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: "mismatch",
        explanation:
          "The signed payload is not the record's 32-byte manifest hash.",
      };
    }
    const jwk = keys.find(
      (candidate) =>
        (kidless || candidate.kid === header.kid) &&
        candidate.kty === "EC" &&
        candidate.crv === "P-256" &&
        candidate.alg === "ES256" &&
        candidate.use === "sig",
    );
    if (!jwk) {
      return {
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: "unsupported",
        explanation:
          "No matching trusted public P-256 key was found in the platform-key registry.",
      };
    }
    const publicKey = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signingInput = new globalThis.TextEncoder().encode(
      `${parts[0]}.${parts[1]}`,
    );
    const signature = base64UrlToBytes(parts[2]);
    const valid = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      ownedBuffer(signature),
      signingInput,
    );
    return {
      id: "platform_signature",
      label: "Platform ES256 signature",
      status: valid ? "verified" : "mismatch",
      explanation: valid
        ? "The trusted public key validated the ES256 signature over the recorded manifest hash."
        : "The trusted public key did not validate the ES256 signature.",
    };
  } catch {
    return {
      id: "platform_signature",
      label: "Platform ES256 signature",
      status: "mismatch",
      explanation:
        "The signature or public-key material could not be decoded or verified.",
    };
  }
}
