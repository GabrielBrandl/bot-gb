/**
 * Smoke E2E against running API (http://localhost:3000/api).
 * Run: npx tsx scripts/smoke-e2e.ts
 */
const API = process.env.API_URL ?? "http://localhost:3000/api";

type Json = Record<string, unknown>;

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function req(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    const msg = detail ? `${name} — ${detail}` : name;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

async function login(email: string, password: string) {
  const { status, body } = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert(`login ${email}`, status === 200 || status === 201, `status=${status}`);
  const data = body as Json;
  return {
    token: String(data.accessToken ?? ""),
    user: data.user as Json,
  };
}

async function main() {
  console.log(`\nSmoke E2E → ${API}\n`);

  // Health
  {
    const { status, body } = await req("/health");
    assert("health", status === 200 && (body as Json).status === "ok");
  }

  // Bad login
  {
    const { status } = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nope@x.com", password: "wrong-password" }),
    });
    assert("login inválido rejeitado", status === 401);
  }

  // TI Esbam admin
  const admin = await login("ti.esbam@gmail.com", "admin123");
  assert("TI admin token", Boolean(admin.token));
  assert("TI admin tenant slug", (admin.user as Json)?.tenantSlug === "ti-esbam");

  // Agent login + name for signature
  const agent = await login("atendente1.ti.esbam@gmail.com", "admin123");
  assert("TI agent token", Boolean(agent.token));
  assert("TI agent name", (agent.user as Json)?.name === "Atendente TI 1");

  // Cross-tenant isolation: agent cannot hit platform
  {
    const { status } = await req("/platform/tenants", { token: agent.token });
    assert("agent bloqueado em /platform", status === 401 || status === 403);
  }

  // Flows exist
  {
    const { status, body } = await req("/flows", { token: admin.token });
    const list = body as unknown[];
    assert("listar fluxos TI", status === 200 && Array.isArray(list) && list.length >= 7, `n=${Array.isArray(list) ? list.length : "?"}`);
  }

  // Demo inbound menu
  {
    const { status, body } = await req("/whatsapp/demo/inbound", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        phone: "5592988776655",
        name: "Aluno Teste",
        text: "oi",
      }),
    });
    assert("demo inbound oi", status === 200 || status === 201, `status=${status}`);
    const convId = String((body as Json).conversation?.id ?? (body as Json).conversationId ?? "");
    assert("conversation id", Boolean(convId), JSON.stringify(body).slice(0, 200));

    if (convId) {
      const msgs = await req(`/conversations/${convId}/messages`, { token: admin.token });
      const list = msgs.body as Array<Json>;
      assert("mensagens após oi", Array.isArray(list) && list.length >= 2, `n=${Array.isArray(list) ? list.length : 0}`);
      const outbound = (list || []).filter((m) => m.direction === "outbound");
      assert(
        "menu SUPORTE-TI enviado",
        outbound.some((m) => String(m.content).includes("SUPORTE-TI")),
      );
      assert(
        "horário enviado",
        outbound.some((m) => String(m.content).includes("fora do horário") || String(m.content).includes("Horário") || String(m.content).includes("07:30")),
      );

      // Option 1
      await req("/whatsapp/demo/inbound", {
        method: "POST",
        token: admin.token,
        body: JSON.stringify({ phone: "5592988776655", text: "1" }),
      });
      const after1 = await req(`/conversations/${convId}/messages`, { token: admin.token });
      const list1 = after1.body as Array<Json>;
      assert(
        "fluxo portal",
        list1.some((m) => String(m.content).includes("PORTAL DO ALUNO")),
      );

      // Agent reply with name signature path
      const send = await req(`/conversations/${convId}/messages`, {
        method: "POST",
        token: agent.token,
        body: JSON.stringify({ content: "Recebemos seu chamado, aguarde." }),
      });
      assert("agent envia mensagem", send.status === 200 || send.status === 201, `status=${send.status}`);
      const sent = send.body as Json;
      assert("sentBy gravado", Boolean((sent.sentBy as Json)?.name) || Boolean(sent.sentByUserId), JSON.stringify(sent).slice(0, 180));

      const afterSend = await req(`/conversations/${convId}/messages`, { token: admin.token });
      const list2 = afterSend.body as Array<Json>;
      const lastOut = [...list2].reverse().find((m) => m.direction === "outbound" && String(m.content).includes("Recebemos"));
      assert("conteúdo limpo no painel", Boolean(lastOut));
      assert(
        "nome do atendente no sentBy",
        String((lastOut?.sentBy as Json)?.name ?? "") === "Atendente TI 1",
      );

      // Conversation assigned to agent
      const convs = await req("/conversations", { token: admin.token });
      const rows = convs.body as Array<Json>;
      const mine = rows.find((c) => c.id === convId);
      assert("conversa atribuída ao agent", (mine?.assignee as Json)?.name === "Atendente TI 1" || mine?.assignedTo === (agent.user as Json).id);
    }
  }

  // Ramais flow
  {
    await req("/whatsapp/demo/inbound", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ phone: "5592911122233", name: "Aluno Ramais", text: "ramais" }),
    });
    const convs = await req("/conversations", { token: admin.token });
    const rows = convs.body as Array<Json>;
    const row = rows.find((c) => (c.contact as Json)?.phone === "5592911122233" || (c.contact as Json)?.phone === "5592911122233");
    // phone may be normalized
    const any = rows[0];
    assert("conversas listáveis", Array.isArray(rows) && rows.length > 0);
    if (row || any) {
      const id = String((row ?? any).id);
      const msgs = await req(`/conversations/${id}/messages`, { token: admin.token });
      const list = msgs.body as Array<Json>;
      // find conversation that got ramais - search all recent
      let found = list.some((m) => String(m.content).includes("Ramais úteis"));
      if (!found) {
        for (const c of rows.slice(0, 8)) {
          const m = await req(`/conversations/${c.id}/messages`, { token: admin.token });
          const ml = m.body as Array<Json>;
          if (ml.some((x) => String(x.content).includes("Ramais úteis"))) {
            found = true;
            break;
          }
        }
      }
      assert("fluxo ramais", found);
    }
  }

  // Security: webhook without secret when secret configured should 401
  {
    const { status } = await req("/whatsapp/webhook", {
      method: "POST",
      body: JSON.stringify({ event: "MESSAGES_UPSERT", instance: "hack", data: {} }),
    });
    assert("webhook sem secret bloqueado", status === 401, `status=${status}`);
  }

  // Super admin
  const owner = await login("admin@gbsystems.com.br", "admin123");
  {
    const { status, body } = await req("/platform/tenants", { token: owner.token });
    assert("super admin lista tenants", status === 200 && Array.isArray(body));
    const tenants = body as Array<Json>;
    const ti = tenants.find((t) => t.slug === "ti-esbam");
    assert("tenant ti-esbam no admin", Boolean(ti));

    if (ti) {
      const link = await req(`/platform/tenants/${ti.id}/access-link`, {
        method: "POST",
        token: owner.token,
      });
      assert("access-link gerado", link.status === 200 || link.status === 201);
      const code = String((link.body as Json).code ?? "");
      assert("access code crypto", code.length >= 20 && !code.startsWith("gb_"));

      const exchange = await req("/platform/access/exchange", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      assert("exchange access code", exchange.status === 200 || exchange.status === 201);
      const impToken = String((exchange.body as Json).accessToken ?? "");
      const impUser = (exchange.body as Json).user as Json;
      assert("impersonating flag", impUser?.impersonating === true);
      assert("impersonating tenant", impUser?.tenantSlug === "ti-esbam");

      const platformBlocked = await req("/platform/tenants", { token: impToken });
      assert(
        "impersonation NÃO acessa platform",
        platformBlocked.status === 401 || platformBlocked.status === 403,
      );

      const inboxOk = await req("/conversations", { token: impToken });
      assert("impersonation acessa inbox empresa", inboxOk.status === 200);

      // code single-use
      const reuse = await req("/platform/access/exchange", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      assert("access code single-use", reuse.status === 401 || reuse.status === 400 || reuse.status === 403);
    }
  }

  // Register cannot take ENTERPRISE
  {
    const email = `smoke_${Date.now()}@example.com`;
    const { status, body } = await req("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        tenantName: "Smoke Co",
        name: "Smoke User",
        email,
        password: "admin123",
        planId: "ENTERPRISE",
      }),
    });
    assert("register aceito", status === 200 || status === 201, `status=${status}`);
    const token = String((body as Json).accessToken ?? "");
    const me = await req("/tenants/me", { token });
    const plan = String((me.body as Json).plan ?? (me.body as Json).planId ?? "");
    assert("register força STARTER", plan === "STARTER" || plan.includes("STARTER"), `plan=${plan}`);

    const sub = await req("/plans/subscribe", {
      method: "POST",
      token,
      body: JSON.stringify({ planId: "ENTERPRISE" }),
    });
    assert("subscribe ENTERPRISE bloqueado", sub.status === 400 || sub.status === 403, `status=${sub.status}`);
  }

  // Quick replies TI
  {
    const { status, body } = await req("/quick-replies", { token: admin.token });
    assert("quick replies", status === 200 && Array.isArray(body) && (body as unknown[]).length >= 5);
  }

  // IDOR: agent A cannot use fake conversation from another tenant easily
  {
    const demo = await login("admin@demo.gbsystems.com.br", "admin123");
    const demoConvs = await req("/conversations", { token: demo.token });
    const rows = demoConvs.body as Array<Json>;
    if (rows[0]) {
      const { status } = await req(`/conversations/${rows[0].id}/messages`, { token: admin.token });
      assert("IDOR mensagens bloqueado", status === 404 || status === 403 || status === 401, `status=${status}`);
    } else {
      assert("IDOR skip (sem conversa demo)", true);
    }
  }

  console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
  if (failures.length) {
    console.log("Falhas:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  }
  console.log("Todos os checks passaram.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
