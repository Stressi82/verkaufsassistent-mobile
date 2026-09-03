# Verkaufsassistent Mobile – aktueller Stand V21

Öffentliche Web-App: <https://stressi82.github.io/verkaufsassistent-mobile/>
Öffentliches GitHub-Repository: <https://github.com/Stressi82/verkaufsassistent-mobile>

## Stabilisierung V21 – 03.09.2026

- vollständiger strenger TypeScript-Check erfolgreich
- Expo Doctor: 21/21 Prüfungen erfolgreich
- Backend-Syntaxcheck erfolgreich
- Web-Build sowie Android- und iOS-Bundles erfolgreich
- Expo-SDK-57-Pakete auf kompatible Patchstände aktualisiert
- fehlende Peer-Abhängigkeit `expo-asset` ergänzt
- bekannte Indexzugriffe in Batch-Verarbeitung, Demo-Daten, Lifecycle, Fotoaudit, Plattformempfehlung, Preislogik und Versandkatalog abgesichert

Die öffentliche GitHub-Pages-Version ist ein statisches Expo-Web-Frontend. KI-Analyse, eBay OAuth/Publish, Nachrichten, Transkription und Push benötigen weiterhin ein separat öffentlich bereitgestelltes HTTPS-Backend sowie `EXPO_PUBLIC_API_URL`. Ein echter signierter iOS-/Android-Geräte-Build ist noch nicht end-to-end bestätigt.

Die verbindliche Übergabedatei ist `CODEX_MASTER_VERKAUFSASSISTENT_V21.md`.

## Historischer Einstieg V4 – reine Handy-App

Mobile App für **Android und iPhone**.

## Ablauf

```text
Fotos
  ↓
persönliche KI auswählen
  ↓
Artikel erkennen
  ↓
Titel + Beschreibung
  ↓
Preisassistent
  ↓
Verkaufsplattform(en) auswählen
  ↓
Kleinanzeigen-Übergabe / eBay-Integration
```

## Neu in V4

### Persönliche KI-Auswahl

Der Nutzer kann für die Artikelerkennung wählen:

- **OpenAI**
- **Claude / Anthropic**
- **Gemini / Google**

Die Auswahl wird an das Backend übergeben. API-Schlüssel liegen **nicht in der Handy-App**.

Das Provider-Modul wurde absichtlich allgemein gebaut:

```text
src/types/ai.ts
src/services/providers.ts
backend/server.mjs
```

Damit kann dasselbe Prinzip später z. B. in einem **Bewerbungstrainer** verwendet werden:

```text
Nutzer
  ↓
KI wählen
  ├─ OpenAI
  ├─ Claude
  └─ Gemini
  ↓
gleiche App-Funktion
```

### Verkaufsplattformen

Aktuell auswählbar:

- Kleinanzeigen
- eBay

Mehrere Plattformen können gleichzeitig markiert werden.

#### Kleinanzeigen

V4:
- Anzeige vollständig vorbereiten
- nativen Handy-Teilen-Dialog öffnen
- Kleinanzeigen öffnen
- Nutzer inseriert mit vorbereiteten Daten

#### eBay

V4:
- Anzeige vorbereiten
- eBay-Verkaufen öffnen
- API-Modus in der Architektur vorgesehen

Für echtes vollautomatisches eBay-Posting fehlen noch die kontobezogenen Daten:
- eBay OAuth
- Verkäuferstandort
- Kategorie-ID
- Payment Policy
- Return Policy
- Fulfillment Policy
- öffentlich erreichbare Bild-URLs

Diese Angaben sind für die offizielle eBay Inventory API relevant.

## Backend starten

Node.js 22+.

```bash
cd backend
npm install
cp .env.example .env
```

Dann mindestens einen KI-Anbieter konfigurieren.

Beispiel:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-opus-5

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Es müssen nicht alle drei Schlüssel vorhanden sein. Die App zeigt an, welche KI auf dem
Backend bereit ist.

```bash
npm start
```

## Handy-App verbinden

Im Hauptordner:

```bash
cp .env.example .env
```

Bei einem echten Handy:

```env
EXPO_PUBLIC_API_URL=http://DEINE-LAN-IP:8787
```

Dann:

```bash
npm install
npx expo start
```

## KI-Architektur

### OpenAI
- serverseitige Responses API
- mehrere Bilder
- JSON-Schema-Ausgabe

### Claude
- serverseitige Messages API
- mehrere Bild-Content-Blöcke
- JSON wird serverseitig validiert

### Gemini
- serverseitige GenerateContent-Anfrage
- mehrere Inline-Bilder
- JSON-Antwortschema

## Sicherheit

- keine KI-Schlüssel im App-Bundle
- keine Verkäufer-Passwörter in der App
- keine Behauptung „funktioniert“, wenn nur Fotos vorliegen
- sichtbare Schäden werden nicht automatisch verschwiegen
- Veröffentlichung bleibt aktuell unter Nutzerkontrolle

## Nächste Ausbaustufe

1. eBay OAuth
2. Verkäuferprofil / Plattformkonto
3. eBay-Kategorie- und Richtlinien-Mapping
4. Bildhosting für eBay
5. echtes `publishOffer`
6. Entwürfe lokal bzw. nutzerbezogen speichern
7. dieselbe KI-Auswahl als wiederverwendbares Modul für weitere Apps, z. B. Bewerbungstrainer

## V5 – größere Plattformauswahl

Die Verkaufsplattform-Schicht ist jetzt modular erweitert.

### Deutschland / international
- Kleinanzeigen
- eBay
- Facebook Marketplace
- Vinted
- Shpock
- Quoka
- Hood.de
- markt.de

### Österreich
- willhaben
- eBay
- Facebook Marketplace
- Vinted
- Shpock

