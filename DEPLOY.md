# Deployment-Vergleich

Stand: 12. November 2026. Alle Werte wurden mit `curl` gegen die Live-URLs
gemessen, nicht aus Dokumentation übernommen.

## Getestete Wege

| | GitHub Pages | Cloudflare Workers | Netlify |
| --- | --- | --- | --- |
| URL | <https://codinsam-create.github.io/counter-simple/> | <https://counter-simple.codinsam.workers.dev/> | <https://counter-simple-f10c13.netlify.app/> |
| Produkt | Static Hosting, Branch-Deploy | Worker + Static Assets | Static Hosting, Git-Deploy |
| Deploy bei Push auf `main` | ja | ja | ja |
| Dauer erster Deploy (grob) | ~1 min | ~40 s | ~20 s |
| Standard-`cache-control` | `max-age=600` | `public, max-age=0, must-revalidate` | `public,max-age=0,must-revalidate` |
| ETag / `304` | ja | ja | ja |
| Eigene Header | nein | `_headers` | `_headers`, `netlify.toml` |
| Manifest-MIME | korrekt | korrekt | standardmäßig falsch, per `_headers` korrigiert |
| Dotfiles öffentlich | nicht geprüft | ja (`.gitignore` → `200`) | nein (`.gitignore` → `404`) |
| Vorschau-Deploys | nein | ja (Workers Builds, nicht getestet) | ja (Deploy Previews, nicht getestet) |
| Privates Repo im Free-Plan | nein | ja | ja |
| 404-Verhalten | Standard-404 | Standard-404 | Standard-404-Seite |

## Erkenntnisse

1. **Static Hosting heißt: Der Auslieferungsordner ist komplett öffentlich.**
   Cloudflare liefert sogar `.gitignore` und `README.md` aus. Keine Secrets,
   keine internen Notizen im Publish-Verzeichnis ablegen.
2. **MIME-Typen sind Host-Sache.** Netlify lieferte `.webmanifest` als
   `application/octet-stream`; Browser können das Manifest dann ignorieren und
   die App ist nicht installierbar. Cloudflare und GitHub Pages machen es
   richtig. Fix ist ein `Content-Type`-Header in `_headers`.
3. **HTTP-Cache entscheidet über Service-Worker-Updates.** GitHub Pages erlaubt
   keine eigenen Header und liefert `sw.js` mit `max-age=600` aus. Cloudflare
   und Netlify revalidieren per ETag und erlauben `no-cache` für `sw.js`.
4. **`_headers` ist zwischen Cloudflare Workers und Netlify portabel.** Eine
   Datei, zwei Anbieter. GitHub Pages kennt das Format nicht.
5. **Kein Lock-in auf dieser Ebene.** Dasselbe Repo läuft ohne Codeänderung auf
   allen drei Anbietern; nur URLs und Header-Verhalten unterscheiden sich.
6. **Der Unterschied zwischen Cloudflare Pages und Workers ist klein, aber
   sichtbar.** Der Dashboard-Flow hat einen Worker mit Static Assets erzeugt
   (`workers.dev`). Für unsere Zwecke ist das gleichwertig; Pages ist das
   ältere, separate Static-Produkt.

## Offene Punkte

- Eigene Domain wurde bewusst ausgelassen (Gratis-Subdomains reichen).
- Vorschau-Deploys pro Branch wurden noch nicht ausprobiert.
- `README.md` und `.gitignore` liegen im Publish-Verzeichnis. Sauberer wäre ein
  `public/`-Ordner als Auslieferungsordner.
- Etappe B (Supabase) ist umgesetzt und getestet.
- Etappe C (eigener Node-Server + Postgres) folgt; Hosting muss im Free-Tier
  bleiben.
