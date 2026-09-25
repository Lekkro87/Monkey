# Storage Hunter

Ein Simulator für Lagerraum-Auktionen im Browser: Abteile vom Tor aus begutachten,
gegen sechs Bieter-Persönlichkeiten live mitbieten, den Inhalt mit Physik durchsuchen,
Funde in der Garage bestimmen, reinigen und reparieren und sie dann mit Gewinn verkaufen.

Dieses Repository enthält den **Vertical Slice**: eine vollständig spielbare Anlage
(Lucky Lock Self Storage) mit der kompletten Spielschleife. Die Oberfläche ist auf
Deutsch und Englisch verfügbar (Sprache wird automatisch erkannt, umschaltbar im Titel).

## Inhalt des Vertical Slice

| Anforderung | Umsetzung |
|---|---|
| 1 Lageranlage | Lucky Lock Self Storage, 5 Reihen à 13 Tore; drei weitere Anlagen als gesperrte Erweiterungen |
| 10 unterschiedliche Units | 10 Bauarten (Haushalt, Junggeselle, Handwerker, Band, Messie) und Ereignisse (Nachlass, Sammlerlager, Wasserschaden, Mysteriös, Müll) in 5 Größen von 5x5 bis 10x20 |
| 30+ Items | 119 Gegenstandsarten in 25 Familien, jede mit eigenem prozeduralen 3D-Modell |
| 5 NPC-Bieter | 6 Persönlichkeiten: Der Hai, Die Sammlerin, Der Händler, Der Anfänger, Der Millionär, Der Blender |
| Auktion | 30-Sekunden-Besichtigung vom Tor (lehnen, ducken, Taschenlampe), Live-Bieten mit Bieten / Auto-Gebot / Passen, „Zum Ersten … Zum Zweiten … Letzter Aufruf … Verkauft!“ |
| Inventar, Geld, Garage, Fahrzeug | Garage mit Lagerplatz, Vitrine, Upgrades und Deko; Transporter mit Volumen- und Gewichtsgrenze („Dein Fahrzeug ist voll.“) |
| Item-Inspektion | Stufenweise Bestimmung (z. B. Armbanduhr → Mögliche Vintage-Uhr → Mechanische Sammleruhr aus den 1960ern), Zustand, Echtheit, Experten |
| Cleaning / Repair | Reinigen (kann empfindlichen Stücken schaden), selbst reparieren oder Profi-Reparatur, Geheimfächer, Schlüsseldienst für Tresore |
| Verkauf | Pfandhaus, Online-Marktplatz SwapBay, Auktionshaus Hollister & Crane, Sammlergesuche, Privatkäufer mit Verhandlung (Annehmen / Gegenangebot / Ablehnen) |
| Dynamischer Markt | Trends mit Booms und Flauten je Kategorie, Schlagzeilen, Nachfrage |
| Speichern | Automatisches Speichern mit Prüfsumme und Backups, Export/Import als Speichercode |
| 3 Jackpots | Versiegelte „Famicube“-Launch-Konsole von 1985, Kronhaus „Racing Dial“-Chronograph von 1968, „Astounding Tales“ #1 (1938) – mit Zeitlupen-Enthüllung |

Dazu: Story „Die verschollene Fotografin“, 8 Level mit Freischaltungen, 20 Erfolge,
Sammelbuch, Statistiken, Gewinnberichte pro Abteil (ROI), prozedurale Musik und
Soundeffekte sowie eine Auktionatorstimme per Sprachsynthese.

## Steuerung

**Besichtigung:** Maus ziehen = umsehen · `A`/`D` = lehnen · `C` = ducken · `F` = Taschenlampe · `Enter` = Bieten starten

**Auktion:** `Leertaste` oder `B` = bieten · `A` = Auto-Gebot · `P` = passen · `V` = Menge beobachten / hineinschauen

**Durchsuchen:** `W` `A` `S` `D` = gehen · Maus auf freier Fläche ziehen = umsehen · Klick = öffnen / mitnehmen ·
Objekt ziehen = bewegen · `E` = benutzen · `X` = wegwerfen · `R` = gehaltenes Objekt drehen

Auf Touch-Geräten funktionieren Wischen und Antippen entsprechend.

## Starten

Voraussetzung: Node.js 22 (oder 20.19+).

```bash
npm install
npm run dev            # Entwicklungsserver auf http://localhost:5173
npm test               # Unit-Tests (Simulation, Balancing, Übersetzung)
npm run build          # Typprüfung + Produktions-Build nach dist/
npm run build:single   # Eine einzige, eigenständige HTML-Datei nach dist-single/
```

## Architektur

```
src/
  core/      Typen, Konfiguration (alle Balancing-Werte), Zufall mit Seed, Events, i18n
  data/      Reine Daten: Items, Unit-Baupläne, Anlagen, NPCs, Experten, Level, Erfolge, Quests
  systems/   Kopflose Spiellogik ohne three.js/DOM: Generator, Auktion, NPC-Bewertung,
             Durchsuchen, Werkbank, Markt, Verhandlung, Fortschritt, Speichern
  render/    three.js: Renderer, prozedurale Texturen und Modelle, Szenen, Physik (cannon-es)
  audio/     Prozedurale WebAudio-Effekte, Ambience und Musik
  ui/        DOM-Baukasten, HUD, gemeinsame Bausteine, Styles
  app/       Controller je Spielphase (Titel, Tagesübersicht, Auktion, Durchsuchen, Garage, Markt …)
tests/       Vitest: Generator, Systeme, Balancing-Simulation, Übersetzungsabdeckung
dev/         Modellgalerie, Szenen-Testseite, Playwright-Durchspielskript, Performance-Messung
```

Die Spiellogik läuft vollständig ohne Grafik und ist deterministisch über Seeds testbar.
Die Darstellung beobachtet den Spielzustand über einen typisierten Event-Bus.

## Erweitern

- **Neue Items:** Eintrag in `src/data/items.ts` (Wert, Seltenheit, Maße, Gewicht, Inspektionsprofil,
  Fälschungschance …) und ein Modell-Builder in `src/render/models/`. Die Modellgalerie
  (`/dev/gallery.html` im Dev-Server) zeigt alle Modelle.
- **Neue Unit-Typen und Ereignisse:** `src/data/units.ts` (Kategorie-Gewichte, Dichte, Schadens- und Geheimfach-Chance).
- **Neue Anlagen:** `src/data/facilities.ts` – Anlagen mit `playable: false` erscheinen bereits als gesperrte Erweiterung.
- **Neue NPCs:** `src/data/npcs.ts` (Budget, Bietverhalten, Fachgebiete, Sprüche); Feinabstimmung in `NPC_TUNING` (`src/systems/npc.ts`).
- **Balancing:** zentral in `src/core/config.ts`; `npm run sim` prüft Preis/Wert-Verhältnisse der Auktionen.
- **Texte und Sprachen:** Englische Quelltexte werden mit `t('…')` übersetzt, gespeicherte Beschriftungen mit `N_('…')`
  markiert. Die deutschen Texte stehen in `src/core/i18n.de.ts`; `tests/i18n.test.ts` meldet fehlende Einträge
  und abweichende Platzhalter.

## Browser-Test

```bash
npm run dev
node dev/e2e.mjs http://localhost:5173/ ./e2e-shots      # LANG_UI=de für die deutsche Oberfläche
```

Das Skript spielt einen kompletten Tag durch (Auktion gewinnen, Abteil räumen, Werkbank, Markt,
alle Reiter) und speichert Screenshots sowie Konsolenfehler und fehlende Übersetzungen.
