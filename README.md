# Schattengrund

Rundenbasiertes Roguelike als installierbare Web-App (PWA). Läuft offline, speichert den Spielstand im Browser.

## Dateien

- `index.html` – Seite und Gestaltung
- `logic.js` – Spiellogik (Dungeon, Kampf, Monster, Gegenstände)
- `ui.js` – Darstellung und Steuerung
- `manifest.webmanifest`, `sw.js`, `icons/` – macht die Seite installierbar und offline-fähig
- `fonts/` – Schriften (Cinzel, IBM Plex Mono, beide unter SIL Open Font License)

## Lokal ausprobieren

Im Ordner ein Terminal öffnen und `python3 -m http.server 8000` starten, dann im Browser `http://localhost:8000` öffnen.
(Einfach `index.html` doppelklicken geht auch, dann funktioniert nur die Offline-Installation nicht.)

## Online stellen (kostenlos)

Variante A – Netlify: auf netlify.com anmelden, „Add new site“ → „Deploy manually“ und den ganzen Ordner hineinziehen.
Variante B – GitHub Pages: Repository anlegen, Dateien hochladen, unter Settings → Pages den Branch `main` aktivieren.

Danach die Adresse am Handy öffnen und im Browsermenü „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ wählen.

## Play Store (später)

1. Die Web-App muss unter einer festen https-Adresse laufen (siehe oben).
2. Auf pwabuilder.com die Adresse eingeben und ein Android-Paket erzeugen lassen.
3. Google-Play-Entwicklerkonto anlegen (einmalig 25 US-Dollar). Neue private Konten müssen vor der Veröffentlichung einen geschlossenen Test mit mindestens 12 Testern über 14 Tage durchführen.

## Änderungen veröffentlichen

Nach jeder Änderung in `sw.js` die Zeile `VERSION` hochzählen (z. B. `schattengrund-v2`), sonst zeigen installierte Apps noch die alte Version.