Die App unterscheidet:
- **API möglich** – z. B. eBay, wo ein offizieller Sell-Workflow vorgesehen ist.
- **Übergabe** – App erstellt den Verkaufsentwurf, öffnet die Plattform und der Nutzer übernimmt/veröffentlicht dort.

### meinestadt.de
Wird bewusst nicht als allgemeiner Waren-Marktplatz einsortiert.
Der aktuelle klare Privat-Inserationsbereich ist insbesondere Immobilien.
Später kann die Plattform als Spezialziel für passende Kategorien ergänzt werden.

### Architektur
Neue Marktplätze werden nur noch als Eintrag in `src/services/platforms.ts`
hinzugefügt. Die Oberfläche rendert die Plattformkarten automatisch.


## V6 – intelligente Plattformempfehlung

Nach der Artikelerkennung bewertet die App automatisch passende Marktplätze.

Berücksichtigt werden Artikelgruppe, Region, lokale Abholung, Versandfähigkeit, Marke/Modell und Spezialfälle wie Mode, Elektronik, Möbel, Werkzeug, Kindersachen, Sammler, Medien, Sport und Fahrzeugteile.

Die App zeigt pro Plattform Eignung in Prozent, Kennzeichnung `EMPFOHLEN` und konkrete Gründe. Maximal vier Plattformen werden automatisch vorausgewählt. Der Nutzer kann jede Empfehlung überschreiben.

Technische Datei: `src/services/platformRecommendations.ts`

## V7 – plattformspezifische Verkaufstexte

Aus dem Master-Entwurf erzeugt die App für jede ausgewählte Plattform eine
**eigene Version**.

### Ablauf

```text
Master-Entwurf
  ↓
ausgewählte persönliche KI
  ↓
Kleinanzeigen-Version
+ eBay-Version
+ Facebook-Marketplace-Version
+ Vinted-Version
+ willhaben-Version
+ weitere gewählte Plattformen
```

### Regeln

- Die vom Nutzer ausgewählte KI bleibt zuständig (OpenAI, Claude oder Gemini).
- Keine neuen Produktfakten erfinden.
- Sichtbare Mängel bleiben erhalten.
- Keine Versand-/Abholangaben erfinden.
- Jede Plattformversion ist einzeln bearbeitbar.
- Jede Plattformversion kann einzeln über den Handy-Teilen-Dialog geteilt werden.
- Fällt die KI-Verbindung aus, erzeugt die App lokale Fallback-Versionen.

### eBay

Der Titel wird auf maximal **80 Zeichen** begrenzt.

### Vinted

Die Version betont konkrete Artikeldetails, Zustand und Mängel und vermeidet
irrelevante Marken/Hashtags.

### Technische Dateien

- `src/types/platformCopy.ts`
- `src/services/platformCopy.ts`
- `src/components/PlatformCopyCard.tsx`
- Backend-Endpunkt: `POST /platform-copies`

## V8 – Versand, Zahlung, Standort und eBay-Kontoverknüpfung

Zwischen Preisassistent und Plattformauswahl gibt es jetzt einen eigenen
Schritt für die tatsächlichen Verkaufsbedingungen.

### Nutzerangaben
- Deutschland / Österreich
- PLZ und Ort
- nur Abholung / nur Versand / beides
- Versandkosten: Käufer zahlt / kostenlos / fester Betrag
- optionaler Versanddienst
- Zahlungsarten: Bar, Überweisung, PayPal, Plattform-Zahlung

Diese Angaben fließen in die plattformspezifischen Verkaufstexte ein.

### eBay OAuth
Backend-Routen:
- `GET /ebay/oauth/start`
- `GET /ebay/oauth/callback`
- `GET /ebay/status`
- `POST /ebay/disconnect`

Die Handy-App erhält weder eBay-Client-Secret noch OAuth-Token.

Für das MVP wird der Token nur im laufenden Backend-Prozess gehalten.
Für Produktion muss ein verschlüsselter, nutzerbezogener Datenspeicher
eingebaut werden.

### eBay-Konfiguration
```env
EBAY_ENV=sandbox
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_RUNAME=...
EBAY_MARKETPLACE_ID=EBAY_DE
```

Der zum RuName gehörende Accept URL im eBay Developer Portal muss auf
`/ebay/oauth/callback` des Backends zeigen.

Nach Verbindung prüft die App bereits die Anzahl vorhandener
Fulfillment-, Payment- und Return-Policies.

### Noch vor echtem `publishOffer`
- Inventory Location / `merchantLocationKey`
- SKU
- eBay Kategorie-ID
- Payment Policy
- Fulfillment Policy
- Return Policy
- öffentlich erreichbare Bild-URLs
- Inventory Item → Offer → `publishOffer`

### Rechtliches Verhalten
Die App erfindet keine Garantie-, Gewährleistungs- oder
Rückgabeausschlussklauseln.


## V9 – echtes eBay `publishOffer`

V9 enthält erstmals den vollständigen eBay-Veröffentlichungsweg im Backend:

1. eBay OAuth prüfen
2. eBay-Kategoriebaum ermitteln
3. Kategorie aus Titel/Marke/Modell vorschlagen
4. Kategorie-Pflichtmerkmale (Aspects) laden
5. zulässige Artikelzustände laden
6. vorhandene Payment-, Fulfillment- und Return-Policies laden
7. Inventory Location prüfen bzw. als Warehouse anlegen
8. Handyfotos direkt über die **eBay Media API** zu eBay Picture Services (EPS) hochladen
9. `createOrReplaceInventoryItem`
10. `createOffer`
11. `publishOffer`
12. Listing-ID und eBay-Link an die App zurückgeben

### Mobile Oberfläche
Wenn eBay ausgewählt ist, erscheint ein eigener Bereich **EBAY DIREKT-POSTING**.
Dort kann der Nutzer:

