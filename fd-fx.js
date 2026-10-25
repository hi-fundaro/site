// The page's motion without Framer. Everything here writes transforms or classes only (no layout reads while
// scrolling except one rectangle per effect), so phones stay smooth.
//  - Appear: elements the export left at opacity .001 fade and rise once they come into view; word spans stagger.
//  - About text: the blurred words sharpen one by one as the text block scrolls up (matches the Framer reveal).
//  - Hero: the smoke layers drift sideways over the first 450px of scroll; the house photo moves at parallax speed
//    (0.5x on desktop, 0.7x on phones), exactly the values measured on the Framer version.
//  - Video section (desktop/tablet): the box zooms with scroll until it covers the screen.
//  - FAQ accordion and the phone menu (window.FD_MENU.set(open) is used by fd-nav.js as well).
(function () {
  var phone = window.matchMedia("(max-width: 809px)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function vis(list) { return Array.prototype.filter.call(list, visible); }

  // ---------- appear
  function appear() {
    var els = document.querySelectorAll('[style*="opacity:0.001"], [style*="opacity: 0.001"], [style*="opacity:0;transform:translateY(20px)"]');
    if (!("IntersectionObserver" in window) || reduce) { els.forEach(function (e) { e.classList.add(e.tagName === "SPAN" ? "fd-word" : "fd-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var e = en.target; io.unobserve(e);
        if (e.tagName === "SPAN") {
          // stagger within the same text block
          var p = e.parentElement, i = p ? Array.prototype.indexOf.call(p.querySelectorAll("span"), e) : 0;
          e.style.transitionDelay = Math.min(30, i) * 12 + "ms";
          e.classList.add("fd-word");
        } else e.classList.add("fd-in");
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });
  }

  // ---------- About text: word by word
  var words = [], wordBox = null, shown = -1;
  function wordsInit() {
    var about = document.querySelector('[data-framer-name="About Section"]');
    words = about ? vis(about.querySelectorAll('span[style*="blur"]')) : [];
    wordBox = about && words.length ? about : null;
    shown = -1;
  }
  function wordsUpdate(top) {
    if (!wordBox) return;
    var vh = window.innerHeight;
    // starts when the section's top is at S, done when it has moved up by R (measured: desktop .44vh/.83vh, phone 0/.68vh)
    var S = phone.matches ? 0 : vh * 0.44, R = phone.matches ? vh * 0.68 : vh * 0.83;
    var t = Math.max(0, Math.min(1, (S - top) / R)), p = 1 - Math.pow(1 - t, 1.5);   // eases out like the original
    var n = Math.round(p * words.length);
    if (n === shown) return;
    for (var i = 0; i < words.length; i++) words[i].classList.toggle("fd-sharp", i < n);
    shown = n;
  }

  // ---------- hero smoke and house
  var smoke = [], house = [], content = [];
  var DRIFT = { desktop: [86, 69, -69, -104], phone: [105, 84, -84, -126] };
  // with scroll-driven animations (v3.css) the browser moves the hero layers itself; this only sets each smoke's drift
  var cssScroll = window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
  function heroInit() {
    var hero = document.getElementById("hero"); if (!hero) return;
    smoke = vis(hero.querySelectorAll('[data-framer-name="Hero Smoke Image"]'));
    var d = DRIFT[phone.matches ? "phone" : "desktop"];
    smoke.forEach(function (el, i) {
      // "none" cannot be combined with another transform function: use the identity instead
      if (!el.dataset.fdBase) el.dataset.fdBase = el.style.transform && el.style.transform !== "none" ? el.style.transform : "translate(0)";
      el.style.setProperty("--fd-smoke-base", el.dataset.fdBase);
      el.style.setProperty("--fd-smoke-d", d[i % d.length] + "px");
    });
    house = vis(hero.querySelectorAll('[data-framer-name="Home Image"]'));
    content = vis(hero.querySelectorAll('[data-framer-name="Content Wrapper"]'));
    if (cssScroll) smoke = house = content = [];
  }
  // style writes only when the value changed (a write with the same value still costs a style pass)
  function setVar(el, name, value) { if (el.__fd === undefined) el.__fd = {}; if (el.__fd[name] !== value) { el.__fd[name] = value; el.style.setProperty(name, value); } }
  function heroUpdate(y) {
    var t = Math.min(1, y / 450), p = 1 - Math.pow(1 - t, 3), d = DRIFT[phone.matches ? "phone" : "desktop"];
    for (var i = 0; i < smoke.length; i++) setVar(smoke[i], "--fd-smoke-x", (d[i % d.length] * p).toFixed(1) + "px");
    var k = phone.matches ? 0.7 : 0.5;
    for (var j = 0; j < house.length; j++) setVar(house[j], "--fd-para-y", (-y * k).toFixed(1) + "px");
    // measured on the Framer version: scale eases to .86 (phones .829) over ~550px (420px), opacity = 1 - 2 * (1 - scale),
    // and the block keeps sinking at a tenth of the scroll
    var tc = Math.min(1, y / (phone.matches ? 420 : 550)), pc = 1 - Math.pow(1 - tc, 1.6);
    var sc = 1 - (phone.matches ? 0.171 : 0.14) * pc;
    for (var c = 0; c < content.length; c++) {
      setVar(content[c], "--fd-cw-s", sc.toFixed(4));
      setVar(content[c], "--fd-cw-o", (1 - 2 * (1 - sc)).toFixed(3));
      setVar(content[c], "--fd-cw-y", (y * 0.1).toFixed(1) + "px");
    }
  }

  // ---------- video zoom
  var vidSection = null, vidBox = null, vidCap = 1;
  function videoInit() {
    vidSection = vidBox = null;
    if (phone.matches) return;
    var s = vis(document.querySelectorAll('[data-framer-name="Highlighted Home Section"]'))[0]; if (!s) return;
    var b = vis(s.querySelectorAll('[data-framer-name="Center Container"]'))[0]; if (!b) return;
    vidSection = s; vidBox = b;
    // offsetWidth/Height ignore the transform: the box at scale 1
    vidCap = Math.max(1, window.innerWidth / Math.max(1, b.offsetWidth), window.innerHeight / Math.max(1, b.offsetHeight));
  }
  function videoUpdate(top) {
    if (!vidSection) return;
    var x = -top;
    var s = Math.max(1, Math.min(vidCap, 1 + 0.002 * (x - 80)));
    setVar(vidBox, "--fd-zoom", s.toFixed(4));
  }

  // ---------- ticker (desktop and tablet; the export hides it on phones)
  function ticker() {
    vis(document.querySelectorAll('[data-framer-name="Ticker Container"] ul')).forEach(function (ul) {
      var li = ul.children[0]; if (!li) return;
      var w = li.getBoundingClientRect().width + 30;   // the list's gap
      var need = ul.parentElement.getBoundingClientRect().width * 2 + w, guard = 0;
      while (ul.scrollWidth < need && guard++ < 12) ul.appendChild(ul.children[guard % ul.children.length].cloneNode(true));
      ul.style.setProperty("--fd-tick", w.toFixed(1) + "px");
      ul.style.setProperty("--fd-tick-dur", (w / 80).toFixed(2) + "s");
    });
  }

  // ---------- scroll loop
  var raf = null, lastY = -1;
  function frame() {
    raf = null;
    var y = window.scrollY || 0;
    if (y === lastY) return;
    lastY = y;
    // read everything first, write after: no layout forced between writes
    var aboutTop = wordBox ? wordBox.getBoundingClientRect().top : 0, vidTop = vidSection ? vidSection.getBoundingClientRect().top : 0;
    heroUpdate(y); wordsUpdate(aboutTop); videoUpdate(vidTop);
  }
  function queue() { if (raf === null) raf = requestAnimationFrame(frame); }
  function init() { heroInit(); wordsInit(); videoInit(); ticker(); lastY = -1; queue(); }

  // ---------- FAQ
  function faq() {
    document.addEventListener("click", function (e) {
      var item = e.target.closest && e.target.closest(".framer-mciAD"); if (!item) return;
      toggleFaq(item);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var item = e.target.closest && e.target.closest(".framer-mciAD"); if (!item) return;
      e.preventDefault(); toggleFaq(item);
    });
  }
  function toggleFaq(item) {
    var open = item.classList.contains("framer-v-1ejrpwo"), ans = item.querySelector(".framer-1gyl0eb");
    var from = ans.getBoundingClientRect().height;
    item.classList.toggle("framer-v-1ejrpwo", !open); item.classList.toggle("framer-v-1bas7dc", open);
    item.setAttribute("data-framer-name", open ? "Default" : "Active"); item.setAttribute("aria-expanded", String(!open));
    // height animates from the measured value to the new one, then goes back to the stylesheet's value
    ans.style.transition = "none"; ans.style.height = from + "px"; void ans.offsetHeight;
    ans.style.transition = ""; ans.style.height = open ? "1px" : ans.scrollHeight + "px";
    ans.addEventListener("transitionend", function done() { ans.removeEventListener("transitionend", done); ans.style.height = ""; });
  }

  // ---------- phone menu
  function phoneNav() { return document.querySelector('nav.framer-MTjqi[data-framer-name^="Mobile"]'); }
  window.FD_MENU = {
    isOpen: function () { var n = phoneNav(); return !!n && n.classList.contains("framer-v-1kfaa0s"); },
    set: function (open) {
      var n = phoneNav(); if (!n) return;
      n.classList.toggle("framer-v-1kfaa0s", open); n.classList.toggle("framer-v-m2kqe8", !open);
      n.setAttribute("data-framer-name", open ? "Mobile Open" : "Mobileclosed");
      var t = n.querySelector(".framer-LqZWJ");
      if (t) { t.classList.toggle("framer-v-qk9xot", open); t.classList.toggle("framer-v-zuosyh", !open); t.setAttribute("data-framer-name", open ? "Close" : "Open"); }
    }
  };
  function menu() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("nav .framer-LqZWJ"); if (!t) return;
      e.preventDefault();
      // fd-nav.js closes with its slide-away when it is loaded; otherwise close directly
      if (window.FD_MENU.isOpen() && window.FD_CLOSE_MENU) window.FD_CLOSE_MENU();
      else window.FD_MENU.set(!window.FD_MENU.isOpen());
    });
  }

  function start() {
    appear(); faq(); menu(); init();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", function () { init(); }, { passive: true });
    // the waitlist block and the team modal change the page height later: nothing to re-measure here
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
