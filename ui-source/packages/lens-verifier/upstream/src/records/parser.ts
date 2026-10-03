import type { UceAuditEvent, UceFileRecord, UceRecord } from "../types/record";
import {
  MANIFEST_COMPATIBILITY,
  recognizedManifestVersion,
  retainBoundedPublicManifest,
  type RecognizedManifestVersion,
} from "./manifest-compatibility";
import {
  ValidationError,
  isArweaveId,
  isPlainObject,
  isSha256,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requiredInteger,
  requiredObject,
  requiredString,
} from "../security/untrusted";

export interface ParseRecordOptions {
  source: string;
  loadedFrom: UceRecord["loadedFrom"];
  expectedId?: string;
  sourceArweaveTxId?: string;
}

function objectAt(
  parent: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return requiredObject(parent[key], key);
}

function optionalObject(
  parent: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = parent[key];
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value))
    throw new ValidationError(`${key} must be a JSON object.`);
  return value;
}

function optionalRecordedInteger(
  value: unknown,
  label: string,
  notes: string[],
): number | undefined {
  if (value === undefined || value === null) {
    notes.push(`${label} was not recorded in this historical manifest.`);
    return undefined;
  }
  return requiredInteger(value, label, 1);
}

function recordedStringOrPlaceholder(
  value: unknown,
  label: string,
  max: number,
  placeholder: string,
  notes: string[],
): string {
  if (value === undefined || value === null) {
    notes.push(`${label} was not recorded in this historical manifest.`);
    return placeholder;
  }
  return requiredString(value, label, max);
}

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new ValidationError(`${label} must be a small array.`);
  return value.map((item, index) =>
    requiredString(item, `${label}[${index}]`, 120),
  );
}

function parseFiles(value: unknown, notes: string[]): UceFileRecord[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new ValidationError(
      "manifest.files must contain between 1 and 20 entries.",
    );
  }
  return value.map((item, index) => {
    const file = requiredObject(item, `manifest.files[${index}]`);
    const sha256 = requiredString(
      file.sha256,
      `files[${index}].sha256`,
      64,
    ).toLowerCase();
    if (!isSha256(sha256))
      throw new ValidationError(
        `files[${index}].sha256 is not a SHA-256 digest.`,
      );
    const filename = recordedStringOrPlaceholder(
      file.filename,
      `files[${index}].filename`,
      300,
      "[filename not recorded]",
      notes,
    );
    return {
      filename,
      bytes: requiredInteger(file.bytes, `files[${index}].bytes`),
      sha256,
      mimeType: optionalString(file.mimeType, `files[${index}].mimeType`, 150),
      clientReportedLastModified: optionalString(
        file.clientReportedLastModified,
        `files[${index}].clientReportedLastModified`,
        80,
      ),
    };
  });
}

interface ParsedHashContract {
  algorithm: "sha256";
  canonicalization?: "RFC8785";
  merkleRoot?: string;
}

function validateHashContract(
  hashes: Record<string, unknown>,
  version: RecognizedManifestVersion,
  notes: string[],
): ParsedHashContract {
  const recordedAlgorithm = requiredString(
    hashes.algorithm,
    "hashes.algorithm",
    30,
  );
  const algorithm =
    version === "1.0.0" ? recordedAlgorithm.toLowerCase() : recordedAlgorithm;
  if (algorithm !== "sha256") {
    throw new ValidationError("hashes.algorithm must be sha256.");
  }

  let canonicalization: "RFC8785" | undefined;
  if (hashes.canonicalization === undefined && version === "1.0.0") {
    notes.push(
      "hashes.canonicalization was not recorded in this historical manifest; canonical hash recomputation is unavailable.",
    );
  } else {
    const recordedCanonicalization = requiredString(
      hashes.canonicalization,
      "hashes.canonicalization",
      50,
    );
    if (recordedCanonicalization !== "RFC8785") {
      throw new ValidationError("hashes.canonicalization must be RFC8785.");
    }
    canonicalization = recordedCanonicalization;
  }

  let merkleRoot: string | undefined;
  if (hashes.merkleRoot === undefined && version === "1.0.0") {
    notes.push(
      "hashes.merkleRoot was not recorded in this historical manifest; Merkle-root comparison is unavailable.",
    );
  } else {
    merkleRoot = requiredString(
      hashes.merkleRoot,
      "hashes.merkleRoot",
      64,
    ).toLowerCase();
    if (!isSha256(merkleRoot)) {
      throw new ValidationError("hashes.merkleRoot is not a SHA-256 digest.");
    }
  }
  return { algorithm: "sha256", canonicalization, merkleRoot };
}

