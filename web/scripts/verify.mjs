import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex } from "viem";
const root = fileURLToPath(new URL("../../", import.meta.url)),
  dist = resolve(root, "dist");
const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical)}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const m = await json(resolve(dist, "imd-deployment.json")),
  h = await json(resolve(root, "web/reference/deployment.json")),
  n = await json(resolve(root, "web/reference/network.json"));
const expected = [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
  "contracts",
  "assets",
  "poolKey",
  "network",
  "walletAddChain",
].sort();
if (JSON.stringify(Object.keys(m).sort()) !== JSON.stringify(expected))
  throw Error("Unexpected manifest keys");
for (const k of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
  "poolKey",
])
  if (canonical(m[k]) !== canonical(h[k])) throw Error(`Handoff mismatch ${k}`);
for (const k of ["network", "walletAddChain"])
  if (canonical(m[k]) !== canonical(n[k])) throw Error(`Network mismatch ${k}`);
if (m.contracts.length !== h.contracts.length)
  throw Error("Contract set mismatch");
for (const c of m.contracts) {
  const original = h.contracts.find((v) => v.name === c.name);
  for (const k of ["name", "address", "abiHash"])
    if (c[k] !== original[k]) throw Error(`Contract mismatch ${k}`);
  const abi = await json(resolve(dist, c.abiPath));
  if (keccak256(stringToHex(canonical(abi))).slice(2) !== c.abiHash)
    throw Error("ABI hash mismatch");
}
const files = [];
let total = 0;
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isSymbolicLink()) throw Error("Symlink in export");
    if (entry.isDirectory()) await walk(resolve(dir, entry.name), path + "/");
    else if (path !== "imd-deployment.json") files.push(path);
  }
}
await walk(dist);
if (
  files.length > 128 ||
  files.length !== m.assets.length ||
  new Set(m.assets.map((a) => a.path)).size !== files.length
)
  throw Error("Asset count mismatch");
for (const a of m.assets) {
  if (
    !files.includes(a.path) ||
    a.path.startsWith("/") ||
    a.path.split("/").includes("..") ||
    !/^[a-zA-Z0-9_./-]+$/.test(a.path)
  )
    throw Error("Invalid asset path");
  const bytes = await readFile(resolve(dist, a.path));
  total += bytes.length;
  if (
    bytes.length > 8388608 ||
    createHash("sha256").update(bytes).digest("hex") !== a.sha256
  )
    throw Error(`Asset hash mismatch ${a.path}`);
}
if (total >= 30 * 1024 * 1024) throw Error("Export HTTP budget too large");
const forbidden =
  /node_modules|(?:^|\/)(?:\.npm|\.cache|\.vite|vendor)(?:\/|$)|\.tgz$/;
if (files.some((p) => forbidden.test(p)))
  throw Error("Dependency artifacts in export");
console.log(
  JSON.stringify(
    {
      pass: true,
      contracts: m.contracts.length,
      assets: files.length,
      exportBytes:
        total + (await stat(resolve(dist, "imd-deployment.json"))).size,
      abiHashes: "canonical Keccak verified",
      assetHashes: "SHA-256 verified",
      poolKey: "exact",
      network: "exact",
    },
    null,
    2,
  ),
);
