// Waitlist API for the keys block (waitlist/v3/block.js) and the dark block (fd-early.js), stored in Brevo.
//   GET  /api/early-access -> { total, size, count, next }       live count of keys handed out
//   POST /api/early-access    { email, consent, source, company } -> { ok, position, existing, total }
// Every signup becomes a Brevo contact in BREVO_LIST_ID with its key number (KEY_NO), the consent text id
// (CONSENT_ID), the block it came from (SIGNUP_SOURCE) and the time (SIGNUP_AT).
// Environment (Vercel project settings):
//   BREVO_API_KEY  required for signups
//   BREVO_LIST_ID  required: the numeric id of the Brevo list the signups go into
//   KEYS_BASE      keys handed out before Brevo was connected (default 23); new keys are numbered after them.
//                  Set it to 0 once those earlier signups have been imported into the list.
"use strict";

const BREVO = "https://api.brevo.com/v3";
const SIZE = 500;
const KEY = process.env.BREVO_API_KEY || "";
const LIST = Number(process.env.BREVO_LIST_ID || 0);
const BASE = Number.isFinite(Number(process.env.KEYS_BASE)) && process.env.KEYS_BASE !== "" ? Number(process.env.KEYS_BASE) : 23;
// the consent text ids the blocks send; a signup with anything else is refused
const CONSENTS = new Set(["terms-offer-emails-2026-10-15"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function brevo(path, init = {}) {
  const r = await fetch(BREVO + path, {
    ...init,
    headers: { "api-key": KEY, accept: "application/json", "content-type": "application/json", ...(init.headers || {}) },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = { message: text }; }
  return { status: r.status, ok: r.ok, body };
}

// the contact attributes this API writes; created once per instance if the account does not have them yet
let attrsReady = false;
async function ensureAttributes() {
  if (attrsReady) return;
  const want = { KEY_NO: "float", CONSENT_ID: "text", SIGNUP_SOURCE: "text", SIGNUP_AT: "date" };
  await Promise.all(Object.keys(want).map((name) =>
    brevo("/contacts/attributes/normal/" + name, { method: "POST", body: JSON.stringify({ type: want[name] }) })));
  attrsReady = true;   // "already exists" answers are fine
}

// keys handed out = the earlier signups + the contacts in the list
async function total() {
  if (!KEY || !LIST) return BASE;
  const r = await brevo("/contacts/lists/" + LIST + "/contacts?limit=1&offset=0");
  if (!r.ok) throw new Error("brevo_count_" + r.status);
  return BASE + (Number(r.body && r.body.count) || 0);
}

const counts = (t) => ({ total: t, size: SIZE, count: t, next: t + 1 });

module.exports = async (req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      // shared by every visitor for a few seconds, so polling does not reach Brevo once per browser
      res.setHeader("cache-control", "public, max-age=0, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).send(req.method === "HEAD" ? "" : JSON.stringify(counts(await total())));
    }
    if (req.method !== "POST") { res.setHeader("allow", "GET, POST"); return res.status(405).send(JSON.stringify({ ok: false, error: "method" })); }
    res.setHeader("cache-control", "no-store");

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = String(b.email || "").trim().toLowerCase();
    // the hidden "company" field is only ever filled in by bots: answer as if it worked, store nothing
    if (b.company) return res.status(200).send(JSON.stringify({ ok: true, position: 0, existing: false, total: await total() }));
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).send(JSON.stringify({ ok: false, error: "invalid_email" }));
    if (!CONSENTS.has(String(b.consent || ""))) return res.status(400).send(JSON.stringify({ ok: false, error: "consent_required" }));
    if (!KEY || !LIST) return res.status(503).send(JSON.stringify({ ok: false, error: "not_configured" }));

    // already signed up: same key number as before
    const found = await brevo("/contacts/" + encodeURIComponent(email));
    if (found.ok && (found.body.listIds || []).includes(LIST) && found.body.attributes && found.body.attributes.KEY_NO) {
      return res.status(200).send(JSON.stringify({ ok: true, position: Number(found.body.attributes.KEY_NO), existing: true, total: await total() }));
    }

    await ensureAttributes();
    const position = (await total()) + 1;
    const saved = await brevo("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        listIds: [LIST],
        updateEnabled: true,
        attributes: {
          KEY_NO: position,
          CONSENT_ID: String(b.consent),
          SIGNUP_SOURCE: String(b.source || "").slice(0, 40),
          SIGNUP_AT: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    if (!saved.ok) throw new Error("brevo_save_" + saved.status + " " + JSON.stringify(saved.body));
    return res.status(200).send(JSON.stringify({ ok: true, position, existing: false, total: position }));
  } catch (err) {
    console.error("early-access", err && err.message);
    return res.status(502).send(JSON.stringify({ ok: false, error: "server" }));
  }
};
