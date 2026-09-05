import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import { classifyYao, yaosToBinary } from "@/lib/quantum";
import { readSSEData } from "@/lib/sse";
import type { InterpretRequest } from "@/lib/types";

export const runtime = "edge";

function isInterpretRequest(value: unknown): value is InterpretRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<InterpretRequest>;
  if (typeof body.question !== "string" || !body.question.trim()) return false;
  if (typeof body.benBin !== "string" || !/^[01]{6}$/.test(body.benBin)) return false;
  if (typeof body.bianBin !== "string" || !/^[01]{6}$/.test(body.bianBin)) return false;
  if (!Array.isArray(body.yaos) || body.yaos.length !== 6) return false;
  if (!body.yaos.every((yao, index) => {
    if (!yao || typeof yao.bitstring !== "string" || !/^[01]{3}$/.test(yao.bitstring)) return false;
    const expected = classifyYao(parseInt(yao.bitstring, 2), index);
    return yao.index === index && yao.ones === expected.ones && yao.name === expected.name &&
      yao.isYang === expected.isYang && yao.isChanging === expected.isChanging;
  })) return false;
  const { ben, bian } = yaosToBinary(body.yaos);
  return body.benBin === ben && body.bianBin === bian;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: req.signal.aborted ? "请求已取消" : "Bad JSON" },
      { status: req.signal.aborted ? 499 : 400 }
    );
  }
  if (!isInterpretRequest(body)) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { question, yaos, benBin, bianBin } = body;
  if (question.length > 200) return Response.json({ error: "问题过长（≤200 字）" }, { status: 400 });

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "服务端未配置 DEEPSEEK_API_KEY。请联系管理员或自行部署。" }, { status: 503 });
  }
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "deepseek-chat";
  const upstreamCtrl = new AbortController();
  const abortUpstream = () => upstreamCtrl.abort(req.signal.reason);
  req.signal.addEventListener("abort", abortUpstream, { once: true });
  if (req.signal.aborted) abortUpstream();
  const cleanup = () => req.signal.removeEventListener("abort", abortUpstream);

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(question, yaos, benBin, bianBin) },
        ],
        temperature: 0.6,
        // 推理模型（如 glm-5.3）的 reasoning 会消耗输出预算，3200 容易被思考过程占满导致正文为空
        max_tokens: 8192,
        stream: true,
      }),
      signal: upstreamCtrl.signal,
    });
  } catch {
    cleanup();
    return Response.json({ error: "暂时无法连接 AI 服务，请稍后重试。" }, { status: req.signal.aborted ? 499 : 502 });
  }
  if (!upstream.ok || !upstream.body) {
    upstreamCtrl.abort();
    cleanup();
    return Response.json({ error: `AI 接口返回 HTTP ${upstream.status}` }, { status: 502 });
  }

  const upstreamBody = upstream.body;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stopHeartbeat = () => {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    heartbeat = undefined;
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: string) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": waiting for model\n\n"));
      }, 15_000);
      try {
        let completed = false;
        for await (const payload of readSSEData(upstreamBody)) {
          if (closed) return;
          if (payload === "[DONE]") {
            completed = true;
            break;
          }
          const parsed = JSON.parse(payload) as {
            error?: unknown;
            choices?: { delta?: { content?: unknown } }[];
          } | null;
          if (parsed?.error) throw new Error("AI 服务返回错误，请重试。");
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            stopHeartbeat();
            send(JSON.stringify({ text: delta }));
          }
        }
        if (!completed) throw new Error("AI 连接提前结束，解读未完成，请重试。");
        send("[DONE]");
      } catch {
        send(JSON.stringify({ error: "AI 解读连接中断或响应无效，请重试。" }));
      } finally {
        stopHeartbeat();
        upstreamCtrl.abort();
        cleanup();
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      stopHeartbeat();
      upstreamCtrl.abort();
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
