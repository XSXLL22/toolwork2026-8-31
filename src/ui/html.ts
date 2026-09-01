/** 内嵌单页应用（零外部依赖，本地离线可用）。 */
export const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>prompt-cog 可视化窗口</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; background: #f5f6f8; color: #1f2328; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #667; font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid #e4e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  h2 { font-size: 15px; margin: 0 0 8px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 6px; color: #333; }
  textarea, input[type=text], select { width: 100%; padding: 8px 10px; border: 1px solid #cfd4da; border-radius: 6px; font-size: 14px; font-family: inherit; }
  textarea { min-height: 72px; resize: vertical; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .row > div { flex: 1; min-width: 180px; }
  button { background: #2563eb; color: #fff; border: 0; border-radius: 6px; padding: 9px 16px; font-size: 14px; cursor: pointer; }
  button.secondary { background: #fff; color: #2563eb; border: 1px solid #2563eb; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .slot { border: 1px solid #e9edf1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .slot .q { font-size: 13px; color: #333; margin-bottom: 6px; }
  .tag { font-size: 11px; color: #888; background: #f0f2f5; padding: 1px 6px; border-radius: 4px; }
  .meta { font-size: 13px; color: #555; line-height: 1.7; }
  .bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .bar label { display: flex; align-items: center; gap: 6px; font-weight: normal; margin: 0; }
  #result { min-height: 220px; font-family: ui-monospace, Consolas, "Courier New", monospace; font-size: 13px; white-space: pre-wrap; }
  details summary { cursor: pointer; }
  #status { font-size: 12px; color: #2563eb; min-height: 16px; margin-top: 6px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>prompt-cog 可视化窗口</h1>
  <div class="sub">认知增强型 AI 指示词过滤与完善工具 · 本地离线运行</div>

  <div class="card">
    <label>原始指令</label>
    <textarea id="text" placeholder="例如：写个排序算法"></textarea>
    <div class="row" style="margin-top:10px">
      <div>
        <label>深度</label>
        <select id="depth">
          <option value="L2" selected>L2 标准引导</option>
          <option value="L1">L1 快速检查</option>
          <option value="L3">L3 深度思辨</option>
        </select>
      </div>
      <div>
        <label>配方预设</label>
        <select id="recipePreset"><option value="">（默认）</option></select>
      </div>
    </div>
    <details style="margin-top:10px">
      <summary style="font-size:13px;color:#555">自定义配方（JSON / 文件路径）</summary>
      <label style="margin-top:8px">JSON 配方（留空忽略）</label>
      <textarea id="recipeJson" placeholder='{"style":{"tone":"concise"}}' style="min-height:56px"></textarea>
      <label style="margin-top:8px">配方文件路径（.json / .mjs，留空忽略）</label>
      <input type="text" id="recipePath" placeholder="例如：./my-recipe.mjs">
    </details>
    <div class="bar" style="margin-top:12px">
      <button id="btnAnalyze">① 分析并生成工作表</button>
    </div>
    <div id="status"></div>
  </div>

  <div id="sheet" style="display:none">
    <div class="card"><div class="meta" id="meta"></div></div>
    <div class="card">
      <h2>填写缺失维度与追问</h2>
      <div id="slots"></div>
      <div class="bar" style="margin-top:12px">
        <label><input type="checkbox" id="raw" checked> 仅合并原始条件（不翻译为 AI 指令）</label>
        <button id="btnCompile">② 编译</button>
        <button id="btnBack" class="secondary">返回修改</button>
      </div>
    </div>
  </div>

  <div id="out" style="display:none">
    <div class="card">
      <div class="bar" style="margin-bottom:10px">
        <button id="btnCopy" class="secondary">复制</button>
        <button id="btnDownload" class="secondary">下载 .txt</button>
      </div>
      <textarea id="result" readonly></textarea>
    </div>
  </div>
</div>

<script>
(function () {
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function flash(msg) { $("status").textContent = msg; }

  var lastSlots = [];

  function recipeSpec() {
    var path = $("recipePath").value.trim();
    if (path) return { kind: "path", value: path };
    var j = $("recipeJson").value.trim();
    if (j) return { kind: "json", value: j };
    var p = $("recipePreset").value;
    if (p) return { kind: "preset", value: p };
    return null;
  }

  async function post(url, data) {
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  function metaLabel(t) {
    var m = { factual: "实然", normative: "应然", definitional: "定义", mixed: "混合" };
    return m[t] || t;
  }
  function pct(s) {
    if (!s) return "";
    return Math.round(s.value * 100) + "%（" + s.level + "）";
  }

  async function analyze() {
    var text = $("text").value.trim();
    if (!text) { flash("请先输入指令"); return; }
    flash("分析中…");
    var r = await post("/api/analyze", { text: text, depth: $("depth").value, recipe: recipeSpec() });
    if (r.error) { flash("错误：" + r.error); return; }
    lastSlots = r.slots || [];
    var meta = r.meta || {};
    $("meta").innerHTML =
      "命题类型：<b>" + metaLabel(meta.propositionType) + "</b>　" +
      "最强断言：" + escapeHtml(meta.strongClaim) + "<br>" +
      "结构完整度：" + pct(meta.structural);
    renderSlots(lastSlots);
    $("sheet").style.display = "block";
    $("out").style.display = "none";
    flash("");
  }

  function renderSlots(slots) {
    var box = $("slots");
    box.innerHTML = "";
    slots.forEach(function (s) {
      var wrap = document.createElement("div");
      wrap.className = "slot";
      var tag = s.group === "completeness" ? ("缺失维度" + (s.required ? "·硬" : "")) : "追问";
      var q = document.createElement("div");
      q.className = "q";
      q.innerHTML = '<span class="tag">' + tag + "</span> " + escapeHtml(s.question);
      wrap.appendChild(q);
      var input = document.createElement("input");
      input.type = "text";
      input.id = "slot-" + s.id;
      input.placeholder = s.label;
      if (s.recommended) input.value = s.recommended;
      if (s.options && s.options.length) {
        var dl = document.createElement("datalist");
        dl.id = "dl-" + s.id;
        s.options.forEach(function (o) {
          var op = document.createElement("option");
          op.value = o;
          dl.appendChild(op);
        });
        document.body.appendChild(dl);
        input.setAttribute("list", dl.id);
      }
      wrap.appendChild(input);
      box.appendChild(wrap);
    });
  }

  async function compile() {
    var filled = {};
    lastSlots.forEach(function (s) {
      var el = $("slot-" + s.id);
      if (el && el.value.trim()) filled[s.id] = el.value.trim();
    });
    var text = $("text").value.trim();
    flash("编译中…");
    var r = await post("/api/compile", {
      text: text,
      depth: $("depth").value,
      recipe: recipeSpec(),
      filled: filled,
      raw: $("raw").checked,
    });
    if (r.error) { flash("错误：" + r.error); return; }
    $("result").value = r.result;
    $("out").style.display = "block";
    flash("");
  }

  function copyResult() {
    var content = $("result").value;
    function fallback() {
      var el = $("result");
      el.select();
      document.execCommand("copy");
      flash("已复制");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(function () { flash("已复制"); }, fallback);
    } else {
      fallback();
    }
  }

  function downloadResult() {
    var content = $("result").value;
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prompt-cog-指令.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  $("btnAnalyze").addEventListener("click", analyze);
  $("btnCompile").addEventListener("click", compile);
  $("btnCopy").addEventListener("click", copyResult);
  $("btnDownload").addEventListener("click", downloadResult);
  $("btnBack").addEventListener("click", function () { $("sheet").style.display = "none"; });

  fetch("/api/recipes")
    .then(function (r) { return r.json(); })
    .then(function (names) {
      var sel = $("recipePreset");
      names.forEach(function (n) {
        var o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        sel.appendChild(o);
      });
    });

  var qp = new URLSearchParams(location.search).get("prompt");
  if (qp) $("text").value = qp;
})();
</script>
</body>
</html>
`;
