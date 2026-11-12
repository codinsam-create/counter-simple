# Vendor

Fremdcode, der bewusst im Repo liegt, statt zur Laufzeit von einem CDN geladen
zu werden. Dadurch ist er Teil der App-Shell und offline verfügbar.

## `supabase-js.js`

| | |
| --- | --- |
| Paket | `@supabase/supabase-js` |
| Version | 2.119.0 |
| Quelle | <https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js> |
| SHA-256 | `a867edbcfb029370aeec7223dd6180b560b621fbe3bc64c6584fb0369d1b7bce` |
| Lizenz | MIT |
| Global | `window.supabase` |

### Aktualisieren

1. Neue stabile Version auf npm prüfen: `npm view @supabase/supabase-js dist-tags`
2. Datei von der jsDelivr-URL der neuen Version herunterladen und ersetzen.
3. Version und SHA-256 hier aktualisieren (`sha256sum vendor/supabase-js.js`).
4. `CACHE_NAME` in `sw.js` erhöhen, damit die App-Shell neu installiert wird.
