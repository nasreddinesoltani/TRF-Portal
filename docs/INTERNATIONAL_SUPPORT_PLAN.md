# TRF-Portal — International Competition Support
## Canonical Implementation Plan (final)

Status: **Planning — implementation deferred.**
Locked decision: **Foreign athletes are created first via `CreateAthlete` (relaxed "foreign participant" mode), then selected at registration. Registration never creates athletes.**

---

## 0. Design Principles

1. **Scenario-driven, not flag-driven.** The model encodes the 4 real event types the TRF runs. Anything that can't represent all four is rejected.
2. **Additive only.** Every new field has a safe default. The existing national workflow must not change behavior for any existing record.
3. **One `categoryAssignments[]` array, filtered by `type`.** Never duplicate it. An athlete can hold both a national and an international assignment per season; resolved by scope.
4. **Reference data is normalized.** Countries/federations live in a dedicated collection (ISO/IOC/flag), not free-text strings.
5. **Eligibility = branchable policy first, service later.** Ship scope-branching (low risk); extract `eligibilityService.js` once behavior stabilizes.
6. **Foreign athletes are created first, then selected — never auto-created at entry.** A foreign participant is a real `Athlete` record created up-front via `CreateAthlete` in a relaxed mode (no CIN, no TRF license; nationality + passport driven). Registration only selects existing athletes. This keeps a single source of truth, reuses existing create/import flows, and keeps the registration controller a pure select-and-validate step.
7. **No premature abstraction.** New roles and federation self-service deferred until a concrete event demands them.
8. **TRF is a data source, not a ranking calculator.** TRF produces accurate, structured results. External bodies (World Rowing, continental federations) consume those results via API and calculate their own rankings. TRF does not implement FISA point tables or world-ranking accumulation.

---

## 1. The Four Scenarios

| # | Scenario | Example | TRF role | TRF competes? | Entry mode |
|---|---|---|---|---|---|
| 1 | Inbound hosted (teams) | African/Arab Champs, African Olympic Qualification, Tunis Lake Regatta | Host | Yes | by nation |
| 2 | Inbound open (individuals) | International Masters regatta | Host | Yes | individual/mixed |
| 3 | Outbound | World Champs, World Cup | Participant only | Yes (delegation) | by nation |
| 4 | Organising-as-a-Service (OaaS) | Regional West African Champs in Togo | Service provider only | **No** | by nation (foreign) |

Anything in data/UI that cannot represent all four = incomplete.

---

## 2. Current-State Assessment (from the codebase)

### 2.1 Already supports national/international

- `Category.type ∈ ["national","international"]` with a compound index — `backend/Models/categoryModel.js:14-19,62-65`
- `Athlete.categoryAssignments[].type ∈ ["national","international"]` — `backend/Models/athleteModel.js:104-137`
- `Athlete.nationality` (free text), `Athlete.passportNumber` (unique sparse) — `athleteModel.js:182-197`
- `Club.type ∈ ["club","country","centre_de_promotion","ecole_federale"]` — `clubModel.js:20-25`
- `Competition.venue.country` (free text) — `competitionModel.js:60-61`
- Document pipeline already has a `passport` document type — `backend/Services/documentStatusService.js:19-23`
- Category controller already accepts both types — `backend/Controllers/categoryController.js:9`
- Trilingual (EN/FR/AR) localised-name schema everywhere.

### 2.2 Hardcoded national (the blockers)

| Location | Problem |
|---|---|
| `Models/competitionModel.js` | **No scope/level field.** Nothing distinguishes a national from an international event. |
| `competitionRegistrationController.js` → `findSeasonAssignment()` (~L469) | Only matches `assignment.type === "national"`. International assignments are ignored → eligibility fails. |
| `competitionRegistrationController.js` → `buildFallbackAssignment()` (~L583) | Hardcodes `type: "national"`. |
| `competitionRegistrationController.js` → `listEligibleAthletes` (~L837) | Athlete query forces `memberships: { $elemMatch: { club, status:"active", season } }` — excludes any foreign athlete with no TRF club membership. |
| `competitionRegistrationController.js` → `ensureMembershipForClub()` (~L426) + `createCompetitionEntries` (~L1224) | Require TRF club membership + active domestic license for **every** athlete. |
| `competitionRegistrationController.js` → `resolveClubContext` (~L393) | Registration always scoped to a single TRF club; no "enter as nation" / "unattached individual". |
| `categoryAssignmentService.js` | Auto-assignment runs only for `national`; no international equivalent. |
| `rankingPresets.js` / `RankingSystem.entityType` | Only `club | athlete` — no `nation` entity for medal tables. |
| `publicController.js` + `frontend/.../PublicHome.jsx` | Fixed "Tunisian Rowing Federation" branding; no scope separation, flags, or medal table. |
| `frontend/.../CompetitionManagement.jsx` | No scope selector; participation-rule checkboxes assume national categories. |
| `CreateAthlete` / athlete create flow | Assumes domestic TRF athletes (CIN-centric, license-driven). No "foreign participant" mode. |

