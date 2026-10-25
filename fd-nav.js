// Menu button and footer links (outside React).
//  - The yellow menu button (desktop menu and the phone menu) shows the time left until Group 1 access,
//    as "09d 21h 15:03" (days, hours, minutes:seconds) next to its arrow, and takes the visitor to the signup block.
//    The time comes from fd-early.js (window.FD_EA_ACCESS_AT), so the date lives in one place.
//  - The hero's yellow button: on desktop it reads "Fundáro Team" and goes to the team; on phones the same
//    countdown as the menu button takes its place and goes to the signup block (the team link is in the phone menu).
//  - "Back to top" in the footer scrolls to the very top. Its #hero anchor stopped short: the hero is sticky,
//    and the page's smooth scrolling can take over an anchor jump.
//  - Footer: "Details" lists Reg. no., ISIN (Nasdaq CSD), LEI (GLEIF), address (map) and email, each a link that opens
//    in a new window; "Company" gets Privacy policy and Terms; the trade mark line sits under the intro text.
//  - Phones: the hero countdown sits under the heading; once the About section has slid up and covered it, a copy
//    slides down into the middle of the menu bar (#fd-pin) and the wordmark cross-fades to a smaller size. Scrolling
//    back (or tapping the wordmark, which glides to the top) reverses it: the countdown slides out through the top
//    edge while the small wordmark fades out, and the full-size wordmark fades in. The phone menu has no countdown,
//    and the countdown never docks over the open menu; scrolling with the menu open (nothing chosen) slides it away.
//  - The wordmark on any screen: tapped while scrolled, the page glides to the top (Framer would jump to it).
(function () {
  // Framer drops data-framer-name while the button is hovered, so match its component class
  var BTN = "nav a.framer-UH9OL";
  // the wordmark link: Framer drops its data-framer-name while it is pressed, so its component class is matched too
  var LOGO = 'nav a[data-framer-name="Black Logo"], nav a.framer-uZg3F';
  var HERO_BTN = "main#hero a.framer-UH9OL:not(.framer-v-9e28cn)";   // the hero's primary (yellow) button
  var phone = window.matchMedia ? window.matchMedia("(max-width: 809px)") : { matches: false };
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function label() {
    var t = window.FD_EA_ACCESS_AT;
    if (!t) return "";
    var s = Math.floor((t - Date.now()) / 1000);
    if (s <= 0) return "Sign up";
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return pad(d) + "d " + pad(h) + "h " + pad(m) + ":" + pad(sec);
  }
  function paint() {
    var text = label();
    document.querySelectorAll(BTN + ", " + HERO_BTN + ", #fd-pin").forEach(function (a) {
      var cd = a.querySelector(".fd-navcd");
      if (!cd) {
        cd = document.createElement("span");
        cd.className = "fd-navcd";
        cd.innerHTML = '<span class="fd-navcd__t"></span>';
        // the text goes where the button label was, before Framer's arrow
        var arrow = a.querySelector(".framer-cidclt");
        if (arrow && arrow.parentNode === a) a.insertBefore(cd, arrow); else a.appendChild(cd);
      }
      var t = cd.firstChild;
      if (t.textContent !== text) t.textContent = text;
      a.setAttribute("aria-label", "Sign up for Group 1 access" + (text && text !== "Sign up" ? ", opens in " + text : ""));
    });
  }

  // smooth scroll that wins over the page's own smooth scrolling: it sets the position on every frame
  var anim = null;
  function scrollToY(y, done, duration) {
    if (anim) cancelAnimationFrame(anim);
    var from = window.scrollY || 0, dist = y - from, t0 = null;
    var dur = duration || Math.min(1400, 500 + Math.abs(dist) * 0.08);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) dur = 1;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, from + dist * k);
      if (k < 1) anim = requestAnimationFrame(step);
      else { anim = null; setTimeout(function () { window.scrollTo(0, y); if (done) done(); }, 60); }
    }
    anim = requestAnimationFrame(step);
  }
  // Framer's tap gesture needs the full pointer sequence at a real position; a bare click() does nothing
  function tap(el) {
    var r = el.getBoundingClientRect();
    var o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, buttons: 1 };
    try {
      ["pointerover", "pointerenter", "pointerdown"].forEach(function (t) { el.dispatchEvent(new PointerEvent(t, o)); });
      o.buttons = 0; el.dispatchEvent(new PointerEvent("pointerup", o));
      el.dispatchEvent(new MouseEvent("click", o));
    } catch (_) { el.click(); }
  }
  function openMenu() { return document.querySelector('nav[data-framer-name="Mobile Open"], nav[data-framer-name="Mobile White open"]'); }
  // the phone menu slides away (panel up and out, CSS .fd-closing) and only then switches to the closed variant
  window.FD_CLOSE_MENU = function () { closeMobileMenu(); };
  function closeMobileMenu(done) {
    var open = openMenu();
    if (!open) { if (done) done(); return; }
    open.classList.add("fd-closing");
    // the toggle is looked up again at the end: Framer may have re-rendered the menu meanwhile
    setTimeout(function () {
      var now = openMenu(), toggle = now && now.querySelector('[data-framer-name="Open"], [data-framer-name="Close"]');
      if (window.FD_MENU) window.FD_MENU.set(false); else if (toggle) tap(toggle);
      if (now) now.classList.remove("fd-closing");
      if (done) done();
    }, 320);
  }
  // scroll to a section with the nav kept clear of it
  // the menu bar that is actually shown (Framer renders one per breakpoint)
  function visibleNav() {
    var navs = document.querySelectorAll("nav");
    for (var i = 0; i < navs.length; i++) if (navs[i].getBoundingClientRect().height > 0) return navs[i];
    return null;
  }
  function scrollToEl(el) {
    if (!el) return;
    var nav = visibleNav(), offset = nav ? Math.min(nav.getBoundingClientRect().height, 100) : 0;
    scrollToY(Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    // the wordmark while scrolled (any screen): glide to the top instead of Framer's jump to the page
    var logo = t.closest(LOGO);
    if (logo && (window.scrollY || 0) > 2) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); returnToTop(); return; }
    var pin = t.closest("#fd-pin");
    var btn = !pin && t.closest(BTN), hero = !btn && !pin && t.closest(HERO_BTN), top = t.closest('footer a[href$="#hero"]');
    if (pin) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      setTimeout(function () { scrollToEl(document.getElementById("early-access")); }, 0);
      return;
    }
    // a section link inside the open phone menu: close the menu, then glide to the section
    var menuLink = !btn && !hero && !top && openMenu() && t.closest('nav a[href*="#"]');
    if (!btn && !hero && !top && !menuLink) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (top) { scrollToY(0); return; }
    if (menuLink) {
      var id = (menuLink.getAttribute("href").split("#")[1] || "").trim();
      closeMobileMenu(function () { setTimeout(function () { scrollToEl(document.getElementById(id)); }, 40); });
      return;
    }
    var block = document.getElementById(hero && !phone.matches ? "team" : "early-access");
    if (!block) return;
    closeMobileMenu(function () { setTimeout(function () { scrollToEl(block); }, 40); });
  }, true);

  // footer. "Details": the company lines in this order, each a link (the page's own three lines are hidden by CSS,
  // so the order is ours). "Company": Privacy policy and Terms after the section links.
  var DETAILS = [
    ["Reg. no. 40203749200", null],
    ["ISIN LV0000113231", "https://www.nasdaqcsd.com/statistics/latvia/en/security/LV0000113231"],
    ["LEI 875500YJH4Y0XCESGA65", "https://search.gleif.org/#/record/875500YJH4Y0XCESGA65"],
    ["Ra\u0146\u0137a dambis 30-130, R\u012bga", "https://maps.google.com/?q=Ra%C5%86%C4%B7a+dambis+30-130,+R%C4%ABga,+LV-1048"],
    ["hi@fundaro.capital", "mailto:hi@fundaro.capital"]
  ];
  function footer() {
    var info = document.querySelector('footer [data-framer-name="Right Info Stack"]');
    if (info && !info.querySelector(".fd-foot")) {
      var div = document.createElement("div");
      div.className = "fd-foot";
      div.innerHTML = DETAILS.map(function (d) {
        if (!d[1]) return "<span>" + d[0] + "</span>";
        var ext = /^https?:/.test(d[1]) ? ' target="_blank" rel="noopener"' : "";
        return '<a href="' + d[1] + '"' + ext + ">" + d[0] + "</a>";
      }).join("");
      info.appendChild(div);
    }
    // trade mark line under the footer intro text
    var intro = document.querySelector('footer [data-framer-name="Intro Text"]');
    if (intro && !intro.parentNode.querySelector(".fd-foot-tm")) {
      var tm = document.createElement("p");
      tm.className = "fd-foot-tm";
      tm.textContent = "Fundaro\u2122 is an EU trade mark application, No. 3756167.";
      intro.insertAdjacentElement("afterend", tm);
    }
    var company = document.querySelector('footer [data-framer-name="Right Inner Stack"]');
    if (company && !company.querySelector(".fd-foot-nav")) {
      var nav = document.createElement("div");
      nav.className = "fd-foot-nav";
      nav.innerHTML = '<a href="./privacy-policy/">Privacy policy</a><a href="./terms/">Terms</a>';
      company.appendChild(nav);
    }
  }

  // ---- phones: countdown docks in the menu bar, wordmark shrinks on the way
  var pin = null, pinRaf = null, docked = false, aboutAbs = null, logoSmall = false, logoTimer = null;
  function phoneNav() { return document.querySelector('nav[data-framer-name^="Mobile"]'); }
  // wordmark: fade out, switch size, fade in (CSS .fd-small on the nav)
  // Framer re-renders the menu bar (a fresh element, without our classes) when the phone menu opens or closes,
  // so the wanted size is compared with what the bar actually has, not with what was asked last time
  var logoFading = false;
  function setLogo(small) {
    logoSmall = small;
    var nav = phoneNav(); if (!nav || logoFading) return;
    if (nav.classList.contains("fd-small") === small) return;
    logoFading = true;
    nav.classList.add("fd-logo-fade");
    clearTimeout(logoTimer);
    logoTimer = setTimeout(function () {
      logoFading = false;
      var n = phoneNav(); if (!n) return;
      n.classList.toggle("fd-small", logoSmall);
      n.classList.remove("fd-logo-fade");
    }, 230);
  }
  // wordmark tapped while scrolled: glide to the top; the docked countdown and the small wordmark hold until
  // the page is there, then release together with one eased transition
  var returning = false;
  function returnToTop() {
    if (returning) return;
    returning = true;
    scrollToY(0, function () {
      // at the top: the countdown slides out and the small wordmark fades, then the full wordmark fades in
      if (pin) { pin.classList.remove("is-docked"); docked = false; }
      setLogo(false);
      setTimeout(function () { returning = false; queueDock(); }, 500);
    }, 1500);
  }
  // the phone menu left open and the page scrolled: the menu slides away by itself (nothing was chosen);
  // while it is open, the countdown never docks over it
  var menuY = null;
  function menuScroll() {
    var open = openMenu();
    if (!open) { menuY = null; return false; }
    if (open.classList.contains("fd-closing")) return true;
    var y = window.scrollY || 0;
    if (menuY === null) menuY = y;
    else if (Math.abs(y - menuY) > 30) { menuY = null; closeMobileMenu(); }
    return true;
  }
  // the scroll position where the countdown docks is worked out once (the hero content sinks at a tenth of the
  // scroll, see fd-fx.js); while scrolling nothing is read from layout
  var dockAt = null, navH = 0, pinH = 0;
  function measureDock() {
    var hb = document.querySelector(HERO_BTN), about = document.querySelector('[data-framer-name="About Section"]'), nav = phoneNav();
    if (!hb || !about || !nav) return false;
    var y = window.scrollY || 0, r = hb.getBoundingClientRect();
    aboutAbs = about.getBoundingClientRect().top + y;
    var mid0 = r.top + r.height / 2 - y * 0.1;
    dockAt = Math.min(aboutAbs, (aboutAbs - mid0) / 1.1);
    navH = nav.getBoundingClientRect().height; pinH = pin.offsetHeight;
    return true;
  }
  function dock() {
    pinRaf = null;
    if (!phone.matches || returning) return;
    if (menuScroll()) { if (docked && pin) { docked = false; pin.classList.remove("is-docked"); } return; }
    if (!pin) {
      pin = document.createElement("a"); pin.id = "fd-pin"; pin.href = "#early-access";
      pin.setAttribute("aria-label", "Sign up for Group 1 access");
      document.body.appendChild(pin); paint();
    }
    if (dockAt === null && !measureDock()) return;
    var isDocked = (window.scrollY || 0) >= dockAt;
    if (isDocked !== docked) { docked = isDocked; pin.classList.toggle("is-docked", docked); }
    setLogo(docked);   // every pass: the bar may have been re-rendered since
    var top = Math.round((navH - pinH) / 2);
    if (pin.style.top !== top + "px") pin.style.top = top + "px";
  }
  function queueDock() { if (pinRaf === null) pinRaf = requestAnimationFrame(dock); }
  // iOS keeps scrolling the page under the open menu without firing scroll events we can rely on: a finger
  // dragging more than 30px while the menu is open closes it the same way (slide away)
  var touchY = null, logoTouch = null;
  function touchStart(e) {
    touchY = openMenu() && !openMenu().classList.contains("fd-closing") ? e.touches[0].clientY : null;
    var l = e.target && e.target.closest ? e.target.closest(LOGO) : null;
    logoTouch = l ? [e.touches[0].clientX, e.touches[0].clientY] : null;
  }
  function touchMove(e) {
    if (logoTouch && Math.hypot(e.touches[0].clientX - logoTouch[0], e.touches[0].clientY - logoTouch[1]) > 10) logoTouch = null;
    if (touchY === null || !openMenu()) return;
    if (Math.abs(e.touches[0].clientY - touchY) > 30) { touchY = null; menuY = null; closeMobileMenu(); }
  }
  // the wordmark on a phone: act on the finger lifting, before the browser makes a click out of it (iOS Safari lets
  // Framer's own page link win otherwise); the click that would follow is cancelled here
  function touchEnd(e) {
    if (!logoTouch) return;
    logoTouch = null;
    if ((window.scrollY || 0) > 2) { e.preventDefault(); returnToTop(); }
  }

  function start() {
    paint(); footer();
    if (phone.matches) {
      addEventListener("scroll", queueDock, { passive: true });
      addEventListener("touchstart", touchStart, { passive: true });
      addEventListener("touchmove", touchMove, { passive: true });
      addEventListener("touchend", touchEnd, { passive: false });
      addEventListener("resize", function () { aboutAbs = null; dockAt = null; queueDock(); }, { passive: true });
      setTimeout(queueDock, 300); setTimeout(queueDock, 1500);
    }
    setInterval(function () { if (!document.hidden) paint(); }, 1000);
    var queued = false;
    new MutationObserver(function () {
      if (queued) return; queued = true;
      setTimeout(function () { queued = false; paint(); footer(); queueDock(); }, 150);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
