# LLM-Powered Mermaid Diagram Editor (POC)

Proof of Concept веб-додаток для генерації та редагування **Mermaid**-діаграм за допомогою локальної LLM (**Ollama**) і бекенда на **FastAPI**.  
Фронтенд — легкий HTML/JS з **Prism Live** (редактор з підсвіткою) і **Mermaid.js**.

## ✨ Можливості
- Введіть довільний текст — LLM перетворить його у Mermaid-код.
- Режим редагування з live-підсвіткою (Prism Live).
- Прев’ю діаграми в реальному часі (Mermaid.js).
- Експорт діаграми у PNG.
- Вибір типу діаграми (Flowchart/Sequence/…).
- GPU-акселерація через NVIDIA Container Toolkit.

## 📦 Стек
- **Ollama** (`mistral:7b-instruct-v0.2-q4_0` за замовчанням)
- **FastAPI** + `requests`
- **Mermaid.js 10.x**
- **Prism Live** (contenteditable редактор)
- **Docker Compose**

## 🚀 Запуск
```bash
docker-compose up -d
docker exec -it ollama_llm ollama pull mistral:7b-instruct-v0.2-q4_0
```

## 🔧 Налаштування моделі

Бекенд читає модель зі змінної:
```
OLLAMA_MODEL=mistral:7b-instruct-v0.2-q4_0
```

Змініть у docker-compose.yml → перезапустіть backend.

## 🧭 Використання

Введіть текст у полі вводу.

Оберіть тип діаграми (за замовчанням — Flowchart).

Натисніть Згенерувати діаграму.

За потреби відредагуйте код у редакторі (права панель).

Натисніть Експортувати як PNG для збереження.

## 🛡️ Якість коду Mermaid

Щоб уникати синтаксичних помилок:

У flowchart використовуйте graph TD/flowchart TD.

Форми вузлів без лапок/ком у дужках:

id[Текст], id(Текст), id((Текст)), id[(Текст)], id[[Текст]]

Лейбли ребер: A -- Лейбл --> B

Бекенд має авто-санітайзер, який виправляє типові похибки (лапки/коми/зайві )).

## 🧪 Перевірка GPU

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

## 🩺 Troubleshooting

Mermaid Parse error → перевірте форми вузлів, лапки, коми, зайві дужки; або оновіть авто-санітизацію.

Frontend не підключається → перевірити що бекенд на http://localhost:8000.

Ollama без GPU → перевірити NVIDIA Container Toolkit та --gpus all.

📄 Ліцензія

POC; використання для демо/освіти.