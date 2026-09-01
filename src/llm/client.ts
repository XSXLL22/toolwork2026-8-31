/**
 * 可插拔 LLM 接口。
 *
 * 默认引擎完全离线（noopLlm），L3 深度思辨的开放文本分析可选用
 * 小参数模型增强，但始终是「可选」而非「必需」——这保证隐私 NFR：
 * 用户代码与指令默认不发往任何外部服务器。
 */

export interface LlmClient {
  /** 提交一个提示，返回模型文本。 */
  complete(prompt: string): Promise<string>;
}

/** 默认空实现：不调用任何模型。 */
export const noopLlm: LlmClient = {
  async complete(): Promise<string> {
    return "";
  },
};

export interface HttpLlmOptions {
  /** OpenAI 兼容的 chat/completions 端点，如 http://localhost:11434/v1（Ollama）。 */
  baseUrl: string;
  model: string;
  apiKey?: string;
}

/**
 * 构建一个 OpenAI 兼容的 HTTP LLM 客户端（Ollama / vLLM / 云端 API 均可用）。
 * 依赖 Node 18+ 的全局 fetch。
 */
export function createHttpLlm(options: HttpLlmOptions): LlmClient {
  const endpoint = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  return {
    async complete(prompt: string): Promise<string> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });
      if (!res.ok) {
        throw new Error(`LLM 请求失败：${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
