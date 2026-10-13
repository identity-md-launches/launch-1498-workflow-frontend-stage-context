import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
} from "viem";

export type Deployment = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  assets: { path: string; sha256: string }[];
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    uniswapV4: {
      poolManager: Address;
      universalRouter: Address;
      quoter: Address;
      stateView: Address;
      positionManager: Address;
      permit2: Address;
      extendedSwapParams?: boolean;
    };
    pairToken: {
      address: Address;
      symbol: string;
      name: string;
      decimals: number;
    };
  };
  walletAddChain?: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function safePath(path: string) {
  return (
    /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.startsWith("/") &&
    !path.split("/").includes("..")
  );
}
export async function loadDeployment() {
  const response = await fetch("./imd-deployment.json", { cache: "no-cache" });
  if (!response.ok)
    throw Error("Deployment configuration could not load. Reload the site.");
  const config: Deployment = await response.json();
  if (
    config.version !== 1 ||
    !config.network ||
    config.chainId !== config.network.chainId ||
    !config.poolKey
  )
    throw Error(
      "Deployment configuration is incomplete. Wallet actions are unavailable.",
    );
  const abis: Record<string, Abi> = {};
  await Promise.all(
    config.contracts.map(async (contract) => {
      if (!safePath(contract.abiPath)) throw Error("Unsafe ABI path.");
      const result = await fetch(`./${contract.abiPath}`);
      if (!result.ok) throw Error(`Cannot load ${contract.name} ABI.`);
      const abi: Abi = await result.json();
      if (
        !Array.isArray(abi) ||
        keccak256(stringToHex(canonical(abi))).slice(2) !== contract.abiHash
      )
        throw Error(`${contract.name} ABI verification failed.`);
      abis[contract.name] = abi;
    }),
  );
  if (!abis.Game || !abis.LaunchToken)
    throw Error("Required contracts are missing.");
  const chain = defineChain({
    id: config.chainId,
    name: config.network.name,
    nativeCurrency: config.network.nativeCurrency,
    rpcUrls: { default: { http: config.network.rpcUrls } },
    blockExplorers: {
      default: { name: "Explorer", url: config.network.explorer },
    },
  });
  const client = createPublicClient({
    chain,
    transport: fallback(
      config.network.rpcUrls.map((url) =>
        http(url, { timeout: 10000, retryCount: 0 }),
      ),
      { retryCount: 0 },
    ),
  });
  const contract = (name: string) => {
    const entry = config.contracts.find((c) => c.name === name);
    if (!entry) throw Error(`Missing ${name} deployment.`);
    return { address: entry.address, abi: abis[name] };
  };
  return { config, abis, chain, client, contract };
}
export type Runtime = Awaited<ReturnType<typeof loadDeployment>>;
