export type EvidenceStatus =
  | "verified"
  | "mismatch"
  | "checking"
  | "retryable"
  | "reported"
  | "unsupported";

export interface EvidenceCheck {
  id: string;
  label: string;
  status: EvidenceStatus;
  explanation: string;
  source?: string;
  chronologyProvenance?: {
    referenceType: "transaction" | "bundled_item";
    transactionId: string;
    rootTransactionId: string;
    parentPath: string[];
    block: { height: number; hash: string; timestamp: string };
    relationship: "direct_block_membership" | "gateway_index";
    indexSource?: string;
    statusSource?: string;
    blockSource?: string;
  };
  signatureComponents?: {
    algorithm: "ES256" | "ML-DSA-65";
    status: EvidenceStatus;
    explanation: string;
    keyId?: string;
    keyFingerprint?: string;
    publicKeySource?: string;
    reviewedAt?: string;
  }[];
  hashProvenance?: {
    profile: string;
    publisherRevision: string;
    computedHash: string;
    canonicalBytes: number;
    coverage: string;
  };
  signatureProvenance?: {
    keyId: string;
    keyThumbprint: string;
    publicKeySource: string;
    keyReviewSource: string;
    reviewedAt: string;
  };
}

export interface UceFileRecord {
  filename: string;
  bytes: number;
  sha256: string;
  mimeType?: string;
  clientReportedLastModified?: string;
}

export interface UceAuditEvent {
  event: string;
  at: string;
  by?: string;
  ref?: string;
}

export type PublicJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

export interface UceRecord {
  publicManifest?: Record<string, unknown>;
  recordDetails?: Record<string, unknown>;
  connectorSource?: Record<string, unknown>;
  compatibilityNotes?: string[];
  id?: string;
  source: string;
  loadedFrom: "bundled_demo" | "cbyuce" | "arweave" | "pasted_json";
  schema: string;
  schemaVersion: string;
  manifestVersion?: number;
  registrationTimestamp: string;
  generatedAt?: string;
  title: string;
  authorName: string;
  creationDate: string;
  creationMode?: string;
  workCategory?: string;
  rightsInquiryUrl?: string;
  files: UceFileRecord[];
  manifestHash: string;
  hashAlgorithm: string;
  canonicalization?: string;
  merkleRoot?: string;
  platformSignature?: string;
  platformPublicKeyRef?: string;
  platformKeyKid?: string;
  arweaveTxId?: string;
  reportedArweaveBlockTimestamp?: string;
  reportedArweaveBlockHeight?: number;
  identityLevel?: string;
  identityMethods: string[];
  identityVerifiedAt?: string;
  isAiAssisted?: boolean;
  humanCreatedPercentage?: number;
  policyLicense?: string;
  policyRights?: string;
  aiOptOut?: boolean;
  doNotTrain?: boolean;
  audit: UceAuditEvent[];
  originalityOathAccepted?: boolean;
  rightsConfirmed?: boolean;
  serverHashMatches?: boolean;
  serverSignatureValid?: boolean;
}

export interface ChronologyItem {
  label: string;
  timestamp: string;
  kind: "recorded_assertion" | "system_event" | "independent_anchor";
  source: string;
  limitation: string;
}

export interface RecordedAssertion {
  category: "identity" | "authorship" | "creation" | "rights" | "ai_policy";
  label: string;
  value: string;
  source: string;
  limitation: string;
}

export interface LocalFileDigest {
  name: string;
  bytes: number;
  sha256: string;
  computedAt: string;
}

export interface RecordSummary {
  compatibilityNotes: string[];
  id?: string;
  title: string;
  schema: string;
  schemaVersion: string;
  source: string;
  fileCount: number;
  recordedManifestHash: string;
  arweaveTxId?: string;
  legalNotice: string;
}

export interface VerificationSnapshot {
  checkedAt: string;
  coverage: {
    manifestContents: "not_recomputed" | "recomputed" | "mismatch";
    limitations: string[];
  };
  recordBinding: {
    source: string;
    manifestHash: string;
  };
  checks: EvidenceCheck[];
  summary: string;
  legalNotice: string;
}
