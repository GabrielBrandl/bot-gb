import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { isAxiosError } from "axios";

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasPaymentResult {
  id: string;
  url?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  status?: string;
  billingType?: string;
}

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("ASAAS_API_KEY", "");
    this.baseUrl = this.config.get<string>(
      "ASAAS_API_URL",
      "https://sandbox.asaas.com/api/v3",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async createCharge(input: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    value: number;
    description: string;
    billingType: AsaasBillingType;
    externalReference?: string;
  }): Promise<AsaasPaymentResult> {
    if (!this.apiKey) {
      const id = `placeholder-${Date.now()}`;
      return {
        id,
        url: `https://sandbox.asaas.com/i/${id}`,
        invoiceUrl: `https://sandbox.asaas.com/i/${id}`,
        bankSlipUrl:
          input.billingType === "BOLETO"
            ? `https://sandbox.asaas.com/b/pdf/${id}`
            : undefined,
        status: "PENDING",
        billingType: input.billingType,
      };
    }

    try {
      const customerPayload: Record<string, string> = {
        name: input.customerName,
      };
      if (input.customerEmail) customerPayload.email = input.customerEmail;
      if (input.customerPhone) {
        customerPayload.mobilePhone = input.customerPhone.replace(/\D/g, "");
      }

      const { data: customer } = await axios.post<{ id: string }>(
        `${this.baseUrl}/customers`,
        customerPayload,
        { headers: { access_token: this.apiKey } },
      );

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      const { data: payment } = await axios.post<AsaasPaymentResult>(
        `${this.baseUrl}/payments`,
        {
          customer: customer.id,
          billingType: input.billingType,
          value: input.value,
          dueDate: dueDateStr,
          description: input.description,
          externalReference: input.externalReference,
        },
        { headers: { access_token: this.apiKey } },
      );

      return payment;
    } catch (error) {
      if (isAxiosError(error)) {
        this.logger.error("Asaas error", error.response?.data);
      }
      const id = `placeholder-${Date.now()}`;
      return {
        id,
        url: `https://sandbox.asaas.com/i/${id}`,
        invoiceUrl: `https://sandbox.asaas.com/i/${id}`,
        status: "PENDING",
        billingType: input.billingType,
      };
    }
  }
}
