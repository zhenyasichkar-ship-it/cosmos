import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import Lenis from 'lenis'
import { ArrowRight, ChevronDown } from 'lucide-react'

/**
 * scrub.mp4 = clip 1 + clip 2, every frame is a keyframe.
 * Both source clips are exactly 8.000 s @ 24 fps, so the helmet
 * close-up (end of clip 1) sits at 8.0 s and the full video runs 16.0 s.
 */
const CLIP1_END = 8.0
const FALLBACK_DURATION = 16.0

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** Maps pinned-section progress (0..1) to a video timestamp. */
function progressToTime(p: number, duration: number) {
  if (p <= 0.01) return 0
  if (p < 0.4) return ((p - 0.01) / 0.39) * CLIP1_END
  if (p < 0.63) return CLIP1_END
  if (p < 0.92) return CLIP1_END + ((p - 0.63) / 0.29) * (duration - CLIP1_END)
  return duration
}

/**
 * Scroll-mapped reveal: fully driven by progress, hence reversible.
 * Returns inline styles for one element.
 */
function rev(
  hp: number,
  start: number,
  span = 0.18,
  dy = 24,
  blur = 8,
): CSSProperties {
  const e = easeOut(clamp01((hp - start) / span))
  return {
    opacity: e,
    transform: `translateY(${dy * (1 - e)}px)`,
    filter: `blur(${blur * (1 - e)}px)`,
  }
}

/** Focus-pull variant for headlines: deeper offset, heavier blur. */
const revB = (hp: number, start: number, span = 0.18) =>
  rev(hp, start, span, 28, 14)

function Words({
  text,
  hp,
  start,
  step = 0.08,
  span,
  dy,
  blur,
  accent = [],
}: {
  text: string
  hp: number
  start: number
  step?: number
  span?: number
  dy?: number
  blur?: number
  /** word indexes rendered in Playfair italic */
  accent?: number[]
}) {
  const words = text.split(' ')
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            className={
              accent.includes(i) ? 'inline-block font-display italic' : 'inline-block'
            }
            style={rev(hp, start + i * step, span, dy, blur)}
          >
            {w}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  )
}

const EASE_REVEAL = '[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'

const blockVisibility = (visible: boolean) =>
  `transition-all duration-700 ${EASE_REVEAL} ${
    visible
      ? 'opacity-100 blur-0 translate-y-0'
      : 'opacity-0 blur-[6px] -translate-y-10'
  }`

const COPY = {
  heroLead:
    'Helion charts the silence between worlds — one impossible journey at a time.',
  heroRight:
    'Welcome to a world of discovery and boundless horizons. Our mission is to take you where maps end.',
  sawItFirst:
    'Halfway out, the rings rose over the curve of his visor — a world no chart had promised. Helion was built for this exact silence.',
  distance:
    'The first crossing opens in 2027. Twelve seats, one window that never repeats itself.',
} as const

function Wordmark() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 text-center text-[11px] uppercase tracking-[0.45em] text-white/70">
      Helion
    </div>
  )
}

function ScrollCta() {
  return (
    <button className="pointer-events-auto group inline-flex items-center gap-3 rounded-full border border-white/25 px-8 py-3 text-xs uppercase tracking-[0.25em] text-white transition-colors duration-300 hover:bg-white hover:text-black">
      Reserve your seat
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  )
}

