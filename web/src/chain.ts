import {
  createWalletClient,
  custom,
  decodeAbiParameters,
  encodeAbiParameters,
  erc20Abi,
  formatUnits,
  parseUnits,
  getAddress,
  type Abi,
  type AbiParameter,
  type Address,
  type EIP1193Provider,
  type Hash,
  type Hex,
} from "viem";
import type { Runtime } from "./config";
import type { Battle } from "./rules";
export type Provider = EIP1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export type AccountState = { address: Address | null; chainId: number };
export type PlayerState = {
  battle: Battle;
  command: {
    day: bigint;
    lastRewardAt: bigint;
    wins: number;
    harvests: number;
    rewardedBefore: boolean;
  };
  rewards: { epoch: bigint; power: bigint; tokens: bigint; prizes: bigint };
  cosmetics: bigint;
  tokens: bigint;
  prizes: bigint;
};
export type TxState = {
  phase:
    | "idle"
    | "simulating"
    | "signing"
    | "pending"
    | "success"
    | "error"
    | "uncertain";
  label: string;
  hash?: Hash;
  message?: string;
};
export type BridgeRequest = {
  type:
    | "account"
    | "state"
    | "claimable"
    | "balance"
    | "act"
    | "approve"
    | "claim";
  action?: Hex;
  value?: string;
  amount?: string;
};
export const cosmeticPrice = 100n * 10n ** 18n;
export function actionBytes(
  command: number,
  id: bigint,
  turn: number,
  argument: number,
) {
  return encodeAbiParameters(
    [
      { type: "uint8" },
      { type: "uint64" },
      { type: "uint8" },
      { type: "uint8" },
    ],
    [command, id, turn, argument],
  );
}
export function stateParameters(abi: Abi): readonly AbiParameter[] {
  const tuple = (name: string) => {
    const fn = abi.find((v) => v.type === "function" && v.name === name);
    if (!fn || fn.type !== "function" || !fn.outputs[0])
      throw Error(`Missing ${name} state definition.`);
    return fn.outputs[0];
  };
  return [
    { type: "uint8" },
    tuple("battleOf"),
    tuple("commandOf"),
    tuple("rewardsOf"),
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint256" },
  ];
}
export function decodeState(abi: Abi, encoded: Hex): PlayerState {
  const [version, battle, command, rewards, cosmetics, tokens, prizes] =
    decodeAbiParameters(stateParameters(abi), encoded);
  if (version !== 1) throw Error("Unsupported game state version.");
  return { battle, command, rewards, cosmetics, tokens, prizes } as PlayerState;
}
export function amount(value: bigint | undefined, decimals = 18, digits = 4) {
  if (value === undefined) return "—";
  const [whole, frac] = formatUnits(value, decimals).split(".");
  const tail = (frac || "").slice(0, digits).replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${tail ? `.${tail}` : ""}`;
}
export function exactUnits(value: string, decimals: number): bigint {
  const text = value.trim();
  if (
    !/^\d+(\.\d+)?$/.test(text) ||
    (text.split(".")[1]?.length || 0) > decimals
  )
    throw Error(
      `Enter a nonnegative amount with at most ${decimals} decimal places.`,
    );
  return parseUnits(text, decimals);
}
const explanations: Record<string, string> = {
  TooEarly:
    "This order is too early. Refresh the chain clock and wait for the next order or victory gate.",
  WrongTurn:
    "Another order changed the turn. Refresh your battle and review the order again.",
  WrongSession:
    "The battle session changed. Refresh before sending another order.",
  NothingToClaim:
    "No matured reward is available. Rewards settle after UTC midnight.",
  InsufficientOre: "Harvest more ore before this order.",
  PrerequisiteMissing:
    "Build the required structure or produce more Pepes first.",
  MatchActive: "Finish or surrender the active battle first.",
  NotActive: "Start a new battle first.",
  DeadlinePassed: "The battle expired. Close it before starting again.",
  AlreadyOwned: "This wallet already owns that cosmetic.",
  AssetUnavailable: "The asset is unavailable on this network.",
  NoRefund: "No refundable contribution exists for this wallet and day.",
  EpochNotClosed:
    "The funding day has not closed or its power has not all accrued.",
  InvalidEpoch: "Choose one of the next 30 UTC days.",
  ArmyFull: "The army already has 12 Pepes.",
  NotExpired: "This battle has not reached its deadline.",
  ERC20InsufficientBalance: "Your token balance is too low.",
  ERC20InsufficientAllowance: "Approve the exact required token amount first.",
  InexactTransfer:
    "The asset transfer did not match the required amount. No state change was accepted.",
};
export function errorMessage(error: unknown): string {
  const e = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
    data?: { errorName?: string };
  };
  if (
    e?.code === 4001 ||
    /user rejected|user denied|rejected the request/i.test(e?.message || "")
  )
    return "You rejected the wallet request. Nothing was resubmitted; you can try again.";
  if (e?.data?.errorName && explanations[e.data.errorName])
    return explanations[e.data.errorName];
  for (const [key, message] of Object.entries(explanations))
    if ((e?.message || "").includes(key)) return message;
  if (e?.cause) {
    const inner = errorMessage(e.cause);
    if (inner !== "Request failed. Refresh and try again.") return inner;
  }
  return (
    e?.shortMessage?.slice(0, 240) ||
    e?.message?.split("\n")[0].slice(0, 240) ||
    "Request failed. Refresh and try again."
  );
}
export class ChainService {
  verified = false;
  locked = false;
  uncertain?: Hash;
  constructor(
    public runtime: Runtime,
    public onTx: (value: TxState) => void,
  ) {}
  async verify() {
    this.verified = false;
    const { client, config, contract } = this.runtime;
    if ((await client.getChainId()) !== config.chainId)
      throw Error(
        "Public RPC returned the wrong network. Transactions are disabled.",
      );
    for (const c of config.contracts) {
      const code = await client.getCode({ address: c.address });
      if (!code || code === "0x")
        throw Error(
          `No deployed code at ${c.name}. Transactions are disabled.`,
        );
    }
    const [token, prize, decimals, symbol] = await Promise.all([
      client.readContract({ ...contract("Game"), functionName: "launchToken" }),
      client.readContract({ ...contract("Game"), functionName: "prizeToken" }),
      client.readContract({
        ...contract("LaunchToken"),
        functionName: "decimals",
      }),
      client.readContract({
        ...contract("LaunchToken"),
        functionName: "symbol",
      }),
    ]);
    if (
      String(token).toLowerCase() !==
        contract("LaunchToken").address.toLowerCase() ||
      String(prize).toLowerCase() !==
        config.network.pairToken.address.toLowerCase() ||
      Number(decimals) !== 18 ||
      symbol !== "PEPEFRONT"
    )
      throw Error(
        "Deployment asset binding failed. Transactions are disabled.",
      );
    this.verified = true;
  }
  async account(connect = false): Promise<AccountState> {
    const p = window.ethereum;
    if (!p)
      throw Error(
        "No browser wallet found. Open this site in an EVM wallet browser, or play through Pepe2Pepe. Practice needs no wallet.",
      );
    const addresses = (await p.request({
      method: connect ? "eth_requestAccounts" : "eth_accounts",
    })) as Address[];
    const chainId = Number(await p.request({ method: "eth_chainId" }));
    return { address: addresses[0] ? getAddress(addresses[0]) : null, chainId };
  }
  async switchChain() {
    if (!window.ethereum)
      throw Error("Open this site in an EVM wallet browser.");
    const chainId = `0x${this.runtime.config.chainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (error) {
      const e = error as { code?: number; message?: string };
      if (
        e.code !== 4902 &&
        !/unknown chain|unrecognized chain|not added/i.test(e.message || "")
      )
        throw error;
      if (!this.runtime.config.walletAddChain)
        throw Error("This chain is not configured for automatic wallet setup.");
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [this.runtime.config.walletAddChain],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }
  }
  async write(
    label: string,
    address: Address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[] = [],
    value = 0n,
  ) {
    if (this.locked || this.uncertain)
      throw Error("Check the pending transaction before sending another.");
    if (!this.verified)
      throw Error(
        "Wait for deployment verification or retry the network check.",
      );
    this.locked = true;
    let hash: Hash | undefined;
    let settled = false;
    try {
      const account = await this.account();
      if (!account.address || account.chainId !== this.runtime.config.chainId)
        throw Error("Connect your wallet on the configured network first.");
      this.onTx({ phase: "simulating", label });
      const simulation = await this.runtime.client.simulateContract({
        address,
        abi,
        functionName,
        args,
        account: account.address,
        value,
      });
      const fresh = await this.account();
      if (
        fresh.address !== account.address ||
        fresh.chainId !== account.chainId
      )
        throw Error(
          "Wallet changed during simulation. Review this action again.",
        );
      this.onTx({ phase: "signing", label });
      const wallet = createWalletClient({
        chain: this.runtime.chain,
        transport: custom(window.ethereum!),
      });
      hash = await wallet.writeContract({
        ...simulation.request,
        account: account.address,
        chain: this.runtime.chain,
      });
      this.onTx({ phase: "pending", label, hash });
      const receipt = await this.runtime.client.waitForTransactionReceipt({
        hash,
        timeout: 120000,
      });
      settled = true;
      if (receipt.status !== "success")
        throw Error("Transaction reverted. Refresh state before retrying.");
      this.onTx({
        phase: "success",
        label,
        hash,
        message: "Confirmed on chain.",
      });
      return hash;
    } catch (error) {
      if (hash && !settled) {
        this.uncertain = hash;
        this.onTx({
          phase: "uncertain",
          label,
          hash,
          message:
            "Confirmation is uncertain. Check the transaction; do not resend it.",
        });
      } else
        this.onTx({
          phase: "error",
          label,
          hash,
          message: errorMessage(error),
        });
      throw error;
    } finally {
      this.locked = false;
    }
  }
  async checkReceipt() {
    if (!this.uncertain) return;
    const hash = this.uncertain;
    const receipt = await this.runtime.client.getTransactionReceipt({ hash });
    this.uncertain = undefined;
    this.onTx({
      phase: receipt.status === "success" ? "success" : "error",
      label: "Transaction check",
      hash,
      message:
        receipt.status === "success"
          ? "Confirmed. Refresh state before continuing."
          : "Transaction reverted. You may review a new action.",
    });
  }
  async standalone(request: BridgeRequest): Promise<unknown> {
    const account = await this.account();
    if (request.type === "account") return account;
    if (!account.address || account.chainId !== this.runtime.config.chainId)
      throw Error("Connect on the configured network first.");
    const { client, contract } = this.runtime;
    if (request.type === "state")
      return client.readContract({
        ...contract("Game"),
        functionName: "state",
        args: [account.address],
      });
    if (request.type === "claimable")
      return String(
        await client.readContract({
          ...contract("Game"),
          functionName: "claimable",
          args: [account.address],
        }),
      );
    if (request.type === "balance")
      return String(
        await client.readContract({
          ...contract("LaunchToken"),
          functionName: "balanceOf",
          args: [account.address],
        }),
      );
    if (request.type === "approve") {
      const value = BigInt(request.amount || "0");
      if (value < 0n || value > cosmeticPrice)
        throw Error("Game cosmetic approval exceeds the exact limit.");
      return this.write(
        "Approve cosmetic",
        contract("LaunchToken").address,
        contract("LaunchToken").abi,
        "approve",
        [contract("Game").address, value],
      );
    }
    if (request.type === "act") {
      if (
        request.value !== "0" ||
        !request.action ||
        request.action.length !== 258
      )
        throw Error("Invalid game action. No native value is accepted.");
      return this.write(
        "Battle order",
        contract("Game").address,
        contract("Game").abi,
        "act",
        [request.action],
      );
    }
    if (request.type === "claim")
      return this.write(
        "Claim PEPEFRONT",
        contract("Game").address,
        contract("Game").abi,
        "claim",
      );
    throw Error("Unsupported wallet request.");
  }
  async allowance(token: Address, account: Address, spender: Address) {
    return this.runtime.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, spender],
    });
  }
}
