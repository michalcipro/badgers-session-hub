import { Shell } from '@/app/_components/Shell'
import { Files } from '@/app/_components/Files'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { loadFiles, loadRoster } from '@/lib/hub'

export default async function MyFiles() {
  const me = await requireActive()
  const supabase = await createClient()
  const roster = await loadRoster(supabase)
  const files = await loadFiles(supabase, roster, { viewer: 'player' })

  return (
    <Shell profile={me} current="/files">
      <div className="page-h">
        <h2>Resources</h2>
        <p>Everything Winning Minds has shared with you.</p>
      </div>
      <div className="card">
        <div className="hd"><h3>Files</h3></div>
        <Files files={files} canManage={false} />
      </div>
    </Shell>
  )
}
