// js/qualityPass.js — shared UX, accessibility and runtime hardening.

const STYLE_ID = "neon-quality-pass";
const DOUBLE_BOUND_IDS = new Set(["btnStart", "btnBackToCity"]);
let lastPointerTarget = null;
let lastPointerAt = 0;
let saveFailureShown = false;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
    }

    html, body { overscroll-behavior: none; }

    .btn:focus-visible,
    .nodeCard:focus-visible,
    [role="button"]:focus-visible {
      outline: 3px solid rgba(252,238,10,.95);
      outline-offset: 3px;
      box-shadow: 0 0 0 2px rgba(5,9,14,.95), 0 0 22px rgba(252,238,10,.35);
    }

    .btn:disabled,
    .btn.unaffordable {
      opacity: .42;
      filter: grayscale(.7);
      cursor: not-allowed;
      box-shadow: none;
      transform: none !important;
    }

    .toast {
      width: max-content;
      max-width: min(540px, calc(100vw - 32px));
      white-space: normal;
      text-align: center;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .overlayCard {
      scrollbar-width: thin;
      scrollbar-color: rgba(0,243,255,.45) rgba(0,0,0,.15);
    }

    .overlayCard::-webkit-scrollbar { width: 7px; }
    .overlayCard::-webkit-scrollbar-track { background: rgba(0,0,0,.15); }
    .overlayCard::-webkit-scrollbar-thumb {
      background: rgba(0,243,255,.4);
      border-radius: 999px;
    }

    .fatalRuntimeError {
      position: absolute;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: auto;
      background: rgba(2,4,8,.88);
      backdrop-filter: blur(8px);
    }

    .fatalRuntimeError > div {
      width: min(520px, 94vw);
      padding: 20px;
      border: 1px solid rgba(255,0,124,.55);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(16,12,22,.98), rgba(5,8,14,.98));
      box-shadow: 0 0 36px rgba(255,0,124,.24);
      text-align: left;
    }

    @media (max-width: 900px) {
      .btn, .nodeCard { min-height: 44px; }
      .btn.small { min-height: 42px; }

      .overlayCard {
        width: min(720px, 96vw);
        padding: 18px;
      }

      .muted.small,
      .gearRow .meta,
      .charCard .meta,
      .pullCard .meta,
      .perkText {
        font-size: 12px;
        line-height: 1.45;
      }

      .gearRow {
        align-items: stretch;
      }

      .gearRow > .btn {
        flex: 0 0 auto;
        min-width: 132px;
      }
    }

    @media (max-width: 520px) {
      .gearRow {
        flex-direction: column;
      }

      .gearRow > .btn {
        width: 100%;
        min-width: 0;
      }

      .crewGrid {
        grid-template-columns: 1fr;
      }

      .charCard, .pullCard { padding: 12px; }
      .tabRow { gap: 7px; }
    }

    @media (max-height: 650px) {
      .overlayCard { padding-top: 14px; padding-bottom: 14px; }
      .tabRow { margin-bottom: 8px; }
      .centerWrap { padding-top: 12px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        scroll-behavior: auto !important;
        animation-duration: .001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
      }
      .scanlines::before { opacity: .16; }
      #worldFxCanvas { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function roleAndLiveRegions() {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
  }

  const comms = document.getElementById("commsTicker");
  if (comms) {
    comms.setAttribute("role", "status");
    comms.setAttribute("aria-live", "polite");
    comms.setAttribute("aria-atomic", "true");
  }

  const goal = document.getElementById("hudGoal");
  if (goal) {
    goal.tabIndex = 0;
    goal.setAttribute("role", "button");
    goal.setAttribute("aria-label", "Zum aktuellen Auftrag navigieren");
  }

  const world = document.getElementById("worldCanvas");
  if (world) {
    world.setAttribute("role", "application");
    world.setAttribute("aria-label", "Interaktive Karte von Night City. Tippen bewegt den Runner, Wischen verschiebt die Kamera.");
  }

  const mission = document.getElementById("missionCanvas");
  if (mission) {
    mission.setAttribute("role", "application");
    mission.setAttribute("aria-label", "Aktives Hacking-Minispiel");
  }
}

