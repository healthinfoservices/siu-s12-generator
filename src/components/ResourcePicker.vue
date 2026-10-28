<script setup>
import { ref, watch } from 'vue'
import { searchResources } from '../lib/fhirClient.js'

const props = defineProps({
  label: { type: String, required: true },
  resourceType: { type: String, required: true },
  baseUrl: { type: String, required: true },
  title: { type: Function, required: true },
  subtitle: { type: Function, required: true },
  hint: { type: String, default: '' },
})
const model = defineModel({ type: Object, default: null })

const items = ref([])
const loading = ref(false)
const error = ref('')
let timer = null
let seq = 0

function onSearch(term) {
  clearTimeout(timer)
  // Typing into the box after a pick fires a search with the picked title; skip that.
  if (!term || (model.value && term === props.title(model.value))) return
  timer = setTimeout(() => run(term), 350)
}

async function run(term) {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const found = await searchResources(props.baseUrl, props.resourceType, term)
    if (mine === seq) items.value = found
  } catch (e) {
    if (mine === seq) {
      items.value = []
      error.value = e.message
    }
  } finally {
    if (mine === seq) loading.value = false
  }
}

// Keep the picked resource in the list so the field can show it.
watch(model, (v) => {
  if (v && !items.value.some((i) => i.id === v.id)) items.value = [v, ...items.value]
})
</script>

<template>
  <v-autocomplete
    v-model="model"
    :items="items"
    :item-title="title"
    item-value="id"
    :label="label"
    :loading="loading"
    :error-messages="error"
    :hint="hint"
    persistent-hint
    no-filter
    return-object
    clearable
    prepend-inner-icon="mdi-magnify"
    :no-data-text="loading ? 'Searching…' : 'Type a name or identifier to search'"
    @update:search="onSearch"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="subtitle(item.raw)" />
    </template>
  </v-autocomplete>
</template>