- eBay-Vorbereitung starten
- einen der eBay-Kategorievorschläge auswählen
- einen zulässigen Zustand auswählen
- Versand-, Zahlungs- und Rückgaberichtlinie auswählen
- erforderliche Artikelmerkmale ergänzen
- anschließend **Jetzt bei eBay veröffentlichen** drücken

Die App lädt dann die vorhandenen Produktfotos zu eBay und veröffentlicht das Angebot.

### Sicherheitsverhalten
- eBay OAuth-Token bleibt im Backend.
- Die App veröffentlicht nur, wenn eBay-Konto, Richtlinien, Kategorie, Zustand, Bilder und Pflichtmerkmale vorhanden sind.
- eBay-Titel wird auf 80 Zeichen begrenzt.
- Es wird kein rechtlicher Gewährleistungs- oder Rückgabetext erfunden.
- Im MVP liegt der eBay-Token weiterhin nur im Speicher des laufenden Backends; für Produktion ist persistente verschlüsselte Speicherung notwendig.

### Hinweis zu eBay-Kategorien
Kategorie-Vorschläge kommen aus der eBay Taxonomy API. Pflichtmerkmale und zulässige Zustände werden nach der gewählten Kategorie dynamisch geladen. Dadurch wird nicht pauschal angenommen, dass jeder Artikel dieselben eBay-Anforderungen hat.

## V10 – eBay Sandbox-Diagnose

Die App besitzt jetzt im Schritt **Versand, Abholung & Zahlung** einen
eigenen `EBAY SETUP-CHECK`.

Der Check veröffentlicht **nichts**. Er prüft:

1. Sandbox oder Produktion
2. Client ID / Client Secret / RuName vorhanden
3. Application Keys gegen eBays OAuth-Token-Endpunkt
4. erwartete OAuth Accept URL
5. Verkäufer-OAuth verbunden
6. Inventory API erreichbar
7. eBay Taxonomy / Kategoriebaum erreichbar
8. Fulfillment-, Payment- und Return-Policies vorhanden
9. vorhandene Inventory Locations
10. technische Bereitschaft für Preflight bzw. Publish

### PUBLIC_BASE_URL

Zusätzlich zu den bisherigen eBay-Werten sollte im Backend gesetzt werden:

```env
PUBLIC_BASE_URL=https://dein-backend.example.de
```

Dann zeigt die App die erwartete Accept URL:

```text
https://dein-backend.example.de/ebay/oauth/callback
```

Diese URL muss im eBay Developer Portal dem verwendeten RuName als
**Accept URL** zugeordnet sein.

### Sandbox-Probleme von App-Problemen unterscheiden

Die App bietet Links zu:
- offizieller eBay Sandbox-Hilfe
- offiziellem eBay Sandbox API Status

Damit kann bei Fehlern zuerst geprüft werden, ob eBay selbst aktuell eine
Sandbox-Störung meldet.

### Keine Geheimnisse in der Diagnose

Die Diagnose gibt niemals Client Secret, OAuth Access Token oder Refresh Token
an die Handy-App zurück. Sie zeigt nur, ob die jeweilige Konfiguration vorhanden
und technisch erreichbar ist.

## V11 – Demo-Testmodus

Damit die App ohne KI-Keys, eBay-Konto oder Backend sofort durchgeklickt werden
kann, enthält Schritt 1 jetzt einen **Demo-Modus**.

### Demo-Artikel
- Bosch Professional 18V Akkuschrauber
- 3 Beispielbilder
- Akku + Ladegerät
- sichtbare Gebrauchsspuren
- Unsicherheit bei der exakten Modellnummer
- Beispiel-Preisvergleich
- vorausgefüllte Versand-/Zahlungsdaten

### Ablauf im Demo-Modus
1. `Demo-Artikel laden`
2. `3 Fotos mit Demo-KI analysieren`
3. Anzeige bearbeiten
4. Preisassistent testen
5. Versand/Zahlung prüfen
6. Plattformempfehlungen ansehen
7. Plattformtexte erzeugen

Es wird im Demo-Modus **nichts veröffentlicht**.

Zusätzlich wird außerhalb des App-Projekts eine einzelne
`verkaufsassistent-demo-v11.html` erzeugt. Diese Browser-Demo kann ohne
Installation geöffnet werden und simuliert den mobilen V11-Ablauf.

## V12 – Verkaufszentrale, Barcode, Typenschild und Sprache

### Verkaufszentrale
Die App startet jetzt in einem Dashboard:

- `+ Neuer Artikel`
- Entwürfe
- Online
- Verkauft

Jeder gespeicherte Artikel zeigt:
- Titel
- Preis
- Status
- zuletzt geändert
- Plattformstatus
- Bearbeiten
- Online markieren
- Verkauft markieren
- Löschen

Die Daten werden lokal mit `@react-native-async-storage/async-storage`
persistiert und bleiben nach App-Neustart erhalten.

### Barcode / EAN
`expo-camera` scannt direkt:
- EAN-13
- EAN-8
- UPC-A
- UPC-E
- Code 128

Der erkannte Code wird als zusätzlicher Kontext an die Artikelerkennung
gesendet.

### Typenschild-Modus
Neben normalen Produktfotos gibt es:
`Typenschild fotografieren`

Das Bild erhält intern die Rolle `typeplate`. Das Backend weist die KI
ausdrücklich darauf hin, dieses Bild besonders für Marke, Modell und
technische Beschriftungen zu verwenden.

### Sprachangaben
Mit `expo-audio` kann der Nutzer kurze Angaben einsprechen, etwa:

> Funktioniert, Akku hält gut, rechts ist ein Kratzer, Ladegerät ist dabei.

