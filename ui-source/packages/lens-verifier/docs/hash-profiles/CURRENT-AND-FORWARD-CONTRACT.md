# CbyUCE manifest hashing: current contract and forward plan

Status: **source-pinned contract; Extended 1.1.0 and positive-only Standard 1.0.0 now implemented in the isolated candidate**. The [Extended checkpoint](EXTENDED-1.1-VERIFICATION.md) and [hybrid qualification gate](HYBRID-QUALIFICATION.md) supersede historical preparation-stage descriptions below. Hybrid 2.x engines are tested locally but not enabled in the product pending genuine publisher-issued fixtures. No production release is implied.
Reviewed September 20, 2026 against CbyUCE commit
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de`. Source presence is not deployment
evidence. This document describes an observable data contract, not proprietary
publisher implementation. No existing record is changed.

## Priority and scope

The product priority is current and forward compatibility. Do not build
historical timestamp recovery, migration,
brute-force recipe search, or speculative legacy adapters. Older records remain
readable; a successful exact Standard projection may establish narrow hash coverage, but a nonmatch remains unresolved. Do not assume this means every
existing customer record is disposable or that reissuance is authorized.

This package prepares reproducible hashing rules and synthetic examples. It does
not verify signatures, create records, change CbyUCE defaults, deploy software,
or turn on a new Lens verification claim. The suggested activation order is:

1. Review and prove the current extended 1.1/2.1 hash recipe.
2. Define an explicit, hash-bound profile discriminator for future issuance.
3. Enable independently tested Lens checks per reviewed profile, with signature
   support and public-key review as separate gates.

## Four source-pinned draft recipes

These are **local specification identifiers**, not identifiers already emitted
in `hashes.profile`, not new manifest schema versions, and not app versions.

| Schema version | Draft recipe ID                      | Serializer             | Coverage family  |
| -------------- | ------------------------------------ | ---------------------- | ---------------- |
| 1.0.0          | `cbyuce-standard-1.0-draft-20260920` | standard-ecmascript-v1 | Narrow standard  |
| 2.0.0          | `cbyuce-standard-2.0-draft-20260920` | standard-ecmascript-v1 | Narrow standard  |
| 1.1.0          | `cbyuce-extended-1.1-draft-20260920` | extended-lexical-v1    | Broader extended |
| 2.1.0          | `cbyuce-extended-2.1-draft-20260920` | extended-lexical-v1    | Broader extended |

Schema version alone does not authorize historical standard reconstruction.
The laboratory requires an explicit assumption of the pinned publisher revision;
that assumption must not be made silently for arbitrary public records.

## Input and lifecycle

The input is the complete validated public **manifest**, not the API envelope
`{manifest, verification}`, HTML, a display model, or a server `hashMatches` flag.

Creation sequence: accepted file bytes → file digest/Merkle root → preliminary
manifest input → serialization → UTF-8 → SHA-256 → sign the resulting digest →
anchor manifest → attach delivery/confirmation information. The digest cannot
include itself or a signature made from it. The manifest transaction ID is not
known when its content is hashed. File anchoring and manifest anchoring are
different references; extended hashing can include the already-known file anchor.

All copies below preserve original JSON values, including strings, dates,
newlines and array order. Do not trim, translate, normalize Unicode, convert
dates, insert display defaults, or reduce complete blocks to UI-selected fields.

## Standard 1.0/2.0 exact projection

Construct a NEW object with only the following paths. All unlisted paths are
excluded; do not start with the finished manifest and guess deletions.

| Path in hash input              | Rule                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `schema`, `schemaVersion`       | Copy; validate exact recognized values first                                              |
| `source`                        | Copy the complete object if present; absent stays absent                                  |
| `files`                         | Exactly one item containing only the recorded `bytes` and `sha256`                        |
| `hashes.merkleRoot`             | Copy                                                                                      |
| `hashes.algorithm`              | Literal `sha256`; reject contradictory incoming label                                     |
| `hashes.canonicalization`       | Literal `RFC8785`; validate label but see actual serializer caveat below                  |
| `identity.assurance.level`      | `IAL1`; validate recorded value                                                           |
| `identity.assurance.methods`    | Copy the single recorded authentication method array                                      |
| `identity.assurance.verifiedAt` | Copy exact recorded string, ONLY where the construction profile is established            |
| `attestations`                  | Copy the complete object; never regenerate oath text or timestamps                        |
| `anchors`                       | Replace with exactly `{"arweave":{"txId":""}}`                                            |
| `audit`                         | Replace with exactly `[]`                                                                 |
| `signatures`                    | Replace with exactly `{"platformSignature":"","platformPublicKeyRef":"dev-platform-key"}` |

The historical key placeholder is input data, **not** the trusted verification
key. Actual signing keys still require a separate trusted-key verification.

Excluded final fields include `work`, `policy`, `aiProvenance`,
`manifestVersion`, `registrationTimestamp`, `generatedBy`, file metadata beyond
size/digest, `hashes.manifestHash`, actual signatures, actual anchors including
file storage, actual audit events, and standard 2.0 `metadata`. `recordDetails`
is contradictory on a standard record, not permission to ignore an extension.

A standard hash match cannot authenticate these excluded details. Its file
digest can support a separate local-byte comparison; this task does not add
Merkle-tree validation or extend file count support.

## Extended 1.1/2.1 exact projection

Require `recordDetails.format === "extended-v1"` and the reviewed schema/signature
profile combination. Construct a new object containing:

| Paths                                                                                  | Rule                                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `schema`, `schemaVersion`, `manifestVersion`, `registrationTimestamp`, `generatedBy`   | Copy complete values                                                                                             |
| `files`, `identity`, `attestations`, `work`, `policy`, `aiProvenance`, `recordDetails` | Copy complete blocks, including nested values                                                                    |
| `metadata`, `source`                                                                   | Copy complete objects if present                                                                                 |
| `hashes`                                                                               | Only `merkleRoot` plus literal `algorithm: "sha256"` and `canonicalization: "RFC8785"`; validate incoming labels |
| `anchors`                                                                              | New object containing only `fileStorage` if present, otherwise `{}`                                              |

Exclude the entire signatures block, `audit`, `anchors.arweave`, the manifest's
own hash, and all other unlisted top-level fields. In particular, the extended
recipe uses **no empty arweave placeholder and no signature placeholder**.
Unlike standard 2.0, extended 2.1 includes its `metadata` block.

Unknown nested fields inside a copied block affect its digest; unknown top-level
fields do not automatically gain coverage. UI and agent reports must use this
explicit coverage definition, never the phrase "every field verified".

The publisher additionally checks reconstructed `recordDetails` and agreement
between `recordDetails.license` and `policy.license`. Matching the digest alone
does not substitute for that structural/semantic validation. These checks and
critical JWS header handling belong in the later production verifier.

## Exact serialization and admissible input

For both recipes: no insignificant whitespace, array order retained, JSON
primitive serialization per ECMAScript, UTF-8 without BOM or trailing newline,
SHA-256, lowercase 64-character hexadecimal output. Compare calculated digest
bytes to the recorded hash; excluding the self-hash never means ignoring the
comparison target.

`standard-ecmascript-v1` describes historical ECMAScript object enumeration:
array-index-like keys (canonical decimal 0 through 4294967294) first in numerical
order, then remaining keys in UTF-16 code-unit lexical order, recursively.
`extended-lexical-v1` emits all object keys in UTF-16 code-unit lexical order,
including numeric-looking keys. These are NOT interchangeable for arbitrary JSON:

| Input                    | Standard bytes           | Extended bytes           |
| ------------------------ | ------------------------ | ------------------------ |
| `{"2":"two","10":"ten"}` | `{"2":"two","10":"ten"}` | `{"10":"ten","2":"two"}` |

[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) specifies lexical key ordering
and I-JSON constraints. The current wire label does not establish full
conformance of both publisher helpers. Preserve historical behavior under an
explicit compatibility profile; do not silently replace the standard serializer
with strict JCS or rewrite historical hashes. Any future serializer change needs
its own versioned profile and tests.

The draft lab restricts inputs to JSON trees, finite numbers, valid Unicode,
dense arrays, no cycles/repeated object references, no own `__proto__` keys, and
depth at most 40. Standard file sizes are nonnegative safe integers. These are
conservative lab boundaries, not a claim that the publisher enforces every one.
The future production verifier must retain Lens's stricter transport-size and
resource limits and validate the full per-version manifest schema.

Absent optional objects are omitted; present `null`, false, zero or wrong-type
optional blocks are rejected by the lab rather than copying the publisher's
truthiness shortcuts. An absent required input is unsupported/malformed, never
reconstructed from a guessed date, account method, title, or license. Null,
empty string, empty array and absent properties stay distinct where allowed.
Unicode is not normalized; composed and decomposed strings can hash differently.

Duplicate properties must be rejected while parsing RAW JSON; `JSON.parse`
alone loses that evidence. The object-only lab cannot detect duplicates after
parsing. This remains an explicit production-parser gate, not a passed test.
Likewise lossless/raw numeric handling and unsupported critical JWS extensions
must be addressed before production activation.

## Historical limit: containment, not a recovery project

CbyUCE commit `4abe4ac5768fcbc019dd68d0f0676b63790e4936` introduced deterministic
preimage timestamps. Its predecessor used separate wall-clock calls for
preimage identity/attestations and the final manifest skeleton, under the same
1.0/2.0 schema labels. Earlier preimage times may not survive in public JSON.

Therefore an unprofiled older standard record must not become a tampering
"mismatch" merely because the current recipe gives a different answer. Do not
brute-force milliseconds or choose a recipe by trying until a digest matches.
Leave that check unsupported unless a separately approved construction binding
exists. Do not republish, migrate or charge any customer to close this gap
without explicit authorization.

The bundled public logo record `cc94e8…cfd1c` DOES reproduce exactly under the
current experimental standard recipe in an offline test. This positive example
does not prove universal history coverage or authorize runtime activation.

## Forward contract proposal — separate publisher approval required

For newly issued records, prefer the broader extended coverage. Decide explicitly
whether new standard issuance should continue; no default is changed here.

The next publisher contract should give new records an explicit profile ID
(proposed location `hashes.profile`) that is INCLUDED in the hashed input. A
version/profile combination and, where required, critical signature binding
must prevent stripping or downgrading it into an older recipe. Merely appending
an unhashed label to existing records is not an acceptable binding.

Do not retrofit that field into immutable records or change the meaning of
existing 1.1/2.1 verification. Because adding a hashed field changes the recipe,
assign and review a distinct schema/profile combination for future issuance;
the final identifier/version is intentionally not invented here. New labels,
key selection, critical headers, publisher verification and Lens dispatch must
ship as a coordinated contract. Unknown combinations remain unsupported.

Retain stable contract versions and permanent vectors. A CbyUCE PR affecting
generation, projection, serialization, signing, or connector source data must
update the paired compatibility review before Lens promises that format.
Support for a Figma/Ableton/Pro Tools source object means recorded context is
hash-bound, not that Lens has authenticated a host app, creator, or DAW session.
Future Logic Pro/VST3/FL Studio provenance requires its actual publisher
contract, not a guessed connector block.

## Evidence and remaining approval gates

- See [vector verification](VECTOR-VERIFICATION.md) for commands and scope.
- Synthetic unsigned fixtures are not publisher-issued public records. A draft
  locally stored in this clone is not a published standard.
- Full RFC serializer/parser conformance, production-issued representative
  extended records and paired publisher approval remain outstanding.
- Hash, signature, local-file and chronology checks must remain distinct in UI,
  WebMCP and reports. Never turn publisher `hashMatches` into a local pass.
- Activate no production verification claim until the relevant profile, input
  validation, vectors, real public fixtures and supported signature/key handling
  pass review. No main merge or deployment is authorized by this document.
