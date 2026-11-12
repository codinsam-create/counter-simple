# Counter

Ein minimaler Zähler als installierbare PWA – ohne Build-Schritt und ohne
Dependencies. Der Wert liegt aktuell nur lokal im Browser (`localStorage`).

## Funktionen

- Zählen per Buttons, Pfeiltasten ↑/↓ oder `+`/`-`
- Zurücksetzen per Button oder `R`
- Offline nutzbar (Service Worker cached die App-Shell)
- Installierbar (Manifest, Install-Prompt)
- Shortcut `?reset=1` setzt den Zähler beim Öffnen zurück
- Optionales Konto: Zähler wird über Supabase geräteübergreifend synchronisiert
- Offline-Zählungen werden lokal gepuffert und später nachgereicht

## Struktur

| Datei | Zweck |
| --- | --- |
| `index.html` | Markup der App |
| `styles.css` | Styling |
| `script.js` | Zähl-Logik, Persistenz, Auth, Sync, PWA-Handling |
| `config.js` | Öffentliche Supabase-URL und Publishable Key |
| `sw.js` | Service Worker (Offline-Cache) |
| `manifest.webmanifest` | PWA-Metadaten und Icons |
| `_headers` | Eigene HTTP-Header (Cloudflare, Netlify) |
| `vendor/` | Lokal mitgelieferte Fremdbibliotheken |
| `supabase/schema.sql` | Datenbank-Schema, RLS-Policies, RPC |
| `icons/` | App-Icons |

## Sync-Modell

Der Zähler ist ein unveränderliches Event-Log: Jede Änderung ist eine Zeile mit
`delta` und einer vom Client erzeugten `client_event_id`. Der Stand ist die
Summe der Deltas.

- **Idempotent:** `(user_id, client_event_id)` ist eindeutig. Ein Retry kann
  ein Event nicht doppelt zählen.
- **Offlinefähig:** Nicht gesendete Deltas liegen in `localStorage` und werden
  beim nächsten Verbindungsaufbau übertragen.
- **Konfliktfrei:** Zwei Geräte, die offline zählen, addieren ihre Deltas,
  statt sich gegenseitig zu überschreiben.
- **Sicher:** Row Level Security erlaubt jedem User nur die eigenen Events.

Der lokale Zählerstand wird beim ersten Login als Delta in das Konto übernommen.

## Lokal starten

Der Service Worker benötigt `http://localhost` oder HTTPS – ein direkter
Aufruf über `file://` funktioniert nicht.

```bash
python3 -m http.server 8000
# oder
npx serve .
```

Danach <http://localhost:8000> öffnen.

## Deployment

Die App läuft ohne Codeänderung auf drei Anbietern:

- GitHub Pages: <https://codinsam-create.github.io/counter-simple/>
- Cloudflare Workers: <https://counter-simple.codinsam.workers.dev/>
- Netlify: <https://counter-simple-f10c13.netlify.app/>

Details, Messwerte und Erkenntnisse stehen in [DEPLOY.md](DEPLOY.md).
Als Nächstes folgen Accounts und Sync über ein BaaS.
