# CODEX MASTER – VERKAUFSASSISTENT MOBILE

Stand: 27.08.2026  
Projektversion: 0.19.0  
Backend-Version: 0.19.0  
Ziel: bestehendes V19-Projekt stabil weiterentwickeln – NICHT neu aufsetzen.

---

## 1. Produktziel

Der Verkaufsassistent ist eine mobile iPhone-/Android-App für den vollständigen Verkaufsablauf gebrauchter oder neuer Artikel:

**Fotos → Erkennung → Masteranzeige → Preis → Versand → Plattformwahl → Veröffentlichung → Crossposting → Käufernachrichten → Reservierung/Verkauf → Restanzeigen entfernen → Historie/Push.**

Die App soll langfristig eine echte **Verkaufszentrale** sein, nicht nur ein Textgenerator.

---

## 2. Nicht verhandelbare Regeln

1. **Nichts erfinden.** Keine Marke, Modellnummer, Funktion, Maße, Material, Zubehör, Schäden, Versandart, Zahlungsart oder rechtliche Aussage hinzudichten.
2. **Unsicherheit sichtbar machen.** Bei Zweifel Rückfrage/Prüfhinweis statt Behauptung.
3. **Schäden niemals kaschieren.** Keine Retusche/Optimierung, die Kratzer, Dellen, Brüche oder Gebrauchsspuren entfernt.
4. **Keine erfundenen Plattform-APIs.** Nur echte, verifizierte APIs als direkte Integration bezeichnen.
5. **Keine automatische Käuferkommunikation.** Senden nur nach explizitem Nutzer-Tap + Bestätigung.
6. **Keine automatische Preisänderung.** Vorschläge ja, selbstständige Änderung nein.
7. **Keine automatische Löschung anderer Plattformanzeigen**, außer eine echte API-Funktion wird bewusst ausgelöst.
8. **Secrets nie in Clientcode.** API-Keys/OAuth-Secrets ausschließlich Backend/Server.
9. **Artikelstatus und Plattformstatus getrennt halten.**
10. **Privatsphäre-Blocker nicht umgehen.**

---

## 3. Aktueller Stand V19

### Grundfunktionen
- Expo / React Native, mobil-first
- Kamera + Galerie, max. 12 Fotos
- Titelbild, Fotolöschung, Rollen (Cover/Typenschild/Schaden/Zubehör)
- Barcode/EAN-Scanner
- Typenschild-Modus
- Spracheingabe
- Stapelverkauf
- lokale Speicherung via AsyncStorage

### KI
Wählbare Provider:
- OpenAI
- Claude
- Gemini

Die Wahl bleibt beim Nutzer.

### KI-Analyse
- gemeinsame Analyse aller Fotos
- strukturierter ListingDraft
- keine erfundenen Produktdaten
- Rückfragen bei Unsicherheit

### Foto-Preflight
Prüft u. a.:
- Unschärfe
- Helligkeit / Überbelichtung
- Ausschnitt
- Hintergrund
- Detailqualität
- Wasserzeichen
- Privatsphäre

Warnungen u. a. bei:
- Gesicht
- Adresse
- Kennzeichen
- persönlichem Dokument
- Seriennummer

Kritische Privatsphäre-Warnungen blockieren Publish, bis der Nutzer selbst geprüft/bestätigt hat.

### Preisassistent
- Schnell verkaufen
- marktüblich
- höher ansetzen
- Verkaufsziel: fast / balanced / maximize
- Preisverlauf
- Nachfasslogik nach Online-Dauer

### Versandassistent V15
Deutschland aktuell:
- DHL / Deutsche Post
- Hermes
- DPD

Eingaben:
- Gewicht
- Länge/Breite/Höhe des **fertig verpackten Pakets**
- Priorität
- Haustür / Shop / egal

Ausgaben:
- passende Tarife
- Preis
- Tracking
- Standardhaftung
- Warnungen

Wenn Paketdaten geändert werden, wird ein zuvor übernommener Versandtarif ungültig.

### Verkaufszentrale
Statusübersicht:
- Entwürfe
- Vorbereitet
- Online
- Reserviert
- Verkauft
- Entfernt

### Artikel-Lebenszyklus V16
```ts
type ListingStatus =
  | "draft"
  | "prepared"
  | "online"
  | "reserved"
  | "sold"
  | "removed";
```

Historie mit Zeitstempeln wird gespeichert.

