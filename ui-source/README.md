# Inspection card source

This is the readable source and exact dependency lock for the MCP Apps card served by UCE Evidence Lens. It is not the server or a local plugin executable. The directory is outside the submitted plugin folder.

With Node.js 24.15.x and npm 11, run `npm ci --ignore-scripts` and `npm run build`. The result is `dist/ui/widget.html`. The retained package name and lock metadata match the development build so that dependencies resolve identically. Some locked dependencies belong to the shared server development workspace and are not bundled into the browser card.

The card sends explicit record references through the host MCP bridge, renders results as text, and delegates links and requested JSON downloads to the host. It makes no independent network fetches and contains no analytics.

The source-pinned verifier package is included for the shared TypeScript result contract and preservation of original source attribution and notices. Cryptographic checks run on the remote service, not in this card. See its README, provenance/source-files.json, LICENSE, NOTICE.md, TRADEMARKS.md, and THIRD-PARTY-NOTICES.txt.

The plugin's declared service, privacy, terms, and support links are documented in ../plugin/README.md.