---

## 3. Target Data Model

### 3.1 New `Country` Reference Model — `backend/Models/countryModel.js` (NEW)

Normalized home for nations/federations. Replaces free-text strings.

```js
code:           { type: String, required: true, unique: true, uppercase: true, trim: true }  // ISO 3166-1 alpha-3 ("TUN","FRA")
codeAlpha2:     { type: String, uppercase: true, trim: true }                                // ISO alpha-2 ("TN")
iocCode:        { type: String, uppercase: true, trim: true }                                // IOC code (usually == alpha-3)
names:          { en: { type: String, required: true }, fr: { type: String }, ar: { type: String } }
flagUrl:        { type: String, trim: true }
federationCode: { type: String, uppercase: true, trim: true }                               // FISA / continental fed code
federationNames:{ en: String, fr: String, ar: String }
isTrf:          { type: Boolean, default: false }                                           // marks the owning federation
isActive:       { type: Boolean, default: true, index: true }
sortOrder:      { type: Number, default: 0 }
```

Seed via `scripts/seedCountries.js` (TUN + African/Arab/Mediterranean + major rowing nations).

### 3.2 `Competition` — Add `scope` Subdocument

```js
export const COMPETITION_SCOPES  = ["national","international_hosted","international_open","international_outbound","international_oaas"];
export const PARTICIPATION_MODES = ["by_club","by_nation","individual","mixed"];
export const FOREIGN_ELIGIBILITY = ["relaxed","strict","none"];

const scopeSchema = new mongoose.Schema({
  type:                      { type: String, enum: COMPETITION_SCOPES, default: "national", index: true },
  organiserFederation:       { type: String, trim: true },        // alpha-3 / federation code organising the event
  hostFederation:            { type: String, trim: true },        // owning fed; TRF for 1/2/3, foreign fed for 4
  hostCountry:               { type: String, trim: true },        // ISO alpha-3 of the venue country
  participatingFederations:  [{ type: String, trim: true }],
  trfParticipates:           { type: Boolean, default: true },     // false for OaaS
  participationMode:         { type: String, enum: PARTICIPATION_MODES, default: "by_club" },
  foreignEligibilityMode:    { type: String, enum: FOREIGN_ELIGIBILITY, default: "relaxed" },
}, { _id: false });
```

On `competitionSchema`: `scope: { type: scopeSchema, default: () => ({}) }`.
New index: `{ "scope.type": 1, startDate: 1 }`.
Defensive read everywhere: `competition.scope?.type || "national"`.

### 3.3 `Club` — Federation Identity

```js
country:        { type: String, trim: true, index: true },   // ISO alpha-3
countryName:    { type: String, trim: true },
iocCode:        { type: String, uppercase: true, trim: true },
federationCode: { type: String, uppercase: true, trim: true },
flagUrl:        { type: String, trim: true },
```

A `type:"country"` club represents a national federation/team. Reused as the "competitor affiliation" for nation entries.

### 3.4 `Athlete` — Foreign-Participant Identity (additive, optional)

```js
nationalityCode:    { type: String, uppercase: true, trim: true, index: true },  // ISO alpha-3 (new, indexed)
representingNation: { type: String, trim: true },                                // display nation / flag source
federationCode:     { type: String, uppercase: true, trim: true },
fisaId:             { type: String, trim: true, sparse: true, unique: true },    // optional World Rowing id
externalId:         { type: String, trim: true },                                // foreign federation's athlete id
invitationStatus:   { type: String, enum: ["none","invited","confirmed","declined"], default: "none" },
isForeign:          { type: Boolean, default: false },                             // drives CreateAthlete relaxed mode
```

