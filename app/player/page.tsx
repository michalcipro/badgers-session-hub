import { Shell } from '@/app/_components/Shell'
import { requireActive } from '@/lib/auth'

export default async function PlayerPage() {
  const me = await requireActive('player')

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Hi, {me.first_name}</h2>
        <p>All times here are shown in Madison time.</p>
      </div>

      <div className="card">
        <div className="hd"><h3>Your next call</h3></div>
        <div className="bd sm muted">
          Nothing booked yet. Winning Minds has not opened any times — the week
          calendar appears here as soon as they do.
        </div>
      </div>
    </Shell>
  )
}
