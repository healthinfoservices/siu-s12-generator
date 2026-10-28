# SIU^S12 booking generator

A Vue 3 + Vuetify 3 app that builds HL7 v2.5 **SIU^S12** (new booking) messages for testing the
`siu-fhir-au-core` adapter (Track 2B). Pick a Patient, Organization and Practitioner from a FHIR
server, fill in the appointment, then download or copy the `.hl7` file and POST it to the adapter.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
npm test           # message-builder tests (Node 18+, no extra packages)
```

The FHIR searches run in the browser, so the FHIR server must allow cross-origin (CORS) requests
from wherever the app is served.

## Sending a message

`POST http://<adapter host>:8090/hl7` with the message as the raw body (Postman: Body → raw → Text).
That is the reference adapter's HTTP input (`siu2fhir_au/servers.py`); it answers 200 for `AA`
and 422 for `AE`/`AR`, with the ACK in the JSON response. HTTP input is optional in the Track 2B
spec, so other adapters may only accept MLLP.

## What goes where

| Message field | Source |
|---|---|
| MSH-3/5/6/11 | Settings (defaults `PAS`, `SIU2FHIR`, `POC`, `P`) |
| MSH-4 | Settings, or the Organization's facility code when blank |
| MSH-7, MSH-10 | Stamped when you choose **Generate** |
| SCH-2 | Form (**Generate** button) `^` Settings namespace (default `SCHED`) |
| SCH-7 | Form, optional |
| SCH-9, SCH-10, SCH-11.4/.5 | Form: start + duration in minutes; end is computed |
| SCH-25 | Always `Booked` |
| PID | The Patient, reverse-mapped to what the adapter expects |
| AIS-3 | Form, optional (AIS is left out when empty) |
| AIL-3.4 | The Organization's `http://example.org/fhir/sid/organization` identifier |
| AIL-3.1/.2/.3/.9, AIL-4 | Form, optional |
| AIP-3 | The Practitioner: HPI-I, else Medicare provider number, else an adapter-style local ID |
| AIP-4 | Form (default `ATND`) |

SCH-1, SCH-8, NTE, PV1 and TQ1 are not sent.

## Things to know

- **The adapter rebuilds Patient and Practitioner from each message.** Anything the message can't
  carry (identifiers with other systems, a practitioner's second identifier, extra name parts) is
  removed from the server copy when the message is processed. The app warns when this applies.
- **Patient identifiers** map back to PID-3 only for the systems the adapter writes: IHI, Medicare,
  MRN (`{MRN_SYSTEM_BASE}/{authority}`) and local (`{IDENTIFIER_SYSTEM_BASE}/patient/{authority}/{type}`).
  Others are left out with a warning. DVA numbers are left out too, because the adapter stores them
  under a different system.
- **The Organization must carry the facility-code identifier**; otherwise the app refuses to generate,
  since the adapter would not find it.
- **Each new AIL-3 combination creates a new Location** on the server, so typos create extra Locations.

## Checked

- The message builder was run against the reference adapter's own code (its HTTP-free processor
  with its test FHIR stand-in): the generated messages were accepted (`AA`), created no duplicate
  Patient or Practitioner, left the Patient unchanged, and produced the expected Appointment times.
  The Node tests in `test/` cover the same layout.

## Not checked

- `npm install` and `npm run build` were not run when this was written (no package registry access),
  so the Vue components have not been compiled or opened in a browser. Package versions in
  `package.json` are from memory; adjust if npm reports a problem.
- The HL7 table 0276 codes in `src/lib/codes.js` are from memory; check them against
  <https://hl7.org/fhir/R4/v2/0276/index.html>.
- The default FHIR base URL is the reference adapter's default (`config.py`). Change it in Settings.
