import { Shell } from '@/app/_components/Shell'
import { ConsultationRequest, type ConsultationRow } from '@/app/_components/ConsultationRequest'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'

type Row = Omit<ConsultationRow, 'meet_url'> & {
  slots: { meet_url: string | null } | { meet_url: string | null }[] | null
}

export default async function CoachConsultations() {
  const me = await requireActive('coach')
  const supabase = await createClient()

  const { data } = await supabase
    .from('consultations')
    .select('id, requested_at, duration_min, topic, status, note, slots(meet_url)')
    .order('requested_at', { ascending: false })

  const rows: ConsultationRow[] = ((data ?? []) as Row[]).map((c) => {
    const slot = Array.isArray(c.slots) ? c.slots[0] : c.slots
    return { ...c, meet_url: slot?.meet_url ?? null }
  })

  return (
    <Shell profile={me} current="/coach/consultations">
      <div className="page-h">
        <h2>Consultations</h2>
        <p>Your own calls with Winning Minds, separate from the players&rsquo; times.</p>
      </div>
      <ConsultationRequest rows={rows} />
    </Shell>
  )
}
