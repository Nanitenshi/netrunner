import { game } from "./core.js";
import { getNodes, getSelected, selectNode, toggleZoom } from "./world.js";
import { handleChoice } from "./npc.js";
import { saveNow } from "./save.js";
import { getMissionState, startMission } from "./missions.js";

let api = null;
let toastTimer = null;

// Cache für DOM Updates (spart Performance im uiTick Loop)
const lastRendered = {
  money: -1,
  heat: -1,
  frags: -1,
  district: -1,
  timeLabel: "",
  mObj: "",
  mTime: -1,
  mScore: -1,
  mAbility: ""
};

// Cachen der DOM Elemente ist viel schneller als jedes Mal document.getElementById aufzurufen
const els = {};
function $(id) { 
  if (!els[id]) els[id] = document.getElementById(id);
  return els[id];
}

export function initUI(_api) {
  api = _api;

  // --- OVERWORLD PANELS ---
  $("btnToggleUI").addEventListener("click", () => {
    $("leftPanel").classList.toggle("hidden");
    $("rightPanel").classList.toggle("hidden");
  });

  // Action Button unten links
  $("btnInteract").addEventListener("click", () => {
    const n = getSelected();
    if (!n) return;
    
    if (n.type === "mission" || n.type === "boss") {
      api.setMode("MISSION");
      startMission();
      saveNow();
    } else {
      toast("Intel gathered. Nothing to hack here.");
    }
  });

  // --- SHOP ---
  $("btnShop").addEventListener("click", () => {
    renderShop();
    // Falls du <dialog> HTML5 nutzt, wäre das: $("shopPanel").showModal();
    $("shopPanel").classList.remove("hidden"); 
  });
  
  const closeShop = () => {
    // Falls du <dialog> nutzt: $("shopPanel").close();
    $("shopPanel").classList.add("hidden");
    saveNow();
  };
  $("btnCloseShop").addEventListener("click", closeShop);
  $("btnShopClose2").addEventListener("click", closeShop);

  // --- DIALOG ---
  $("btnCloseDialog").addEventListener("click", () => {
    $("rightPanel").classList.add("hidden");
    $("leftPanel").classList.remove("hidden");
  });

  // --- RESULT SCREEN ---
  $("btnBackToWorld").addEventListener("click", () => {
    api.setMode("WORLD");
    toast("Back in the alley.");
  });

  $("btnChain").addEventListener("click", () => {
    // Risiko eingehen: Mehr Heat
    game.heat = Math.min(100, game.heat + 15);
    api.setMode("MISSION");
    startMission();
    toast("CHAINING... HEAT SPIKE DETECTED.", true);
    saveNow();
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (game.mode !== "WORLD") return;
    if (e.key === "z") toggleZoom();
  });
}

// --- NPC & DIALOG ---
export function setNpcUI(dialog) {
  $("rightPanel").classList.remove("hidden");
  $("leftPanel").classList.remove("hidden");

  $("npcName").textContent = dialog.npcName;
  $("npcRole").textContent = dialog.role;
  
  // Text sauber formatieren (mit HTML Linebreaks)
  $("dialogText").innerHTML = dialog.lines.join("<br><br>");

  const wrap = $("dialogChoices");
  wrap.innerHTML = "";
  
  dialog.choices.forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = ch.label;
    
    btn.addEventListener("click", () => {
      // Mission Start Logik
      if (ch.id === "START") {
        const n = getSelected();
        if (n && (n.type === "mission" || n.type === "boss")) {
          api.setMode("MISSION");
          startMission();
          saveNow();
        } else {
          toast("Signal lost. Cannot jack in.");
        }
        return;
      }

      // Andere Logik (Gossip, Bargain, Retreat)
      const result = handleChoice(ch.id);
      if (result.action === "TOAST") toast(result.text);
      
      addArchive(`[${dialog.npcName}] ${ch.label} -> ${result.text || "Confirmed"}`);
      saveNow();
    });
    
    wrap.appendChild(btn);
  });
}

export function updateNodeList(nodes) {
  const list = $("nodeList");
  list.innerHTML = "";
  
  nodes.forEach(n => {
    const div = document.createElement("div");
    div.className = "nodeCard" + (game.selectedNodeId === n.id ? " active" : "");
    
    let badge = "mission";
    if (n.type === "npc") badge = "npc";
    if (n.type === "boss") badge = "boss";
    
    div.innerHTML = `
      <div>
        <div class="name">${n.name}</div>
        <div class="meta">${n.tag}</div>
      </div>
      <div>
        <span class="badge ${badge}">${n.type.toUpperCase()}</span>
      </div>
    `;
    
    div.addEventListener("click", () => selectNode(n.id));
    list.appendChild(div);
  });
}

