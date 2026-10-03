# Extended 1.1.0 verification checkpoint — September 21, 2026

Status: implemented in the isolated `codex/post-contest-v1.1.0` candidate.
This is not a production deployment, public-main merge, or release approval.

## Production contract evidence

The user identified CbyUCE Galaxy v76 as deployed from commit
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de`. The issued public record is:

- [CbyUCE verification](https://cbyuce.com/verify/d16afbafda0ef0bf1be29d4f89e8629fc2aa0eae55da30103aeb5e6a59abd9a5)
- [Raw Arweave manifest](https://arweave.net/jD5LXPMg9hJM-oUTTggKiHavSs1ndPhDufLu5cL6Vc8)
- `tests/fixtures/extended-production.json`: exact public manifest values.
- `tests/fixtures/extended-production-vector.json`: exact projected object,
  canonical string, UTF-8 hex and expected digest (3,201 canonical bytes).

The raw Arweave JSON became retrievable during this checkpoint. It differs from
the public API manifest only in the expected post-upload `anchors.arweave.txId`:
the immutable raw record has the empty pre-upload value. That excluded field is
not guessed into the hash. Raw JSON was 4,137 bytes, SHA-256
`523f518e36a544e4c4503d1a021b021608887cc18832017ab4ec9f15ec0e1b67`;
this transport hash is distinct from the canonical manifest hash.

## Exact supported contract

Local profile ID `cbyuce-extended-1.1-81abec26` is a Lens compatibility label,
not a new field in existing manifests. Runtime dispatch requires schema 1.1.0,
manifestVersion 1, Extended marker `extended-v1`, the reviewed hash labels, and
the exact supported critical JWS header. `hashes.profile` is not currently on
the wire; any such new field requires fresh review. No recipe-search fallback.

The projection and lexical serializer are specified in
[the current/forward contract](CURRENT-AND-FORWARD-CONTRACT.md). Runtime code is
independently implemented, not imported from publisher source or the test lab.
It preserves original JSON values, uses lexical UTF-16 object-key order and
UTF-8 SHA-256, and does not hash the normalized display model or API flags.

Covered: generation/version fields, work, full file descriptors, identity,
attestations, policy, AI disclosures, Extended record details, optional complete
metadata/source, Merkle root/hash labels and optional file-storage anchor.
Excluded: signatures, audit, manifest self-hash, manifest Arweave anchor and
unlisted top-level fields. A covered assertion remains an assertion, not a
proven fact; a hash match alone does not establish a trusted signer.

Raw parsing rejects duplicate decoded property names, malformed Unicode,
nonfinite/unsafe/lossy numeric literals and existing resource-limit violations.
UTF-8 decoding is fatal on malformed bytes. Object inputs receive additional
bounded retention checks. Unknown critical headers, profile labels, and
unsupported public-detail shapes do not become passes. Extended license fields
must agree with the reviewed normalized declaration; no normalization occurs
to force a match. Empty optional author lists remain supported.

## Verification

- Final local pipeline passed: formatting, lint, TypeScript, deterministic
  vectors, **314 tests across 16 files**, and the production Vite build.
- Read-only comparison against the pinned publisher passed **23 comparisons**.

- Runtime reproduces the real recorded digest and validates its actual ES256
  JWS against the existing reviewed P-256 key. Key provenance remains separate
  from the inspected record source.
- Frozen vectors agree across the independent lab, browser runtime and pinned
  publisher projection/serializer. `npm run contract:hash:publisher -- PATH`
  additionally compares the real production preimage and canonical bytes.
- Tests alter covered titles, file metadata/digests, license, Extended notes,
  identity, attestations, AI disclosures, generation dates and file anchoring.
  Hash mismatches remain failures even if the unchanged digest signature passes.
- Unknown profiles, stripping/unknown critical headers, duplicate keys, numeric
  precision, unsupported formats, excluded fields, and report parity are tested.
- Local in-app browser invoked the actual `load_uce_public_record`,
  `verify_uce_record`, and `get_uce_verification_report` WebMCP tools. The live
  raw manifest's hash/signature passed; chronology bound block 2,005,758 at
  2026-09-21T21:08:55Z (23 confirmations at observation). The report's checks
  matched the UI snapshot and did not include local file information.
- Direct Arweave input correctly does not claim a separately supplied CbyUCE
  record-identifier check. That limitation remains visible in technical details.
- A pasted local copy with an altered title visibly produced **Mismatch** and
  the overall integrity warning, despite the unchanged digest signature passing.
  Reloading the genuine Arweave record restored the successful checks. No
  browser warnings or errors were recorded in that final smoke test.

## Remaining production steps

1. Review the candidate diff and current publisher contract together. Do not
   infer future compatibility from the schema label or a successful old fixture.
2. The user separately deployed the exact-origin CORS fix. September 21 and 22
   public-response checks confirm `https://uce-evidence.edyoungprojects.com`
   authorization, with no credentials or wildcard. September 22 also preserved
   the submitted origin and withheld permission from a lookalike origin. These
   response probes are not proof of a complete Meteor route-test/build run.
   CbyUCE production was not changed by Lens QA.
3. Real candidate-origin CbyUCE loads passed after DNS was restored on September
   22: Extended `d16afb…` and Standard/Figma `cc7680…` passed independent browser
   checks. The preview is still a Vite development server without the configured
   production headers. Serve the approved packaged artifact with those headers
   and repeat the smoke check before production-equivalent sign-off.
   See [release QA](../RELEASE-QA.md#restored-preview-actual-origin-smoke-check).
4. Obtain separate release/contest-clearance approval, preview-test, commit,
   merge and deploy only then. Preserve v1.0.0 evidence.
5. Keep hybrid 2.x verification and ambiguous standard reconstruction disabled.
   A future hash-bound explicit profile needs a coordinated publisher contract;
   do not append an unhashed label to immutable records.
