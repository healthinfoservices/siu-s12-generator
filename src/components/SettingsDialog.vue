<script setup>
import { ref, watch } from 'vue'
import { DEFAULT_SETTINGS } from '../lib/settings.js'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({ settings: { type: Object, required: true } })
const emit = defineEmits(['save'])

const draft = ref({ ...props.settings })
watch(open, (v) => {
  if (v) draft.value = { ...props.settings }
})

const offsetRule = (v) => /^[+-]\d{4}$/.test(v) || 'Use the form +1000'

function save() {
  emit('save', { ...draft.value })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card title="Settings">
      <v-card-text>
        <div class="text-subtitle-2 mb-2">FHIR server</div>
        <v-text-field v-model="draft.fhirBaseUrl" label="FHIR base URL"
          hint="Patient, Practitioner and Organization are searched here" persistent-hint class="mb-4" />

        <div class="text-subtitle-2 mb-2">Message header (MSH)</div>
        <v-row dense>
          <v-col cols="12" sm="6"><v-text-field v-model="draft.sendingApplication" label="MSH-3 Sending application" /></v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="draft.sendingFacility" label="MSH-4 Sending facility"
              hint="Leave blank to use the selected Organization's facility code" persistent-hint />
          </v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="draft.receivingApplication" label="MSH-5 Receiving application" /></v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="draft.receivingFacility" label="MSH-6 Receiving facility" /></v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="draft.processingId" label="MSH-11 Processing ID"
              :items="[{ title: 'P – Production', value: 'P' }, { title: 'T – Training', value: 'T' }, { title: 'D – Debugging', value: 'D' }]" />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="draft.utcOffset" label="UTC offset for timestamps" :rules="[offsetRule]"
              hint="Brisbane is +1000 all year" persistent-hint />
          </v-col>
        </v-row>

        <div class="text-subtitle-2 mt-4 mb-2">Appointment</div>
        <v-text-field v-model="draft.fillerNamespace" label="SCH-2.2 Filler namespace"
          hint="The adapter's identifier system becomes …/appointment/filler/<namespace>" persistent-hint />

        <div class="text-subtitle-2 mt-4 mb-2">Adapter identifier systems (must match the adapter's configuration)</div>
        <v-text-field v-model="draft.organizationIdSystem" label="Organization facility code system (ORGANIZATION_ID_SYSTEM)" />
        <v-text-field v-model="draft.identifierSystemBase" label="Identifier system base (IDENTIFIER_SYSTEM_BASE)" />
        <v-text-field v-model="draft.mrnSystemBase" label="MRN system base (MRN_SYSTEM_BASE)" />
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="draft = { ...DEFAULT_SETTINGS }">Reset to defaults</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
