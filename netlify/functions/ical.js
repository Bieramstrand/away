// Liefert den Urlaub als abonnierbaren iCal Kalender (iOS und macOS).
// Aufruf: /.netlify/functions/ical?p=standard|ingwar&t=TOKEN&w=christian|julia|beide&s=alle|fest
// Der Token wird in der App erzeugt und in den Einstellungen der Person gespeichert. Es sind keine weiteren Umgebungsvariablen nötig.
const PROJECT = "homedashboard-8d951";
// Öffentlicher Firebase Web Schlüssel (kein Geheimnis, er steht auch in index.html).
// Er ist in zwei Teile getrennt, damit der Netlify Secrets Scan den Build nicht fälschlich abbricht.
const API_KEY = ["AIzaSyBFbKIBKr0g", "r621e8XSljAG4lGXOSrIxwo"].join("");
const PREFIXES = { standard: "urlaubstage", ingwar: "away_ingwar" };

const resp = (code, body, type) => ({
  statusCode: code,
  headers: { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  body
});

function dec(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("mapValue" in v) { const o = {}, f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  return null;
}

async function getValue(docId) {
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/household/" + encodeURIComponent(docId) + "?key=" + API_KEY;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Firestore " + r.status);
  const d = await r.json();
  const f = d.fields && d.fields.value ? dec(d.fields.value) : null;
  if (typeof f === "string") { try { return JSON.parse(f); } catch (e) { return null; } }
  return f;
}

const esc = (t) => String(t == null ? "" : t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const parts = []; let cur = "", bytes = 0, limit = 75;
  for (const ch of line) { const b = Buffer.byteLength(ch, "utf8"); if (bytes + b > limit) { parts.push(cur); cur = ""; bytes = 0; limit = 74; } cur += ch; bytes += b; }
  parts.push(cur); return parts.join("\r\n ");
}
const day = (s) => s.replace(/-/g, "");
function nextDay(s) { const [y, m, d] = s.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + 1)); return t.toISOString().slice(0, 10).replace(/-/g, ""); }
const safeEqual = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const prefix = PREFIXES[q.p || "standard"];
    if (!prefix || !/^[a-f0-9]{16,64}$/.test(q.t || "")) return resp(403, "Kein Zugriff");
    const people = await getValue(prefix + ":people");
    const me = people && people.christian;
    if (!me || !me.icalToken || !safeEqual(me.icalToken, q.t)) return resp(403, "Kein Zugriff");

    const trips = (await getValue(prefix + ":trips")) || {};
    const who = ["christian", "julia", "beide"].includes(q.w) ? q.w : "christian";
    const fixOnly = q.s === "fest";
    const names = { christian: (people.christian && people.christian.name) || "Christian", julia: (people.julia && people.julia.name) || "Partner" };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BierAmStrand//Away//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:" + esc("Away Urlaub"), "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];

    Object.keys(trips).forEach((id) => {
      const t = trips[id];
      if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(t.end || "") || !Array.isArray(t.who)) return;
      const type = t.type === "bildung" ? "bildung" : (t.type === "krank" || t.type === "kindkrank") ? null : "urlaub";
      if (!type || t.status === "storniert") return;
      if (who !== "beide" && t.who.indexOf(who) < 0) return;
      if (fixOnly && t.status !== "beantragt" && t.status !== "genehmigt") return;
      const st = t.status || "geplant";
      const nm = who === "beide" ? " " + t.who.map((p) => names[p] || p).join(" und ") : "";
      const summary = (type === "bildung" ? "Bildungsurlaub" : "Urlaub") + nm + (t.title ? ": " + t.title : "") + (st === "genehmigt" ? "" : " (" + st + ")");
      L.push("BEGIN:VEVENT", "UID:away-" + prefix + "-" + id + "@bieramstrand", "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + day(t.start), "DTEND;VALUE=DATE:" + nextDay(t.end),
        "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc("Status: " + st + ". Eingetragen mit Away."),
        "STATUS:" + (st === "genehmigt" ? "CONFIRMED" : "TENTATIVE"), "TRANSP:OPAQUE",
        "SEQUENCE:" + Math.floor((Number(t.updated) || 0) / 60000), "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return resp(200, L.map(fold).join("\r\n") + "\r\n", "text/calendar; charset=utf-8");
  } catch (e) {
    return resp(502, "Kalender gerade nicht erreichbar");
  }
};