function enhanceInteractive(root = document) {
  root.querySelectorAll?.(".nodeCard").forEach((card) => {
    if (card.dataset.keyboardReady) return;
    card.dataset.keyboardReady = "1";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      card.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: "mouse"
      }));
    });
  });
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const crew = document.getElementById("crewOverlay");
      if (crew && !crew.classList.contains("hidden")) {
        document.getElementById("btnCloseCrew")?.click();
        return;
      }

      const pause = document.getElementById("pauseMenu");
      if (pause && !pause.classList.contains("hidden")) {
        document.getElementById("btnResume")?.click();
        return;
      }

      document.getElementById("leftPanel")?.classList.remove("open");
      document.getElementById("rightPanel")?.classList.remove("open");
    }

    if ((event.key === "Enter" || event.key === " ") && document.activeElement?.id === "hudGoal") {
      event.preventDefault();
      document.getElementById("hudGoal")?.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: "mouse"
      }));
    }
  });
}

function bindDuplicateActivationGuard() {
  document.addEventListener("pointerup", (event) => {
    const target = event.target.closest?.("button");
    if (!target || !DOUBLE_BOUND_IDS.has(target.id)) return;
    lastPointerTarget = target;
    lastPointerAt = performance.now();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("button");
    if (!target || target !== lastPointerTarget) return;
    if (performance.now() - lastPointerAt > 650) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

function bindHaptics() {
  if (!("vibrate" in navigator)) return;
  document.addEventListener("pointerup", (event) => {
    if (!event.target.closest?.(".btn, .nodeCard")) return;
    try { navigator.vibrate(7); } catch {}
  }, { passive: true });
}

function showRecoveryMessage(detail) {
  if (detail?.type !== "load" || !detail.recovered) return;
  setTimeout(() => {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = "SAVE WIEDERHERGESTELLT — Backup wurde geladen.";
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3200);
  }, 700);
}

function showSaveFailure(detail) {
  if (detail?.ok !== false || saveFailureShown) return;
  saveFailureShown = true;
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = "⚠ SPEICHERN FEHLGESCHLAGEN — Browser-Speicher prüfen.";
  toast.classList.remove("hidden");
}

function installRuntimeErrorPanel() {
  let recentErrors = [];
  window.addEventListener("error", (event) => {
    const message = String(event.message || "Unbekannter Fehler");
    if (/ResizeObserver loop/i.test(message)) return;

    const now = Date.now();
    recentErrors = recentErrors.filter((time) => now - time < 5000);
    recentErrors.push(now);
    if (recentErrors.length < 2 || document.querySelector(".fatalRuntimeError")) return;

    const panel = document.createElement("section");
    panel.className = "fatalRuntimeError";
    panel.innerHTML = `
      <div>
        <h2 style="margin:0 0 10px;color:var(--pink)">SYSTEMFEHLER</h2>
        <p class="muted" style="line-height:1.5">Das Spiel ist in einen instabilen Zustand geraten. Dein Fortschritt wurde zuletzt automatisch gespeichert.</p>
        <p class="small" style="word-break:break-word;color:#ff9abb"></p>
        <button type="button" class="btn yellow" style="width:100%;margin-top:12px">NEU LADEN</button>
      </div>`;
    panel.querySelector("p.small").textContent = message;
    panel.querySelector("button").addEventListener("click", () => location.reload());
    document.getElementById("ui")?.appendChild(panel);
  });
}

function init() {
  installStyles();
  roleAndLiveRegions();
  bindKeyboard();
  bindDuplicateActivationGuard();
  bindHaptics();
  installRuntimeErrorPanel();
  enhanceInteractive();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) enhanceInteractive(node);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });

  window.addEventListener("neon-save-status", (event) => {
    showRecoveryMessage(event.detail);
    showSaveFailure(event.detail);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
