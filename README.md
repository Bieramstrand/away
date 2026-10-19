# Away

Urlaubsplanung für Christian und Julia: Urlaub, Bildungsurlaub, Krankheitstage nach BV, Kind krank, Kollegenurlaube mit Überschneidungsprüfung, Export für Notizen und Urlaubsantrag per Mail.

## Einrichtung

1. Firebase ist bereits eingetragen (Projekt homedashboard-8d951).
2. Repo mit Netlify verbinden.
3. In Netlify unter Umgebungsvariablen setzen:
   * `PERPLEXITY_API_KEY` = dein Perplexity Schlüssel
   * `SECRETS_SCAN_OMIT_PATHS` = `index.html`
   * optional `PERPLEXITY_MODEL` = `sonar-pro`, falls Screenshots mit `sonar` nicht sauber erkannt werden
4. Auf dem iPhone die Seite in Safari öffnen, Teilen, „Zum Home Bildschirm“.

Daten liegen in Firestore in der Sammlung `household` unter `urlaubstage:people`, `urlaubstage:trips` und `urlaubstage:kollegen`.
