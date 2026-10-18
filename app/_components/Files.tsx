'use client'

import { useActionState } from 'react'
import { deleteFile, uploadFile, type ActionResult } from '@/app/hub-actions'

export type FileRow = {
  id: string
  name: string
  size_bytes: number | null
  visible_to: string | null
  created_at: string
  audience: string
}

const size = (b: number | null) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function Files({
  files,
  canManage,
  people,
  fixedPlayerId,
}: {
  files: FileRow[]
  canManage: boolean
  people?: { id: string; name: string }[]
  fixedPlayerId?: string
}) {
  const [upState, upAction, uploading] = useActionState<ActionResult, FormData>(uploadFile, {})
  const [delState, delAction] = useActionState<ActionResult, FormData>(deleteFile, {})
  const error = upState.error ?? delState.error

  return (
    <>
      {(error || upState.ok) && (
        <div className="bd" style={{ paddingBottom: 0 }}>
          <div className={error ? 'note bad' : 'note ok'}>{error ?? upState.ok}</div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="bd sm muted">Nothing shared yet.</div>
      ) : (
        <div className="list">
          {files.map((f) => (
            <div className="it" key={f.id}>
              <span className={f.visible_to ? 'pill accent' : 'pill plain'}>{f.audience}</span>
              <div className="grow">
                <a className="nm trunc" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
                <div className="xs muted num">
                  {size(f.size_bytes)}{f.size_bytes ? ' · ' : ''}{f.created_at.slice(0, 10)}
                </div>
              </div>
              {canManage && (
                <form action={delAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="btn ghost sm" type="submit">Remove</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="bd" style={{ borderTop: '1px solid var(--line)' }}>
          <form action={upAction} className="row" style={{ alignItems: 'flex-end' }}>
            <label className="fld" style={{ flex: '1 1 200px' }}>
              File
              <input type="file" name="file" required />
            </label>
            {fixedPlayerId ? (
              <input type="hidden" name="visible_to" value={fixedPlayerId} />
            ) : (
              <label className="fld" style={{ flex: '0 1 200px' }}>
                Share with
                <select name="visible_to" defaultValue="all">
                  <option value="all">The whole team</option>
                  {(people ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="btn primary" type="submit" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
          <p className="xs muted" style={{ marginTop: 8 }}>
            Up to 25 MB. {fixedPlayerId ? 'Only this player will see it.' : 'Team files are visible to every player.'}
          </p>
        </div>
      )}
    </>
  )
}
