import { FormEvent, useEffect, useState } from "react";
import { Hash, Moon, Plus, QrCode, RefreshCw, Sun, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { tenantsApi, usersApi, whatsappApi, instagramApi, plansApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import { getStoredTheme, setTheme, type ThemeMode } from "../lib/theme";
import type { TeamUser, Tenant, WhatsappInstance } from "../lib/types";
import { Badge, statusBadgeVariant, statusLabel } from "../components/ui/Badge";
import {
  btnPrimary,
  btnDanger,
  btnSecondary,
  Card,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
} from "../components/ui/PageHeader";

type Tab = "whatsapp" | "instagram" | "equipe" | "marca" | "plano";
type WaConnectMode = "qr" | "code";

/** Normaliza para dígitos sem +. Respeita o número informado (não inventa o 9). */
function toWhatsAppDigits(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 15) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

function formatDisplayPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  // +55 (DDD) 9 XXXX-XXXX (13 dígitos)
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 5)} ${d.slice(5, 9)}-${d.slice(9)}`;
  }
  // +55 (DDD) XXXX-XXXX (12 dígitos) — ex: +55 92 3305-1829
  if (d.startsWith("55") && d.length === 12) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return d ? `+${d}` : "";
}

function formatPairingCode(code: string) {
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return code;
}

export function SettingsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [igAccounts, setIgAccounts] = useState<Array<{ id: string; name: string; igUsername?: string | null; status: string }>>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [igName, setIgName] = useState("");

  const [connectMode, setConnectMode] = useState<WaConnectMode>("qr");
  const [instanceName, setInstanceName] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [qrData, setQrData] = useState<{
    base64?: string | null;
    code?: string | null;
    pairingCode?: string | null;
    message?: string;
    phone?: string | null;
  } | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2F6BFF");
  const [savingBrand, setSavingBrand] = useState(false);

  const [evolutionOnline, setEvolutionOnline] = useState<boolean | null>(null);
  const [evolutionHint, setEvolutionHint] = useState("");
  const [theme, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

  async function load(opts?: { quiet?: boolean }) {
    if (!token) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [t, i, u, ig, evo] = await Promise.all([
        tenantsApi.me(token).catch(() => null),
        whatsappApi.listInstances(token).catch(() => []),
        usersApi.list(token).catch(() => []),
        instagramApi.listAccounts(token).catch(() => []),
        whatsappApi.evolutionStatus(token).catch(() => null),
      ]);
      setTenant(t);
      setInstances(i);
      setUsers(u);
      setIgAccounts(ig);
      if (evo) {
        setEvolutionOnline(evo.online);
        setEvolutionHint(evo.hint);
      }
      if (t) {
        setLogoUrl(t.logoUrl ?? "/brand/gb-systems-logo.png");
        setPrimaryColor(t.primaryColor ?? t.brandColor ?? "#2F6BFF");
      }
      if (!opts?.quiet) setError(null);

      const connectedQr = i.find((inst) => inst.id === qrInstanceId && inst.status === "connected");
      if (connectedQr) {
        setQrData(null);
        setQrInstanceId(null);
      }
    } catch (err) {
      if (!opts?.quiet) {
        setError(err instanceof Error ? err.message : "Erro ao carregar configurações");
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  // Atualiza status automaticamente enquanto houver instância "conectando".
  useEffect(() => {
    if (!token) return;
    const connecting = instances.some(
      (i) => i.status === "connecting" && !i.evolutionInstanceId?.startsWith("demo"),
    );
    if (!connecting) return;

    const timer = window.setInterval(() => {
      void (async () => {
        const targets = instances.filter(
          (i) => i.status === "connecting" && !i.evolutionInstanceId?.startsWith("demo"),
        );
        await Promise.all(
          targets.map((inst) => whatsappApi.refresh(token, inst.id).catch(() => null)),
        );
        await load({ quiet: true });
      })();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [token, instances.map((i) => `${i.id}:${i.status}`).join("|")]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onStatus = (payload: { instanceId?: string; status?: string }) => {
      if (!payload?.instanceId || !payload.status) return;
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === payload.instanceId ? { ...inst, status: payload.status as WhatsappInstance["status"] } : inst,
        ),
      );
      if (payload.instanceId === qrInstanceId && payload.status === "connected") {
        setQrData(null);
        setQrInstanceId(null);
      }
    };
    socket.on("instance:status", onStatus);
    return () => {
      socket.off("instance:status", onStatus);
    };
  }, [token, qrInstanceId]);

  async function handleCreateInstance(e: FormEvent) {
    e.preventDefault();
    if (!token || !instanceName.trim()) return;

    let phone: string | undefined;
    if (connectMode === "code") {
      const digits = toWhatsAppDigits(localPhone);
      if (!digits) {
        setError("Informe o número do WhatsApp com DDD (ex: 92999999999). O código do país é adicionado sozinho.");
        return;
      }
      phone = digits;
    }

    try {
      setError(null);
      setQrLoading(true);
      const created = await whatsappApi.createInstance(token, instanceName.trim(), phone);
      setInstanceName("");
      setQrInstanceId(created.id);
      if (created.message) {
        setError(created.message);
      }
      const immediateQr = (created as WhatsappInstance & {
        qr?: { base64?: string | null; code?: string | null; pairingCode?: string | null };
      }).qr;
      if (immediateQr?.base64 || immediateQr?.code || immediateQr?.pairingCode) {
        setQrData(immediateQr);
      }
      await load();
      if (created.evolutionOnline === false) {
        setQrLoading(false);
        return;
      }
      if (connectMode === "code" && phone) {
        await handleShowPairing(created.id, phone);
      } else {
        await handleShowQr(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar instância");
      setQrLoading(false);
    }
  }

  async function handleProvision(id: string) {
    if (!token) return;
    setQrLoading(true);
    setError(null);
    try {
      const result = await whatsappApi.provision(token, id);
      await load();
      if (connectMode === "code") {
        await handleShowPairing(id);
      } else {
        await handleShowQr(id);
      }
      if (!result.evolutionOnline) {
        setError("Evolution ainda offline. Abra o Docker Desktop e rode scripts/start-evolution.ps1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar na Evolution");
      setQrLoading(false);
    }
  }

  async function handleShowQr(id: string) {
    if (!token) return;
    setConnectMode("qr");
    setQrLoading(true);
    setQrInstanceId(id);
    setError(null);
    try {
      let qr = await whatsappApi.getQr(token, id);
      if (!qr.base64 && !qr.code && !qr.pairingCode && !qr.message?.includes("demo")) {
        await new Promise((r) => setTimeout(r, 1200));
        qr = await whatsappApi.getQr(token, id);
      }
      setQrData(qr);
      if (!qr.base64 && !qr.code && !qr.pairingCode && qr.message) {
        setError(qr.message);
      }
      await load({ quiet: true });
    } catch (err) {
      setQrData(null);
      setError(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setQrLoading(false);
    }
  }

  async function handleShowPairing(id: string, phoneOverride?: string) {
    if (!token) return;
    const digits = toWhatsAppDigits(phoneOverride ?? localPhone);
    if (!digits) {
      setConnectMode("code");
      setQrInstanceId(id);
      setError("Para gerar o código, informe o número do WhatsApp com DDD (ex: 92999999999).");
      return;
    }
    setLocalPhone(digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits);
    setConnectMode("code");
    setQrLoading(true);
    setQrInstanceId(id);
    setError(null);
    try {
      let result = await whatsappApi.getPairingCode(token, id, digits);
      if (!result.pairingCode && !result.message?.includes("demo") && !result.message?.includes("conectado")) {
        await new Promise((r) => setTimeout(r, 1500));
        result = await whatsappApi.getPairingCode(token, id, digits);
      }
      setQrData(result);
      if (!result.pairingCode && result.message) {
        setError(result.message);
      }
      await load({ quiet: true });
    } catch (err) {
      setQrData(null);
      setError(err instanceof Error ? err.message : "Erro ao obter código de pareamento");
    } finally {
      setQrLoading(false);
    }
  }

  async function handleRefresh(id: string) {
    if (!token) return;
    try {
      await whatsappApi.refresh(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar instância");
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Remover esta instância?")) return;
    try {
      await whatsappApi.delete(token, id);
      if (qrInstanceId === id) {
        setQrData(null);
        setQrInstanceId(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover instância");
    }
  }

  async function handleSaveBrand(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSavingBrand(true);
    try {
      const updated = await tenantsApi.update(token, { logoUrl, primaryColor });
      setTenant(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar marca");
    } finally {
      setSavingBrand(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "instagram", label: "Instagram" },
    { id: "equipe", label: "Equipe" },
    { id: "marca", label: "Marca" },
    { id: "plano", label: "Plano" },
  ];

  async function handleCreateIg(e: FormEvent) {
    e.preventDefault();
    if (!token || !igName.trim()) return;
    try {
      const created = await instagramApi.createAccount(token, igName.trim());
      await instagramApi.connect(token, created.id);
      setIgName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar Instagram");
    }
  }

  async function handleDeleteIg(id: string) {
    if (!token || !confirm("Remover conta Instagram?")) return;
    await instagramApi.remove(token, id);
    await load();
  }

  async function handleSubscribe(planId: string) {
    if (!token) return;
    try {
      await plansApi.subscribe(token, planId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar plano");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie instâncias, equipe e preferências." />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--abs-gray)] pb-4">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              tab === id
                ? "bg-[var(--abs-yellow)]/25 text-[var(--abs-blue)]"
                : "text-[var(--abs-muted)] hover:bg-[var(--abs-bg)] hover:text-[var(--abs-blue-dark)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "whatsapp" && (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 text-lg font-medium text-[var(--gb-text)]">Instâncias WhatsApp</h2>
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                evolutionOnline
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              <p className="font-medium">
                Evolution API: {evolutionOnline == null ? "verificando…" : evolutionOnline ? "Online" : "Offline"}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {evolutionHint ||
                  "Para WhatsApp real, inicie o Docker Desktop e execute: scripts/start-evolution.ps1"}
              </p>
            </div>
            <p className="mb-4 text-sm text-[var(--gb-muted)]">
              Conecte como no WhatsApp Web (QR) ou, se não puder escanear, use o código de 8 dígitos no celular.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={connectMode === "qr" ? btnPrimary : btnSecondary}
                onClick={() => setConnectMode("qr")}
              >
                <QrCode className="mr-1.5 inline h-4 w-4" />
                Via QR Code
              </button>
              <button
                type="button"
                className={connectMode === "code" ? btnPrimary : btnSecondary}
                onClick={() => setConnectMode("code")}
              >
                <Hash className="mr-1.5 inline h-4 w-4" />
                Via código
              </button>
            </div>

            <form onSubmit={handleCreateInstance} className="mb-4 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nome da instância (ex: GB Principal)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                required
              />
              {connectMode === "code" ? (
                <input
                  className={`${inputClass} max-w-xs`}
                  placeholder="Seu WhatsApp com DDD (ex: 92999999999)"
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value)}
                  inputMode="tel"
                  required
                />
              ) : null}
              <button type="submit" className={btnPrimary} disabled={qrLoading}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                {qrLoading
                  ? connectMode === "code"
                    ? "Gerando código…"
                    : "Gerando QR…"
                  : connectMode === "code"
                    ? "Criar e gerar código"
                    : "Conectar WhatsApp"}
              </button>
            </form>
            {connectMode === "code" ? (
              <p className="mb-4 text-xs text-[var(--gb-muted)]">
                Use o número exatamente como no WhatsApp (ex: 559233051829 ou 9233051829). Digite o código no celular em até 1 minuto.
              </p>
            ) : (
              <p className="mb-4 text-xs text-[var(--gb-muted)]">
                A instância &quot;demo&quot; já vem conectada para testes. Para WhatsApp real, escaneie o QR.
              </p>
            )}
            {instances.length === 0 ? (
              <p className="text-sm text-[var(--gb-muted)]">Nenhuma instância configurada.</p>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => {
                  const isDemo =
                    inst.evolutionInstanceId === "demo" ||
                    String(inst.evolutionInstanceId || "").startsWith("demo-");
                  return (
                    <div
                      key={inst.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--gb-border)] bg-[var(--gb-surface-2)]/50 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--gb-text)]">
                          {inst.name}
                          {isDemo ? (
                            <span className="ml-2 text-xs font-normal text-[var(--gb-muted)]">(demo)</span>
                          ) : null}
                        </p>
                        {inst.phone ? <p className="text-xs text-[var(--gb-muted)]">{inst.phone}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(inst.status)}>
                          {statusLabel(inst.status)}
                        </Badge>
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Mostrar QR Code"
                          onClick={() => void handleShowQr(inst.id)}
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Gerar código de pareamento"
                          onClick={() => void handleShowPairing(inst.id, inst.phone ?? undefined)}
                        >
                          <Hash className="h-4 w-4" />
                        </button>
                        {inst.status === "disconnected" && !isDemo ? (
                          <button
                            type="button"
                            className={btnPrimary}
                            title="Conectar"
                            onClick={() => void handleProvision(inst.id)}
                          >
                            Conectar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Atualizar status"
                          onClick={() => void handleRefresh(inst.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          title="Remover"
                          onClick={() => void handleDelete(inst.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {qrLoading ? (
            <Card>
              <p className="text-sm text-[var(--gb-muted)]">
                {connectMode === "code"
                  ? "Gerando código de pareamento…"
                  : "Gerando QR Code…"}{" "}
                isso pode levar alguns segundos.
              </p>
            </Card>
          ) : null}

          {qrData ? (
            <Card>
              {qrData.pairingCode ? (
                <>
                  <h3 className="mb-2 font-medium text-[var(--gb-text)]">Código de pareamento</h3>
                  <p className="mb-2 text-sm text-[var(--gb-muted)]">
                    No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho →{" "}
                    <strong className="text-[var(--gb-text)]">Conectar com número de telefone</strong> → digite o código{" "}
                    <strong className="text-[var(--gb-text)]">em até 1 minuto</strong>.
                  </p>
                  {qrData.phone || localPhone ? (
                    <p className="mb-4 text-center text-sm text-[var(--gb-cyan)]">
                      Número: {formatDisplayPhone(qrData.phone || toWhatsAppDigits(localPhone) || "")}
                    </p>
                  ) : null}
                  <p className="gb-display my-6 text-center text-4xl font-bold tracking-[0.25em] text-[var(--gb-text)]">
                    {formatPairingCode(qrData.pairingCode)}
                  </p>
                  <p className="text-center text-xs text-[var(--gb-muted)]">
                    Se o WhatsApp disser que o código está errado, gere um novo e digite na hora — códigos antigos ou com número incompleto (sem o 9) falham.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mb-2 font-medium text-[var(--gb-text)]">QR Code — escaneie no WhatsApp</h3>
                  <p className="mb-4 text-sm text-[var(--gb-muted)]">
                    No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte a câmera para o QR.
                  </p>
                  {qrData.base64 ? (
                    <img
                      src={qrData.base64.startsWith("data:") ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                      alt="QR Code WhatsApp"
                      className="mx-auto max-w-[280px] rounded-lg border border-[var(--gb-border)] bg-white p-3"
                    />
                  ) : null}
                  {!qrData.base64 && qrData.code ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--gb-surface-2)] p-4 text-xs text-[var(--gb-muted)]">
                      {qrData.code}
                    </pre>
                  ) : null}
                </>
              )}
              {!qrData.base64 && !qrData.code && !qrData.pairingCode ? (
                <p className="text-sm text-[var(--gb-muted)]">
                  {qrData.message ??
                    "Conexão indisponível. Confirme que a Evolution API está no ar e tente novamente."}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-end gap-2">
                {qrInstanceId ? (
                  <>
                    <button type="button" className={btnSecondary} onClick={() => void handleShowQr(qrInstanceId)}>
                      <RefreshCw className="mr-1.5 inline h-4 w-4" />
                      Atualizar QR
                    </button>
                    <div className="flex min-w-[220px] flex-1 flex-wrap gap-2">
                      <input
                        className={`${inputClass} min-w-[160px] flex-1`}
                        placeholder="WhatsApp c/ DDD p/ código"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        inputMode="tel"
                      />
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => void handleShowPairing(qrInstanceId)}
                      >
                        <Hash className="mr-1.5 inline h-4 w-4" />
                        Gerar código
                      </button>
                    </div>
                  </>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setQrData(null);
                    setQrInstanceId(null);
                  }}
                >
                  Fechar
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {tab === "instagram" && (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 text-lg font-medium text-white">Contas Instagram</h2>
            <p className="mb-4 text-sm text-[var(--gb-muted)]">
              Conecte Instagram Business via Meta Graph API (DM oficial). Em modo demo, crie a conta e use
              &quot;Simular IG&quot; no Inbox. Configure META_APP_ID / META_APP_SECRET / META_WEBHOOK_VERIFY_TOKEN no .env para produção.
            </p>
            <form onSubmit={handleCreateIg} className="mb-4 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Nome da conta (ex: @suaempresa)"
                value={igName}
                onChange={(e) => setIgName(e.target.value)}
                required
              />
              <button type="submit" className={btnPrimary}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                Conectar Instagram
              </button>
            </form>
            {igAccounts.length === 0 ? (
              <p className="text-sm text-[var(--gb-muted)]">Nenhuma conta Instagram.</p>
            ) : (
              <div className="space-y-3">
                {igAccounts.map((acc) => (
                  <div key={acc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--gb-border)] bg-white/5 p-4">
                    <div>
                      <p className="font-medium text-white">{acc.name}</p>
                      <p className="text-xs text-[var(--gb-muted)]">@{acc.igUsername ?? "instagram"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(acc.status)}>{statusLabel(acc.status)}</Badge>
                      <button type="button" className={btnDanger} onClick={() => void handleDeleteIg(acc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "equipe" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-white">Usuários da equipe</h2>
          <form
            className="mb-6 grid gap-2 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token) return;
              const fd = new FormData(e.currentTarget);
              try {
                await usersApi.create(token, {
                  name: String(fd.get("name") || ""),
                  email: String(fd.get("email") || ""),
                  password: String(fd.get("password") || ""),
                  role: String(fd.get("role") || "AGENT") as "ADMIN" | "SUPERVISOR" | "AGENT",
                });
                e.currentTarget.reset();
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao criar usuário");
              }
            }}
          >
            <input className={inputClass} name="name" placeholder="Nome" required />
            <input className={inputClass} name="email" type="email" placeholder="E-mail" required />
            <input className={inputClass} name="password" placeholder="Senha" required minLength={6} />
            <select className={inputClass} name="role" defaultValue="AGENT">
              <option value="AGENT">Atendente</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin empresa</option>
            </select>
            <button type="submit" className={`${btnPrimary} sm:col-span-2`}>Adicionar usuário</button>
          </form>
          {users.length === 0 ? (
            <p className="text-sm text-[var(--gb-muted)]">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--gb-border)] text-left text-[var(--gb-muted)]">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">E-mail</th>
                    <th className="pb-3 font-medium">Papel</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--gb-border)]">
                      <td className="py-3 text-white">{u.name}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.email}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.role}</td>
                      <td className="py-3 text-[var(--gb-muted)]">{u.active === false ? "Inativo" : "Ativo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "marca" && (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--gb-text)]">Aparência</h2>
            <p className="mb-4 text-sm text-[var(--gb-muted)]">Escolha o tema do painel. A preferência fica salva neste navegador.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={theme === "light" ? btnPrimary : btnSecondary}
                onClick={() => {
                  setTheme("light");
                  setThemeMode("light");
                }}
              >
                <Sun className="mr-1.5 inline h-4 w-4" />
                Claro
              </button>
              <button
                type="button"
                className={theme === "dark" ? btnPrimary : btnSecondary}
                onClick={() => {
                  setTheme("dark");
                  setThemeMode("dark");
                }}
              >
                <Moon className="mr-1.5 inline h-4 w-4" />
                Escuro
              </button>
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--gb-text)]">Identidade visual</h2>
            <form onSubmit={handleSaveBrand} className="grid max-w-md gap-4">
              <label className="space-y-1">
                <span className="text-sm text-[var(--gb-muted)]">URL do logo</span>
                <input className={inputClass} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-[var(--gb-muted)]">Cor da marca</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-[var(--gb-border)] bg-transparent"
                  />
                  <input className={inputClass} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </label>
              {logoUrl ? (
                <div>
                  <span className="text-sm text-[var(--gb-muted)]">Prévia</span>
                  <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />
                </div>
              ) : null}
              <button type="submit" className={`${btnPrimary} w-fit`} disabled={savingBrand}>
                {savingBrand ? "Salvando..." : "Salvar marca"}
              </button>
            </form>
          </Card>
        </div>
      )}

      {tab === "plano" && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-white">Plano atual</h2>
          {tenant ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--gb-muted)]">Plano</p>
                <p className="text-xl font-semibold text-[var(--gb-cyan)]">{tenant.plan ?? "STARTER"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["STARTER", "PRO", "ENTERPRISE"] as const).map((planId) => (
                  <button
                    key={planId}
                    type="button"
                    className={tenant.plan === planId ? btnPrimary : btnSecondary}
                    onClick={() => void handleSubscribe(planId)}
                  >
                    {planId === "STARTER" ? "Starter" : planId === "PRO" ? "Professional" : "Enterprise"}
                  </button>
                ))}
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white/5 px-4 py-2 text-sm">
                  <dt className="text-[var(--gb-muted)]">Agentes</dt>
                  <dd className="text-white">{tenant.maxAgents ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-white/5 px-4 py-2 text-sm">
                  <dt className="text-[var(--gb-muted)]">WhatsApp</dt>
                  <dd className="text-white">{tenant.maxInstances ?? "—"}</dd>
                </div>
              </dl>
              <a href="/planos" className="inline-flex text-sm font-semibold text-[var(--gb-violet)] hover:underline">
                Ver comparação completa de planos →
              </a>
            </div>
          ) : (
            <p className="text-sm text-[var(--gb-muted)]">Dados do tenant indisponíveis.</p>
          )}
        </Card>
      )}
    </div>
  );
}
