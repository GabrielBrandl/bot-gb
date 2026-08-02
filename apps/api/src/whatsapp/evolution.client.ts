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
    const baseURL = this.config.get<string>("EVOLUTION_API_URL", "http://localhost:8080");
    this.apiKey = this.config.get<string>("EVOLUTION_API_KEY", "");
    this.http = axios.create({
      baseURL,
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

  async createInstance(name: string): Promise<EvolutionCreateResult> {
    try {
      const { data } = await this.http.post<Record<string, unknown>>("/instance/create", {
        instanceName: name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });
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

  async getQrCode(instanceName: string): Promise<EvolutionQrResponse> {
    const attempts = 4;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const { data } = await this.http.get<unknown>(`/instance/connect/${instanceName}`);
        const qr = this.normalizeQr(data);
        if (qr.base64 || qr.code || qr.pairingCode) {
          return qr;
        }
        // Evolution sometimes returns an empty payload while Baileys boots.
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

    this.wrapError(lastError, "obter QR Code");
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

  async setWebhook(instanceName: string, url: string): Promise<unknown> {
    try {
      const { data } = await this.http.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      });
      return data;
    } catch (error) {
      this.wrapError(error, "configurar webhook");
    }
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
