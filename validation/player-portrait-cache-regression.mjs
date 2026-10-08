import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../modules/core-sources/player.js", import.meta.url), "utf8");

function exactBetween(start, end) {
  const at = source.indexOf(start);
  assert(at >= 0 && source.indexOf(start, at + 1) === -1, "Player portrait source anchor drifted: " + start);
  const to = source.indexOf(end, at + start.length);
  assert(to >= 0, "Player portrait source end anchor missing: " + end);
  return source.slice(at, to);
}

const cache = exactBetween("  const PLAYER_PORTRAIT_CACHE_LIMIT = 16;", "  let activeHeroActionMenu = null;");
const loader = exactBetween("  function loadPortraitCrop(canvas, playerIdValue) {", "  function createHeroMedia(context) {");

assert.match(cache, /const PLAYER_PORTRAIT_CACHE_LIMIT = 16;/);
assert.match(cache, /const portraitSources = new Map\(\);/);
assert.match(cache, /while \(portraitSources\.size > PLAYER_PORTRAIT_CACHE_LIMIT\)/);
assert.ok(loader.includes('image.fetchPriority = "high";'), "Hero image must retain high initial priority.");
assert.ok(loader.includes('image.decoding = "async";'), "Hero image must retain asynchronous decode.");
assert.ok(
  source.includes("else if (normalizePlayerId(portrait.dataset.playerId)) loadPortraitCrop(portrait, portrait.dataset.playerId);"),
  "Resize must rehydrate a previously evicted portrait source.",
);

function createHarness({ immediate = true } = {}) {
  const requests = [];
  const instances = [];
  let drawCalls = 0;

  class FakeCanvas {
    dataset = {};
  }

  class FakeImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.events = {};
      instances.push(this);
    }

    addEventListener(name, fn) {
      (this.events[name] ||= []).push(fn);
    }

    fire(name) {
      for (const callback of this.events[name] || []) callback();
      this.events[name] = [];
    }

    set src(value) {
      this.url = value;
      requests.push(value);
      if (immediate) {
        this.complete = true;
        this.naturalWidth = 256;
        this.naturalHeight = 384;
        this.fire("load");
      }
    }
  }

  const harness = vm.runInNewContext(`(() => {
    ${cache}
    const normalizePlayerId = (value) => /^\\d{1,20}$/.test(String(value || "")) ? String(value) : "";
    const portraitUrl = (id) => "https://portrait-fixture.invalid/" + id + "/photo.webp";
    const applyPortraitGeometry = () => true;
    const drawPortraitCrop = (canvas, image) => { onDraw(canvas, image); return true; };
    ${loader}
    return { loadPortraitCrop, portraitSources };
  })()`, {
    HTMLCanvasElement: FakeCanvas,
    HTMLImageElement: FakeImage,
    Image: FakeImage,
    onDraw: (canvas, image) => {
      drawCalls += 1;
      canvas.drawnImage = image;
    },
  });

  return { harness, requests, instances, FakeCanvas, drawCalls: () => drawCalls };
}

const current = createHarness();
const canvas = new current.FakeCanvas();
for (let id = 1; id <= 128; id += 1) {
  assert.equal(current.harness.loadPortraitCrop(canvas, String(id)), true);
}
assert.equal(current.harness.portraitSources.size, 16, "Portrait source cache must stay bounded to 16 entries.");

const requestsAfterTraversal = current.requests.length;
for (let id = 113; id <= 128; id += 1) {
  assert.equal(current.harness.loadPortraitCrop(canvas, String(id)), true);
}
assert.equal(current.requests.length, requestsAfterTraversal, "The most recent 16 portraits must stay warm.");

assert.equal(current.harness.loadPortraitCrop(canvas, "112"), true);
assert.equal(current.requests.length, requestsAfterTraversal + 1, "An evicted portrait must create exactly one new Image.");
assert.equal(current.harness.portraitSources.size, 16, "Refilling an evicted portrait must keep the cache bounded.");

const slow = createHarness({ immediate: false });
const slowCanvas = new slow.FakeCanvas();
assert.equal(slow.harness.loadPortraitCrop(slowCanvas, "1"), true);
const first = slow.instances[0];
assert.equal(slow.harness.loadPortraitCrop(slowCanvas, "2"), true);
const second = slow.instances[1];

first.complete = true;
first.naturalWidth = 256;
first.fire("load");
assert.notEqual(slowCanvas.drawnImage, first, "A late stale portrait must not overwrite the newer player.");

second.complete = true;
second.naturalWidth = 256;
second.fire("load");
assert.equal(slowCanvas.drawnImage, second, "The current portrait should draw after load.");

second.fire("error");
assert.equal(slow.harness.portraitSources.has("2"), false, "A failed portrait must be released from the cache.");
assert.equal(slow.harness.loadPortraitCrop(slowCanvas, "2"), true);
assert.equal(slow.instances.length, 3, "A failed portrait must be retryable.");

console.log(JSON.stringify({
  cacheLimit: 16,
  traversedPlayers: 128,
  warmRecentPlayers: 16,
  evictedPortraitReloaded: true,
  staleLoadBlocked: true,
  failedImageRetry: true,
}));
