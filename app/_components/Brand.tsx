import Image from 'next/image'
import Link from 'next/link'

/**
 * The Motion W carries its own colours, so it is not inverted like the
 * Winning Minds wordmark — it has a reversed artwork instead, with the
 * outline in white, which is how the mark is meant to sit on dark.
 */
function MotionW({ className }: { className: string }) {
  return (
    <>
      <Image
        className={`${className} mw-light`}
        src="/motion-w.png"
        alt="Wisconsin Badgers"
        width={353}
        height={360}
        priority
      />
      <Image
        className={`${className} mw-dark`}
        src="/motion-w-dark.png"
        alt=""
        aria-hidden
        width={353}
        height={360}
        priority
      />
    </>
  )
}

/**
 * Both marks, side by side, because the app belongs to neither of them
 * alone. On a narrow screen only the Winning Minds monogram and the
 * Motion W survive — they are the two that read at that size.
 */
export function Brand({ href }: { href?: string }) {
  const inner = (
    <>
      <Image
        className="mark-only"
        src="/wm-mark.png"
        alt=""
        width={156}
        height={240}
        priority
      />
      <Image
        className="wm"
        src="/winning-minds.png"
        alt="Winning Minds"
        width={720}
        height={224}
        priority
      />
      <span className="bar" aria-hidden />
      <MotionW className="mw" />
      <span className="bar bar-end" aria-hidden />
      <span className="txt">
        <h1>Session Hub</h1>
      </span>
    </>
  )

  return href ? (
    <Link className="brand" href={href}>{inner}</Link>
  ) : (
    <div className="brand">{inner}</div>
  )
}

/** The same two marks with room around them, for the signed-out pages. */
export function BrandLarge({ line }: { line?: string }) {
  return (
    <div className="auth-brand">
      <div className="pair">
        <Image className="wm" src="/winning-minds.png" alt="Winning Minds" width={720} height={224} priority />
        <span className="bar" aria-hidden />
        <MotionW className="mw" />
      </div>
      <div>
        <h1>Session Hub</h1>
        <p>{line ?? 'Winning Minds × Wisconsin Badgers women’s tennis'}</p>
      </div>
    </div>
  )
}