- The existing free-text `nationality` field is **kept** (no destructive migration). `nationalityCode` is the canonical key; backfill is best-effort.
- **One** `categoryAssignments[]` array. **No duplicate array.**
- `isForeign` is the single switch distinguishing a domestic (TRF-licensed, CIN-driven) athlete from a foreign participant. Set at creation when `nationalityCode !== "TUN"` (or flagged explicitly).

### 3.5 `CompetitionEntry` — "Who They Compete For"

```js
representingType:   { type: String, enum: ["club","nation","individual"], default: "club", index: true },
representingNation: { type: String, trim: true, index: true },                    // ISO alpha-3 (flag source)
documentType:       { type: String, enum: ["cin","passport","none"], default: "cin" },
```

Default `"club"` + `"cin"` keeps the national flow byte-for-byte identical.

### 3.6 `RankingSystem` — Nation Entity + Flag Grouping

- Extend `ENTITY_TYPE_OPTIONS` → add `"nation"`.
- Add `nationGrouping: { type: Boolean, default: false }` (drives flag column + medal table UI).
- New preset `NATION_MEDAL_TABLE` (`entityType:"nation"`, `scoringMode:"medals"`).

---

## 4. Foreign-Athlete Creation Model (Decision (b))

**Rule: foreign athletes are created first via `CreateAthlete`, then selected at registration. Registration never creates athletes.**

### 4.1 CreateAthlete — "Foreign Participant" Mode

`CreateAthlete.jsx` + `athleteController.createAthlete` gain a **Foreign participant** mode (toggle, or auto-detected from `nationalityCode !== "TUN"`). When foreign:

- **CIN not required** — the `cin` document/field becomes optional. Passport is the primary identity document.
- **No TRF license** is generated/required — `licenseStatus` may stay inactive; `licenseNumber` left empty.
- **No TRF club membership** required at creation.
- **Required instead:** `nationalityCode`, `representingNation`, and the **passport** document (+ photo/medical as today). `federationCode`/`fisaId`/`externalId` optional.
- **Category assignment:** an **international** assignment is auto-built at creation via the new `ensureInternationalCategoryForAthlete` (based on age/gender). No national assignment is forced.
- The document-status service already supports `passport`; the relaxed mode swaps the "required document set" from CIN-centric to passport-centric.

### 4.2 ImportAthletes — Nationality-Aware Import

The CSV import accepts an optional `nationalityCode` column. Rows with a non-TUN `nationalityCode` are imported as foreign participants (same relaxed document/license rules as 4.1), enabling bulk onboarding of a foreign national-team roster before registration opens.

### 4.3 Why (b) Over Auto-Create

- **Single source of truth** for athletes — no parallel "phantom" records created mid-registration.
- **Reuses existing create/document/upload/import** surface.
- **Registration controller stays a pure selection + validation step** — no create branching, no race conditions, no partial records on validation failure.
- **Foreign athletes are reusable** across multiple competitions and seasons.

---

## 5. Eligibility Model (the heart of the change)

**Resolution function:**

```js
function resolveEligibilityMode(competition) {
  return (competition.scope?.type || "national") === "national" ? "national" : "international";
}
```

**Assignment lookup parameterised:**

```js
function findSeasonAssignment(athlete, season, type = "national") { ... }
```

Exact match on `type` + `season`, fallback to latest of same `type`. For international events, look for `international` first, fallback to `national` so a Tunisian with only a national assignment still resolves (strict checks still apply).

### 5.1 Per-Athlete Eligibility Matrix (single source of truth)

| Event scope | Athlete origin | Athlete record | Club membership | License | Category assignment | Documents |
|---|---|---|---|---|---|---|
| national | Tunisian | domestic | required | active required | national | CIN/photo/medical |
| international | Tunisian | domestic | required | active required | national **or** international | CIN/photo/medical (+passport if abroad) |
| international | Foreign | **created first (isForeign)** | **skipped** | **skipped** | international (auto at creation) | passport/photo/medical |
| international | Unattached individual (scn 2) | **created first (isForeign)** | skipped | skipped | international (auto at creation) | passport/photo/medical |