Die Transkription wird dem Analyseprompt als ausdrücklich vom Nutzer
angegebener Kontext hinzugefügt.

Aktuell:
- OpenAI: Transcription API
- Gemini: Audio über GenerateContent
- Claude: im MVP keine direkte Audio-Transkription; manuelle Texteingabe bleibt möglich.

### Neue Pakete
```bash
npx expo install expo-camera expo-audio
npx expo install @react-native-async-storage/async-storage
```

## V13 – Stapelverkauf, Foto-Preflight und automatisches Titelbild

### 1. Stapelverkauf

Auf der Verkaufszentrale gibt es jetzt:

`▦ Stapelverkauf`

Ablauf:

1. Gegenstand fotografieren
2. optional kurzen Namen eingeben
3. `Artikel fertig → nächster`
4. nächsten Gegenstand fotografieren
5. am Ende `Artikel analysieren & als Entwürfe speichern`

Die App verarbeitet die Artikel nacheinander und legt jeden als eigenen
Entwurf in der Verkaufszentrale ab.

Pro Stapelartikel:
- bis zu 6 Fotos
- eigener Name
- eigene KI-Analyse
- eigener Foto-Preflight
- automatische Titelbildwahl
- eigener gespeicherter Entwurf

Wenn eine KI-Analyse fehlschlägt, geht der Artikel nicht verloren:
Es wird ein manueller Entwurf gespeichert, der später erneut analysiert
werden kann.

### 2. Foto-Preflight

Neues Modul:

`Qualität, Privatsphäre & Titelbild`

Die vom Nutzer gewählte KI bewertet jedes Foto auf:

- Unschärfe
- zu dunkel
- überbelichtet
- Produkt abgeschnitten
- unruhiger Hintergrund
- wenig Produktdetail
- Wasserzeichen
- allgemeine Nutzbarkeit

Für jedes Bild werden angezeigt:
- Qualitätswert 0–100 %
- Titelbild-Eignung 0–100 %
- konkrete Hinweise
- Privatsphäre-Warnungen

### 3. Privatsphäre-Check

Der Foto-Preflight warnt vor sichtbaren:

- Gesichtern
- privaten Adressen / Namensschildern / Briefen
- Kennzeichen
- persönlichen Dokumenten
- Seriennummern/Gerätekennungen

Die KI soll dabei **keine Person identifizieren** und **keine vollständigen
privaten Daten abschreiben**.

Gesicht, private Adresse, Kennzeichen oder persönliches Dokument gelten
als blockierende Warnung.

Wenn die visuelle Prüfung wegen fehlendem Backend/KI nicht möglich ist,
wird ebenfalls nicht so getan, als wäre das Foto sicher geprüft.
Der Datensatz erhält `privacyScanComplete: false`.

Vor Veröffentlichung muss der Nutzer dann:
- Foto korrigieren/ersetzen, oder
- ausdrücklich bestätigen, dass er das Foto selbst geprüft hat.

Dieser Status wird zusammen mit dem Artikel gespeichert.

### 4. Automatisches Titelbild

Der Foto-Check bewertet für jedes Foto einen `coverScore`.

Bevorzugt werden:
- Produkt vollständig sichtbar
- klare Perspektive
- ausreichende Helligkeit
- ruhiger Hintergrund
- wenig private Inhalte

Normalerweise nicht bevorzugt:
- reines Typenschildfoto
- reines Schadensdetail
- reines Zubehörfoto

Nach dem Foto-Check wird das beste Bild automatisch an Position 1 gesetzt
und intern als `cover` markiert.

Der Nutzer kann weiterhin manuell ein anderes Titelbild wählen.

### 5. Schäden bleiben sichtbar

Die Foto-Prüfung darf keine vorhandenen Schäden als Grund verwenden, um
ein Bild künstlich attraktiver zu machen.

Die App entfernt oder retuschiert keine:
- Kratzer
- Dellen
- Brüche
- Gebrauchsspuren
- sonstigen sichtbaren Mängel

Ein Schadensfoto kann für die Transparenz sehr wichtig sein, auch wenn es
nicht als Titelbild geeignet ist.

### Backend

Neuer Endpunkt:

```text
POST /photo-audit
```

Unterstützt:
- OpenAI
- Claude
- Gemini

Er nutzt dieselbe persönliche KI-Auswahl wie die normale Artikelerkennung.

### Gespeicherte Verkaufsartikel

`ListingRecord` speichert jetzt zusätzlich:

```ts
photoAudit?: PhotoAuditResult | null;
privacyAcknowledged?: boolean;
```

Dadurch bleibt der Sicherheitsstatus auch nach Neustart der App erhalten.

Die Verkaufszentrale zeigt bei betroffenen Artikeln:

`Foto prüfen ⚠`

### Veröffentlichung

Der eBay-Direkt-Publish erhält zusätzlich ein Privacy-Gate.

Solange ein blockierender Foto-Preflight offen ist, gehört
`Foto-Privatsphäre prüfen` zu den noch fehlenden Pflichtpunkten und der
eBay-Publish-Button bleibt deaktiviert.

## V14 – Persönliche Standards, Verkaufsziel und Crossposting-Verlauf

### Persönliche Standards

Die Verkaufszentrale enthält jetzt:

`⚙ Persönliche Standards`

Diese Einstellungen werden mit AsyncStorage dauerhaft gespeichert und auf
**neue Artikel automatisch angewendet**:

- bevorzugte KI
- Deutschland / Österreich
- PLZ und Ort
- Abholung / Versand / beides
- Versanddienst
- Versandkostenstandard
- Zahlungsarten
- bevorzugte Verkaufsplattformen
- Verkaufsziel

Jeder einzelne Artikel bleibt trotzdem vollständig änderbar.

### Verkaufsziel

Drei Strategien:

