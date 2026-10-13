import { useEffect, useRef, useState } from "react";
import { type Hex } from "viem";
import {
  actionBytes,
  amount,
  cosmeticPrice,
  decodeState,
  errorMessage,
} from "./chain";
import { Scene, type SceneHandle } from "./Scene";
import { useChain } from "./useChain";
import {
  armySize,
  buildCosts,
  cosmetics,
  moveReason,
  orderDescription,
  startBattle,
  statusNames,
  stepBattle,
  strength,
  structures,
  unitCost,
  unitNames,
  type Battle,
} from "./rules";
import { AddressLink, Icon, Modal, PepePortrait } from "./ui";
import { Exchange, type Confirm } from "./Exchange";
import { Operations } from "./Operations";
const tabs = ["Battlefield", "Rewards", "Exchange", "Operations"] as const;
const time = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, "0")}`;
const OrderButton = ({
  battle,
  now,
  paused,
  locked,
  order,
  command,
  argument = 0,
  label,
  detail,
  icon,
}: {
  battle: Battle | null;
  now: number;
  paused: boolean;
  locked: boolean;
  order: (command: number, argument: number) => Promise<void>;
  command: number;
  argument?: number;
  label: string;
  detail: string;
  icon: string;
}) => {
  const reason = battle
    ? moveReason(battle, command, argument, now)
    : "Start a battle first.";
  return (
    <button
      className="order-button"
      disabled={!!reason || paused || locked}
      onClick={() => void order(command, argument)}
      title={reason || detail}
    >
      <Icon name={icon} />
      <span>
        <strong>{label}</strong>
        <small>{reason || detail}</small>
      </span>
    </button>
  );
};

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Battlefield");
  const [mode, setMode] = useState<"practice" | "wallet">("practice");
  const [faction, setFaction] = useState(0),
    [difficulty, setDifficulty] = useState(0),
    [quick, setQuick] = useState(false);
  const [practice, setPractice] = useState<Battle | null>(null),
    [elapsed, setElapsed] = useState(0),
    [paused, setPaused] = useState(false),
    [help, setHelp] = useState(false),
    [selection, setSelection] = useState("No Pepes selected"),
    [touchMode, setTouchMode] = useState<"select" | "move">("select");
  const [notice, setNotice] = useState(""),
    [sound, setSound] = useState(false),
    [localLog, setLocalLog] = useState<string[]>([]),
    [cosmetic, setCosmetic] = useState(0);
  const [confirmation, setConfirmation] = useState<{
      title: string;
      description: string;
      run: () => Promise<unknown>;
    } | null>(null),
    [confirmBusy, setConfirmBusy] = useState(false),
    [confirmError, setConfirmError] = useState("");
  const chain = useChain(
    () => setPaused(true),
    () => setPaused(false),
  );
  const scene = useRef<SceneHandle>(null),
    audio = useRef<AudioContext | undefined>(undefined);
  const battle = mode === "practice" ? practice : chain.player?.battle || null;
  const active = battle?.status === 1,
    terminal = !!battle && battle.status > 1;
  const now =
    mode === "practice"
      ? Math.floor(elapsed)
      : chain.live?.blockTime || Math.floor(Date.now() / 1000);
  const wrongChain =
    !!chain.account.address &&
    chain.account.chainId !== chain.runtime?.config.chainId;
  const confirm: Confirm = (title, description, run) => {
    setConfirmError("");
    const expected = chain.account;
    setConfirmation({
      title,
      description,
      run: async () => {
        if (expected.address && !title.toLowerCase().includes("practice")) {
          const current = (await chain.read({ type: "account" })) as {
            address: string | null;
            chainId: number;
          };
          if (
            current.address?.toLowerCase() !== expected.address.toLowerCase() ||
            Number(current.chainId) !== expected.chainId
          )
            throw Error("Wallet changed. Cancel and review this action again.");
        }
        return run();
      },
    });
  };
  const locked =
    mode === "wallet" && (!chain.ready || chain.pending || confirmBusy);
  useEffect(() => {
    if (!active || paused || mode !== "practice") return;
    let last = performance.now();
    const timer = setInterval(() => {
      const current = performance.now();
      if (!document.hidden)
        setElapsed((t) => t + ((current - last) / 1000) * (quick ? 10 : 1));
      last = current;
    }, 100);
    return () => clearInterval(timer);
  }, [active, paused, mode, quick]);
  useEffect(() => {
    if (practice?.status === 1 && elapsed >= 1200)
      setPractice((b) => (b ? { ...b, status: 4 } : null));
  }, [elapsed, practice?.status]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).matches("input,select,textarea,button,a") ||
      confirmation ||
      help
    )
      return;
    if (e.key === "Escape" || e.key.toLowerCase() === "p") {
      if (active) {
        e.preventDefault();
        setPaused((p) => !p);
      }
      return;
    }
    if (!active || paused || tab !== "Battlefield") return;
    const mapping: Record<string, [number, number]> = {
      g: [1, 0],
      b: [2, (battle?.tech || 0) + 1],
      r: [3, 0],
      f: [4, 0],
      h: [5, 0],
      e: [6, 0],
    };
    const action = mapping[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      void order(...action);
    }
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function beep() {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const o = audio.current.createOscillator(),
        gain = audio.current.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(540, audio.current.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        280,
        audio.current.currentTime + 0.13,
      );
      gain.gain.setValueAtTime(0.035, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.16,
      );
      o.connect(gain);
      gain.connect(audio.current.destination);
      o.start();
      o.stop(audio.current.currentTime + 0.18);
    } catch {
      /* Sound is optional. */
    }
  }
  function begin() {
    setNotice("");
    if (mode === "practice") {
      chain.setError("");
      setElapsed(0);
      setPractice(
        startBattle(faction, difficulty, 0, (practice?.id || 0n) + 1n),
      );
      setPaused(false);
      setLocalLog([
        "Mission started. Build power and barracks, then recruit your squad.",
      ]);
      beep();
      return;
    }
    if (!chain.ready || !chain.player) return;
    const before = chain.player.battle,
      argument = faction + difficulty * 2;
    confirm(
      "Deploy wallet battle",
      `${orderDescription(0, argument)} ${chain.live?.eligible ? "Currently eligible for a share of the funded day." : "Practice on chain: current conditions qualify for zero rewards."} All meaningful orders require a wallet transaction. Victory unlocks after five minutes; the battle expires after 20 minutes.`,
      async () => {
        const fresh = decodeState(
          chain.runtime!.abis.Game,
          (await chain.read({ type: "state" })) as Hex,
        );
        if (
          fresh.battle.id !== before.id ||
          fresh.battle.status !== before.status
        )
          throw Error(
            "Battle state changed. Refresh and review deployment again.",
          );
        await chain.request("Start battle", {
          type: "act",
          action: actionBytes(0, fresh.battle.id + 1n, 0, argument),
          value: "0",
        });
        setPaused(false);
      },
    );
  }
  async function order(command: number, argument: number) {
    if (!battle || !active || paused || locked) return;
    const reason = moveReason(battle, command, argument, now);
    if (reason) {
      setNotice(reason);
      return;
    }
    const description = orderDescription(command, argument, battle);
    if (mode === "practice") {
      const execute = () => {
        try {
          const next = stepBattle(
            battle,
            command,
            argument,
            Math.floor(elapsed),
          );
          setPractice(next);
          setNotice(description);
          setLocalLog((log) => [description, ...log].slice(0, 6));
          beep();
        } catch (e) {
          setNotice(errorMessage(e));
        }
      };
      if (command === 7)
        confirm(
          "Surrender practice battle",
          "End this local battle with zero rewards.",
          async () => execute(),
        );
      else execute();
      return;
    }
    const before = battle;
    confirm(
      command === 7 ? "Surrender battle" : "Confirm strategic order",
      description + " Native value: 0 ETH. Network gas applies.",
      async () => {
        const fresh = decodeState(
          chain.runtime!.abis.Game,
          (await chain.read({ type: "state" })) as Hex,
        );
        if (fresh.battle.id !== before.id || fresh.battle.turn !== before.turn)
          throw Error(
            "The session or turn changed. Refresh and review the order again.",
          );
        await chain.request("Battle order", {
          type: "act",
          action: actionBytes(
            command,
            fresh.battle.id,
            fresh.battle.turn,
            argument,
          ),
          value: "0",
        });
        beep();
      },
    );
  }
  function claimTokens() {
    confirm(
      "Claim PEPEFRONT",
      `Claim ${amount(chain.player?.tokens)} matured PEPEFRONT to your connected wallet. No recipient can be substituted. Network gas applies.`,
      () => chain.request("Claim PEPEFRONT", { type: "claim" }),
    );
  }
  function claimIMD() {
    confirm(
      "Claim IMD",
      `Claim ${amount(chain.player?.prizes, chain.runtime?.config.network.pairToken.decimals)} matured IMD to your connected wallet. Native value: 0 ETH.`,
      () =>
        chain.request("Claim IMD", {
          type: "act",
          action: actionBytes(9, 0n, 0, 0),
          value: "0",
        }),
    );
  }
  function buyCosmetic() {
    const needs = (chain.live?.allowance || 0n) < cosmeticPrice;
    if (needs)
      confirm(
        "Approve cosmetic purchase",
        "Allow Game to spend exactly 100 PEPEFRONT. This is only the approval; confirm the purchase separately.",
        () =>
          chain.request("Approve cosmetic", {
            type: "approve",
            amount: String(cosmeticPrice),
          }),
      );
    else
      confirm("Buy cosmetic", orderDescription(8, cosmetic), () =>
        chain.request("Buy cosmetic", {
          type: "act",
          action: actionBytes(8, 0n, 0, cosmetic),
          value: "0",
        }),
      );
  }
  const connectedName = chain.account.address
    ? `${chain.account.address.slice(0, 6)}…${chain.account.address.slice(-4)}`
    : "Connect wallet";
  const deployLabel =
    mode === "practice"
      ? "Play practice"
      : !chain.account.address
        ? "Connect to deploy"
        : wrongChain
          ? "Switch network"
          : "Deploy wallet battle";
  function mainAction() {
    if (mode === "wallet" && !chain.account.address) void chain.connect();
    else if (mode === "wallet" && wrongChain) void chain.switchChain();
    else begin();
  }
  function selectMode(m: "practice" | "wallet") {
    setMode(m);
    setNotice("");
    setPaused(false);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to game
      </a>
      <div className={`app ${chain.embedded ? "embedded" : ""}`}>
        <header className="header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("Battlefield");
            }}
            aria-label="RH PEPEFRONT battlefield"
          >
            <img src="./favicon.svg" width="38" height="38" alt="" />
            <div>
              <h1 className="stencil">PEPEFRONT</h1>
              <span>RH · Unofficial community RTS</span>
            </div>
          </a>
          <div className="header-tools">
            <button
              className="icon-button help-button"
              aria-label="How to play"
              onClick={() => {
                if (active) setPaused(true);
                setHelp(true);
              }}
            >
              <Icon name="help" />
            </button>
            <button
              className="wallet-button"
              onClick={() =>
                void (wrongChain ? chain.switchChain() : chain.connect())
              }
              disabled={chain.loading}
            >
              <Icon name="wallet" />
              <span>
                {chain.loading
                  ? "Reading wallet…"
                  : wrongChain
                    ? "Switch network"
                    : chain.embedded
                      ? "Refresh host wallet"
                      : connectedName}
              </span>
            </button>
          </div>
        </header>
        <div className="nav-bar">
          <nav aria-label="Game sections">
            {tabs.map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => {
                  setTab(t);
                  if (t !== "Battlefield") setPaused(true);
                }}
              >
                {t}
              </button>
            ))}
          </nav>
          <span className="network-label">
            <span
              className={`status-dot ${chain.verified ? "verified" : ""}`}
            />
            {chain.runtime?.config.network.name || "Loading network"}
          </span>
        </div>
        <main id="main">
          {chain.error && (
            <div className="notice error" role="alert">
              <span>{chain.error}</span>
              <button
                onClick={() =>
                  void (chain.verified ? chain.refresh() : chain.verify())
                }
                disabled={chain.loading}
              >
                Retry checks
              </button>
            </div>
          )}
          {wrongChain && (
            <div className="notice">
              <span>
                Wallet is on chain {chain.account.chainId}. Use{" "}
                {chain.runtime?.config.network.name} to send an order.
              </span>
              <button onClick={() => void chain.switchChain()}>
                Switch to {chain.runtime?.config.network.name}
              </button>
            </div>
          )}
          {chain.hostPreview && (
            <div className="notice">
              Host preview: wallet writes are disabled. Practice is available.
            </div>
          )}
          {tab === "Battlefield" && (
            <>
              <div className="battle-heading">
                <div>
                  <h2 className="stencil">
                    {active
                      ? "Hold the crystal front."
                      : "Take the crystal front."}
                  </h2>
                  <p>A solo Pepe strategy game. Harvest, build, outlast.</p>
                </div>
                <div
                  className="mode-control segmented"
                  aria-label="Battle mode"
                >
                  <button
                    aria-pressed={mode === "practice"}
                    onClick={() => selectMode("practice")}
                  >
                    Free practice
                  </button>
                  <button
                    aria-pressed={mode === "wallet"}
                    onClick={() => selectMode("wallet")}
                  >
                    Wallet battle
                  </button>
                </div>
              </div>
              <div className="battle-layout">
                <section
                  className="battle-surface"
                  aria-label="Battlefield and orders"
                >
                  <div className="scene-wrap">
                    <Scene
                      ref={scene}
                      battle={battle}
                      active={!!active}
                      paused={paused || !active}
                      touchMode={touchMode}
                      onOrder={(c, a) => void order(c, a)}
                      onSelection={setSelection}
                    />
                    <div className="scene-top">
                      <span className="map-location">
                        <Icon name="cross" size={16} /> Crystal basin{" "}
                        <span className="muted">/ Sector 07</span>
                      </span>
                      <div className="scene-tools">
                        <button
                          className="icon-button"
                          aria-label={sound ? "Mute sound" : "Enable sound"}
                          onClick={() => {
                            setSound((v) => !v);
                          }}
                        >
                          <Icon name={sound ? "volume" : "muted"} size={18} />
                        </button>
                        {active && (
                          <button
                            className="icon-button"
                            aria-label={
                              paused ? "Resume battle" : "Pause battle"
                            }
                            onClick={() => setPaused((p) => !p)}
                          >
                            <Icon name={paused ? "play" : "pause"} size={18} />
                          </button>
                        )}
                        <button
                          className="icon-button"
                          aria-label="Reset camera"
                          onClick={() => scene.current?.home()}
                        >
                          <Icon name="expand" size={18} />
                        </button>
                      </div>
                    </div>
                    {active && (
                      <div className="scene-hud">
                        <span>
                          Base <strong>{battle!.baseHP}</strong>
                        </span>
                        <span>
                          Enemy <strong>{battle!.enemyHP}</strong>
                        </span>
                        <span>
                          <strong>
                            {time(Number(battle!.deadline) - now)}
                          </strong>
                        </span>
                      </div>
                    )}
                    {!active && !terminal && (
                      <div className="scene-caption">
                        <div>
                          <span className="live-marker" />
                          Single-player · Two factions
                        </div>
                        <strong>Every crystal is contested.</strong>
                        <span>Build a squad. Break their base.</span>
                      </div>
                    )}
                    {active && paused && (
                      <div className="pause-overlay">
                        <div>
                          <Icon name="pause" size={32} />
                          <h3>Battle paused</h3>
                          <p>
                            {mode === "wallet"
                              ? "Visuals are paused. The on-chain deadline keeps running."
                              : "Your practice battle is paused."}
                          </p>
                          <button
                            className="primary"
                            onClick={() => setPaused(false)}
                          >
                            Resume battle
                          </button>
                        </div>
                      </div>
                    )}
                    {terminal && (
                      <div className="results-overlay">
                        <div>
                          <Icon
                            name={battle!.status === 2 ? "flag" : "shield"}
                            size={32}
                          />
                          <h3>{statusNames[battle!.status]}</h3>
                          <p>
                            {battle!.status === 2
                              ? "The basin is yours. Your Pepes held the front."
                              : "Regroup your Pepes and return to the front."}
                          </p>
                          <dl>
                            <div>
                              <dt>Orders</dt>
                              <dd>{battle!.turn}</dd>
                            </div>
                            <div>
                              <dt>Harvests</dt>
                              <dd>{battle!.harvests}</dd>
                            </div>
                            <div>
                              <dt>Army</dt>
                              <dd>{armySize(battle!)}</dd>
                            </div>
                          </dl>
                          <p>
                            {mode === "practice"
                              ? "Local practice result. No token rewards."
                              : battle!.rewarded && battle!.status === 2
                                ? "Command power recorded. Rewards mature after the UTC day closes."
                                : "This battle earned no rewards."}
                          </p>
                          <div className="button-row">
                            <button
                              className="primary"
                              disabled={locked}
                              onClick={begin}
                            >
                              Play again
                              <Icon name="arrow" />
                            </button>
                            {mode === "wallet" && (
                              <button onClick={() => setTab("Rewards")}>
                                View rewards
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="minimap" aria-label="Minimap">
                      <svg viewBox="0 0 100 64" aria-hidden="true">
                        <path d="M2 2h96v60H2z" fill="#132c29" />
                        <path
                          d="M0 38h100M38 0v64"
                          stroke="#45605a"
                          strokeWidth="5"
                        />
                        <path
                          d="m44 40 5-9 6 10-6 7zM68 50l4-5 4 7zM25 15l4-5 4 7z"
                          fill="#80c871"
                        />
                        <rect
                          x="14"
                          y="42"
                          width="14"
                          height="10"
                          fill="#58e3d6"
                        />
                        <rect
                          x="74"
                          y="10"
                          width="14"
                          height="10"
                          fill="#f08cab"
                        />
                        <rect
                          x="39"
                          y="19"
                          width="27"
                          height="24"
                          fill="none"
                          stroke="#d9e7c0"
                          strokeWidth="1"
                        />
                      </svg>
                      <button
                        aria-label="Minimap: jump to your base"
                        onClick={() => {
                          scene.current?.home();
                          scene.current?.pan(-9, 5);
                        }}
                      >
                        Base
                      </button>
                      <button
                        aria-label="Minimap: jump to enemy base"
                        onClick={() => {
                          scene.current?.home();
                          scene.current?.pan(9, -5);
                        }}
                      >
                        Enemy
                      </button>
                    </div>
                  </div>
                  {!active && !terminal && (
                    <div className="deploy-bar">
                      <div>
                        <strong>
                          {mode === "practice"
                            ? "Your first orders are free."
                            : "Make each order count."}
                        </strong>
                        <span>
                          {mode === "practice"
                            ? "No wallet needed. No rewards."
                            : chain.live
                              ? chain.live.eligible
                                ? "Funded day · reward eligibility available"
                                : "Unfunded or ineligible · zero-reward battle"
                              : "Connect to read live eligibility."}
                        </span>
                      </div>
                      <button
                        className="primary"
                        disabled={
                          mode === "wallet" &&
                          !!chain.account.address &&
                          !wrongChain &&
                          locked
                        }
                        onClick={mainAction}
                      >
                        {deployLabel}
                        <Icon name="arrow" />
                      </button>
                    </div>
                  )}
                  {active && (
                    <>
                      <div className="resource-bar">
                        <span>
                          <Icon name="crystal" />
                          <strong data-testid="ore-count">
                            {battle!.ore}
                          </strong>{" "}
                          ore
                        </span>
                        <span>
                          <Icon name="recruit" />
                          <strong>{armySize(battle!)}/12</strong> Pepes
                        </span>
                        <span>
                          <Icon name="flag" />
                          <strong>{battle!.points}/3</strong> holds
                        </span>
                        <span>
                          Turn <strong>{battle!.turn}/48</strong>
                        </span>
                      </div>
                      <div className="tactical-bar">
                        <span aria-live="polite">{selection}</span>
                        <div className="button-row">
                          <button onClick={() => scene.current?.selectAll()}>
                            Select all
                          </button>
                          <button
                            aria-pressed={touchMode === "move"}
                            onClick={() =>
                              setTouchMode((t) =>
                                t === "move" ? "select" : "move",
                              )
                            }
                          >
                            {touchMode === "move"
                              ? "Tap to move"
                              : "Tap to select"}
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Zoom in"
                            onClick={() => scene.current?.zoom(1)}
                          >
                            +
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Zoom out"
                            onClick={() => scene.current?.zoom(-1)}
                          >
                            −
                          </button>
                        </div>
                      </div>
                      <div className="orders-grid">
                        <OrderButton
                          battle={battle}
                          now={now}
                          paused={paused}
                          locked={locked}
                          order={order}
                          command={1}
                          label="Harvest"
                          detail={`+${battle!.faction === 0 ? 30 : 35} ore · G`}
                          icon="crystal"
                        />
                        <OrderButton
                          battle={battle}
                          now={now}
                          paused={paused}
                          locked={locked}
                          order={order}
                          command={2}
                          argument={Math.min(5, battle!.tech + 1)}
                          label={
                            battle!.tech === 4
                              ? "Tech complete"
                              : `Build ${structures[battle!.tech + 1]}`
                          }
                          detail={`${buildCosts[battle!.tech + 1] || 0} ore · B`}
                          icon="build"
                        />
                        {[0, 1, 2].map((rank) => (
                          <OrderButton
                            battle={battle}
                            now={now}
                            paused={paused}
                            locked={locked}
                            order={order}
                            key={rank}
                            command={3}
                            argument={rank}
                            label={unitNames[rank]}
                            detail={`${unitCost(battle!, rank)} ore · ${[8, 20, 32][rank]} strength`}
                            icon="recruit"
                          />
                        ))}
                        <OrderButton
                          battle={battle}
                          now={now}
                          paused={paused}
                          locked={locked}
                          order={order}
                          command={4}
                          label="Attack base"
                          detail={`${Math.max(0, strength(battle!) - battle!.difficulty * 3)} damage · F`}
                          icon="attack"
                        />
                        <OrderButton
                          battle={battle}
                          now={now}
                          paused={paused}
                          locked={locked}
                          order={order}
                          command={5}
                          label="Hold point"
                          detail={`${battle!.points}/3 holds · H`}
                          icon="flag"
                        />
                        <OrderButton
                          battle={battle}
                          now={now}
                          paused={paused}
                          locked={locked}
                          order={order}
                          command={6}
                          label="Repair base"
                          detail="25 ore · +30 HP · E"
                          icon="repair"
                        />
                      </div>
                      <p className="battle-notice" role="status">
                        {notice ||
                          `Victory unlocks at 05:00. ${mode === "wallet" ? "Orders use chain time; refreshes every 5 seconds." : "Enemy retaliation follows every order."}`}
                      </p>
                      <div className="battle-bottom">
                        <span>
                          {mode === "practice"
                            ? `Local practice${quick ? " · 10× clock" : ""} · zero rewards`
                            : battle!.rewarded
                              ? "Reward-eligible session · variable funded share"
                              : "Practice on chain · zero rewards"}
                        </span>
                        <button
                          className="text-button"
                          disabled={locked || paused}
                          onClick={() => void order(7, 0)}
                        >
                          Surrender
                        </button>
                      </div>
                    </>
                  )}
                </section>
                <aside className="command-panel">
                  {!active ? (
                    <>
                      <h3>Choose your side</h3>
                      <div className="faction-options">
                        <button
                          className={`faction ${faction === 0 ? "selected" : ""}`}
                          aria-pressed={faction === 0}
                          onClick={() => setFaction(0)}
                        >
                          <PepePortrait />
                          <span>
                            <strong>Initiative</strong>
                            <small>Defensive · high-tech</small>
                          </span>
                          <Icon name={faction === 0 ? "check" : "shield"} />
                        </button>
                        <button
                          className={`faction cult ${faction === 1 ? "selected" : ""}`}
                          aria-pressed={faction === 1}
                          onClick={() => setFaction(1)}
                        >
                          <PepePortrait cult />
                          <span>
                            <strong>Cult</strong>
                            <small>Aggressive · cheaper units</small>
                          </span>
                          <Icon name={faction === 1 ? "check" : "cult"} />
                        </button>
                      </div>
                      <label htmlFor="difficulty">Enemy pressure</label>
                      <select
                        id="difficulty"
                        value={difficulty}
                        onChange={(e) => setDifficulty(Number(e.target.value))}
                      >
                        <option value="0">01 · Skirmish</option>
                        <option value="1">02 · Veteran</option>
                        <option value="2">03 · Siege</option>
                      </select>
                      {mode === "practice" && (
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={quick}
                            onChange={(e) => setQuick(e.target.checked)}
                          />
                          Quick drill · 10× clock
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="commander">
                        <PepePortrait cult={battle!.faction === 1} />
                        <div>
                          <h3 className="stencil">
                            {battle!.faction === 0 ? "Initiative" : "Cult"}{" "}
                            command
                          </h3>
                          <p>
                            {
                              ["Skirmish", "Veteran", "Siege"][
                                battle!.difficulty
                              ]
                            }{" "}
                            pressure
                          </p>
                        </div>
                      </div>
                      <dl className="data-list">
                        <div>
                          <dt>Army strength</dt>
                          <dd>{strength(battle!)}</dd>
                        </div>
                        <div>
                          <dt>Base development</dt>
                          <dd>{structures[battle!.tech]}</dd>
                        </div>
                        <div>
                          <dt>Harvest orders</dt>
                          <dd>{battle!.harvests}</dd>
                        </div>
                        <div>
                          <dt>Earliest victory</dt>
                          <dd>
                            {time(
                              Math.max(
                                0,
                                Number(battle!.startedAt) + 300 - now,
                              ),
                            )}
                          </dd>
                        </div>
                      </dl>
                    </>
                  )}
                  <div className="briefing">
                    <div className="briefing-title">
                      <Icon name="flag" />
                      <h3 className="stencil">Mission briefing</h3>
                    </div>
                    <p>
                      Crystal Basin is the last supply line. Establish your base
                      before the enemy closes in.
                    </p>
                    <ol>
                      <li>
                        <span>01</span>Harvest crystals for ore.
                      </li>
                      <li>
                        <span>02</span>Build power, then barracks.
                      </li>
                      <li>
                        <span>03</span>Recruit Pepes. Hold the point three times
                        or destroy their base.
                      </li>
                    </ol>
                    <p className="muted">
                      5–20 minute battles. Strategic orders determine results;
                      map movement is tactical presentation.
                    </p>
                  </div>
                  <button
                    className="help-link"
                    onClick={() => {
                      if (active) setPaused(true);
                      setHelp(true);
                    }}
                  >
                    <Icon name="help" />
                    View controls & field manual
                    <Icon name="arrow" size={16} />
                  </button>
                </aside>
              </div>
              <div className="below-battle">
                <div>
                  <Icon name="shield" />
                  <h3>Solo. Strategic. All Pepe.</h3>
                  <p>
                    Two factions, three difficulties, one contested basin. No
                    multiplayer or score signer.
                  </p>
                </div>
                <div>
                  <Icon name="crystal" />
                  <h3>Ore is your supply line.</h3>
                  <p>
                    Recruit, Tank and Commando Pepes need buildings and ore.
                    Harvester Pepes return to base automatically.
                  </p>
                </div>
                <div>
                  <Icon name="wallet" />
                  <h3>Wallet rewards are separate.</h3>
                  <p>
                    Only confirmed contract battles can earn command power.
                    Practice scores never become token claims.
                  </p>
                </div>
              </div>
              {localLog.length > 0 && mode === "practice" && (
                <details className="event-log">
                  <summary>Practice order log</summary>
                  <ol>
                    {localLog.map((line, i) => (
                      <li key={`${line}-${i}`}>{line}</li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
          {tab === "Rewards" && (
            <section className="utility-section">
              <div className="section-intro">
                <h2>Command earns its share.</h2>
                <p>
                  Read your funded entitlements, claim matured rewards and equip
                  cosmetic rank insignia.
                </p>
              </div>
              {!chain.account.address && (
                <div className="notice">
                  <span>
                    Connect your wallet to read live balances and reward
                    eligibility.
                  </span>
                  <button
                    className="primary"
                    onClick={() => void chain.connect()}
                  >
                    Connect wallet
                  </button>
                </div>
              )}
              <div className="utility-grid">
                <section className="panel">
                  <h3>Matured rewards</h3>
                  <div className="reward-line">
                    <div>
                      <span>PEPEFRONT</span>
                      <strong>{amount(chain.player?.tokens)}</strong>
                    </div>
                    <button
                      className="primary"
                      disabled={
                        !chain.ready || chain.pending || !chain.player?.tokens
                      }
                      onClick={claimTokens}
                    >
                      Claim PEPEFRONT
                    </button>
                  </div>
                  <div className="reward-line">
                    <div>
                      <span>IMD prize</span>
                      <strong>
                        {amount(
                          chain.player?.prizes,
                          chain.runtime?.config.network.pairToken.decimals,
                        )}
                      </strong>
                    </div>
                    <button
                      className="primary"
                      disabled={
                        !chain.ready || chain.pending || !chain.player?.prizes
                      }
                      onClick={claimIMD}
                    >
                      Claim IMD
                    </button>
                  </div>
                  <p className="muted">
                    Only matured, funded amounts appear here. Unsettled power is
                    not a claim. USD context unavailable.
                  </p>
                  <button
                    disabled={chain.loading}
                    onClick={() => void chain.refresh()}
                  >
                    {chain.loading ? "Refreshing…" : "Refresh rewards"}
                  </button>
                </section>
                <section className="panel">
                  <h3>Command power</h3>
                  <dl className="data-list">
                    <div>
                      <dt>Your recorded power</dt>
                      <dd>
                        {chain.player
                          ? String(chain.player.rewards.power)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Power epoch</dt>
                      <dd>
                        {chain.player
                          ? String(chain.player.rewards.epoch)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Today’s total power</dt>
                      <dd>{chain.live ? String(chain.live.epoch[4]) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Today’s token budget</dt>
                      <dd>{amount(chain.live?.epoch[0])} PEPEFRONT</dd>
                    </div>
                    <div>
                      <dt>Today’s prize budget</dt>
                      <dd>
                        {amount(
                          chain.live?.epoch[1],
                          chain.runtime?.config.network.pairToken.decimals,
                        )}{" "}
                        IMD
                      </dd>
                    </div>
                    <div>
                      <dt>Reward eligibility now</dt>
                      <dd>
                        {chain.live
                          ? chain.live.eligible
                            ? "Available"
                            : "Not eligible"
                          : "Connect to check"}
                      </dd>
                    </div>
                    <div>
                      <dt>Cooldown ends</dt>
                      <dd>
                        {chain.player?.command.rewardedBefore
                          ? new Date(
                              Number(
                                chain.player.command.lastRewardAt + 86400n,
                              ) * 1000,
                            ).toLocaleString()
                          : chain.player
                            ? "No recorded cooldown"
                            : "Connect to check"}
                      </dd>
                    </div>
                    <div>
                      <dt>Counted wins / harvests today</dt>
                      <dd>
                        {chain.player && chain.live
                          ? chain.player.command.day ===
                            BigInt(Math.floor(chain.live.blockTime / 86400))
                            ? `${chain.player.command.wins}/3 · ${chain.player.command.harvests}/5`
                            : "0/3 · 0/5"
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="muted">
                    Shares settle at 00:00 UTC. A rewarded win starts a 24-hour
                    cooldown. Final rewards depend on total power; no fixed
                    payout is promised.
                  </p>
                </section>
                <section className="panel cosmetic-panel">
                  <div className="commander">
                    <PepePortrait cult={cosmetic === 6} />
                    <div>
                      <h3>Rank, without advantage.</h3>
                      <p>Cosmetics never improve combat power.</p>
                    </div>
                  </div>
                  <label htmlFor="cosmetic">Choose an insignia</label>
                  <select
                    id="cosmetic"
                    value={cosmetic}
                    onChange={(e) => setCosmetic(Number(e.target.value))}
                  >
                    {cosmetics.map((c, i) => (
                      <option key={c} value={i}>
                        {c}
                        {chain.player &&
                        (chain.player.cosmetics & (1n << BigInt(i))) !== 0n
                          ? " · owned"
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p>
                    <strong>100 PEPEFRONT</strong> per cosmetic. 75 are
                    permanently retired; 25 fund tomorrow’s rewards. Token total
                    supply stays fixed.
                  </p>
                  <p className="muted">
                    Wallet balance: {amount(chain.live?.balance)} PEPEFRONT
                  </p>
                  <button
                    className="primary full"
                    disabled={
                      !chain.ready ||
                      chain.pending ||
                      (chain.live?.balance || 0n) < cosmeticPrice ||
                      !!(
                        chain.player &&
                        (chain.player.cosmetics & (1n << BigInt(cosmetic))) !==
                          0n
                      )
                    }
                    onClick={buyCosmetic}
                  >
                    {chain.player &&
                    (chain.player.cosmetics & (1n << BigInt(cosmetic))) !== 0n
                      ? "Already owned"
                      : (chain.live?.allowance || 0n) < cosmeticPrice
                        ? "Approve 100 PEPEFRONT"
                        : "Buy cosmetic"}
                  </button>
                  {chain.live && chain.live.balance < cosmeticPrice && (
                    <p className="muted">
                      You need 100 PEPEFRONT for a cosmetic.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h3>Deposited rewards. Fixed supply.</h3>
                  <p>
                    PEPEFRONT is an unofficial community token with a fixed
                    one-billion supply. It is not the IMD token.
                  </p>
                  <p>
                    Game has no minting or emissions. Sponsors and cosmetic
                    revenue fund future reward days. Without funding, battles
                    earn zero.
                  </p>
                  <p>
                    Only a verified victory counts. Up to five harvest orders
                    contribute to a rewarded win’s power; harvesting alone
                    creates no claim.
                  </p>
                  <button onClick={() => setTab("Operations")}>
                    Inspect funding & contracts
                    <Icon name="arrow" />
                  </button>
                </section>
              </div>
            </section>
          )}
          {tab === "Exchange" && <Exchange chain={chain} confirm={confirm} />}
          {tab === "Operations" && (
            <Operations chain={chain} confirm={confirm} />
          )}
          {chain.tx.phase !== "idle" && (
            <div
              className={`transaction-status ${chain.tx.phase === "error" ? "error" : ""}`}
              role={chain.tx.phase === "error" ? "alert" : "status"}
            >
              <div>
                <strong>{chain.tx.label}</strong>
                <span>
                  {
                    {
                      simulating: "Simulating before signature…",
                      signing: "Review in your wallet…",
                      pending: "Waiting for chain confirmation…",
                      success: "Confirmed",
                      error: "Request failed",
                      uncertain: "Confirmation uncertain",
                      idle: "",
                    }[chain.tx.phase]
                  }
                </span>
                {chain.tx.message && <p>{chain.tx.message}</p>}
              </div>
              {chain.tx.hash && chain.runtime && (
                <a
                  href={`${chain.runtime.config.network.explorer}/tx/${chain.tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction ↗
                </a>
              )}
              {chain.tx.phase === "uncertain" && !chain.embedded && (
                <button
                  onClick={() =>
                    void chain.service
                      ?.checkReceipt()
                      .then(() => chain.refresh())
                      .catch((e) => chain.setError(errorMessage(e)))
                  }
                >
                  Check receipt
                </button>
              )}
              {chain.tx.phase === "uncertain" && chain.embedded && (
                <p>
                  Check the host wallet for the pending request. Reopen the game
                  only after resolving it.
                </p>
              )}
            </div>
          )}
        </main>
        <footer>
          <div>
            <strong>RH PEPEFRONT</strong>
            <span>
              Unofficial community strategy game. Not an official IMD product.
            </span>
          </div>
          <div className="footer-links">
            <a
              href="https://pepe2pepe.fun/games"
              target="_blank"
              rel="noreferrer"
            >
              Play on Pepe2Pepe ↗
            </a>
            <button
              className="text-button"
              onClick={() => setTab("Operations")}
            >
              Contracts & source
            </button>
            <a href="./pepe-game.json" target="_blank" rel="noreferrer">
              Game manifest
            </a>
          </div>
          {chain.runtime && (
            <AddressLink
              address={chain.runtime.contract("LaunchToken").address}
              runtime={chain.runtime}
              label="PEPEFRONT token"
            />
          )}
          <p className="muted">
            The hosted-play link opens the Pepe2Pepe game catalog.
          </p>
          {chain.live && (
            <p className="muted">
              Live state read at block {String(chain.live.block)} ·{" "}
              {new Date(chain.live.blockTime * 1000).toUTCString()}
            </p>
          )}
        </footer>
      </div>
      {help && (
        <Modal title="Field manual" onClose={() => setHelp(false)}>
          <p>
            Build power → barracks → factory → tech. Harvest ore, produce Pepes
            and win by destroying the enemy base or holding the point three
            consecutive times.
          </p>
          <dl className="controls-list">
            <div>
              <dt>Select</dt>
              <dd>
                Click a Pepe, drag a box or press Q for all. Double-click
                selects the same rank.
              </dd>
            </div>
            <div>
              <dt>Move</dt>
              <dd>
                Right-click the map. Shift queues up to eight waypoints. Ctrl +
                1–5 stores groups; 1–5 recalls them.
              </dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd>
                WASD or arrows, edge pan, mouse wheel. Use the minimap for base
                jumps.
              </dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd>
                G harvest · B build · R recruit · F attack · H hold · E repair.
                P or Escape pauses.
              </dd>
            </div>
            <div>
              <dt>Touch</dt>
              <dd>
                Tap Select all, then Tap to move and tap a destination. All
                strategic orders have buttons.
              </dd>
            </div>
          </dl>
          <p>
            Focus the battlefield for camera shortcuts. Movement animates your
            orders; the strategic turn rules decide damage and victory.
          </p>
          <p>
            Each turn unlocks 10 seconds after the last scheduled slot. Victory
            needs at least five minutes. Quick drill compresses the local clock
            only. Wallet battles expire after 20 minutes even while paused.
          </p>
          <button className="primary full" onClick={() => setHelp(false)}>
            Return to the front
            <Icon name="arrow" />
          </button>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!confirmBusy) setConfirmation(null);
          }}
        >
          <p>{confirmation.description}</p>
          {chain.account.address && mode === "wallet" && (
            <p className="muted break-anywhere">
              Wallet: {chain.account.address}
            </p>
          )}
          {confirmError && (
            <p role="alert" className="error">
              {confirmError}
            </p>
          )}
          {confirmBusy && (
            <p role="status">
              {chain.tx.phase === "pending"
                ? "Transaction submitted. Waiting for confirmation…"
                : "Checking state. Follow the wallet or host prompt…"}
            </p>
          )}
          <div className="button-row">
            <button
              disabled={confirmBusy}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={confirmBusy || chain.pending}
              onClick={async () => {
                if (confirmBusy) return;
                setConfirmBusy(true);
                setConfirmError("");
                try {
                  await confirmation.run();
                  setConfirmation(null);
                } catch (e) {
                  setConfirmError(errorMessage(e));
                } finally {
                  setConfirmBusy(false);
                }
              }}
            >
              {confirmBusy ? "Confirming…" : confirmation.title}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
