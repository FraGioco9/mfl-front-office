import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Controlled Chromium CSS orientation change on an already hydrated app.
// This is not real device hardware rotation, safe-area, keyboard or Safari touch.
const directory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(directory, "browser-routing-regression.mjs");
const temporaryPath = resolve(directory, ".browser-resp03-orientation.tmp.mjs");
const original = await readFile(sourcePath, "utf8");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(original.includes(marker), "Existing browser CDP hook is missing.");

async function runOrientationRegression(cdp, url, baseline) {
  const planner = new URL(url).pathname === "/planner";
  const evaluate = async (expression) => {
    const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise:true });
    if (response?.exceptionDetails) throw new Error("RESP-03 Chrome JavaScript exception: " + JSON.stringify(response.exceptionDetails));
    return response?.result?.value;
  };
  const snapshot = () => evaluate(`(function snapshotDom() {
    const page = location.pathname === "/planner" ? "planner" : "player";
    const bounds = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const r = node.getBoundingClientRect();
      return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height };
    };
    const pitch = bounds(page === "planner" ? ".plannerPitch" : "#playerDetail .pitch");
    const gk = bounds(".plannerFormationGoalkeeper .plannerFormationPositionLabel");
    const picker = document.getElementById("plannerDepthPicker");
    const modal = document.getElementById("plannerPlayerModal");
    return {
      page, path:location.pathname, width:innerWidth,height:innerHeight,
      route:location.pathname + location.search,
      club:document.getElementById("plannerTeamId")?.textContent.trim(),
      formation:document.getElementById("plannerFormationSelect")?.value,
      roster:Array.from(document.querySelectorAll("#plannerRosterBody tr[data-player-id]"), row => row.dataset.playerId),
      documentWidth:document.documentElement.clientWidth,
      rootOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hero:bounds(".playerHero"), pitch, gk, main:bounds("#appShell > main"), body:bounds("body"), shell:bounds("#appShell"), gridColumns:getComputedStyle(document.body).gridTemplateColumns, shellWidth:getComputedStyle(document.getElementById("appShell")).width, mobileMedia:matchMedia("(max-width: 900px)").matches, detail:bounds("#playerDetail"), playerPage:bounds("#playerPage"),
      pickerOpen:picker instanceof HTMLElement && !picker.hidden,
      pickerPointer:Boolean(document.getElementById("plannerDepthPickerPointer")),
      pickerBounds:picker instanceof HTMLElement && !picker.hidden ? bounds("#plannerDepthPicker") : null,
      pickerExpanded:document.querySelectorAll('.plannerFormationSlotButton[aria-expanded="true"]').length,
      modalOpen:modal instanceof HTMLElement && !modal.hidden,
      modalBounds:modal instanceof HTMLElement && !modal.hidden ? bounds(".plannerPlayerDialog") : null,
      rosterPresent:Boolean(document.querySelector("#plannerRosterBody tr[data-player-id]"))
    };
  })()`);
  const settle = () => new Promise((done) => setTimeout(done, 180));
  const verify = (value, width, height, label) => {
    const detail = label + " " + JSON.stringify(value);
    assert.equal(value?.width, width, "RESP-03 CSS viewport width: " + detail);
    assert.equal(value?.documentWidth, width, "RESP-03 document viewport width: " + detail);
    assert.equal(value?.height, height, "RESP-03 CSS viewport height: " + detail);
    assert.ok(value?.rootOverflow <= 1, "RESP-03 root horizontal overflow: " + detail);
    const box = value?.pitch;
    assert.ok(box?.width > 0 && box.left >= -2 && box.right <= width + 2, "RESP-03 pitch clipped horizontally: " + detail);
    if (planner) {
      assert.equal(value?.rosterPresent, true, "RESP-03 selected Planner lost its roster: " + detail);
      assert.ok(value?.gk?.width > 0 && value.gk.height > 0
        && value.gk.left >= box.left - 2 && value.gk.right <= box.right + 2
        && value.gk.top >= box.top - 2 && value.gk.bottom <= box.bottom + 2,
        "RESP-03 goalkeeper label hidden or outside the pitch: " + detail);
    } else assert.ok(value?.hero?.width > 0 && value.hero.left >= -2 && value.hero.right <= width + 2, "RESP-03 Player hero clipped: " + detail);
  };
  const resize = async (width,height,orientation) => {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,height,screenWidth:width,screenHeight:height,
      mobile:false,deviceScaleFactor:1,
      screenOrientation:{type:orientation,angle:orientation==="portraitPrimary"?0:90}
    });
    await evaluate('window.dispatchEvent(new Event("resize")); true');
    await settle();
  };
  await settle();
  const portrait = await snapshot();
  verify(portrait,390,844,"portrait initial");
  const verifyRetainedState = (value) => {
    assert.equal(value.route, portrait.route, "RESP-03 rotation changed the route.");
    if (!planner) return;
    assert.equal(value.club, portrait.club, "RESP-03 rotation changed the selected club.");
    assert.equal(value.formation, portrait.formation, "RESP-03 rotation changed the formation.");
    assert.deepEqual(value.roster, portrait.roster, "RESP-03 rotation changed the roster IDs/order.");
  };
  if (planner) {
    assert.ok(portrait.club, "RESP-03 selected club identity is missing.");
    assert.equal(portrait.formation, "442", "RESP-03 fixture must start in 4-4-2.");
  }
  const openPicker = async () => {
    // Instant scrolling plus two frames drains the preceding scroll event before clicking.
    const target = await evaluate(`(async function openPickerDom() {
    const slot = document.querySelector('.plannerFormationSpot[data-slot-key="CB#1"] .plannerFormationSlotButton:not(:disabled)');
    if (!(slot instanceof HTMLButtonElement)) return {opened:false,reason:"slot unavailable"};
    slot.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const rect = slot.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {x, y, hit:hit === slot || slot.contains(hit)};
  })()`);
    assert.equal(target?.hit, true, "RESP-03 pitch slot must be hit-testable before clicking.");
    await cdp.send("Input.dispatchMouseEvent", {type:"mousePressed",x:target.x,y:target.y,button:"left",clickCount:1});
    await cdp.send("Input.dispatchMouseEvent", {type:"mouseReleased",x:target.x,y:target.y,button:"left",clickCount:1});
    await settle();
    const opened = await snapshot();
    assert.equal(opened.pickerOpen, true, "RESP-03 picker must remain open after a settled pointer click: " + JSON.stringify(opened));
    assert.equal(opened.pickerExpanded, 1, "RESP-03 exactly one pitch slot must remain expanded.");
    assert.equal(opened.pickerPointer, true, "RESP-03 open picker must retain its pointer.");
  };
  if (planner) await openPicker();
  await resize(844,390,"landscapePrimary");
  const landscape = await snapshot();
  verify(landscape,844,390,"landscape");
  verifyRetainedState(landscape);
  if (planner) {
    assert.equal(landscape.pickerOpen,false,"RESP-03 rotating should close the anchored Planner picker.");
    assert.equal(landscape.pickerPointer,false,"RESP-03 closed picker must remove its pointer.");
    assert.equal(landscape.pickerExpanded,0,"RESP-03 stale expanded pitch position after rotation.");
    await openPicker();
    const openLandscape = await snapshot();
    assert.ok(openLandscape.pickerBounds?.left >= 8 && openLandscape.pickerBounds?.right <= 836
      && openLandscape.pickerBounds?.top >= 8 && openLandscape.pickerBounds?.bottom <= 382,
      "RESP-03 landscape picker outside visual viewport: "+JSON.stringify(openLandscape));
    assert.equal(await evaluate(`(function closePickerDom() {
    document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    return document.getElementById("plannerDepthPicker")?.hidden === true;
  })()`),true,"RESP-03 Escape should close picker.");
    await openPicker();
    await evaluate('document.querySelector("#appShell > main").scrollBy({top: 30, behavior: "instant"}); true');
    await settle();
    const scrolled = await snapshot();
    assert.equal(scrolled.pickerOpen, false, "RESP-03 scrolling the pitch must still close the picker.");
    assert.equal(scrolled.pickerExpanded, 0, "RESP-03 scrolling must clear the expanded position.");
    assert.equal(scrolled.pickerPointer, false, "RESP-03 scrolling must remove the picker pointer.");
    assert.equal(await evaluate(`(function openModalDom() {
    const action=document.getElementById("plannerAddPlayerButton");
    if (!(action instanceof HTMLButtonElement) || action.disabled) return false;
    action.click();
    return document.getElementById("plannerPlayerModal")?.hidden === false;
  })()`),true,"RESP-03 Add player(s) modal did not open.");
    const modalLandscape = await snapshot();
    assert.ok(modalLandscape.modalBounds?.left >= -1 && modalLandscape.modalBounds?.right <= 845
      && modalLandscape.modalBounds?.top >= -1 && modalLandscape.modalBounds?.bottom <= 391,
      "RESP-03 landscape Add player(s) modal is clipped: "+JSON.stringify(modalLandscape));
  }
  await resize(390,844,"portraitPrimary");
  const returned = await snapshot();
  verify(returned,390,844,"portrait after rotation");
  verifyRetainedState(returned);
  if (planner) {
    assert.equal(returned.modalOpen,true,"RESP-03 modal should survive rotation back.");
    assert.ok(returned.modalBounds?.left >= -1 && returned.modalBounds?.right <= 391
      && returned.modalBounds?.top >= -1 && returned.modalBounds?.bottom <= 845,
      "RESP-03 portrait Add player(s) modal is clipped: "+JSON.stringify(returned));
  }
  console.log("RESP-03 Chromium orientation "+(planner?"Planner picker/modal":"Player hero/pitch")+" passed");
  return baseline;
}

