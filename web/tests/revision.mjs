import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OrthographicCamera, Vector3 } from "three";

// Uses the original suite's wallet/RPC fixture; every write remains mocked.
export async function revisionChecks(h) {
  const { browser, fixture, rpcMock, injected, loaded, ready, button, confirm, check, config, token, uni, out, origin } = h;
  const evidence = { checkedAt: new Date().toISOString(), mockedWritesOnly: true };
  async function move(page, x, z) {
    const bounds = await page.locator("canvas").boundingBox();
    const aspect = bounds.width / bounds.height;
    const camera = new OrthographicCamera(-25 * aspect, 25 * aspect, 25, -25, 0.1, 180);
    camera.position.set(26, 35, 33);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const p = new Vector3(x, 0, z).project(camera);
    await page.locator("canvas").click({ button: "right", position: { x: (p.x + 1) * bounds.width / 2, y: (1 - p.y) * bounds.height / 2 } });
  }
  async function setup(width = 1440, wallet = false) {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width, height: width < 500 ? 844 : 1000 } });
    // Observe the real scene through Three.js's existing devtools event API.
    // No production test hooks, injected game state or substituted renderer.
    await context.addInitScript(() => {
      window.__THREE_DEVTOOLS__ = new EventTarget();
      window.friendlySnapshot = () => (window.observedScene?.children || [])
        .filter(g => g.isGroup && g.children.some(c => c.geometry?.type === "RingGeometry" && c.material?.color?.getHex() === 0x58e3d6))
        .map(g => ({ id: g.uuid, x: g.position.x, z: g.position.z,
          selected: g.children.find(c => c.geometry?.type === "RingGeometry").visible }));
      window.pathingSamples = [];
      window.__THREE_DEVTOOLS__.addEventListener("observe", event => {
        const object = event.detail;
        if (object.isScene) window.observedScene = object;
        if (object.isWebGLRenderer) {
          const render = object.render;
          object.render = function (...args) {
            const result = render.apply(this, args);
            if (window.collectPath && window.pathingSamples.length < 1000) {
              window.pathingSamples.push(window.friendlySnapshot());
              window.lastObservedRender = performance.now();
            }
            return result;
          };
        }
      });
    });
    const state = fixture();
    await rpcMock(context, state);
    if (wallet) await injected(context, state);
    const page = await context.newPage();
    return { context, state, page };
  }
  async function connect(page) {
    await loaded(page);
    await button(page, "Connect wallet").click();
    await button(page, "Switch to Robinhood Chain").click();
    await page.getByText(/Live state read at block/).waitFor();
  }
  async function resultBounds(page) {
    // Scroll only the document: scrollIntoView can mask overflow by scrolling
    // an overflow:hidden ancestor and clipping the other end of the result card.
    await page.locator(".scene-wrap").evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 48));
    const result = await page.locator(".scene-wrap").evaluate(el => {
      const scene = el.getBoundingClientRect();
      const card = el.querySelector(".results-overlay > div").getBoundingClientRect();
      return {
        width: innerWidth, sceneHeight: scene.height, cardHeight: card.height,
        cardInside: card.top >= scene.top && card.bottom <= scene.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
        actions: [...el.querySelectorAll(".results-overlay button")].map(button => {
          const b = button.getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return { label: button.textContent, height: b.height, inside: b.top >= scene.top && b.bottom <= scene.bottom,
            hittable: hit === button || button.contains(hit) };
        }),
      };
    });
    assert.equal(result.overflow, false);
    assert.equal(result.cardInside, true);
    assert.equal(result.actions.length, 2);
    for (const action of result.actions) {
      assert.ok(action.inside && action.hittable, `${action.label} must be fully visible and operable`);
      assert.ok(action.height >= 44);
    }
    return result;
  }

  try {
    await check("Revision: wallet victory and surrender keep both result actions visible at 320 and 390", async () => {
      const { context, page } = await setup(320, true);
      try {
        await connect(page);
        await button(page, "Wallet battle").click();
        await button(page, "Deploy wallet battle").click();
        await confirm(page, "Deploy wallet battle");
        for (const label of ["Build Power plant", "Build Barracks", "Harvest", "Recruit Pepe", "Recruit Pepe", "Hold point", "Hold point", "Hold point"]) {
          await ready(page, label);
          await page.getByRole("button", { name: new RegExp(label) }).first().click();
          await confirm(page, "Confirm strategic order");
        }
        await page.getByRole("heading", { name: "Victory", exact: true }).waitFor();
        await page.getByText("Command power recorded. Rewards mature after the UTC day closes.").waitFor();
        evidence.victory = [];
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 844 });
          evidence.victory.push(await resultBounds(page));
          if (width === 320) await page.locator(".scene-wrap").screenshot({ path: resolve(out, "revision-wallet-victory-320.png") });
        }
        await button(page, "View rewards").click();
        await page.getByRole("heading", { name: "Command earns its share." }).waitFor();
        await button(page, "Battlefield").click();
        await button(page, "Play again").click();
        await confirm(page, "Deploy wallet battle");
        await button(page, "Surrender").click();
        await confirm(page, "Surrender battle");
        await page.getByRole("heading", { name: "Surrendered", exact: true }).waitFor();
        await page.setViewportSize({ width: 320, height: 844 });
        evidence.surrender = await resultBounds(page);
        await button(page, "View rewards").click();
        await page.getByRole("heading", { name: "Command earns its share." }).waitFor();
      } finally { await context.close(); }
    });

    await check("Revision: Retry checks recovers a transient manifest or ABI failure", async () => {
      evidence.retry = [];
      for (const asset of ["imd-deployment.json", "abi/Game.json"]) {
        const { context, page } = await setup(390);
        try {
          let requests = 0;
          await context.route(`**/${asset}`, route => ++requests === 1
            ? route.fulfill({ status: 503, body: "Temporary test failure" }) : route.continue());
          await page.goto(origin + "/preview/");
          await page.getByRole("alert").filter({ hasText: /Deployment configuration could not load|Cannot load Game ABI/ }).waitFor();
          await button(page, "Retry checks").click();
          await page.locator(".status-dot.verified").waitFor({ state: "attached" });
          assert.equal(requests, 2);
          assert.equal(await page.getByRole("alert").count(), 0);
          evidence.retry.push({ asset, requests, verified: true });
        } finally { await context.close(); }
      }
    });

    await check("Revision: recruiting preserves number groups and active orders until a new battle", async () => {
      const { context, page } = await setup();
      try {
        await loaded(page);
        await page.getByLabel("Quick drill").check();
        await button(page, "Play practice").click();
        for (const label of ["Build Power plant", "Build Barracks", "Harvest", "Recruit Pepe"]) {
          await ready(page, label);
          await page.getByRole("button", { name: new RegExp(label) }).first().click();
        }
        await page.locator("canvas").focus();
        await page.keyboard.press("q"); await page.keyboard.press("Control+1");
        await page.keyboard.press("1");
        await page.getByText("3 Pepes selected", { exact: true }).waitFor();
        await ready(page, "Recruit Pepe");
        await move(page, -6, 10);
        await page.keyboard.down("Shift");
        await move(page, -3, 12);
        await page.keyboard.up("Shift");
        await ready(page, "Recruit Pepe");
        const before = await page.evaluate(() => ({ units: window.friendlySnapshot(), at: performance.now() }));
        await page.getByRole("button", { name: /Recruit Pepe/ }).first().click();
        await page.waitForFunction(() => document.querySelector(".resource-bar")?.textContent.includes("Turn 5/48"));
        await page.waitForTimeout(150); // Allow one render/reconciliation frame.
        await page.locator("canvas").focus(); await page.keyboard.press("1");
        await page.getByText("3 Pepes selected", { exact: true }).waitFor();
        const after = await page.evaluate(() => ({ units: window.friendlySnapshot(), at: performance.now() }));
        assert.equal(before.units.length, 3);
        for (const unit of before.units) {
          const same = after.units.find(u => u.id === unit.id);
          assert.ok(same?.selected, "existing mesh identity and selection must survive recruitment");
          assert.ok(Math.hypot(same.x - unit.x, same.z - unit.z) <= (after.at - before.at) / 1000 * 4 + 0.2, "recruitment must not teleport an existing unit");
        }
        try {
          await page.waitForFunction(ids => ids.every((id, i) => {
            const u = window.friendlySnapshot().find(unit => unit.id === id);
            return u && Math.hypot(u.x - (-3 + i * 1.8), u.z - 12) < 0.12;
          }), before.units.map(u => u.id), { timeout: 30000 });
        } catch (error) {
          console.error("Queued movement observations", { before, after, final: await page.evaluate(() => window.friendlySnapshot()) });
          throw error;
        }
        await button(page, "Select all").click();
        await page.getByText("4 Pepes selected", { exact: true }).waitFor();
        evidence.recruitment = { savedGroupAfterRecruit: 3, totalAfterRecruit: 4,
          originalMeshIdentitiesPreserved: true, noTeleport: true, queuedDestinationReached: true };
        await button(page, "Surrender").click(); await confirm(page, "Surrender practice battle");
        await button(page, "Play again").click();
        await page.waitForTimeout(150);
        await page.locator("canvas").focus(); await page.keyboard.press("1");
        await page.getByText("No Pepes selected", { exact: true }).waitFor();
        evidence.recruitment.groupClearedOnNewBattle = true;
      } finally { await context.close(); }
    });

    await check("Revision: base destinations stay outside scenery and briefings retain static texture", async () => {
      const { context, page } = await setup();
      try {
        await loaded(page);
        await page.locator(".command-panel").screenshot({ path: resolve(out, "revision-briefing-desktop.png") });
        evidence.portrait = await page.locator(".pepe-portrait").first().evaluate(el => ({
          grain: !!el.querySelector("feTurbulence"), scanlines: !!el.querySelector("pattern"),
          stencil: getComputedStyle(document.querySelector("h1")).maskImage,
        }));
        assert.ok(evidence.portrait.grain && evidence.portrait.scanlines);
        assert.notEqual(evidence.portrait.stencil, "none");
        await button(page, "Play practice").click();
        await button(page, "Select all").click();
        await page.getByText("2 Pepes selected", { exact: true }).waitFor();
        await button(page, "Reset camera").click();
        const solids = await page.evaluate(() => {
          const scene = window.observedScene;
          scene.updateMatrixWorld(true);
          return scene.children.filter(o =>
            (o.isGroup && ((o.position.x === -15 && o.position.z === 7) || (o.position.x === 15 && o.position.z === -9))) ||
            (o.isMesh && (o.geometry.type === "IcosahedronGeometry" || o.geometry.parameters.height === 0.65)))
            .map(o => {
              let bounds;
              o.traverse(m => {
                if (!m.isMesh) return;
                m.geometry.computeBoundingBox();
                const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
                if (!bounds) bounds = b; else bounds.union(b);
              });
              return { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
            });
        });
        await page.evaluate(() => { window.collectPath = true; window.pathingSamples = []; });
        await page.locator("canvas").click({ button: "right", position: { x: 359.86, y: 225.78 } });
        await page.mouse.move(1400, 950);
        // Reduced-motion scenes stop drawing when their movement queue completes.
        // Wait for that observable state instead of assuming wall time == frames
        // on the worker's software GPU. Complete cross-base paths are also tested
        // independently, at every segment, in pathing.test.ts.
        try {
          await page.waitForFunction(() => window.pathingSamples.length > 10 &&
            performance.now() - window.lastObservedRender > 1000, undefined, { timeout: 90000 });
        } catch (error) {
          console.error("Headquarters movement observations", JSON.stringify(await page.evaluate(() => ({ units: window.friendlySnapshot(), frames: window.pathingSamples.length }))));
          throw error;
        }
        await page.locator("canvas").screenshot({ path: resolve(out, "revision-pathing-base.png") });
        const samples = await page.evaluate(() => { window.collectPath = false; return window.pathingSamples; });
        assert.ok(samples.length > 10);
        assert.ok(solids.length >= 22, "both bases and all rocks must be measured");
        for (const units of samples) for (const u of units) for (const r of solids)
          assert.ok(!(u.x > r.minX - 1.39 && u.x < r.maxX + 1.39 && u.z > r.minZ - 1.39 && u.z < r.maxZ + 1.39), "rendered movement entered a solid footprint");
        for (const u of samples.at(-1)) {
          const start = samples[0].find(v => v.id === u.id);
          assert.ok(Math.hypot(u.x - start.x, u.z - start.z) > 1, "both selected units must move");
          const base = solids[20];
          const dx = Math.max(base.minX - u.x, 0, u.x - base.maxX);
          const dz = Math.max(base.minZ - u.z, 0, u.z - base.maxZ);
          assert.ok(Math.hypot(dx, dz) < 1.43, "headquarters orders finish at the inflated perimeter");
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator(".commander").screenshot({ path: resolve(out, "revision-commander-mobile.png") });
        evidence.pathing = { observedFrames: samples.length, solidsMeasured: solids.length,
          bodyClearance: 1.39, collisions: 0, headquartersOrderCompleted: true,
          method: "Read-only Three.js devtools scene observation; sampled rendered positions against actual mesh bounds. Independent route tests also sample every segment." };
        await page.emulateMedia({ contrast: "more" });
        assert.equal(await page.locator("h1").evaluate(el => getComputedStyle(el).maskImage), "none");
      } finally { await context.close(); }
    });

    await check("Revision: stale quotes cannot outlive form, account, chain or page changes", async () => {
      const { context, state, page } = await setup(1440, true);
      let release;
      try {
        await connect(page); await button(page, "Exchange").click();
        let heldRequest;
        await context.route("https://**/*", async route => {
          const req = route.request().postDataJSON();
          if (heldRequest && req?.method === "eth_call" && req.params?.[0]?.to?.toLowerCase() === uni.quoter) {
            const held = heldRequest; heldRequest = undefined;
            held.enter(); await held.wait;
          }
          await route.fallback();
        });
        async function pendingQuote() {
          let enter;
          const seen = new Promise(ok => { enter = ok; });
          const wait = new Promise(ok => { release = ok; });
          heldRequest = { enter, wait };
          await button(page, "Get quote").click();
          await Promise.race([seen, new Promise((_, reject) => setTimeout(() => reject(Error("Quoter request did not start")), 10000))]);
        }
        async function discard() {
          release();
          // Wait for the stale response's allowance reads and state continuation.
          await page.waitForTimeout(400);
          assert.equal(await page.locator(".quote-result").count(), 0);
          assert.equal(await page.locator(".trade-form .primary").textContent(), "Get quote");
        }
        evidence.quoteRaces = [];
        await page.getByLabel("Pay in IMD").fill("1");
        await pendingQuote();
        await button(page, "Sell PEPEFRONT").click();
        await page.getByLabel("Pay in PEPEFRONT").fill("100");
        await discard();
        evidence.quoteRaces.push("buy-to-sell response discarded");
        await button(page, "Get quote").click();
        await button(page, "1. Approve PEPEFRONT").click();
        assert.match(await page.getByRole("dialog").innerText(), /exactly 100 PEPEFRONT/);
        await confirm(page, "Approve PEPEFRONT");
        const approval = state.log.find(x => x.fn === "approve");
        assert.equal(approval.to.toLowerCase(), token);
        assert.equal(approval.args[0].toLowerCase(), uni.permit2);
        assert.equal(approval.args[1], 100n * 10n ** 18n);
        evidence.correctApproval = { token: approval.to, amount: String(approval.args[1]) };

        await button(page, "Buy PEPEFRONT").click(); await page.getByLabel("Pay in IMD").fill("1");
        await pendingQuote();
        await page.getByLabel("Pay in IMD").fill("2");
        await button(page, "Get quote").click();
        await page.locator(".quote-result").waitFor();
        assert.match(await page.locator(".quote-result").textContent(), /4 PEPEFRONT/);
        release(); await page.waitForTimeout(400);
        assert.match(await page.locator(".quote-result").textContent(), /4 PEPEFRONT/);
        evidence.quoteRaces.push("older response cannot overwrite a newer quote");

        for (const kind of ["slippage", "same-key", "account", "chain", "unmount"]) {
          await page.getByLabel("Pay in IMD").fill("3");
          await page.getByLabel("Pay in IMD").fill("1");
          await pendingQuote();
          if (kind === "slippage") await page.getByLabel("Maximum slippage (%)").fill("1");
          if (kind === "same-key") {
            await page.getByLabel("Pay in IMD").fill("2");
            await page.getByLabel("Pay in IMD").fill("1");
          }
          if (kind === "account") {
            await page.evaluate(() => window.testDisconnect());
            await button(page, "Connect wallet").waitFor();
          }
          if (kind === "chain") {
            await page.evaluate(() => window.testChain("0x1"));
            await button(page, "Switch to Robinhood Chain").waitFor();
          }
          if (kind === "unmount") {
            await button(page, "Rewards").click();
            await button(page, "Exchange").click();
          }
          await discard();
          evidence.quoteRaces.push(`${kind} invalidates pending quote`);
          if (kind === "account") {
            await button(page, "Connect wallet").click();
            await page.getByText(/Live state read at block/).waitFor();
          }
          if (kind === "chain") {
            await button(page, "Switch to Robinhood Chain").click();
            await page.getByText(/Live state read at block/).waitFor();
          }
        }
        assert.equal(state.log.filter(x => x.fn === "approve").length, 1);
        assert.equal(state.log.filter(x => x.fn === "execute").length, 0);
      } finally { release?.(); await context.close(); }
    });
  } finally {
    await writeFile(resolve(out, "revision-results.json"), JSON.stringify(evidence, null, 2) + "\n");
  }
}