Every row assumes the athlete **already exists** in the DB (created via `CreateAthlete`/import). Registration only selects + validates.

### 5.2 Entry-Context Resolution

Extend `resolveClubContext` to a "representing context":

- `representingType: "club"` → existing behaviour (a TRF club).
- `representingType: "nation"` → the affiliated `Club.type:"country"` record (the national team), or a raw nation code for foreign teams.
- `representingType: "individual"` → no club; nation code carried on the entry.

### 5.3 Path to a Service (Phase 4)

Phase 1 implements the matrix as **inline branches** (low risk). Phase 4 extracts `backend/Services/eligibilityService.js` with a pure, unit-testable API:

```js
evaluateEntryEligibility({ competition, athlete, requestedCategory, representing }) -> { ok, reasons[] }
listEligibleAthletes({ competition, representing, category }) -> [Athlete]
```

---

## 6. Phased Delivery

### PHASE 1 — Foundation + Inbound (scenarios 1 & 2) — *the unblocker*

**Backend**

1. `Models/countryModel.js` + `Routes/countryRoutes.js` + `Controllers/countryController.js` (list public, CRUD admin).
2. `scripts/seedCountries.js`.
3. `competitionModel.js`: `scope` subdoc + exported constants + index.
4. `athleteModel.js`: foreign-identity fields incl. `isForeign` (§3.4).
5. `clubModel.js`: federation-identity fields (§3.3).
6. `competitionEntryModel.js`: representing fields (§3.5).
7. `competitionController.js`: parse/persist `scope`; validate (international ⇒ host country present; OaaS ⇒ `trfParticipates:false`); accept `scope` query filter in `listCompetitions`.
8. **`athleteController.createAthlete` (new behavior):** foreign mode — CIN optional, no license generation, require `nationalityCode` + passport, auto-build international assignment via `ensureInternationalCategoryForAthlete`. Domestic path unchanged. (The create-first half of decision (b).)
9. `competitionRegistrationController.js` (core): `resolveEligibilityMode`; parameterise `findSeasonAssignment`; branch `listEligibleAthletes` + `createCompetitionEntries` per the matrix — **selection only, no create**; skip membership/license for `isForeign` athletes; keep strict for Tunisians; extend `resolveClubContext` for representing context; serialize new fields.
10. `categoryAssignmentService.js`: `ensureInternationalCategoryForAthlete()` + `assignInternationalCategoriesForSeason()` + type-aware `buildFallbackAssignment(type)`.
11. `scripts/migrateCompetitionScope.mjs`: set `scope.type = "national"` on all existing competitions (auditable; effectively the default).

**Frontend**

12. `CompetitionManagement.jsx`: Scope selector (5 options) + participation mode + foreign eligibility + organiser/host federation + host country; update `submitCompetition` + `openEditDialog`; scope badge + flag on cards.
13. `CreateAthlete.jsx`: **Foreign participant mode** — toggle/auto-detect; relaxed fields (CIN hidden/optional, passport primary, `nationalityCode`/`representingNation`/`federationCode`/`fisaId`); no license UI for foreigners; international assignment preview. (The create-first UI for decision (b).)
14. `ImportAthletes.jsx`: optional `nationalityCode` column; foreign rows imported with relaxed rules.
15. `CompetitionRegistration.jsx`: "Compete as" (Nation/Club/Individual) for international scope; nation/federation dropdown; **athlete picker lists existing athletes only** (no inline create); relaxed messaging + flags; pass representing fields through.

**Exit criteria:**

1. Create a foreign athlete via `CreateAthlete` foreign mode (no CIN/license) → succeeds, international assignment auto-built.
2. Create `international_hosted` competition.
3. Register that foreign athlete as a nation entry → succeeds with no membership/license.
4. Register a Tunisian in the same event → still passes strict checks.
5. Existing national competitions behave identically.
6. `npm run build` passes; backend boots.

### PHASE 2 — Display + Nation Results (scenarios 1 & 2 polish)

16. `publicController.js` / `PublicHome.jsx` / `CompetitionDetail.jsx`: scope badge, host/participating flags, participating-nations strip.
17. `rankingPresets.js`: `NATION_MEDAL_TABLE`; `rankingService.js`: aggregate by `entries.representingNation`; flag column in serialization.
18. `CompetitionRankings.jsx` + public results: nation medal table with flags when `nationGrouping`.

