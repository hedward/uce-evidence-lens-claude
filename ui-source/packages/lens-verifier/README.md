# `@uce/lens-verifier`

This private workspace package bundles the reviewed UCE Evidence Lens verifier
source from commit `a08f3556c77c4dd7190915e4739e3b6549ef0df9`. The copied files under
`upstream/` are byte-identical to that commit. `src/index.ts` is the package
adapter and does not modify verifier behavior.

Run `npm run verify:source -w @uce/lens-verifier` before building. The checker
uses `provenance/source-files.json` and does not need network access. Pass an
optional upstream checkout path to compare every copied artifact to `git show`:

```sh
node scripts/check-verifier-source.mjs --upstream /path/to/uce-evidence-lens
```

The package is private and has no publication script.
