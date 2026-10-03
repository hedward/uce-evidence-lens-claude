import type {
  ChronologyItem,
  EvidenceCheck,
  LocalFileDigest,
  RecordedAssertion,
  RecordSummary,
  UceRecord,
  VerificationSnapshot,
} from "../types/record";
import { resolveTrustedPlatformKey } from "../security/trusted-platform-keys";
import { verifyEs256ManifestSignature } from "./crypto";
import { verifyManifestHash } from "./manifest-hash";
import {
  HYBRID_QUALIFICATION_LIMIT,
  QUALIFIED_HYBRID_VERSIONS,
  verifyHybridManifestSignatures,
} from "./hybrid-signature";
import {
  MANIFEST_COMPATIBILITY,
  recognizedManifestVersion,
} from "../records/manifest-compatibility";

export const LEGAL_NOTICE =
  "This result verifies evidence integrity where stated; it is not a legal determination of identity, authorship, ownership, copyright validity, registration, or the truth of a recorded assertion.";

export function summarizeRecord(record: UceRecord): RecordSummary {
  return {
    id: record.id,
    title: record.title,
    schema: record.schema,
    schemaVersion: record.schemaVersion,
    source: record.source,
    fileCount: record.files.length,
    recordedManifestHash: record.manifestHash,
    arweaveTxId: record.arweaveTxId,
    legalNotice: LEGAL_NOTICE,
    compatibilityNotes: record.compatibilityNotes ?? [],
  };
}

