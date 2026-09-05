import { startBrowser } from "./browser-runner.mjs";

const browser = await startBrowser();
try {
  for (const width of [1200, 768, 390]) {
    const page = await browser.newPage();
    await page.setViewport(width, 844);
    await page.navigate("/tests/community-composer.html");
    const result = await page.waitFor("window.__testResult", { timeout: 15000 });
    console.log(JSON.stringify({ width, ...result }));
    if (result.failed) process.exitCode = 1;
    await page.close();
  }
} finally {
  await browser.close();
}
