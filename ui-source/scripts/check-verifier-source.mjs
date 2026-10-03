import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(repositoryRoot, "packages/lens-verifier");
const provenancePath = resolve(
  packageRoot,
  "provenance/source-files.json",
);
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));

function fail(message) {
  throw new Error(`Verifier source check failed: ${message}`);
}

function safePackageFile(packagePath) {
  if (
    typeof packagePath !== "string" ||
    !packagePath ||
    isAbsolute(packagePath) ||
    packagePath.split("/").includes("..")
  ) {
    fail(`unsafe package path ${JSON.stringify(packagePath)}`);
  }
  const absolute = resolve(packageRoot, packagePath);
  const withinPackage = relative(packageRoot, absolute);
  if (withinPackage.startsWith(`..${sep}`) || isAbsolute(withinPackage)) {
    fail(`package path escapes package root: ${packagePath}`);
  }
  return absolute;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

if (
  provenance.upstreamRevision !==
    "a08f3556c77c4dd7190915e4739e3b6549ef0df9" ||
  provenance.packageVersion !== "1.1.2-source.a08f355"
) {
  fail("the pinned revision or package version changed");
}

const entries = new Map();
for (const entry of provenance.files ?? []) {
  if (entries.has(entry.packagePath)) {
    fail(`duplicate provenance entry for ${entry.packagePath}`);
  }
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
    fail(`invalid SHA-256 for ${entry.packagePath}`);
  }
  const bytes = readFileSync(safePackageFile(entry.packagePath));
  const actual = sha256(bytes);
  if (actual !== entry.sha256) {
    fail(`${entry.packagePath} has SHA-256 ${actual}, expected ${entry.sha256}`);
  }
  entries.set(entry.packagePath, entry);
}

const sourceEntries = new Set(
  [...entries.values()]
    .filter((entry) => entry.kind === "source")
    .map((entry) => entry.packagePath),
);
const allowedExternalImports = new Set(
  provenance.allowedExternalImports ?? [],
);
const reached = new Set();

function packageRelative(absolutePath) {
  return relative(packageRoot, absolutePath).split(sep).join("/");
}

function resolveRelativeImport(importerPath, specifier) {
  const base = resolve(dirname(safePackageFile(importerPath)), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.json`,
    resolve(base, "index.ts"),
  ]) {
    const packagePath = packageRelative(candidate);
    if (entries.has(packagePath)) return packagePath;
  }
  fail(`${importerPath} has an unpinned relative import ${specifier}`);
}

function visit(packagePath) {
  if (reached.has(packagePath)) return;
  const entry = entries.get(packagePath);
  if (!entry || entry.kind !== "source") {
    fail(`entry root or import is not a pinned source file: ${packagePath}`);
  }
  reached.add(packagePath);
  if (!packagePath.endsWith(".ts")) return;

  const source = readFileSync(safePackageFile(packagePath), "utf8");
  const specifiers = new Set();
  for (const pattern of [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
  ]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  for (const specifier of specifiers) {
    if (specifier.startsWith(".")) {
      visit(resolveRelativeImport(packagePath, specifier));
    } else if (!allowedExternalImports.has(specifier)) {
      fail(`${packagePath} has an unapproved external import ${specifier}`);
    }
  }
}

for (const root of provenance.entryRoots ?? []) visit(root);

const missingFromClosure = [...sourceEntries].filter(
  (packagePath) => !reached.has(packagePath),
);
const missingFromProvenance = [...reached].filter(
  (packagePath) => !sourceEntries.has(packagePath),
);
if (missingFromClosure.length || missingFromProvenance.length) {
  fail(
    `source closure mismatch (unreachable: ${missingFromClosure.join(", ") || "none"}; unpinned: ${missingFromProvenance.join(", ") || "none"})`,
  );
}

const upstreamIndex = process.argv.indexOf("--upstream");
if (upstreamIndex !== -1) {
  const upstream = process.argv[upstreamIndex + 1];
  if (!upstream || process.argv[upstreamIndex + 2]) {
    fail("use --upstream with exactly one checkout path");
  }
  for (const entry of entries.values()) {
    const upstreamBytes = execFileSync(
      "git",
      [
        "-C",
        upstream,
        "show",
        `${provenance.upstreamRevision}:${entry.upstreamPath}`,
      ],
      { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 },
    );
    if (sha256(upstreamBytes) !== entry.sha256) {
      fail(`git show differs for ${entry.upstreamPath}`);
    }
  }
}

console.log(
  `Verified ${entries.size} pinned verifier artifacts at ${provenance.upstreamRevision.slice(0, 7)} (${sourceEntries.size} files in the source closure).`,
);