Wichtig: `removed` ist **nicht** endgültig gelöscht.

### Plattformstatus
```ts
type PlatformListingStatus =
  | "not_selected"
  | "prepared"
  | "online"
  | "sold"
  | "removed";
```

Beispiel zulässig:
```text
Artikelstatus: sold
Kleinanzeigen: sold
eBay: online
Facebook: online
```
Das bedeutet: Artikel verkauft, aber Restanzeigen noch aktiv.

### Plattformen
Konfiguriert:
- kleinanzeigen
- ebay
- facebook
- vinted
- willhaben
- shpock
- quoka
- hood
- markt

Direkte Integrationen nur behaupten, wenn verifiziert.

### eBay V8–V19
Vorhanden:
- OAuth Authorization Code Grant
- Sandbox / Production
- Diagnostik
- Taxonomy
- Kategorien
- Aspekte
- Conditions
- Business Policies
- Inventory Locations
- eBay Media/EPS Bild-Upload
- Inventory Item
- Offer
- publishOffer
- Listing-ID / Offer-ID / SKU / URL speichern
- `withdrawOffer` zum Beenden aktiver Listings

Nach erfolgreichem Publish wird u. a. gespeichert:
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

### Verkauf abschließen V17
- Verkaufsquelle auswählen
- fremde aktive Restanzeigen erkennen
- eBay automatisch via `withdrawOffer`
- andere Plattformen: öffnen + manuell als entfernt bestätigen

### Nachrichten-Zentrale V18
Unified Inbox.

Echter Connector aktuell: **eBay Commerce Message API**.

Backend:
```text
GET  /messages/inbox
GET  /messages/ebay/conversation/:conversationId
POST /messages/ebay/send
POST /messages/ebay/read
```

Scope:
```text
https://api.ebay.com/oauth/api_scope/commerce.message
```

Schnellantworten:
- noch verfügbar
- Versand
- Abholung
- Zahlung
- Preis/VB
- Reservierung
- verkauft
- Angebot annehmen
- ablehnen
- Gegenangebot

Vorlagen dürfen nur tatsächlich gespeicherte Artikeldaten verwenden.

### Push V19
Flow:
```text
eBay NEW_MESSAGE
→ öffentlicher HTTPS Webhook
→ X-EBAY-SIGNATURE validieren
→ Expo Push Service
→ Handy
→ Tap
→ Nachrichten-Zentrale
→ passende Konversation
```

Öffentliche Webhook-Routen:
```text
GET  /webhooks/ebay/messages
POST /webhooks/ebay/messages
```

GET beantwortet eBay Challenge.
POST verarbeitet Events nur nach gültiger Signatur.
Ungültige Signatur → HTTP 412.

Push enthält bewusst **nicht** den Käufertext, nur z. B.:
```text
Neue eBay-Anfrage
Eine neue Käufernachricht ist eingegangen.
```

Push-Daten enthalten Conversation-ID für Deep-Link in die Inbox.

---

## 4. Aktueller App-Flow

```text
Verkaufszentrale
  ├─ Neuer Artikel
  │   ├─ Fotos / Barcode / Typenschild / Sprache
  │   ├─ Foto-Preflight
  │   ├─ KI-Analyse
  │   ├─ Masteranzeige
  │   ├─ Preisassistent
  │   ├─ Versand/Zahlung
  │   ├─ Versandassistent
  │   ├─ Plattformempfehlung
  │   ├─ plattformspezifische Texte
  │   ├─ eBay Preflight / Publish
  │   └─ Crossposting
  ├─ Stapelverkauf
  ├─ Nachrichten-Zentrale
  ├─ Persönliche Standards
  └─ Artikelstatus / Historie
```

---

## 5. Persönliche Standards
Gespeichert u. a.:
- bevorzugte KI
- Land
- PLZ / Ort
- Versand / Abholung
- Versanddienst
- Versandkosten
- Zahlungsarten
- bevorzugte Plattformen
- Verkaufsziel

Diese gelten als Default für neue Artikel, bleiben aber artikelweise überschreibbar.

---

## 6. Backend ENV

Mindestens:
```env
PORT=8787

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=

GEMINI_API_KEY=
GEMINI_MODEL=

EBAY_ENV=sandbox
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_RUNAME=
EBAY_MARKETPLACE_ID=EBAY_DE

PUBLIC_BASE_URL=https://...

EBAY_NOTIFICATION_VERIFICATION_TOKEN=
PUSH_PAIRING_CODE=
PUSH_TOKEN_STORE_PATH=./data/push-tokens.json
```

