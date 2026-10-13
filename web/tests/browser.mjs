import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import {
  decodeFunctionData,
  decodeAbiParameters,
  encodeFunctionResult,
  encodeAbiParameters,
  erc20Abi,
  parseAbi,
  zeroAddress,
} from "viem";
const root = fileURLToPath(new URL("../../", import.meta.url)),
  dist = resolve(root, "dist"),
  out = resolve(root, "docs/evidence");
await mkdir(out, { recursive: true });
const json = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
const config = await json("dist/imd-deployment.json"),
  platform = await json("web/reference/platform.json"),
  handoff = await json("web/reference/deployment.json");
const abi = await json("dist/abi/Game.json"),
  tokenAbi = await json("dist/abi/LaunchToken.json");
const game = config.contracts.find((c) => c.name === "Game").address,
  token = config.contracts.find((c) => c.name === "LaunchToken").address;
const wallet = platform.creator,
  uni = config.network.uniswapV4,
  unit = 10n ** 18n;
const hash = handoff.contracts[0].txHash,
  blockHash = "0x" + config.attestationHash;
const parameters = [
  { type: "uint8" },
  ...["battleOf", "commandOf", "rewardsOf"].map(
    (name) =>
      abi.find((f) => f.type === "function" && f.name === name).outputs[0],
  ),
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
];
const permitAbi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
const quoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
const now = () => Math.floor(Date.now() / 1000);
function fixture() {
  let b = {
    id: 0n,
    startedAt: 0n,
    deadline: 0n,
    epoch: 0n,
    status: 0,
    faction: 0,
    difficulty: 0,
    turn: 0,
    tech: 0,
    recruits: 0,
    tanks: 0,
    commandos: 0,
    harvests: 0,
    points: 0,
    ore: 0,
    baseHP: 0,
    enemyHP: 0,
    rewarded: false,
  };
  let tokens = 12n * unit,
    prizes = 3n * unit,
    mask = 0n,
    gameAllowance = 0n,
    prizeAllowance = 0n,
    permitToken = 0n,
    permitAmount = 0n,
    expiration = 0,
    epochs = new Map(),
    contrib = new Map();
  const log = [],
    requests = [];
  let failSimulation = false,
    rejectNext = false;
  const state = () =>
    encodeAbiParameters(parameters, [
      1,
      b,
      {
        day: BigInt(Math.floor(now() / 86400)),
        lastRewardAt: 0n,
        wins: 0,
        harvests: 0,
        rewardedBefore: false,
      },
      {
        epoch: BigInt(Math.floor(now() / 86400)),
        power: 21n,
        tokens: 0n,
        prizes: 0n,
      },
      mask,
      tokens,
      prizes,
    ]);
  function act(encoded) {
    const [cmd, id, turn, arg] = decodeAbiParameters(
      [
        { type: "uint8" },
        { type: "uint64" },
        { type: "uint8" },
        { type: "uint8" },
      ],
      encoded,
    );
    if (cmd === 0)
      b = {
        ...b,
        id,
        startedAt: BigInt(now() - 400),
        deadline: BigInt(now() + 800),
        epoch: BigInt(Math.floor(now() / 86400)),
        status: 1,
        faction: arg % 2,
        difficulty: Math.floor(arg / 2),
        turn: 0,
        tech: 0,
        recruits: 0,
        tanks: 0,
        commandos: 0,
        ore: 100,
        baseHP: 200,
        enemyHP: 120,
        rewarded: true,
      };
    else if (cmd === 8) {
      mask |= 1n << BigInt(arg);
      gameAllowance -= 100n * unit;
    } else if (cmd === 9) prizes = 0n;
    else {
      assert.equal(id, b.id);
      assert.equal(turn, b.turn);
      if (cmd === 1) {
        b.ore += 30;
        b.harvests++;
      }
      if (cmd === 2) {
        b.tech = arg;
        b.ore -= [0, 30, 40, 60, 80][arg];
      }
      if (cmd === 3) {
        b.recruits++;
        b.ore -= 25;
      }
      if (cmd === 4) b.enemyHP = Math.max(0, b.enemyHP - b.recruits * 8);
      if (cmd === 5) {
        b.points++;
        if (b.points >= 3) b.status = 2;
      }
      if (cmd === 7) b.status = 5;
      b.turn++;
    }
  }
  function identify(to) {
    return to.toLowerCase() === game
      ? abi
      : to.toLowerCase() === uni.permit2
        ? permitAbi
        : to.toLowerCase() === uni.quoter
          ? quoterAbi
          : to.toLowerCase() === uni.universalRouter
            ? routerAbi
            : tokenAbi;
  }
  function mutate(to, data) {
    const a = identify(to),
      decoded = decodeFunctionData({ abi: a, data }),
      { functionName: fn, args = [] } = decoded;
    log.push({ to, fn, args });
    if (fn === "act") act(args[0]);
    else if (fn === "claim") tokens = 0n;
    else if (fn === "claimPrize") prizes = 0n;
    else if (fn === "approve") {
      if (to.toLowerCase() === uni.permit2) {
        permitAmount = args[2];
        expiration = args[3];
      } else if (args[0].toLowerCase() === game) {
        if (to.toLowerCase() === config.network.pairToken.address)
          prizeAllowance = args[1];
        else gameAllowance = args[1];
      } else permitToken = args[1];
    } else if (fn === "fund") {
      epochs.set(String(args[0]), [args[1], args[2], 0n, 0n, 0n, 0n, 0n, 0n]);
      contrib.set(String(args[0]), [args[1], args[2]]);
    }
  }
  function rpc(req) {
    requests.push(req.method);
    const p = req.params || [];
    switch (req.method) {
      case "eth_chainId":
        return "0x1237";
      case "eth_getCode":
        return "0x6001600155";
      case "eth_blockNumber":
        return "0x100";
      case "eth_getBalance":
        return "0xde0b6b3a7640000";
      case "eth_gasPrice":
        return "0x1";
      case "eth_getBlockByNumber":
        return {
          number: "0x100",
          hash: blockHash,
          parentHash: blockHash,
          nonce: "0x0000000000000000",
          sha3Uncles: blockHash,
          logsBloom: "0x" + "0".repeat(512),
          transactionsRoot: blockHash,
          stateRoot: blockHash,
          receiptsRoot: blockHash,
          miner: wallet,
          difficulty: "0x0",
          totalDifficulty: "0x0",
          extraData: "0x",
          size: "0x100",
          gasLimit: "0x1c9c380",
          gasUsed: "0x100",
          timestamp: "0x" + now().toString(16),
          transactions: [],
          uncles: [],
          baseFeePerGas: "0x1",
          mixHash: blockHash,
        };
      case "eth_getTransactionReceipt":
        return {
          transactionHash: hash,
          transactionIndex: "0x0",
          blockHash,
          blockNumber: "0x100",
          from: wallet,
          to: game,
          cumulativeGasUsed: "0x5208",
          gasUsed: "0x5208",
          contractAddress: null,
          logs: [],
          logsBloom: "0x" + "0".repeat(512),
          status: "0x1",
          effectiveGasPrice: "0x1",
          type: "0x2",
        };
      case "eth_call": {
        const to = p[0].to.toLowerCase(),
          a = identify(to),
          { functionName: fn, args = [] } = decodeFunctionData({
            abi: a,
            data: p[0].data,
          });
        let result;
        if (
          [
            "act",
            "claim",
            "approve",
            "execute",
            "fund",
            "refund",
            "recycle",
            "accrue",
            "transferOwnership",
            "renounceOwnership",
            "recoverForcedEther",
          ].includes(fn) &&
          failSimulation
        )
          throw Error("Mock simulation failure: insufficient funds");
        switch (fn) {
          case "owner":
            result = wallet;
            break;
          case "pendingOwner":
            result = zeroAddress;
            break;
          case "launchToken":
            result = token;
            break;
          case "prizeToken":
            result = config.network.pairToken.address;
            break;
          case "decimals":
            result = 18;
            break;
          case "symbol":
            result = "PEPEFRONT";
            break;
          case "state":
            result = state();
            break;
          case "battleOf":
            result = b;
            break;
          case "claimable":
            result = tokens;
            break;
          case "prizeClaimable":
            result = prizes;
            break;
          case "balanceOf":
            result = 123456789012345678901234567890n;
            break;
          case "rewardAvailable":
            result = true;
            break;
          case "epochs":
            result = epochs.get(String(args[0])) || [
              1000n * unit,
              100n * unit,
              0n,
              0n,
              100n,
              0n,
              0n,
              0n,
            ];
            break;
          case "contributions":
            result = contrib.get(String(args[0])) || [0n, 0n];
            break;
          case "approve":
            if (to === uni.permit2) return '0x';
            result = true;
            break;
          case "allowance":
            result =
              to === uni.permit2
                ? [permitAmount, expiration, 0]
                : args[1]?.toLowerCase() === game
                  ? to === config.network.pairToken.address
                    ? prizeAllowance
                    : gameAllowance
                  : permitToken;
            break;
          case "quoteExactInputSingle":
            result = [args[0].exactAmount * 2n, 125000n];
            break;
          default:
            return "0x";
        }
        return encodeFunctionResult({ abi: a, functionName: fn, result });
      }
      default:
        throw Error("Unexpected mock RPC " + req.method);
    }
  }
  async function host(request) {
    requests.push("host:" + request.type);
    if (rejectNext && ["act", "claim", "approve"].includes(request.type)) {
      rejectNext = false;
      throw Error("User rejected the request");
    }
    switch (request.type) {
      case "account":
        return { address: wallet, chainId: config.chainId };
      case "state":
        return state();
      case "claimable":
        return String(tokens);
      case "balance":
        return String(1000n * unit);
      case "act":
        assert.equal(request.value, "0");
        act(request.action);
        log.push({ fn: "host:act", args: [request.action] });
        return hash;
      case "approve":
        assert.equal(request.amount, String(100n * unit));
        gameAllowance = BigInt(request.amount);
        log.push({ fn: "host:approve", args: [request.amount] });
        return hash;
      case "claim":
        tokens = 0n;
        log.push({ fn: "host:claim", args: [] });
        return hash;
      default:
        throw Error("Unsupported host request");
    }
  }
  return {
    rpc,
    host,
    mutate,
    log,
    requests,
    set failSimulation(v) {
      failSimulation = v;
    },
    set rejectNext(v) {
      rejectNext = v;
    },
  };
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
let origin;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, origin).pathname;
    if (path === "/host/") {
      const html = `<!doctype html><html><body style="margin:0;background:#0b1214"><iframe title="PEPEFRONT game" src="/preview/" sandbox="allow-scripts allow-pointer-lock" style="width:100%;height:100vh;border:0"></iframe><script>const frame=document.querySelector('iframe');window.hostMessages=[];window.hostReady=false;const channel=${JSON.stringify(config.launchId)};window.sendHost=(type)=>frame.contentWindow.postMessage({protocol:'pepe-game/1',type,channel},'*');frame.onload=()=>window.sendHost('init');window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow||e.data?.protocol!=='pepe-game/1'||e.data.channel!==channel)return;hostMessages.push(e.data);if(e.data.type==='ready')hostReady=true;if(e.data.type==='chain'){let result,error;try{result=await window.hostRequest(e.data.request);}catch(ex){error=ex.message;}frame.contentWindow.postMessage({protocol:'pepe-game/1',type:'chain-result',channel,id:e.data.id,result,error},'*');}});</script></body></html>`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }
    const relative =
        decodeURIComponent(path.replace(/^\/preview\//, "")) || "index.html",
      file = resolve(dist, relative);
    if (!file.startsWith(dist)) throw Error("bad");
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
let browser;
let debugPage;
async function check(name, run) {
  if (process.env.PEPEFRONT_TEST_GROUP === 'wallet' && /^(Static export|No-wallet|Keyboard practice|Touch practice)/.test(name)) return;
  const started = Date.now();
  try {
    await run();
    results.push({ name, passed: true, durationMs: Date.now() - started });
    console.log("PASS " + name);
  } catch (error) {
    results.push({
      name,
      passed: false,
      durationMs: Date.now() - started,
      error: error.stack,
    });
    console.error("FAIL " + name + " " + error.message);
    if (debugPage)
      console.error(
        (await debugPage.locator("body").innerText()).slice(0, 5000),
      );
    throw error;
  }
}
async function rpcMock(context, state) {
  await context.addInitScript(() => {
    // Exercise the public quick-drill mode using real browser timers.
    window.waitPracticeTime = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  });
  await context.route("https://**/*", async (route) => {
    if (
      !config.network.rpcUrls.some((url) =>
        route.request().url().startsWith(url),
      )
    ) {
      await route.abort();
      return;
    }
    const input = route.request().postDataJSON();
    const answer = (req) => {
      try {
        return { jsonrpc: "2.0", id: req.id, result: state.rpc(req) };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32000, message: e.message },
        };
      }
    };
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(
        Array.isArray(input) ? input.map(answer) : answer(input),
      ),
    });
  });
}
async function injected(context, state) {
  await context.exposeBinding("mockWrite", (_, tx) => {
    state.mutate(tx.to, tx.data);
    return hash;
  });
  await context.addInitScript(
    ({ wallet, chainId }) => {
      let accounts = [],
        chain = "0x1",
        added = false;
      const listeners = {};
      window.walletRequests = [];
      window.rejectWallet = false;
      window.ethereum = {
        on: (key, fn) => {
          (listeners[key] ??= []).push(fn);
        },
        removeListener: (key, fn) => {
          listeners[key] = (listeners[key] || []).filter((f) => f !== fn);
        },
        request: async ({ method, params }) => {
          window.walletRequests.push({ method, params });
          if (method === "eth_accounts") return accounts;
          if (method === "eth_requestAccounts") {
            if (window.rejectWallet) {
              window.rejectWallet = false;
              throw { code: 4001, message: "User rejected the request" };
            }
            accounts = [wallet];
            return accounts;
          }
          if (method === "eth_chainId") return chain;
          if (method === "wallet_switchEthereumChain") {
            if (!added) throw { code: 4902, message: "Unknown chain" };
            chain = "0x" + chainId.toString(16);
            for (const f of listeners.chainChanged || []) f(chain);
            return null;
          }
          if (method === "wallet_addEthereumChain") {
            added = true;
            return null;
          }
          if (method === "eth_sendTransaction") {
            if (window.rejectWallet) {
              window.rejectWallet = false;
              throw { code: 4001, message: "User rejected the request" };
            }
            return window.mockWrite(params[0]);
          }
          throw Error("Unexpected wallet method " + method);
        },
      };
      window.testDisconnect = () => {
        accounts = [];
        for (const f of listeners.accountsChanged || []) f([]);
      };
    },
    { wallet, chainId: config.chainId },
  );
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function confirm(page, name) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name, exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 20000 });
}
async function ready(page, label) {
  await page.waitForFunction(
    (label) =>
      [...document.querySelectorAll(".order-button")].some(
        (button) => button.textContent.includes(label) && !button.disabled,
      ),
    label,
    { timeout: 45000, polling: 100 },
  );
}
async function loaded(page) {
  debugPage = page;
  page.setDefaultTimeout(15000);
  await page.goto(origin + "/preview/");
  try {
    await page
      .locator(".status-dot.verified")
      .waitFor({ state: "attached", timeout: 60000 });
  } catch (e) {
    console.error((await page.locator("body").innerText()).slice(0, 1600));
    throw e;
  }
  await page.evaluate(() => document.fonts.ready);
}
try {
  browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  let context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    }),
    state = fixture();
  await rpcMock(context, state);
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await check(
    "Static export renders at gateway subpath, correct metadata and no overflow at 320/390/768/1440",
    async () => {
      await loaded(page);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          "overflow at " + width,
        );
        if (width === 390) {
          const b = await button(page, "Play practice").boundingBox();
          assert.ok(b.y + b.height <= 844, "main action below first screen");
          await page.screenshot({
            path: resolve(out, "mobile-390.png"),
            fullPage: true,
          });
        }
        if (width === 1440)
          await page.screenshot({
            path: resolve(out, "desktop-1440.png"),
            fullPage: true,
          });
      }
      for (const selector of [
        "title",
        'link[rel="icon"]',
        'meta[name="description"]',
        'meta[property="og:title"]',
        'meta[property="og:image"]',
      ])
        assert.equal(await page.locator(selector).count(), 1);
      assert.equal(errors.length, 0);
    },
  );
  await check(
    "No-wallet recovery and keyboard-accessible manual closes with Escape",
    async () => {
      await button(page, "Connect wallet").click();
      await page
        .getByRole("alert")
        .filter({ hasText: "No browser wallet" })
        .waitFor();
      await button(page, "How to play").click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        await button(page, "How to play").evaluate(
          (el) => el === document.activeElement,
        ),
        true,
      );
      await page.screenshot({ path: resolve(out, "keyboard-focus.png") });
    },
  );
  await check(
    "Keyboard practice: build, harvest, recruit, control groups, pause/resume, victory and replay",
    async () => {
      await page.getByLabel("Quick drill").check();
      await button(page, "Play practice").click();
      for (const [key, label, turn] of [
        ["b", "Build Power plant", 1],
        ["b", "Build Barracks", 2],
        ["g", "Harvest", 3],
        ["r", "Recruit Pepe", 4],
        ["r", "Recruit Pepe", 5],
        ["h", "Hold point", 6],
        ["h", "Hold point", 7],
      ]) {
        await page.evaluate(() => window.waitPracticeTime(1100));
        await ready(page, label);
        await page.locator("canvas").focus();
        await page.keyboard.press(key);
        await page.waitForFunction(
          (turn) =>
            document
              .querySelector(".resource-bar")
              ?.textContent.includes(`Turn ${turn}/48`),
          turn,
          { timeout: 10000 },
        );
      }
      assert.match(await page.locator(".resource-bar").textContent(), /2\/3/);
      await page.keyboard.press("q");
      await page.keyboard.press("Control+1");
      await page.keyboard.press("1");
      await page.getByText("4 Pepes selected", { exact: true }).waitFor();
      await page.keyboard.press("p");
      const before = await page.locator(".scene-hud").textContent();
      await page.evaluate(() => window.waitPracticeTime(2000));
      await page.waitForTimeout(200);
      assert.equal(await page.locator(".scene-hud").textContent(), before);
      await page
        .locator(".pause-overlay")
        .getByRole("button", { name: "Resume battle" })
        .click();
      await page.locator("canvas").focus();
      await page.evaluate(() => window.waitPracticeTime(30000));
      await ready(page, "Hold point");
      await page.keyboard.press("h");
      await page
        .getByRole("heading", { name: "Victory", exact: true })
        .waitFor();
      await page.screenshot({ path: resolve(out, "practice-victory.png") });
      await button(page, "Play again").click();
      assert.match(await page.locator(".resource-bar").textContent(), /0\/3/);
    },
  );
  await context.close();
  context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  state = fixture();
  await rpcMock(context, state);
  page = await context.newPage();
  await check(
    "Touch practice, select/move, camera, orders, surrender and all sections reflow at 320",
    async () => {
      await loaded(page);
      await page.getByLabel("Quick drill").check();
      await button(page, "Play practice").tap();
      await page.evaluate(() => window.waitPracticeTime(1500));
      await button(page, "Select all").tap();
      await button(page, "Tap to select").tap();
      await page.locator("canvas").tap({ position: { x: 200, y: 160 } });
      await page.getByRole("button", { name: /Build Power plant/ }).tap();
      assert.match(await page.locator(".resource-bar").textContent(), /70/);
      await button(page, "Zoom in").tap();
      await button(page, "Minimap: jump to your base").tap();
      await button(page, "Surrender").tap();
      await confirm(page, "Surrender practice battle");
      await page
        .getByRole("heading", { name: "Surrendered", exact: true })
        .waitFor();
      await page.setViewportSize({ width: 320, height: 844 });
      for (const tab of ["Rewards", "Exchange", "Operations"]) {
        await button(page, tab).tap();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          "overflow " + tab,
        );
      }
      await page.screenshot({
        path: resolve(out, "mobile-operations-320.png"),
        fullPage: true,
      });
    },
  );
  await context.close();
  context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  state = fixture();
  await rpcMock(context, state);
  await injected(context, state);
  page = await context.newPage();
  await check(
    "Wallet rejection, unknown-chain add/switch, live state and exact approved chain parameters",
    async () => {
      await loaded(page);
      await page.evaluate(() => (window.rejectWallet = true));
      await button(page, "Connect wallet").click();
      await page.getByRole("alert").filter({ hasText: "rejected" }).waitFor();
      await button(page, "Connect wallet").click();
      await button(page, "Switch to Robinhood Chain").click();
      await page.getByText(/Live state read at block/).waitFor();
      const reqs = await page.evaluate(() => window.walletRequests);
      assert.deepEqual(
        reqs.find((r) => r.method === "wallet_addEthereumChain").params[0],
        config.walletAddChain,
      );
      assert.equal(
        reqs.filter((r) => r.method === "wallet_switchEthereumChain").length,
        2,
      );
    },
  );
  await check(
    "Standalone wallet battle encodes start and fresh-turn orders; receipt updates state",
    async () => {
      await button(page, "Wallet battle").click();
      await button(page, "Deploy wallet battle").click();
      await confirm(page, "Deploy wallet battle");
      await page.getByRole("button", { name: /Build Power plant/ }).click();
      await confirm(page, "Confirm strategic order");
      assert.equal(state.log.filter((x) => x.fn === "act").length, 2);
      const call = state.log.filter((x) => x.fn === "act")[1];
      const words = decodeAbiParameters(
        [
          { type: "uint8" },
          { type: "uint64" },
          { type: "uint8" },
          { type: "uint8" },
        ],
        call.args[0],
      );
      assert.deepEqual(words, [2, 1n, 0, 1]);
      assert.match(await page.locator(".resource-bar").textContent(), /70/);
    },
  );
  await check(
    "Claim rejection leaves entitlement retryable; token/IMD claims and cosmetic approval/purchase succeed",
    async () => {
      await button(page, "Rewards").click();
      await page.evaluate(() => (window.rejectWallet = true));
      await button(page, "Claim PEPEFRONT").click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Claim PEPEFRONT", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("alert").waitFor();
      await button(page, "Cancel").click();
      await button(page, "Claim PEPEFRONT").click();
      await confirm(page, "Claim PEPEFRONT");
      await button(page, "Claim PEPEFRONT").waitFor();
      assert.equal(await button(page, "Claim PEPEFRONT").isDisabled(), true);
      await button(page, "Claim IMD").click();
      await confirm(page, "Claim IMD");
      await button(page, "Approve 100 PEPEFRONT").click();
      await confirm(page, "Approve cosmetic purchase");
      await button(page, "Buy cosmetic").click();
      await confirm(page, "Buy cosmetic");
      assert.equal(await button(page, "Already owned").isDisabled(), true);
      const approve = state.log.find(
        (x) => x.fn === "approve" && x.args[0].toLowerCase() === game,
      );
      assert.equal(approve.args[1], 100n * unit);
      await page.screenshot({
        path: resolve(out, "wallet-rewards.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Swap quote, exact ERC20 approval, Permit2 approval, extended router payload and zero ETH",
    async () => {
      await button(page, "Exchange").click();
      await page.getByLabel("Pay in IMD").fill("1");
      await button(page, "Get quote").click();
      await button(page, "1. Approve IMD").click();
      await confirm(page, "Approve IMD");
      await button(page, "2. Approve router").click();
      await confirm(page, "Approve router spending");
      await button(page, "3. Review swap").click();
      await confirm(page, "Review swap");
      const execute = state.log.find((x) => x.fn === "execute");
      assert.ok(execute);
      assert.equal(execute.to.toLowerCase(), uni.universalRouter);
      assert.equal(execute.args[0], "0x10");
      const requests = await page.evaluate(() => window.walletRequests);
      const tx = requests
        .filter((x) => x.method === "eth_sendTransaction")
        .at(-1).params[0];
      assert.ok(!tx.value || BigInt(tx.value) === 0n);
    },
  );
  await check(
    "Simulation failure never requests a signature and funding controls use explicit allowances",
    async () => {
      await button(page, "Operations").click();
      await page.getByLabel("PEPEFRONT deposit", { exact: true }).fill("2");
      await page.getByLabel("IMD deposit", { exact: true }).fill("1");
      await button(page, "Inspect day & allowances").click();
      await button(page, "Approve PEPEFRONT").click();
      await confirm(page, "Approve PEPEFRONT deposit");
      await button(page, "Approve IMD").click();
      await confirm(page, "Approve IMD deposit");
      const before = state.log.length;
      state.failSimulation = true;
      await button(page, "Review funding").click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Fund reward day", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.equal(state.log.length, before);
      await button(page, "Cancel").click();
      state.failSimulation = false;
      await button(page, "Review funding").click();
      await confirm(page, "Fund reward day");
      assert.ok(state.log.find((x) => x.fn === "fund"));
      await page.setViewportSize({ width: 320, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.evaluate(() => window.testDisconnect());
      await page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .waitFor();
    },
  );
  await context.close();
  context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1100, height: 900 },
  });
  state = fixture();
  await rpcMock(context, state);
  await context.exposeBinding("hostRequest", (_, request) =>
    state.host(request),
  );
  page = await context.newPage();
  await check(
    "Opaque sandbox iframe handshake, host wallet state, pause/resume, actions and claims",
    async () => {
      await page.goto(origin + "/host/");
      await page.waitForFunction(() => window.hostReady, undefined, {timeout:25000});
      const frame = page.frameLocator("iframe");
      await frame
        .getByText(/Live state read at block/)
        .waitFor({ timeout: 25000 });
      await button(frame, "Wallet battle").click();
      await button(frame, "Deploy wallet battle").click();
      await confirm(frame, "Deploy wallet battle");
      await page.evaluate(() => window.sendHost("pause"));
      await frame.getByRole("heading", { name: "Battle paused" }).waitFor();
      await page.evaluate(() => window.sendHost("resume"));
      await frame
        .getByRole("heading", { name: "Battle paused" })
        .waitFor({ state: "hidden" });
      await frame
        .getByRole("button", { name: /Harvest/ })
        .first()
        .click();
      await confirm(frame, "Confirm strategic order");
      await button(frame, "Rewards").click();
      state.rejectNext = true;
      await button(frame, "Claim PEPEFRONT").click();
      await frame
        .getByRole("dialog")
        .getByRole("button", { name: "Claim PEPEFRONT", exact: true })
        .click();
      await frame.getByRole("dialog").getByRole("alert").waitFor();
      await button(frame, "Cancel").click();
      await button(frame, "Claim PEPEFRONT").click();
      await confirm(frame, "Claim PEPEFRONT");
      await button(frame, "Claim IMD").click();
      await confirm(frame, "Claim IMD");
      await button(frame, "Approve 100 PEPEFRONT").click();
      await confirm(frame, "Approve cosmetic purchase");
      await button(frame, "Buy cosmetic").click();
      await confirm(frame, "Buy cosmetic");
      assert.ok(state.log.find((x) => x.fn === "host:claim"));
      assert.ok(state.log.find((x) => x.fn === "host:approve"));
      const messages = await page.evaluate(() => window.hostMessages);
      assert.ok(
        messages
          .filter((m) => m.type === "chain")
          .every((m) => m.channel === config.launchId),
      );
      await page.screenshot({
        path: resolve(out, "iframe-host-flow.png"),
        fullPage: true,
      });
    },
  );
  await context.close();
  await check(
    "Reduced motion remains playable and cover reads at 240px",
    async () => {
      context = await browser.newContext({
        reducedMotion: "reduce",
        viewport: { width: 390, height: 844 },
      });
      await rpcMock(context, fixture());
      page = await context.newPage();
      await loaded(page);
      await button(page, "Play practice").click();
      assert.equal(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
        true,
      );
      await page.goto(origin + "/preview/cover.svg");
      await page.setViewportSize({ width: 240, height: 126 });
      await page.screenshot({ path: resolve(out, "cover-thumbnail.png") });
      await context.close();
    },
  );
  await check(
    "Tampered implementation ABI blocks wallet actions while local play remains available",
    async () => {
      context = await browser.newContext({
        reducedMotion: "reduce",
        viewport: { width: 390, height: 844 },
      });
      await rpcMock(context, fixture());
      await context.route("**/abi/Game.json", (route) =>
        route.fulfill({ contentType: "application/json", body: "[]" }),
      );
      page = await context.newPage();
      await page.goto(origin + "/preview/");
      await page
        .getByRole("alert")
        .filter({ hasText: "ABI verification failed" })
        .waitFor();
      assert.equal(await page.locator(".status-dot.verified").count(), 0);
      await button(page, "Play practice").click();
      await page.locator(".resource-bar").waitFor();
      await context.close();
    },
  );
  await browser.close();
  browser = undefined;
  try {
    browser = await webkit.launch({ timeout: 20000 });
    context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    await rpcMock(context, fixture());
    page = await context.newPage();
    await check(
      "WebKit mobile primary gameplay, pause and touch order",
      async () => {
        await loaded(page);
        await page.getByLabel("Quick drill").check();
        await button(page, "Play practice").tap();
        await page.evaluate(() => window.waitPracticeTime(1500));
        await page.getByRole("button", { name: /Build Power plant/ }).tap();
        assert.match(await page.locator(".resource-bar").textContent(), /70/);
        await button(page, "Pause battle").tap();
        await frameWait(page);
        await page
          .locator(".pause-overlay")
          .getByRole("button", { name: "Resume battle" })
          .tap();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.screenshot({
          path: resolve(out, "webkit-mobile.png"),
          fullPage: true,
        });
      },
    );
    await context.close();
  } catch (error) {
    results.push({
      name: "WebKit runtime",
      passed: false,
      error: error.message,
    });
    console.error("WebKit runtime " + error.message);
  }
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((ok) => server.close(ok));
  await writeFile(
    resolve(out, "browser-results.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        fixtures:
          "All wallets and transaction/RPC results in interaction checks are mocked; no live writes.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
async function frameWait(page) {
  await page.getByRole("heading", { name: "Battle paused" }).waitFor();
}
