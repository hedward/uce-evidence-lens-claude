import type { PublicJwk, UceRecord } from "../types/record";

export interface TrustedPlatformKey {
  kid: string;
  status: "active" | "revoked";
  publicKeyRef: string;
  jwkThumbprint: string;
  jwk: PublicJwk;
  approvalSource: string;
  publicKeySource: string;
  verifiedAt: string;
}

export type TrustedPlatformKeyResolution =
  | { status: "trusted"; key: TrustedPlatformKey }
  | { status: "unavailable"; explanation: string }
  | { status: "failed"; explanation: string };

const COPYRIGHT_BY_UCE_CLASSICAL_KEY: TrustedPlatformKey = Object.freeze({
  kid: "platform-classical-1761279471109",
  status: "active",
  publicKeyRef: "8IQIcijOSMO0dtKrNsVPTFbJBGiIaL6x9EsUW4UdApQ",
  jwkThumbprint: "_ZNG5XB7yNCkYh-diRabxjg8nJ-r8jrXWnHmoN_GgTo",
  jwk: Object.freeze({
    kty: "EC",
    crv: "P-256",
    x: "D98fNCOR_D8zItMIBvujLV8tdE6C9FoOlDpX9yGSHOc",
    y: "7HDup_6Kppy_qluAc5X9NFHpGzotVv1MeydaAc6KqmA",
    kid: "platform-classical-1761279471109",
    use: "sig",
    alg: "ES256",
  }),
  approvalSource:
    "https://cbyuce.com/verify/5d476448cf9f05d1fd5d3b863f8a212732f1593d90dc63b292f557c28775a48f?format=json",
  publicKeySource:
    "https://arweave.net/8IQIcijOSMO0dtKrNsVPTFbJBGiIaL6x9EsUW4UdApQ",
  verifiedAt: "2026-08-31",
});

export const TRUSTED_PLATFORM_KEYS: readonly TrustedPlatformKey[] =
  Object.freeze([COPYRIGHT_BY_UCE_CLASSICAL_KEY]);

export function resolveTrustedPlatformKey(
  record: UceRecord,
): TrustedPlatformKeyResolution {
  if (!record.platformKeyKid) {
    return {
      status: "unavailable",
      explanation:
        "The record does not identify a key in the trusted Copyright by UCE platform-key registry.",
    };
  }

  const key = TRUSTED_PLATFORM_KEYS.find(
    (candidate) => candidate.kid === record.platformKeyKid,
  );
  if (!key) {
    return {
      status: "unavailable",
      explanation:
        "The record's key identifier is not present in the trusted Copyright by UCE platform-key registry.",
    };
  }
  if (key.status === "revoked") {
    return {
      status: "failed",
      explanation:
        "The record identifies a revoked Copyright by UCE platform key.",
    };
  }
  if (!record.platformPublicKeyRef) {
    return {
      status: "unavailable",
      explanation:
        "The record does not include the public-key reference required by the trusted Copyright by UCE platform-key registry.",
    };
  }
  if (record.platformPublicKeyRef !== key.publicKeyRef) {
    return {
      status: "failed",
      explanation:
        "The record's public-key reference does not match the trusted Copyright by UCE platform key.",
    };
  }
  return { status: "trusted", key };
}
