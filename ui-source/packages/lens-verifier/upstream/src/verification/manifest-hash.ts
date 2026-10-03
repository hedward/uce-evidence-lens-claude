import type { EvidenceCheck, UceRecord } from "../types/record";
import { isPlainObject } from "../security/untrusted";
import { retainBoundedPublicManifest } from "../records/manifest-compatibility";
import { isExtendedHeader, readProtectedHeader, sha256Bytes } from "./crypto";
import {
  STANDARD_HASH_COVERAGE,
  canonicalStandardJson,
  standardHashInput,
} from "./standard-hash";
import {
  QUALIFIED_HYBRID_VERSIONS,
  HYBRID_QUALIFICATION_LIMIT,
} from "./hybrid-signature";

// Local reviewed compatibility identifier, NOT a new field on immutable records.
export const EXTENDED_HASH_PROFILE = "cbyuce-extended-1.1-81abec26";
export const EXTENDED_HASH_COVERAGE =
  "Recomputation covers the recorded work, file descriptors, identity assertions, attestations, policy, AI disclosures, extended details, generation fields, optional metadata/source, Merkle root and file-storage anchor. It excludes signatures, audit events, the manifest's own hash, its Arweave anchor and other unlisted top-level fields. A hash match does not establish authorship, ownership or the truth of assertions.";

const copiedFields = [
  "schema",
  "schemaVersion",
  "manifestVersion",
  "registrationTimestamp",
  "generatedBy",
  "files",
  "identity",
  "attestations",
  "work",
  "policy",
  "aiProvenance",
  "recordDetails",
] as const;

function object(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value))
    throw new Error("A required public object is missing or malformed.");
  return value;
}

