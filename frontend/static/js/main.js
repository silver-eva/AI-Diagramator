const backendUrl = "http://localhost:8000";

const userText     = document.getElementById("userText");
const diagramType  = document.getElementById("diagramType");
const generateBtn  = document.getElementById("generateBtn");
const exportBtn    = document.getElementById("exportBtn");
const debugBtn     = document.getElementById("debugBtn");
const editor       = document.getElementById("editor");
const diagramDiv   = document.getElementById("diagram");

// Mermaid init
mermaid.initialize({ startOnLoad: false });

// Проста “граматика” для мережі автолоадера Prism (щоб підсвічення не було “сірою масою”)
// З Prism Live ми можемо встановити language вручну: використаємо language-markup (є з коробки)
// або підключити додаткові компоненти через autoloader (mermaid не входить в стандарт).
// Для POC достатньо language-markup + ключові слова, які Prism Live вже підсвічує базово.

// Невеликий debounce
function debounce(fn, ms=200){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

// Робота з редактором
function getCode(){ return editor.textContent; }
function setCode(v){
  editor.textContent = v || "";
  // Примусово тригеримо Prism Live для оновлення підсвітки
  if (window.Prism && Prism.live) { try { Prism.live(); } catch(_){} }
}

const updateDiagram = debounce(async () => {
  const code = getCode().trim();
  if (!code) { diagramDiv.innerHTML = ""; return; }
  try {
    const { svg } = await mermaid.render("theGraph", code); // v10 Promise API
    diagramDiv.innerHTML = svg;
    lastRenderError = null;
  } catch(err){
    lastRenderError = String(err);
    diagramDiv.innerHTML = `<pre>Помилка рендерингу Mermaid:\n${err}</pre>`;
  }
}, 160);

// Live оновлення при наборі
editor.addEventListener("input", () => updateDiagram());

// Генерація через бекенд (LLM→Mermaid)
generateBtn.addEventListener("click", async () => {
  const text = userText.value.trim();
  const type = (diagramType.value || "flowchart").toLowerCase();
  if (!text) return alert("Введіть текст!");

  let resp;
  try{
    resp = await fetch(`${backendUrl}/generate-diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type })
    });
  }catch(e){
    alert("Немає з’єднання з бекендом: " + e);
    return;
  }

  if (!resp.ok){
    let detail = "Unknown error";
    try{ detail = (await resp.json()).detail }catch{}
    alert("Помилка: " + detail);
    return;
  }

  const data = await resp.json();
  setCode(data.mermaid_code || "");
  updateDiagram();
});

// Експорт PNG (SVG -> Canvas -> PNG)
exportBtn.addEventListener("click", () => {
  const svgEl = diagramDiv.querySelector("svg");
  if (!svgEl) return alert("Немає діаграми!");

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "diagram.png";
    link.href = pngUrl;
    link.click();
  };
  img.src = url;
});

// ---- DEBUG KIT ----
let lastRenderError = null;

function getComputedSnapshot(sel) {
  const el = document.querySelector(sel);
  if (!el) return { error: 'not found' };
  const cs = getComputedStyle(el);
  return {
    rect: el.getBoundingClientRect().toJSON?.() || null,
    scroll: { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight },
    styles: {
      font: cs.font,
      lineHeight: cs.getPropertyValue('line-height'),
      whiteSpace: cs.getPropertyValue('white-space'),
      tabSize: cs.getPropertyValue('tab-size'),
      padding: [
        cs.getPropertyValue('padding-top'),
        cs.getPropertyValue('padding-right'),
        cs.getPropertyValue('padding-bottom'),
        cs.getPropertyValue('padding-left')
      ],
      border: cs.getPropertyValue('border'),
      background: cs.getPropertyValue('background-color'),
      color: cs.getPropertyValue('color')
    }
  };
}

function collectDebugInfo() {
  const svg = diagramDiv.querySelector('svg');
  return {
    timestamp: new Date().toISOString(),
    ua: navigator.userAgent,
    mermaidVersion: mermaid?.version || 'unknown',
    prismPresent: !!window.Prism,
    backendUrl,
    lastRenderError,
    mermaidCode: getCode(),
    svgPresent: !!svg,
    svgLength: svg ? svg.outerHTML.length : 0,
    dims: {
      editor: getComputedSnapshot('#editor'),
      diagram: getComputedSnapshot('#diagram')
    },
  };
}

function downloadDebugReport() {
  const info = collectDebugInfo();
  const blob = new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mermaid_poc_debug_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

debugBtn.addEventListener('click', downloadDebugReport);

// Стартове пусте значення
setCode(`graph TD
  A[Start] --> B{Choice?}
  B -- Yes --> C[Path C]
  B -- No  --> D[Path D]
`);
updateDiagram();
