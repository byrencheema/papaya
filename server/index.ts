import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { join } from "path";
import { readdir, unlink, copyFile, mkdir } from "fs/promises";
import { createInterface } from "readline";
import projectRoutes from "./routes/project.ts";
import assetsRoutes from "./routes/assets.ts";
import timelineRoutes from "./routes/timeline.ts";
import aiRoutes from "./routes/ai.ts";
import generateRoutes from "./routes/generate.ts";
import exportRoutes from "./routes/export.ts";
import * as store from "./services/project-store.ts";

const app = new Hono();
const ASSETS_DIR = join(import.meta.dir, "../assets");

app.use("*", cors());
app.use("*", async (c, next) => {
  await next();
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Embedder-Policy", "credentialless");
});

app.route("/", projectRoutes);
app.route("/", assetsRoutes);
app.route("/", timelineRoutes);
app.route("/", aiRoutes);
app.route("/", generateRoutes);
app.route("/", exportRoutes);

app.use("/assets/*", serveStatic({ root: "./" }));

async function clearAssets() {
  try {
    const files = await readdir(ASSETS_DIR);
    if (files.length === 0) return;
    await Promise.all(files.map((f) => unlink(join(ASSETS_DIR, f))));
    console.log(`\x1b[33m[cleanup]\x1b[0m Cleared ${files.length} file(s) from assets/`);
  } catch {}
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    console.log("\n\x1b[33m[cleanup]\x1b[0m Force quit.");
    process.exit(1);
  }
  shuttingDown = true;
  console.log("\n");

  const state = store.getState();
  const hasClips = state.tracks.some((t) => t.clips.length > 0);
  const isTTY = process.stdin.isTTY;

  if (hasClips && isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      const timeout = setTimeout(() => { rl.close(); resolve("n"); }, 10000);
      rl.question("\x1b[36mSave final export before quitting? (y/n): \x1b[0m", (ans) => {
        clearTimeout(timeout);
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });

    if (answer === "y" || answer === "yes") {
      const rl2 = createInterface({ input: process.stdin, output: process.stdout });
      const savePath = await new Promise<string>((resolve) => {
        const timeout = setTimeout(() => { rl2.close(); resolve(""); }, 10000);
        rl2.question(
          "\x1b[36mSave path (default: ~/Desktop/" + state.name + ".mp4): \x1b[0m",
          (ans) => { clearTimeout(timeout); rl2.close(); resolve(ans.trim()); },
        );
      });

      try {
        const exportFiles = (await readdir(ASSETS_DIR)).filter((f) => f.startsWith("export_"));
        if (exportFiles.length > 0) {
          const latest = exportFiles.sort().pop()!;
          const dest = savePath || join(process.env.HOME ?? "~", "Desktop", `${state.name}.mp4`);
          await mkdir(join(dest, ".."), { recursive: true }).catch(() => {});
          await copyFile(join(ASSETS_DIR, latest), dest);
          console.log(`\x1b[32m[saved]\x1b[0m Exported to ${dest}`);
        } else {
          console.log("\x1b[33m[cleanup]\x1b[0m No export found — run /api/export first next time.");
        }
      } catch {}
    }
  }

  await clearAssets();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
  port: 3111,
  fetch: app.fetch,
  idleTimeout: 255,
};
