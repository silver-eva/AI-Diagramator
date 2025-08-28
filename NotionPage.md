# How to Run an LLM in a Container

*(Ollama + FastAPI + Mermaid Diagram Editor POC)*

A concise, copy-paste friendly guide to run a local LLM with GPU support via **Ollama**, expose it to a **FastAPI** backend, and use it from a lightweight **Mermaid** diagram editor frontend (with live syntax highlighting).

---

## ✅ Prerequisites

* NVIDIA GPU with recent drivers
* Docker Engine + docker-compose
* NVIDIA Container Toolkit

**Verify GPU on host**

```bash
nvidia-smi
```

**Verify GPU inside Docker**

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

---

## 🧰 Install NVIDIA Container Toolkit (Linux quick path)

```bash
# Add key
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit.gpg

# Add repo
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
sed "s#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit.gpg] https://#g" | \
sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Wire Docker runtime and restart daemon
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

> If your distro isn’t recognized by the NVIDIA repo helper, map to the closest supported version (e.g., `ubuntu22.04`).

---

## 🧩 Project Overview

* **Ollama (GPU)** – serves a local LLM (`mistral:7b-instruct-v0.2-q4_0` by default).
* **FastAPI backend** – `POST /generate-diagram` → calls Ollama and returns `mermaid_code`.
* **Frontend** – HTML/JS app with **Prism Live** editor and **Mermaid.js** preview.

**File layout**

```
.
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   └── static/
│       ├── js/main.js
│       └── css/style.css
├── docker-compose.yml
└── .dockerignore
```

---

## 🚀 Start the Stack

```bash
docker-compose up -d
docker exec -it ollama_llm ollama pull mistral:7b-instruct-v0.2-q4_0
```

Open the app: **[http://localhost:3000](http://localhost:3000)**

---

## 🧠 Prompting Rules for Mermaid (Flowchart)

Use these constraints to avoid parse errors:

* Start with `graph TD` or `flowchart TD`.
* Node shapes **must not contain quotes or commas** inside the shape brackets. Prefer:

  * `id[Text]`, `id(Title)`, `id((Circle))`, `id[(DB)]`, `id[[Subroutine]]`
* Edge labels: `A -- Label --> B`
* Return **only** a fenced block:

````md
```mermaid
<code>
```
````

> The backend includes a small sanitizer to fix common mistakes (extra `)`, quotes/commas inside shapes, missing header).

---

## 🔄 Switching Models (Global & Per-Request)

### 1) Global model (environment variable)

Set `OLLAMA_MODEL` for the backend in `docker-compose.yml`:

```yaml
environment:
  - OLLAMA_HOST=http://ollama:11434
  - OLLAMA_MODEL=mistral:7b-instruct-v0.2-q4_0
```

Apply:

```bash
docker-compose restart backend
```

### 2) Per-request model (API parameter)

Extend the request body with `model`:

```json
{ "text": "…", "type": "flowchart", "model": "llama3:8b-instruct-q4_0" }
```

Backend snippet:

```python
class DiagramRequest(BaseModel):
    text: str
    type: str | None = None
    model: str | None = None  # optional override

model = req.model or os.getenv("OLLAMA_MODEL", "mistral:7b-instruct-v0.2-q4_0")
requests.post(f"{OLLAMA_HOST}/api/generate",
              json={"model": model, "prompt": prompt, "stream": False},
              timeout=120)
```

> This enables a UI dropdown to pick a model on the fly.

---

## ➕ Adding / Managing Models in Ollama

**List installed**

```bash
docker exec -it ollama_llm ollama list
```

**Pull a new one**

```bash
docker exec -it ollama_llm ollama pull llama3:8b-instruct-q4_0
```

**Remove**

```bash
docker exec -it ollama_llm ollama rm llama3:8b-instruct-q4_0
```

**Where models live**
They’re stored in the Ollama volume mounted at `/root/.ollama`. After a successful pull, you can switch to the model immediately (globally or per request).

---

## 🧭 Using the App

1. Enter a description in **“Input text”**.
2. Select **Diagram type** (Flowchart/Sequence/…).
3. Click **Generate diagram**.
4. Tweak the Mermaid code in the live editor; preview updates automatically.
5. **Export as PNG** if needed.

---

## 🩺 Troubleshooting

**Mermaid parse error**

* Most common: quotes/commas inside node shapes or extra `)` at line end.
* Prefer `id[Text]` for labels.
* Ensure header: `flowchart TD` (or correct header for your type).

**Backend 500 / Extra data**

* Ensure backend uses `"stream": false` with Ollama’s `/api/generate` (single JSON document).

**No GPU in containers**

* Re-check toolkit install; confirm `docker run --rm --gpus all ... nvidia-smi` works.
* Ensure Docker daemon uses NVIDIA runtime (via `nvidia-ctk runtime configure`).

**CORS / connectivity**

* Backend should be reachable at `http://localhost:8000`.
* Check browser console for network errors.

---

## ✅ Sanity Checklist

* `nvidia-smi` works on host **and** in CUDA container.
* `ollama pull <model>` completes successfully.
* `POST /generate-diagram` returns `{ mermaid_code: "..." }`.
* Frontend shows highlighted code + live diagram.
* Model switching (env or per-request) behaves as expected.

---

## 📎 Handy Commands

**Restart services**

```bash
docker-compose restart ollama backend frontend
```

**Tail backend logs**

```bash
docker logs -f backend
```

**Test backend quickly**

```bash
curl -X POST http://localhost:8000/generate-diagram \
  -H "Content-Type: application/json" \
  -d '{"text":"Користувач входить. Система перевіряє облікові дані.","type":"flowchart"}'
```

---

> 🟩 Tip: keep a couple of few-shot examples in the backend prompt (good/bad Mermaid), and add a small “repair pass” that normalizes quotes, enforces `flowchart TD`, and converts problematic shapes to `id[Text]`. This combination dramatically reduces parse errors without sacrificing model flexibility.
