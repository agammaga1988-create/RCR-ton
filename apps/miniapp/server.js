import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
const root = new URL(".", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8" };
createServer(async (_req, res) => {
  try {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "content-type": types[extname("index.html")], "x-content-type-options": "nosniff" });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Mini App unavailable");
  }
}).listen(Number(process.env.PORT || 4173), process.env.HOST || "127.0.0.1");
