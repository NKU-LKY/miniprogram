interface GuideRect {
  top: number
  left: number
  width: number
  height: number
}

interface GuideMasks {
  top: number
  bottomTop: number
  bottomHeight: number
  leftTop: number
  leftWidth: number
  leftHeight: number
  rightTop: number
  rightLeft: number
  rightWidth: number
  rightHeight: number
}

const TOOLTIP_HEIGHT = 180
const TOOLTIP_GAP = 16
const TOOLTIP_WIDTH = 280

function buildMasks(rect: GuideRect, screenW: number, screenH: number): GuideMasks {
  const holeTop = Math.max(rect.top, 0)
  const holeLeft = Math.max(rect.left, 0)
  const holeBottom = Math.min(rect.top + rect.height, screenH)
  const holeRight = Math.min(rect.left + rect.width, screenW)
  const holeHeight = Math.max(holeBottom - holeTop, 0)
  const holeWidth = Math.max(holeRight - holeLeft, 0)

  return {
    top: holeTop,
    bottomTop: holeBottom,
    bottomHeight: Math.max(screenH - holeBottom, 0),
    leftTop: holeTop,
    leftWidth: holeLeft,
    leftHeight: holeHeight,
    rightTop: holeTop,
    rightLeft: holeRight,
    rightWidth: Math.max(screenW - holeRight, 0),
    rightHeight: holeHeight,
  }
}

function buildTooltipPosition(rect: GuideRect, screenW: number, screenH: number) {
  let tooltipTop = rect.top + rect.height + TOOLTIP_GAP
  if (tooltipTop + TOOLTIP_HEIGHT > screenH - 20) {
    tooltipTop = rect.top - TOOLTIP_HEIGHT - TOOLTIP_GAP
  }
  if (tooltipTop < 20) {
    tooltipTop = rect.top + rect.height + TOOLTIP_GAP
  }

  const maxLeft = screenW - TOOLTIP_WIDTH - 16
  const tooltipLeft = Math.max(16, Math.min(rect.left, maxLeft))

  return { tooltipTop, tooltipLeft }
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    rect: {
      type: Object,
      value: { top: 0, left: 0, width: 0, height: 0 },
    },
    title: {
      type: String,
      value: '',
    },
    desc: {
      type: String,
      value: '',
    },
    currentStep: {
      type: Number,
      value: 1,
    },
    totalSteps: {
      type: Number,
      value: 1,
    },
    isLast: {
      type: Boolean,
      value: false,
    },
    radius: {
      type: Number,
      value: 12,
    },
  },

  data: {
    masks: {
      top: 0,
      bottomTop: 0,
      bottomHeight: 0,
      leftTop: 0,
      leftWidth: 0,
      leftHeight: 0,
      rightTop: 0,
      rightLeft: 0,
      rightWidth: 0,
      rightHeight: 0,
    } as GuideMasks,
    tooltipTop: 0,
    tooltipLeft: 16,
  },

  observers: {
    'visible, rect.**': function () {
      this.updateLayout()
    },
  },

  methods: {
    updateLayout() {
      if (!this.properties.visible) return

      const rect = this.properties.rect as GuideRect
      if (!rect || !rect.width || !rect.height) return

      const { windowWidth, windowHeight } = wx.getSystemInfoSync()
      const masks = buildMasks(rect, windowWidth, windowHeight)
      const { tooltipTop, tooltipLeft } = buildTooltipPosition(rect, windowWidth, windowHeight)

      this.setData({ masks, tooltipTop, tooltipLeft })
    },

    onNext() {
      this.triggerEvent('next')
    },

    onSkip() {
      this.triggerEvent('skip')
    },

    preventMove() {},

    preventTap() {},
  },
})
