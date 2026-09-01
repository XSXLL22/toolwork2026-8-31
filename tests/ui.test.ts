import { describe, expect, it } from "vitest";
import { dispatch, UI_HTML } from "../src/index.js";

describe("可视化窗口服务端 dispatch", () => {
  it("GET / 返回内嵌单页 HTML", async () => {
    const r = await dispatch("GET", "/", "");
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("text/html");
    expect(r.body).toContain("prompt-cog 可视化窗口");
    expect(r.body).toBe(UI_HTML);
  });

  it("GET /api/recipes 返回预设名列表", async () => {
    const r = await dispatch("GET", "/api/recipes", "");
    expect(r.status).toBe(200);
    const names = JSON.parse(r.body) as string[];
    expect(names).toContain("default");
    expect(names).toContain("concise");
  });

  it("POST /api/analyze 返回插槽与元信息", async () => {
    const r = await dispatch("POST", "/api/analyze", JSON.stringify({ text: "写个排序算法", depth: "L2" }));
    expect(r.status).toBe(200);
    const data = JSON.parse(r.body);
    expect(Array.isArray(data.slots)).toBe(true);
    expect(data.meta).toHaveProperty("propositionType");
    expect(data.meta).toHaveProperty("structural");
  });

  it("POST /api/analyze 缺 text 返回 400", async () => {
    const r = await dispatch("POST", "/api/analyze", JSON.stringify({ depth: "L2" }));
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body)).toHaveProperty("error");
  });

  it("POST /api/compile 默认翻译为指令", async () => {
    const r = await dispatch(
      "POST",
      "/api/compile",
      JSON.stringify({ text: "写个排序算法", depth: "L2", filled: { "completeness-environment": "Python 3.10" }, raw: false }),
    );
    expect(r.status).toBe(200);
    const data = JSON.parse(r.body);
    expect(data.result).toContain("优化后的指令");
    expect(data.result).toContain("Python 3.10");
  });

  it("POST /api/compile raw 模式仅合并条件", async () => {
    const r = await dispatch(
      "POST",
      "/api/compile",
      JSON.stringify({ text: "写个排序算法", depth: "L2", filled: { "completeness-environment": "Python 3.10" }, raw: true }),
    );
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).result).toContain("补全后的条件");
  });

  it("JSON 配方 spec 生效（切换为纯文本分区）", async () => {
    const r = await dispatch(
      "POST",
      "/api/compile",
      JSON.stringify({
        text: "写个排序算法",
        depth: "L2",
        filled: { "completeness-environment": "Python 3.10" },
        raw: false,
        recipe: { kind: "json", value: JSON.stringify({ translation: { headerFormat: "plain", taskTitle: "任务" } }) },
      }),
    );
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).result).toContain("【任务】");
  });

  it("未知路径返回 404", async () => {
    const r = await dispatch("GET", "/nope", "");
    expect(r.status).toBe(404);
  });
});
