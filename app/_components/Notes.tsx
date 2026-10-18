'use client'

import { useActionState, useRef, useEffect } from 'react'
import { addNote, deleteNote, type ActionResult } from '@/app/hub-actions'

export type NoteRow = {
  id: string
  body: string
  created_at: string
  author_name: string
}

export function Notes({ notes, playerId }: { notes: NoteRow[]; playerId: string }) {
  const [addState, addAction, adding] = useActionState<ActionResult, FormData>(addNote, {})
  const [delState, delAction] = useActionState<ActionResult, FormData>(deleteNote, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!adding && !addState.error) formRef.current?.reset()
  }, [adding, addState.error])

  return (
    <div className="bd" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(addState.error || delState.error) && (
        <div className="note bad">{addState.error ?? delState.error}</div>
      )}

      {notes.length === 0 ? (
        <p className="sm muted">No notes yet.</p>
      ) : (
        notes.map((n) => (
          <div key={n.id}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <div className="xs faint num">
                {n.created_at.slice(0, 10)} · {n.author_name}
              </div>
              <form action={delAction}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="player_id" value={playerId} />
                <button className="btn ghost sm" type="submit">Remove</button>
              </form>
            </div>
            <div className="sm" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
          </div>
        ))
      )}

      <form action={addAction} ref={formRef} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <input type="hidden" name="player_id" value={playerId} />
        <textarea name="body" rows={2} placeholder="What came up in the call…" required />
        <button className="btn primary" type="submit" disabled={adding}>Save</button>
      </form>
    </div>
  )
}
