// Liest Kollegenurlaube aus Screenshot oder Text mit Perplexity aus.
// Benötigt die Umgebungsvariable PERPLEXITY_API_KEY in Netlify.
const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (code, obj) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Nur POST erlaubt" });
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return reply(500, { error: "PERPLEXITY_API_KEY fehlt in Netlify" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return reply(400, { error: "Ungültige Anfrage" }); }
  const prompt = String(body.prompt || "").slice(0, 30000);
  if (!prompt) return reply(400, { error: "Kein Auftrag übergeben" });

  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((u) => typeof u === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(u))
    .slice(0, 3);

  const content = [{ type: "text", text: prompt }];
  images.forEach((url) => content.push({ type: "image_url", image_url: { url } }));

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || "sonar",
        temperature: 0,
        disable_search: true,
        messages: [
          { role: "system", content: "Du extrahierst strukturierte Daten aus Bildern und Texten. Antworte ausschließlich mit gültigem JSON, ohne Erklärungen und ohne Quellenangaben." },
          { role: "user", content: images.length ? content : prompt }
        ]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return reply(502, { error: (data.error && data.error.message) || "Perplexity Fehler " + res.status });
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return reply(200, { text });
  } catch (e) {
    return reply(502, { error: "Perplexity nicht erreichbar" });
  }
};
