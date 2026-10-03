# Hybrid 2.0.0 / 2.1.0 qualification gate

Reviewed: 2026-09-21. Publisher contract revision:
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de` in the CbyUCE `main`
checkout. This is a local development assessment, **not** deployment or
production-release approval. Publisher source availability is not evidence that
hybrid issuance is enabled. Its `FEATURE_QUANTUM_SIGNATURES` default is off.

## Current decision

Evidence Lens can read bounded `2.0.0` and `2.1.0` manifests and has a local
ES256 + ML-DSA-65 verification engine. Synthetic tests establish primitive
interoperability. The release qualification list in
[`hybrid-signature.ts`](../../src/verification/hybrid-signature.ts) is frozen and
empty. Consequently, the UI, WebMCP tools and reports must say **not
independently checked** for hybrid signatures; neither version receives a
runtime hybrid or manifest-hash pass. A positive result from a direct
test-only engine call is not a product verification claim.

No genuine publisher-issued, publicly retrievable `2.0.0` or `2.1.0` record
was identified in this review. The publisher's `docs/manifest-v2-example.json`
uses placeholder identifiers and signatures; Lens's read/display fixtures are
also synthetic. The separate public `1.1.0` Extended fixture qualifies only
its own profile. A reviewed public key is necessary but not proof that a
hybrid record was issued, deployed, or verified.

## Contract implemented locally

- The publisher signs `Buffer.from(manifestHashHex, "hex")`: exactly the 32
  recorded SHA-256 digest bytes. The ES256 compact JWS contains those bytes as
  its payload and signs its encoded protected-header/payload input. ML-DSA-65
  signs the same digest bytes as a raw signature encoded in padded standard
  base64. Neither algorithm signs the hex text or a display-normalized object.
- `2.0.0` is the standard hybrid profile. Its ES256 protected header uses
  `alg: ES256`, `typ: JWS`, and a key identifier when supplied by the signer.
  A kidless historical signer must be evaluated only against an unambiguous
  reviewed classical key, never against a record-selected key.
- `2.1.0` is the `extended-v1` hybrid profile. Its ES256 protected header must
  additionally contain `uceRecordFormat: extended-v1` and
  `crit: ["uceRecordFormat"]`; unknown critical or payload-encoding extensions
  cannot be ignored. A PEM or kidless-JWK publisher signer can use an RFC 7638
  SHA-256 JWK-thumbprint URI as `kid`. This is resolved only within the trusted
  public-key registry.
- The Extended public hash projection covers more fields than Standard. Both
  projection and signature must pass before claiming covered-content integrity.
  A signature over the recorded hash alone does not authenticate every
  displayed field or resolve a digest mismatch. The Standard projection
  excludes work/title, policy/license, AI disclosures and file names, among
  other final-manifest fields. Publisher response flags are not local checks.

The public trust registry contains the previously reviewed P-256 key and a
1,952-byte ML-DSA-65 public key from the same immutable
[`JWKS transaction`](https://arweave.net/8IQIcijOSMO0dtKrNsVPTFbJBGiIaL6x9EsUW4UdApQ).
The pinned raw post-quantum public key has SHA-256
`57e679254e52c8a546fccae09c4c269943e1b01a6003ca7c98ce5261aabe009b`.
Candidate quantum key selection is bounded to reviewed public entries; a
manifest's `publicKeyRef`, `libraryVersion`, metadata, or arbitrary URL never
establishes authority or selects executable code. Rotation requires retained
historical public keys and a reviewed registry update. No private signing key
or publisher configuration is included in Lens.

## What the synthetic interoperability fixture proves

[`hybrid-interop.json`](../../tests/fixtures/hybrid-interop.json) freezes only
public EC and ML-DSA-65 keys, a 32-byte message, standard and Extended ES256
JWS values, and an ML-DSA-65 signature. Its generator creates ephemeral test
keys in memory and imports only an explicitly named installed publisher
cryptography-library file; it does not import publisher application code, read
settings, create a permanent record, or publish to Arweave. The default
fixture check needs no publisher checkout.

The publisher-installed `@noble/post-quantum@0.4.1` API signs with
`sign(secretKey, message)` and verifies with
`verify(publicKey, message, signature)`. The bundled client version `0.7.1`
verifies with `verify(signature, message, publicKey)`. The frozen synthetic
0.4.1 signature verifies under 0.7.1 and Node 24 native ML-DSA-65; tampered
bytes fail. This tests cryptographic interoperability for one artificial
message, **not** real issuance, the manifest envelope, historical key rotation,
or publisher/Lens agreement on an anchored record. The bundled library and
transitive MIT notices are in
[`THIRD-PARTY-NOTICES.txt`](../../public/THIRD-PARTY-NOTICES.txt).

## Remaining requirements before a release claim

Each of `2.0.0` and `2.1.0` needs its own completed review:

1. Obtain a genuine publisher-issued public manifest and immutable transaction
   reference, with provenance sufficient to distinguish it from a synthetic
   test or mutable server response. Confirm the format is actually enabled in
   the relevant environment without treating a feature flag in source as
   deployment evidence.
2. Independently reproduce the exact public canonical preimage, bytes and
   SHA-256 digest. Document signed and excluded fields. Pair the Lens result
   with the publisher's authoritative implementation; do not trust a reported
   `hashMatches` flag alone.
3. Verify both signatures against reviewed, version-appropriate public keys.
   Test key ID and thumbprint identification, unambiguous kidless Standard
   cases, retained old keys, revoked/missing/ambiguous keys, key-format and
   base64 failures, and inaccessible public key material.
4. Test digest, ES256 and ML-DSA-65 tampering separately; missing components;
   altered protected headers; unknown critical parameters; `2.1.0` schema
   stripping/downgrade; and mismatches between a supplied record identifier,
   retained manifest and displayed projection. Verify the same status and
   limitations in UI, WebMCP and exported reports in a real browser.
5. Review any publisher drift, update the compatibility registry and trust
   provenance, record paired positive/negative evidence, and obtain explicit
   release approval before adding either exact version to the qualification
   list. Do not make publisher, production, or permanent-record changes as a
   side effect of Lens tests.

The publisher public `/verify` route currently special-cases `2.1.0`; source
inspection indicates that `2.0.0` may fall into its flat-signature branch.
That is a separate publisher concern to confirm against a genuine public
hybrid record. Lens must neither silently trust the resulting `sigValid` flag
nor change the publisher under this candidate's authority.