### PHASE 3 — Outbound + OaaS (scenarios 3 & 4)

19. **Outbound:** `international_outbound` competitions → admin-only delegation entry (no public registration); delegation = typed `CompetitionEntry` rows, `representingType:"nation"` + `representingNation:"TUN"` (Tunisian athletes created normally; entered as a delegation).
20. **OaaS:** `hostFederation` drives a single `getBranding(competition)` helper (logo/name/footer); `trfParticipates:false` hides Tunisian-default UI. Foreign athletes still created first via `CreateAthlete` foreign mode.
21. PublicHome: "Tunisian Team Abroad" section; host-federation branding for OaaS.

### PHASE 4 — Eligibility Refactor + Admin Tooling

22. Extract `backend/Services/eligibilityService.js` (pure API); replace inline branches; unit-test every matrix cell.
23. Admin National-Team management UI (athletes linked to a country-typed club; season rosters).
24. Admin Countries CRUD page.

### PHASE 5 — Optional / Demand-Driven

25. **Public results API polish** — ensure `GET /api/public/competitions/:id/results` returns clean, structured, WR-consumable data (ISO nation codes, boat-class codes, athlete identities, times, ranks). This is the endpoint World Rowing or any federation would pull to collect results from TRF-organised events.
26. Federation self-service: `federation_delegate` role, invitations, onboarding flow.

> **Note:** FISA point tables, FISA event codes, and world-ranking accumulation are **not** TRF's responsibility. World Rowing (and other federations) will access TRF results via API and apply their own scoring systems. TRF-Portal is a **data producer**, not a ranking engine.

---

## 7. API Surface

**New**

- `GET    /api/countries`                    (public) — list active countries (code, names, flag)
- `GET    /api/countries/:code`               (public) — one country
- `POST   /api/countries`                    (admin) — create
- `PUT    /api/countries/:id`                (admin) — update
- `DELETE /api/countries/:id`                (admin) — delete

**Changed (additive, backward-compatible)**

- `GET /api/competitions`                                  → accepts `?scope=…`
- `POST / PUT /api/competitions[/:id]`                     → accepts `scope` object + new fields
- `POST /api/athletes`                                    → accepts `isForeign`/`nationalityCode`/`representingNation`/`federationCode`/`fisaId`; foreign mode relaxes CIN/license requirements
- `GET /api/athletes`                                     → filter by `nationalityCode`/`isForeign` (used by registration picker)
- `GET /api/competitions/:id/registration/eligible`       → international-eligible list respecting representing context (existing athletes only)
- `POST /api/competitions/:id/registration`               → accepts `representingType`/`representingNation`/`documentType`; **athlete must already exist**
- `GET /api/public/competitions` + `/results`             → scope + nations + flags + medal table

---

## 8. Frontend Surface

| File | Change |
|---|---|
| `CompetitionManagement.jsx` | Scope selector, participation mode, foreign eligibility, organiser/host federation, host country, scope badge + flag |
| `CreateAthlete.jsx` | **Foreign participant mode** (toggle/auto-detect): relaxed CIN/license, passport primary, foreign-identity fields, international assignment preview |
| `ImportAthletes.jsx` | Optional `nationalityCode` column; foreign rows relaxed |
| `CompetitionRegistration.jsx` | "Compete as" selector, nation/federation dropdown, **athlete picker (existing athletes only)**, relaxed messaging, flags, representing fields |
| `Clubs.jsx`, `ClubDetail.jsx` | Country selector, IOC/federation code, flag, country-type handling |
| `CompetitionDetail.jsx`, `PublicHome.jsx` | Scope badge, flags, participating nations, OaaS branding, outbound section |
| `CompetitionRankings.jsx` + public results | Nation medal table with flags |
| New `CountryManagement.jsx` (Phase 4) | Admin CRUD |

All new labels follow the existing EN/FR/AR localised pattern.

---

## 9. Database & Migration

All changes additive; no destructive change; no removed index.