export async function verifyRecord(
  record: UceRecord,
  chronologyCheck?: EvidenceCheck,
  fileChronologyCheck?: EvidenceCheck,
): Promise<VerificationSnapshot> {
  const version = recognizedManifestVersion(record.schemaVersion);
  const capability = version ? MANIFEST_COMPATIBILITY[version] : undefined;
  const hashCheck = await verifyManifestHash(record);
  const checks: EvidenceCheck[] = [
    {
      id: "schema",
      label: "Recognized manifest format",
      status: capability ? "verified" : "unsupported",
      explanation: `Lens ${capability ? "can read" : "does not recognize"} ${record.schema} version ${record.schemaVersion}. This is a format check, not cryptographic validation of its contents.`,
    },
    {
      id: "identifier",
      label: "Record identifier matches recorded hash",
      status: record.id
        ? record.id === record.manifestHash
          ? "verified"
          : "mismatch"
        : "unsupported",
      explanation: !record.id
        ? "No independent manifest identifier was supplied for this record source."
        : record.id === record.manifestHash
          ? "The supplied record identifier equals the manifestHash value recorded in the manifest."
          : "The supplied record identifier differs from the manifestHash value recorded in the manifest.",
    },
    hashCheck,
  ];

  if (capability?.signatureShape === "hybrid-es256-ml-dsa-65") {
    checks.push(
      QUALIFIED_HYBRID_VERSIONS.includes(record.schemaVersion)
        ? await verifyHybridManifestSignatures(record)
        : {
            id: "platform_signature",
            label: "Platform hybrid signatures",
            status: "unsupported",
            explanation: HYBRID_QUALIFICATION_LIMIT,
            source: record.source,
          },
    );
  } else if (
    capability?.localSignatureVerification !== "supported_flat_es256_only" &&
    (capability?.localSignatureVerification !== "supported_extended_es256" ||
      hashCheck.status === "unsupported")
  ) {
    checks.push({
      id: "platform_signature",
      label: "Platform signature",
      status: "unsupported",
      explanation:
        (record.schemaVersion === "1.1.0"
          ? hashCheck.explanation
          : capability?.displayNote) ??
        "This manifest version has no reviewed signature verifier in this Lens build.",
      source: record.source,
    });
  } else if (record.platformSignature) {
    const resolution = resolveTrustedPlatformKey(record);
    if (resolution.status === "trusted") {
      const result = await verifyEs256ManifestSignature(
        record.platformSignature,
        record.manifestHash,
        record.platformKeyKid,
        [resolution.key.jwk],
        capability.profile,
      );
      checks.push({
        ...result,
        explanation:
          result.status === "verified"
            ? "A reviewed Copyright by UCE platform public key validated this record's ES256 signature over its recorded manifest hash. The separate recomputation result determines whether the covered manifest contents reproduce that hash."
            : result.explanation,
        source: record.source,
        signatureProvenance: {
          keyId: resolution.key.kid,
          keyThumbprint: resolution.key.jwkThumbprint,
          publicKeySource: resolution.key.publicKeySource,
          keyReviewSource: resolution.key.approvalSource,
          reviewedAt: resolution.key.verifiedAt,
        },
      });
    } else {
      checks.push({
        id: "platform_signature",
        label: "Platform ES256 signature",
        status: resolution.status === "failed" ? "mismatch" : "unsupported",
        explanation: resolution.explanation,
      });
    }
  } else {
    checks.push({
      id: "platform_signature",
      label: "Platform ES256 signature",
      status: "unsupported",
      explanation:
        "The loaded record does not include a supported platform signature.",
    });
  }

  checks.push(
    chronologyCheck ?? {
      id: "independent_anchor",
      label: record.arweaveTxId
        ? "Checking Arweave chronology"
        : "Arweave chronology check",
      status: record.arweaveTxId ? "checking" : "unsupported",
      explanation: record.arweaveTxId
        ? "Retrieving public transaction and block metadata directly from Arweave."
        : "This record does not include an Arweave transaction identifier.",
      source: record.arweaveTxId
        ? `https://arweave.net/tx/${record.arweaveTxId}/status`
        : undefined,
    },
  );

  if (fileChronologyCheck) checks.push(fileChronologyCheck);

  if (record.reportedArweaveBlockTimestamp) {
    checks.push({
      id: "publisher_anchor_claim",
      label: "Publisher-reported Arweave timestamp",
      status: "reported",
      explanation: `The publisher reports block timestamp ${record.reportedArweaveBlockTimestamp}. The direct Arweave chronology check above determines whether it agrees with public block metadata.`,
      source: record.source,
    });
  }

  if (
    record.serverHashMatches !== undefined ||
    record.serverSignatureValid !== undefined
  ) {
    checks.push({
      id: "server_verification_claim",
      label: "Publisher verification response",
      status: "reported",
      explanation: `The public response reported hashMatches=${String(record.serverHashMatches)} and sigValid=${String(record.serverSignatureValid)}. Those server flags are recorded, not substituted for local checks.`,
      source: record.source,
    });
  }

  const hasMismatch = checks.some((check) => check.status === "mismatch");
  const isChecking = checks.some((check) => check.status === "checking");
  const hasRetryable = checks.some((check) => check.status === "retryable");
  const hasReportedChronology = checks.some(
    (check) =>
      check.status === "reported" &&
      check.chronologyProvenance?.relationship === "gateway_index",
  );
  return {
    checkedAt: new Date().toISOString(),
    coverage: {
      manifestContents:
        hashCheck.status === "verified"
          ? "recomputed"
          : hashCheck.status === "mismatch"
            ? "mismatch"
            : "not_recomputed",
      limitations: [
        hashCheck.status === "verified"
          ? hashCheck.hashProvenance!.coverage
          : hashCheck.status === "mismatch"
            ? "Manifest contents do not reproduce the recorded hash. A valid signature over that recorded hash does not resolve this mismatch; do not rely on the altered contents."
            : "Manifest contents have not been independently recomputed. A valid platform signature authenticates the recorded hash, not the displayed metadata or file digests.",
        ...checks
          .filter(
            (check) =>
              check.id !== "canonical_manifest_hash" &&
              (["unsupported", "checking", "retryable"].includes(
                check.status,
              ) ||
                (check.status === "reported" &&
                  check.chronologyProvenance?.relationship ===
                    "gateway_index")),
          )
          .map((check) => `${check.label}: ${check.explanation}`),
      ],
    },
    recordBinding: {
      source: record.source,
      manifestHash: record.manifestHash,
    },
    checks,
    summary: hasMismatch
      ? "An integrity problem was found. Review the mismatch below."
      : capability?.signatureShape === "hybrid-es256-ml-dsa-65" &&
          checks.some(
            (check) =>
              check.id === "platform_signature" &&
              check.status === "unsupported",
          )
        ? "Cryptographic verification is not yet complete for this hybrid format. See verification limits."
        : isChecking
          ? "No problems found in completed checks. A check is still running."
          : hasRetryable
            ? "No problems found in completed checks. A check can be retried."
            : hasReportedChronology
              ? "No problems found in completed checks. A result is reported from its public source but is not independently verified."
              : "No problems found in completed checks.",
    legalNotice: LEGAL_NOTICE,
  };
}

