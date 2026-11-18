import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import {
  defineConfig,
  loadEnv,
  type Plugin,
  type ViteDevServer,
} from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 200 * 1024; // 200KB per log file (reduce memory pressure)
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath)) return;
    const stats = fs.statSync(logPath);
    if (stats.size <= maxSize) return;

    // Read only the last TRIM_TARGET_BYTES bytes to avoid loading the whole file
    const start = Math.max(0, stats.size - TRIM_TARGET_BYTES);
    const stream = fs.createReadStream(logPath, { start, end: stats.size });
    let collected = "";
    stream.on("data", chunk => (collected += chunk.toString("utf-8")));
    stream.on("end", () => {
      // Ensure we start on a new line boundary
      const firstNewline = collected.indexOf("\n");
      const dataToKeep =
        firstNewline === -1 ? collected : collected.slice(firstNewline + 1);
      try {
        fs.writeFileSync(logPath, dataToKeep, "utf-8");
      } catch (e) {
        /* ignore write errors */
      }
    });
    stream.on("error", () => {});
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map(entry => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  vitePluginManusDebugCollector(),
];

export default defineConfig(({ mode, command }) => {
  const devEnv = loadEnv(mode, PROJECT_ROOT, "DEV_");
  const devHost = devEnv.DEV_HOST?.trim();
  const certPath = devEnv.DEV_HTTPS_CERT?.trim();
  const keyPath = devEnv.DEV_HTTPS_KEY?.trim();

  if (command === "serve" && Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error(
      "Local HTTPS requires both DEV_HTTPS_CERT and DEV_HTTPS_KEY."
    );
  }
  if (command === "serve" && (certPath || keyPath) && !devHost) {
    throw new Error("Local HTTPS requires DEV_HOST to restrict access to the LAN interface.");
  }

  const httpsOptions =
    command === "serve" && certPath && keyPath
      ? {
          cert: fs.readFileSync(path.resolve(PROJECT_ROOT, certPath)),
          key: fs.readFileSync(path.resolve(PROJECT_ROOT, keyPath)),
        }
      : undefined;

  return {
    plugins,
    base: "/", // ✅ Explicit base path for proper routing
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: false, // Disable in production for better performance
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "react-vendor";
            }
            if (id.includes("/node_modules/@tanstack/react-query/")) {
              return "query-vendor";
            }
            if (
              id.includes("/node_modules/@radix-ui/") ||
              id.includes("/node_modules/sonner/") ||
              id.includes("/node_modules/@floating-ui/")
            ) {
              return "ui-vendor";
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: devHost ? true : false,
      host: devHost || true,
      https: httpsOptions,
      open: true,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
        "/auth": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
        ...(devHost ? [devHost] : []),
        ".ngrok.io", // ✅ Allow ngrok domains
        ".ngrok-free.app", // ✅ Allow ngrok-free.app domains
        ".ngrok-free.dev", // ✅ Allow ngrok-free.dev domains
        "flyover-header-overprice.ngrok-free.dev", // ✅ Explicit ngrok host allow
      ],
      fs: {
        strict: false, // ✅ Relax for better compatibility
        deny: ["/etc/*"],
      },
      watch: {
        // Ignore heavy folders to prevent chokidar from watching large numbers of files
        ignored: ["**/uploads/**", "**/.manus-logs/**", "**/node_modules/**"],
      },
    },
  };
});
