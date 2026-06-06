import type { ObservationFeedItem } from '../../types/observation'

Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
  },

  data: {
    card: null as ObservationFeedItem | null,
  },

  observers: {
    item(val: ObservationFeedItem) {
      if (val && val.obs_id) {
        this.setData({ card: val })
      }
    },
  },

  lifetimes: {
    attached() {
      const item = this.properties.item as ObservationFeedItem
      if (item && item.obs_id) {
        this.setData({ card: item })
      }
    },
  },

  methods: {
    onTap() {
      const card = this.data.card
      if (card) {
        this.triggerEvent('tap', { obsId: card.obs_id })
      }
    },
  },
})
