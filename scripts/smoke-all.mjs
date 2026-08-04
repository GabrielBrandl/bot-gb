import { writeFileSync } from "fs";

const API = "http://localhost:3000/api";

async function req(path, opts = {}, token) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === "object" && data?.message ? JSON.stringify(data.message) : text;
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return data;
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}\t${name}\t${detail}`);
}

try {
  const health = await req("/health");
  record("Health", health?.status === "ok", health?.service ?? "ok");

  const login = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@demo.gbsystems.com.br", password: "admin123" }),
  });
  const token = login.accessToken;
  record("Auth", !!token, `user=${login.user?.email ?? "?"}`);

  const reports = await req("/reports/overview", {}, token);
  record("Dashboard/Relatorios", !!reports, `keys=${Object.keys(reports).slice(0, 6).join(",")}`);

  const convs = await req("/conversations", {}, token);
  record("Inbox list", Array.isArray(convs), `n=${convs?.length ?? 0}`);

  const demo = await req(
    "/whatsapp/demo/inbound",
    {
      method: "POST",
      body: JSON.stringify({ phone: "5511999990001", name: "Smoke", text: "oi smoke" }),
    },
    token,
  );
  const convId = demo?.conversationId || demo?.conversation?.id || convs?.[0]?.id;
  record("Inbox demo inbound", !!convId, `conv=${convId ?? "missing"}`);

  if (convId) {
    try {
      const msg = await req(
        `/conversations/${convId}/messages`,
        { method: "POST", body: JSON.stringify({ content: "smoke reply", type: "text" }) },
        token,
      );
      record("Inbox send", !!msg?.id, `id=${msg.id}`);
    } catch (e) {
      record("Inbox send", false, e.message);
    }
  } else {
    record("Inbox send", false, "no conversation");
  }

  const kanban = await req("/kanban/board", {}, token).catch(() => req("/kanban/boards", {}, token));
  const stages = kanban?.stages ?? kanban?.[0]?.stages ?? [];
  record("Kanban", Array.isArray(stages) && stages.length > 0, `stages=${stages.length}`);

  const contacts = await req("/contacts", {}, token);
  record("Contatos", Array.isArray(contacts), `n=${contacts.length}`);

  const flows = await req("/flows", {}, token);
  record(
    "Automacoes list",
    Array.isArray(flows) && flows.every((f) => f.graph && "isActive" in f),
    `n=${flows.length}`,
  );

  if (flows[0]) {
    const one = await req(`/flows/${flows[0].id}`, {}, token);
    record("Automacoes editor API", !!one?.graph, `nodes=${one.graph?.nodes?.length ?? 0}`);
  } else {
    record("Automacoes editor API", false, "no flows");
  }

  const webHome = await fetch("http://localhost:5173/");
  record("Web up", webHome.status === 200, `status=${webHome.status}`);

  const webEditor = await fetch(`http://localhost:5173/automacoes/${flows[0]?.id ?? "x"}`);
  record("Automacoes editor SPA", webEditor.status === 200, `status=${webEditor.status}`);

  const agents = await req("/ai/agents", {}, token);
  record("Agente IA", Array.isArray(agents), `n=${agents?.length ?? 0}`);

  const campaigns = await req("/campaigns", {}, token);
  record("Campanhas", Array.isArray(campaigns), `n=${campaigns.length}`);

  const payments = await req("/payments", {}, token);
  record("Pagamentos", Array.isArray(payments), `n=${payments.length}`);

  const instances = await req("/whatsapp/instances", {}, token);
  record("WhatsApp instances", Array.isArray(instances), `n=${instances.length}`);

  const demoInst = instances.find((i) => String(i.evolutionInstanceId || "").startsWith("demo-"));
  if (demoInst) {
    const demoQr = await req(`/whatsapp/instances/${demoInst.id}/qr`, {}, token);
    record(
      "QR demo message PT",
      !!demoQr.message && !demoQr.base64,
      (demoQr.message || "").slice(0, 80),
    );
  } else {
    record("QR demo message PT", false, "no demo instance");
  }

  const real = instances.find((i) => !String(i.evolutionInstanceId || "").startsWith("demo-"));
  if (real) {
    try {
      const qr = await req(`/whatsapp/instances/${real.id}/qr`, {}, token);
      const hasImage = !!qr.base64;
      record(
        "Config QR WhatsApp",
        hasImage || !!qr.code || !!qr.pairingCode,
        hasImage ? `base64_len=${qr.base64.length}` : qr.message || qr.code || qr.pairingCode || "empty",
      );
    } catch (e) {
      record("Config QR WhatsApp", false, e.message);
    }
  } else {
    try {
      const created = await req(
        "/whatsapp/instances",
        { method: "POST", body: JSON.stringify({ name: `Smoke ${Date.now()}` }) },
        token,
      );
      await new Promise((r) => setTimeout(r, 1500));
      const qr = await req(`/whatsapp/instances/${created.id}/qr`, {}, token);
      record(
        "Config QR WhatsApp",
        !!(qr.base64 || qr.code || qr.pairingCode),
        qr.base64 ? `base64_len=${qr.base64.length}` : String(qr.message || "no-qr"),
      );
    } catch (e) {
      record("Config QR WhatsApp", false, e.message);
    }
  }

  try {
    const evo = await fetch("http://localhost:8080");
    record("Evolution API up", evo.status < 500, `status=${evo.status}`);
  } catch (e) {
    record("Evolution API up", false, e.message);
  }
} catch (e) {
  record("Fatal", false, e.message);
}

const lines = results.map((r) => `${r.name}\t${r.ok ? "PASS" : "FAIL"}\t${r.detail}`);
writeFileSync("C:/Users/Gabriel/Desktop/bot-wpp/smoke-results.txt", lines.join("\n") + "\n");
console.log("\nSummary:", results.filter((r) => r.ok).length, "/", results.length);
