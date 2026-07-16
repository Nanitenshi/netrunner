import { test, expect } from "@playwright/test";

const SAVE_KEY = "neonAlley_save_v1";

function makeSave({ missionsDone = 0, dives = 0, dumps = 0, bestLayer = 0 } = {}) {
  return {
    _saveVersion: 2,
    money: 0,
    heat: 0,
    frags: 40,
    psychosis: 0,
    build: null,
    skillLevels: {},
    programsOwned: { panic: 0, boost: 0, decoy: 0 },
    district: 7,
    dayClock: 0,
    missionsDone,
    upgrades: { buffer: 0, amplifier: 0, pulse: 0 },
    crew: { roster: { juno: 1 }, equipped: ["juno"], pity: 0 },
    daily: { date: "", done: false, npcs: {}, lootTaken: {} },
    stats: {
      bestLayer,
      dives,
      dumps,
      voidAnnounced: false,
      voidCompleted: false,
      psychosisWarned: false
    },
    buffs: { traceCut: 0, lootBonus: 1, traceMultCut: 1, gearDiscount: 0 },
    storyStage: {},
    tutorialDone: true,
    tutorialStep: 99,
    settings: { quality: "perf", autosave: true, music: false },
    storyLog: []
  };
}

async function openGame(page, save = makeSave()) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));

  await page.addInitScript(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: save });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#btnStart")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__NEON?.game))).toBe(true);

  return pageErrors;
}

async function enterWorld(page) {
  await page.locator("#btnStart").tap();
  await expect.poll(() => page.evaluate(() => window.__NEON?.game?.mode)).toBe("WORLD");
  await expect(page.locator("#hudTop")).toBeVisible();
  await expect(page.locator("#bottomBar")).toBeVisible();
}

async function waitForOnboarding(page) {
  await expect.poll(() => page.evaluate(() => Boolean(
    window.__NEON_ONBOARDING?.stage
    && window.__NEON_PRIMARY_GOAL?.sync
  ))).toBe(true);
}

async function visiblePrimaryActions(page) {
  return page.evaluate(() => ["hudGoal", "btnDiveNow"].filter((id) => {
    const element = document.getElementById(id);
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || 1) > 0
      && rect.width > 0
      && rect.height > 0;
  }).length);
}

