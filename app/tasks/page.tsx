import { redirect } from 'next/navigation'
import { Shell } from '@/app/_components/Shell'
import { Tasks } from '@/app/_components/Tasks'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { loadTasks } from '@/lib/hub'

export default async function MyTasks() {
  const me = await requireActive()
  if (me.role !== 'player') redirect('/')

  const supabase = await createClient()
  const tasks = await loadTasks(supabase, me.id)
  const open = tasks.filter((t) => !t.done_at).length

  return (
    <Shell profile={me} current="/tasks">
      <div className="page-h">
        <h2>Tasks</h2>
        <p>Set by Winning Minds between calls.</p>
      </div>
      <div className="card">
        <div className="hd">
          <h3>Your tasks</h3>
          {open > 0 && <span className="pill accent num">{open} open</span>}
        </div>
        <Tasks tasks={tasks} playerId={me.id} canAssign={false} />
      </div>
    </Shell>
  )
}
