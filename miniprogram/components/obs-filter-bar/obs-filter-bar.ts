import type { FilterOption, TimeFilterOption } from '../../utils/observation-filter'

Component({
  properties: {
    speciesOptions: {
      type: Array,
      value: [] as FilterOption[],
    },
    locationOptions: {
      type: Array,
      value: [] as FilterOption[],
    },
    timeOptions: {
      type: Array,
      value: [] as TimeFilterOption[],
    },
    speciesIndex: {
      type: Number,
      value: 0,
    },
    locationIndex: {
      type: Number,
      value: 0,
    },
    timeIndex: {
      type: Number,
      value: 0,
    },
    showReset: {
      type: Boolean,
      value: false,
    },
    featuredOnly: {
      type: Boolean,
      value: false,
    },
    enableSearch: {
      type: Boolean,
      value: false,
    },
    showSearch: {
      type: Boolean,
      value: false,
    },
    searchInput: {
      type: String,
      value: '',
    },
  },

  methods: {
    onSpeciesChange(e: WechatMiniprogram.PickerChange) {
      this.triggerEvent('change', {
        type: 'species',
        index: Number(e.detail.value),
      })
    },

    onLocationChange(e: WechatMiniprogram.PickerChange) {
      this.triggerEvent('change', {
        type: 'location',
        index: Number(e.detail.value),
      })
    },

    onTimeChange(e: WechatMiniprogram.PickerChange) {
      this.triggerEvent('change', {
        type: 'time',
        index: Number(e.detail.value),
      })
    },

    onFeaturedToggle() {
      this.triggerEvent('change', { type: 'featured' })
    },

    onReset() {
      this.triggerEvent('reset')
    },

    onSearchToggle() {
      this.triggerEvent('searchtoggle')
    },

    onSearchInput(e: WechatMiniprogram.Input) {
      this.triggerEvent('searchinput', { value: e.detail.value })
    },

    onSearchConfirm() {
      this.triggerEvent('search', { keyword: this.data.searchInput.trim() })
    },

    onSearchClear() {
      this.triggerEvent('searchclear')
    },
  },
})
