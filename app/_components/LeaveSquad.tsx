'use client'

import { useActionState, useState } from 'react'
import { archiveAccount, deleteAccount, restoreAccount, type AccountResult } from '@/app/admin/actions'

export function LeaveSquad({
  id,
  name,
  archived,
}: {
  id: string
  name: string
  archived: boolean
}) {
  const [archiveState, archiveAction, archiving] = useActionState<AccountResult, FormData>(archiveAccount, {})
  const [restoreState, restoreAction, restoring] = useActionState<AccountResult, FormData>(restoreAccount, {})
  const [deleteState, deleteAction, deleting] = useActionState<AccountResult, FormData>(deleteAccount, {})
  const [armed, setArmed] = useState(false)

  const error = archiveState.error ?? restoreState.error ?? deleteState.error
  const ok = archiveState.ok ?? restoreState.ok

  return (
    <div className="card">
      <div className="hd">
        <h3>Leaving the squad</h3>
        <span className="sub">Two different things, so pick carefully</span>
      </div>
      <div className="bd" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <div className="note bad">{error}</div>}
        {ok && <div className="note ok">{ok}</div>}

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: '1 1 260px' }}>
            <div className="nm">{archived ? 'Bring her back' : 'Take away access'}</div>
            <p className="xs muted" style={{ marginTop: 3 }}>
              {archived
                ? `${name} cannot sign in at the moment. Everything of hers is still here.`
                : 'She can no longer sign in or book, but her notes, tasks and attendance stay. Use this when someone graduates or stops.'}
            </p>
          </div>
          <form action={archived ? restoreAction : archiveAction}>
            <input type="hidden" name="id" value={id} />
            <button className="btn" type="submit" disabled={archiving || restoring}>
              {archived ? 'Put back on the squad' : 'Archive'}
            </button>
          </form>
        </div>

        <hr className="sep" />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: '1 1 260px' }}>
            <div className="nm" style={{ color: 'var(--accent)' }}>Erase her completely</div>
            <p className="xs muted" style={{ marginTop: 3 }}>
              Deletes the account and everything attached to it, including your
              session notes about her. For when someone asks to be erased.
              This cannot be undone.
            </p>
          </div>
          {armed ? (
            <form action={deleteAction} className="row" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="confirm" value="DELETE" />
              <button className="btn primary" type="submit" disabled={deleting}>
                {deleting ? 'Erasing…' : `Yes, erase ${name.split(' ')[0]}`}
              </button>
              <button className="btn ghost" type="button" onClick={() => setArmed(false)}>Cancel</button>
            </form>
          ) : (
            <button className="btn" type="button" onClick={() => setArmed(true)}>Erase…</button>
          )}
        </div>
      </div>
    </div>
  )
}
