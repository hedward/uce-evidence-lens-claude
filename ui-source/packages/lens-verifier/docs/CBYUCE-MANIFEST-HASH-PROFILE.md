# CbyUCE Manifest Hash Profile — Specification Handoff

Status: **Extended 1.1.0 and positive-only Standard 1.0.0 recomputation enabled in the isolated candidate; not approved for production release.** See the [Extended evidence and limits](hash-profiles/EXTENDED-1.1-VERIFICATION.md) and [hybrid qualification gate](hash-profiles/HYBRID-QUALIFICATION.md). Hybrid 2.x hash/signature engines are implemented but remain laboratory-only pending genuine public issuer examples.

Start with the [current and forward contract](hash-profiles/CURRENT-AND-FORWARD-CONTRACT.md)
and [vector verification record](hash-profiles/VECTOR-VERIFICATION.md). They
provide exact source-pinned projections, serializer behavior, coverage limits
and executable synthetic examples. The requirements below remain release gates.

Product priority is current and newly issued records, not historical recovery.
Standard 1.0/2.0 labels span older timestamp construction and the current
deterministic recipe; version alone cannot justify a tampering verdict. The
first runtime target should be reviewed extended 1.1/2.1 hash coverage, followed
by an explicit hash-bound profile for future issuance. No record migration,
reissuance, signing, payment, database or production change is part of this step.

September 20 compatibility update: CbyUCE now implements extended 1.1/2.1
preimages and a critical signature extension. Standard profiles have narrower
coverage. This handoff remains the acceptance gate for public vectors and an
independent Lens implementation, not a claim that no newer publisher profile
exists. See [current compatibility](MANIFEST-COMPATIBILITY.md).

Evidence Lens must not claim independent recomputation until the relevant
versioned preimage and public vectors pass paired review. This document defines
that acceptance contract; it does not change existing records.

## Required profile decisions

The CbyUCE specification must assign a stable profile identifier and define, without implementation-dependent wording:

1. The exact root object hashed (for example, `manifest`, never the delivery envelope).
2. Every included and excluded field, including `hashes.manifestHash`, signatures, anchors, audit additions, server verification fields, and other values produced after the digest.
3. Whether excluded fields are removed, replaced by a fixed value, or represented by an explicit placeholder.
4. JSON data-model constraints before canonicalization: duplicate keys, Unicode validity, number range and representation, absent versus `null`, and unsupported values.
5. Canonicalization algorithm and version. If RFC 8785/JCS is used, the specification must cite it normatively and define any stricter schema constraints.
6. Digest algorithm, digest-byte encoding, and case requirements.
7. The record-creation sequence: preimage construction, canonicalization, hashing, signature creation, anchoring, and later verification metadata.
8. Versioning and migration behavior for existing records whose construction profile is absent.

## Required public test vectors

CbyUCE must publish machine-readable fixtures containing:

- the original input object;
- the exact post-exclusion preimage object;
- canonical UTF-8 bytes or their hexadecimal encoding;
- the expected SHA-256 digest;
- a minimally changed input with a different expected digest;
- edge cases for Unicode, numeric values, empty objects/arrays, `null`, and field ordering;
- a legacy nonmatching record demonstrating that missing historical preimage facts remain unresolved rather than guessed; an exact match under the one reviewed public projection establishes only its documented narrow coverage.

At least two independent implementations must reproduce every vector before Evidence Lens enables the check.

## Proposed integration contract

The future public record should carry an explicit profile identifier adjacent to the digest, such as `hashes.profile`, with that identifier INCLUDED in the hashed input and protected against downgrade. A new hashed field needs a distinct reviewed recipe/schema contract; do not append an unhashed label to existing records or silently change their verification. Evidence Lens should dispatch only on reviewed identifiers or an explicitly approved unambiguous existing-format mapping; unknown or ambiguous profiles remain **Not independently checked**. A supported profile implementation must:

- operate only on the validated public manifest;
- never consume the publisher's `hashMatches` result as input;
- compare locally computed digest bytes with `hashes.manifestHash` using an exact byte comparison;
- return **Verified** on equality and **Mismatch** on inequality for unambiguous Extended profiles; unprofiled Standard nonmatches remain unresolved/unsupported because historic preimage facts may be absent;
- retain regression vectors for every supported profile indefinitely.

## Release gate

Do not relabel “Independent manifest recomputation” as a consumer verification check until the profile, lifecycle, and public vectors are approved in CbyUCE and reproduced in Evidence Lens. This work should ship as a separate CbyUCE change followed by a separately reviewed Evidence Lens implementation.
