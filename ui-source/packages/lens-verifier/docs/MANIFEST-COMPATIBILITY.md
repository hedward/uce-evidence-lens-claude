# CbyUCE manifest compatibility

Reviewed: 2026-10-01
Publisher contract authority: CbyUCE `main` commit
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de`

This document defines both read/display and separately reviewed verification
capabilities in the release candidate. It is not production-release approval. The current implemented
CbyUCE publisher format is authoritative; local examples, inferred schemas, and
this compatibility table do not override it.

## Compatibility registry

| Manifest version | Profile                                                  | Read/display | Runtime signature verification                           | Runtime manifest-hash recomputation                                       |
| ---------------- | -------------------------------------------------------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `1.0.0`          | Standard, flat ES256                                     | Supported    | Reviewed flat ES256 only; reject critical/unknown JWS    | Positive-only public projection; historical non-matches remain unresolved |
| `1.1.0`          | `extended-v1`, flat ES256 with critical protected header | Supported    | Exact critical header and reviewed ES256 public key      | Reviewed Extended public projection                                       |
| `2.0.0`          | Standard hybrid ES256 + ML-DSA-65                        | Supported    | No pass: local engine awaits public-record qualification | No pass: laboratory projection is not release-qualified                   |
| `2.1.0`          | `extended-v1` hybrid ES256 + ML-DSA-65                   | Supported    | No pass: local engine awaits public-record qualification | No pass: laboratory projection is not release-qualified                   |

An unknown future version is rejected as unsupported. Recognizing a version
means only that its public JSON can be parsed into a bounded display model. It
does not imply complete JSON Schema validation, cryptographic coverage, key
trust, authorship, ownership, or truth of recorded assertions.

The registry lives in `src/records/manifest-compatibility.ts`. Callers must use
its exact-version capabilities rather than inferring behavior from a `1.*` or
`2.*` prefix. In particular, a `1.0.0` version label is not permission to ignore
an unknown or critical JWS protected header. A stripped or contradictory schema
marker must never downgrade an extended critical signature into the standard
verification path.

## Read and display invariants

- The parser retains a detached, bounded copy of the complete public manifest
  in `UceRecord.publicManifest`. Unknown JSON fields are retained for future
  compatibility and hash-profile review; resource-exhaustion shapes and
  non-JSON values are rejected.
- These retention bounds do not widen the loader's existing untrusted-JSON
  limits. Network and pasted JSON pass through the loader's stricter total-size,
  string, depth, array, and object limits first; the manifest retainer is an
  additional defense and not a promise to accept larger documents.
- `recordDetails` and connector `source` are retained separately for display.
  Their contents, licenses, provenance statements, and other creator or
  publisher claims remain **recorded assertions**, not authenticated facts.
- Exact supported labels remain `sha256` and `RFC8785`. Other algorithm or
  canonicalization labels are rejected rather than treated as trusted.
- Historical `1.0.0` records may omit schema-optional display fields. Missing
  filenames and work labels use explicit “not recorded” placeholders. A missing
  `manifestVersion` remains absent; Evidence Lens does not invent a recorded
  version.
- Present fields with invalid types are rejected. Compatibility handling does
  not silently convert malformed strings, objects, arrays, numbers, hashes, or
  transaction identifiers.
- Extended public license text is allowed within the reviewed public-record
  bounds. It is still rendered as inert text and is not interpreted as a legal
  conclusion.

The reviewed publisher implementation is represented by these public contract
areas: the evidence-manifest collection/schema helpers, the manifest builder,
the extended-record profile, the signing services, and the public verification
route. Evidence Lens summarizes their observable contract; it does not copy
publisher implementation code or private configuration.

## Profile boundaries

Standard `1.0.0` and `2.0.0` records do not hash every field present in the final
manifest. The reviewed Standard public projection covers schema/version, an
optional complete connector source, one file's byte count and SHA-256 digest,
Merkle root, identity assurance with its recorded timestamp, and attestations.
It excludes work/title, policy/license, AI disclosures, file names and other
descriptors, generated fields, hybrid metadata, audit events, signatures,
anchors, and the manifest's own hash. A `1.0.0` **match** may be reported as a
match for this narrow projection. Historical non-matches are **unsupported**
as a tampering conclusion: earlier records can lack their original preimage
timestamps under the same schema version. Lens does not guess alternative
timestamps or perform historical recovery.

Extended `1.1.0` now has a reviewed local runtime verifier, described in the
[production-fixture checkpoint](hash-profiles/EXTENDED-1.1-VERIFICATION.md).
It hashes the retained public manifest projection, not display values or server
flags. Original JSON is checked for duplicate decoded keys, invalid Unicode,
unsafe/lossy numbers and resource limits before parsing. A digest match and a
trusted signature are distinct checks. License agreement and normalized Extended
detail shape are validated without rewriting the input. Unknown critical headers
or wire hash profiles remain unsupported. Version `2.1.0` shares broader hash
coverage in the laboratory but is not enabled as a runtime pass.

The hybrid engine implements ES256 compact JWS and ML-DSA-65 verification over
the same 32-byte recorded digest, including the exact `2.1.0` critical header.
It uses only reviewed application-owned public keys. The public ML-DSA-65 key
is pinned from the same immutable JWKS as the existing P-256 key, with SHA-256
fingerprint `57e679254e52c8a546fccae09c4c269943e1b01a6003ca7c98ce5261aabe009b`.
The signature's key references and library labels are unsigned hints, never
trust roots, fetch URLs, or code-selection inputs. See the
[hybrid qualification record](hash-profiles/HYBRID-QUALIFICATION.md) for the
remaining public-record and paired-verification gates.

## Fixtures and release gates

The [hash-contract draft and vector package](hash-profiles/CURRENT-AND-FORWARD-CONTRACT.md)
pins the current publisher projections and compares independent synthetic
outputs with selected publisher functions. The September 21 real 1.1.0 fixture
and runtime tests additionally support the local capability listed above.
Product priority is current/future records, not historical recovery.
Older standard versions span different timestamp construction under unchanged
schema labels; leave ambiguous checks unsupported. Prefer reviewed extended
coverage and a hash-bound explicit profile for future issuance. See the
[verification scope](hash-profiles/VECTOR-VERIFICATION.md).

Read/display fixtures for `1.1.0`, `2.0.0`, and `2.1.0` are synthetic compatibility
documents. Their signatures, key references, library labels, and claims are not
real CbyUCE records. A separate synthetic hybrid cryptographic interoperability
fixture signs in memory with the publisher's installed `@noble/post-quantum@0.4.1`
algorithm and verifies with the client's `0.7.1` implementation and Node 24;
it is not a publisher-issued public record or release qualification. The existing bundled demo
continues to cover the original `1.0.0` experience. Separately,
`tests/fixtures/extended-production.json` is the actual public 1.1.0 record, not
synthetic; its source and immutable digest are documented in the checkpoint.

Cryptographic support for any additional profile is release-blocked until all
of the following exist and receive paired publisher/Lens review:

1. public fixtures issued by the publisher;
2. a versioned, reproducible hash profile with public canonical preimage and
   digest vectors;
3. reviewed public-key material and rotation/history rules;
4. downgrade and critical-header rejection tests; and
5. independent positive and tamper-negative verification tests.

Before every Evidence Lens release, compare the current publisher contract with
the pinned commit above. Any publisher drift requires updating this document,
the registry, synthetic read fixtures, and the paired review record before
release. Feature flags or implemented code paths must not be described as
deployed without separate deployment evidence.

## September 22 alignment recheck

The publisher checkout still resolves to the pinned revision above. A fresh
read-only `contract:hash:publisher` run passed all 23 comparisons. The reviewed
manifest/schema, preimage, serializer and signing implementation files have no
local drift. The only tracked publisher diff is the previously reviewed
candidate-origin CORS addition in the verification route and its test. Neither
publisher checkout nor candidate application source was modified by this review.

Fresh public Standard 1.0.0 (`cc94e8…`) and Extended 1.1.0 (`d16afb…`) API
manifests match the reviewed fixtures after allowing only the excluded
post-upload manifest self-anchor. The immutable Extended JSON is still 4,137
bytes with transport SHA-256
`523f518e36a544e4c4503d1a021b021608887cc18832017ab4ec9f15ec0e1b67`.
Both use the reviewed classical key; Extended retains its exact `extended-v1`
critical JWS header. Fresh browser verification of the live Extended Arweave
record passed hash recomputation, ES256 and independently retrieved chronology.

This confirms the reviewed source contract and these public records, not an
independently identified production deployment commit, new issuance, every
historical record or unknown future versions. PQ issuance is still outside
the current release scope and 2.x passes remain gated. After preview DNS was
restored, actual-origin CbyUCE retrieval and browser/WebMCP verification passed
for Extended `d16afb…` and Standard/Figma `cc7680…`. The preview still serves
Vite development modules without the configured production headers, so exact
production-artifact qualification remains open; see the
[restored-preview QA results](RELEASE-QA.md#restored-preview-actual-origin-smoke-check).

## September 29 alignment recheck

The publisher HEAD remains exactly `81abec2654ebd2f858ae4c6302a058ce7c1bb3de`.
All 23 independent publisher-contract comparisons pass again. Hash, serializer,
schema and signing sources have no local drift; the existing exact-origin CORS
route/test diff does not change their contract. Fresh public Standard/Figma
`cc7680…` and Extended `d16afb…` responses retain the reviewed schema and ES256
headers. Extended differs from the captured fixture only in the excluded
post-upload self-anchor. No publisher changes or new records were made.

Only 1.0.0 and 1.1.0 classical verification is release-qualified. The hybrid
qualification list remains empty, so 2.0.0 and 2.1.0 cryptographic checks remain
unsupported. Publisher response flags remain reported assertions.

## October 1 chronology correction (1.1.1)

Publisher HEAD remains `81abec2654ebd2f858ae4c6302a058ce7c1bb3de` and all 23
independent publisher-contract comparisons pass. The selected hash/preimage,
serializer and signing sources remain unchanged. The existing publisher CORS
route/test changes are outside that contract and were not modified.

The public Extended file `qPwf5AxunXpjpc9ZMAXUFXVOCdhR5COnfQDZxlP7mec` is indexed
inside ANS-104 bundle `3AMd3Dlx_0yWt77XY_MPupiERPQAGaGYM86Vzg_PtGk`. A direct
`/tx/<item>/status` request returns 404 even though the parent transaction has
confirmed block metadata. The previous generic retryable result omitted bundle
discovery. The new shared chronology path queries only a fixed Turbo Gateway
metadata endpoint, follows at most four validated parent links, and checks the
root transaction's status against its block hash, height and membership. Any
indexed block/date must agree. Requests have byte, time and depth limits;
redirects, cycles, malformed identifiers and arbitrary destinations cannot pass.

Bundle relationships remain **gateway-reported**, not cryptographically verified
item inclusion. The returned block date is an anchoring timestamp, not a proven
creation date or exact upload time. No original file or entire bundle is fetched.
The live captured fixture records block 2,005,758 at 2026-09-21T21:08:55Z and is
retained in `tests/fixtures/arweave-extended-bundle.json`. File chronology uses
the explicit file anchor, separately from the manifest anchor and publisher date.
UI, WebMCP and reports preserve this scope and incomplete verification coverage.

This update does not change any hash profile, signature rule, key, parser or
hybrid qualification. Versions 2.0.0 and 2.1.0 remain readable with their
cryptographic verification gates intact. The submitted historical v1.0.0
artifact and evidence record remain unchanged.

### October 1 gateway follow-up (1.1.2)

Publisher revision and contract remain unchanged. The 1.1.1 Cloud Run check
encountered HTTP 429 at arweave.net while browser checks succeeded. The 1.1.2
shared verifier permits one fixed Turbo Gateway status/block fallback only for
HTTP 429 or 5xx, with the existing bounds and identical metadata validation.
This changes availability, not hash/signature coverage or bundle proof strength.
Actual metadata sources are retained; invalid evidence is never bypassed.
