const $ = id => document.getElementById(id);
const KEY = "flowforge.promptQueue";
let prompts = [];

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

async function persist() {
  await chrome.storage.local.set({ [KEY]: prompts });
  render();
}

function render() {
  $("count").textContent = prompts.length;
  $("empty").hidden = prompts.length > 0;
  $("queue").replaceChildren();
  prompts.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "queue-card";
    const meta = document.createElement("div");
    meta.className = "meta";
    const label = document.createElement("span");
    label.textContent = "PROMPT " + String(index + 1).padStart(2, "0");
    const date = document.createElement("span");
    date.textContent = new Date(item.createdAt).toLocaleDateString();
    meta.append(label, date);
    const content = document.createElement("p");
    content.textContent = item.text;
    const actions = document.createElement("div");
    actions.className = "actions";
    const action = (name, fn, danger = false) => {
      const button = document.createElement("button");
      button.textContent = name;
      if (danger) button.classList.add("delete");
      button.addEventListener("click", fn);
      actions.append(button);
    };
    action("Copy", async () => { await navigator.clipboard.writeText(item.text); notify("Prompt copied"); });
    action("Move ↑", async () => { if (!index) return; [prompts[index - 1], prompts[index]] = [prompts[index], prompts[index - 1]]; await persist(); });
    action("Move ↓", async () => { if (index === prompts.length - 1) return; [prompts[index + 1], prompts[index]] = [prompts[index], prompts[index + 1]]; await persist(); });
    action("Delete", async () => { prompts.splice(index, 1); await persist(); notify("Prompt deleted"); }, true);
    card.append(meta, content, actions);
    $("queue").append(card);
  });
}

$("prompt").addEventListener("input", () => { $("chars").textContent = $("prompt").value.length.toLocaleString() + " characters"; });
$("add").addEventListener("click", async () => {
  const text = $("prompt").value.trim();
  if (!text) return notify("Write a prompt first");
  prompts.unshift({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() });
  $("prompt").value = "";
  $("chars").textContent = "0 characters";
  await persist();
  notify("Added to your local queue");
});
$("clear").addEventListener("click", async () => {
  if (!prompts.length || !confirm("Delete every saved prompt from this device?")) return;
  prompts = [];
  await persist();
  notify("Queue cleared");
});
$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ format: "flowforge-queue", version: 1, prompts }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "flowforge-prompts.json";
  link.click();
  URL.revokeObjectURL(url);
});
$("import").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.prompts;
    if (!Array.isArray(incoming) || incoming.some(item => typeof item?.text !== "string")) throw new Error("Invalid prompt queue file");
    const normalized = incoming.map(item => ({ id: crypto.randomUUID(), text: item.text.trim(), createdAt: item.createdAt || new Date().toISOString() })).filter(item => item.text);
    prompts = [...normalized, ...prompts];
    await persist();
    notify("Imported " + normalized.length + " prompts");
  } catch (error) {
    notify(error.message || "Import failed");
  } finally {
    event.target.value = "";
  }
});
$("open").addEventListener("click", () => chrome.tabs.create({ url: "https://flow.google.com/" }));
chrome.storage.local.get(KEY).then(data => {
  prompts = Array.isArray(data[KEY]) ? data[KEY] : [];
  render();
}).catch(error => notify(error.message));