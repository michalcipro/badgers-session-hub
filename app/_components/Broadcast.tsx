'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { broadcastMessage, type ActionResult } from '@/app/hub-actions'
import { fileSize } from './Chat'

export type Recipient = {
  id: string
  name: string
  role: 'admin' | 'coach' | 'player'
}

const GROUPS = [
  { role: 'player', one: 'player', many: 'players' },
  { role: 'coach', one: 'coach', many: 'coaches' },
  { role: 'admin', one: 'Winning Minds', many: 'Winning Minds' },
] as const

/**
 * One message to several people. Each of them gets it in their own
 * thread, so a reply comes back privately and nobody learns who else
 * was written to — which is why the button says how many threads it is
 * about to write in rather than pretending this is a group chat.
 */
export function Broadcast({ people }: { people: Recipient[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(broadcastMessage, {})
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      setBody('')
      setPicked(null)
      setChosen(new Set())
      formRef.current?.reset()
    }
  }, [state.ok])

  const toggle = (id: string) =>
    setChosen((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const setGroup = (ids: string[], on: boolean) =>
    setChosen((was) => {
      const next = new Set(was)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const groups = GROUPS.map((g) => {
    const members = people.filter((p) => p.role === g.role)
    return { ...g, members, all: members.length > 0 && members.every((p) => chosen.has(p.id)) }
  }).filter((g) => g.members.length > 0)

  const everyone = people.length > 0 && people.every((p) => chosen.has(p.id))

  if (!open) {
    return (
      <div className="card">
        <div className="hd">
          <h3>Write to several people</h3>
          <span className="sub">Each gets it in their own thread</span>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(true)}>
            Write
          </button>
        </div>
        {state.ok && <div className="bd"><div className="note ok">{state.ok}</div></div>}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="hd">
        <h3>Write to several people</h3>
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <form className="bd" action={action} ref={formRef}>
        {[...chosen].map((id) => (
          <input key={id} type="hidden" name="to" value={id} />
        ))}

        <div className="row" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Send to</span>
          {groups.map((g) => (
            <button
              key={g.role}
              type="button"
              className={`btn sm${g.all ? ' primary' : ''}`}
              onClick={() => setGroup(g.members.map((p) => p.id), !g.all)}
            >
              {g.members.length === 1 ? g.one : `All ${g.many}`} ({g.members.length})
            </button>
          ))}
          {groups.length > 1 && (
            <button
              type="button"
              className={`btn sm${everyone ? ' primary' : ''}`}
              onClick={() => setGroup(people.map((p) => p.id), !everyone)}
            >
              Everyone ({people.length})
            </button>
          )}
        </div>

        <div className="picks">
          {people.map((p) => (
            <label key={p.id} className={`pick${chosen.has(p.id) ? ' on' : ''}`}>
              <input
                type="checkbox"
                checked={chosen.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="trunc">{p.name}</span>
            </label>
          ))}
        </div>

        <textarea
          name="body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What you want them all to know…"
          style={{ marginTop: 14 }}
        />

        <label className="clip pick-file" style={{ marginTop: 10 }}>
          <span aria-hidden>📎</span>
          <span className="trunc">{picked ? picked.name : 'Attach a file'}</span>
          {picked ? <span className="faint xs num">{fileSize(picked.size)}</span> : null}
          <input
            type="file"
            name="file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setPicked(f ? { name: f.name, size: f.size } : null)
            }}
          />
        </label>
        {state.error && <div className="note bad" style={{ marginTop: 12 }}>{state.error}</div>}
        {state.ok && <div className="note ok" style={{ marginTop: 12 }}>{state.ok}</div>}

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            type="submit"
            disabled={pending || chosen.size === 0 || (body.trim() === '' && !picked)}
          >
            {pending
              ? 'Sending…'
              : chosen.size === 0
                ? 'Pick who it goes to'
                : `Send to ${chosen.size}`}
          </button>
          <span className="xs muted">
            Nobody sees who else got it, and replies come back privately.
          </span>
        </div>
      </form>
    </div>
  )
}
