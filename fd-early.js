// Fundaro bond waitlist blocks (styles in fd-early.css, API in src/early-access.js).
//  - Two looks of the same signup form: the dark block goes after the video section, the ticket before the footer.
//    Both are placed into Framer's page stack after React has hydrated (flex order puts them in position),
//    so the server-rendered page and React never disagree about the markup.
//  - Counts are live: the page polls /api/early-access every few seconds while a block is on screen,
//    so signups made in any other browser show up without a reload.
//  - Nothing is invented: until the first real count arrives the numbers stay hidden.
(function () {
  // =====================================================================================================
  //  CONFIG: fill these in. Until then the placeholders stay visible on the page as written.
  // =====================================================================================================
  var CONFIG = {
    // [DATE_GROUP1] Group 1 access day, as YYYY-MM-DD (for example "2026-11-02").
    //               The countdown runs to 08:00 Europe/Riga on that day.
    DATE_GROUP1: "2026-10-25",
    // [DATE_SUBS]   The day subscriptions open, as YYYY-MM-DD (shown as "16 November 2026").
    DATE_SUBS: "[DATE_SUBS]",
    // [PROSPECTUS_URL] Full address of the prospectus, for example "https://fundaro.capital/prospectus".
    PROSPECTUS_URL: "https://www.bank.lv/en/search?q=fundaro",
    // The site's privacy policy page.
    PRIVACY_URL: "./privacy-policy/"
    // Later groups: add DATE_GROUP2, DATE_GROUP3, ... the same way when their dates are known.
  };
  // =====================================================================================================

  // window.FD_API_BASE is set by the static build when the API lives on another host
  var API = (window.FD_API_BASE || "") + "/api/early-access", POLL_MS = 4000, CAP = 500, SIZE = 500;
  var KEY = "fd-ea-place";
  // Which waitlist block shows: v3 (keys and the lit facade, public/waitlist/) is the live one.
  // ?wl=v2 or ?wl=v4 previews the other versions; ?wl=v1 shows the earlier dark block built in this file.
  var WL_PARAM = (/[?&]wl=(v[1-4])(?:&|$)/.exec(location.search) || [])[1] || null;
  var WL = WL_PARAM === "v1" ? null : (WL_PARAM || "v3");
  // Group 1 access time for the countdown in the menu button (fd-nav.js)
  window.FD_EA_ACCESS_AT = rigaNine(CONFIG.DATE_GROUP1);
  function loadPreview(v) {
    var base = (typeof window.FD_SITE_BASE === "string" ? window.FD_SITE_BASE : "/v2") + "/waitlist/" + v + "/", css = document.createElement("link"), cfg = document.createElement("script");
    css.rel = "stylesheet"; css.href = base + "block.css?r=18"; document.head.appendChild(css);
    cfg.src = base + "config.js?r=18";
    cfg.onload = function () { var js = document.createElement("script"); js.src = base + "block.js?r=18"; document.head.appendChild(js); };
    document.head.appendChild(cfg);
  }
  var state = { count: null, total: null, next: null }, prevN = null, blocks = [], visible = new Set(), timer = null, inflight = false;
  var mine = null; // { position, existing } once this browser has signed up
  try { mine = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  // the keys block (waitlist/v3) keeps the same number in a cookie; either one is enough
  (function () { var c = /(?:^|;\s*)fd_wl_key=(\d+)/.exec(document.cookie); if (c && !(mine && mine.position)) mine = { position: +c[1], existing: true }; })();
  // both signup blocks show the same key: whichever block is used tells the other one (event "fd-wl-signup")
  function share(m, total) {
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) {}
    document.cookie = "fd_wl_key=" + encodeURIComponent(m.position) + "; Max-Age=5184000; Path=/; SameSite=Lax";
    try { window.dispatchEvent(new CustomEvent("fd-wl-signup", { detail: { position: m.position, total: total, from: "fd-early" } })); } catch (_) {}
  }
  window.addEventListener("fd-wl-signup", function (e) {
    if (!e.detail || e.detail.from === "fd-early" || !e.detail.position) return;
    mine = { position: e.detail.position, existing: true };
    try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch (_) {}
    if (typeof e.detail.total === "number") apply({ total: e.detail.total }); else render();
    blocks.forEach(showDone);
  });

  var LEGAL = "*Approval is not an endorsement. Advertisement. The prospectus of SIA Fundaro dated 29 September 2026 was approved by " +
    "Latvijas Banka on 8 October 2026 and is available at fundaro.capital. Approval of the prospectus should not be understood as an " +
    "endorsement of the bonds. Read the prospectus before investing to fully understand the potential risks and rewards. " +
    "Offer open to residents of Latvia, Germany and Spain.";
  var DARK_LEGAL = "Read the prospectus before investing to fully understand the potential risks and rewards of the decision to invest. " +
    "The offer is addressed only to residents of Latvia, Germany and Spain. Information on this website does not form part of the " +
    "prospectus and has not been reviewed or approved by Latvijas Banka.";

  // ---------- config helpers
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function iso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "").trim()); return m ? [+m[1], +m[2], +m[3]] : null; }
  function longDate(v) { var d = iso(v); return d ? d[2] + " " + MONTHS[d[1] - 1] + " " + d[0] : String(v); }   // 2 November 2026
  function dotDate(v) { var d = iso(v); return d ? pad(d[2]) + "." + pad(d[1]) + "." + d[0] : String(v); }      // 02.11.2026
  function groupDate(g) { return CONFIG["DATE_GROUP" + g] || "[DATE_GROUP" + g + "]"; }
  // 08:00 in Riga on the given day, as a UTC timestamp (Riga is UTC+2 in winter, UTC+3 in summer)
  function rigaNine(v) {
    var d = iso(v); if (!d) return null;
    var guess = Date.UTC(d[0], d[1] - 1, d[2], 8);
    try {
      var f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      var off = function (t) { var p = {}; f.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; }); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t; };
      var t = guess - off(guess); return guess - off(t);
    } catch (_) { return guess - 3 * 3600 * 1000; }
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }   // 1000 -> 1,000
  function prospectusLink() {
    var u = String(CONFIG.PROSPECTUS_URL || "").trim(), real = /^https?:\/\//i.test(u);
    var shown = real ? u.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] : u;   // "bank.lv"
    return real ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(shown) + "</a>" : '<a class="is-placeholder">' + esc(shown) + "</a>";
  }

  var LB = '<svg class="fd-ea__lb" viewBox="0 0 140 54" role="img" aria-label="Latvijas Banka, Eurosystem">' +
    '<path d="M17 22 A 58 21 0 0 1 123 22 Z" fill="#a8a3ac"/><rect x="13" y="23.2" width="114" height=".9" fill="#8d6e5c" opacity=".7"/>' +
    '<text x="70" y="38" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="11.2" letter-spacing="1.9" fill="currentColor" opacity=".78">LATVIJAS BANKA</text>' +
    '<text x="70" y="49" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="4.8" letter-spacing="1.7" fill="currentColor" opacity=".6">EIROSISTĒMA</text></svg>';
  var APPROVED = '<div class="fd-ea__approved"><span class="fd-ea__eyebrow">Prospectus approved by*</span>' + LB + '</div>';
  // marketing consent: the id is stored with the signup; change it whenever the text changes
  var CONSENT_ID = "terms-offer-emails-2026-10-15";
  var CONSENT_TEXT = 'I agree to the <a href="./terms/">Terms</a> and to receive emails from SIA Fundaro about this bond offer, including my key. I can unsubscribe at any time.';
  function form(button, source, note) {
    return '<form class="fd-ea__form" novalidate data-source="' + source + '">' +
      '<label class="fd-ea__label fd-ea__eyebrow" for="fd-ea-' + source + '">Your email</label>' +
      '<div class="fd-ea__row"><input class="fd-ea__input" id="fd-ea-' + source + '" type="email" name="email" autocomplete="email" inputmode="email" ' +
      'placeholder="name@example.com" required maxlength="254">' +
      '<button class="fd-ea__btn" type="submit"><span data-ea-cta>' + button + '</span><span class="fd-ea__arrow" aria-hidden="true">&#8594;</span></button></div>' +
      '<label class="fd-ea__consent"><input type="checkbox" name="consent" value="' + CONSENT_ID + '"><span>' + CONSENT_TEXT + '</span></label>' +
      '<label class="fd-ea__hp" aria-hidden="true">Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label>' +
      '<p class="fd-ea__msg" role="status" aria-live="polite"></p>' +
      '<p class="fd-ea__note">' + (note || 'We use your email only to send the access link and news about this offer. Unsubscribe any time.') + '</p>' +
      '</form>' +
      '<div class="fd-ea__done" role="status" aria-live="polite"><p class="fd-ea__done-title"></p><p class="fd-ea__done-text"></p>' +
      '<button type="button" class="fd-ea__again">Add another email</button></div>';
  }
  function marks() { var s = ""; for (var i = 0; i < CAP; i++) s += "<i></i>"; return s; }

  var KEY_NOTE = 'Every group gets its keys before subscriptions open, and subscriptions open for everyone at the same time. ' +
    'We use your email only for your key and news about this offer. Unsubscribe any time. <a href="' + esc(CONFIG.PRIVACY_URL) + '">Privacy policy</a>';
  var DARK_NOTE = 'Every group gets access before subscriptions open, and subscriptions open for everyone at the same time. ' +
    'We use your email only for your access link and news about this offer. Unsubscribe any time. <a href="' + esc(CONFIG.PRIVACY_URL) + '">Privacy policy</a>';
  var DARK = '<div class="fd-ea__wrap">' +
    '<div class="fd-ea__top fd-ea__eyebrow"><span>Fundaro Bonds</span><span>Advertisement</span></div>' +
    '<div class="fd-ea__grid2"><div class="fd-ea__col">' +
      '<span class="fd-ea__pill fd-ea__eyebrow" data-ea="badge">Group 1 · Places 1 to 500</span>' +
      '<h2 class="fd-ea__h">Be verified<br> before day one.</h2>' +
      '<p class="fd-ea__lead">Bonds are allotted in the order payments arrive. To pay, you first need to pass identity verification. ' +
      "We're opening the platform in groups of 500 so every check is done properly. Group 1 gets access on " + esc(longDate(CONFIG.DATE_GROUP1)) +
      ', verified and ready before subscriptions open on ' + esc(longDate(CONFIG.DATE_SUBS)) + '.</p>' +
      '<div class="fd-ea__prosp"><p>The prospectus is available at ' + prospectusLink() + '.</p>' +
      '<p>The prospectus of SIA Fundaro dated 29 September 2026 was approved by Latvijas Banka on 8 October 2026. ' +
      'Approval of the prospectus should not be understood as an endorsement of the bonds.</p></div>' +
      form("Join Group 1", "dark", DARK_NOTE) +
    '</div><div class="fd-ea__col">' +
      '<div class="fd-ea__live"><div class="fd-ea__count" aria-live="polite"><span class="fd-ea__big fd-ea__num" data-ea="n"></span><span class="fd-ea__of">/ 500</span></div>' +
      '<p class="fd-ea__left fd-ea__eyebrow"><span data-ea="group">Group 1</span> · <span data-ea="groupleft"></span> <span data-ea="places">places</span> left</p>' +
      '<div class="fd-ea__marks" aria-hidden="true">' + marks() + '</div>' +
      '<p class="fd-ea__caption">Each mark is one person. The count updates live. When <span data-ea="group">Group 1</span> is full, <span data-ea="nextgroup">Group 2</span> opens.</p></div>' +
      '<div class="fd-ea__timer"><p class="fd-ea__when fd-ea__eyebrow"><span data-ea="group">Group 1</span> access in · <span data-ea="gdate">' + esc(dotDate(CONFIG.DATE_GROUP1)) + '</span></p>' +
      '<div class="fd-ea__cells" role="timer"><div><b data-t="d">--</b><span>Days</span></div><div><b data-t="h">--</b><span>Hours</span></div>' +
      '<div><b data-t="m">--</b><span>Minutes</span></div><div><b data-t="s">--</b><span>Seconds</span></div></div></div>' +
    '</div>' +
    '<p class="fd-ea__legal">' + DARK_LEGAL + '</p>' +
    '</div></div>';

  var TICKET = '<div class="fd-ea__wrap">' +
    '<p class="fd-ea__top fd-ea__eyebrow">Advertisement · Fundaro Bonds · Residences of Pintor</p>' +
    '<div class="fd-ea__ticket">' +
      '<div class="fd-ea__stub"><p class="fd-ea__eyebrow" data-ea-stub-label>Next free place</p>' +
        '<div class="fd-ea__stub-mid"><p class="fd-ea__stub-no">No.</p><p class="fd-ea__stub-big fd-ea__num" data-ea="next"></p>' +
        '<p class="fd-ea__stub-left">OF 500 · <span data-ea="signed"></span> SIGNED UP · <span data-ea="left"></span> LEFT</p><p class="fd-ea__stub-batch fd-ea__eyebrow">First batch of 500</p>' +
        '</div></div>' +
      '<div class="fd-ea__main"><span class="fd-ea__notch fd-ea__notch--a"></span><span class="fd-ea__notch fd-ea__notch--b"></span>' +
        '<h2 class="fd-ea__h" data-ea-head>Place No. <span data-ea="next"></span> of 500 is still open.</h2>' +
        '<p class="fd-ea__lead">This is the next free place in the first batch of 500. On 25 October 2026 every place in the batch receives an access link ' +
        'to the bond registration platform, where you can subscribe to the bonds and read the full project information. Enter your email and the place is yours.</p>' +
        form("Reserve my number", "ticket", KEY_NOTE) +
        '<div class="fd-ea__rule"></div>' +
        APPROVED +
      '</div>' +
    '</div>' +
    '<p class="fd-ea__facts"><span>EUR 500 per bond</span><span>15% fixed interest p.a.</span><span>Unsecured · Capital at risk · No deposit guarantee</span></p>' +
    '<p class="fd-ea__legal">' + LEGAL + '</p></div>';

  // ---------- rendering
  // groups of 500: total signups T -> current group g, and N = signups inside it (500 exactly opens the next group)
  function group(total) { var g = Math.floor(total / SIZE) + 1; return { g: g, n: total - (g - 1) * SIZE }; }
  function setIn(b, sel, text) { b.querySelectorAll(sel).forEach(function (n) { n.textContent = text; }); }
  function render() {
    if (state.total === null) return;
    var G = group(state.total);
    blocks.forEach(function (b) {
      b.classList.add("is-live");
      if (b.classList.contains("fd-ea--dark")) renderDark(b, G);
      else renderTicket(b);
    });
    prevN = G;
    tick();
  }
  function renderDark(b, G) {
    var g = G.g, n = G.n;
    setIn(b, '[data-ea="n"]', String(n));
    setIn(b, '[data-ea="groupleft"]', num(SIZE - n));
    setIn(b, '[data-ea="places"]', SIZE - n === 1 ? "place" : "places");
    setIn(b, '[data-ea="group"]', "Group " + g);
    setIn(b, '[data-ea="nextgroup"]', "Group " + (g + 1));
    setIn(b, '[data-ea="badge"]', "Group " + g + " · Places " + num((g - 1) * SIZE + 1) + " to " + num(g * SIZE));
    setIn(b, "[data-ea-cta]", "Join Group " + g);
    setIn(b, '[data-ea="gdate"]', dotDate(groupDate(g)));
    var sameGroup = prevN && prevN.g === g;
    var ms = b.querySelectorAll(".fd-ea__marks i");
    for (var i = 0; i < ms.length; i++) {
      var cls = ms[i].classList, on = i < n;
      if (on && !cls.contains("on") && sameGroup) cls.add("new");
      if (!on) cls.remove("new");
      cls.toggle("on", on); cls.toggle("next", i === n);
    }
  }
  function renderTicket(b) {
    var head = b.querySelector("[data-ea-head]"), label = b.querySelector("[data-ea-stub-label]");
    var place = state.next, html;
    setIn(b, '[data-ea="left"]', String(Math.max(0, CAP - state.total)));
    setIn(b, '[data-ea="signed"]', String(state.total));
    if (mine && mine.position) {
      place = mine.position; label.textContent = "Your place";
      html = mine.position <= CAP ? 'Place No. <span data-ea="next"></span> of 500 is yours.' : 'You are No. <span data-ea="next"></span> on the waiting list.';
    } else if (state.total >= CAP) {
      label.textContent = "Waiting list"; place = "";
      html = 'All 500 places are taken. Join the waiting list.';
    } else {
      label.textContent = "Next free place";
      html = 'Place No. <span data-ea="next"></span> of 500 is still open.';
    }
    if (head.getAttribute("data-html") !== html) { head.innerHTML = html; head.setAttribute("data-html", html); }
    setIn(b, '[data-ea="next"]', String(place));
  }
  function showDone(b) {
    if (!mine || !mine.position) return;
    var p = mine.position, t = b.querySelector(".fd-ea__done-title"), x = b.querySelector(".fd-ea__done-text");
    if (b.classList.contains("fd-ea--dark")) {
      var g = Math.ceil(p / SIZE);
      t.textContent = mine.existing ? "This email is already in Group " + g + "." : "You are in Group " + g + ".";
      x.textContent = "Your place is No. " + num(p) + ". Group " + g + " gets access on " + longDate(groupDate(g)) + ". We will email your access link.";
    } else if (p <= CAP) {
      t.textContent = mine.existing ? "You already hold place No. " + p + "." : "You are on the list.";
      x.textContent = "We will email your access link on 25 October 2026.";
    } else {
      t.textContent = "You are No. " + p + " on the waiting list.";
      x.textContent = "All 500 places in the first batch are taken. We will write to you if one opens up.";
    }
    b.classList.add("is-done");
  }

  // ---------- countdown
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parts(target) {
    var s = Math.floor(Math.max(0, target - Date.now()) / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }
  function tick() {
    blocks.forEach(function (b) {
      var q = function (k) { return b.querySelector('[data-t="' + k + '"]'); };
      if (q("d")) {
        // dark block: the current group's access day at 09:00 Riga; "--" until that date is filled in
        var target = rigaNine(groupDate(state.total === null ? 1 : group(state.total).g));
        var c = target === null ? null : parts(target);
        ["d", "h", "m", "s"].forEach(function (k) { q(k).textContent = c ? pad(c[k]) : "--"; });
      }
    });
  }

  // ---------- live count (real signups only)
  function apply(data) {
    if (!data || typeof data.total !== "number") return;
    state.total = data.total; state.next = data.total + 1;
    render();
  }
  function poll() {
    if (inflight || document.hidden) return;
    inflight = true;
    fetch(API, { cache: "no-store", headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { inflight = false; apply(d); })
      .catch(function () { inflight = false; });
  }
  function schedule() {
    var on = visible.size > 0 && !document.hidden;
    if (on && !timer) { poll(); timer = setInterval(poll, POLL_MS); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  }
  document.addEventListener("visibilitychange", schedule);

  // ---------- form
  var ERR = {
    invalid_email: "Please check the email address.",
    consent_required: "Please tick the box to agree to receive emails about this offer.",
    rate_limited: "Too many sign-ups from this connection. Please try again in a few minutes.",
  };
  function onSubmit(e) {
    e.preventDefault();
    var f = e.target, input = f.querySelector('input[name="email"]'), btn = f.querySelector("button"), msg = f.querySelector(".fd-ea__msg");
    var email = input.value.trim();
    msg.className = "fd-ea__msg"; msg.textContent = "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.className = "fd-ea__msg is-error"; msg.textContent = ERR.invalid_email; input.focus(); return; }
    var box = f.querySelector('input[name="consent"]');
    if (!box.checked) { msg.className = "fd-ea__msg is-error"; msg.textContent = ERR.consent_required; box.focus(); return; }
    btn.disabled = true;
    fetch(API, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: email, consent: box.value, source: f.getAttribute("data-source"), company: f.querySelector('input[name="company"]').value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) throw new Error(res.d.error || "server");
        if (res.d.position) {
          mine = { position: res.d.position, existing: !!res.d.existing };
          share(mine, res.d.total);
        }
        apply(res.d);
        blocks.forEach(showDone);
      })
      .catch(function (err) {
        msg.className = "fd-ea__msg is-error";
        msg.textContent = ERR[err.message] || "Something went wrong. Please try again in a moment.";
      })
      .then(function () { btn.disabled = false; });
  }

  // another person on the same device: forget this browser's place and show the form again
  function again() {
    mine = null;
    try { localStorage.removeItem(KEY); } catch (_) {}
    document.cookie = "fd_wl_key=; Max-Age=0; Path=/; SameSite=Lax";
    blocks.forEach(function (b) { b.classList.remove("is-done"); var i = b.querySelector('input[name="email"]'); i.value = ""; });
    render();
    var own = this && this.closest ? this.closest(".fd-ea") : null; if (own) own.querySelector('input[name="email"]').focus();
    if (own) { try { window.dispatchEvent(new CustomEvent("fd-wl-reset", { detail: { from: "fd-ea" } })); } catch (_) {} }
  }
  // the other block's "Add another email": this one goes back to its form as well
  window.addEventListener("fd-wl-reset", function (e) { if (mine && !(e.detail && e.detail.from === "fd-ea")) again.call(null); });

  // ---------- mounting
  function make(cls, html, order, label) {
    var el = document.createElement("section");
    el.className = "fd-ea " + cls; el.innerHTML = html; el.style.order = order;
    el.setAttribute("aria-label", label);
    el.querySelector("form").addEventListener("submit", onSubmit);
    el.querySelector(".fd-ea__again").addEventListener("click", again);
    return el;
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
    schedule();
  }, { rootMargin: "300px 0px" }) : null;

  function stack() {
    var a = document.getElementById("team");
    a = a && a.parentElement;
    while (a && getComputedStyle(a).display === "contents") a = a.parentElement;
    return a;
  }
  function mount() {
    var host = stack(); if (!host) return false;
    if (!blocks.length) {
      // dark: after the video section and before the team (team and below are order 3);
      // ticket: after the last content block and before the footer (footer stack items are 1003+)
      blocks = [make("fd-ea--dark", DARK, 1, "Fundaro bonds: join the waitlist"), make("fd-ea--ticket", TICKET, 1002, "Fundaro bonds: reserve a place")];
      blocks[0].id = "early-access";
      blocks[1].id = "reserve";
      if (WL) { blocks.shift(); loadPreview(WL); }
    }
    blocks.forEach(function (b) {
      if (b.parentElement !== host) { host.appendChild(b); if (io) io.observe(b); }
    });
    if (!io) { blocks.forEach(function (b) { visible.add(b); }); schedule(); }
    render(); tick(); blocks.forEach(showDone);
    return true;
  }
  function hydrated(el) {
    for (var k in el) if (k.indexOf("__reactFiber") === 0 || k.indexOf("__reactInternalInstance") === 0) return true;
    return false;
  }
  function start() {
    var tries = 0;
    (function wait() {
      var t = document.getElementById("team");
      if (t && (window.FD_NO_FRAMER || hydrated(t) || tries > 80)) {
        mount();
        poll();
        setInterval(function () { if (!document.hidden) tick(); }, 1000);
        // React can re-render the page stack (breakpoint changes); put the blocks back if they were dropped
        var queued = false;
        if ("MutationObserver" in window) new MutationObserver(function () {
          if (queued) return; queued = true;
          setTimeout(function () {
            queued = false;
            if (blocks.some(function (b) { return !b.isConnected || b.parentElement !== stack(); })) mount();
          }, 200);
        }).observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
      } else if (tries++ < 200) setTimeout(wait, 100);
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
