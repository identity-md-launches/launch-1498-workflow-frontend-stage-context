import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeAbiParameters, encodeAbiParameters, type Abi } from "viem";
import {
  startBattle,
  stepBattle,
  moveReason,
  strength,
  unitCost,
} from "../src/rules";
import {
  actionBytes,
  decodeState,
  stateParameters,
  errorMessage,
} from "../src/chain";
import { swapPayload } from "../src/swap";
import type { Runtime } from "../src/config";
const abi = JSON.parse(
  readFileSync(new URL("../../docs/abi/Game.json", import.meta.url), "utf8"),
) as Abi;
test("action wire format is four padded ABI words, preserves exact session/turn", () => {
  const hex = actionBytes(3, 9n, 7, 2);
  assert.equal((hex.length - 2) / 2, 128);
  assert.deepEqual(
    decodeAbiParameters(
      [
        { type: "uint8" },
        { type: "uint64" },
        { type: "uint8" },
        { type: "uint8" },
      ],
      hex,
    ),
    [3, 9n, 7, 2],
  );
});
test("contract-derived state tuples decode version, rewards and cosmetic bitmask", () => {
  const battle = startBattle(1, 2, 1000, 4n);
  const command = {
    day: 0n,
    lastRewardAt: 0n,
    wins: 0,
    harvests: 0,
    rewardedBefore: false,
  };
  const rewards = { epoch: 0n, power: 0n, tokens: 2n, prizes: 3n };
  const hex = encodeAbiParameters(stateParameters(abi), [
    1,
    battle,
    command,
    rewards,
    5n,
    12n,
    13n,
  ]);
  const s = decodeState(abi, hex);
  assert.deepEqual(s.battle, battle);
  assert.equal(s.tokens, 12n);
  assert.equal(s.prizes, 13n);
  assert.equal(s.cosmetics, 5n);
  assert.throws(
    () =>
      decodeState(
        abi,
        encodeAbiParameters(stateParameters(abi), [
          2,
          battle,
          command,
          rewards,
          0n,
          0n,
          0n,
        ]),
      ),
    /version/,
  );
});
test("five-minute victory gate is atomic and does not consume a turn", () => {
  let b = startBattle(0, 0, 0);
  for (const [cmd, arg] of [
    [2, 1],
    [2, 2],
    [1, 0],
    [3, 0],
    [3, 0],
    [5, 0],
    [5, 0],
  ])
    b = stepBattle(b, cmd, arg, 200);
  assert.equal(b.points, 2);
  assert.equal(b.turn, 7);
  assert.equal(strength(b), 16);
  assert.throws(() => stepBattle(b, 5, 0, 299), /Victory unlocks/);
  assert.equal(b.turn, 7);
  const won = stepBattle(b, 5, 0, 300);
  assert.equal(won.status, 2);
  assert.equal(won.points, 3);
  assert.equal(won.turn, 8);
  assert.throws(() => stepBattle(won, 1, 0, 310), /Start a battle/);
});
test("turn schedule, prerequisites, costs, repair, army cap and deadline", () => {
  let b = startBattle(0, 0, 0);
  assert.match(moveReason(b, 1, 0, 9)!, /Next order/);
  assert.equal(moveReason(b, 1, 0, 10), null);
  assert.throws(() => stepBattle(b, 3, 0, 30), /barracks/);
  assert.throws(() => stepBattle(b, 2, 2, 30), /in order/);
  b = stepBattle(b, 2, 1, 10);
  assert.equal(b.ore, 70);
  assert.equal(b.baseHP, 198);
  b = stepBattle(b, 6, 0, 20);
  assert.equal(b.ore, 45);
  assert.equal(b.baseHP, 198);
  assert.throws(() => stepBattle({ ...b, ore: 0 }, 2, 2, 100), /Need 40/);
  assert.throws(
    () => stepBattle({ ...b, tech: 4, recruits: 12 }, 3, 0, 100),
    /full/,
  );
  assert.throws(() => stepBattle(b, 1, 0, 1200), /deadline/);
  assert.equal(stepBattle(b, 7, 0, 21).status, 5);
});
test("all factions/difficulties, complete build progression, attack victory and loss", () => {
  for (let faction = 0; faction < 2; faction++)
    for (let difficulty = 0; difficulty < 3; difficulty++) {
      let b = startBattle(faction, difficulty, 0);
      assert.equal(b.baseHP, faction ? 160 : 200);
      assert.equal(b.enemyHP, 120 + 60 * difficulty);
      assert.equal(unitCost(b, 0), faction ? 20 : 25);
      b = stepBattle(b, 1, 0, 300);
      assert.equal(b.ore, faction ? 135 : 130);
      b = { ...b, ore: 1000 };
      for (let level = 1; level <= 4; level++) b = stepBattle(b, 2, level, 300);
      for (let rank = 0; rank <= 2; rank++) b = stepBattle(b, 3, rank, 300);
      assert.equal(strength(b), 60);
      while (b.status === 1) b = stepBattle(b, 4, 0, 600);
      assert.equal(b.status, 2);
    }
  let b = { ...startBattle(1, 2, 0), baseHP: 1 };
  assert.equal(stepBattle(b, 1, 0, 10).status, 3);
  b = { ...startBattle(0, 0, 0), turn: 47 };
  assert.equal(stepBattle(b, 1, 0, 480).status, 3);
});
test("Robinhood extended router payload includes the sixth tuple field and settles ERC20 without native value", () => {
  const deployment = JSON.parse(
    readFileSync(
      new URL("../reference/deployment.json", import.meta.url),
      "utf8",
    ),
  );
  const network = JSON.parse(
    readFileSync(new URL("../reference/network.json", import.meta.url), "utf8"),
  );
  const runtime = { config: { ...deployment, ...network } } as Runtime;
  const p = swapPayload(runtime, deployment.poolKey.currency0, 123n, 90n);
  assert.equal(p.commands, "0x10");
  const [actions, params] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    p.inputs[0],
  );
  assert.equal(actions, "0x060c0f");
  assert.equal(params.length, 3);
  // pool key (5 words) + direction + amount + minimum + extended zero + offset + dynamic bytes length.
  assert.equal((params[0].length - 2) / 2, 384);
  const [currency, value] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    params[1],
  );
  assert.equal(currency.toLowerCase(), deployment.poolKey.currency0);
  assert.equal(value, 123n);
  const [, minimum] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    params[2],
  );
  assert.equal(minimum, 90n);
  const reverse = swapPayload(runtime, deployment.poolKey.currency1, 100n, 95n);
  assert.equal(reverse.output, deployment.poolKey.currency0);
});
test("wallet rejection and stale turn errors explain recovery", () => {
  assert.match(errorMessage({ code: 4001 }), /rejected/);
  assert.match(errorMessage({ message: "WrongTurn()" }), /Refresh/);
});

