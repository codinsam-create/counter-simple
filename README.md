# Counter

Ein minimaler Zähler als installierbare PWA – ohne Build-Schritt und ohne
Dependencies. Der Wert liegt aktuell nur lokal im Browser (`localStorage`).

## Funktionen

- Zählen per Buttons, Pfeiltasten ↑/↓ oder `+`/`-`
- Zurücksetzen per Button oder `R`
- Offline nutzbar (Service Worker cached die App-Shell)
- Installierbar (Manifest, Install-Prompt)
- Shortcut `?reset=1` setzt den Zähler beim Öffnen zurück

## Struktur

| Datei | Zweck |
| --- | --- |
| `index.html` | Markup der App |
| `styles.css` | Styling |
| `script.js` | Zähl-Logik, Persistenz, PWA-Handling |
| `sw.js` | Service Worker (Offline-Cache) |
| `manifest.webmanifest` | PWA-Metadaten und Icons |
| `_headers` | Eigene HTTP-Header (Cloudflare, Netlify) |
| `icons/` | App-Icons |

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