const cases = [
  { name: "player", old: '["player", "/players/1"],', replacement: '["player", "/players/1#resp01-390", 390, 844],' },
  { name: "planner", old: '["planner", "/planner", process.env.MFL_UX03_BROWSER_VIEWPORT === "phone" ? 390 : 1280, process.env.MFL_UX03_BROWSER_VIEWPORT === "phone" ? 844 : 900],', replacement: '["planner", "/planner#resp01-390", 390, 844],' },
];
try {
  for (const entry of cases) {
    assert.ok(original.includes(entry.old), "Scenario hook missing: " + entry.name);
    const changed = original.replace(entry.old, entry.replacement)
      .replace(marker, '    await cdp.send("Runtime.enable");\n' + `\n    return await (${runOrientationRegression.toString()})(cdp, url, await waitForBrowserRegression(cdp));\n` + '\n');
    await writeFile(temporaryPath, changed, "utf8");
    const exit = await new Promise((resolveExit, rejectExit) => {
      const child = spawn(process.execPath, [temporaryPath], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: entry.name,
          MFL_PLANNER_BROWSER_FOCUSED: "1",
          MFL_PLANNER_BROWSER_PHASE: "shell",
        },
      });
      child.once("error", rejectExit);
      child.once("close", resolveExit);
    });
    assert.equal(exit, 0, "RESP-03 " + entry.name + " orientation matrix failed.");
  }
} finally {
  await rm(temporaryPath, { force: true });
}
console.log("RESP-03 orientation matrix passed: Player and Planner.");
