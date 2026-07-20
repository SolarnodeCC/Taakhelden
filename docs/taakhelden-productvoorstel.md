# TaakHelden — Productvoorstel
### Gamification-app voor huiswerk & huishoudelijke taken (iOS + Web)

*Werktitel: "TaakHelden" (alternatieven: KlusKids, PuntjePunt, HeldenHuis)*

---

## 1. Productvisie

TaakHelden maakt van dagelijkse taken een positief spel. Kinderen verdienen punten door huiswerk en huishoudelijke taken af te ronden; ouders bepalen zelf de taken én de beloningen. De app straft nooit — hij viert wat wél gelukt is. Geen rode kruisen, geen verloren punten, geen ranglijst die een kind onderaan zet.

**Kernprincipes:**
1. **Positief-eerst**: alle taal, notificaties en visuals belonen inzet, niet alleen resultaat.
2. **Ouders aan het stuur**: taken, punten en beloningen zijn volledig configureerbaar; templates zijn een startpunt.
3. **Privacy by design**: minimale data, alles binnen het gezin, niets publiek, AVG-proof voor kinderen.
4. **Autonomie van het kind**: het kind vinkt zelf af, kiest zelf beloningen, ziet zelf zijn voortgang.

---

## 2. Doelgroepen & rollen

| Rol | Leeftijd | Behoefte |
|---|---|---|
| **Kind (jong)** | 4–7 | Grote knoppen, iconen i.p.v. tekst, voorleesfunctie, avatars |
| **Kind (midden)** | 8–12 | Punten, streaks, badges, avatar-customisatie |
| **Kind (tiener)** | 13–17 | Volwassener design-modus, minder "kinderachtig", focus op beloningen & zelfstandigheid |
| **Ouder/verzorger** | — | Overzicht, snel taken instellen, goedkeuren, beloningen beheren |
| **Co-ouder** | — | Gedeeld beheer over gezinnen heen (co-ouderschap: kind kan in 2 huishoudens bestaan) |

De UI schakelt automatisch tussen drie leeftijdsmodi op basis van geboortejaar (door ouder ingesteld).

---

## 3. Functioneel ontwerp

### 3.1 Onboarding & accounts
- **Ouder maakt het gezin aan** (e-mail + wachtwoord of Sign in with Apple / Google).
- Ouder maakt **kindprofielen** aan — het kind heeft géén eigen e-mail nodig (belangrijk voor AVG en App Store Kids-regels).
- **Koppelen kind-apparaat**: ouder genereert een QR-code of 6-cijferige gezinscode; kind scant/voert in op eigen device en kiest zijn profiel + pincode of Face ID.
- Profielbeeld: **avatar-bibliotheek** (divers: huidskleuren, haarstijlen, rolstoel, bril, dieren/fantasy als genderneutrale optie — niet alleen "jongens en meisjes") óf eigen foto. **Foto's van kinderen blijven standaard alleen lokaal + versleuteld in het gezinsaccount**, nooit zichtbaar buiten het gezin.
- Ouderlijke toestemming expliciet vastgelegd bij aanmaken kindprofiel (AVG art. 8: in NL is toestemming van ouders vereist onder 16).

### 3.2 Taken
- **Twee categorieën**: Huishouden 🧹 en Huiswerk 📚 (uitbreidbaar: zelfzorg, sport, lezen).
- **Taakvelden**: titel, icoon, beschrijving, punten, frequentie (eenmalig / dagelijks / weekdagen / weekschema), deadline of dagdeel (ochtend/middag/avond), toegewezen kind(eren), foto-bonus aan/uit, goedkeuring door ouder vereist ja/nee.
- **Templates per leeftijd** (voorbeelden):
  - 4–5: speelgoed opruimen, kleren in de wasmand, tafel helpen dekken
  - 6–7: bed opmaken, huisdier eten geven, tafel afruimen
  - 8–9: stofzuigen eigen kamer, vaatwasser uitruimen, plantjes water geven
  - 10–12: was opvouwen, koken helpen, vuilnis buiten zetten, huiswerkplanning
  - 13+: zelfstandig koken (1x/week), boodschappen, was draaien, eigen huiswerkagenda
- **Herhalende taken** genereren automatisch dagelijkse instanties.
- **Roulatie**: een taak kan wisselen tussen kinderen ("deze week doet Sam de vaatwasser, volgende week Noor").

### 3.3 Afvinken & foto-bewijs
- Kind tikt taak aan → grote, bevredigende afvink-animatie + geluid/haptics.
- **Foto-bonus**: kind fotografeert het resultaat → +X bonuspunten. Foto gaat naar de ouder ter goedkeuring en wordt na 30 dagen automatisch verwijderd (data-minimalisatie).
- Optioneel: **ouder-goedkeuring** per taak. Bij afkeuring geen puntenverlies maar een vriendelijke "bijna! nog even dit:" met toelichting van de ouder — kind kan opnieuw indienen.

