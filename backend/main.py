from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import re
import os

import re

def sanitize_mermaid_flowchart(src: str) -> str:
    s = src.strip()
    # 1) без code fences
    s = re.sub(r"^```mermaid\s*|\s*```$", "", s, flags=re.IGNORECASE|re.MULTILINE).strip()
    # 2) нормалізуємо лапки
    s = s.replace("“","\"").replace("”","\"").replace("’","'").replace("‘","'")
    # 3) заголовок
    if not re.search(r"^(flowchart|graph)\s+\w+", s, flags=re.IGNORECASE|re.MULTILINE):
        s = "flowchart TD\n" + s
    # 4) форми: якщо всередині форми є кома або лапки → перевести у квадратні дужки
    def fix_form(m):
        ident = m.group(1)
        inside = m.group(2)
        if ("," in inside) or ("\"" in inside) or ("'" in inside):
            inside_clean = re.sub(r'["\']', '', inside)
            return f"{ident}[{inside_clean}]"
        return m.group(0)
    s = re.sub(r"([A-Za-z_][\w-]*)\(([^()\n]+)\)", fix_form, s)
    # 5) зайві закривні дужки наприкінці рядків
    s = re.sub(r"\)\)+\s*$", ")", s, flags=re.MULTILINE)
    return s


app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # за потреби обмежити до http://localhost:3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct-v0.2-q4_0")

class DiagramRequest(BaseModel):
    text: str
    type: str | None  = None  # flowchart / sequence / gantt / class / state / er / journey / pie / timeline

class DiagramResponse(BaseModel):
    mermaid_code: str | None = None

def type_hint(t: str | None) -> str:
    if not t:
        return "Використовуй синтаксис Mermaid для flowchart: починай з `graph TD` або `flowchart TD`."
    t = t.lower()
    if t == "flowchart":
        return "Використовуй синтаксис Mermaid для flowchart: починай з `graph TD` або `flowchart TD`."
    if t == "sequence":
        return "Використовуй синтаксис Mermaid для sequenceDiagram."
    if t == "gantt":
        return "Використовуй синтаксис Mermaid для gantt."
    if t == "class":
        return "Використовуй синтаксис Mermaid для classDiagram."
    if t == "state":
        return "Використовуй синтаксис Mermaid для stateDiagram-v2."
    if t == "er":
        return "Використовуй синтаксис Mermaid для erDiagram."
    if t == "journey":
        return "Використовуй синтаксис Mermaid для journey."
    if t == "pie":
        return "Використовуй синтаксис Mermaid для pie."
    if t == "timeline":
        return "Використовуй синтаксис Mermaid для timeline."
    # fallback
    return "Використовуй синтаксис Mermaid для flowchart: починай з `graph TD` або `flowchart TD`."

@app.post("/generate-diagram", response_model=DiagramResponse)
def generate_diagram(req: DiagramRequest):
    """Convert user text to Mermaid code with an LLM via Ollama"""
    hint = type_hint(req.type)

    prompt = f"""
Висококваліфікований помічник, який генерує Mermaid-діаграми.
{hint}
Твоє завдання: перетворити наведений текст у валідний Mermaid-код.

Відповідай ТІЛЬКИ у форматі:

```mermaid
<код>
Не додавай пояснень, опису, коментарів поза блоком коду.

Текст:
{req.text}
"""
    try:
        resp = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={"model": MODEL_NAME, "prompt": prompt, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        output = data.get("response", "") or ""

        # Витягнути Mermaid-код із ```mermaid ... ```
        match = re.search(r"```mermaid\s*([\s\S]*?)```", output, re.IGNORECASE)
        if match:
            mermaid_code = match.group(1).strip()
        else:
            # fallback: можливо, модель повернула чистий код без обгортки
            mermaid_code = output.strip()

        # Мінімальна валідація — наявність ключових конструкцій
        if not any(kw in mermaid_code for kw in [
            "graph ", "flowchart ", "sequenceDiagram", "gantt", "classDiagram",
            "stateDiagram", "stateDiagram-v2", "erDiagram", "journey", "pie", "timeline"
        ]):
            raise ValueError("LLM returned data без ключових слів Mermaid")
        
        mermaid_code = sanitize_mermaid_flowchart(mermaid_code)
        return {"mermaid_code": mermaid_code}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
