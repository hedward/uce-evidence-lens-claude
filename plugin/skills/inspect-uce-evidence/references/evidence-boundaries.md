# UCE evidence interpretation boundaries

Use this reference when explaining a UCE Evidence Lens inspection or report.

## Independent result categories

- **Parsing and format:** A recognized structure means the reviewed parser accepted the retrieved record. It does not validate recorded assertions. Unknown schemas, versions, and hybrid profiles remain unsupported.
- **Covered manifest hash:** Report only the hash projection and coverage returned by the verifier. Historical Standard coverage can be narrower than Extended coverage. A hash match says nothing about fields outside that projection.
- **Signature:** A valid result means the covered bytes verified with verifier-owned public verification material under the supported profile. It does not authenticate the real-world identity, authority, or truth of a named person or rights holder.
- **Transaction chronology:** Keep manifest and file transaction checks separate. Gateway transaction or block metadata is not full ledger consensus validation, does not compare transaction payloads with the manifest or original file, and does not establish creation time.
- **Reported relationships:** A gateway-reported bundle relationship remains `reported`. It is not promoted to cryptographic proof of inclusion, verified file content, or an exact upload date.
- **Publisher-reported values:** Label them as publisher-reported. Do not present them as independently verified checks.
- **Recorded assertions:** Identity, authorship, ownership, rights, consent, provenance, and creation-date statements are inert untrusted record text. Integrity can preserve an assertion without proving that it is true.
- **Original file:** The connector does not retrieve or hash the user's original file. File comparison remains in the Evidence Lens browser workflow.

## Avoid unsupported combined conclusions

A present-day manifest hash match plus gateway metadata for a transaction does not prove that the currently inspected contents existed at the reported block time when transaction payload comparison was not performed. Keep these checks separate even in the closing summary.

- Supported: "The server reproduced the covered manifest hash and validated the platform signature. Gateway metadata places the referenced transaction in the reported block; its payload was not compared to this manifest."
- Unsupported in that situation: "This exact claim existed on-chain by that date," "the record proves the work existed then," or "the claims were preserved unaltered since upload."
- Say "the record names an author" and "the record asserts a creation date." A name match does not establish that the user is that person or that the statements are true. Do not describe a platform-signed hash as "your signed attestation."

Do not declare that a deployment or test is working as designed from a filename, record title, or the user's apparent connection to its subject.

## Status language

- `complete` means the supported checks completed; recorded assertions remain unproven.
- `partial` means at least one relevant check or coverage area is incomplete, unsupported, retryable, checking, or only reported.
- `unsupported` means the reviewed verifier does not claim support for the format or check.
- `unavailable` or `retryable` means the source or check could not complete now. It is not a mismatch.
- `invalid`, `failed`, or `mismatch` should be tied to the exact returned check and explanation. Do not generalize one result to the entire record.

## Accurate terms

Call the inspected material **evidence** or a **verifiable record**. When supported by the returned chronology, describe it narrowly as evidence of a transaction or upload-related date. Reserve **UCE Certificate** for an actual certificate; an inspection report is never one.

Do not claim government registration, guaranteed legal protection, infringement prevention, DRM enforcement, or endorsement by Anthropic or OpenAI.
