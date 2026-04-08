import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In Railway, dist/index.js is the entry point.
  // The static files are in dist/public.
  // We try several common paths to ensure we find the public directory.
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"), // Relative to dist/index.js
    path.resolve(process.cwd(), "dist", "public"), // Relative to project root
    path.resolve(process.cwd(), "public"),
  ];

  let distPath = "";
  for (const p of possiblePaths) {
    console.log(`[Static] Checking path: ${p}`);
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      console.log(`[Static] Found valid public directory at: ${distPath}`);
      break;
    }
  }

  if (!distPath) {
    distPath = possiblePaths[0];
    console.error(
      `[Static] ERROR: Could not find a valid build directory with index.html. Defaulting to: ${distPath}`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    // Avoid infinite loops for API calls that are not found
    if (req.originalUrl.startsWith("/api")) {
      return res.status(404).json({ error: "API route not found" });
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("404: Static index.html not found. Please check build logs.");
    }
  });
}