test("amount parsing rejects silent rounding and nondecimal inputs", async () => {
  const { exactUnits } = await import("../src/chain");
  assert.equal(exactUnits("1.25", 2), 125n);
  assert.throws(() => exactUnits("1.251", 2), /decimal places/);
  assert.throws(() => exactUnits("1e3", 18), /nonnegative amount/);
  assert.throws(() => exactUnits("-1", 18), /nonnegative amount/);
});

test("a transport failure after a transaction hash locks writes until a receipt check", async () => {
  const { ChainService } = await import("../src/chain");
  const { defineChain } = await import("viem");
  const deployment = JSON.parse(
    readFileSync(
      new URL("../reference/deployment.json", import.meta.url),
      "utf8",
    ),
  );
  const { network } = JSON.parse(
    readFileSync(new URL("../reference/network.json", import.meta.url), "utf8"),
  );
  const { creator } = JSON.parse(
    readFileSync(
      new URL("../reference/platform.json", import.meta.url),
      "utf8",
    ),
  );
  const game = deployment.contracts.find(
    (c: { name: string }) => c.name === "Game",
  );
  const txHash = deployment.contracts[0].txHash;
  const changes: { phase: string }[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ethereum: {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_accounts") return [creator];
          if (method === "eth_chainId") return "0x1237";
          if (method === "eth_sendTransaction") return txHash;
          throw Error("Unexpected wallet method: " + method);
        },
      },
    },
  });
  try {
    const runtime = {
      config: { ...deployment, network },
      chain: defineChain({
        id: deployment.chainId,
        name: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: { default: { http: network.rpcUrls } },
      }),
      client: {
        simulateContract: async () => ({
          request: {
            address: game.address,
            abi,
            functionName: "claim",
            args: [],
          },
        }),
        waitForTransactionReceipt: async () => {
          throw Error("HTTP connection was lost");
        },
        getTransactionReceipt: async () => ({ status: "success" }),
      },
    } as unknown as Runtime;
    const service = new ChainService(runtime, (value) => changes.push(value));
    service.verified = true;
    await assert.rejects(
      service.write("Claim", game.address, abi, "claim"),
      /connection was lost/,
    );
    assert.equal(service.uncertain, txHash);
    assert.equal(changes.at(-1)?.phase, "uncertain");
    await assert.rejects(
      service.write("Claim again", game.address, abi, "claim"),
      /pending transaction/,
    );
    await service.checkReceipt();
    assert.equal(service.uncertain, undefined);
    assert.equal(changes.at(-1)?.phase, "success");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
