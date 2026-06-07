import type { FilterOption, TimeFilterOption } from '../../utils/observation-filter'

Component({
  properties: {
    speciesOptions: {
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
  },

  methods: {
    onSpeciesChange(e: WechatMiniprogram.PickerChange) {
      this.triggerEvent('change', {
        type: 'species',
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
  },
})
