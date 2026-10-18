import { Shell } from '@/app/_components/Shell'
import { Chat } from '@/app/_components/Chat'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { loadRoster, loadThread } from '@/lib/hub'
import { TZ_US } from '@/lib/time'

export default async function MyMessages() {
  const me = await requireActive()
  if (me.role === 'admin') {
    const { redirect } = await import('next/navigation')
    redirect('/admin/messages')
  }

  const supabase = await createClient()
  const roster = await loadRoster(supabase)
  const messages = await loadThread(supabase, me.id, roster)

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Messages</h2>
        <p>Your direct line to Michal and Milan. Nobody else can read this.</p>
      </div>
      <div className="card">
        <Chat
          subjectId={me.id}
          messages={messages}
          meId={me.id}
          tz={TZ_US}
          placeholder="Nothing yet. Write whenever something comes up between calls."
        />
      </div>
    </Shell>
  )
}