- `Schnell verkaufen`
- `Guter Marktpreis`
- `Maximaler Erlös`

Der Preisassistent zeigt zusätzlich zu den drei allgemeinen Preisstufen
einen hervorgehobenen persönlichen Zielpreis.

Zuordnung:

```text
Schnell verkaufen  -> sellFast / Festpreis
Guter Marktpreis   -> marketTypical / VB
Maximaler Erlös    -> startHigh / VB
```

Der Preis wird nicht automatisch überschrieben. Der Nutzer übernimmt den
Zielpreis bewusst per Button.

### Preisverlauf

Gespeicherte Artikel erhalten jetzt:

```ts
priceHistory?: {
  value: string;
  priceType: "VB" | "Festpreis";
  changedAt: string;
}[];
```

Eine neue Historienzeile wird nur gespeichert, wenn sich Preis oder Preisart
wirklich geändert haben.

In der Verkaufszentrale wird die Anzahl der Preisänderungen angezeigt.

### Erster Online-Zeitpunkt

Zusätzlich:

```ts
firstOnlineAt?: string | null;
```

Dieser Wert wird beim ersten Online-Status gesetzt und bei späteren
Bearbeitungen nicht überschrieben.

Damit kann die App berechnen, wie lange ein Artikel tatsächlich online ist.

### Nachfasslogik

Für Online-Artikel erscheinen automatische Hinweise:

- nach ca. 3 Tagen und nur einer aktiven Plattform:
  Crossposting erwägen
- ab 7 Tagen:
  Plattformreichweite, Titelbild und Preis prüfen
- ab 14 Tagen:
  stärkere Preis-/Anzeigenoptimierung empfehlen

Die App senkt Preise **nicht selbstständig**.

### Crossposting-Status

Im Plattform-Schritt gibt es jetzt einen eigenen Bereich:

`CROSSPOSTING – Status je Plattform`

Pro ausgewählter Plattform:

- Vorbereitet
- Online
- Verkauft

Beispiel:

```text
Kleinanzeigen  Online
eBay           Online
Facebook       Vorbereitet
Vinted         nicht ausgewählt
```

Beim Speichern als `Online` muss mindestens eine Plattform tatsächlich auf
`Online` stehen.

Ein globales `Verkauft` setzt die ausgewählten Plattformen auf verkauft.

### Architektur

Neue Module:

```text
src/types/userPreferences.ts
src/services/preferencesStore.ts
src/services/salesIntelligence.ts
src/components/UserPreferencesScreen.tsx
src/components/CrosspostingStatusPanel.tsx
```

## V16 – Artikel-Lebenszyklus

Der Verkaufsassistent besitzt jetzt einen echten, gespeicherten
Artikel-Lebenszyklus:

```text
Entwurf
  ↓
Vorbereitet
  ↓
Online
  ↓
Reserviert
  ↓
Verkauft
  ↓
Entfernt
```

### Status

Unterstützte Zustände:

- `draft` – Entwurf
- `prepared` – vollständig vorbereitet, aber noch nicht online
- `online` – auf mindestens einer Plattform aktiv
- `reserved` – für einen Interessenten reserviert
- `sold` – verkauft
- `removed` – aus dem aktiven Verkaufsprozess entfernt

`Entfernt` ist ausdrücklich **nicht** dasselbe wie „endgültig löschen“.
Ein entfernter Artikel bleibt in der Verkaufszentrale und kann später
reaktiviert werden.

### Erlaubte Statuswechsel

Die App verhindert unlogische Sprünge.

Beispiele:

```text
Entwurf → Vorbereitet
Vorbereitet → Online
Online → Reserviert
Reserviert → Online
Reserviert → Verkauft
Online → Verkauft
Verkauft → Online
Online → Entfernt
Entfernt → Entwurf
```

Nicht jeder beliebige direkte Sprung ist zulässig.

### Reservierung

Der neue Status `Reserviert` ist ein Artikelstatus.

Die Plattformanzeige kann dabei weiterhin online sein, weil eine Reservierung
nicht automatisch bedeutet, dass das Inserat bei eBay/Kleinanzeigen/etc.
technisch deaktiviert wurde.

Dadurch bleiben zwei Dinge getrennt:

1. Artikel-Lebenszyklus
2. technischer Plattformstatus

### Verkauft

Bei `Verkauft`:

- wird `soldAt` gesetzt
- werden die bekannten ausgewählten Plattformstatus auf `sold` gesetzt
- wird ein Lebenszyklus-Ereignis gespeichert

Wird ein Verkauf rückgängig gemacht und der Artikel wieder auf `Online`
gesetzt, wird `soldAt` wieder aufgehoben.

### Entfernt

Bei `Entfernt`:

- bleibt der Artikel gespeichert
- werden aktive Plattformstatus aus der aktiven Crossposting-Liste genommen
- die Historie bleibt erhalten
- Reaktivierung als Entwurf ist möglich

### Historie

Jeder Statuswechsel erzeugt:

```ts
{
  id: string;
  from: ListingStatus | null;
  to: ListingStatus;
  changedAt: string;
  note?: string;
}
```

Beispiel:

```text
26.08.2026 18:12  Entwurf
26.08.2026 18:20  Entwurf → Vorbereitet
26.08.2026 18:23  Vorbereitet → Online
27.08.2026 09:05  Online → Reserviert
27.08.2026 17:40  Reserviert → Verkauft
```

Beim Bearbeiten eines gespeicherten Artikels wird diese Historie sichtbar.

### Verkaufszentrale

Die Übersicht zählt jetzt getrennt:

- Entwürfe
- Vorbereitet
- Online
- Reserviert
- Verkauft
- Entfernt

Je nach aktuellem Status erscheinen nur sinnvolle Aktionen.

Beispiele:

