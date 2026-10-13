import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http, fallback, keccak256 } from "viem";
const json = async (p) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const config = await json("../../dist/imd-deployment.json");
const client = createPublicClient({
  transport: fallback(
    config.network.rpcUrls.map((url) =>
      http(url, { timeout: 12000, retryCount: 0 }),
    ),
  ),
  batch: { multicall: false },
});
const chainId = await client.getChainId();
if (chainId !== config.chainId) throw Error("Chain mismatch");
const block = await client.getBlock();
const contracts = [];
for (const c of config.contracts) {
  const code = await client.getCode({ address: c.address });
  if (!code || code === "0x") throw Error(`Empty ${c.name} code`);
  contracts.push({
    name: c.name,
    address: c.address,
    codeBytes: (code.length - 2) / 2,
    runtimeCodeKeccak: keccak256(code),
  });
}
const game = config.contracts.find((c) => c.name === "Game"),
  token = config.contracts.find((c) => c.name === "LaunchToken");
const gameAbi = await json("../../dist/" + game.abiPath),
  tokenAbi = await json("../../dist/" + token.abiPath);
const read = (name, args = []) =>
  client.readContract({
    address: game.address,
    abi: gameAbi,
    functionName: name,
    args,
  });
const [owner, launchToken, prizeToken, pool, symbol, totalSupply] =
  await Promise.all([
    read("owner"),
    read("launchToken"),
    read("prizeToken"),
    read("epochs", [block.timestamp / 86400n]),
    client.readContract({
      address: token.address,
      abi: tokenAbi,
      functionName: "symbol",
    }),
    client.readContract({
      address: token.address,
      abi: tokenAbi,
      functionName: "totalSupply",
    }),
  ]);
if (
  launchToken.toLowerCase() !== token.address.toLowerCase() ||
  prizeToken.toLowerCase() !== config.network.pairToken.address.toLowerCase()
)
  throw Error("Asset binding mismatch");
const report = {
  checkedAt: new Date().toISOString(),
  readOnly: true,
  chainId,
  block: block.number,
  blockTimestamp: block.timestamp,
  contracts,
  owner,
  launchToken,
  prizeToken,
  symbol,
  totalSupply,
  epoch: block.timestamp / 86400n,
  epochState: pool,
  transactionsBroadcast: 0,
  limitations: [
    "Nonempty code is not an independent bytecode/source attestation.",
    "No live wallet signatures, swaps, claims or funded battles were executed.",
  ],
};
await writeFile(
  new URL("../../docs/evidence/live-rpc.json", import.meta.url),
  JSON.stringify(report, (_, v) => (typeof v === "bigint" ? String(v) : v), 2) +
    "\n",
);
console.log(
  "Read-only chain/code/asset-binding checks passed; docs/evidence/live-rpc.json",
);