Regeln:
- `PUBLIC_BASE_URL` muss für eBay Notification öffentlich per HTTPS erreichbar sein.
- Verification Token serverseitig halten.
- Pairing-Code nicht im Client hart codieren.

---

## 7. Push / Expo V19
Dependencies:
```json
{
  "expo-notifications": "~57.0.13",
  "expo-constants": "~57.0.14",
  "expo-dev-client": "~57.0.15"
}
```

Android Channel:
```text
buyer-messages
```

EAS Project ID wird aus `Constants.expoConfig.extra.eas.projectId` bzw. `Constants.easConfig.projectId` gelesen.

`eas.json` ist vorhanden.

Remote Push soll mit Development-/Preview-/Production-Build getestet werden, nicht auf Expo Go verlassen.

---

## 8. Push-Pairing
Private Setup-/Push-Routen sind per `PUSH_PAIRING_CODE` geschützt.

Geschützt:
```text
POST   /push/register
DELETE /push/register
GET    /push/status
POST   /push/test
GET    /notifications/ebay/status
POST   /notifications/ebay/setup
POST   /notifications/ebay/test
```

App speichert den Pairing-Code lokal per AsyncStorage.

---

## 9. Wichtige Dateien

### Root
```text
App.tsx
README.md
app.json
package.json
tsconfig.json
eas.json
```

### Backend
```text
backend/server.mjs
backend/package.json
backend/.env.example
```

### Zentrale Komponenten
```text
src/components/SalesCenter.tsx
src/components/BatchSelling.tsx
src/components/PhotoAuditPanel.tsx
src/components/BarcodeScanner.tsx
src/components/VoiceNoteInput.tsx
src/components/ShippingAssistant.tsx
src/components/LifecyclePanel.tsx
src/components/CrosspostingStatusPanel.tsx
src/components/PlatformCleanupPanel.tsx
src/components/InboxScreen.tsx
src/components/PushSetupPanel.tsx
src/components/EbayPublishPanel.tsx
src/components/EbayDiagnosticsPanel.tsx
src/components/PlatformCopyCard.tsx
src/components/PhotoTile.tsx
src/components/UserPreferencesScreen.tsx
```

### Zentrale Services
```text
src/services/analyze.ts
src/services/providers.ts
src/services/pricing.ts
src/services/platforms.ts
src/services/platformRecommendations.ts
src/services/platformCopy.ts
src/services/listingStore.ts
src/services/preferencesStore.ts
src/services/photoAudit.ts
src/services/shippingCatalog.ts
src/services/lifecycle.ts
src/services/ebay.ts
src/services/ebayPublish.ts
src/services/ebayDiagnostics.ts
src/services/inbox.ts
src/services/buyerMessages.ts
src/services/pushNotifications.ts
src/services/pushPairing.ts
```

### Zentrale Types
```text
src/types/ai.ts
src/types/listing.ts
src/types/platform.ts
src/types/platformCopy.ts
src/types/recommendation.ts
src/types/seller.ts
src/types/ebay.ts
src/types/salesCenter.ts
src/types/lifecycle.ts
src/types/shipping.ts
src/types/photoAudit.ts
src/types/batch.ts
src/types/inbox.ts
src/types/buyerMessages.ts
src/types/platformCleanup.ts
src/types/push.ts
src/types/userPreferences.ts
```

---

## 10. Vollständiges aktuelles File-Inventar

