# Play Console review notes — Wispel (familie-app)

Android-tegenhanger van `apps/ios/ReviewNotes.md`. Wispel wordt gepositioneerd als
**familie-app**, niet als kind-app — dus **niet** in het Play "Teacher Approved"/
kindgerichte programma. Doelgroep in de listing: ouders.

> **Status:** de Android-app is gebouwd maar **nog niet vrijgegeven**. Zie
> `docs/wispel-post-review-workstreams.md` §WS-ANDROID — beslissing P8 (Android geparkeerd
> tot Gate G5) staat open. Niet indienen bij Play zonder die PO-beslissing.

## Testinstructies voor de reviewer (één toestel)

1. Open de app → **Ik ben een ouder** om de ouder-onboarding te zien (Sign in with Apple).
2. Terug naar start → **Ik heb al een gezinscode**.
3. Vul de staging-gezinscode en kind-PIN in (zie tabel hieronder), kies het profiel.
4. Kindmodus: vink een taak af op **Mijn Dag** — trilling + confetti (of een rustige gloed
   wanneer de toegankelijkheidstime-out verlengd is).
5. Ouderpoort openen vanaf **Mijn Ster**: ~1,5 s vasthouden, of vijf keer tikken.
   Met TalkBack: aangepaste actie **"Open ouderpoort"**.
6. Bevestig dat vingerafdruk/schermvergrendeling **eerst** gevraagd wordt; pas daarna
   verschijnen de ouderinstellingen. De kind-pincode opent die poort bewust niet.
7. Account verwijderen: Instellingen → account wissen (vraagt opnieuw om Apple-login).

| Veld | Waarde |
|------|--------|
| Demo gezinscode | *(invullen na aanmaken review-gezin op staging)* |
| Demo kind (roepnaam) | `DemoKind` |
| Demo kind-PIN | `4242` |

## Data safety-formulier (Play Console)

| Categorie | Verzameld | Gedeeld | Reden |
|---|---|---|---|
| Foto's | Ja — taakfoto's | Nee | Optionele fotobonus; EXIF wordt server-side gestript, bewaartermijn 30 dagen |
| E-mailadres | Ja — alleen ouder, via Sign in with Apple | Nee | Accountherstel en ouderidentificatie |
| Toestel-ID's | Ja — FCM-registratietoken | Nee | Pushmeldingen; wordt bij uitloggen verwijderd |
| Gegevens van kinderen | **Geen e-mail, geen PII** | Nee | Kinderen hebben alleen een roepnaam en een pincode |

- **Geen tracking, geen advertenties, geen analytics-SDK van derden.**
- Gegevens zijn versleuteld onderweg (HTTPS) en niet opneembaar in back-ups
  (`data_extraction_rules.xml` sluit alles uit).
- Verwijderverzoek: in de app achter de ouderpoort, én via de webpagina.

## Compliance-punten

- Voor kinderen onder 13 blijft de **pincode altijd zichtbaar** naast de vingerafdruk
  (ADR-0002) — biometrie kan van een broer of zus zijn of ontbreken.
- Fotobonus gebruikt de Android-fotokiezer of de camera-preview; de app vraagt **geen**
  toegang tot de volledige fotobibliotheek en heeft dus geen opslagpermissie.
- `POST_NOTIFICATIONS` wordt pas gevraagd ná een in-app uitleg, nooit bij het opstarten.
  Zonder meldingen werkt de app volledig door.
- Meldingstekst op het vergrendelscherm blijft generiek: geen taaknaam, kindnaam of
  fotodetail.
- Beloningsgeluid is uit te zetten achter de ouderpoort.
- Geen betaalmuur, geen in-app aankopen, geen advertenties (ADR-0005).

## Build & omgeving

- Release-builds gebruiken `https://taakhelden-api.oostelaar.workers.dev/v1`. Er is
  bewust **geen** localhost-fallback.
- Lokale override voor een eigen staging: `TAAKHELDEN_API_BASE_URL` in `local.properties`.
- `npm run openapi:check` moet groen zijn (gedeeld contract ↔ gegenereerde Kotlin-modellen).

## Nog te doen vóór een echte inzending

- [ ] Apple Services ID + https-redirect invullen (`AppEnvironment.APPLE_SERVICES_ID`,
      `APPLE_REDIRECT_URI`) — zonder dat werkt ouder-login niet
- [ ] `google-services.json` toevoegen en FCM-Worker-secrets zetten
      (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`)
- [ ] Release-keystore + Play App Signing
- [ ] Play-listing: naam, beschrijving en screenshots met productnaam **Wispel**
- [ ] Data safety-formulier invullen conform de tabel hierboven
- [ ] Contentclassificatie (IARC) invullen — familie-app, geen UGC tussen gezinnen
- [ ] Staging-reviewgezin aanmaken en de credentials-tabel hierboven bijwerken
- [ ] E2E happy path op **twee fysieke toestellen** (ouder + kind)
- [ ] DPIA / privacyverklaring afgerond (`docs/taakhelden-dpia-starter.md`) — gedeelde
      productie-fotoblocker met iOS

## Gerelateerde docs

- Android-port en verschillen met iOS: `apps/android/README.md`
- iOS-tegenhanger: `apps/ios/ReviewNotes.md`
- DPIA starter: `docs/taakhelden-dpia-starter.md`
- Privacy minimum: `docs/taakhelden-privacy-minimum.md`
- Brand sheet: `docs/brand/wispel-brand-v1.md`
