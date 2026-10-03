# Legacy and hybrid implementation checkpoint

Date: September 21, 2026 (America/New_York; browser checks continued after
02:00 UTC September 22). Candidate: `1.1.0-dev.0`, isolated branch
`codex/post-contest-v1.1.0`. Publisher contract:
`81abec2654ebd2f858ae4c6302a058ce7c1bb3de`.

## Outcome and limits

- Standard `1.0.0` now attempts exactly one reviewed public projection. An
  exact SHA-256 match passes with narrow coverage; nonmatches remain unresolved
  because historical preimage timestamps may not have survived. There is no
  timestamp search, alternate-recipe fallback, migration or reliance on a
  publisher verification flag. Work/title, license/policy, AI disclosures and
  file names are outside this older hash coverage.
- Extended `1.1.0` continues to recompute the broader reviewed projection and
  verify the critical-profile ES256 signature against its reviewed key.
- Both hybrid `2.0.0` and `2.1.0` have local hash and dual-signature engines.
  ES256 and ML-DSA-65 must each validate the same recorded 32-byte digest.
  Keys come only from bounded reviewed registries. Standard kidless issuance
  requires exactly one trusted classical key; Extended signatures require the
  exact protected format marker. Key references and library labels cannot
  initiate fetches or establish trust. Component outcomes and provenance are
  retained for reports and optional UI details.
- Hybrid runtime activation remains disabled. No genuine publisher-issued
  public `2.0.0` or `2.1.0` fixture was available. Synthetic test success does
  not qualify production issuance. The UI explicitly says cryptographic
  verification is incomplete; agent reports preserve the same limitation.

## Checks performed

- `npm run check`: formatting, lint, TypeScript, deterministic hash vectors,
  hybrid interoperability check, **376 tests across 20 files**, production build.
- `npm run contract:hash:publisher -- /absolute/path/to/cbynft-main`:
  **23 comparisons passed**, with publisher revision and pure-function source
  contents checked before executing the read-only comparison.
- `npm run contract:hybrid:check`: a synthetic publisher-library `0.4.1`
  ML-DSA-65 signature verifies under client library `0.7.1` and Node 24 native
  ML-DSA. Separate tests cover complete synthetic preimage-to-dual-signature
  chains for both versions and reject a changed ML-DSA context.
- Negative cases include changed digests, broken/missing signatures, wrong
  payload encoding, unknown/revoked/ambiguous keys, fingerprint drift, malformed
  base64, critical-header stripping, mixed formats, and unknown hash profiles.
- Runtime dependency audit: no currently reported npm advisories. This is not
  a claim of a comprehensive security audit. MIT dependency notices are
  included in the static build; MPL and separate mark/artwork terms remain.

## Actual browser / WebMCP checks

Tested the built static candidate at loopback `http://127.0.0.1:5174/` using
the in-app browser, without changing production or browser permissions.

1. The actual bundled `cc94e8…` public manifest recomputed to its exact digest
   (1,333 canonical UTF-8 bytes), and its ES256 signature passed. Direct Arweave
   chronology also passed, with 14,356 confirmations observed for block
   1,991,550. The visible result and actual WebMCP report included narrow
   coverage exclusions.
2. The captured genuine `d16afb…` Extended `1.1.0` public fixture was pasted
   through the UI. Hash recomputation and ES256 verification passed. This
   browser step tested pasted input, not live CbyUCE retrieval from localhost.
3. A complete synthetic `2.1.0` display fixture showed the explicit incomplete
   cryptographic-verification summary. The actual WebMCP report returned
   unsupported hash/signature checks and `not_recomputed` coverage, not a
   synthetic verification pass. Both hybrid versions are also tested in the
   automated UI-state/tool/export parity tests.
4. Eight real page tools were discoverable; the report and public-record load
   tools were invoked. The browser was restored to the bundled demo. No browser
   warning/error entries were captured in the final log check.

A separate read-only HTTP check confirmed the user-deployed CbyUCE CORS update
returns JSON and the exact candidate origin `https://uce-evidence.edyoungprojects.com`.
No localhost exception or proxy was added.

## Remaining qualification

Obtain one genuine public publisher-issued record for **each** hybrid version,
including its immutable manifest reference, and complete the paired checks in
[Hybrid qualification](HYBRID-QUALIFICATION.md). Confirm the publisher's `2.0.0`
verification-route handling separately; the reviewed route appears to use its
flat-signature path for that version. Do not treat server flags as the result.

The submitted main checkout, production deployment and permanent evidence are
unchanged. Candidate work remains uncommitted; no push, merge, release archive,
payment or new permanent UCE record was performed in this implementation step.
