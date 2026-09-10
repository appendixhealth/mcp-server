#!/usr/bin/env node
// Self-contained smoke test for the Appendix MCP server. Spins up a fake
// Go API on :4099 and the MCP server on :3099, exercises both transports,
// asserts X-Real-IP forwarding, and shuts everything down. Run with
// `npm run smoke` after `npm run build`.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const MCP_PORT = 3099;
const API_PORT = 4099;

const seen = [];
const fakeApi = createServer((req, res) => {
  seen.push({ url: req.url, xRealIp: req.headers["x-real-ip"] });
  if (req.url?.startsWith("/api/v1/config/conditions")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ name: "RESPIRATORY", conditions: [{ name: "Asthma" }] }]));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end("{}");
});
await new Promise((r) => fakeApi.listen(API_PORT, r));

const mcp = spawn(process.execPath, ["dist/index.js"], {
  env: { ...process.env, PORT: String(MCP_PORT), API_BASE_URL: `http://localhost:${API_PORT}` },
  stdio: ["ignore", "pipe", "pipe"],
});
mcp.stdout.on("data", (d) => process.stdout.write(`[mcp] ${d}`));
mcp.stderr.on("data", (d) => process.stderr.write(`[mcp:err] ${d}`));
await sleep(800);

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`✗ ${name} ${detail}`);
  }
}

async function jsonRpc(path, payload, headers = {}) {
  const res = await fetch(`http://localhost:${MCP_PORT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// 1. Health
{
  const r = await fetch(`http://localhost:${MCP_PORT}/health`);
  check("health 200", r.status === 200);
}

// 2. Streamable HTTP initialize
{
  const r = await jsonRpc("/mcp", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "smoke", version: "0" } },
  });
  check("streamable HTTP initialize 200", r.status === 200);
  check("initialize advertises Appendix server", r.body.includes('"name":"Appendix"'));
  check("initialize advertises instructions", r.body.includes('"instructions":'));
  check("instructions mention open-ended questions rule", r.body.includes("AskUserQuestion"));
}

// 3. Streamable HTTP tools/list
{
  const r = await jsonRpc("/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  check("tools/list 200", r.status === 200);
  for (const tool of ["search_knowledge_base", "submit_encounter", "list_conditions"]) {
    check(`  advertises ${tool}`, r.body.includes(`"name":"${tool}"`));
  }
}

// 4. tools/call list_conditions with X-Real-IP
{
  seen.length = 0;
  const r = await jsonRpc(
    "/mcp",
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_conditions", arguments: {} } },
    { "X-Real-IP": "198.51.100.42" },
  );
  check("tools/call 200", r.status === 200);
  check("downstream API received the call", seen.some((s) => s.url?.includes("/config/conditions")));
  check("X-Real-IP forwarded to downstream", seen.some((s) => s.xRealIp === "198.51.100.42"));
}

// 5. CORS preflight
{
  const r = await fetch(`http://localhost:${MCP_PORT}/mcp`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://claude.ai",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Mcp-Session-Id",
    },
  });
  check("CORS preflight 204", r.status === 204);
  check("ACAO=*", r.headers.get("access-control-allow-origin") === "*");
  check("exposes Mcp-Session-Id", r.headers.get("access-control-expose-headers")?.includes("Mcp-Session-Id"));
}

// 6. 404 for unknown path
{
  const r = await fetch(`http://localhost:${MCP_PORT}/nope`);
  check("unknown path 404", r.status === 404);
}

// 7. Body too large
{
  const big = "x".repeat(2_000_000);
  const r = await fetch(`http://localhost:${MCP_PORT}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ payload: big }),
  });
  check("oversize POST rejected", r.status >= 400);
}

mcp.kill("SIGTERM");
fakeApi.close();
await sleep(200);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