// --- SHOP RENDERING ---
function renderShop() {
  const list = $("shopList");
  list.innerHTML = "";

  const items = [
    { id: "buffer", title: "NEURAL BUFFER", desc: "+2s mission timer per level", cost: 180, max: 5 },
    { id: "amplifier", title: "SIGNAL AMPLIFIER", desc: "Larger hit radius on nodes", cost: 240, max: 5 },
    { id: "pulse", title: "PULSE OVERCLOCK", desc: "Tap top-left in mission: slow time 3s", cost: 650, max: 1 }
  ];

  items.forEach(it => {
    const lvl = game.upgrades[it.id] || 0;
    const cost = Math.floor(it.cost * Math.pow(1.6, lvl));
    const maxed = lvl >= it.max;
    
    const row = document.createElement("div");
    row.className = "shopItem";
    row.innerHTML = `
      <div>
        <div class="t">${it.title}</div>
        <div class="d">${it.desc}</div>
        <div class="lvl">LVL: ${lvl} / ${it.max}</div>
      </div>
      <div style="text-align:right">
        <div class="muted small">COST</div>
        <div style="font-weight:900; color: ${maxed ? 'var(--muted)' : 'var(--cyan)'}">
          ${maxed ? 'MAXED' : 'E$ ' + cost}
        </div>
        <button type="button" class="btn small ${maxed ? 'pink' : ''}" ${maxed ? 'disabled' : ''}>
          ${maxed ? 'MAX' : 'BUY'}
        </button>
      </div>
    `;
    
    if (!maxed) {
      row.querySelector("button").addEventListener("click", () => {
        if (game.money < cost) {
          toast("INSUFFICIENT FUNDS.", true);
          return;
        }
        game.money -= cost;
        game.upgrades[it.id] = lvl + 1;
        toast(`UPGRADE INSTALLED: ${it.title}`);
        renderShop(); // Re-Render to update costs
        saveNow();
      });
    }
    
    list.appendChild(row);
  });
}

// --- HELPERS ---
export function addArchive(text) {
  const wrap = $("storyArchive");
  const div = document.createElement("div");
  div.className = "archRow";
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.textContent = `[${time}] ${text}`;
  wrap.prepend(div);
}

export function toast(msg, isWarning = false) {
  const t = $("toast");
  t.textContent = msg;
  t.style.borderColor = isWarning ? "var(--pink)" : "var(--cyan)";
  t.style.color = isWarning ? "var(--pink)" : "white";
  t.classList.remove("hidden");
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2000);
}

// Wird von core.js aufgerufen, WENN die Mission endet
export function showMissionResult(result) {
  $("resultText").textContent = result.win
    ? `SUCCESS // ${result.type} // Objective ${result.objective}/${result.objectiveMax}`
    : `FAILED // ${result.type} // Objective ${result.objective}/${result.objectiveMax}`;
    
  $("rPay").textContent = "E$ " + result.pay;
  $("rFrags").textContent = "+" + result.fragGain;
  $("rHeat").textContent = "+" + result.heatGain + "%";
  $("rStory").textContent = result.storyTag;
}

// --- 60 FPS RENDER LOOP ---
export function uiTick() {
  if (game.mode === "TITLE") return;

  // 1. TOP HUD (Nur updaten wenn sich Werte ändern)
  if (lastRendered.money !== game.money) {
    $("hudMoney").textContent = "E$ " + game.money;
    lastRendered.money = game.money;
  }
  
  if (lastRendered.heat !== game.heat) {
    $("hudHeat").textContent = game.heat + "%";
    // Visuelles Warnsignal wenn Heat hoch ist
    $("hudHeat").style.color = game.heat > 80 ? "var(--pink)" : "var(--text)";
    lastRendered.heat = game.heat;
  }
  
  if (lastRendered.frags !== game.frags) {
    $("hudFrags").textContent = game.frags;
    lastRendered.frags = game.frags;
  }
  
  if (lastRendered.district !== game.district) {
    $("hudDistrict").textContent = "Sector-" + String(game.district).padStart(2, "0");
    lastRendered.district = game.district;
  }

  const p = game.globalProgress;
  let timeLabel = "DAY";
  if (p > 0.35 && p <= 0.7) timeLabel = "SUNSET";
  if (p > 0.7) timeLabel = "NIGHT";
  
  if (lastRendered.timeLabel !== timeLabel) {
    $("hudTime").textContent = timeLabel;
    lastRendered.timeLabel = timeLabel;
  }

  // 2. MISSION HUD (Wird jeden Frame gebraucht wegen des Timers)
  if (game.mode === "MISSION") {
    const ms = getMissionState();
    if (ms) {
      // Typ statisch setzen, ändert sich nicht
      if (lastRendered.mType !== ms.type) {
        $("mType").textContent = ms.type;
        lastRendered.mType = ms.type;
      }
      
      const objText = `${ms.objective}/${ms.objectiveMax}`;
      if (lastRendered.mObj !== objText) {
        $("mObj").textContent = objText;
        lastRendered.mObj = objText;
      }

      // Timer (rundet auf 1 Nachkommastelle)
      const timeVal = Math.max(0, ms.t).toFixed(1);
      if (lastRendered.mTime !== timeVal) {
        $("mTimer").textContent = timeVal + "s";
        lastRendered.mTime = timeVal;
        
        // Blink rot wenn unter 5 Sekunden
        if (ms.t < 5 && ms.t > 0) {
          $("mTimerBox").classList.toggle("pink", Math.floor(performance.now() / 200) % 2 === 0);
        } else {
          $("mTimerBox").classList.toggle("pink", ms.t < 5);
        }
      }

      if (lastRendered.mScore !== ms.score) {
        $("mScore").textContent = ms.score;
        lastRendered.mScore = ms.score;
      }

      const abilityText = game.upgrades.pulse > 0 ? (ms.slowActive ? "PULSE(ON)" : "PULSE(RDY)") : "NONE";
      if (lastRendered.mAbility !== abilityText) {
        $("mAbility").textContent = abilityText;
        lastRendered.mAbility = abilityText;
      }
    }
  }
    }
                                                  
