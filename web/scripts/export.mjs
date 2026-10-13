import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { keccak256, stringToHex } from "viem";
const root = fileURLToPath(new URL("../../", import.meta.url)),
  dist = resolve(root, "dist");
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const read = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
const handoff = await read("web/reference/deployment.json"),
  network = await read("web/reference/network.json"),
  platform = await read("web/reference/platform.json");
// These immutable snapshots survive removal of the worker's .imd/reads inputs.
for (const [path, value] of [
  [".imd/reads/deployment.json", handoff],
  [".imd/reads/network.json", network],
]) {
  try {
    const pinned = await read(path);
    if (canonical(pinned) !== canonical(value))
      throw Error(`${path} differs from the committed snapshot.`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
await mkdir(resolve(dist, "abi"), { recursive: true });
const contracts = [];
for (const c of handoff.contracts) {
  const path = `docs/abi/${c.name}.json`;
  const pinned = execFileSync(
    "git",
    ["show", `${handoff.sourceCommit}:${path}`],
    { cwd: root, encoding: "utf8" },
  );
  const abi = JSON.parse(pinned);
  if (!Array.isArray(abi)) throw Error(`ABI must be an array: ${c.name}`);
  const hash = keccak256(stringToHex(canonical(abi))).slice(2);
  if (hash !== c.abiHash)
    throw Error(`ABI hash mismatch: ${c.name} got ${hash}`);
  if (canonical(await read(path)) !== canonical(abi))
    throw Error(`Working ABI differs from deployed source: ${c.name}`);
  const abiPath = `abi/${c.name}.json`;
  await writeFile(resolve(dist, abiPath), pinned);
  contracts.push({
    name: c.name,
    address: c.address,
    abiHash: c.abiHash,
    abiPath,
  });
}
const metadata = {
  schemaVersion: "pepe-onchain-game/1",
  title: "RH PEPEFRONT",
  version: "1.0.0",
  summary: "Command Pepe squads through a contested crystal basin.",
  description:
    "An unofficial solo strategy game. Harvest ore, develop your base and win by holding the point or destroying the enemy base. Free local practice is separate from wallet-backed strategic battles and deposited rewards.",
  controls:
    "Click or drag to select; right-click to move; WASD pans; G/B/R/F/H/E issue orders; P pauses. Touch players use Select all, Tap to move and the order buttons. Wallet orders require confirmation.",
  genre: "strategy",
  players: 1,
  mobile: true,
  entry: "index.html",
  cover: "cover.png",
  onchain: {
    chainId: handoff.chainId,
    launchId: handoff.launchId,
    ...platform,
    game: contracts.find((c) => c.name === "Game").address,
    token: contracts.find((c) => c.name === "LaunchToken").address,
    maxActionValueWei: "0",
    maxTokenApproval: "100000000000000000000",
  },
};
await writeFile(
  resolve(dist, "pepe-game.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
// Vite development gets the identical generated deployment, never another address map.
const assets = [];
async function walk(dir) {
  for (const name of (await readdir(dir)).sort()) {
    const path = resolve(dir, name),
      s = await stat(path);
    if (s.isDirectory()) await walk(path);
    else {
      const asset = relative(dist, path).split("\\").join("/");
      if (asset === "imd-deployment.json") continue;
      if (s.size > 8388608) throw Error(`Asset too large: ${asset}`);
      assets.push({
        path: asset,
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      });
    }
  }
}
await walk(dist);
if (assets.length > 128) throw Error("More than 128 export assets.");
const config = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  assets,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: network.network,
  ...(network.walletAddChain ? { walletAddChain: network.walletAddChain } : {}),
};
await writeFile(
  resolve(dist, "imd-deployment.json"),
  JSON.stringify(config, null, 2) + "\n",
);
console.log(`Exported verified deployment and ${assets.length} hashed assets.`);
