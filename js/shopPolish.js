// js/shopPolish.js — keeps all shop currencies and affordability states honest.
// Deliberately reads the public debug state instead of importing core.js to
// avoid adding another circular dependency to the module graph.

const PRICE_E = /(\d[\d.,]*)\s*E\$/i;
const PRICE_F = /(\d[\d.,]*)\s*[◆♦]/;
let scheduled = false;

function gameState() {
  return window.__NEON?.game || null;
}

function numberFrom(text) {
  return Number(String(text).replace(/\./g, "").replace(",", ".")) || 0;
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    refreshShop();
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && el.textContent !== String(value)) el.textContent = String(value);
}

function priceForButton(button) {
  const text = button.textContent || "";
  const e = text.match(PRICE_E);
  if (e) return { currency: "money", amount: numberFrom(e[1]), label: "E$" };
  const f = text.match(PRICE_F);
  if (f) return { currency: "frags", amount: numberFrom(f[1]), label: "◆" };
  return null;
}

function enhancePurchaseButton(button, game) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (/\bMAX\b/i.test(button.textContent || "")) return;

  const price = priceForButton(button);
  if (!price) return;

  const balance = Number(game[price.currency]) || 0;
  const missing = Math.max(0, price.amount - balance);
  const unavailable = missing > 0;

  if (button.disabled !== unavailable) button.disabled = unavailable;
  if (button.classList.contains("unaffordable") !== unavailable) {
    button.classList.toggle("unaffordable", unavailable);
  }

  const ariaDisabled = String(unavailable);
  if (button.getAttribute("aria-disabled") !== ariaDisabled) {
    button.setAttribute("aria-disabled", ariaDisabled);
  }

  if (unavailable) {
    const title = `Fehlen: ${missing} ${price.label}`;
    const aria = `${button.textContent}. Es fehlen ${missing} ${price.label}.`;
    if (button.title !== title) button.title = title;
    if (button.getAttribute("aria-label") !== aria) button.setAttribute("aria-label", aria);
  } else {
    if (button.hasAttribute("title")) button.removeAttribute("title");
    if (button.hasAttribute("aria-label")) button.removeAttribute("aria-label");
  }
}

function enhanceTabs() {
  const row = document.querySelector("#crewOverlay .tabRow");
  if (row) row.setAttribute("role", "tablist");

  document.querySelectorAll("#crewOverlay .tabBtn").forEach((button) => {
    const tab = button.dataset.tab;
    const panelId = tab ? `tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}` : "";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(button.classList.contains("active")));
    if (panelId) button.setAttribute("aria-controls", panelId);
  });

  document.querySelectorAll("#crewOverlay .tabPage").forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
  });
}

function refreshShop() {
  const game = gameState();
  const overlay = document.getElementById("crewOverlay");
  if (!game || !overlay) return;

  setText("shopMoney", Math.max(0, Math.round(Number(game.money) || 0)));
  setText("shopFrags", Math.max(0, Math.round(Number(game.frags) || 0)));

  const wallet = document.getElementById("shopWallet");
  if (wallet) {
    const label = `Guthaben: ${Math.round(game.money || 0)} Eddies und ${Math.round(game.frags || 0)} Frags`;
    if (wallet.getAttribute("aria-label") !== label) wallet.setAttribute("aria-label", label);
  }

  overlay.querySelectorAll("button").forEach((button) => enhancePurchaseButton(button, game));
  enhanceTabs();
}

function resetOverlayScroll() {
  const card = document.querySelector("#crewOverlay > .overlayCard");
  if (!card) return;
  try { card.scrollTo({ top: 0, behavior: "auto" }); }
  catch { card.scrollTop = 0; }
}

function init() {
  const overlay = document.getElementById("crewOverlay");
  if (!overlay) return;

  overlay.addEventListener("pointerup", (event) => {
    if (event.target.closest?.(".tabBtn")) {
      requestAnimationFrame(() => {
        resetOverlayScroll();
        refreshShop();
      });
    } else {
      setTimeout(scheduleRefresh, 0);
    }
  }, { passive: true });

  window.addEventListener("neon-save-status", scheduleRefresh);

  // Render functions replace rows/cards, so child-list observation is enough.
  // Avoid attribute observation here: affordability itself changes attributes
  // and would otherwise create a self-triggering observer loop.
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(overlay, { subtree: true, childList: true });

  // __NEON is assigned near the end of boot. Retry briefly without running a
  // permanent timer once the state is available.
  let tries = 0;
  const wait = () => {
    tries += 1;
    if (gameState()) return refreshShop();
    if (tries < 40) setTimeout(wait, 100);
  };
  wait();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