```text
Entwurf       → Vorbereitet
Vorbereitet   → Online
Online        → Reserviert / Verkauft / Entfernt
Reserviert    → Wieder online / Verkauft / Entfernt
Verkauft      → Wieder online / Entfernt
Entfernt      → Als Entwurf reaktivieren
```

### Plattform-Schritt

Zusätzlich zum bisherigen Online-/Verkauft-Speichern gibt es:

`Als vorbereitet speichern`

Damit kann ein Artikel vollständig fertiggestellt werden, ohne dass behauptet
wird, er sei bereits auf einer Plattform veröffentlicht.

### Neue Module

```text
src/types/lifecycle.ts
src/services/lifecycle.ts
src/components/LifecyclePanel.tsx
```

## V17 – Verkauf abschließen / Restanzeigen entfernen

V17 trennt jetzt sauber zwischen:

1. **Artikel ist verkauft**
2. **einzelne Plattformanzeigen sind technisch noch aktiv**

Das ist wichtig, weil ein Verkauf über eine Plattform nicht automatisch bedeutet,
dass alle Crossposting-Anzeigen auf anderen Plattformen bereits beendet wurden.

### Neue Abschlusszentrale

Bei Artikeln mit Lebenszyklusstatus `Verkauft` gibt es in der Verkaufszentrale:

`Verkauf abschließen`

Dort wird zuerst ausgewählt:

- Kleinanzeigen
- eBay
- Facebook Marketplace
- Vinted
- willhaben
- andere gespeicherte Plattformen
- oder `Außerhalb der Plattformen`

Damit weiß die App, **wo der Verkauf tatsächlich zustande kam**.

### Verkaufsquelle

Neu im ListingRecord:

```ts
saleSource?: SalesPlatformId | "offline" | null;
```

Die Plattform, über die verkauft wurde, wird als `sold` markiert.

Alle anderen Plattformen, deren gespeicherter technischer Status noch `online`
ist, werden als **offene Restanzeigen** behandelt.

### Plattformstatus `removed`

Neu:

```ts
export type PlatformListingStatus =
  | "not_selected"
  | "prepared"
  | "online"
  | "sold"
  | "removed";
```

`removed` bedeutet:

> Diese konkrete Plattformanzeige wurde nach dem Verkauf beendet.

Das ist unabhängig vom globalen Artikelstatus `removed`.

### eBay automatisch beenden

Bei eBay speichert die App nach erfolgreichem Direkt-Publishing jetzt:

- Listing-ID
- Offer-ID
- SKU
- Listing-URL
- Zeitpunkt der Veröffentlichung
- technischer Veröffentlichungsstatus

Beispiel:

```ts
platformPublications.ebay = {
  platformId: "ebay",
  externalListingId: "...",
  externalOfferId: "...",
  externalSku: "...",
  listingUrl: "...",
  publishedAt: "...",
  state: "online"
};
```

Damit kann V17 das Angebot später gezielt über die eBay Inventory API beenden.

Neue Backendroute:

```text
POST /ebay/offer/:offerId/withdraw
```

Sie ruft eBays:

```text
POST /sell/inventory/v1/offer/{offerId}/withdraw
```

auf.

Wir verwenden bewusst `withdrawOffer` statt `deleteOffer`.

Damit:
- endet die aktive eBay-Veröffentlichung
- bleibt das eBay Offer-Objekt erhalten
- ein späteres erneutes Veröffentlichen bleibt technisch möglich

### Andere Plattformen

Für Plattformen, für die noch keine verifizierte direkte API-Integration
vorhanden ist, behauptet die App nicht, automatisch löschen zu können.

Stattdessen:

1. `Plattform öffnen`
2. dort Anzeige beenden
3. zurück in die App
4. `Als entfernt bestätigen`

Erst dann wird der gespeicherte Plattformstatus auf `removed` gesetzt.

### Alte V16-Logik korrigiert

Bis V16 wurde beim globalen Status `Verkauft` der Plattformstatus pauschal auf
`sold` gesetzt.

Das ist jetzt bewusst geändert.

Ab V17:

```text
Artikelstatus: Verkauft
Kleinanzeigen: online
eBay: online
Facebook: online
```

ist ein zulässiger Zwischenstand.

Er bedeutet:

> Verkauf abgeschlossen, aber Restanzeigen müssen noch aufgeräumt werden.

Erst die Abschlusszentrale verändert diese Plattformstatus.

### Wieder online

Da eBay `withdrawOffer` das Offer nicht löscht, ist die Architektur bereits
darauf vorbereitet, später bei einem rückgängig gemachten Verkauf ein Angebot
erneut zu veröffentlichen.

### Neue Dateien

```text
src/types/platformCleanup.ts
src/components/PlatformCleanupPanel.tsx
```

Erweiterungen:

```text
src/services/ebayPublish.ts
src/components/EbayPublishPanel.tsx
src/components/SalesCenter.tsx
src/types/salesCenter.ts
backend/server.mjs
App.tsx
```

## V18 – Zentrale Nachrichten-Inbox

V18 ändert den bisherigen Plan „nur Antwortvorlagen“ zu einer echten
**Nachrichten-Zentrale**.

Ziel:

```text
eBay
Kleinanzeigen
Facebook Marketplace
Vinted
willhaben
Shpock
Quoka
Hood.de
markt.de
        ↓
ein gemeinsamer Inbox-Datentyp
        ↓
Konversation
        ↓
Artikelzuordnung
        ↓
Antwort / Schnellvorlage
```

### Wichtig: Connectoren werden nicht vorgetäuscht

Die Oberfläche zeigt pro Plattform:

- verbunden / nicht verbunden
- Inbox technisch verfügbar oder nicht
- Antworten technisch möglich oder nicht

