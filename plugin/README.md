# UCE Evidence Lens for Claude

UCE Evidence Lens is an authless, read-only Claude plugin for inspecting approved public Universal Creation Evidence records. Its remote MCP connector performs deterministic checks with the reviewed Lens verifier. Its single bundled skill helps Claude explain the returned format, covered hash, signature, chronology, recorded assertions, and coverage limits without overstating what they prove.

The connector accepts an explicit public CbyUCE record hash or verification URL, or an Arweave manifest transaction reference. The included skill requires the reference to be supplied in the current conversation and instructs Claude not to select one from memory or another conversation.

## Connect

Plugin installation and remote-connector connection are separate steps. Use the plugin install or import option available to your Claude plan and workspace, then open the plugin's **Connectors** tab and connect **UCE Evidence Lens**. The connector requires no UCE sign-in, account, API key, OAuth grant, or payment.

If your Claude workspace supports custom remote connectors, you may add the endpoint directly:

```text
https://uce-evidence-lens-claude-zptt2ggs7a-uc.a.run.app/mcp
```

The manual connector provides the two tools but does not install the interpretation skill. Plugin and directory availability varies by Claude plan, workspace policy, and host. Directory publication status is separate from the public connector's availability, and this README does not claim directory approval.

## What is included

The plugin has exactly two remote tools and one skill:

- `inspect_uce_record` retrieves and inspects one public record reference.
- `get_uce_inspection_report` performs a fresh inspection of that reference and returns an unsigned, dated JSON snapshot.
- `inspect-uce-evidence` guides Claude to preserve the returned status, evidence category, provenance, and limitations.

The plugin contains no hooks, scripts, commands, local executable, local server, account workflow, or background monitor. The remote server performs the checks. Every tool call is bound to the public record reference supplied in the current conversation, and neither tool mutates evidence or publisher data.

## How data moves

1. You give Claude an explicit public CbyUCE or Arweave manifest reference and request an inspection or report.
2. Claude sends that reference to the UCE Evidence Lens remote connector.
3. The connector retrieves only approved public-source routes from CbyUCE, Arweave and transaction-derived Arweave hosts, and Turbo Gateway status, block, and parent-relationship endpoints.
4. The service inspects the response in memory and returns structured checks plus a complete text fallback to Claude.
5. Claude receives and explains the result under the data policy for your Claude account, plan, or workspace. The standalone plugin does not call the Anthropic API itself.

The service uses no inspection database, persistent report store, user account, cookie, or application analytics. It does not intentionally log request bodies, record references, or inspection results. See the [privacy policy](https://uceevidencelens.com/claude/privacy/) for hosting, provider, logging, retention, support, and deletion details.

Only submit lawfully shareable public references. Do not send an unpublished original, private manifest, credential, payment detail, or sensitive information.

## Working prompts

These approved public examples exercise the real supported reference forms:

```text
Inspect public UCE record d16afbafda0ef0bf1be29d4f89e8629fc2aa0eae55da30103aeb5e6a59abd9a5 and explain what was and was not verified.
```

```text
Inspect public UCE record cc94e8d529cfc24f6fe458470b69dca2c3ef53a78b740bb1fea9cc40d09cfd1c and explain its historical Standard hash coverage.
```

```text
For https://cbyuce.com/verify/d16afbafda0ef0bf1be29d4f89e8629fc2aa0eae55da30103aeb5e6a59abd9a5, which dates can you check, and did you compare the original file?
```

```text
Create an unsigned inspection report for public UCE record d16afbafda0ef0bf1be29d4f89e8629fc2aa0eae55da30103aeb5e6a59abd9a5.
```

```text
Inspect the public Arweave manifest jD5LXPMg9hJM-oUTTggKiHavSs1ndPhDufLu5cL6Vc8. If its source is temporarily unavailable, explain what I can retry.
```

Public sources can be pending, unavailable, or rate limited. Preserve an `unsupported`, `partial`, `reported`, `unavailable`, `retryable`, or `unknown` result as returned. A retrieval failure is not evidence of tampering.

## Evidence boundaries

A successful integrity check does not establish the truth of recorded identity, authorship, ownership, rights, consent, provenance, or creation-date assertions. Gateway chronology is distinct from original-file content and full-ledger consensus validation. The connector does not retrieve or compare the user's original file. That privacy-sensitive comparison remains in the [Evidence Lens browser](https://uceevidencelens.com/).

An inspection report is an unsigned, dated snapshot. It is not a UCE Certificate, a new permanent record, government registration, proof of ownership, guaranteed legal protection, infringement prevention, or DRM enforcement. The plugin does not upload original works, create evidence, issue certificates, use accounts, process payments, or consume credits.

Native Claude web testing covered the inspection card, a report-download acknowledgement, and the external Evidence Lens link. Other Claude hosts and surfaces are not claimed as tested. The tools also return complete text results for clients that do not render the interactive card.

## Source, support, and policies

- Documentation: <https://uceevidencelens.com/claude/>
- Support: <https://uceevidencelens.com/claude/support/>
- Privacy: <https://uceevidencelens.com/claude/privacy/>
- Terms: <https://uceevidencelens.com/claude/terms/>
- Source repository: <https://github.com/hedward/uce-evidence-lens-claude>

The plugin source is available under the Mozilla Public License 2.0. The UCE names and mark are treated separately from the software license. Anthropic and OpenAI do not endorse this plugin.
