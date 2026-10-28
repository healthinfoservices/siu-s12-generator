<script setup>
import { computed, reactive, ref } from 'vue'
import ResourcePicker from './components/ResourcePicker.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { loadSettings, saveSettings } from './lib/settings.js'
import { buildS12 } from './lib/siu.js'
import { formatDtm, newFillerId, offsetMinutes } from './lib/hl7.js'
import { APPOINTMENT_REASONS, LOCATION_TYPES, PRACTITIONER_ROLES, SERVICES } from './lib/codes.js'
import {
  humanName, organizationSubtitle, organizationTitle, patientSubtitle, practitionerSubtitle,
} from './lib/display.js'

const settings = ref(loadSettings())
const settingsOpen = ref(false)
function onSaveSettings(s) {
  settings.value = s
  saveSettings(s)
}

const resources = reactive({ patient: null, organization: null, practitioner: null })

/** Tomorrow 09:00 in the configured offset, as a datetime-local value. */
function defaultStart() {
  const dtm = formatDtm(Date.now() + 86400000, settings.value.utcOffset)
  return `${dtm.slice(0, 4)}-${dtm.slice(4, 6)}-${dtm.slice(6, 8)}T09:00`
}

const blankForm = () => ({
  fillerId: '',
  start: defaultStart(),
  duration: 30,
  reason: null,
  service: null,
  pointOfCare: '',
  room: '',
  bed: '',
  locationDescription: '',
  locationType: null,
  role: PRACTITIONER_ROLES[0],
})
const form = reactive(blankForm())

function generateFillerId() {
  form.fillerId = newFillerId(settings.value.utcOffset)
}

const codeTitle = (c) => (typeof c === 'string' ? c : c ? `${c.code} — ${c.display}` : '')
const codedHint = 'Pick from the list, or type CODE or CODE^Display'

// Live check of the inputs (timestamps here are placeholders; Generate stamps the real ones).
const check = computed(() => buildS12(form, resources, settings.value, { now: 0, controlId: 'X' }))

const inputsKey = computed(() =>
  JSON.stringify({
    form,
    ids: [resources.patient?.id, resources.organization?.id, resources.practitioner?.id],
    settings: settings.value,
  }),
)

const generated = ref(null) // { message, controlId, key, warnings }
const stale = computed(() => generated.value && generated.value.key !== inputsKey.value)
const copied = ref(false)

function generate() {
  const r = buildS12(form, resources, settings.value, { now: Date.now() })
  if (!r.message) return
  const controlId = r.segments[0].split('|')[9]
  generated.value = { message: r.message, controlId, key: inputsKey.value, warnings: r.warnings }
  copied.value = false
}

const fileName = computed(() => `SIU_S12_${generated.value?.controlId}.hl7`)

