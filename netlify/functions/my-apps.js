// Netlify Function "my-apps": liefert die Liste "Meine Apps" für den Admin Bereich von Backstage.
// Die Links stehen NUR hier auf dem Server (Netlify Variable MY_APPS), nicht im öffentlichen Code.
// Das Passwort steht ebenfalls nur als Netlify Variable (ADMIN_PASSWORD), nie im Code.
//
// Einrichtung bei Netlify (Site configuration, Environment variables):
//   ADMIN_PASSWORD  ein neues, langes Passwort nur für diese Liste
//   MY_APPS         die Liste als JSON (siehe Datei my-apps-variable.txt)
// Danach unter Deploys einmal neu deployen, damit die Function die Variablen sieht.
const crypto = require("crypto");

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "POST erwartet" });
  let payload;
  try { payload = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Ungültige Anfrage" }); }

  const secret = process.env.ADMIN_PASSWORD;
  const raw = process.env.MY_APPS;
  if (!secret || !raw) return reply(500, { error: "Noch nicht eingerichtet" });

  // Vergleich über Hashes mit konstanter Zeit, bei falschem Passwort eine kurze Bremse gegen Durchprobieren
  const given = typeof payload.password === "string" ? payload.password : "";
  if (!crypto.timingSafeEqual(sha(given), sha(secret))) {
    await sleep(Number(process.env.APPS_FAIL_DELAY_MS || 1200));
    return reply(401, { error: "Falsches Passwort" });
  }

  let list;
  try { list = JSON.parse(raw); } catch { return reply(500, { error: "MY_APPS ist kein gültiges JSON" }); }
  if (!Array.isArray(list)) return reply(500, { error: "MY_APPS muss eine Liste sein" });

  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const apps = list
    .map((a) => ({
      id: str(a && a.id, 40),
      name: str(a && a.name, 60),
      url: str(a && a.url, 300),
      beschreibung: str(a && a.beschreibung, 240),
      kategorie: str(a && a.kategorie, 40),             // optional, zum Beispiel "Extern genutzt"
      icon: str(a && a.icon, 40).replace(/[^a-z0-9_]/gi, ""), // optional, id eines vorhandenen Icons, falls die App kein eigenes hat
    }))
    .filter((a) => a.name && /^https:\/\//i.test(a.url)); // nur https Links, nichts anderes (kein javascript:)
  return reply(200, { apps });
};
