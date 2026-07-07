import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import Lenis from 'lenis'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

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
  missionLabel: 'Mission 04 — First Contact',
  sawLead:
    'Reflected in his visor: a world no one has named. Ninety million kilometres of cold dark, and still — it looked close enough to touch.',
  sawBody:
    'Every instrument said the same thing: turn back. The fuel margins, the radiation curve, the silence on every channel. He stayed another orbit anyway — some things you measure, and some things you witness.',
  civLabel: 'The First Civilian Voyage',
  civBody:
    'Every expedition begins the same way: someone stands still long enough to really look.',
  joinBody:
    'Join the first voyage beyond the belt. One horizon that will never look the same.',
} as const

const NAV_LINKS = ['Missions', 'Fleet', 'Crew', 'Journal'] as const

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-100 flex items-center justify-between px-6 py-5 md:px-10">
      <a href="#" className="font-display text-2xl italic text-white">
        Helion
      </a>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border border-white/20 bg-white/10 px-2 py-2 backdrop-blur-md md:flex">
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href="#"
            className="rounded-full px-4 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            {link}
          </a>
        ))}
      </nav>

      <button className="hidden rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 md:block">
        Reserve a seat
      </button>
    </header>
  )
}

function Stat({
  value,
  label,
  style,
}: {
  value: string
  label: string
  style?: CSSProperties
}) {
  return (
    <div style={style}>
      <div className="font-display text-2xl italic text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
        {label}
      </div>
    </div>
  )
}

function PremiumCta() {
  return (
    <button className="group pointer-events-auto mt-6 flex items-center gap-3 rounded-full bg-[#e8a04a] py-2 pl-7 pr-2 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.03] hover:bg-[#d68d35] hover:shadow-[0_10px_40px_-10px_rgba(232,160,74,0.5)]">
      Reserve your seat
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/85 transition-transform duration-300 group-hover:rotate-45">
        <ArrowUpRight size={16} className="text-[#e8a04a]" />
      </span>
    </button>
  )
}

