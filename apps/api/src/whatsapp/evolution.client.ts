import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, isAxiosError } from "axios";
import { ServiceUnavailableException } from "@nestjs/common";

export interface EvolutionQrResponse {
  base64?: string;
  pairingCode?: string;
  code?: string;
}

export interface EvolutionConnectionState {
  instance?: {
    state?: string;
  };
  state?: string;
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
      timeout: 15000,
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  private wrapError(error: unknown, context: string): never {
    if (isAxiosError(error)) {
      this.logger.error(`${context}: ${error.message}`, error.response?.data);
      throw new ServiceUnavailableException(
        `Evolution API indisponível: ${context}. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.`,
      );
    }
    throw new ServiceUnavailableException(`Evolution API indisponível: ${context}.`);
  }

  async createInstance(name: string): Promise<{ instanceName: string }> {
    try {
      const { data } = await this.http.post<{ instance?: { instanceName?: string } }>(
        "/instance/create",
        {
          instanceName: name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        },
      );
      return { instanceName: data.instance?.instanceName ?? name };
    } catch (error) {
      this.wrapError(error, "criar instância");
    }
  }

  async getQrCode(instanceName: string): Promise<EvolutionQrResponse> {
    try {
      const { data } = await this.http.get<EvolutionQrResponse>(
        `/instance/connect/${instanceName}`,
      );
      return data;
    } catch (error) {
      this.wrapError(error, "obter QR Code");
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

  async setWebhook(instanceName: string, url: string): Promise<unknown> {
    try {
      const { data } = await this.http.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
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
      this.wrapError(error, "remover instância");
    }
  }
}
