// Optional regeneration of the committed PNG from the original SVG source.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const svg = await readFile(
    new URL("../public/cover.svg", import.meta.url),
    "utf8",
  );
  await page.setContent(
    `<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}</style>${svg}`,
  );
  await page.screenshot({
    path: fileURLToPath(new URL("../public/cover.png", import.meta.url)),
  });
  console.log("Rendered web/public/cover.png (1200 × 630)");
} finally {
  await browser.close();
}
