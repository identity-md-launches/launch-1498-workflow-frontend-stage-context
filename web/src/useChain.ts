import { useCallback, useEffect, useRef, useState } from "react";
import { erc20Abi, type Address, type Hex } from "viem";
import { loadDeployment, type Runtime } from "./config";
import {
  ChainService,
  decodeState,
  errorMessage,
  type AccountState,
  type BridgeRequest,
  type PlayerState,
  type TxState,
} from "./chain";
import { createPepeChainBridge } from "./onchain-bridge";
import { bindBridge, hostSession, startupBridge } from "./bridge";
type Bridge = ReturnType<typeof createPepeChainBridge>;
export type Live = {
  balance: bigint;
  imdBalance: bigint;
  allowance: bigint;
  eligible: boolean;
  owner: Address;
  pendingOwner: Address;
  epoch: readonly bigint[];
  blockTime: number;
  block: bigint;
};
export function useChain(onPause: () => void, onResume: () => void) {
  const [runtime, setRuntime] = useState<Runtime>();
  const [service, setService] = useState<ChainService>();
  const [account, setAccount] = useState<AccountState>({
    address: null,
    chainId: 0,
  });
  const [player, setPlayer] = useState<PlayerState>();
  const [live, setLive] = useState<Live>();
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<TxState>({ phase: "idle", label: "" });
  const [hostReady, setHostReady] = useState(false);
  const [hostPreview, setHostPreview] = useState(false);
  const bridge = useRef<Bridge | undefined>(undefined);
  const busy = useRef(false);
  const readDone = useRef<Promise<void> | undefined>(undefined);
  const finishRead = useRef<(() => void) | undefined>(undefined);
  const life = useRef(true);
  const callbacks = useRef({ onPause, onResume });
  callbacks.current = { onPause, onResume };
  const embedded = window.parent !== window;
  useEffect(() => {
    life.current = true;
    let activeService: ChainService | undefined;
    const instance = startupBridge;
    const unbind = bindBridge(
      (req) => {
        if (!activeService) throw Error("Deployment is loading.");
        return activeService.standalone(req);
      },
      (event) => {
        if (event === "init") {
          setHostReady(true);
          setHostPreview(hostSession.preview);
          setPlayer(undefined);
          setLive(undefined);
        }
        if (event === "pause") callbacks.current.onPause();
        if (event === "resume") callbacks.current.onResume();
      },
    );
    setHostReady(hostSession.ready);
    setHostPreview(hostSession.preview);
    if (hostSession.paused) callbacks.current.onPause();
    bridge.current = instance;
    loadDeployment()
      .then(async (r) => {
        if (!life.current) return;
        setRuntime(r);
        const s = new ChainService(r, (v) => {
          if (life.current) setTx(v);
        });
        activeService = s;
        setService(s);
        try {
          await s.verify();
          if (life.current) setVerified(true);
        } catch (e) {
          if (life.current) setError(errorMessage(e));
        }
      })
      .catch((e) => {
        if (life.current) setError(errorMessage(e));
      });
    return () => {
      life.current = false;
      unbind();
    };
  }, []);
  const refresh = useCallback(async (force = false): Promise<void> => {
    if (
      !runtime ||
      !service ||
      !bridge.current ||
      (embedded && !hostReady) ||
      (!embedded && !window.ethereum)
    )
      return;
    if (busy.current) {
      if (force) { await readDone.current; return refresh(true); }
      return;
    }
    busy.current = true;
    readDone.current = new Promise(resolve => {finishRead.current = resolve;});
    setLoading(true);
    try {
      const a = (await bridge.current.request({
        type: "account",
      })) as AccountState;
      if (!a || !("address" in a))
        throw Error("The host returned an invalid account response.");
      const normalized = { address: a.address, chainId: Number(a.chainId) };
      setAccount(normalized);
      if (
        !normalized.address ||
        normalized.chainId !== runtime.config.chainId
      ) {
        setPlayer(undefined);
        setLive(undefined);
        setError("");
        return;
      }
      const encoded = (await bridge.current.request({ type: "state" })) as Hex;
      const next = decodeState(runtime.abis.Game, encoded);
      const balance = BigInt(
        (await bridge.current.request({ type: "balance" })) as string,
      );
      const { client, contract } = runtime;
      const block = await client.getBlock();
      const epoch = block.timestamp / 86400n;
      const [imdBalance, allowance, eligible, owner, pendingOwner, pool] =
        await Promise.all([
          client.readContract({
            address: runtime.config.network.pairToken.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [normalized.address],
          }),
          service.allowance(
            contract("LaunchToken").address,
            normalized.address,
            contract("Game").address,
          ),
          client.readContract({
            ...contract("Game"),
            functionName: "rewardAvailable",
            args: [normalized.address],
          }),
          client.readContract({ ...contract("Game"), functionName: "owner" }),
          client.readContract({
            ...contract("Game"),
            functionName: "pendingOwner",
          }),
          client.readContract({
            ...contract("Game"),
            functionName: "epochs",
            args: [epoch],
          }),
        ]);
      const finalAccount = (await bridge.current.request({
        type: "account",
      })) as AccountState;
      if (
        finalAccount.address?.toLowerCase() !==
          normalized.address.toLowerCase() ||
        Number(finalAccount.chainId) !== normalized.chainId
      ) {
        setPlayer(undefined);
        setLive(undefined);
        return;
      }
      setPlayer(next);
      setLive({
        balance,
        imdBalance,
        allowance,
        eligible: Boolean(eligible),
        owner: owner as Address,
        pendingOwner: pendingOwner as Address,
        epoch: pool as readonly bigint[],
        blockTime: Number(block.timestamp),
        block: block.number,
      });
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      setPlayer(undefined);
      setLive(undefined);
    } finally {
      busy.current = false;
      finishRead.current?.();
      readDone.current = undefined;
      setLoading(false);
    }
  }, [runtime, service, embedded, hostReady]);
  useEffect(() => {
    if (!service) return;
    void refresh();
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    const changed = () => {
      setPlayer(undefined);
      setLive(undefined);
      setAccount({ address: null, chainId: 0 });
      void refresh(true);
    };
    window.ethereum?.on?.("accountsChanged", changed);
    window.ethereum?.on?.("chainChanged", changed);
    return () => {
      clearInterval(interval);
      window.ethereum?.removeListener?.("accountsChanged", changed);
      window.ethereum?.removeListener?.("chainChanged", changed);
    };
  }, [service, refresh]);
  async function connect() {
    setError("");
    try {
      if (embedded) {
        if (!hostReady)
          throw Error(
            "Waiting for the Pepe2Pepe host handshake. Open the game through the host.",
          );
        await refresh(true);
        if (!account.address)
          setError(
            "Use Connect wallet in the Pepe2Pepe host, then refresh your wallet here.",
          );
      } else {
        if (!service) throw Error("Deployment is still loading.");
        const a = await service.account(true);
        setAccount(a);
        await refresh(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function switchChain() {
    try {
      if (embedded)
        throw Error("Switch networks using the Pepe2Pepe host wallet.");
      await service?.switchChain();
      await refresh(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function request(label: string, req: BridgeRequest) {
    if (!bridge.current || !verified || hostPreview)
      throw Error(
        "Verified deployment and a non-preview wallet session are required.",
      );
    if (embedded)
      setTx({
        phase: "signing",
        label,
        message: "Review the request in the Pepe2Pepe host.",
      });
    try {
      const result = await bridge.current.request(req);
      if (embedded) {
        const hash = (typeof result === 'string' ? result : (result as {hash?: string; transactionHash?: string})?.hash || (result as {transactionHash?: string})?.transactionHash);
        if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw Error('The host did not return a confirmed transaction hash. Check the host wallet before retrying.');
        setTx({phase:'success',label,hash:hash as Hex,message:'Host confirmed the transaction.'});
      }
      await refresh(true);
      return result;
    } catch (e) {
      if (embedded)
        setTx({
          phase: /timed out|confirmed transaction hash/i.test(errorMessage(e)) ? "uncertain" : "error",
          label,
          message: errorMessage(e),
        });
      throw e;
    }
  }
  async function verify() {
    if (!service) return;
    setError("");
    setLoading(true);
    try {
      await service.verify();
      setVerified(true);
      await refresh(true);
    } catch (e) {
      setVerified(false);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  const ready =
    verified &&
    !!account.address &&
    account.chainId === runtime?.config.chainId &&
    !!player &&
    !!live &&
    !hostPreview;
  const pending = ["simulating", "signing", "pending", "uncertain"].includes(
    tx.phase,
  );
  const read = async (req: BridgeRequest) => {
    if (!bridge.current) throw Error("Wallet bridge is loading.");
    return bridge.current.request(req);
  };
  return {
    read,
    runtime,
    service,
    account,
    player,
    live,
    error,
    verified,
    loading,
    tx,
    hostReady,
    hostPreview,
    embedded,
    ready,
    pending,
    connect,
    switchChain,
    refresh,
    request,
    verify,
    setTx,
    setError,
  };
}
export type Chain = ReturnType<typeof useChain>;