```text
.env.example
.gitignore
App.tsx
README.md
app.json
backend/.env.example
backend/package.json
backend/server.mjs
eas.json
package.json
src/components/BarcodeScanner.tsx
src/components/BatchSelling.tsx
src/components/CrosspostingStatusPanel.tsx
src/components/EbayDiagnosticsPanel.tsx
src/components/EbayPublishPanel.tsx
src/components/InboxScreen.tsx
src/components/LifecyclePanel.tsx
src/components/PhotoAuditPanel.tsx
src/components/PhotoTile.tsx
src/components/PlatformCleanupPanel.tsx
src/components/PlatformCopyCard.tsx
src/components/PushSetupPanel.tsx
src/components/SalesCenter.tsx
src/components/ShippingAssistant.tsx
src/components/UserPreferencesScreen.tsx
src/components/VoiceNoteInput.tsx
src/config.ts
src/services/analyze.ts
src/services/buyerMessages.ts
src/services/demoData.ts
src/services/ebay.ts
src/services/ebayDiagnostics.ts
src/services/ebayPublish.ts
src/services/inbox.ts
src/services/lifecycle.ts
src/services/listingStore.ts
src/services/photoAudit.ts
src/services/platformCopy.ts
src/services/platformRecommendations.ts
src/services/platforms.ts
src/services/preferencesStore.ts
src/services/pricing.ts
src/services/providers.ts
src/services/pushNotifications.ts
src/services/pushPairing.ts
src/services/salesIntelligence.ts
src/services/seller.ts
src/services/shippingCatalog.ts
src/services/voiceNotes.ts
src/types/ai.ts
src/types/batch.ts
src/types/buyerMessages.ts
src/types/ebay.ts
src/types/inbox.ts
src/types/lifecycle.ts
src/types/listing.ts
src/types/photoAudit.ts
src/types/platform.ts
src/types/platformCleanup.ts
src/types/platformCopy.ts
src/types/push.ts
src/types/recommendation.ts
src/types/salesCenter.ts
src/types/seller.ts
src/types/shipping.ts
src/types/userPreferences.ts
tsconfig.json
```

---

## 11. Bekannte Grenzen – NICHT als fertig behaupten

1. Kein vollständig verifizierter Expo-Release-Build in dieser Arbeitsumgebung.
2. eBay Sandbox/Production Push/Webhook wurde noch nicht mit realen Credentials end-to-end getestet.
3. eBay OAuth Token Store ist noch nicht multiuser-sicher persistent.
4. Push Token Store ist derzeit Single-User/Testarchitektur.
5. Noch kein Benutzerlogin / Multiuser-Accountsystem.
6. Noch kein verschlüsseltes Cloud-Sync zwischen Geräten.
7. Keine echten Inbox-/Posting-Connectoren für Kleinanzeigen/Facebook/Vinted/willhaben/etc., solange nicht verifiziert.
8. Kein automatisches Entfernen auf Plattformen ohne echte API.
9. Kein finaler App-Store Release.
10. Kein vollständiger End-to-End Test auf realem iPhone + Android.
11. eBay Business Policies müssen vorhanden sein.
12. eBay GPSR/regulatorische Pflichtfelder können je Kategorie weitere Angaben verlangen.
13. Keine automatischen Käuferantworten.
14. Keine automatisch erzeugten rechtlichen Rückgabe-/Zahlungsbedingungen.
15. Statische Versandtarife sind Hilfswerte und müssen vor realem Labelkauf gegen den Anbieter geprüft werden.

---

## 12. Nächste Prioritäten für Codex

### PRIORITÄT A – Projekt stabil bauen
**Zuerst erledigen, bevor neue große Features kommen.**

1. Dependencies installieren.
2. vollständigen TypeScript-Check ausführen.
3. `npx expo-doctor` ausführen.
4. Development Build konfigurieren/prüfen.
5. echte Compile-Fehler beheben.
6. Android Build testen.
7. iOS Build testen.
8. Runtime-Probleme dokumentieren und beheben.

Keine Funktionen entfernen, nur um den Build grün zu bekommen.

### PRIORITÄT B – eBay End-to-End Sandbox
1. Sandbox ENV prüfen.
2. OAuth neu verbinden inklusive `commerce.message`.
3. Diagnostics prüfen.
4. Testartikel publishen.
5. Offer/Listing/SKU Persistenz prüfen.
6. eBay Inbox abrufen.
7. Antwort senden.
8. Notification Destination anlegen.
9. `NEW_MESSAGE` Subscription aktivieren.
10. Challenge prüfen.
11. Signaturprüfung testen.
12. Expo Test-Push.
13. eBay Nachricht → Push → konkrete Conversation testen.
14. `withdrawOffer` testen.

### PRIORITÄT C – Persistenz / Sicherheit
- eBay OAuth Tokens verschlüsselt persistent speichern.
- Push Tokens persistent und später userbezogen speichern.
- keine in-memory-only kritischen Zustände.

### PRIORITÄT D – Idempotenter eBay Publish
State Machine speichern:
```text
draft
images_uploaded
inventory_created
offer_created
published
withdrawn
```
Bei Retry kein zweites Offer erzeugen, wenn bereits eins existiert.

