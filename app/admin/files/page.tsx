import { Shell } from '@/app/_components/Shell'
import { Files } from '@/app/_components/Files'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, type Profile } from '@/lib/auth'
import { loadFiles, loadRoster } from '@/lib/hub'

export default async function AdminFiles() {
  const me = await requireActive('admin')
  const supabase = await createClient()

  const roster = await loadRoster(supabase)
  const files = await loadFiles(supabase, roster, { viewer: 'staff' })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .eq('role', 'player')
    .order('last_name')

  const people = ((profiles ?? []) as Profile[]).map((p) => ({ id: p.id, name: fullName(p) }))

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Library</h2>
        <p>Share with the whole team, or with one player only.</p>
      </div>

      <div className="card">
        <div className="hd">
          <h3>Files</h3>
          <span className="sub">{files.length} file{files.length === 1 ? '' : 's'}</span>
        </div>
        <Files files={files} canManage people={people} />
      </div>
    </Shell>
  )
}