Eine Plattform wird erst als `INBOX ✓` angezeigt, wenn ein echter Connector
funktioniert.

### eBay

eBay ist in V18 der erste echte Nachrichten-Connector.

Verwendet wird die offizielle eBay Commerce Message API:

```text
GET  /commerce/message/v1/conversation
GET  /commerce/message/v1/conversation/{conversation_id}
POST /commerce/message/v1/send_message
POST /commerce/message/v1/update_conversation
```

Neue OAuth-Berechtigung:

```text
https://api.ebay.com/oauth/api_scope/commerce.message
```

Bestehende eBay-OAuth-Verbindungen müssen deshalb einmal getrennt und neu
verbunden werden, damit der neue Scope im Token enthalten ist.

Backend-Endpunkte der App:

```text
GET  /messages/inbox
GET  /messages/ebay/conversation/:conversationId
POST /messages/ebay/send
POST /messages/ebay/read
```

### eBay-Inbox

Die App lädt eBay-Konversationen als:

```ts
UnifiedConversation
```

mit unter anderem:

- Conversation-ID
- Listing-ID
- Artikeltitel
- Absender
- Betreff
- Vorschautext
- letzte Nachricht
- ungelesene Anzahl

Beim Öffnen einer Konversation werden die Detailnachrichten geladen.

### Artikelzuordnung

Wenn die eBay-Konversation eine Listing-ID enthält, versucht die App diese mit
dem bereits gespeicherten:

```ts
platformPublications.ebay.externalListingId
```

zu verbinden.

Dann kennt die Nachrichtenansicht direkt:

- Artikel
- Preis
- Status
- Versand
- Abholung
- Zahlungsarten

### Schnellantworten

Die bereits vorbereiteten Antwortvorlagen sind jetzt Teil der Inbox.

Beispiele:

- noch verfügbar?
- Versand
- Abholung
- Zahlung
- Preis / VB
- Reservierung
- bereits verkauft
- Käuferangebot annehmen
- Käuferangebot ablehnen
- Gegenangebot

Die Texte verwenden nur tatsächlich beim Artikel gespeicherte Angaben.

Beispiel:

Wenn keine Abholung hinterlegt ist, wird keine Vorlage erzeugt, die behauptet,
Abholung sei möglich.

### Keine automatischen Antworten

V18 sendet niemals selbstständig Nachrichten.

Ablauf:

```text
Nachricht öffnen
→ Vorlage wählen oder Text schreiben
→ „Nachricht senden“
→ Bestätigung
→ erst dann API-Aufruf
```

eBay-Nachrichten sind auf 2000 Zeichen begrenzt.

### Aktualisierung

Solange die Nachrichten-Zentrale geöffnet ist:

- sofortiger Abruf beim Öffnen
- manuelles Aktualisieren
- automatischer Refresh alle 60 Sekunden

Für echte Push-Nachrichten im Hintergrund ist später die eBay Notification API
mit dem `NEW_MESSAGE`-Event vorgesehen. Diese wird erst aktiviert, wenn
Webhook-Signaturprüfung und Push-Infrastruktur eingerichtet sind.

### Andere Marktplätze

Für:

- Kleinanzeigen
- Facebook Marketplace
- Vinted
- willhaben
- Shpock
- Quoka
- Hood.de
- markt.de

ist die gleiche Connector-Struktur vorbereitet.

Sie werden aktuell **nicht** als Nachrichtenquelle ausgegeben, solange keine
offizielle bzw. verifizierte technische Schnittstelle angebunden ist.

Kleinanzeigen ist zusätzlich als möglicher `email_bridge_ready`-Connector
gekennzeichnet. Das bedeutet nur, dass unsere Architektur später
E-Mail-Benachrichtigungen normalisieren könnte; es bedeutet nicht, dass bereits
eine Kleinanzeigen-Nachrichten-API existiert oder verbunden ist.

### Neue Dateien

```text
src/types/inbox.ts
src/types/buyerMessages.ts
src/services/inbox.ts
src/services/buyerMessages.ts
src/components/InboxScreen.tsx
```

Erweitert:

```text
App.tsx
src/components/SalesCenter.tsx
src/types/salesCenter.ts
backend/server.mjs
```

## V19 – Nachrichten-Push: eBay Webhook → Handy

V19 erweitert die zentrale Nachrichten-Inbox aus V18 um echte
Push-Benachrichtigungen.

### Ziel

```text
Käufer schreibt bei eBay
        ↓
eBay NEW_MESSAGE
        ↓
HTTPS Webhook am Verkaufsassistent-Backend
        ↓
eBay X-EBAY-SIGNATURE prüfen
        ↓
Expo Push Service
        ↓
iPhone / Android
        ↓
Push antippen
        ↓
Nachrichten-Zentrale / konkrete eBay-Konversation
```

### Keine Nachrichtentexte auf dem Sperrbildschirm

Der Push enthält bewusst nur:

```text
Neue eBay-Anfrage
Eine neue Käufernachricht ist eingegangen.
```

Der eigentliche Käufertext wird erst innerhalb der zentralen Inbox geladen.

### eBay Notification API

V19 arbeitet mit dem offiziellen Topic:

```text
NEW_MESSAGE
```

Benötigter OAuth-Scope:

```text
https://api.ebay.com/oauth/api_scope/commerce.message
```

Ein früher verbundenes eBay-Konto muss nach Einführung dieses Scopes einmal
neu per OAuth verbunden werden.

### Öffentlicher Webhook

Das Backend benötigt:

```env
PUBLIC_BASE_URL=https://dein-backend.example
```

Daraus entsteht:

```text
https://dein-backend.example/webhooks/ebay/messages
```

Der Endpoint muss öffentlich über HTTPS erreichbar sein.

### eBay Endpoint Challenge