export function inspectChronology(record: UceRecord): ChronologyItem[] {
  const items: ChronologyItem[] = [
    {
      label: "Claimed creation date",
      timestamp: record.creationDate,
      kind: "recorded_assertion",
      source: "manifest.work.creationDate",
      limitation:
        "This is a date asserted by the record; it is not independently proven.",
    },
    {
      label: "Manifest registration timestamp",
      timestamp: record.registrationTimestamp,
      kind: "system_event",
      source: "manifest.registrationTimestamp",
      limitation: "This is a timestamp recorded by the evidence system.",
    },
  ];
  record.audit.forEach((event) => {
    items.push({
      label: `Audit event: ${event.event}`,
      timestamp: event.at,
      kind: "system_event",
      source: `manifest.audit (${event.by ?? "unspecified actor"})`,
      limitation:
        "This event is recorded within the manifest and is not an independent timestamp.",
    });
  });
  if (record.reportedArweaveBlockTimestamp) {
    items.push({
      label: "Publisher-reported Arweave block timestamp",
      timestamp: record.reportedArweaveBlockTimestamp,
      kind: "recorded_assertion",
      source: "verification.arweaveConfirmation.manifest.blockTimestamp",
      limitation:
        "This value came from the publisher. The direct Arweave result in Verification checks independently tests whether it agrees with public block metadata.",
    });
  }
  return items;
}

export function listAssertions(record: UceRecord): RecordedAssertion[] {
  const assertions: RecordedAssertion[] = [
    {
      category: "authorship",
      label: "Author name",
      value: record.authorName,
      source: "manifest.work.authorName",
      limitation:
        "Recorded authorship assertion; not a determination of authorship or ownership.",
    },
    {
      category: "creation",
      label: "Creation date",
      value: record.creationDate,
      source: "manifest.work.creationDate",
      limitation:
        "Recorded creation-date assertion; not independently proven by this field.",
    },
  ];
  if (record.identityLevel) {
    assertions.push({
      category: "identity",
      label: "Identity assurance",
      value: `${record.identityLevel}${record.identityMethods.length ? ` via ${record.identityMethods.join(", ")}` : ""}`,
      source: "manifest.identity.assurance",
      limitation:
        "Recorded assurance metadata; it does not establish legal identity or authorship.",
    });
  }
  if (record.originalityOathAccepted !== undefined) {
    assertions.push({
      category: "authorship",
      label: "Originality oath",
      value: record.originalityOathAccepted
        ? "Recorded as accepted"
        : "Recorded as not accepted",
      source: "manifest.attestations.originalityOath",
      limitation:
        "Acceptance is recorded; the truth of the oath was not determined.",
    });
  }
  if (record.rightsConfirmed !== undefined) {
    assertions.push({
      category: "rights",
      label: "Rights confirmation",
      value: record.rightsConfirmed
        ? "Recorded as confirmed"
        : "Recorded as not confirmed",
      source: "manifest.attestations.rightsConfirmation",
      limitation: "This is a recorded declaration, not a legal determination.",
    });
  }
  if (record.policyLicense) {
    assertions.push({
      category: "rights",
      label: "Rights declaration",
      value: record.policyLicense,
      source: "manifest.policy.license",
      limitation:
        "This result reports the declaration and does not determine its validity or scope.",
    });
  }
  assertions.push({
    category: "ai_policy",
    label: "AI-use policy",
    value: `AI opt-out: ${String(record.aiOptOut)}; do-not-train: ${String(record.doNotTrain)}; rights: ${record.policyRights ?? "not recorded"}`,
    source: "manifest.policy",
    limitation:
      "These are recorded policy assertions; enforcement and legal effect are not determined.",
  });
  return assertions;
}

export function compareLocalDigest(
  record: UceRecord,
  local: LocalFileDigest | undefined,
  fileIndex = 0,
): EvidenceCheck {
  if (!local) {
    return {
      id: "local_file",
      label: "Selected local file digest",
      status: "unsupported",
      explanation:
        "Select a local file to compute its SHA-256 digest in this browser.",
    };
  }
  const recorded = record.files[fileIndex];
  if (!recorded) {
    return {
      id: "local_file",
      label: "Selected local file digest",
      status: "unsupported",
      explanation: `The record has no file at index ${fileIndex}.`,
    };
  }
  const matched = local.sha256.toLowerCase() === recorded.sha256.toLowerCase();
  return {
    id: "local_file",
    label: "Selected local file digest",
    status: matched ? "verified" : "mismatch",
    explanation: matched
      ? `The selected local file matches the recorded SHA-256 digest for ${recorded.filename}.`
      : `The selected local file does not match the recorded SHA-256 digest for ${recorded.filename}.`,
  };
}
