// js/saveTools.js — player-controlled save export/import for device changes
// and recovery. The game still autosaves normally; these are optional tools.

const SAVE_KEY = "neonAlley_save_v1";
const BACKUP_KEY = "neonAlley_save_backup_v1";
const FILE_NAME = "neon-alley-save.json";

function toast(message, duration = 2400) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), duration);
}

function validSave(data) {
  return !!data
    && typeof data === "object"
    && !Array.isArray(data)
    && ["money", "frags", "crew", "stats", "settings"].some((key) => key in data);
}

function currentSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validSave(parsed) ? { raw, parsed } : null;
  } catch {
    return null;
  }
}

async function exportSave() {
  const save = currentSave();
  if (!save) return toast("KEIN GÜLTIGER SAVE GEFUNDEN.");

  const pretty = JSON.stringify(save.parsed, null, 2);

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(pretty);
      toast("SAVE IN DIE ZWISCHENABLAGE KOPIERT.");
      return;
    }
  } catch {}

  try {
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("SAVE-DATEI ERSTELLT.");
  } catch {
    toast("SAVE-EXPORT FEHLGESCHLAGEN.");
  }
}

function importSaveFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!validSave(parsed)) throw new Error("invalid save");

      const old = localStorage.getItem(SAVE_KEY);
      if (old) localStorage.setItem(BACKUP_KEY, old);
      localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));

      toast("SAVE IMPORTIERT — NEUSTART…", 1200);
      setTimeout(() => location.reload(), 700);
    } catch {
      toast("UNGÜLTIGE SAVE-DATEI.", 3200);
    }
  };

  reader.onerror = () => toast("SAVE-DATEI KONNTE NICHT GELESEN WERDEN.");
  reader.readAsText(file);
}

function detectBuildVersion() {
  const entry = [...document.scripts].find((script) => /js\/core\.js/.test(script.src));
  if (!entry) return "DEV";
  try {
    return new URL(entry.src).searchParams.get("v") || "DEV";
  } catch {
    return "DEV";
  }
}

function init() {
  const pauseStack = document.querySelector("#pauseMenu .row");
  if (!pauseStack || document.getElementById("btnExportSave")) return;

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.id = "btnExportSave";
  exportButton.className = "btn small";
  exportButton.textContent = "SAVE EXPORTIEREN";
  exportButton.addEventListener("click", exportSave);

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.id = "btnImportSave";
  importButton.className = "btn small";
  importButton.textContent = "SAVE IMPORTIEREN";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.hidden = true;
  input.setAttribute("aria-label", "NEON ALLEY Save-Datei auswählen");
  input.addEventListener("change", () => {
    importSaveFile(input.files?.[0]);
    input.value = "";
  });
  importButton.addEventListener("click", () => input.click());

  const version = document.createElement("div");
  version.className = "muted small";
  version.style.textAlign = "center";
  version.style.paddingTop = "4px";
  version.textContent = `BUILD ${detectBuildVersion()}`;

  pauseStack.append(exportButton, importButton, input, version);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
