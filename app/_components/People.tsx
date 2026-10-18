'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { changeRole, createPerson, type AccountResult } from '@/app/admin/actions'

export type Person = {
  id: string
  name: string
  email: string
  role: 'admin' | 'coach' | 'player'
  is_owner: boolean
}

const ROLE_LABEL = { admin: 'Winning Minds', coach: 'Coach', player: 'Player' } as const

/** Adding somebody without waiting for them to sign up. */
export function AddPerson({ isOwner }: { isOwner: boolean }) {
  const [state, action, pending] = useActionState<AccountResult, FormData>(createPerson, {})
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('player')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  if (!open) {
    return (
      <div className="card">
        <div className="hd">
          <h3>Add someone</h3>
          <span className="sub">Create the account yourself instead of waiting for a sign-up</span>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(true)}>
            Add someone
          </button>
        </div>
        {state.ok && (
          <div className="bd"><div className="note ok">{state.ok}</div></div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="hd">
        <h3>Add someone</h3>
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <form className="bd" action={action} ref={formRef}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <label className="fld" style={{ flex: '1 1 140px' }}>
            First name
            <input type="text" name="first_name" required />
          </label>
          <label className="fld" style={{ flex: '1 1 140px' }}>
            Last name
            <input type="text" name="last_name" required />
          </label>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', marginTop: 12 }}>
          <label className="fld" style={{ flex: '1 1 220px' }}>
            Email
            <input type="email" name="email" required />
          </label>
          <label className="fld" style={{ flex: '0 1 150px' }}>
            Role
            <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              {isOwner && <option value="admin">Winning Minds</option>}
            </select>
          </label>
          {role === 'player' && (
            <label className="fld" style={{ flex: '0 1 110px' }}>
              Year
              <input type="text" name="class_year" placeholder="Fr / So / Jr / Sr" />
            </label>
          )}
        </div>

        {state.error && <div className="note bad" style={{ marginTop: 12 }}>{state.error}</div>}
        {state.ok && <div className="note ok" style={{ marginTop: 12 }}>{state.ok}</div>}

        <button className="btn primary" type="submit" disabled={pending} style={{ marginTop: 12 }}>
          {pending ? 'Creating…' : 'Create the account'}
        </button>
        <p className="xs muted" style={{ marginTop: 8 }}>
          The account is active straight away and a password comes back once. Pass it on,
          and she changes it under Account.
        </p>
      </form>
    </div>
  )
}

/** Moving somebody between roles after the fact. */
export function RoleSelect({ person, isOwner }: { person: Person; isOwner: boolean }) {
  const [state, action, pending] = useActionState<AccountResult, FormData>(changeRole, {})

  if (person.is_owner) return <span className="pill accent">{ROLE_LABEL[person.role]}</span>

  return (
    <form action={action} className="row" style={{ gap: 6 }} title={state.error ?? undefined}>
      <input type="hidden" name="id" value={person.id} />
      <select name="role" defaultValue={person.role} style={{ width: 'auto' }} disabled={pending}>
        <option value="player">Player</option>
        <option value="coach">Coach</option>
        {isOwner && <option value="admin">Winning Minds</option>}
      </select>
      <button className="btn ghost sm" type="submit" disabled={pending}>Save</button>
    </form>
  )
}