- **`seedCountries.js`** — populate the `Country` collection.
- **`migrateCompetitionScope.mjs`** — set `scope.type = "national"` on every existing competition (auditable; effectively the default).
- **`backfillIsForeign.mjs`** *(optional, best-effort)* — set `isForeign = true` on existing athletes whose `nationality`/`nationalityCode` is non-Tunisian; leaves domestics untouched.
- **`backfillNationalityCode.mjs`** *(optional, best-effort)* — map existing free-text `nationality` → ISO alpha-3 where unambiguous; never overwrites; logs ambiguous cases.

**New indexes:**

- `competitionSchema.index({ "scope.type": 1, startDate: 1 })`
- `athleteSchema.index({ nationalityCode: 1 })`
- `athleteSchema.index({ isForeign: 1 })`
- `clubSchema.index({ country: 1 })`
- `competitionEntrySchema.index({ representingNation: 1 })`

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| National-path regression | `scope` defaults `national`; every branch gated; national code untouched; Phase-4 service is test-driven |
| Athlete with both national+international assignment per season | Single array filtered by `type`; resolved by scope; never duplicated |
| Free-text nationality quality | New indexed `nationalityCode`; free-text preserved; backfill best-effort |
| OaaS branding leakage | Single `getBranding(competition)` gates every "TRF" string |
| Eligibility logic complexity | §5.1 matrix is the single source of truth; Phase 1 inline, Phase 4 extracted + unit-tested |
| Admin scope confusion | Scope badge + per-scope help text; OaaS forces `trfParticipates:false` |
| **Foreign athlete not yet created at registration time** | **Decision (b) enforced:** registration picker lists only existing athletes; if the foreigner is missing, admin is sent to `CreateAthlete` (foreign mode) first. No create-on-entry, no partial/orphan records. UI surfaces a clear "Create foreign athlete" shortcut when the picker is empty. |
| Foreign athlete reused across events/seasons | Intended behavior — single record, multiple entries; `isForeign` + `nationalityCode` are stable identity, not per-event |

---

## 11. Explicitly Deferred

- Federation self-service portal + `federation_delegate`/`federation_admin` roles.
- Public self-registration + payment for Masters individuals.
- **On-the-fly athlete creation during registration** (decision (b) rejects this).
- FISA point tables, FISA event codes, and world-ranking accumulation — **out of scope** (TRF is a data source; external federations like World Rowing consume results via API and calculate their own rankings).
- `ENABLE_INTERNATIONAL_SUPPORT` feature flag — **rejected** (the `national` default already gates everything).

---

## 12. Execution Order

1. **Phase 1** (foundation + inbound) — unblocks scenarios 1 & 2. Build order: `Country` model → `scope` field → athlete foreign fields + **CreateAthlete foreign mode** → registration branching (selection-only).
2. **Phase 2** (nation medal table) — high visibility, small effort.
3. **Phase 3** (outbound + OaaS) — completes 4-scenario coverage.
4. **Phase 4** (eligibility service + admin tooling) — pays down Phase-1 branch debt.
5. **Phase 5** (public results API polish / federation self-service) — only when a concrete event or federation demands it.

---

## 13. Phase 1 File Manifest (for implementation day)

**Backend — new**

- `backend/Models/countryModel.js`
- `backend/Controllers/countryController.js`
- `backend/Routes/countryRoutes.js`
- `backend/scripts/seedCountries.js`
- `backend/scripts/migrateCompetitionScope.mjs`

**Backend — modified**

- `backend/Models/competitionModel.js`
- `backend/Models/athleteModel.js`
- `backend/Models/clubModel.js`
- `backend/Models/competitionEntryModel.js`
- `backend/Models/rankingSystemModel.js`
- `backend/Controllers/competitionController.js`
- `backend/Controllers/athleteController.js` (createAthlete foreign mode)
- `backend/Controllers/competitionRegistrationController.js` (core)
- `backend/Services/categoryAssignmentService.js`
- `backend/server.js`

**Frontend — modified**

- `frontend/src/pages/CompetitionManagement.jsx`
- `frontend/src/pages/CreateAthlete.jsx` (foreign mode)
- `frontend/src/pages/ImportAthletes.jsx`
- `frontend/src/pages/CompetitionRegistration.jsx`
- `frontend/src/pages/Clubs.jsx` (light)
- `frontend/src/pages/ClubDetail.jsx` (light)
- `frontend/src/pages/CompetitionDetail.jsx` (light)
- `frontend/src/pages/PublicHome.jsx` (light)
