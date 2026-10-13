import { useEffect, useState } from "react";
import { erc20Abi, isAddress, zeroAddress, type Address } from "viem";
import type { Chain } from "./useChain";
import type { Confirm } from "./Exchange";
import { amount, errorMessage, exactUnits } from "./chain";
import { AddressLink } from "./ui";
export function Operations({
  chain,
  confirm,
}: {
  chain: Chain;
  confirm: Confirm;
}) {
  const { runtime: r, service: s, account, live } = chain;
  const today = Math.floor((live?.blockTime || Date.now() / 1000) / 86400);
  const [day, setDay] = useState(String(today + 1)),
    [tokens, setTokens] = useState(""),
    [prizes, setPrizes] = useState("");
  const [pool, setPool] = useState<readonly bigint[]>(),
    [contribution, setContribution] = useState<readonly bigint[]>(),
    [allow, setAllow] = useState<[bigint, bigint]>([0n, 0n]);
  const [target, setTarget] = useState(""),
    [newOwner, setNewOwner] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setPool(undefined);
    setContribution(undefined);
    setAllow([0n, 0n]);
  }, [day, tokens, prizes, account.address, account.chainId]);
  if (!r || !s) return <p>Loading deployment…</p>;
  const runtime = r,
    service = s,
    game = r.contract("Game"),
    token = r.contract("LaunchToken"),
    imd = r.config.network.pairToken;
  const owner =
    !!account.address &&
    account.address.toLowerCase() === live?.owner.toLowerCase();
  const pendingOwner =
    !!account.address &&
    account.address.toLowerCase() === live?.pendingOwner.toLowerCase();
  const disabled = !chain.ready || chain.pending || busy || chain.embedded;
  function amounts() {
    const a = tokens.trim() ? exactUnits(tokens.trim(), 18) : 0n,
      b = prizes.trim() ? exactUnits(prizes.trim(), imd.decimals) : 0n;
    if (a < 0n || b < 0n || a >= 2n ** 128n || b >= 2n ** 128n || a + b === 0n)
      throw Error("Enter a positive deposit within uint128 limits.");
    return [a, b] as const;
  }
  const epoch = () => {
    if (!/^\d+$/.test(day)) throw Error("Enter a UTC epoch number.");
    return BigInt(day);
  };
  async function inspect() {
    setBusy(true);
    setError("");
    try {
      const e = epoch();
      if (e >= 2n ** 64n) throw Error("Epoch is outside the supported range.");
      const [p, c, a, b] = await Promise.all([
        runtime.client.readContract({
          ...game,
          functionName: "epochs",
          args: [e],
        }),
        runtime.client.readContract({
          ...game,
          functionName: "contributions",
          args: [e, account.address!],
        }),
        service.allowance(token.address, account.address!, game.address),
        service.allowance(imd.address, account.address!, game.address),
      ]);
      setPool(p as readonly bigint[]);
      setContribution(c as readonly bigint[]);
      setAllow([a, b]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const write = (
    label: string,
    fn: string,
    args: readonly unknown[],
    description: string,
  ) =>
    confirm(label, description, async () => {
      await service.write(label, game.address, game.abi, fn, args);
      await chain.refresh(true);
      await inspect();
    });
  function funding() {
    setError("");
    try {
      const e = epoch(),
        [a, b] = amounts();
      if (e <= BigInt(today) || e > BigInt(today + 30))
        throw Error(
          "Choose a funding day from tomorrow through the next 30 UTC days.",
        );
      if (a > (live?.balance || 0n) || b > (live?.imdBalance || 0n))
        throw Error("Your balance is too low for this deposit.");
      if (a > allow[0])
        confirm(
          "Approve PEPEFRONT deposit",
          `Allow Game to spend exactly ${amount(a, 18, 8)} PEPEFRONT for your deposit.`,
          async () => {
            await service.write(
              "Approve sponsor PEPEFRONT",
              token.address,
              token.abi,
              "approve",
              [game.address, a],
            );
            await inspect();
          },
        );
      else if (b > allow[1])
        confirm(
          "Approve IMD deposit",
          `Allow Game to spend exactly ${amount(b, imd.decimals, 8)} IMD for your deposit.`,
          async () => {
            await service.write(
              "Approve sponsor IMD",
              imd.address,
              erc20Abi,
              "approve",
              [game.address, b],
            );
            await inspect();
          },
        );
      else
        write(
          "Fund reward day",
          "fund",
          [e, a, b],
          `Deposit ${amount(a)} PEPEFRONT and ${amount(b, imd.decimals)} IMD for UTC epoch ${e}. If any command power is earned that day, deposits cannot be refunded. Public deterministic play can be automated. No return is promised.`,
        );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  let fundingLabel = "Review funding";
  try {
    const [a, b] = amounts();
    if (a > allow[0]) fundingLabel = "Approve PEPEFRONT";
    else if (b > allow[1]) fundingLabel = "Approve IMD";
  } catch {
    /* Validated on review. */
  }
  const closed = Number(day) < today,
    hasRefund =
      closed &&
      pool?.[4] === 0n &&
      !!contribution &&
      (contribution[0] > 0n || contribution[1] > 0n);
  const canRecycle =
    closed &&
    !!pool &&
    (pool[4] === 0n
      ? pool[2] > 0n || pool[3] > 0n
      : pool[4] === pool[5] && (pool[0] > pool[6] || pool[1] > pool[7]));
  const playerAddress = () => {
    const value = target.trim() || account.address;
    if (!value || !isAddress(value) || value === zeroAddress)
      throw Error("Enter a valid nonzero player address.");
    return value as Address;
  };
  function accrue() {
    try {
      const p = playerAddress();
      write(
        "Accrue player share",
        "accrue",
        [p],
        `Account for the matured share of ${p}. Credits remain owned by that player; this does not transfer funds.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function expire() {
    setBusy(true);
    setError("");
    try {
      const p = playerAddress();
      const battle = (await runtime.client.readContract({
        ...game,
        functionName: "battleOf",
        args: [p],
      })) as { id: bigint; status: number; deadline: bigint };
      const block = await runtime.client.getBlock();
      if (battle.status !== 1 || block.timestamp < battle.deadline)
        throw Error("This player has no expired active battle.");
      write(
        "Close expired battle",
        "expire",
        [p, battle.id],
        `Close expired session ${battle.id} for ${p}. No reward is paid.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function transfer() {
    setError("");
    const a = newOwner.trim();
    if (!isAddress(a) || a === zeroAddress) {
      setError("Enter the intended new owner’s nonzero address.");
      return;
    }
    write(
      "Transfer ownership",
      "transferOwnership",
      [a],
      `Nominate ${a} as the new owner. They must accept from their own wallet. Ownership only controls forced-ETH recovery.`,
    );
  }
  return (
    <section className="utility-section">
      <div className="section-intro">
        <h2>Operations desk</h2>
        <p>
          Sponsor tomorrow’s front, settle closed days and inspect this
          deployment.
        </p>
      </div>
      {chain.embedded && (
        <div className="notice">
          Funding and maintenance need the standalone site. The embedded bridge
          supports the core game and claims.
        </div>
      )}
      <div className="utility-grid">
        <section className="panel">
          <h3>Fund a reward day</h3>
          <p>
            Deposits are shared by verified command power. There is no minting
            or guaranteed return.
          </p>
          <label htmlFor="epoch">UTC epoch number</label>
          <input
            id="epoch"
            inputMode="numeric"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <p className="muted">
            Today: {today}. Funding range: {today + 1}–{today + 30}.
            {Number.isSafeInteger(Number(day)) && Number(day) < 1000000 && (
              <span>
                {" "}
                Selected day:{" "}
                {new Date(Number(day) * 86400000)
                  .toISOString()
                  .slice(0, 10)}{" "}
                UTC.
              </span>
            )}
          </p>
          <div className="field-pair">
            <label>
              PEPEFRONT deposit
              <input
                inputMode="decimal"
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              IMD deposit
              <input
                inputMode="decimal"
                value={prizes}
                onChange={(e) => setPrizes(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <div className="button-row">
            <button disabled={disabled} onClick={() => void inspect()}>
              {busy ? "Reading…" : "Inspect day & allowances"}
            </button>
            <button
              className="primary"
              disabled={disabled || !pool}
              onClick={funding}
            >
              {fundingLabel}
            </button>
          </div>
          {pool && (
            <dl className="data-list">
              <div>
                <dt>Token budget</dt>
                <dd>{amount(pool[0])} PEPEFRONT</dd>
              </div>
              <div>
                <dt>Prize budget</dt>
                <dd>{amount(pool[1], imd.decimals)} IMD</dd>
              </div>
              <div>
                <dt>Total / accrued power</dt>
                <dd>
                  {String(pool[4])} / {String(pool[5])}
                </dd>
              </div>
              <div>
                <dt>Your deposits</dt>
                <dd>
                  {amount(contribution?.[0])} PEPEFRONT ·{" "}
                  {amount(contribution?.[1], imd.decimals)} IMD
                </dd>
              </div>
            </dl>
          )}
          <p className="muted">
            Balances: {amount(live?.balance)} PEPEFRONT ·{" "}
            {amount(live?.imdBalance, imd.decimals)} IMD. USD context
            unavailable.
          </p>
        </section>
        <section className="panel">
          <h3>Settle a closed day</h3>
          <p>
            Inspect the epoch on the left first. Only your own deposits from a
            day with zero power can be refunded.
          </p>
          <div className="stack">
            <button
              disabled={disabled || !hasRefund}
              onClick={() =>
                write(
                  "Refund both assets",
                  "refund",
                  [epoch()],
                  "Return your empty-day PEPEFRONT and IMD deposits to your connected wallet.",
                )
              }
            >
              Refund both assets
            </button>
            <button
              disabled={disabled || !hasRefund || contribution?.[0] === 0n}
              onClick={() =>
                write(
                  "Refund PEPEFRONT",
                  "refundToken",
                  [epoch()],
                  "Return your empty-day PEPEFRONT deposit. Your IMD contribution stays refundable.",
                )
              }
            >
              Refund PEPEFRONT only
            </button>
            <button
              disabled={disabled || !hasRefund || contribution?.[1] === 0n}
              onClick={() =>
                write(
                  "Refund IMD",
                  "refundPrize",
                  [epoch()],
                  "Return your empty-day IMD deposit. Your PEPEFRONT contribution stays refundable.",
                )
              }
            >
              Refund IMD only
            </button>
            <button
              disabled={disabled || !canRecycle}
              onClick={() =>
                write(
                  "Recycle residual budget",
                  "recycle",
                  [epoch()],
                  "Move eligible revenue or fully allocated rounding dust to tomorrow. No wallet receives funds.",
                )
              }
            >
              Recycle eligible remainder
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>Player maintenance</h3>
          <label htmlFor="player-address">
            Player address (leave blank for your wallet)
          </label>
          <input
            id="player-address"
            autoComplete="off"
            spellCheck={false}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Connected wallet"
          />
          <div className="button-row">
            <button disabled={disabled} onClick={accrue}>
              Accrue matured share
            </button>
            <button disabled={disabled} onClick={() => void expire()}>
              Close expired battle
            </button>
          </div>
          <p className="muted">
            Anyone can perform these checks. Credits always stay with the named
            player.
          </p>
        </section>
        <section className="panel">
          <h3>Creator controls</h3>
          <p>
            Game rules and reward custody are immutable. There are no signer,
            service or reward settings to configure.
          </p>
          {live && (
            <AddressLink
              address={live.owner}
              runtime={runtime}
              label="Current owner"
            />
          )}
          {owner && (
            <>
              <label htmlFor="new-owner">New owner address</label>
              <input
                id="new-owner"
                autoComplete="off"
                spellCheck={false}
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
              />
              <div className="stack">
                <button disabled={disabled} onClick={transfer}>
                  Review ownership transfer
                </button>
                <button
                  disabled={disabled}
                  onClick={() =>
                    write(
                      "Recover forced ETH",
                      "recoverForcedEther",
                      [],
                      "Send any forcibly received ETH to the current owner. Game token rewards and IMD cannot be recovered this way.",
                    )
                  }
                >
                  Recover forced ETH
                </button>
                <button
                  className="danger-button"
                  disabled={disabled}
                  onClick={() =>
                    write(
                      "Renounce ownership permanently",
                      "renounceOwnership",
                      [],
                      "Permanently remove the owner. Future forcibly sent ETH will be unrecoverable. Gameplay, token rewards and sponsor refunds remain available. This cannot be undone.",
                    )
                  }
                >
                  Renounce ownership
                </button>
              </div>
            </>
          )}
          {pendingOwner && (
            <button
              disabled={disabled}
              onClick={() =>
                write(
                  "Accept ownership",
                  "acceptOwnership",
                  [],
                  "Accept the pending transfer to your connected wallet. This grants forced-ETH recovery only.",
                )
              }
            >
              Accept ownership
            </button>
          )}
          {!owner && !pendingOwner && (
            <p className="muted">
              Connect the current or nominated owner wallet to use ownership
              controls.
            </p>
          )}
        </section>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="deployment-section">
        <h3>Verified deployment</h3>
        {runtime.config.contracts.map((c) => (
          <AddressLink
            key={c.name}
            address={c.address}
            runtime={runtime}
            label={c.name}
          />
        ))}
        <AddressLink
          address={imd.address}
          runtime={runtime}
          label="IMD prize asset"
        />
        <p className="muted">
          Source <code>{runtime.config.sourceCommit}</code> · Chain{" "}
          {runtime.config.chainId}. The runtime manifest and implementation ABIs
          are bundled with this export.
        </p>
        <a href="./imd-deployment.json" target="_blank" rel="noreferrer">
          Inspect deployment manifest <span aria-hidden="true">↗</span>
        </a>
      </section>
    </section>
  );
}