### 3.4 Puntensysteem (drie lagen)
| Laag | Hoe verdien je het | Doel |
|---|---|---|
| **Taakpunten** | Per afgeronde taak (door ouder ingesteld, bijv. 5–50) | Directe beloning |
| **Dagbonus** | Alle taken van vandaag af → vast bonusbedrag | Dagelijkse routine |
| **Weekbonus** | Weekdoel gehaald (bijv. 80% van de taken — niet 100%, om één slechte dag niet alles te laten verpesten) | Volhouden |

Extra motivatoren:
- **Streaks** 🔥 met "streak-bescherming": één gemiste dag per week breekt de streak niet (vergevingsgezind ontwerp).
- **Badges**: "Eerste week vol!", "10 foto's gemaakt", "Huiswerkkampioen" — alleen positieve mijlpalen.
- **Level & avatar-items**: met levels ontgrendel je gratis avatar-accessoires (petjes, achtergronden). Geen echte aankopen in de kinderomgeving.
- **Géén negatieve mechanieken**: geen puntenaftrek, geen zichtbare vergelijking tussen broers/zussen tenzij ouders bewust een gezamenlijk (coöperatief!) gezinsdoel aanzetten ("samen 500 punten = pizza-avond").

### 3.5 Beloningswinkel
- Ouders definiëren beloningen: naam, icoon/foto, puntenprijs, voorraad (bijv. max 1x/week).
- Voorbeelden in template: 30 min extra schermtijd (100 pt), film uitkiezen (150 pt), uitje naar het zwembad (500 pt), later opblijven in het weekend (200 pt).
- Kind "koopt" beloning → ouder krijgt notificatie → ouder markeert als ingelost.
- Spaardoelen: kind kan een beloning "pinnen" en ziet een voortgangsbalk ("nog 120 punten tot de bioscoop!").

