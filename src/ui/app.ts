import { createServer } from "node:http";
import { exec } from "node:child_process";
import { dispatch } from "./server.js";

export interface StartUiOptions {
  port?: number;
  host?: string;
  open?: boolean;
  /** 预填到页面「原始指令」输入框的提示词（经 ?prompt= 查询参数传递）。 */
  prompt?: string;
}

export interface UiHandle {
  url: string;
  close: () => void;
}

/** 跨平台打开默认浏览器。 */
export function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/** 启动本地 UI 服务（监听 127.0.0.1），默认打开浏览器，端口占用时回退到随机端口。 */
export function startUi(opts: StartUiOptions = {}): Promise<UiHandle> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8787;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}`);
      let body = "";
      for await (const chunk of req) body += chunk;
      const r = await dispatch(req.method ?? "GET", url.pathname, body);
      res.writeHead(r.status, { "Content-Type": r.contentType });
      res.end(r.body);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  return new Promise((resolve, reject) => {
    const onListening = () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const base = `http://${host}:${actualPort}`;
      const url = opts.prompt ? `${base}/?prompt=${encodeURIComponent(opts.prompt)}` : `${base}/`;
      if (opts.open !== false) openBrowser(url);
      resolve({ url, close: () => server.close() });
    };
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && port !== 0) {
        server.off("error", onError);
        server.listen(0, host); // 回退随机端口
      } else {
        reject(err);
      }
    };
    server.once("listening", onListening);
    server.once("error", onError);
    server.listen(port, host);
  });
}
