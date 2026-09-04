import { computed, onUnmounted, ref, watch } from 'vue'
import { TEN_PLUS_TOUR_STEPS } from '../constants/tenPlusManual'
import type { TenPlusTourHole, TenPlusTourPlacement, TenPlusTourStep } from '../types/tenPlusManual'

const HOLE_PAD = 8
const CARD_W = 300
const CARD_H = 210
const GAP = 28
const VIEW_PAD = 12

function queryTourEl(target: string): HTMLElement | null {
  return document.querySelector(`[data-tour="${target}"]`)
}

function holeOf(el: HTMLElement): TenPlusTourHole {
  const r = el.getBoundingClientRect()
  return {
    left: Math.round(r.left - HOLE_PAD),
    top: Math.round(r.top - HOLE_PAD),
    width: Math.round(r.width + HOLE_PAD * 2),
    height: Math.round(r.height + HOLE_PAD * 2)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function placeCard(
  hole: TenPlusTourHole,
  preferred: TenPlusTourPlacement
): { left: number; top: number; placement: TenPlusTourPlacement } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxLeft = vw - CARD_W - VIEW_PAD
  const maxTop = vh - CARD_H - VIEW_PAD

  const candidates: Record<TenPlusTourPlacement, { left: number; top: number }> = {
    right: {
      left: hole.left + hole.width + GAP,
      top: hole.top + hole.height / 2 - CARD_H / 2
    },
    left: {
      left: hole.left - GAP - CARD_W,
      top: hole.top + hole.height / 2 - CARD_H / 2
    },
    bottom: {
      left: hole.left + hole.width / 2 - CARD_W / 2,
      top: hole.top + hole.height + GAP
    },
    top: {
      left: hole.left + hole.width / 2 - CARD_W / 2,
      top: hole.top - GAP - CARD_H
    }
  }

  const order: TenPlusTourPlacement[] = [
    preferred,
    ...(['right', 'left', 'bottom', 'top'] as const).filter((p) => p !== preferred)
  ]

  let placement = preferred
  let pos = candidates[preferred]
  for (const p of order) {
    const c = candidates[p]
    const fitsX = c.left >= VIEW_PAD && c.left <= maxLeft
    const fitsY = c.top >= VIEW_PAD && c.top <= maxTop
    if (fitsX && fitsY) {
      placement = p
      pos = c
      break
    }
  }

  return {
    left: clamp(pos.left, VIEW_PAD, Math.max(VIEW_PAD, maxLeft)),
    top: clamp(pos.top, VIEW_PAD, Math.max(VIEW_PAD, maxTop)),
    placement
  }
}

function arrowGeometry(
  hole: TenPlusTourHole,
  card: { left: number; top: number },
  placement: TenPlusTourPlacement
): { x1: number; y1: number; x2: number; y2: number } {
  const holeCx = hole.left + hole.width / 2
  const holeCy = hole.top + hole.height / 2
  const cardCx = card.left + CARD_W / 2
  const cardCy = card.top + CARD_H / 2
  if (placement === 'right') {
    return { x1: card.left, y1: cardCy, x2: hole.left + hole.width, y2: holeCy }
  }
  if (placement === 'left') {
    return { x1: card.left + CARD_W, y1: cardCy, x2: hole.left, y2: holeCy }
  }
  if (placement === 'bottom') {
    return { x1: cardCx, y1: card.top, x2: holeCx, y2: hole.top + hole.height }
  }
  return { x1: cardCx, y1: card.top + CARD_H, x2: holeCx, y2: hole.top }
}

export function useTenPlusTour() {
  const active = ref(false)
  const index = ref(0)
  const hole = ref<TenPlusTourHole | null>(null)
  const cardLeft = ref(VIEW_PAD)
  const cardTop = ref(VIEW_PAD)
  const placement = ref<TenPlusTourPlacement>('right')
  const missing = ref(false)

  const step = computed((): TenPlusTourStep | null =>
    active.value ? (TEN_PLUS_TOUR_STEPS[index.value] ?? null) : null
  )
  const total = TEN_PLUS_TOUR_STEPS.length
  const isFirst = computed(() => index.value <= 0)
  const isLast = computed(() => index.value >= total - 1)

  const arrow = computed(() => {
    if (!hole.value || !step.value) return null
    return arrowGeometry(hole.value, { left: cardLeft.value, top: cardTop.value }, placement.value)
  })

  function applyHole(el: HTMLElement, preferred: TenPlusTourPlacement): void {
    missing.value = false
    const nextHole = holeOf(el)
    hole.value = nextHole
    const placed = placeCard(nextHole, preferred)
    cardLeft.value = Math.round(placed.left)
    cardTop.value = Math.round(placed.top)
    placement.value = placed.placement
  }

  function measure(): void {
    const current = TEN_PLUS_TOUR_STEPS[index.value]
    if (!current) {
      hole.value = null
      return
    }
    const el = queryTourEl(current.target)
    if (!el) {
      hole.value = null
      missing.value = true
      cardLeft.value = Math.round((window.innerWidth - CARD_W) / 2)
      cardTop.value = Math.round((window.innerHeight - CARD_H) / 2)
      return
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    applyHole(el, current.placement)
    requestAnimationFrame(() => {
      if (!active.value) return
      const afterScroll = queryTourEl(current.target)
      if (afterScroll) applyHole(afterScroll, current.placement)
    })
  }

  function start(): void {
    index.value = 0
    active.value = true
    requestAnimationFrame(() => measure())
  }

  function stop(): void {
    active.value = false
    hole.value = null
  }

  function next(): void {
    if (isLast.value) {
      stop()
      return
    }
    index.value += 1
  }

  function prev(): void {
    if (isFirst.value) return
    index.value -= 1
  }

  watch(index, () => {
    if (active.value) requestAnimationFrame(() => measure())
  })

  function onWinChange(): void {
    if (active.value) measure()
  }

  window.addEventListener('resize', onWinChange)
  window.addEventListener('scroll', onWinChange, true)

  onUnmounted(() => {
    window.removeEventListener('resize', onWinChange)
    window.removeEventListener('scroll', onWinChange, true)
  })

  return {
    active,
    index,
    step,
    total,
    isFirst,
    isLast,
    hole,
    cardLeft,
    cardTop,
    arrow,
    missing,
    cardWidth: CARD_W,
    start,
    stop,
    next,
    prev
  }
}