/** Emit lexical keys directly; rebuilding a JS object reorders integer keys. */
export function canonicalExtendedJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const result = JSON.stringify(value);
    if (result === undefined) throw new Error("Not a JSON value.");
    return result;
  }
  if (Array.isArray(value))
    return `[${value.map(canonicalExtendedJson).join(",")}]`;
  const item = object(value);
  return `{${Object.keys(item)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalExtendedJson(item[key])}`)
    .join(",")}}`;
}

/** Independent implementation of the reviewed public 1.1/2.1 projection. */
export function extendedHashInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const manifest = retainBoundedPublicManifest(raw);
  const hashes = object(manifest.hashes);
  if (
    manifest.schema !== "uce.evidence.manifest" ||
    !["1.1.0", "2.1.0"].includes(String(manifest.schemaVersion)) ||
    manifest.manifestVersion !== 1 ||
    hashes.algorithm !== "sha256" ||
    hashes.canonicalization !== "RFC8785" ||
    Object.hasOwn(hashes, "profile") ||
    typeof hashes.merkleRoot !== "string" ||
    !/^[a-f0-9]{64}$/.test(hashes.merkleRoot)
  ) {
    throw new Error(
      "This manifest does not match the reviewed Extended hash contract.",
    );
  }
  const details = object(manifest.recordDetails);
  if (details.format !== "extended-v1")
    throw new Error("Unsupported Extended format marker.");
  const result: Record<string, unknown> = {};
  for (const key of copiedFields) {
    if (!Object.hasOwn(manifest, key))
      throw new Error(`Missing required hash input: ${key}.`);
    result[key] = manifest[key];
  }
  for (const key of [
    "generatedBy",
    "identity",
    "attestations",
    "work",
    "policy",
    "aiProvenance",
  ])
    object(manifest[key]);
  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    typeof manifest.registrationTimestamp !== "string"
  )
    throw new Error("Missing required file or registration input.");
  for (const key of ["metadata", "source"]) {
    if (Object.hasOwn(manifest, key)) result[key] = object(manifest[key]);
  }
  result.hashes = {
    merkleRoot: hashes.merkleRoot,
    algorithm: "sha256",
    canonicalization: "RFC8785",
  };
  const anchors = object(manifest.anchors);
  result.anchors = Object.hasOwn(anchors, "fileStorage")
    ? { fileStorage: object(anchors.fileStorage) }
    : {};
  return result;
}

// Public license labels are contract data, not a legal interpretation.
const licenseLabels: Record<string, string> = {
  all_rights_reserved: "All Rights Reserved",
  cc_by: "Creative Commons Attribution (CC BY)",
  cc_by_sa: "CC Attribution ShareAlike (CC BY-SA)",
  cc_by_nc: "CC Attribution NonCommercial (CC BY-NC)",
  cc_by_nd: "CC Attribution NoDerivatives (CC BY-ND)",
  cc_by_nc_sa: "CC Attribution NonCommercial ShareAlike (CC BY-NC-SA)",
  cc_by_nc_nd: "CC Attribution NonCommercial NoDerivatives (CC BY-NC-ND)",
  cc0: "CC0 — No Rights Reserved",
  public_domain: "Public Domain",
  mpl_2_0: "Mozilla Public License 2.0 (MPL-2.0)",
  mit: "MIT License (MIT)",
  apache_2_0: "Apache License 2.0 (Apache-2.0)",
  bsd_3_clause: "BSD 3-Clause License (BSD-3-Clause)",
  gpl_3_0_only: "GNU General Public License v3.0 only (GPL-3.0-only)",
  lgpl_3_0_only: "GNU Lesser General Public License v3.0 only (LGPL-3.0-only)",
  agpl_3_0_only: "GNU Affero General Public License v3.0 only (AGPL-3.0-only)",
  isc: "ISC License (ISC)",
};

const textFields = new Set([
  "title",
  "authorName",
  "creationDate",
  "publicationDate",
  "creationMode",
  "workCategory",
  "employerName",
  "citizenshipCountry",
  "domicileCountry",
  "rightsDeclaration",
  "rightsDeclarationDetails",
  "ownershipBasis",
  "authorityDetails",
  "preexistingMaterial",
  "newMaterial",
  "aiCreativeProcess",
  "extendedRecordDetails",
]);
const booleanFields = new Set([
  "isPublished",
  "isWorkMadeForHire",
  "isAIAssisted",
]);
const cleanText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;

/** Validate the publisher's normalized public detail shape; never normalize to fit it. */
export function validateExtendedDetails(
  manifest: Record<string, unknown>,
): void {
  const details = object(manifest.recordDetails);
  const copyright = object(details.copyright);
  if (
    Object.keys(details).sort().join(",") !== "copyright,format,license" ||
    details.format !== "extended-v1" ||
    typeof copyright.isWorkMadeForHire !== "boolean" ||
    new TextEncoder().encode(canonicalExtendedJson(details)).byteLength > 65536
  ) {
    throw new Error("Extended details do not match the reviewed public shape.");
  }
  for (const [key, value] of Object.entries(copyright)) {
    if (textFields.has(key)) {
      if (!cleanText(value))
        throw new Error(
          "Extended text is not in the publisher's normalized form.",
        );
    } else if (booleanFields.has(key)) {
      if (typeof value !== "boolean")
        throw new Error("Extended flag is not boolean.");
    } else if (key === "alternativeTitles" || key === "authorPseudonyms") {
      if (!Array.isArray(value) || !value.every(cleanText))
        throw new Error("Invalid Extended name list.");
    } else if (key === "humanCreatedPercentage") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100
      )
        throw new Error("Invalid human contribution percentage.");
    } else if (key === "authors") {
      if (!Array.isArray(value)) throw new Error("Invalid Extended authors.");
      for (const item of value) {
        const author = object(item);
        if (typeof author.isWorkForHire !== "boolean")
          throw new Error("Missing author work-for-hire flag.");
        for (const [name, entry] of Object.entries(author)) {
          if (
            name !== "isWorkForHire" &&
            (![
              "name",
              "role",
              "contactInfo",
              "contributionDescription",
            ].includes(name) ||
              !cleanText(entry))
          )
            throw new Error("Unsupported Extended author field.");
        }
      }
    } else
      throw new Error(
        "An Extended detail field requires a newer reviewed contract.",
      );
  }
  const declaration = copyright.rightsDeclaration;
  if (typeof declaration !== "string")
    throw new Error("Missing rights declaration.");
  let license: string | undefined;
  if (declaration === "custom_or_mixed") {
    if (
      !cleanText(copyright.rightsDeclarationDetails) ||
      copyright.rightsDeclarationDetails.length > 10000
    )
      throw new Error("Invalid custom license details.");
    license = `Other / Custom / Mixed Licensing — ${copyright.rightsDeclarationDetails}`;
  } else {
    if (Object.hasOwn(copyright, "rightsDeclarationDetails"))
      throw new Error("Unexpected custom license details.");
    license = Object.hasOwn(licenseLabels, declaration)
      ? licenseLabels[declaration]
      : undefined;
  }
  if (
    !license ||
    details.license !== license ||
    object(manifest.policy).license !== license
  )
    throw new Error(
      "Extended license fields do not agree with the reviewed declaration.",
    );
  if (
    typeof copyright.extendedRecordDetails === "string" &&
    copyright.extendedRecordDetails.length > 16000
  )
    throw new Error("Extended notes exceed the public limit.");
}

export async function verifyManifestHash(
  record: UceRecord,
): Promise<EvidenceCheck> {
  if (["2.0.0", "2.1.0"].includes(record.schemaVersion)) {
    return QUALIFIED_HYBRID_VERSIONS.includes(record.schemaVersion)
      ? verifyHybridManifestHash(record)
      : {
          id: "canonical_manifest_hash",
          label: "Independent manifest recomputation",
          status: "unsupported",
          explanation: HYBRID_QUALIFICATION_LIMIT,
          source: record.source,
        };
  }
  return recomputeReviewedManifest(record);
}

/** Offline/laboratory engine; normal app entry remains release-gated above. */
export async function verifyHybridManifestHash(
  record: UceRecord,
): Promise<EvidenceCheck> {
  if (!["2.0.0", "2.1.0"].includes(record.schemaVersion))
    return {
      id: "canonical_manifest_hash",
      label: "Independent manifest recomputation",
      status: "unsupported",
      explanation: "Not a reviewed hybrid manifest version.",
      source: record.source,
    };
  return recomputeReviewedManifest(record);
}

async function recomputeReviewedManifest(
  record: UceRecord,
): Promise<EvidenceCheck> {
  const base = {
    id: "canonical_manifest_hash",
    label: "Independent manifest recomputation",
    source: record.source,
  };
  if (
    !["1.0.0", "1.1.0", "2.0.0", "2.1.0"].includes(record.schemaVersion) ||
    !record.publicManifest
  )
    return {
      ...base,
      status: "unsupported",
      explanation:
        "No reviewed runtime hash profile is enabled for this format. The original public manifest is required; Lens never hashes display defaults or publisher verification flags.",
    };
  let preimage: Record<string, unknown>;
  const raw = record.publicManifest;
  const standard = ["1.0.0", "2.0.0"].includes(record.schemaVersion);
  const hybrid = ["2.0.0", "2.1.0"].includes(record.schemaVersion);
  try {
    const signature = object(raw.signatures);
    if (
      raw.schemaVersion !== record.schemaVersion ||
      raw.schema !== record.schema ||
      object(raw.hashes).manifestHash !== record.manifestHash ||
      (!hybrid &&
        (signature.platformSignature !== record.platformSignature ||
          signature.platformKeyKid !== record.platformKeyKid ||
          signature.platformPublicKeyRef !== record.platformPublicKeyRef))
    )
      throw new Error("The display record and retained manifest do not agree.");
    let compactJws = record.platformSignature;
    if (hybrid) {
      if (
        ["platformSignature", "platformKeyKid", "platformPublicKeyRef"].some(
          (key) => Object.hasOwn(signature, key),
        ) ||
        object(signature.classical).algorithm !== "ES256" ||
        object(signature.postQuantum).algorithm !== "ML-DSA-65" ||
        typeof object(signature.classical).jws !== "string"
      )
        throw new Error("Unsupported or mixed hybrid signature contract.");
      compactJws = object(signature.classical).jws as string;
    } else if (
      Object.hasOwn(signature, "classical") ||
      Object.hasOwn(signature, "postQuantum")
    )
      throw new Error(
        "A hybrid signature cannot be downgraded into a flat record.",
      );
    if (standard) {
      if (compactJws) {
        const header = readProtectedHeader(compactJws);
        if (
          header.alg !== "ES256" ||
          header.crit !== undefined ||
          header.uceRecordFormat !== undefined ||
          header.b64 !== undefined
        )
          throw new Error(
            "Unreviewed standard signature profile; no fallback recipe is tried.",
          );
      }
      preimage = standardHashInput(raw);
    } else {
      if (!compactJws || !isExtendedHeader(readProtectedHeader(compactJws)))
        throw new Error(
          "The required Extended critical-signature profile is missing or unsupported.",
        );
      preimage = extendedHashInput(raw);
    }
  } catch (error) {
    return {
      ...base,
      status: "unsupported",
      explanation:
        error instanceof Error
          ? error.message
          : "Unsupported reviewed hash input.",
    };
  }
  const canonical = standard
    ? canonicalStandardJson(preimage)
    : canonicalExtendedJson(preimage);
  const computedHash = await sha256Bytes(new TextEncoder().encode(canonical));
  const matches = computedHash === record.manifestHash;
  const coverage = standard ? STANDARD_HASH_COVERAGE : EXTENDED_HASH_COVERAGE;
  const hashProvenance = {
    profile: standard
      ? `cbyuce-standard-${hybrid ? "2.0" : "1.0"}-public-projection-81abec26`
      : hybrid
        ? "cbyuce-extended-2.1-81abec26"
        : EXTENDED_HASH_PROFILE,
    publisherRevision: "81abec2654ebd2f858ae4c6302a058ce7c1bb3de",
    computedHash,
    canonicalBytes: new TextEncoder().encode(canonical).byteLength,
    coverage,
  };
  if (standard && !matches)
    return {
      ...base,
      status: "unsupported",
      explanation:
        "The one reviewed Standard projection does not reproduce this digest. Some Standard records do not preserve their original preimage timestamps; the public data alone cannot distinguish that limitation from altered covered fields. No integrity pass or tampering conclusion is claimed, and no timestamps or alternative recipes are guessed.",
      hashProvenance,
    };
  if (matches && !standard) {
    try {
      validateExtendedDetails(raw);
    } catch (error) {
      return {
        ...base,
        status: "unsupported",
        explanation: `The digest matches, but Extended public-detail validation did not pass: ${error instanceof Error ? error.message : "unsupported details"}`,
      };
    }
  }
  return {
    ...base,
    status: matches ? "verified" : "mismatch",
    explanation: matches
      ? standard
        ? `This browser independently reproduced the recorded SHA-256 digest from the one reviewed Standard public projection. This establishes a match for this record, not recoverability of every historical record. ${coverage}`
        : `This browser independently reproduced the recorded SHA-256 digest using the reviewed Extended ${record.schemaVersion} profile. ${coverage}`
      : `The retained public manifest contents do not reproduce the recorded SHA-256 digest under the reviewed Extended ${record.schemaVersion} profile.`,
    hashProvenance,
  };
}
