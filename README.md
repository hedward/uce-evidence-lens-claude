# UCE Evidence Lens for Claude

Read-only inspection of approved public Universal Creation Evidence records, with explicit integrity checks and coverage limits.

The Claude plugin is in [plugin/](plugin/). Its README covers setup, tools, data flow, examples, privacy, support, and limitations. The separate public MCP connector uses the endpoint configured in that folder. Directory submission or approval does not itself mean the listing has been published.

[Public documentation](https://uceevidencelens.com/claude/) · [Support](https://uceevidencelens.com/claude/support/)

[ui-source/](ui-source/) provides readable source for the remotely delivered inspection card. No local executable, shell hook, or install script runs when the plugin is installed. The plugin contacts its declared remote service; the service retrieves only approved public sources.

Software is covered by MPL-2.0 and its preserved notices. UCE names and marks are treated separately; the software license grants no trademark rights or Anthropic endorsement.