function PinnedHero() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const introRef = useRef<HTMLVideoElement>(null)
  const timeRef = useRef(0)
  const [p, setP] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [introOn, setIntroOn] = useState(true)

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

        // The idle intro comes back only once the scroll is at the top AND the
        // lerped scrub time has actually settled at frame 0 — both videos share
        // that frame, so the crossfade never jumps.
        setIntroOn(progress < 0.003 && timeRef.current < 0.05)

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

  useEffect(() => {
    const intro = introRef.current
    if (!intro) return
    if (introOn) {
      // Always restart from frame 0 — it matches scrub frame 0 pixel-for-pixel.
      intro.currentTime = 0
      intro.play().catch(() => {})
      return
    }
    // Let the 0.4s fade-out finish before pausing.
    const timeout = window.setTimeout(() => intro.pause(), 450)
    return () => window.clearTimeout(timeout)
  }, [introOn])

  const showA = p <= 0.01

  // Block B: cascade pours in p 0.40→0.52, reading window to 0.59,
  // then a long soft exit (fade + 20px upward drift) p 0.59→0.65.
  const hpB = clamp01((p - 0.4) / 0.12)
  const fadeB = p < 0.59 ? 1 : 1 - clamp01((p - 0.59) / 0.06)
  // Block C: cascade pours in p 0.92→1.0.
  const hpC = clamp01((p - 0.92) / 0.08)

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

        {/* Idle intro: ambient loop of scrub frame 0, crossfades out on scroll */}
        <video
          ref={introRef}
          src="/intro_loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 z-20 h-full w-full object-cover object-center"
          style={{
            opacity: introOn ? 1 : 0,
            transition: introOn
              ? 'opacity 0.6s ease-in-out'
              : 'opacity 0.4s ease-out',
          }}
        />

        {/* Mobile scrims: keep text legible over the bright suit */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-1/2 bg-gradient-to-t from-black/70 to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-2/5 bg-gradient-to-b from-black/60 to-transparent md:hidden" />

        {/* Warm glow vignette behind the small figure (block C) */}
        <div
          className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(232,160,74,0.14),transparent_70%)]"
          style={{ opacity: hpC * 0.45 }}
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

        {/* BLOCK B — helmet close-up hold, mission brief on the right */}
        <div
          className="pointer-events-none absolute z-50 max-md:inset-x-0 max-md:bottom-[8%] max-md:px-6 md:right-[8%] md:top-1/2 md:max-w-[460px] md:-translate-y-1/2"
          style={{
            opacity: fadeB,
            visibility: hpB > 0 && fadeB > 0 ? 'visible' : 'hidden',
          }}
        >
          {/* exit drift lives on an inner wrapper so it can't fight the positioning transforms */}
          <div style={{ transform: `translateY(${-20 * (1 - fadeB)}px)` }}>
            <div
              className="text-[11px] uppercase tracking-[0.3em] text-white/40"
              style={revB(hpB, 0)}
            >
              {COPY.missionLabel}
            </div>
            <h2 className="mt-4 text-5xl font-light leading-[1.05] tracking-[-0.02em] text-white md:text-6xl">
              <Words text="He saw" hp={hpB} start={0.1} dy={28} blur={14} />
              <br />
              <span className="inline-block" style={revB(hpB, 0.26)}>
                it
              </span>{' '}
              <span
                className="inline-block font-display italic"
                style={revB(hpB, 0.34)}
              >
                first
              </span>
            </h2>
            <p
              className="mt-6 text-base leading-relaxed text-white/80"
              style={revB(hpB, 0.44)}
            >
              {COPY.sawLead}
            </p>
            <p
              className="mt-4 text-sm leading-relaxed text-white/55"
              style={revB(hpB, 0.54)}
            >
              {COPY.sawBody}
            </p>
            <div className="mt-6 h-px w-12 bg-white/20" style={revB(hpB, 0.64)} />
            <div className="mt-5 flex gap-10">
              <Stat value="92M km" label="distance" style={revB(hpB, 0.68)} />
              <Stat value="311 days" label="outbound" style={revB(hpB, 0.75)} />
              <Stat value="1 of 12" label="crew" style={revB(hpB, 0.82)} />
            </div>
          </div>
        </div>

        {/* BLOCK C — final frame, editorial layout around the small figure */}
        <div
          className="pointer-events-none absolute inset-0 z-50"
          style={{ visibility: hpC > 0 ? 'visible' : 'hidden' }}
        >
          <h2 className="absolute inset-x-0 top-[10%] px-6 text-center text-5xl font-light leading-[1.02] tracking-[-0.02em] text-white max-md:top-[12%] md:text-7xl">
            <Words text="Distance is just" hp={hpC} start={0} step={0.06} />
            <br />
            <span className="font-display italic">
              <Words text="a story we tell" hp={hpC} start={0.18} step={0.06} />
            </span>
          </h2>

          <div className="max-md:absolute max-md:inset-x-0 max-md:bottom-[6%] max-md:flex max-md:flex-col max-md:gap-7 max-md:px-6 md:contents">
            <div className="md:absolute md:bottom-[16%] md:left-[7%] md:max-w-[300px]">
              <div
                className="text-[10px] uppercase tracking-[0.3em] text-white/40"
                style={rev(hpC, 0.3)}
              >
                {COPY.civLabel}
              </div>
              <p className="mt-3 text-sm text-white/65" style={rev(hpC, 0.38)}>
                {COPY.civBody}
              </p>
              <div className="mt-5 h-px w-12 bg-white/20" style={rev(hpC, 0.46)} />
              <div className="mt-4 flex gap-10">
                <Stat value="12" label="seats" style={rev(hpC, 0.52)} />
                <Stat value="2027" label="departure" style={rev(hpC, 0.6)} />
              </div>
            </div>

            <div className="md:absolute md:bottom-[16%] md:right-[7%] md:max-w-[320px]">
              <p className="text-sm text-white/65" style={rev(hpC, 0.4)}>
                {COPY.joinBody}
              </p>
              <div style={rev(hpC, 0.52)}>
                <PremiumCta />
              </div>
              <div style={rev(hpC, 0.62)}>
                <a
                  href="#"
                  className="pointer-events-auto mt-4 inline-block text-xs text-white/50 transition-colors hover:text-white"
                >
                  View the route →
                </a>
              </div>
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

        <div className="flex flex-col items-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
            {COPY.missionLabel}
          </div>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.02em] md:text-5xl">
            He saw it <span className="font-display italic">first</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[420px] text-sm leading-relaxed text-white/70">
            {COPY.sawLead}
          </p>
          <div className="mt-6 h-px w-12 bg-white/20" />
          <div className="mt-5 flex gap-10">
            <Stat value="92M km" label="distance" />
            <Stat value="311 days" label="outbound" />
            <Stat value="1 of 12" label="crew" />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            {COPY.civLabel}
          </div>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.02em] md:text-5xl">
            Distance is just{' '}
            <span className="font-display italic">a story we tell</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[400px] text-sm leading-relaxed text-white/70">
            {COPY.joinBody}
          </p>
          <PremiumCta />
          <a
            href="#"
            className="pointer-events-auto mt-4 inline-block text-xs text-white/50 transition-colors hover:text-white"
          >
            View the route →
          </a>
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
      <Nav />
      {reduced ? <StaticHero /> : <PinnedHero />}
    </main>
  )
}
