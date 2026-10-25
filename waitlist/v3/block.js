// Waitlist block v3 (preview only: add ?wl=v3 to the page address). Values to fill in: config.js in this folder.
// fd-early.js loads this file in place of the default dark block when the preview parameter is present.
// Counts come live from GET /api/early-access (real signups only); the form posts to the same endpoint.
(() => {
  const V = "v3", P = "wl-v3";
  const CFG = window.FD_WL_V3_CONFIG || {};
  const API = (window.FD_API_BASE || "") + "/api/early-access", SIZE = 500, POLL_MS = 4000;
  const LABEL = "Fundaro bonds: get your key";
  const GIFT = CFG.GIFT_ENABLED === true;
  const state = { total: null, g: 0, mode: 0, lit: -1 };
  let el = null, timer = null, inflight = false, onScreen = false, mine = null;

  // ---------- text helpers
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const isSet = (v) => v !== undefined && v !== null && String(v).trim() !== "" && !/^\[.*\]$/.test(String(v).trim());
  // a config value, or its visible [PLACEHOLDER] until it is filled in
  const val = (k) => (isSet(CFG[k]) ? String(CFG[k]).trim() : "[" + k + "]");
  const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prospectusLink = (u = val("PROSPECTUS_URL")) => /^https?:\/\//i.test(u)
    ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0]) + "</a>"
    : '<a class="is-placeholder">' + esc(u) + "</a>";
  const privacyLink = () => isSet(CFG.PRIVACY_URL)
    ? '<a href="' + esc(String(CFG.PRIVACY_URL).trim()) + '">Privacy policy</a>'
    : 'Privacy policy <a class="is-placeholder">[PRIVACY_URL]</a>';

  const PROSPECTUS = () => '<div class="' + P + '__prosp"><p>The prospectus is available at ' + prospectusLink() + ".</p>" +
    "<p>The prospectus of SIA Fundaro dated 29 September 2026 was approved by Latvijas Banka on 8 October 2026. " +
    "Approval of the prospectus should not be understood as an endorsement of the bonds.</p></div>";
  const BOTTOM_LEGAL = "Read the prospectus before investing to fully understand the potential risks and rewards of the decision to invest. " +
    "The offer is addressed only to residents of Latvia, Germany and Spain. Information on this website does not form part of the " +
    "prospectus and has not been reviewed or approved by Latvijas Banka.";

  // groups of 500: total signups -> current group g and n = signups inside it (500 exactly opens the next group)
  const group = (t) => ({ g: Math.floor(t / SIZE) + 1, n: t % SIZE });
  const GIFT_LINE = "Every key in Group 1 comes with a hand-painted Málaga azulejo tile, sent by post. For registering. No investment required.";
  // four paragraphs in one style (.wl-v3__lead p): the offer with its rate, how access works, the risk, the prospectus
  const lead = (g) => "<p>Behind it: Fundaro bonds funding two apartments in El Limonar, Málaga. One bond costs EUR 500. 15% per annum, paid with your principal in one payment at redemption, no later than 24 months after issue.</p>" +
    "<p>Bonds are allotted in the order payments arrive. " + (g === 1
      ? "Before you can pay, you need to pass identity verification, so we hand out keys in groups of 500. Group 1 gets its keys on " + esc(val("DATE_GROUP1")) + ", ready before subscriptions open for everyone."
      : "Group " + (g - 1) + " is full. Group " + g + " gets its keys on " + esc(val("DATE_GROUP1")) + ", still before subscriptions open for everyone.") +
    " If EUR 2,174,000 is not raised, every euro is refunded in full within 10 business days.</p>" +
    "<p>The bonds are unsecured. You could lose all or part of your investment. Not covered by any deposit guarantee or investor compensation scheme.</p>" +
    "<p>The prospectus is available at " + prospectusLink() + ". The prospectus of SIA Fundaro dated 29 September 2026 was approved by Latvijas Banka on 8 October 2026. " +
    "Approval of the prospectus should not be understood as an endorsement of the bonds.</p>";

  // the key on the button turns when a valid email is sent
  const KEY_ICON = '<span class="' + P + '__key" aria-hidden="true"><svg viewBox="0 0 30 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="5.5" cy="7" r="4.2"/><path d="M9.7 7H28M22 7v3.6M25.5 7v2.6"/></svg></span>';
  const TURN_MS = 950;
  // marketing consent: the id is stored with the signup; change it whenever the text changes
  const CONSENT_ID = "terms-offer-emails-2026-10-15";
  const CONSENT_TEXT = 'I agree to the <a href="./terms/">Terms</a> and to receive emails from SIA Fundaro about this bond offer, including my key. I can unsubscribe at any time.';
  const onTry = (btn) => { btn.classList.remove("is-turned"); void btn.offsetWidth; btn.classList.add("is-turned"); };
  const onFail = (btn) => { btn.classList.remove("is-turned"); };
  // the visitor's key number is kept in a cookie (60 days), so the page can show it and light their window again
  const COOKIE = "fd_wl_key";
  // the other signup block on the page (fd-early.js) keeps it in localStorage "fd-ea-place"; both stay in step
  const remember = (m) => {
    document.cookie = COOKIE + "=" + encodeURIComponent(m.position) + "; Max-Age=5184000; Path=/; SameSite=Lax";
    try { localStorage.setItem("fd-ea-place", JSON.stringify({ position: m.position, existing: m.existing })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("fd-wl-signup", { detail: { position: m.position, total: m.total, from: P } })); } catch (_) {}
  };
  const stored = () => { try { const v = JSON.parse(localStorage.getItem("fd-ea-place") || "null"); if (v && v.position) mine = { position: +v.position, existing: true, fromCookie: true }; } catch (_) {} };
  const recall = (c = /(?:^|;\s*)fd_wl_key=(\d+)/.exec(document.cookie)) => (c ? { position: +c[1], existing: true, fromCookie: true } : (stored(), mine));
  window.addEventListener("fd-wl-signup", (e) => {
    if (e.detail && e.detail.from !== P && e.detail.position && el) {
      mine = { position: +e.detail.position, existing: true, fromCookie: true };
      if (typeof e.detail.total === "number") apply({ total: e.detail.total });
      showDone();
    }
  });
  const NOTE = "Every group gets its keys before subscriptions open, and subscriptions open for everyone at the same time. " +
    "We use your email only for your key and news about this offer. Unsubscribe any time. ";

  const HTML = () => '<div class="' + P + '__wrap">' +
    '<div class="' + P + "__top " + P + '__eyebrow"><span>Fundaro Bonds</span><span>Advertisement</span></div>' +
    '<div class="' + P + '__grid2"><div class="' + P + '__col">' +
      '<span class="' + P + "__pill " + P + '__eyebrow" data-wl="badge">Group 1 · Keys 1 to 500</span>' +
      '<h2 class="' + P + '__h">The door opens<br> in groups.</h2>' +
      '<div class="' + P + '__lead" data-lead>' + lead(1) + "</div>" +
      (GIFT ? '<p class="' + P + '__gift">' + GIFT_LINE + "</p>" : "") +

      form("Get your key", esc(NOTE) + privacyLink(), KEY_ICON) +
    '</div><div class="' + P + '__col">' +
      '<div class="' + P + '__live"><div class="' + P + '__count" aria-live="polite"><span class="' + P + "__big " + P + '__num" data-wl="n"></span><span class="' + P + '__of">/ 500</span></div>' +
      '<p class="' + P + "__left " + P + '__eyebrow" data-wl="left"></p>' +
      '<p class="' + P + "__mykey " + P + '__eyebrow" data-mykey hidden></p>' +
      '<div class="' + P + '__prev" hidden><p class="' + P + '__eyebrow" data-prev-label></p><div data-prev-svg></div></div>' +
      '<div class="' + P + '__facade" aria-hidden="true"></div>' +
      '<p class="' + P + '__caption" data-wl="caption"></p></div>' +
    "</div>" +
    '<p class="' + P + '__legal">' + BOTTOM_LEGAL + "</p>" +
    "</div></div>";

  const form = (cta, note, icon) => '<form class="' + P + '__form" novalidate>' +
    '<label class="' + P + "__label " + P + '__eyebrow" for="' + P + '-email">Your email</label>' +
    '<div class="' + P + '__row"><input class="' + P + '__input" id="' + P + '-email" type="email" name="email" autocomplete="email" inputmode="email" ' +
    'placeholder="name@example.com" required maxlength="254">' +
    '<button class="' + P + '__btn" type="submit"><span data-cta>' + cta + '</span>' + (icon || '<span class="' + P + '__arrow" aria-hidden="true">&#8594;</span>') + "</button></div>" +
    '<label class="' + P + '__consent"><input type="checkbox" name="consent" value="' + CONSENT_ID + '"><span>' + CONSENT_TEXT + "</span></label>" +
    '<label class="' + P + '__hp" aria-hidden="true">Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label>' +
    '<p class="' + P + '__msg" role="status" aria-live="polite"></p>' +
    '<p class="' + P + '__note">' + note + "</p></form>" +
    '<div class="' + P + '__done" role="status" aria-live="polite"><p class="' + P + '__done-title"></p><p class="' + P + '__done-text"></p>' +
      '<button type="button" class="' + P + '__again">Add another email</button></div>';

  // ---------- signup (same endpoint and rules as the default block)
  const ERR = { invalid_email: "Please check the email address.", consent_required: "Please tick the box to agree to receive emails about this offer.", rate_limited: "Too many sign-ups from this connection. Please try again in a few minutes." };
  const onSubmit = (e) => {
    e.preventDefault();
    const f = e.target, input = f.querySelector('input[name="email"]'), btn = f.querySelector("button"), msg = f.querySelector("." + P + "__msg");
    const email = input.value.trim();
    msg.className = P + "__msg"; msg.textContent = "";
    const box = f.querySelector('input[name="consent"]');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.className = P + "__msg is-error"; msg.textContent = ERR.invalid_email; input.focus(); }
    else if (!box.checked) { msg.className = P + "__msg is-error"; msg.textContent = ERR.consent_required; box.focus(); }
    else {
      btn.disabled = true;
      onTry(btn);
      fetch(API, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: email, consent: box.value, source: P, company: f.querySelector('input[name="company"]').value }) })
        .then((r) => r.json().catch(() => ({})).then((d) => ({ ok: r.ok, d: d })))
        .then((res) => {
          if (!res.ok || !res.d.ok) throw new Error(res.d.error || "server");
          mine = { position: res.d.position, existing: !!res.d.existing };
          remember({ position: mine.position, existing: mine.existing, total: res.d.total });
          if (typeof res.d.total === "number") apply(res.d);
          // let the key finish its turn before the form gives way to the confirmation
          setTimeout(showDone, TURN_MS);
        })
        .catch((err) => { onFail(btn); msg.className = P + "__msg is-error"; msg.textContent = ERR[err.message] || "Something went wrong. Please try again in a moment."; })
        .then(() => { btn.disabled = false; });
    }
  };

  // ---------- the lit facade: a historic Andalusian house, 25 bays x 4 storeys.
  // 500 windows, one person each. (Mode 2, 250 windows, is kept in the drawing code but no longer used.)
  const VW = 1040, VH = 512, X0 = 20, BAYS = 25, BW = 40, MIN_LIGHT = 10.2;
  const FLOORS = [ // top to bottom: storey height, opening width and height, rows of lights, arched head, iron balcony
    { h: 92, w: 26, oh: 50, rows: 2, arch: false, rail: false },
    { h: 100, w: 28, oh: 60, rows: 2, arch: true, rail: true },
    { h: 124, w: 30, oh: 84, rows: 3, arch: true, rail: true },
    { h: 134, w: 30, oh: 92, rows: 3, arch: true, rail: false },
  ];
  // fixed lighting order (seeded shuffle): the same windows light up in the same order on every load.
  // ORDER[count][k] = the window that lights up k-th.
  const ORDER = {};
  const order = (count) => {
    if (!ORDER[count]) {
      const a = Array.from({ length: count }, (_, i) => i);
      let s = 500;
      for (let i = count - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) % 4294967296; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      ORDER[count] = a;
    }
  };
  // fills o.dark / o.lit / o.deco with SVG elements
  const drawParts = (mode, allLit, o) => {
    const cols = mode === 1 ? 2 : 1, dark = o.dark, lit = o.lit, deco = o.deco;
    let y = 46;
    deco.push('<polygon points="' + (X0 - 12) + ",46 " + (X0 + 26) + ",10 " + (X0 + 974) + ",10 " + (X0 + 1012) + ',46" class="' + P + '__roof"/>');
    for (let x = X0 + 30; x < X0 + 972; x += 9) deco.push('<line x1="' + x + '" y1="12" x2="' + (x - 3) + '" y2="45" class="' + P + '__tile"/>');
    deco.push('<rect x="' + (X0 - 6) + '" y="44" width="1012" height="7" class="' + P + '__cornice"/>');
    deco.push('<rect x="' + X0 + '" y="51" width="1000" height="452" class="' + P + '__wall"/>');
    y = 51;
    FLOORS.forEach((f, fi) => {
      if (fi) deco.push('<rect x="' + X0 + '" y="' + (y - 1.5) + '" width="1000" height="3" class="' + P + '__band"/>');
      for (let b = 0; b < BAYS; b++) {
        const cx = X0 + BW / 2 + b * BW, ox = cx - f.w / 2, oy = y + (f.h - f.oh) * (f.arch ? 0.62 : 0.45);
        if (f.arch) deco.push('<path d="M' + ox + " " + oy + " A" + f.w / 2 + " " + f.w / 2 + " 0 0 1 " + (ox + f.w) + " " + oy + 'Z" class="' + P + '__arch"/>');
        deco.push('<rect x="' + ox + '" y="' + oy + '" width="' + f.w + '" height="' + f.oh + '" class="' + P + '__frame"/>');
        const lw = (f.w - 4 - (cols - 1) * 1.6) / cols, lh = (f.oh - 4 - (f.rows - 1) * 1.6) / f.rows;
        for (let r = 0; r < f.rows; r++) for (let c = 0; c < cols; c++) {
          const lx = (ox + 2 + c * (lw + 1.6)).toFixed(2), ly = (oy + 2 + r * (lh + 1.6)).toFixed(2), i = dark.length;
          dark.push('<rect x="' + lx + '" y="' + ly + '" width="' + lw.toFixed(2) + '" height="' + lh.toFixed(2) + '" class="' + P + '__w"/>');
          lit.push('<rect x="' + lx + '" y="' + ly + '" width="' + lw.toFixed(2) + '" height="' + lh.toFixed(2) + '" class="' + P + "__l" + (allLit ? " on" : "") + '" data-i="' + i + '"/>');
        }
        if (f.rail) {
          const rx = ox - 5, ry = oy + f.oh - 13, rw = f.w + 10;
          let bars = "M" + rx + " " + ry + " h" + rw + " M" + rx + " " + (ry + 13) + " h" + rw;
          for (let k = rx + 2.5; k < rx + rw; k += 3.4) bars += " M" + k.toFixed(1) + " " + ry + " v13";
          deco.push('<path d="' + bars + '" class="' + P + '__rail"/>');
        }
      }
      y += f.h;
    });
    deco.push('<rect x="' + (X0 - 4) + '" y="503" width="1008" height="9" class="' + P + '__plinth"/>');
  };
  const facadeSvg = (mode, allLit, o = { dark: [], lit: [], deco: [] }, fid = P + "-glow-" + mode + (allLit ? "-all" : "")) => (drawParts(mode, allLit, o),
    '<svg viewBox="0 0 ' + VW + " " + VH + '" preserveAspectRatio="xMidYMid meet" focusable="false">' +
      '<defs><filter id="' + fid + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      o.deco.join("") + "<g>" + o.dark.join("") + '</g><g filter="url(#' + fid + ')">' + o.lit.join("") + "</g></svg>");
  // always 500 windows, one per person (phones too: the lit windows stay readable as points of light)
  const modeFor = () => 1;

  // ---------- rendering
  const setText = (sel, t) => el.querySelectorAll(sel).forEach((n) => { n.textContent = t; });
  const render = () => {
    if (state.total !== null) {
      const G = group(state.total), g = G.g, n = G.n, left = SIZE - n;
      el.classList.add("is-live");
      setText('[data-wl="badge"]', "Group " + g + " · Keys " + num((g - 1) * SIZE + 1) + " to " + num(g * SIZE));
      // signed up: the big number is the visitor's own key (same as the ticket block); the count moves to the pill
      const handed = num(n) + (n === 1 ? " key" : " keys") + " handed out · " + num(left) + " left";
      setText('[data-wl="n"]', String(mine ? mine.position : n));
      setText('[data-wl="left"]', mine ? "Your key · Group " + g : "Group " + g + " · " + handed);
      if (mine) { const mk = el.querySelector("[data-mykey]"); mk.textContent = handed; mk.hidden = false; }
      if (state.g !== g) el.querySelector("[data-lead]").innerHTML = lead(g);
      drawFacade(g, n);
      setText('[data-wl="caption"]', g === 1
        ? "Each window is one person. " + n + " lit, " + left + " dark. The count updates live."
        : "Group " + (g - 1) + ": all 500 windows lit. Group " + g + ": " + n + " lit, " + left + " dark.");
    }
  };
  const drawFacade = (g, n) => {
    const box = el.querySelector("." + P + "__facade"), mode = modeFor(box.clientWidth || 515);
    if (mode !== state.mode || g !== state.g) {
      box.innerHTML = facadeSvg(mode, false);
      el.classList.remove("is-ready");
      state.lit = -1;
      const prev = el.querySelector("." + P + "__prev");
      prev.hidden = g === 1;
      if (g > 1) {
        prev.querySelector("[data-prev-label]").textContent = "Group " + (g - 1) + " · all 500 windows lit";
        prev.querySelector("[data-prev-svg]").innerHTML = facadeSvg(mode, true);
        // the next group's facade slides in
        box.classList.remove("is-slide"); void box.offsetWidth; box.classList.add("is-slide");
      }
      state.mode = mode; state.g = g;
    }
    const count = mode === 1 ? 500 : 250, want = mode === 1 ? n : Math.ceil(n / 2);
    order(count);
    if (want !== state.lit) {
      const seq = ORDER[count], lights = box.querySelectorAll("." + P + "__l");
      for (let k = 0; k < count; k++) lights[seq[k]].classList.toggle("on", k < want);
      // the first draw shows the current count at once; windows lit after that fade in with a 600ms glow
      if (state.lit === -1) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-ready")));
      state.lit = want;
    }
    markMine(g, mode);
  };
  // the visitor's own window (from their key number) keeps flashing; it may sit in the previous group's facade
  const markMine = (g, mode) => {
    el.querySelectorAll("." + P + "__l.is-mine").forEach((x) => x.classList.remove("is-mine"));
    if (mine && mine.position) {
      const mg = Math.floor((mine.position - 1) / SIZE) + 1, inGroup = mine.position - (mg - 1) * SIZE;
      const k = mode === 1 ? inGroup - 1 : Math.ceil(inGroup / 2) - 1, count = mode === 1 ? 500 : 250;
      const svg = mg === g ? el.querySelector("." + P + "__facade svg") : (mg === g - 1 ? el.querySelector("[data-prev-svg] svg") : null);
      order(count);
      if (svg) {
        const light = svg.querySelectorAll("." + P + "__l")[ORDER[count][k]];
        if (light) { light.classList.add("on"); setTimeout(() => light.classList.add("is-mine"), 650); }
      }
    }
  };
  // another person on the same device: forget this browser's key and show the form again (both blocks together)
  const reset = (own) => {
    mine = null;
    document.cookie = COOKIE + "=; Max-Age=0; Path=/; SameSite=Lax";
    try { localStorage.removeItem("fd-ea-place"); } catch (_) {}
    el.classList.remove("is-done");
    el.querySelector("[data-mykey]").hidden = true;
    el.querySelectorAll(".is-mine").forEach((w) => w.classList.remove("is-mine"));
    const input = el.querySelector('input[name="email"]'), msg = el.querySelector("." + P + "__msg");
    input.value = ""; msg.className = P + "__msg"; msg.textContent = "";
    if (state.total !== null) render();
    if (own) {
      try { window.dispatchEvent(new CustomEvent("fd-wl-reset", { detail: { from: P } })); } catch (_) {}
      input.focus();
    }
  };
  window.addEventListener("fd-wl-reset", (e) => { if (el && mine && !(e.detail && e.detail.from === P)) reset(false); });
  const showDone = () => {
    const t = el.querySelector("." + P + "__done-title"), x = el.querySelector("." + P + "__done-text");
    t.textContent = "You're in. Key no. " + num(mine.position) + ".";
    x.textContent = "Your key arrives by email on " + val("DATE_GROUP1") + ". Use it to open the platform and get verified, so you're ready the moment subscriptions open.";
    if (GIFT && !el.querySelector("." + P + "__giftstep")) {
      const s = document.createElement("div");
      s.className = P + "__giftstep";
      s.innerHTML = '<form novalidate><label class="' + P + "__label " + P + '__eyebrow" for="' + P + '-address">Where should we send your tile? (optional)</label>' +
        '<div class="' + P + '__row"><input class="' + P + '__input" id="' + P + '-address" name="address" autocomplete="street-address" placeholder="Address">' +
        '<button class="' + P + '__btn" type="submit"><span>Send my tile</span></button></div>' +
        '<p class="' + P + '__msg" role="status" aria-live="polite"></p>' +
        '<p class="' + P + '__note">No investment required. The tile is yours for registering.</p></form>';
      // there is no address endpoint yet (the database and API stay unchanged): say so instead of pretending to save it
      s.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); e.target.querySelector("." + P + "__msg").textContent = "Saving addresses is not connected yet."; });
      el.querySelector("." + P + "__done").appendChild(s);
    }
    el.classList.add("is-done");
    const mk = el.querySelector("[data-mykey]");
    mk.textContent = "Your key · No. " + num(mine.position); mk.hidden = false;
    if (state.total !== null) { render(); markMine(state.g, state.mode); }
    // phones: after a fresh signup, glide down to the house so the lit window and the key number are in view
    if (!mine.fromCookie && PHONE.matches) setTimeout(() => glideTo(el.querySelector("." + P + "__live")), 120);
  };
  const PHONE = window.matchMedia("(max-width: 809px)");
  let glide = null;
  const glideTo = (target) => {
    const nav = document.querySelector("nav"), off = nav ? Math.min(nav.getBoundingClientRect().height, 100) + 12 : 12;
    const from = window.scrollY, to = Math.max(0, target.getBoundingClientRect().top + from - off), dist = to - from;
    const dur = Math.min(1300, 450 + Math.abs(dist) * 0.5);
    let t0 = null;
    if (glide) cancelAnimationFrame(glide);
    const step = (t) => {
      if (t0 === null) t0 = t;
      let k = Math.min(1, (t - t0) / dur);
      k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, from + dist * k);
      glide = k < 1 ? requestAnimationFrame(step) : null;
    };
    glide = requestAnimationFrame(step);
  };
  const afterBuild = () => {
    mine = recall();
    if (mine) showDone();
    if ("ResizeObserver" in window) new ResizeObserver(() => { if (state.total !== null) render(); }).observe(el.querySelector("." + P + "__facade"));
  };

  // ---------- live count: real signups only, polled while the block is on screen
  const apply = (data) => {
    if (data && typeof data.total === "number") { state.total = data.total; render(); }
  };
  const poll = () => {
    if (!inflight && !document.hidden) {
      inflight = true;
      fetch(API, { cache: "no-store", headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null)).then((d) => { inflight = false; apply(d); })
        .catch(() => { inflight = false; });
    }
  };
  const schedule = () => {
    const on = onScreen && !document.hidden;
    if (on && !timer) { poll(); timer = setInterval(poll, POLL_MS); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  };
  const startLive = () => {
    poll();
    new IntersectionObserver((es) => { es.forEach((e) => { onScreen = e.isIntersecting; }); schedule(); }, { rootMargin: "300px 0px" }).observe(el);
    document.addEventListener("visibilitychange", schedule);
  };

  // ---------- mounting: fd-early.js loads this file only for ?wl=VERSION and leaves the default dark block out.
  // The block takes the dark block's place in Framer's page stack (flex order 1, after the video section).
  const host = () => (document.getElementById("reserve") || {}).parentElement || null;
  const mount = () => {
    const h = host();
    if (h && el.parentElement !== h) { h.appendChild(el); }
  };
  const start = () => {
    el = document.createElement("section");
    el.className = P; el.id = "early-access"; el.style.order = "1";
    el.setAttribute("aria-label", LABEL);
    el.innerHTML = HTML();
    el.querySelector("form").addEventListener("submit", onSubmit);
    el.querySelector("." + P + "__again").addEventListener("click", () => reset(true));
    afterBuild();
    let tries = 0;
    const wait = () => {
      if (host()) {
        mount(); render();
        new MutationObserver(() => { if (!el.isConnected) setTimeout(mount, 200); })
          .observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
        startLive();
      } else if (tries++ < 300) setTimeout(wait, 100);
    };
    wait();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
