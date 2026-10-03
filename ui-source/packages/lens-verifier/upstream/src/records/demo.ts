import type { UceRecord } from "../types/record";
import publicManifest from "../../public/demo/uce-evidence-lens-logo-tagline-v1.0.uce.json";

export const DEMO_RECORD_ID =
  "cc94e8d529cfc24f6fe458470b69dca2c3ef53a78b740bb1fea9cc40d09cfd1c";

export const DEMO_VERIFICATION_URL = `https://cbyuce.com/verify/${DEMO_RECORD_ID}`;
export const DEMO_FILE_URL = "/demo/uce-evidence-lens-logo-tagline-v1.0.png";
export const DEMO_MANIFEST_URL =
  "/demo/uce-evidence-lens-logo-tagline-v1.0.uce.json";

export const demoRecord: UceRecord = {
  publicManifest,
  id: DEMO_RECORD_ID,
  source: DEMO_VERIFICATION_URL,
  loadedFrom: "bundled_demo",
  schema: "uce.evidence.manifest",
  schemaVersion: "1.0.0",
  manifestVersion: 1,
  registrationTimestamp: "2026-08-31T21:19:55.481Z",
  generatedAt: "2026-08-31T21:21:55.897Z",
  title: "UCE Evidence Lens — Logo and Tagline v1.0",
  authorName: "Copyright by UCE/CbyUCE",
  creationDate: "2026-08-31",
  creationMode: "visual",
  workCategory: "pictorial",
  files: [
    {
      filename: "UCE Evidence Lens _ Logo and Tagline v1.0.png",
      bytes: 33180,
      sha256:
        "cbde70497c47fc1d2f4b8bb201572f1cacb31669e2c0d336e8bb51d0e3c149d0",
      mimeType: "image/png",
      clientReportedLastModified: "2026-08-31T21:11:53.683Z",
    },
  ],
  manifestHash: DEMO_RECORD_ID,
  hashAlgorithm: "sha256",
  canonicalization: "RFC8785",
  merkleRoot:
    "cbde70497c47fc1d2f4b8bb201572f1cacb31669e2c0d336e8bb51d0e3c149d0",
  platformSignature:
    "eyJhbGciOiJFUzI1NiIsImtpZCI6InBsYXRmb3JtLWNsYXNzaWNhbC0xNzYxMjc5NDcxMTA5IiwidHlwIjoiSldTIn0.zJTo1SnPwk9v5FhHC2ncosPvU6eLdAux_qnMQNCc_Rw.DwWv7VjrqFa3E45CaaI-zgiZVt9Tm9KfHOV96-2Q0PB1xgB7Dsg4ilw-jVThc7761W4TTWr4_WCpGJtAYobczQ",
  platformPublicKeyRef: "8IQIcijOSMO0dtKrNsVPTFbJBGiIaL6x9EsUW4UdApQ",
  platformKeyKid: "platform-classical-1761279471109",
  arweaveTxId: "uphFAj1E5Vw10LwFI-qTGrSRKJsWpr2m_mzSZQI8eDU",
  identityLevel: "IAL1",
  identityMethods: ["google_oauth"],
  identityVerifiedAt: "2026-08-31T21:21:55.897Z",
  isAiAssisted: true,
  policyLicense: "All Rights Reserved",
  policyRights: "TDM-RESERVED",
  aiOptOut: true,
  doNotTrain: true,
  audit: [
    { event: "upload", at: "2026-08-31T21:19:55.481Z", by: "creator" },
    {
      event: "payment.completed",
      at: "2026-08-31T21:21:55.897Z",
      by: "system",
    },
    {
      event: "file.stored",
      at: "2026-08-31T21:21:55.897Z",
      by: "system",
      ref: "A6QE2KzIM8lIdQwX1ReH4I2ZBRU-wE7vsXWQxfSYb6g",
    },
    {
      event: "manifest.generated",
      at: "2026-08-31T21:21:55.897Z",
      by: "system",
    },
  ],
  serverHashMatches: true,
  serverSignatureValid: true,
};