function validateExtendedProfile(
  manifest: Record<string, unknown>,
): Record<string, unknown> {
  const recordDetails = requiredObject(
    manifest.recordDetails,
    "manifest.recordDetails",
  );
  if (
    requiredString(recordDetails.format, "recordDetails.format", 50) !==
    "extended-v1"
  ) {
    throw new ValidationError("recordDetails.format must be extended-v1.");
  }
  requiredObject(recordDetails.copyright, "recordDetails.copyright");
  requiredString(recordDetails.license, "recordDetails.license", 20_000);
  const policy = requiredObject(manifest.policy, "manifest.policy");
  requiredString(policy.license, "policy.license", 20_000);
  return recordDetails;
}

function validateHybridProfile(manifest: Record<string, unknown>): void {
  const signatures = requiredObject(manifest.signatures, "manifest.signatures");
  const classical = requiredObject(
    signatures.classical,
    "signatures.classical",
  );
  const postQuantum = requiredObject(
    signatures.postQuantum,
    "signatures.postQuantum",
  );
  if (
    requiredString(
      classical.algorithm,
      "signatures.classical.algorithm",
      30,
    ) !== "ES256"
  ) {
    throw new ValidationError("signatures.classical.algorithm must be ES256.");
  }
  requiredString(classical.jws, "signatures.classical.jws", 2_000);
  requiredString(
    classical.publicKeyRef,
    "signatures.classical.publicKeyRef",
    500,
  );
  if (
    requiredString(
      postQuantum.algorithm,
      "signatures.postQuantum.algorithm",
      50,
    ) !== "ML-DSA-65"
  ) {
    throw new ValidationError(
      "signatures.postQuantum.algorithm must be ML-DSA-65.",
    );
  }
  requiredString(
    postQuantum.signature,
    "signatures.postQuantum.signature",
    20_000,
  );
  requiredString(
    postQuantum.publicKeyRef,
    "signatures.postQuantum.publicKeyRef",
    500,
  );
  requiredString(
    postQuantum.libraryVersion,
    "signatures.postQuantum.libraryVersion",
    200,
  );
  const metadata = requiredObject(manifest.metadata, "manifest.metadata");
  requiredString(metadata.createdWith, "metadata.createdWith", 500);
  const cryptoLibraries = requiredObject(
    metadata.cryptoLibraries,
    "metadata.cryptoLibraries",
  );
  requiredString(
    cryptoLibraries.classical,
    "metadata.cryptoLibraries.classical",
    200,
  );
  requiredString(
    cryptoLibraries.postQuantum,
    "metadata.cryptoLibraries.postQuantum",
    200,
  );
}

function validateNewFormatCommonFields(
  manifest: Record<string, unknown>,
): void {
  requiredObject(manifest.identity, "manifest.identity");
  requiredObject(manifest.attestations, "manifest.attestations");
  requiredObject(manifest.signatures, "manifest.signatures");
  const anchors = requiredObject(manifest.anchors, "manifest.anchors");
  const arweave = requiredObject(anchors.arweave, "anchors.arweave");
  const txId = arweave.txId;
  if (typeof txId !== "string" || (txId !== "" && !isArweaveId(txId))) {
    throw new ValidationError("Arweave transaction ID is malformed.");
  }
  if (!Array.isArray(manifest.audit)) {
    throw new ValidationError("manifest.audit must be an array.");
  }
}

function validateVersionProfile(
  manifest: Record<string, unknown>,
  version: RecognizedManifestVersion,
): Record<string, unknown> | undefined {
  if (version !== "1.0.0") validateNewFormatCommonFields(manifest);
  if (version.startsWith("2.")) validateHybridProfile(manifest);
  if (version.endsWith(".1.0")) return validateExtendedProfile(manifest);
  return undefined;
}

