// Dependency-free local browser harness. Serves synthetic configuration only.
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, extname, join, sep } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

export async function startBrowser({ youtubeFixture = false } = {}) {
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname === "/js/config.local.js") {
        response.writeHead(200, { "Content-Type": "text/javascript" });
        response.end(`export const LOCAL_CONFIG = ${JSON.stringify({
          RAWG_API_KEY: "browser-fixture", YOUTUBE_API_KEY: youtubeFixture ? "browser-fixture" : ""
        })};`);
        return;
      }
      const target = resolve(projectRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!target.startsWith(resolve(projectRoot) + sep) || pathname.split("/").some((part) => part.startsWith(".")) || !mime[extname(target)]) {
        response.writeHead(403); response.end(); return;
      }
      const content = await readFile(target);
      response.writeHead(200, { "Content-Type": `${mime[extname(target)]}; charset=utf-8`, "Cache-Control": "no-store" });
      response.end(content);
    } catch {
      response.writeHead(404); response.end();
    }
  });
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(join(tmpdir(), "gameverse-browser-test-"));
  const browser = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "about:blank"
  ], { windowsHide: true, stdio: "ignore" });
  let launchError;
  browser.once("error", (error) => { launchError = error; });
  let socket;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    socket?.close();
    browser.kill();
    await new Promise((resolveClose) => server.close(resolveClose));
    // Only the unique disposable browser profile created by this harness.
    if (resolve(profile).startsWith(resolve(tmpdir()) + sep + "gameverse-browser-test-")) {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
  try {
    let portData;
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (launchError) throw launchError;
      try { portData = await readFile(join(profile, "DevToolsActivePort"), "utf8"); break; } catch { await pause(100); }
    }
    if (!portData) throw new Error("Chrome did not expose its local debugging endpoint.");
    const [port, endpoint] = portData.trim().split(/\r?\n/);
    socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    });
    function command(method, params = {}, sessionId) {
      return new Promise((resolveCommand, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, { resolve: resolveCommand, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    async function newPage() {
      const { targetId } = await command("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
      const send = (method, params) => command(method, params, sessionId);
      await send("Page.enable");
      await send("Runtime.enable");
      async function evaluate(expression) {
        const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      }
      async function waitFor(expression, { timeout = 10000 } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          try { const value = await evaluate(expression); if (value) return value; } catch { /* Navigation may replace the execution context. */ }
          await pause(50);
        }
        throw new Error(`Browser condition timed out: ${expression}`);
      }
      return {
        send,
        evaluate,
        waitFor,
        async navigate(path) {
          const url = new URL(path, baseUrl).href;
          await send("Page.navigate", { url });
          await waitFor(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`);
        },
        async setViewport(width, height = 900) {
          await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
        },
        async close() { await command("Target.closeTarget", { targetId }); }
      };
    }
    return { baseUrl, page: await newPage(), newPage, close };
  } catch (error) {
    await close();
    throw error;
  }
}
