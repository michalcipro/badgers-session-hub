'use client'

import { useActionState } from 'react'
import { assignTask, deleteTask, toggleTask, type ActionResult } from '@/app/hub-actions'

export type TaskRow = {
  id: string
  title: string
  due_on: string | null
  done_at: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

export function Tasks({
  tasks,
  playerId,
  canAssign,
}: {
  tasks: TaskRow[]
  playerId: string
  canAssign: boolean
}) {
  const [toggleState, toggleAction] = useActionState<ActionResult, FormData>(toggleTask, {})
  const [addState, addAction, adding] = useActionState<ActionResult, FormData>(assignTask, {})
  const [delState, delAction] = useActionState<ActionResult, FormData>(deleteTask, {})

  const open = tasks.filter((t) => !t.done_at)
  const done = tasks.filter((t) => t.done_at)
  const error = toggleState.error ?? addState.error ?? delState.error

  const row = (t: TaskRow) => {
    const overdue = !t.done_at && t.due_on && t.due_on < today()
    return (
      <div className="it" key={t.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
        <form action={toggleAction}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="done" value={t.done_at ? 'false' : 'true'} />
          <button
            type="submit"
            className="tick"
            aria-label={t.done_at ? 'Reopen' : 'Mark done'}
            data-done={t.done_at ? 'true' : 'false'}
          >
            {t.done_at ? '✓' : ''}
          </button>
        </form>
        <div className="grow">
          <div
            className="sm"
            style={t.done_at ? { textDecoration: 'line-through', color: 'var(--fg-faint)' } : undefined}
          >
            {t.title}
          </div>
          {t.due_on && (
            <div
              className="xs"
              style={overdue ? { color: 'var(--accent)', fontWeight: 600 } : { color: 'var(--fg-faint)' }}
            >
              Due {t.due_on}{overdue ? ' · overdue' : ''}
            </div>
          )}
        </div>
        {canAssign && (
          <form action={delAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="player_id" value={playerId} />
            <button className="btn ghost sm" type="submit">Remove</button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="bd" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {error && <div className="note bad">{error}</div>}

      {open.length === 0 && done.length === 0 && (
        <p className="sm muted">Nothing here yet.</p>
      )}
      {open.map(row)}
      {done.length > 0 && (
        <>
          {open.length > 0 && <hr className="sep" style={{ margin: '8px 0' }} />}
          <div className="eyebrow" style={{ marginBottom: 2 }}>Done</div>
          {done.map(row)}
        </>
      )}

      {canAssign && (
        <form action={addAction} className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
          <input type="hidden" name="player_id" value={playerId} />
          <input type="text" name="title" placeholder="New task…" style={{ flex: '1 1 180px' }} required />
          <input type="date" name="due_on" style={{ width: 'auto' }} />
          <button className="btn primary sm" type="submit" disabled={adding}>Assign</button>
        </form>
      )}
    </div>
  )
}
