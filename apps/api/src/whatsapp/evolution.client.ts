import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, isAxiosError } from "axios";

export interface EvolutionQrResponse {
  base64?: string | null;
  pairingCode?: string | null;
  code?: string | null;
  count?: number;
  message?: string;
}

export interface EvolutionConnectionState {
  instance?: {
    state?: string;
  };
  state?: string;
}

export interface EvolutionCreateResult {
  instanceName: string;
  qr?: EvolutionQrResponse;
}

@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    const baseURL =
      this.config.get<string>("EVOLUTION_API_URL")?.trim() ||
      this.config.get<string>("EVOLUTION_SERVER_URL")?.trim() ||
      "http://localhost:8080";
    this.apiKey = this.config.get<string>("EVOLUTION_API_KEY", "");
    this.http = axios.create({
      baseURL: baseURL.replace(/\/$/, ""),
      timeout: 20000,
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  private wrapError(error: unknown, context: string): never {
    if (isAxiosError(error)) {
      const detail =
        typeof error.response?.data === "object" && error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message;
      this.logger.error(`${context}: ${detail}`);
      throw new ServiceUnavailableException(
        `Evolution API indisponível ao ${context}. Verifique se o container evolution-api está no ar e se EVOLUTION_API_URL / EVOLUTION_API_KEY estão corretos.`,
      );
    }
    throw new ServiceUnavailableException(`Evolution API indisponível ao ${context}.`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.http.get("/", { timeout: 3000, validateStatus: () => true });
      return true;
    } catch {
      try {
        await this.http.get("/instance/fetchInstances", { timeout: 3000, validateStatus: () => true });
        return true;
      } catch {
        return false;
      }
    }
  }

  normalizeQr(payload: unknown): EvolutionQrResponse {
    if (!payload || typeof payload !== "object") {
      return {};
    }
    const data = payload as Record<string, unknown>;
    const nested = data.qrcode as Record<string, unknown> | undefined;
    const base64 =
      (typeof data.base64 === "string" && data.base64) ||
      (typeof nested?.base64 === "string" && nested.base64) ||
      undefined;
    const code =
      (typeof data.code === "string" && data.code) ||
      (typeof nested?.code === "string" && nested.code) ||
      undefined;
    const pairingCode =
      (typeof data.pairingCode === "string" && data.pairingCode) ||
      (typeof nested?.pairingCode === "string" && nested.pairingCode) ||
      undefined;

    return { base64, code, pairingCode };
  }

  async createInstance(name: string, phoneNumber?: string): Promise<EvolutionCreateResult> {
    try {
      const digits = phoneNumber?.replace(/\D/g, "");
      const payload: Record<string, unknown> = {
        instanceName: name,
        // Com número: pareamento. Sem número: QR (WhatsApp Web).
        qrcode: !digits,
        integration: "WHATSAPP-BAILEYS",
      };
      if (digits) {
        payload.number = digits;
      }

      const { data } = await this.http.post<Record<string, unknown>>("/instance/create", payload);
      const instance = data.instance as { instanceName?: string } | undefined;
      return {
        instanceName: instance?.instanceName ?? name,
        qr: this.normalizeQr(data),
      };
    } catch (error) {
      if (isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 409)) {
        this.logger.warn(`Instância ${name} já existe na Evolution; reutilizando.`);
        return { instanceName: name };
      }
      this.wrapError(error, "criar instância");
    }
  }

  async getQrCode(instanceName: string, phoneNumber?: string): Promise<EvolutionQrResponse> {
    const attempts = 4;
    let lastError: unknown;
    const digits = phoneNumber?.replace(/\D/g, "");
    const query = digits ? `?number=${encodeURIComponent(digits)}` : "";

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const { data } = await this.http.get<unknown>(`/instance/connect/${instanceName}${query}`);
        const qr = this.normalizeQr(data);
        if (digits) {
          // Pairing mode: wait until Evolution returns the code (can lag a few tries).
          if (qr.pairingCode) return qr;
        } else if (qr.base64 || qr.code || qr.pairingCode) {
          return qr;
        }
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        return qr;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
      }
    }

    this.wrapError(lastError, digits ? "obter código de pareamento" : "obter QR Code");
  }

  /**
   * Pareamento por código: força um connect limpo com o número.
   * Códigos gerados em cima de sessão QR antiga costumam ser rejeitados pelo WhatsApp.
   */
  async getPairingCode(instanceName: string, phoneNumber: string): Promise<EvolutionQrResponse> {
    const digits = phoneNumber.replace(/\D/g, "");
    const attempts = 6;
    let lastError: unknown;
    let lastQr: EvolutionQrResponse = {};

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const { data } = await this.http.get<unknown>(
          `/instance/connect/${instanceName}?number=${encodeURIComponent(digits)}`,
        );
        lastQr = this.normalizeQr(data);
        if (lastQr.pairingCode) {
          // Remove hífen/espaços — o app espera 8 chars alfanuméricos.
          lastQr.pairingCode = lastQr.pairingCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
          return lastQr;
        }
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (lastQr.pairingCode || lastQr.base64 || lastQr.code) {
      return lastQr;
    }
    this.wrapError(lastError, "obter código de pareamento");
  }

  async logout(instanceName: string): Promise<void> {
    try {
      await this.http.delete(`/instance/logout/${instanceName}`);
    } catch (error) {
      if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
        return;
      }
      this.logger.warn(
        `Logout ${instanceName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionState> {
    try {
      const { data } = await this.http.get<EvolutionConnectionState>(
        `/instance/connectionState/${instanceName}`,
      );
      return data;
    } catch (error) {
      this.wrapError(error, "consultar status da conexão");
    }
  }

  async sendText(instance: string, phone: string, text: string): Promise<unknown> {
    try {
      const number = phone.replace(/\D/g, "");
      const { data } = await this.http.post(`/message/sendText/${instance}`, {
        number,
        text,
      });
      return data;
    } catch (error) {
      this.wrapError(error, "enviar mensagem de texto");
    }
  }

  async sendMedia(
    instance: string,
    phone: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<unknown> {
    try {
      const number = phone.replace(/\D/g, "");
      const { data } = await this.http.post(`/message/sendMedia/${instance}`, {
        number,
        mediatype: "image",
        media: mediaUrl,
        caption,
      });
      return data;
    } catch (error) {
      this.wrapError(error, "enviar mídia");
    }
  }

  async setWebhook(instanceName: string, url: string, secret?: string): Promise<unknown> {
    try {
      const headers: Record<string, string> = {};
      const webhookSecret = (secret || this.config.get<string>("EVOLUTION_WEBHOOK_SECRET") || "").trim();
      if (webhookSecret) {
        headers["x-webhook-secret"] = webhookSecret;
        headers.apikey = webhookSecret;
      }

      const { data } = await this.http.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          webhookBase64: false,
          ...(Object.keys(headers).length ? { headers } : {}),
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      });
      return data;
    } catch (error) {
      this.wrapError(error, "configurar webhook");
    }
  }

  /** Normaliza connectionStatus da Evolution (open/close/connecting). */
  mapConnectionStatus(raw?: string | null): "connected" | "connecting" | "disconnected" {
    const state = (raw || "").toLowerCase();
    if (state === "open" || state === "connected") return "connected";
    if (state === "connecting" || state === "qr" || state === "pairingsuccess") return "connecting";
    return "disconnected";
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.http.delete(`/instance/delete/${instanceName}`);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return;
      }
      this.wrapError(error, "remover instância");
    }
  }
}