test("bootet fehlerfrei und betritt die Stadt", async ({ page }) => {
  const pageErrors = await openGame(page);

  await enterWorld(page);

  await expect(page.locator("#title")).toBeHidden();
  await page.waitForTimeout(250);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("zeigt unterwegs nur AUFTRAG und am Terminal nur DIVE", async ({ page }) => {
  const pageErrors = await openGame(page);

  await enterWorld(page);
  await waitForOnboarding(page);

  await expect(page.locator("#onboardingTask")).toBeHidden();
  await expect(page.locator("#hudGoal")).toBeVisible();
  await expect(page.locator("#hudGoal")).toHaveAttribute(
    "data-primary-label",
    "ERSTER JOB · ZUM CACHE POP TERMINAL"
  );
  await expect.poll(() => visiblePrimaryActions(page)).toBe(1);

  await page.locator("#hudGoal").tap();

  await expect(page.locator("#btnDiveNow")).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("#hudGoal")).toBeHidden();
  await expect.poll(() => visiblePrimaryActions(page)).toBe(1);

  await page.locator("#btnDiveNow").tap();
  await expect.poll(() => page.evaluate(() => window.__NEON?.game?.mode)).toBe("MISSION");
  await expect(page.locator("#missionHud")).toBeVisible();

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("behandelt alte Saves mit missionsDone nicht wieder als Anfänger", async ({ page }) => {
  const pageErrors = await openGame(page, makeSave({
    missionsDone: 3,
    dives: 0,
    dumps: 0,
    bestLayer: 3
  }));

  await enterWorld(page);
  await waitForOnboarding(page);

  await expect.poll(() => page.evaluate(() => window.__NEON_ONBOARDING.stage())).toBe(3);
  await expect(page.locator("#hudGoal")).toHaveAttribute(
    "data-primary-label",
    "SKILLS ÖFFNEN · FRAGS INVESTIEREN"
  );

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("Mind Sweeper gibt Denkzeit und beendet genau einmal", async ({ page }) => {
  const pageErrors = await openGame(page);

  const result = await page.evaluate(async () => {
    const { createMinigame } = await import("/js/missions.js");
    const mods = {
      lootMult: 1,
      traceMult: 1,
      timeBonus: 0,
      peekBonus: 0,
      ringScale: 1,
      salvage: 0,
      fragsPerLayer: 0,
      startTrace: 0,
      forgive: 0,
      revive: 0,
      bossTraceBonus: 0,
      programDiscount: 0
    };

    const timerReports = [];
    const timerGame = createMinigame("sweep", {
      diff: 0.35,
      mods,
      timeMult: 1,
      corrupt: false
    });
    timerGame.start();
    timerGame.tick(5, false, (report) => timerReports.push(report));

    const timerBeforeTap = timerGame.debug.timer;
    const timerCell = timerGame.debug.cells.find((cell) => !cell.trap && cell.count > 0)
      || timerGame.debug.cells.find((cell) => !cell.trap);
    if (!timerCell) throw new Error("Mind Sweeper erzeugte kein sicheres Feld.");

    const canvasRect = document.getElementById("missionCanvas").getBoundingClientRect();
    timerGame.pointer("down", {
      clientX: canvasRect.left + timerCell.x,
      clientY: canvasRect.top + timerCell.y
    });
    timerGame.tick(1, false, (report) => timerReports.push(report));

    const timerAfterTap = timerGame.debug.timer;
    const timeLimit = timerGame.debug.timeLimit;

    const solveReports = [];
    const solveGame = createMinigame("sweep", {
      diff: 0.2,
      mods,
      timeMult: 1,
      corrupt: false
    });
    solveGame.start();

    let guard = 0;
    while (!solveGame.debug.solved && guard < 100) {
      guard += 1;
      const cell = solveGame.debug.cells.find((candidate) => !candidate.trap && !candidate.revealed);
      if (!cell) break;

      solveGame.pointer("down", {
        clientX: canvasRect.left + cell.x,
        clientY: canvasRect.top + cell.y
      });
      solveGame.tick(0.016, false, (report) => solveReports.push(report));
    }

    for (let i = 0; i < 5; i += 1) {
      solveGame.tick(0.016, false, (report) => solveReports.push(report));
    }

    return {
      timerBeforeTap,
      timerAfterTap,
      timeLimit,
      solved: solveGame.debug.solved,
      remaining: solveGame.debug.remaining,
      solveReports,
      guard
    };
  });

  expect(result.timerBeforeTap).toBe(0);
  expect(result.timerAfterTap).toBeGreaterThan(0);
  expect(result.timeLimit).toBeGreaterThanOrEqual(28);
  expect(result.solved).toBe(true);
  expect(result.remaining).toBe(0);
  expect(result.guard).toBeLessThan(100);
  expect(result.solveReports).toHaveLength(1);
  expect(result.solveReports[0].success).toBe(true);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("alle Minigame-Fabriken starten und melden ein Ende höchstens einmal", async ({ page }) => {
  const pageErrors = await openGame(page);

  const results = await page.evaluate(async () => {
    const { createMinigame, MG_TYPES } = await import("/js/missions.js");
    const types = [...MG_TYPES, "boss_mini", "boss_big"];
    const mods = {
      lootMult: 1,
      traceMult: 1,
      timeBonus: 0,
      peekBonus: 0,
      ringScale: 1,
      salvage: 0,
      fragsPerLayer: 0,
      startTrace: 0,
      forgive: 0,
      revive: 0,
      bossTraceBonus: 0,
      programDiscount: 0
    };

    return types.map((type) => {
      const reports = [];
      const minigame = createMinigame(type, {
        diff: 0.3,
        mods,
        timeMult: 1,
        corrupt: false
      });

      minigame.start();
      minigame.addTime?.(-10_000);

      for (let i = 0; i < 320 && reports.length === 0; i += 1) {
        minigame.tick(1, false, (report) => reports.push(report));
      }
      for (let i = 0; i < 5; i += 1) {
        minigame.tick(1, false, (report) => reports.push(report));
      }

      return {
        type,
        name: minigame.name,
        reports
      };
    });
  });

  for (const result of results) {
    expect(result.name, `${result.type} hat keinen Namen`).toBeTruthy();
    expect(result.reports, `${result.type} meldete kein oder mehrfaches Ende`).toHaveLength(1);
  }
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});