### PRIORITÄT E – Backup / Import
- lokale Artikeldaten exportieren
- importieren
- Einstellungen sichern
- Gerätewechsel ermöglichen

### PRIORITÄT F – Multiuser erst später
Wenn Single-User stabil:
- Auth
- Account
- Datenbank
- User-ID
- Token-Vault
- Push Tokens pro User
- Datenexport/-löschung

---

## 13. Codex-Regeln

Codex MUSS:

1. Bestehende Architektur respektieren.
2. Nicht bei jeder Aufgabe App neu strukturieren.
3. Bestehende Funktionen erhalten.
4. Keine API-Endpunkte raten.
5. Bei externen APIs aktuelle offizielle Dokumentation prüfen.
6. Keine Secrets in React-Native-Code schreiben.
7. Fehler sichtbar machen statt Daten zu erfinden.
8. Datenmodelle rückwärtskompatibel halten, soweit sinnvoll.
9. Nach größeren Änderungen README + diese Masterdatei aktualisieren.
10. Backend mit `node --check backend/server.mjs` prüfen.
11. TypeScript/Expo Build prüfen.
12. Keine Käufernachricht automatisch senden.
13. Keine Preise selbstständig ändern.
14. Keine Schäden aus Bildern entfernen.
15. Privatsphäre-Blocker nicht umgehen.
16. Artikelstatus und Plattformstatus getrennt behandeln.
17. `removed` nicht mit endgültigem Löschen verwechseln.
18. Bei API-Fehlern keinen erfolgreichen Status vortäuschen.
19. Bei eBay-Publish Retry keine doppelten Offers erzeugen.
20. Eine neue Version nur nach tatsächlich zusammenhängendem, dokumentiertem Stand erzeugen.

---

## 14. Coding Style

- TypeScript
- kleine Services statt zusätzliche Monolithen in `App.tsx`
- Businesslogik möglichst außerhalb UI
- UI-Komponenten klar und testbar
- deterministische Regeln (Preis/Versand/Lifecycle) in Services
- API-Rohfehler in verständliche Meldungen übersetzen
- keine versteckten Side Effects
- keine stillen Datenverluste

---

## 15. Validierungscheckliste nach jeder größeren Änderung

```text
[ ] App startet
[ ] TypeScript Build/Check
[ ] Expo Doctor
[ ] Backend node --check
[ ] keine Secrets im Client
[ ] gespeicherte alte Listings weiter lesbar
[ ] Foto-Preflight intakt
[ ] Preislogik intakt
[ ] Versandlogik intakt
[ ] Lebenszyklus intakt
[ ] Plattformstatus intakt
[ ] eBay Publish intakt
[ ] withdrawOffer intakt
[ ] Inbox intakt
[ ] Push intakt
[ ] keine erfundene Plattformfunktion
[ ] keine automatische Käuferantwort
[ ] keine automatische Preisänderung
[ ] README aktualisiert
[ ] CODEX_MASTER aktualisiert
```

---

## 16. Wenn Codex einen Fehler findet

Nicht Funktion entfernen oder stark vereinfachen, um das Problem zu verstecken.

Vorgehen:
1. Ursache lokalisieren.
2. Datenmodell/Call Chain prüfen.
3. Regression vermeiden.
4. gezielt reparieren.
5. Build/Test durchführen.
6. Reparatur dokumentieren.

Wenn etwas aktuell nicht sicher lösbar ist: klares TODO statt erfundener Lösung.

---

## 17. Empfohlener nächster Codex-Auftrag

Wenn keine andere konkrete Aufgabe vorliegt, starte mit:

> **„Arbeite PRIORITÄT A der CODEX_MASTER.md ab. Installiere die Dependencies, führe einen vollständigen TypeScript-/Expo-Buildcheck durch, behebe echte Compile-/Runtime-Probleme ohne Funktionen zu entfernen, dokumentiere jede Reparatur und aktualisiere danach README und CODEX_MASTER.md.“**

---

## 18. Quellenpriorität innerhalb des Projekts

Bei Widersprüchen gilt:

1. tatsächlich aktueller V19-Code
2. `CODEX_MASTER.md`
3. aktuelle `README.md`
4. ältere Versionen / alte Chatverläufe

Ältere ZIPs niemals als aktuellen Stand behandeln, wenn V19 vorhanden ist.
