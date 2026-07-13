// js/crewOverlayMobile.js — Mobile Positionierung des CREW-/Shop-Menüs.
// Lange Tabs (SKILLS, CREW, GEAR) dürfen das Ressourcen-HUD nicht überdecken.

const STYLE_ID = "crew-overlay-mobile-layout";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 900px) {
      #crewOverlay {
        align-items: flex-start;
        justify-content: center;
        padding: var(--crew-overlay-top, 128px) 20px var(--bottomBarSpace, 120px);
      }

      #crewOverlay > .overlayCard {
        min-height: 0;
        max-height: calc(100vh - var(--crew-overlay-top, 128px) - var(--bottomBarSpace, 120px) - 12px);
      }

      /* Das echte HUD bleibt über dem Menü sichtbar; keine zweite Geldanzeige. */
      #crewOverlay #shopWallet {
        display: none !important;
      }
    }

    @media (max-width: 900px) and (height: 100dvh) {
      #crewOverlay > .overlayCard {
        max-height: calc(100dvh - var(--crew-overlay-top, 128px) - var(--bottomBarSpace, 120px) - 12px);
      }
    }
  `;
  document.head.appendChild(style);
}

function syncOverlayTop() {
  const app = document.getElementById("app");
  const overlay = document.getElementById("crewOverlay");
  const hudStats = document.querySelector("#hudTop .hudStats");
  if (!app || !overlay || !hudStats) return;

  const appRect = app.getBoundingClientRect();
  const statsRect = hudStats.getBoundingClientRect();
  const top = Math.max(12, Math.ceil(statsRect.bottom - appRect.top + 8));
  overlay.style.setProperty("--crew-overlay-top", `${top}px`);
}

function initCrewOverlayMobileLayout() {
  installStyles();
  syncOverlayTop();

  const overlay = document.getElementById("crewOverlay");
  const hudStats = document.querySelector("#hudTop .hudStats");

  window.addEventListener("resize", syncOverlayTop, { passive: true });
  window.addEventListener("orientationchange", syncOverlayTop, { passive: true });

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(syncOverlayTop);
    if (hudStats) resizeObserver.observe(hudStats);
  }

  if (overlay && typeof MutationObserver !== "undefined") {
    const mutationObserver = new MutationObserver(() => {
      if (!overlay.classList.contains("hidden")) {
        requestAnimationFrame(syncOverlayTop);
      }
    });
    mutationObserver.observe(overlay, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCrewOverlayMobileLayout, { once: true });
} else {
  initCrewOverlayMobileLayout();
}
