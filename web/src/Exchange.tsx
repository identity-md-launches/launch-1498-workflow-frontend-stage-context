import { useEffect, useState } from "react";
import { erc20Abi, type Address } from "viem";
import type { Chain } from "./useChain";
import { amount, errorMessage, exactUnits } from "./chain";
import { permitAbi, quoterAbi, routerAbi, swapPayload } from "./swap";
import { Icon } from "./ui";
export type Confirm = (
  title: string,
  description: string,
  run: () => Promise<unknown>,
) => void;
type Quote = {
  input: Address;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: bigint;
  output: bigint;
  minimum: bigint;
  at: number;
  allowance: bigint;
  permitAmount: bigint;
  expiration: number;
};
export function Exchange({
  chain,
  confirm,
}: {
  chain: Chain;
  confirm: Confirm;
}) {
  const [direction, setDirection] = useState("buy"),
    [value, setValue] = useState(""),
    [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<Quote>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const { runtime, service, account } = chain;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setQuote(undefined);
    setError("");
  }, [direction, value, slippage, account.address, account.chainId]);
  if (!runtime || !service) return <p>Loading pool configuration…</p>;
  const r = runtime,
    s = service,
    token = r.contract("LaunchToken").address,
    pair = r.config.network.pairToken,
    uni = r.config.network.uniswapV4;
  const input = direction === "buy" ? pair.address : token,
    inputSymbol = direction === "buy" ? pair.symbol : "PEPEFRONT",
    outputSymbol = direction === "buy" ? "PEPEFRONT" : pair.symbol;
  const decimals = direction === "buy" ? pair.decimals : 18,
    outputDecimals = direction === "buy" ? 18 : pair.decimals;
  const isExpired = !!quote && now - quote.at > 30000;
  async function allowances(input: Address) {
    const [allowance, permit] = await Promise.all([
      s.allowance(input, account.address!, uni.permit2),
      r.client.readContract({
        address: uni.permit2,
        abi: permitAbi,
        functionName: "allowance",
        args: [account.address!, input, uni.universalRouter],
      }),
    ]);
    return { allowance, permitAmount: permit[0], expiration: permit[1] };
  }
  async function getQuote() {
    setBusy(true);
    setError("");
    setQuote(undefined);
    try {
      if (!/^\d+(\.\d+)?$/.test(value.trim()))
        throw Error("Enter a positive token amount.");
      const inputAmount = exactUnits(value.trim(), decimals),
        slip = Number(slippage);
      if (inputAmount <= 0n || inputAmount >= 2n ** 128n)
        throw Error("Amount is outside the supported range.");
      if (!Number.isFinite(slip) || slip < 0.1 || slip > 5)
        throw Error("Choose slippage between 0.1% and 5%.");
      const balance = await r.client.readContract({
        address: input,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address!],
      });
      if (inputAmount > balance)
        throw Error(`Insufficient ${inputSymbol} balance.`);
      const { result } = await r.client.simulateContract({
        address: uni.quoter,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: r.config.poolKey,
            zeroForOne:
              input.toLowerCase() === r.config.poolKey.currency0.toLowerCase(),
            exactAmount: inputAmount,
            hookData: "0x",
          },
        ],
        account: account.address!,
      });
      if (result[0] === 0n)
        throw Error("No output is available for this amount.");
      const minimum =
        (result[0] * BigInt(10000 - Math.round(slip * 100))) / 10000n;
      if (minimum <= 0n || minimum >= 2n ** 128n)
        throw Error("Quoted minimum is outside the supported range.");
      setQuote({
        input,
        inputSymbol,
        outputSymbol,
        inputAmount,
        output: result[0],
        minimum,
        at: Date.now(),
        ...(await allowances(input)),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const needsToken = quote && quote.allowance < quote.inputAmount;
  const needsPermit =
    quote &&
    (quote.permitAmount < quote.inputAmount ||
      quote.expiration < Date.now() / 1000 + 120);
  const review = () => {
    if (!quote) return;
    const q = quote;
    if (needsToken)
      confirm(
        `Approve ${q.inputSymbol}`,
        `Allow Permit2 to spend exactly ${amount(q.inputAmount, decimals, 8)} ${q.inputSymbol}. This is step 1 of 3; no swap happens yet.`,
        async () => {
          await s.write(
            "Approve token to Permit2",
            input,
            erc20Abi,
            "approve",
            [uni.permit2, q.inputAmount],
          );
          setQuote({ ...q, ...(await allowances(input)) });
          await chain.refresh(true);
        },
      );
    else if (needsPermit)
      confirm(
        "Approve router spending",
        `Allow the configured Universal Router to use exactly ${amount(q.inputAmount, decimals, 8)} ${q.inputSymbol} through Permit2 for 30 minutes. Step 2 of 3.`,
        async () => {
          const block = await r.client.getBlock();
          await s.write(
            "Approve router in Permit2",
            uni.permit2,
            permitAbi,
            "approve",
            [
              input,
              uni.universalRouter,
              q.inputAmount,
              Number(block.timestamp) + 1800,
            ],
          );
          setQuote({ ...q, ...(await allowances(input)) });
        },
      );
    else
      confirm(
        "Review swap",
        `Spend ${amount(q.inputAmount, decimals, 8)} ${q.inputSymbol}. Receive at least ${amount(q.minimum, outputDecimals, 8)} ${q.outputSymbol}. Pool fee: ${(r.config.poolKey.fee / 10000).toFixed(2)}%. Slippage: ${slippage}%. Network gas applies.`,
        async () => {
          if (Date.now() - q.at > 30000)
            throw Error("Quote expired. Get a fresh quote before swapping.");
          const permission = await allowances(input);
          if (
            permission.allowance < q.inputAmount ||
            permission.permitAmount < q.inputAmount ||
            permission.expiration < Date.now() / 1000 + 120
          )
            throw Error("Approval changed. Get a fresh quote.");
          const payload = swapPayload(r, q.input, q.inputAmount, q.minimum),
            block = await r.client.getBlock();
          await s.write(
            "Swap tokens",
            uni.universalRouter,
            routerAbi,
            "execute",
            [payload.commands, payload.inputs, block.timestamp + 120n],
            0n,
          );
          setQuote(undefined);
          setValue("");
          await chain.refresh(true);
        },
      );
  };
  return (
    <section className="utility-section">
      <div className="section-intro">
        <h2>Supply exchange</h2>
        <p>
          Trade PEPEFRONT and {pair.symbol} in the attested Uniswap v4 pool.
        </p>
      </div>
      {chain.embedded ? (
        <div className="notice">
          Open the standalone site to swap. The host bridge permits game actions
          and cosmetic approvals only.
        </div>
      ) : (
        <div className="exchange-layout">
          <div className="panel trade-form">
            <div className="segmented">
              <button
                aria-pressed={direction === "buy"}
                onClick={() => setDirection("buy")}
              >
                Buy PEPEFRONT
              </button>
              <button
                aria-pressed={direction === "sell"}
                onClick={() => setDirection("sell")}
              >
                Sell PEPEFRONT
              </button>
            </div>
            <label htmlFor="swap-amount">Pay in {inputSymbol}</label>
            <div className="amount-input">
              <input
                id="swap-amount"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
              />
              <span>{inputSymbol}</span>
            </div>
            <p className="muted">
              Available:{" "}
              {amount(
                direction === "buy"
                  ? chain.live?.imdBalance
                  : chain.live?.balance,
                decimals,
              )}{" "}
              {inputSymbol}
            </p>
            <label htmlFor="slippage">Maximum slippage (%)</label>
            <input
              id="slippage"
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
            <p className="muted">
              USD context unavailable. No price oracle is configured.
            </p>
            {quote && (
              <div className="quote-result">
                <span>Estimated receive</span>
                <strong>
                  {amount(quote.output, outputDecimals)} {outputSymbol}
                </strong>
                <span>
                  Minimum {amount(quote.minimum, outputDecimals, 8)}{" "}
                  {outputSymbol}
                </span>
                <span>
                  {isExpired
                    ? "Quote expired"
                    : `Quote expires in ${Math.max(0, 30 - Math.floor((now - quote.at) / 1000))}s`}
                </span>
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {!quote || isExpired ? (
              <button
                className="primary full"
                disabled={!chain.ready || chain.pending || busy}
                onClick={() => void getQuote()}
              >
                {busy
                  ? "Requesting quote…"
                  : quote
                    ? "Refresh quote"
                    : "Get quote"}
                <Icon name="arrow" />
              </button>
            ) : (
              <button
                className="primary full"
                disabled={!chain.ready || chain.pending}
                onClick={review}
              >
                {needsToken
                  ? `1. Approve ${inputSymbol}`
                  : needsPermit
                    ? "2. Approve router"
                    : "3. Review swap"}
                <Icon name="arrow" />
              </button>
            )}
            {!chain.ready && (
              <p className="muted">
                Connect on {r.config.network.name} and wait for verified live
                state.
              </p>
            )}
          </div>
          <div className="exchange-notes">
            <Icon name="crystal" size={38} />
            <h3>One pool. Exact permissions.</h3>
            <p>
              Each approval is a separate wallet request. The swap is simulated
              before you sign, and carries a minimum output and a two-minute
              deadline.
            </p>
            <dl className="data-list">
              <div>
                <dt>Pool fee</dt>
                <dd>{(r.config.poolKey.fee / 10000).toFixed(2)}%</dd>
              </div>
              <div>
                <dt>Pair asset</dt>
                <dd>{pair.name}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{r.config.network.name}</dd>
              </div>
            </dl>
            <p>
              Ore stays inside the battlefield. It cannot be traded or redeemed
              for tokens.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