function PinnedHero() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timeRef = useRef(0)
  const [p, setP] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onReady = () => setLoaded(true)
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) onReady()
    else video.addEventListener('canplaythrough', onReady, { once: true })

    let raf = 0
    const tick = () => {
      const wrapper = wrapperRef.current
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect()
        const scrollable = rect.height - window.innerHeight
        const progress = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0
        // Quantize so React only re-renders on visible movement.
        setP(Math.round(progress * 1000) / 1000)

        const duration = video.duration || FALLBACK_DURATION
        const target = progressToTime(progress, duration)
        const cur = timeRef.current
        const next = cur + (target - cur) * 0.1
        if (Math.abs(next - cur) > 0.0005) {
          timeRef.current = next
          video.currentTime = next
        } else if (cur !== target) {
          timeRef.current = target
          video.currentTime = target
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('canplaythrough', onReady)
    }
  }, [])

  const showA = p <= 0.01
  const showB = p >= 0.4 && p < 0.63
  const showC = p >= 0.92

  return (
    <div ref={wrapperRef} className="relative h-[600vh]">
      <div className="film-grain sticky top-0 h-[100dvh] overflow-hidden bg-black">
        <video
          ref={videoRef}
          src="/scrub.mp4"
          poster="/poster_start.jpg"
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Loader */}
        <div
          className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black transition-opacity duration-700 ${
            loaded ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <div className="relative h-px w-24 bg-white/20">
            <div className="absolute inset-y-0 left-0 w-1/2 animate-pulse bg-white/80" />
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/40">
            Helion
          </div>
        </div>

        {/* BLOCK A — opening split hero, astronaut stays clear in the middle */}
        <div
          className={`pointer-events-none absolute inset-0 z-50 ${blockVisibility(showA)}`}
        >
          <div className="absolute inset-x-0 top-[14%] px-6 text-left md:inset-x-auto md:left-[7%] md:top-[22%] md:max-w-[420px] md:px-0">
            <h1 className="text-5xl font-light leading-[1.0] tracking-[-0.03em] text-white md:text-7xl">
              Beyond
              <br />
              <span className="font-display italic">the edge</span>
              <br />
              of space.
            </h1>
            <p className="mt-6 max-w-[280px] text-sm text-white/80 [text-shadow:0_1px_14px_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.8)] md:text-white/60 md:[text-shadow:none]">
              {COPY.heroLead}
            </p>
          </div>

          <div className="absolute right-[7%] top-[22%] hidden max-w-[300px] md:block">
            <h3 className="text-2xl font-light tracking-[-0.02em] md:text-3xl">
              Explore the <span className="font-display italic">vastness</span>
            </h3>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-white/50">
              {COPY.heroRight}
            </p>
          </div>

          <div className="absolute bottom-[14%] right-[7%] text-right">
            <p className="text-4xl font-light leading-tight tracking-[-0.02em] md:text-5xl">
              First voyage
              <br />
              <span className="font-display italic">2027</span>
            </p>
          </div>
        </div>

        {/* Scroll hint */}
        <div
          className={`absolute inset-x-0 bottom-8 z-50 flex justify-center transition-opacity duration-700 ${EASE_REVEAL} ${
            showA ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ChevronDown className="h-5 w-5 animate-bounce-slow text-white/50" />
        </div>

        {/* BLOCK B — hold on the helmet close-up (CLIP1_END) */}
        <div
          className={`pointer-events-none absolute inset-0 z-40 ${blockVisibility(showB)}`}
        >
          <div className="absolute inset-x-0 bottom-[12%] max-w-[440px] px-6 text-left md:bottom-auto md:left-auto md:right-[7%] md:top-1/2 md:-translate-y-1/2 md:px-0">
            <h2 className="text-4xl font-light leading-[1.05] tracking-[-0.03em] md:text-6xl">
              <Words
                text="He saw it first."
                hp={p}
                start={0.42}
                step={0.02}
                span={0.12}
                dy={28}
                blur={14}
                accent={[3]}
              />
            </h2>
            <p
              className="mt-6 max-w-[360px] text-sm leading-relaxed text-white/70 [text-shadow:0_1px_14px_rgba(0,0,0,0.95)]"
              style={rev(p, 0.5, 0.1)}
            >
              {COPY.sawItFirst}
            </p>
          </div>
        </div>

        {/* BLOCK C — arrival, final frame */}
        <div
          className={`pointer-events-none absolute inset-0 z-40 ${blockVisibility(showC)}`}
        >
          <div className="absolute inset-x-0 bottom-[12%] px-6 text-left md:left-[7%] md:max-w-[560px] md:px-0">
            <h2 className="text-4xl font-light leading-[1.05] tracking-[-0.03em] md:text-6xl">
              <Words
                text="Distance is just a story we tell."
                hp={p}
                start={0.92}
                step={0.007}
                span={0.035}
                dy={28}
                blur={14}
                accent={[4]}
              />
            </h2>
            <p
              className="mt-6 max-w-[400px] text-sm leading-relaxed text-white/70 [text-shadow:0_1px_14px_rgba(0,0,0,0.95)]"
              style={rev(p, 0.95, 0.04)}
            >
              {COPY.distance}
            </p>
            <div className="mt-8" style={revB(p, 0.96, 0.035)}>
              <ScrollCta />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** prefers-reduced-motion fallback: no pinning, no scrub, story fully visible. */
function StaticHero() {
  return (
    <div className="film-grain relative min-h-screen overflow-hidden bg-black">
      <img
        src="/poster_end.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-20 px-6 py-32 text-center">
        <div>
          <h1 className="text-5xl font-light leading-[1.0] tracking-[-0.03em] md:text-7xl">
            Beyond
            <br />
            <span className="font-display italic">the edge</span>
            <br />
            of space.
          </h1>
          <p className="mx-auto mt-6 max-w-[320px] text-sm text-white/70">
            {COPY.heroLead}
          </p>
        </div>

        <div>
          <h2 className="text-3xl font-light tracking-[-0.03em] md:text-5xl">
            He saw it <span className="font-display italic">first.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[400px] text-sm leading-relaxed text-white/70">
            {COPY.sawItFirst}
          </p>
        </div>

        <div className="flex flex-col items-center">
          <h2 className="text-3xl font-light tracking-[-0.03em] md:text-5xl">
            Distance is just a{' '}
            <span className="font-display italic">story</span> we tell.
          </h2>
          <p className="mx-auto mt-5 max-w-[400px] text-sm leading-relaxed text-white/70">
            {COPY.distance}
          </p>
          <div className="mt-8">
            <ScrollCta />
          </div>
        </div>

        <p className="text-2xl font-light tracking-[-0.02em] text-white/80">
          First voyage <span className="font-display italic">2027</span>
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis()
    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [reduced])

  return (
    <main className="bg-black text-white">
      <Wordmark />
      {reduced ? <StaticHero /> : <PinnedHero />}
    </main>
  )
}
