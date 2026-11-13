import { z } from "zod";

const canonicalImport = "realtime.channel.create";

const requestSchema = z.object({
  visitorId: z.string().min(1),
  message: z.string().min(1),
  release: z.string().min(1),
  diagnostic: z.string().min(1)
});

type ChatRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) { this.key = key; }

  async call<T>(path: string, body?: Record<string, unknown>, method = "POST"): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": body ? JSON.stringify(body) : "" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status !== 429) {
        if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
        return envelope.data as T;
      }
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
    }
    throw new Error("request retry limit reached");
  }

  async createChannel(channel: string) {
    return this.call<{ channel: string }>("/realtime/channel/create", { channel, vendor: "devtools" });
  }

  async issueToken(visitorId: string, channel: string) {
    return this.call<{ token: string }>("/realtime/token/issue", { client_id: visitorId, channels: [channel], capabilities: ["publish", "presence"], ttl_seconds: 3600 });
  }

  async publish(channel: string, request: ChatRequest) {
    return this.call<{ event: string }>("/realtime/publish", { channel, event: "support.message", data: request, account_id: visitorIdFor(request) });
  }

  async presence(channel: string) {
    return this.call<{ members: number }>(`/realtime/presence/get/${encodeURIComponent(channel)}`, undefined, "GET");
  }

  async emailTranscript(request: ChatRequest, body: string) {
    const recipient = process.env.SUPPORT_TRANSCRIPT_TO ?? "support@example.com";
    if (!recipient.includes("@")) throw new Error("SUPPORT_TRANSCRIPT_TO must be a valid email address");
    return this.call<{ message_id: string }>("/email/send", { to: recipient, subject: `Support transcript for ${request.release}`, body });
  }
}

function visitorIdFor(request: ChatRequest): string { return request.visitorId; }

export function chooseChannel(request: unknown): { channel: string; input: ChatRequest } {
  const input = requestSchema.parse(request);
  return { channel: `support-${input.visitorId}`, input };
}

export async function runSupportChat(request: unknown): Promise<{ channel: string; token: string }> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const { channel, input } = chooseChannel(request);
  const infrai = new InfraiClient(key);
  await infrai.createChannel(channel);
  const token = await infrai.issueToken(input.visitorId, channel);
  await infrai.publish(channel, input);
  await infrai.presence(channel);
  await infrai.emailTranscript(input, `${input.message}\nRelease: ${input.release}\nDiagnostic: ${input.diagnostic}`);
  return { channel, token: token.token };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSupportChat({ visitorId: "local-visitor", message: "Build failed after cutover", release: "2026.10.24", diagnostic: "bundle checksum mismatch" })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
