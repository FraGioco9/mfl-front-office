import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// PERF-06A: exercise the ACTUAL extracted Player image-loader and cache helpers
// in an isolated fake browser. A disables only eviction; B keeps the production
// 16-source LRU. This counts retained Image references, NOT browser heap bytes,
// network transfer, LCP, or decoded WebP memory.
const source = await readFile(new URL("../modules/core-sources/player.js", import.meta.url), "utf8");
const exactBetween = (start, end) => {
  const at = source.indexOf(start);
  assert(at >= 0 && source.indexOf(start, at + 1) === -1, "PERF-06A source anchor drifted: " + start);
  const to = source.indexOf(end, at + start.length);
  assert(to >= 0, "PERF-06A source end anchor missing: " + end);
  return source.slice(at, to);
};
const cache = exactBetween("  const PLAYER_PORTRAIT_CACHE_LIMIT = 16;", "  let activeHeroActionMenu = null;");
const loader = exactBetween("  function loadPortraitCrop(canvas, playerIdValue) {", "  function createHeroMedia(context) {");
const eviction = `    while (portraitSources.size > PLAYER_PORTRAIT_CACHE_LIMIT) {
      portraitSources.delete(portraitSources.keys().next().value);
    }`;
assert.equal(cache.split(eviction).length - 1, 1, "PERF-06A bounded eviction must be present exactly once.");
assert.equal(cache.split("const portraitSources = new Map();").length - 1, 1);
assert(loader.includes('image.fetchPriority = "high";'), "Hero image must retain high initial priority.");
assert(loader.includes('image.decoding = "async";'), "Hero image must retain asynchronous decode.");
assert(source.includes("else if (normalizePlayerId(portrait.dataset.playerId)) loadPortraitCrop(portrait, portrait.dataset.playerId);"),
  "Resize must rehydrate a previously evicted portrait source.");

function exercise(mode, { size = 128, immediate = true } = {}) {
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
      for (const cb of this.events[name] || []) cb();
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
    ${mode === "unbounded-control" ? cache.replace(eviction, "    // Control: identical source with only the eviction loop removed.") : cache}
    const normalizePlayerId = (value) => /^\\d{1,20}$/.test(String(value || "")) ? String(value) : "";
    const portraitUrl = (id) => "https://portrait-fixture.invalid/" + id + "/photo.webp";
    const applyPortraitGeometry = () => true;
    const drawPortraitCrop = (canvas, image) => { onDraw(canvas, image); return true; };
    ${loader}
    return { loadPortraitCrop, portraitSources, FakeCanvas, FakeImage };
  })()`, {
    HTMLCanvasElement: FakeCanvas, HTMLImageElement: FakeImage, Image: FakeImage,
    onDraw: (canvas, image) => { drawCalls++; canvas.drawnImage = image; },
  });
  const canvas = new FakeCanvas();
  for (let id = 1; id <= size; id++) {
    assert.equal(harness.loadPortraitCrop(canvas, String(id)), true);
    assert.equal(canvas.dataset.playerId, String(id));
  }
  const peak = harness.portraitSources.size;
  const requestsAfterCold = requests.length;
  for (let id = Math.max(1, size - 15); id <= size; id++) {
    assert.equal(harness.loadPortraitCrop(canvas, String(id)), true);
  }
  const warmExtraRequests = requests.length - requestsAfterCold;
  assert.equal(warmExtraRequests, 0, "Last 16 images must be warm after traversal.");
  let evictedVisitAdditionalRequest = 0;
  if (size > 16) {
    assert.equal(harness.loadPortraitCrop(canvas, String(size - 16)), true);
    evictedVisitAdditionalRequest = requests.length - requestsAfterCold;
    if (mode === "bounded-LRU") {
      assert.equal(evictedVisitAdditionalRequest, 1, "Visiting an evicted image should create one new Image.");
      assert.equal(harness.portraitSources.size, 16, "Cache must remain bounded after refill.");
    } else {
      assert.equal(evictedVisitAdditionalRequest, 0, "Unbounded reference control should retain the old image.");
    }
  }
  return { mode, peakRetainedImageReferences: peak, coldImagesCreated: requestsAfterCold,
    warmExtraRequests, evictedVisitAdditionalRequest, drawCalls, harness, instances, canvas };
}

const a = exercise("unbounded-control");
const b = exercise("bounded-LRU");
assert.equal(a.peakRetainedImageReferences, 128);
assert.equal(b.peakRetainedImageReferences, 16);
assert.equal(a.coldImagesCreated, b.coldImagesCreated);
const reductionPct = (1 - b.peakRetainedImageReferences / a.peakRetainedImageReferences) * 100;

// A pending earlier Player image must never overwrite a newer Player canvas,
// even after its decoded image source was evicted from the bounded cache.
const slow = exercise("bounded-LRU", { size: 1, immediate: false });
const first = slow.instances[0];
assert.equal(slow.harness.loadPortraitCrop(slow.canvas, "2"), true);
const second = slow.instances[1];
first.complete = true;
first.naturalWidth = 256;
first.fire("load");
assert.notEqual(slow.canvas.drawnImage, first, "Late stale portrait must never draw over a newer player.");
second.complete = true;
second.naturalWidth = 256;
second.fire("load");
assert.equal(slow.canvas.drawnImage, second, "Latest portrait should draw after load.");
// A failed image must be eligible for retry and must not poison the cache.
second.fire("error");
assert.equal(slow.harness.portraitSources.has("2"), false, "Failed image must be released.");
assert.equal(slow.harness.loadPortraitCrop(slow.canvas, "2"), true);
assert.equal(slow.instances.length, 3, "Failed portrait should be retryable.");

console.log("PERF06_AB_RESULT " + JSON.stringify({
  distinctPlayers: 128,
  sameRunner: true,
  baselineStrongImageReferences: a.peakRetainedImageReferences,
  boundedStrongImageReferences: b.peakRetainedImageReferences,
  retainedReferenceReductionPercent: reductionPct,
  coldImageCreationsBothModes: a.coldImagesCreated,
  last16WarmExtraRequestsBothModes: 0,
  oldPlayerRevisitExtraImageInstances: b.evictedVisitAdditionalRequest,
  staleLoadBlocked: true,
  failedImageRetry: true,
}));