function parseAudit(value: unknown): UceAuditEvent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50)
    throw new ValidationError("manifest.audit must be a small array.");
  return value.map((item, index) => {
    const event = requiredObject(item, `manifest.audit[${index}]`);
    return {
      event: requiredString(event.event, `audit[${index}].event`, 100),
      at: requiredString(event.at, `audit[${index}].at`, 80),
      by: optionalString(event.by, `audit[${index}].by`, 80),
      ref: optionalString(event.ref, `audit[${index}].ref`, 150),
    };
  });
}

function arweaveIdFromSource(source: string): string | undefined {
  try {
    const candidate = new URL(source).pathname
      .split("/")
      .filter(Boolean)
      .at(-1);
    return candidate && isArweaveId(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function optionalArweaveId(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  const candidate = requiredString(value, "anchors.arweave.txId", 43);
  if (!isArweaveId(candidate))
    throw new ValidationError("Arweave transaction ID is malformed.");
  return candidate;
}

export function parseUceRecord(
  input: unknown,
  options: ParseRecordOptions,
): UceRecord {
  const root = requiredObject(input, "record");
  const rawManifest = isPlainObject(root.manifest) ? root.manifest : root;
  const manifest = retainBoundedPublicManifest(rawManifest);
  const verification = optionalObject(root, "verification");
  const schema = requiredString(manifest.schema, "manifest.schema", 100);
  const schemaVersion = requiredString(
    manifest.schemaVersion,
    "manifest.schemaVersion",
    40,
  );
  const recognizedVersion = recognizedManifestVersion(schemaVersion);
  if (schema !== "uce.evidence.manifest" || !recognizedVersion) {
    throw new ValidationError(
      `Unsupported record schema: ${schema} ${schemaVersion}.`,
    );
  }

  const compatibilityNotes = [
    MANIFEST_COMPATIBILITY[recognizedVersion].displayNote,
    "recordDetails, connector source, licenses, and other public claims are recorded assertions, not independently authenticated facts.",
  ];
  const work = optionalObject(manifest, "work");
  const hashes = objectAt(manifest, "hashes");
  const hashContract = validateHashContract(
    hashes,
    recognizedVersion,
    compatibilityNotes,
  );
  const recordDetails = validateVersionProfile(manifest, recognizedVersion);
  const manifestHash = requiredString(
    hashes.manifestHash,
    "hashes.manifestHash",
    64,
  ).toLowerCase();
  if (!isSha256(manifestHash))
    throw new ValidationError("hashes.manifestHash is not a SHA-256 digest.");
  const anchors = optionalObject(manifest, "anchors");
  const arweave = optionalObject(anchors, "arweave");
  const signatures = optionalObject(manifest, "signatures");
  const identity = optionalObject(manifest, "identity");
  const assurance = optionalObject(identity, "assurance");
  const aiProvenance = optionalObject(manifest, "aiProvenance");
  const policy = optionalObject(manifest, "policy");
  const attestations = optionalObject(manifest, "attestations");
  const originalityOath = optionalObject(attestations, "originalityOath");
  const rightsConfirmation = optionalObject(attestations, "rightsConfirmation");
  const rightsInquiry = optionalObject(work, "rightsInquiry");
  const arweaveConfirmation = optionalObject(
    verification,
    "arweaveConfirmation",
  );
  const manifestConfirmation = optionalObject(arweaveConfirmation, "manifest");
  const recordedArweaveTxId = optionalArweaveId(arweave.txId);
  const sourceArweaveTxId =
    options.sourceArweaveTxId ?? arweaveIdFromSource(options.source);
  if (
    options.loadedFrom === "arweave" &&
    sourceArweaveTxId &&
    recordedArweaveTxId &&
    recordedArweaveTxId !== sourceArweaveTxId
  ) {
    throw new ValidationError(
      "The record's Arweave transaction ID does not match the loaded source transaction.",
    );
  }
  const arweaveTxId = sourceArweaveTxId ?? recordedArweaveTxId;
  const connectorSource =
    manifest.source === undefined
      ? undefined
      : requiredObject(manifest.source, "manifest.source");

  return {
    id: options.expectedId?.toLowerCase(),
    source: options.source,
    loadedFrom: options.loadedFrom,
    schema,
    schemaVersion,
    publicManifest: manifest,
    recordDetails,
    connectorSource,
    compatibilityNotes,
    manifestVersion: optionalRecordedInteger(
      manifest.manifestVersion,
      "manifest.manifestVersion",
      compatibilityNotes,
    ),
    registrationTimestamp: recordedStringOrPlaceholder(
      manifest.registrationTimestamp,
      "manifest.registrationTimestamp",
      80,
      "[registration timestamp not recorded]",
      compatibilityNotes,
    ),
    generatedAt: optionalString(
      optionalObject(manifest, "generatedBy").generatedAt,
      "generatedBy.generatedAt",
      80,
    ),
    title: recordedStringOrPlaceholder(
      work.title,
      "work.title",
      500,
      "[title not recorded]",
      compatibilityNotes,
    ),
    authorName: recordedStringOrPlaceholder(
      work.authorName,
      "work.authorName",
      300,
      "[author not recorded]",
      compatibilityNotes,
    ),
    creationDate: recordedStringOrPlaceholder(
      work.creationDate,
      "work.creationDate",
      80,
      "[creation date not recorded]",
      compatibilityNotes,
    ),
    creationMode: optionalString(work.creationMode, "work.creationMode", 100),
    workCategory: optionalString(work.workCategory, "work.workCategory", 100),
    rightsInquiryUrl: optionalString(
      rightsInquiry.url,
      "work.rightsInquiry.url",
      500,
    ),
    files: parseFiles(manifest.files, compatibilityNotes),
    manifestHash,
    hashAlgorithm: hashContract.algorithm,
    canonicalization: hashContract.canonicalization,
    merkleRoot: hashContract.merkleRoot,
    platformSignature: optionalString(
      signatures.platformSignature,
      "signatures.platformSignature",
      2_000,
    ),
    platformPublicKeyRef: optionalString(
      signatures.platformPublicKeyRef,
      "signatures.platformPublicKeyRef",
      100,
    ),
    platformKeyKid: optionalString(
      signatures.platformKeyKid,
      "signatures.platformKeyKid",
      150,
    ),
    arweaveTxId,
    reportedArweaveBlockTimestamp: optionalString(
      manifestConfirmation.blockTimestamp,
      "verification.arweaveConfirmation.manifest.blockTimestamp",
      80,
    ),
    reportedArweaveBlockHeight: optionalNumber(
      manifestConfirmation.blockHeight,
      "verification.arweaveConfirmation.manifest.blockHeight",
    ),
    identityLevel: optionalString(
      assurance.level,
      "identity.assurance.level",
      50,
    ),
    identityMethods: stringArray(
      assurance.methods,
      "identity.assurance.methods",
    ),
    identityVerifiedAt: optionalString(
      assurance.verifiedAt,
      "identity.assurance.verifiedAt",
      80,
    ),
    isAiAssisted: optionalBoolean(
      aiProvenance.isAIAssisted,
      "aiProvenance.isAIAssisted",
    ),
    humanCreatedPercentage: optionalNumber(
      aiProvenance.humanCreatedPercentage,
      "aiProvenance.humanCreatedPercentage",
    ),
    policyLicense: optionalString(policy.license, "policy.license", 20_000),
    policyRights: optionalString(policy.rights, "policy.rights", 200),
    aiOptOut: optionalBoolean(policy.aiOptOut, "policy.aiOptOut"),
    doNotTrain: optionalBoolean(policy.doNotTrain, "policy.doNotTrain"),
    audit: parseAudit(manifest.audit),
    originalityOathAccepted: optionalBoolean(
      originalityOath.accepted,
      "originalityOath.accepted",
    ),
    rightsConfirmed: optionalBoolean(
      rightsConfirmation.confirmed,
      "rightsConfirmation.confirmed",
    ),
    serverHashMatches: optionalBoolean(
      verification.hashMatches,
      "verification.hashMatches",
    ),
    serverSignatureValid: optionalBoolean(
      verification.sigValid,
      "verification.sigValid",
    ),
  };
}
