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

Noch offen. Ziel ist ein Vergleich mehrerer Static-Hoster (GitHub Pages,
Cloudflare Pages, Netlify) unter einer Gratis-Subdomain. Danach folgen
Accounts/Sync über ein BaaS und zuletzt ein eigener Server.