function download() {
  const blob = new Blob([generated.value.message], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.value
  a.click()
  URL.revokeObjectURL(url)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(generated.value.message)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}

function newBooking() {
  Object.assign(form, blankForm(), {
    // keep location and role: usually the same across a test run
    pointOfCare: form.pointOfCare, room: form.room, bed: form.bed,
    locationDescription: form.locationDescription, locationType: form.locationType, role: form.role,
  })
  generated.value = null
}

const offsetLabel = computed(() => {
  try {
    const m = offsetMinutes(settings.value.utcOffset)
    return `UTC${m >= 0 ? '+' : '−'}${Math.floor(Math.abs(m) / 60)}${Math.abs(m) % 60 ? ':' + String(Math.abs(m) % 60).padStart(2, '0') : ''}`
  } catch {
    return settings.value.utcOffset
  }
})
</script>

<template>
  <v-app>
    <v-app-bar flat border="b" density="comfortable">
      <v-app-bar-title>SIU^S12 booking generator</v-app-bar-title>
      <template #append>
        <v-chip size="small" variant="tonal" class="mr-2 d-none d-sm-flex">{{ settings.fhirBaseUrl }}</v-chip>
        <v-btn icon="mdi-cog-outline" title="Settings" @click="settingsOpen = true" />
      </template>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <v-container fluid class="pa-4" style="max-width: 1500px">
        <v-row>
          <!-- form -->
          <v-col cols="12" lg="6">
            <v-card class="mb-4" title="Who" subtitle="Searched on the FHIR server">
              <v-card-text class="d-flex flex-column ga-4">
                <ResourcePicker v-model="resources.patient" label="Patient *" resource-type="Patient"
                  :base-url="settings.fhirBaseUrl" :title="humanName" :subtitle="patientSubtitle"
                  hint="PID is filled from this Patient" />
                <ResourcePicker v-model="resources.organization" label="Organization (facility) *"
                  resource-type="Organization" :base-url="settings.fhirBaseUrl" :title="organizationTitle"
                  :subtitle="(o) => organizationSubtitle(o, settings)"
                  hint="Its facility code identifier goes in AIL-3.4" />
                <ResourcePicker v-model="resources.practitioner" label="Practitioner *"
                  resource-type="Practitioner" :base-url="settings.fhirBaseUrl" :title="humanName"
                  :subtitle="practitionerSubtitle" hint="AIP-3: HPI-I if present, else Medicare provider number" />
              </v-card-text>
            </v-card>

            <v-card class="mb-4" title="Appointment">
              <v-card-text>
                <v-row dense>
                  <v-col cols="12">
                    <v-text-field v-model.trim="form.fillerId" label="SCH-2 Filler appointment ID *"
                      :suffix="'^' + settings.fillerNamespace"
                      hint="The adapter's match key. Reuse an ID only to replay a booking." persistent-hint>
                      <template #append>
                        <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="generateFillerId">Generate</v-btn>
                      </template>
                    </v-text-field>
                  </v-col>
                  <v-col cols="12" sm="7">
                    <v-text-field v-model="form.start" type="datetime-local" label="Start *"
                      :hint="`Local time, written with offset ${settings.utcOffset} (${offsetLabel})`" persistent-hint />
                  </v-col>
                  <v-col cols="12" sm="5">
                    <v-text-field v-model.number="form.duration" type="number" min="1" step="1"
                      label="Duration *" suffix="min" />
                  </v-col>
                  <v-col cols="12">
                    <v-combobox v-model="form.reason" :items="APPOINTMENT_REASONS" :item-title="codeTitle" item-value="code"
                      label="SCH-7 Appointment reason" clearable :hint="codedHint" persistent-hint />
                  </v-col>
                  <v-col cols="12">
                    <v-combobox v-model="form.service" :items="SERVICES" :item-title="codeTitle" item-value="code"
                      label="AIS-3 Service" clearable :hint="codedHint" persistent-hint />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <v-card class="mb-4" title="Location" subtitle="AIL-3; the facility comes from the Organization">
              <v-card-text>
                <v-row dense>
                  <v-col cols="12" sm="4"><v-text-field v-model.trim="form.pointOfCare" label="AIL-3.1 Point of care" /></v-col>
                  <v-col cols="12" sm="4"><v-text-field v-model.trim="form.room" label="AIL-3.2 Room" /></v-col>
                  <v-col cols="12" sm="4"><v-text-field v-model.trim="form.bed" label="AIL-3.3 Bed" /></v-col>
                  <v-col cols="12"><v-text-field v-model.trim="form.locationDescription" label="AIL-3.9 Location description" /></v-col>
                  <v-col cols="12">
                    <v-combobox v-model="form.locationType" :items="LOCATION_TYPES" :item-title="codeTitle" item-value="code"
                      label="AIL-4 Location type" clearable :hint="codedHint" persistent-hint />
                  </v-col>
                </v-row>
                <div class="text-caption text-medium-emphasis mt-2">
                  Each different combination of facility, point of care, room and bed creates a separate Location
                  on the server.
                </div>
              </v-card-text>
            </v-card>

            <v-card class="mb-4" title="Practitioner role">
              <v-card-text>
                <v-select v-model="form.role" :items="PRACTITIONER_ROLES" :item-title="codeTitle" item-value="code" return-object
                  label="AIP-4 Role" />
              </v-card-text>
            </v-card>
          </v-col>

          <!-- output -->
          <v-col cols="12" lg="6">
            <div class="output">
              <v-card title="Message">
                <v-card-text>
                  <v-alert v-if="check.errors.length" type="info" variant="tonal" density="compact" class="mb-3"
                    title="Still needed">
                    <ul class="pl-4"><li v-for="e in check.errors" :key="e">{{ e }}</li></ul>
                  </v-alert>
                  <v-alert v-if="check.warnings.length" type="warning" variant="tonal" density="compact" class="mb-3"
                    title="Check before sending">
                    <ul class="pl-4"><li v-for="w in check.warnings" :key="w">{{ w }}</li></ul>
                  </v-alert>

                  <div class="d-flex flex-wrap ga-2 mb-3">
                    <v-btn color="primary" variant="flat" prepend-icon="mdi-file-cog-outline"
                      :disabled="check.errors.length > 0" @click="generate">Generate message</v-btn>
                    <v-btn :disabled="!generated" prepend-icon="mdi-download" variant="tonal" @click="download">
                      Download .hl7
                    </v-btn>
                    <v-btn :disabled="!generated" :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'"
                      variant="tonal" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</v-btn>
                    <v-spacer />
                    <v-btn variant="text" prepend-icon="mdi-plus" @click="newBooking">New booking</v-btn>
                  </div>

                  <v-alert v-if="stale" type="info" variant="outlined" density="compact" class="mb-3">
                    The form has changed since this message was generated. Generate again to include the changes.
                  </v-alert>

                  <template v-if="generated">
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ fileName }} · one segment per line here; the file uses CR segment terminators
                    </div>
                    <pre class="hl7">{{ generated.message.split('\r').join('\n') }}</pre>
                  </template>
                  <div v-else class="text-body-2 text-medium-emphasis">
                    Fill in the form and choose Generate. MSH-7 and MSH-10 are stamped when you generate.
                  </div>
                </v-card-text>
              </v-card>

              <v-card class="mt-4" variant="tonal" density="compact">
                <v-card-text class="text-body-2">
                  Send with Postman: <code>POST http://&lt;adapter host&gt;:8090/hl7</code>, Body → raw → Text, paste
                  or load the file. The reference adapter answers 200 for AA and 422 for AE/AR, with the ACK in
                  the JSON response.
                </v-card-text>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <SettingsDialog v-model:open="settingsOpen" :settings="settings" @save="onSaveSettings" />
  </v-app>
</template>

<style scoped>
.output {
  position: sticky;
  top: 80px;
}
.hl7 {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 60vh;
  overflow: auto;
}
</style>
