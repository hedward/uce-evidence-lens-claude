# Hash-contract vector verification

Status: **local draft, synthetic/unsigned examples, not a released verifier**.
September 21 addendum: the [Extended runtime checkpoint](EXTENDED-1.1-VERIFICATION.md)
adds one real public fixture, strict raw-input tests, runtime verification and
browser/WebMCP checks. Historical results below describe the September 20 lab
stage. The paired checker now makes 23 comparisons, including the public record.
Source review date: September 20, 2026. Publisher revision:
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de`.

## Package

- `tests/fixtures/hash-profiles/vectors.json`: ten synthetic public-shaped
  manifests, exact preliminary inputs, canonical strings, UTF-8 hex, hashes and
  field mutations; six serializer inputs, each with both serializer outputs.
- `tests/contracts/hash-profile-reference.ts`: separately written **test-only**
  projection/serializer. No application imports or runtime capability changes.
- `tests/contracts/hash-profiles.test.ts`: frozen-vector, mutation, WebCrypto
  digest, input-boundary, coverage and no-runtime-enablement tests.
- `scripts/generate-hash-profile-vectors.ts`: deterministic generator. Default
  mode checks existing bytes; `--write` is required to intentionally replace
  the golden file. Changing expected hashes is never a substitute for review.
- `scripts/check-publisher-hash-contract.mjs`: optional local comparison against
  selected pure functions read from the explicit publisher checkout. No source
  code is copied into the package.

All newly generated names, claims, signatures and transaction references are
synthetic. `NOT-A-SIGNATURE` and `SYNTHETIC` are deliberate placeholders. These
are hashing fixtures, not valid signed certificates or proof of deployment.
They must not replace the live/bundled demo or be submitted to permanent storage.

## Reproduce (Node.js 24+)

From the isolated Lens candidate:

```sh
npm run contract:hash:check
npx vitest run tests/contracts/hash-profiles.test.ts
npm run check
```

Optional cross-implementation comparison (requires separately authorized access
to the existing local publisher checkout; it is not a public build dependency):

```sh
npm run contract:hash:publisher -- /absolute/path/to/cbynft-main
```

The checker verifies publisher HEAD and exact working file contents against the
pinned commit before execution. It extracts only named pure functions using the
TypeScript parser, executes them with bounded VM calls and synthetic inputs,
and prints comparison counts and source-file digests. It never imports/starts
Meteor, connects to a database, reads settings or keys, signs, pays, uploads,
fetches network records or writes to the publisher checkout. The VM is an
execution aid, not a security sandbox for hostile code; only use reviewed source.

## Independent comparison scope

For standard records the publisher's preliminary builder is exercised with
synthetic upload facts, including its real attestation/source helpers. For
extended records its public-manifest projection is exercised directly. Both
actual serialization helpers are compared byte-for-byte with the independent
lab's frozen outputs. SHA-256 is also checked using WebCrypto in the tests,
separately from Node's hashing API used for generation.

This is **not** a complete publisher issuance/verification test: extended
upload-to-manifest construction, full schema/rights validation, CryptoJS's
digest helper, signing, hybrid/critical-header verification, storage and the
production API are not exercised by this script. Real approved public extended
records and paired publisher review remain required. No timestamp recovery or
legacy migration is attempted.

## Observed results

- Full candidate check passed: formatting, lint, types, deterministic vector
  reproduction, **263 tests across 14 files**, and production build.
- Local browser smoke check retained the explicit not-recomputed limitation,
  showed a valid bundled signature and confirmed Arweave chronology, and
  exposed eight discoverable read-only WebMCP tools. The coverage disclosure
  expanded correctly. No new runtime hash claim was enabled.
- Original submitted checkout and CbyUCE checkout remained unchanged; all new
  package work is local, uncommitted, and not deployed.

The read-only publisher comparison reproduced all ten record preimages and
canonical outputs, plus twelve serializer outputs (six inputs × two recipes).
The frozen corpus includes standard/hybrid and extended/hybrid shapes, optional
block omissions, Figma/Ableton/Pro Tools source blocks, and both older and current
1.3.1 attestation structures. Source presence is not a deployment claim.

The bundled public logo record independently reproduced this recorded digest
offline under the explicitly assumed current standard recipe:

```text
cc94e8d529cfc24f6fe458470b69dca2c3ef53a78b740bb1fea9cc40d09cfd1c
```

September 21 runtime update: this public record now receives a positive-only
Standard recomputation match in the isolated candidate, with explicit field
coverage exclusions. A single compatible public example does not prove all
unprofiled Standard records are reconstructible; nonmatches remain unresolved.

One important counterexample is frozen: `{"2":"two","10":"ten"}` emits
different bytes under the two publisher serializers. Neither the common wire
label nor a passing ordinary-string-key example permits treating them as
interchangeable. A small historical timestamp-drift test preserves an honest
unsupported result; it does not introduce historical recovery infrastructure.

## Release-only negative cases still required

The object-level lab rejects unpaired surrogates, non-finite values, non-JSON
objects, sparse/cyclic/deep shapes, unsupported markers, missing original
fields, unknown wire profiles and contradictory standard/extended markers.
Raw duplicate-property detection cannot be tested after `JSON.parse` has already
discarded the duplicate. The runtime implementation must add raw transport
tests, for example:

```json
{ "schemaVersion": "1.1.0", "schemaVersion": "1.0.0" }
```

That input must be rejected, not silently downgraded. Raw numeric precision,
full schema validation, protected-header stripping, tampered signatures/keys,
and production browser/report/WebMCP parity are separate activation gates.
