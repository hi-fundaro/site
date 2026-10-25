// Highlighted section video (outside React).
//  - Self-hosted loop (muted, autoplay, no controls): 960x540 for phones, 1280x720 otherwise. H.264 MP4 first
//    (hardware decoding everywhere), VP9 WebM as a second source for browsers built without H.264.
//  - The <video> is created and starts buffering one screen before the section (nothing loads before that),
//    and is sized to cover the player box (16:9 source).
//  - Framer zooms the box with scroll and overshoots the screen; the scale is capped so the box stops when it
//    just covers the viewport.
(function () {
  // window.FD_VIDEO_BASE is set by the static build: the video stays on a host that answers byte-range requests
  var VB = window.FD_VIDEO_BASE || "/assets";
  var SMALL = VB + "/fundaro-loop-540", LARGE = VB + "/fundaro-loop-720";
  var RATIO = 16 / 9, SEL = '[data-framer-name="Video Player"]';
  var seen = typeof WeakSet === "function" ? new WeakSet() : null, io = null, pending = null;

  function src() { return (window.innerWidth <= 809 && (window.devicePixelRatio || 1) < 3) || window.innerWidth <= 480 ? SMALL : LARGE; }
  function fit(el, box) {
    var w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    var fw = Math.max(w, h * RATIO), fh = Math.max(h, w / RATIO);
    el.style.width = fw + "px"; el.style.height = fh + "px";
    el.style.marginLeft = (-(fw - w) / 2) + "px"; el.style.marginTop = (-(fh - h) / 2) + "px";
  }
  function pick(base) {
    var t = document.createElement("video");
    if (t.canPlayType('video/mp4; codecs="avc1.640028"')) return base + ".mp4";
    if (t.canPlayType('video/webm; codecs="vp9"')) return base + ".webm";
    return base + ".mp4";
  }
  var players = [];
  function tryPlay(el) { if (!el.paused) return; var p = el.play(); if (p && p.catch) p.catch(function () {}); }
  function playAll() { for (var i = 0; i < players.length; i++) if (players[i].isConnected) tryPlay(players[i]); }
  function mount(box) {
    if (box.querySelector(".fd-mp4")) return;
    var el = document.createElement("video");
    // muted + playsinline must be in place before the source is set, or iOS refuses to autoplay
    el.muted = true; el.defaultMuted = true; el.loop = true; el.autoplay = true; el.playsInline = true;
    el.setAttribute("muted", ""); el.setAttribute("playsinline", ""); el.setAttribute("webkit-playsinline", "");
    el.setAttribute("autoplay", ""); el.setAttribute("loop", ""); el.setAttribute("preload", "auto");
    el.setAttribute("aria-hidden", "true"); el.setAttribute("disablepictureinpicture", ""); el.setAttribute("disableremoteplayback", "");
    el.className = "fd-mp4";
    el.src = pick(src());
    box.appendChild(el); fit(el, box);
    players.push(el);
    ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"].forEach(function (ev) { el.addEventListener(ev, function () { tryPlay(el); }); });
    tryPlay(el);
    // play again whenever the block is on screen (browsers pause off-screen or interrupted video)
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) tryPlay(el); }); }, { threshold: 0.01 }).observe(box);
    if ("ResizeObserver" in window) new ResizeObserver(function () { fit(el, box); }).observe(box);
    else addEventListener("resize", function () { fit(el, box); });
  }
  // autoplay can be blocked (iOS Low Power Mode, data saver): the first tap or click anywhere starts it
  ["touchend", "click", "keydown"].forEach(function (ev) { document.addEventListener(ev, playAll, { passive: true }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) playAll(); });
  addEventListener("pageshow", playAll);
  function inView(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > -innerHeight && r.top < innerHeight * 2; }
  function observeAll() {
    var boxes = document.querySelectorAll(SEL);
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (seen && seen.has(b)) continue; if (seen) seen.add(b);
      capZoom(b);
      if (b.querySelector(".fd-mp4")) continue;
      if (io) io.observe(b); else if (inView(b)) mount(b);
    }
  }

  // ---- zoom cap: Framer scales "Center Container" with scroll; stop at the scale where the box covers the viewport
  function capZoom(box) {
    if (window.FD_NO_FRAMER) return;
    var cc = box.closest('[data-framer-name="Center Container"]'); if (!cc || cc.__fdCapped || !("MutationObserver" in window)) return;
    cc.__fdCapped = true; var busy = false;
    function clamp() {
      if (busy) return;
      var st = cc.getAttribute("style") || "", m = /scale\(([\d.]+)\)/.exec(st); if (!m) return;
      var s = parseFloat(m[1]), w = box.offsetWidth, h = box.offsetHeight; if (!w || !h) return;
      var cap = Math.max(innerWidth / w, innerHeight / h);
      if (s > cap + 0.001) { busy = true; cc.setAttribute("style", st.replace(/scale\([\d.]+\)/, "scale(" + cap.toFixed(4) + ")")); busy = false; }
    }
    new MutationObserver(clamp).observe(cc, { attributes: true, attributeFilter: ["style"] });
    clamp();
  }

  function start() {
    // one full screen of lead: the file is buffering before the section is reached
    if ("IntersectionObserver" in window) io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && e.target.clientWidth > 0) { mount(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "100% 0px 100% 0px" });
    observeAll();
    if ("MutationObserver" in window) new MutationObserver(function () {
      if (pending) return; pending = setTimeout(function () { pending = null; observeAll(); }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    if (!io) addEventListener("scroll", function () { if (!pending) pending = setTimeout(function () { pending = null; observeAll(); }, 150); }, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
