// Hero behaviour (outside React):
//  1. --fd-h1-p: 0 at the top of the page, 1 when the house spire has risen to just under the CTA buttons
//     (the hero text is sticky, the image scrolls up towards it at ~0.75 px per px of scroll). Phones use it to shrink
//     the oversized heading with a transform (no text reflow). The value is set on the heading itself, not on <html>,
//     so a frame restyles one element instead of the whole page. The geometry is measured once; scrolling never reads layout.
//  2. A gentle auto-scroll, 1.3 s after the page has loaded, that stops when the spire is TARGET_GAP px below the
//     buttons; cancelled by any user input, skipped under prefers-reduced-motion.
//  3. The scroll cue (#fd-cue) stays hidden at first, fades in once the auto-scroll has settled,
//     and disappears as soon as the visitor scrolls again.
(function () {
  var root = document.documentElement;
  var TARGET_GAP = 6, SLOPE = 0.75, FALLBACK_STOP = 60, AUTO_DELAY = 1300, AUTO_DUR = 1800, AUTO_MAX = 400, CUE_DELAY = 500;
  var raf = null, auto = null, userMoved = false, cueShown = false, cueDone = false, restY = null, yStop = null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = window.matchMedia ? window.matchMedia("(max-width: 809px)") : { matches: false };

  // distance from the bottom of the first CTA button to the top of the house image (its spire)
  function gap() {
    var btn = document.querySelector('main#hero [data-framer-name="Main/Black"]');
    var boxes = document.querySelectorAll('main#hero [data-framer-name="Home Image"]'), img = null;
    for (var i = 0; i < boxes.length; i++) if (boxes[i].getBoundingClientRect().width > 0) { img = boxes[i]; break; }
    if (!btn || !img) return null;
    return img.getBoundingClientRect().top - btn.getBoundingClientRect().bottom;
  }
  // where the spire meets the buttons, in scroll px; measured once from the current gap
  function measureStop() {
    var g = gap(), y = window.scrollY || 0;
    if (g === null) { yStop = FALLBACK_STOP; return; }
    var g0 = g + SLOPE * y;
    yStop = Math.max(20, Math.min(AUTO_MAX, (g0 - TARGET_GAP) / SLOPE));
  }
  // the cue belongs to the hero: only show it while the page still sits where the auto-scroll left it
  function showCue() {
    if (cueDone || cueShown) return;
    var y = window.scrollY || 0, limit = (yStop === null ? FALLBACK_STOP : yStop) + 40;
    if (y > limit) { cueDone = true; return; }
    cueShown = true; restY = y; root.classList.add("fd-cue-on");
  }
  function hideCue() { if (!cueShown || cueDone) return; cueDone = true; root.classList.remove("fd-cue-on"); }

  // the hero headings (Framer renders one per breakpoint); re-read only when one has been replaced
  var heads = [], lastP = -1, scrolled = null;
  function headings() {
    if (!heads.length || !heads[0].isConnected) {
      heads = Array.prototype.slice.call(document.querySelectorAll("main#hero h1"));
      lastP = -1;
      // shrink factor: from 8.1vw down to 7.4% of the text column, as a scale
      heads.forEach(function (h) {
        var box = h.closest(".framer-14vijjc") || h.parentElement, col = box ? box.clientWidth : innerWidth;
        var k = Math.max(0, Math.min(.5, 1 - (0.074 * col) / (0.081 * innerWidth)));
        h.style.setProperty("--fd-h1-k", k.toFixed(4));
      });
    }
    return heads;
  }
  function update() {
    raf = null;
    var y = window.scrollY || 0;
    if (phone.matches) {
      if (yStop === null) measureStop();
      var p = Math.min(1, Math.max(0, y / yStop)); p = 1 - Math.pow(1 - p, 2);
      p = Math.round(p * 1000) / 1000;
      if (p !== lastP) { lastP = p; headings().forEach(function (h) { h.style.setProperty("--fd-h1-p", p); }); }
    }
    var sc = y > 60;
    if (sc !== scrolled) { scrolled = sc; root.classList.toggle("fd-scrolled", sc); }
    if (cueShown && restY !== null && Math.abs(y - restY) > 4) hideCue();
  }
  function queue() { if (raf === null) raf = requestAnimationFrame(update); }
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", function () { yStop = null; heads = []; queue(); }, { passive: true });
  update();

  // ---- auto-scroll
  function cancelAuto() { userMoved = true; if (auto) { cancelAnimationFrame(auto); auto = null; } if (cueShown) hideCue(); else cueDone = true; }
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (ev) { addEventListener(ev, cancelAuto, { passive: true }); });
  function startAuto() {
    if (reduce) { setTimeout(showCue, 1200); return; }                 // no motion: just show the cue
    if (userMoved || (window.scrollY || 0) > 2 || document.hidden) return;
    measureStop();
    var dist = yStop, t0 = null;
    // the stop point is measured once above; the frames only scroll (no layout reads while moving)
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / AUTO_DUR);
      k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in-out (cubic): soft start and landing
      window.scrollTo(0, dist * k);
      if (k < 1) auto = requestAnimationFrame(step);
      else { auto = null; setTimeout(showCue, CUE_DELAY); }
    }
    auto = requestAnimationFrame(step);
  }
  // start a fixed AUTO_DELAY after the page has loaded
  function begin() { setTimeout(function () { requestAnimationFrame(startAuto); }, AUTO_DELAY); }
  if (document.readyState === "complete") begin();
  else addEventListener("load", begin);
})();
