// js/pwa.js — install/offline lifecycle without blocking game boot.

let refreshing = false;
let installPrompt = null;
const hadControllerAtLoad = !!navigator.serviceWorker?.controller;

function toast(message, duration = 2600) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), duration);
}

function addInstallButton() {
  if (!installPrompt) return;
  const stack = document.querySelector("#pauseMenu .row");
  if (!stack || document.getElementById("btnInstallApp")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "btnInstallApp";
  button.className = "btn small yellow";
  button.textContent = "APP INSTALLIEREN";

  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {}
    installPrompt = null;
    button.remove();
  });

  stack.appendChild(button);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            toast("UPDATE BEREIT — WIRD AKTIVIERT…");
          }
        });
      });
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }, { once: true });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // First installation should not interrupt a running session. Automatic
    // reload is only useful when an older worker was already controlling it.
    if (!hadControllerAtLoad || refreshing) return;
    refreshing = true;
    location.reload();
  });
}

function init() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    addInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    document.getElementById("btnInstallApp")?.remove();
    toast("NEON ALLEY INSTALLIERT.");
  });

  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