### 3.6 Ouder-dashboard (app + web)
- Vandaag-overzicht per kind: wat staat open, wat is af, wat wacht op goedkeuring.
- Goedkeuringswachtrij (met foto's) — één tik goed/opnieuw.
- Taak- en beloningsbeheer, weekplanner (drag & drop op web).
- Inzichten: trends per week, welke taken blijven liggen, verdiend vs. uitgegeven — **gepresenteerd als hulp voor het gesprek, nooit als surveillance-tool**.
- Instellingen: notificatietijden, weekbonus-drempel, stille dagen (bijv. vakantie-modus die streaks pauzeert).

### 3.7 Notificaties — positief taalgebruik
Toon-richtlijnen (opnemen in een "content style guide"):

| Situatie | ❌ Niet | ✅ Wel |
|---|---|---|
| Taak staat open | "Je bent vergeten je kamer op te ruimen" | "Je kamer wacht op je superkrachten! 💪 (+10 punten)" |
| Dag bijna om | "Laatste kans!" | "Nog 1 taakje en je hebt je dagbonus binnen! 🌟" |
| Week gehaald | — | "WAUW! Weekbonus verdiend — je bent een echte TaakHeld! 🏆" |
| Taak afgekeurd | "Afgekeurd" | "Bijna! Papa vraagt of je nog even naar de hoekjes wil kijken 😉" |
| Kind was inactief | "Je hebt 3 dagen niets gedaan" | (géén notificatie naar kind; alleen zachte melding naar ouder) |

Regels: max. 2 notificaties per dag naar een kind, nooit na bedtijd (instelbaar), nooit schuldgevoel-taal, altijd vanuit kans/beloning geformuleerd.

---

## 4. UI-ontwerp

### 4.1 Kind-app
- **Home = "Mijn Dag"**: grote kaarten per taak met icoon, punten en één afvink-knop. Bovenaan: avatar + puntenteller + streak-vlammetje.
- **Visuele stijl**: warme, ronde vormen; vrolijk maar niet schreeuwerig kleurenpalet (bijv. koraal, turquoise, zonnig geel op crème); dikke afgeronde typografie (SF Rounded); confetti/animaties bij afronden (Lottie).
- **Tienermodus**: zelfde structuur, gedempt palet (donkerblauw/mint), minder emoji, "punten" i.p.v. mascotte-taal.
- **Jonge-kind-modus**: bijna tekstloos, alles met iconen + voorleesknop (AVSpeechSynthesizer), extra grote tap-targets.
- **Tabbladen kind**: Mijn Dag · Winkel · Mijn Held (avatar/badges/level).
- Toegankelijkheid: Dynamic Type, VoiceOver-labels, kleurenblind-veilige statuskleuren (niet alleen rood/groen — gebruik vorm + kleur).

### 4.2 Ouder-app & website
- Zakelijker en rustiger: wit/neutraal met accentkleur, datavisualisatie licht en vriendelijk.
- Website = volwaardig ouder-dashboard (React) — kinderen gebruiken primair de app; de web-kindweergave is read-only "mijn punten bekijken" via gezinscode (optioneel, fase 2).
- Zelfde designtokens delen tussen iOS en web voor merkherkenning.

### 4.3 Mascotte
Een vriendelijke mascotte (bijv. een vosje "Vinkie") die aanmoedigt, tips geeft en meeleeft. Uitschakelbaar in tienermodus.

---

## 5. Architectuur

### 5.1 Overzicht

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐
│  iOS-app     │   │  Website      │   │ (later:       │
│  SwiftUI     │   │  React/Next.js│   │  Android)     │
└──────┬──────┘   └──────┬───────┘   └──────┬────────┘
       │                 │                   │
       └────────┬────────┴───────────────────┘
                ▼
        ┌───────────────┐
        │  API-laag      │  REST/JSON of GraphQL
        │  (EU-regio)    │  Auth, autorisatie per gezin
        └──────┬────────┘
               ▼
   ┌───────────┬───────────────┬──────────────┐
   │ PostgreSQL │ Object storage│ Push (APNs/  │
   │ (gezinnen, │ (foto's,      │ FCM) +       │
   │ taken,     │ versleuteld,  │ planner voor │
   │ punten)    │ auto-expiry)  │ herhalingen  │
   └───────────┴───────────────┴──────────────┘
```

### 5.2 Technologiekeuzes

| Laag | Aanbeveling | Waarom |
|---|---|---|
| iOS | **SwiftUI**, min. iOS 16, MVVM | Moderne animaties, snelle ontwikkeling, Dynamic Type gratis |
| Lokale opslag | SwiftData/Core Data + **offline-first sync** | Kind moet kunnen afvinken zonder wifi; sync bij verbinding |
| Web | **Next.js (React)** + Tailwind | Ouder-dashboard, SSR voor snelheid, deelbare componentbibliotheek |
| Backend | **Supabase (EU) of Firebase (EU-regio)** voor MVP; eigen Node/NestJS + PostgreSQL bij groei | Snel live, row-level security per gezin, realtime updates |
| Foto's | S3-compatibele storage (EU) met server-side encryptie + lifecycle-rule (30 dagen) | Data-minimalisatie automatisch afgedwongen |
| Push | APNs (iOS) / web push, via backend-scheduler | Notificatietijden respecteren per tijdzone/bedtijd |
| Auth | Sign in with Apple (verplicht naast andere social logins in App Store), e-mail; kind-login via gezinscode + pincode | Kind heeft geen e-mail/PII nodig |

### 5.3 Datamodel (kern)

```
Family (id, naam, uitnodigingscode, instellingen)
User (id, family_id, rol: parent|child, naam/roepnaam,
      geboortejaar, avatar_id of foto_ref, pincode_hash)
Task (id, family_id, titel, categorie, icoon, punten,
      foto_bonus, goedkeuring_vereist, recurrence_rule)
TaskInstance (id, task_id, child_id, datum, status:
      open|ingediend|goedgekeurd|opnieuw, foto_ref, punten_verdiend)
Reward (id, family_id, titel, prijs, voorraad_regel)
Redemption (id, reward_id, child_id, status, datum)
PointsLedger (id, child_id, type: taak|dag|week|uitgave,
      bedrag, referentie, timestamp)   ← audit-trail, saldo = som
Badge / ChildBadge (verdiende badges)
```

Een **grootboek (ledger)** i.p.v. één saldoveld voorkomt sync-conflicten en maakt alles uitlegbaar ("waar komen mijn punten vandaan?").

### 5.4 Realtime & offline
- Kind vinkt offline af → lokaal opgeslagen → gesynchroniseerd zodra online; conflictregel: "afgevinkt wint".
- Ouder-dashboard krijgt realtime updates (websocket/Supabase Realtime) zodat goedkeuren direct kan.

---

## 6. Privacy & security (kern van het voorstel)

1. **AVG / kinderen**: verwerkingsgrondslag = toestemming van de ouder (art. 8 AVG, in NL grens 16 jaar). Toestemming expliciet vastleggen met tijdstempel. DPIA uitvoeren vóór launch (verwerking van kindergegevens is hoog-risico).
2. **Data-minimalisatie**: van het kind alleen roepnaam + geboortejaar (geen geboortedatum), geen e-mail, geen telefoonnummer, geen locatie, geen contacten.
3. **Foto's**: end-to-end binnen het gezin; versleuteld at rest (AES-256) en in transit (TLS 1.3); automatische verwijdering na 30 dagen; EXIF-locatiedata strippen bij upload.
4. **Hosting in de EU**, verwerkersovereenkomsten met alle subverwerkers, geen doorgifte buiten EER.
5. **Geen tracking, geen advertenties, geen third-party analytics SDK's in de kinderomgeving** (App Store Kids Category verbiedt dit ook). Alleen privacy-vriendelijke, geanonimiseerde productanalytics aan ouderkant (bijv. self-hosted Plausible/PostHog EU).
6. **Autorisatie**: row-level security — elke query afgebakend op family_id; kind-rol kan alleen eigen taken zien/afvinken, nooit beheren.
7. **Kind-toegang**: pincode/Face ID per profiel; sessies op kindapparaten korter geldig.
8. **Recht op verwijdering**: ouder kan kindprofiel of heel gezin met één actie definitief wissen (hard delete + storage cleanup binnen 30 dagen).
9. **Security-hygiëne**: rate limiting, gehashte pincodes (Argon2), secrets in keychain/vault, pentest vóór launch, responsible-disclosure-pagina.
10. **App Store**: bij Kids Category gelden extra regels (geen externe links zonder ouder-poort, "parental gate" voor instellingen/aankopen). Overweeg bewust: app als "familie-app" (categorie Lifestyle/Productivity) positioneren met kindermodus, dat geeft meer vrijheid dan de formele Kids Category — juridisch laten toetsen.

---

## 7. Wat je nog vergeten was (aanvullingen)

- **Co-ouderschap**: kind koppelbaar aan twee gezinnen/huishoudens met gescheiden of gedeelde puntenpot — belangrijk voor NL-markt.
- **Meerdere ouders/verzorgers** per gezin (opa/oma, oppas met beperkte rechten "alleen goedkeuren").
- **Vakantie-/ziektemodus**: pauzeert streaks en dagbonussen zonder gevoel van falen.
- **Onderhandel-knop**: kind kan (tienermodus) een taak voorstellen aan de ouder ("mag ik 20 punten voor auto wassen?") — stimuleert eigenaarschap.
- **Puntendevaluatie voorkomen**: richtlijnen in de app voor ouders over gezonde puntprijzen (onboarding-wizard stelt beloningen + prijzen in verhouding voor).
- **Broer/zus-dynamiek**: bewust géén individuele ranglijst; wel optioneel coöperatief gezinsdoel.
- **Huiswerk-specifiek**: terugkerende vakken, toetsdatum-taken ("elke dag 15 min Frans tot de toets"), timer/focus-modus (fase 2).
- **Widget & Apple Watch** (fase 2): "vandaag nog 2 taken" op het homescreen — laagdrempelig zonder de app te openen.
- **Verdienmodel**: freemium — gratis: 1 gezin, 2 kinderen, basistemplates; premium-gezinsabonnement (€3–4/mnd): onbeperkt kinderen, foto-bonus, inzichten, web-dashboard. Nooit betaalmuren die het kind ziet.
- **Naam/merk-check**: handelsnaam en domein vroeg vastleggen.
- **Pedagogische toets**: laat het beloningsontwerp reviewen door een kinderpsycholoog/pedagoog (extrinsieke vs. intrinsieke motivatie is een bekend risico van puntensystemen — de dag/weekbonus en autonomie-features dempen dit, maar expert-review is een sterk marketingpunt: "ontwikkeld met pedagogen").
- **Meertaligheid**: NL eerst, EN erbij voor bereik.

---

## 8. MVP-scope & roadmap

**MVP (3–4 maanden, iOS + ouder-web):**
1. Gezinsaanmaak, rollen, kindkoppeling via code
2. Taken (handmatig + 5 leeftijdstemplates), herhalingen
3. Afvinken + foto-bonus + goedkeuring
4. Punten (taak/dag/week) + ledger
5. Beloningswinkel + inlossen
6. Avatars (bibliotheek), basisbadges
7. Push-notificaties met positieve copy
8. Privacy-fundament: EU-hosting, RLS, foto-expiry, verwijderrecht

**Fase 2:** streaks + streak-bescherming, coöperatieve gezinsdoelen, inzichten-dashboard, widget, tienermodus-thema, co-ouderschap.

**Fase 3:** Android, Apple Watch, huiswerk-focustimer, avatar-shop met verdiende items, meertaligheid.

---

## 9. Openstaande beslissingen

1. Kids Category vs. familie-app-positionering in de App Store (juridisch/strategisch).
2. Supabase vs. Firebase vs. eigen backend (afhankelijk van teamkennis en groeiverwachting).
3. Verdienmodel-timing: premium vanaf launch of eerst gratis groeien.
4. Mascotte en merknaam.