Beim Einrichten einer Destination ruft eBay den Endpoint mit:

```text
?challenge_code=...
```

auf.

V19 beantwortet dies mit:

```text
SHA256(
  challengeCode +
  verificationToken +
  endpointURL
)
```

als:

```json
{
  "challengeResponse": "..."
}
```

### Verification Token

Serverseitig:

```env
EBAY_NOTIFICATION_VERIFICATION_TOKEN=
```

Vorgaben:

- 32 bis 80 Zeichen
- Buchstaben
- Zahlen
- `_`
- `-`

Der Token gehört ausschließlich auf das Backend.

### Signaturprüfung

Jeder eingehende POST muss den Header:

```text
X-EBAY-SIGNATURE
```

besitzen.

V19:

1. Base64-decodiert den Signaturheader
2. liest `kid` und Signatur
3. holt den zugehörigen eBay Public Key
4. cached den Public Key maximal eine Stunde
5. validiert die Nachricht kryptografisch
6. verarbeitet das Event nur bei Erfolg

Ungültige Signatur:

```text
HTTP 412 Precondition Failed
```

Damit erzeugt ein beliebiger POST auf den öffentlichen Endpoint keinen Push.

### Idempotentes eBay-Setup

In der Nachrichten-Zentrale gibt es:

`eBay Push-Webhook einrichten`

Die App lässt das Backend:

1. aktuelle eBay Notification Topics abrufen
2. `NEW_MESSAGE` anhand des aktuellen Topic-Datensatzes finden
3. vorhandene Destination für unseren HTTPS-Endpoint suchen
4. nur wenn nötig eine neue Destination erstellen
5. vorhandene Subscription suchen
6. nur wenn nötig eine neue `ENABLED` Subscription erstellen

Wir speichern keine fest codierte Topic-ID, sondern fragen sie aktuell bei
eBay ab.

### Subscription-Test

Wenn eine Subscription existiert:

`eBay Subscription testen`

verwendet:

```text
POST /commerce/notification/v1/subscription/{subscription_id}/test
```

### Expo Push

Client:

```text
expo-notifications ~57.0.13
expo-constants ~57.0.14
expo-dev-client ~57.0.15
```

V19 benutzt einen Expo Push Token.

Der EAS `projectId` wird gemäß Expo-Dokumentation aus:

```text
Constants.expoConfig.extra.eas.projectId
```

bzw. `Constants.easConfig.projectId` gelesen.

Ohne EAS Project ID wird Push nicht als aktiviert ausgegeben.

### Android

Auf Android wird vor dem Push-Token ein eigener Channel erstellt:

```text
buyer-messages
```

mit hoher Priorität.

Ab Android 13 muss der Nutzer die Systemberechtigung für Benachrichtigungen
erteilen.

### Development Build erforderlich

Remote Push ist auf Android in Expo Go nicht für diesen Workflow geeignet.
Deshalb enthält V19 zusätzlich:

```text
eas.json
expo-dev-client
```

Profile:

- development
- preview
- production

### Push-Aktivierung ist bewusst

Die App fragt nicht ungefragt beim Start nach Push-Berechtigung.

In der Nachrichten-Zentrale:

```text
Push für dieses Gerät aktivieren
```

Erst dieser Button:

1. erzeugt den Android-Channel
2. fragt die Systemberechtigung
3. holt den Expo Push Token
4. registriert ihn am eigenen Backend

### App ↔ Backend Pairing

Die Push-Registrierungs- und Setup-Endpunkte sind nicht offen zugänglich.

Server:

```env
PUSH_PAIRING_CODE=
```

Mindestens 8 Zeichen.

In der App wird derselbe Code einmal unter:

```text
PUSH & WEBHOOK → Backend-Pairing
```

eingetragen.

Der Code:

- wird lokal per AsyncStorage auf dem Gerät gespeichert
- wird nicht fest in den App-Quellcode eingebaut
- schützt:
  - Push-Gerät registrieren
  - Push-Test
  - eBay Notification Status
  - eBay Webhook Setup
  - eBay Subscription Test

Der öffentliche eBay Webhook selbst benötigt diesen Code nicht; er wird
kryptografisch durch eBays Signatur geschützt.

### Server-Endpunkte V19

```text
POST   /push/register
DELETE /push/register
GET    /push/status
POST   /push/test

GET    /notifications/ebay/status
POST   /notifications/ebay/setup
POST   /notifications/ebay/test

GET    /webhooks/ebay/messages
POST   /webhooks/ebay/messages
```

### Push Token Speicherung

Standard:

```env
PUSH_TOKEN_STORE_PATH=./data/push-tokens.json
```

Ungültige Expo Tokens mit `DeviceNotRegistered` werden automatisch entfernt.

Hinweis:
Diese Speicherung ist für den jetzigen Single-User-/Testbetrieb gedacht.
Für eine spätere echte Multiuser-Cloud-Version müssen Geräte-Tokens einem
authentifizierten Nutzer in einer persistenten Datenbank zugeordnet werden.

### Push antippen

V19 registriert:

```text
addNotificationResponseReceivedListener
```

und prüft auch die zuletzt angetippte Notification.

Push-Daten:

```json
{
  "screen": "inbox",
  "type": "new_message",
  "platform": "ebay",
  "conversationId": "..."
}
```

Beim Tippen:

```text
App öffnen
→ Nachrichten-Zentrale
→ passende eBay-Konversation laden
```

### Noch nicht enthalten

- echte Push-Connectoren für Kleinanzeigen / Facebook / Vinted / willhaben
- dauerhafte Multiuser-Datenbank
- Benutzer-Login / Accounts
- APNs/FCM-Direktanbindung ohne Expo Push Service

Die Connector-Architektur aus V18 bleibt dafür vorbereitet.
