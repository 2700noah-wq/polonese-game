# Polonese

Polonese ist ein eigenständiges, browserbasiertes Logikspiel: Eine Vorlage gibt einige Spielsteine vor, anschließend werden alle zehn Teile so eingesetzt, dass das 5×10-Feld lückenlos gefüllt ist.

## Funktionen

- 240 deterministische Levels: je 60 in Leicht, Mittel, Schwer und Polonesisch
- Endlosmodus mit neu erzeugten, eindeutig lösbaren Aufgaben
- automatisch wechselnder Rot-Weiß- und Neon-Stil
- Timer und lokale Bestzeiten
- eigener, dauerhaft lokal gespeicherter Spielstand pro Browser/Gerät
- Fortschritt und Statistiken im Browser
- responsive Bedienung für Desktop, Tablet und Smartphone
- Tastenkürzel: `R` drehen, `F` spiegeln, `Strg/Cmd + Z` rückgängig

## Lokal starten

Es gibt keine Laufzeit-Abhängigkeiten und keinen Build-Schritt.

```bash
npm test
npm run serve
```

Anschließend `http://localhost:4173` öffnen.

## Technik

Das Spiel besteht aus HTML, CSS und modernem JavaScript. Der Generator nutzt einen Backtracking-Solver mit einer Minimum-Remaining-Values-Heuristik. Vorgegebene Teile werden nur entfernt, wenn die Aufgabe weiterhin genau eine Lösung besitzt.

Der Workflow unter `.github/workflows/pages.yml` testet die Puzzle-Logik und veröffentlicht den Stand automatisch auf GitHub Pages.

## Eigenständigkeit

Polonese verwendet eine allgemeine Polyomino-Puzzlemechanik, eigene Gestaltung, eigene Bezeichnungen und algorithmisch erzeugte Aufgaben. Es besteht keine Verbindung zu SmartGames oder IQ Fit.
