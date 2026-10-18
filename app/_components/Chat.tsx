'use client'

import { useActionState, useEffect, useRef } from 'react'
import { sendMessage, type ActionResult } from '@/app/hub-actions'

export type ChatMessage = {
  id: string
  body: string
  created_at: string
  sender_id: string
  sender_name: string
  from_winning_minds: boolean
}

export function Chat({
  subjectId,
  messages,
  meId,
  tz,
  placeholder,
}: {
  subjectId: string
  messages: ChatMessage[]
  meId: string
  tz: string
  placeholder?: string
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(sendMessage, {})
  const boxRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages.length])

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state.error])

  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso))

  return (
    <>
      <div className="chat" ref={boxRef}>
        {messages.length === 0 ? (
          <p className="sm muted" style={{ padding: '8px 0' }}>
            {placeholder ?? 'No messages yet.'}
          </p>
        ) : (
          messages.map((m) => (
            <div className={`msg ${m.sender_id === meId ? 'me' : 'them'}`} key={m.id}>
              <div className="bub">{m.body}</div>
              <div className="meta num">{m.sender_name} · {when(m.created_at)}</div>
            </div>
          ))
        )}
      </div>

      {state.error && (
        <div style={{ padding: '0 16px' }}><div className="note bad">{state.error}</div></div>
      )}

      <form className="composer" action={action} ref={formRef}>
        <input type="hidden" name="subject_id" value={subjectId} />
        <textarea
          name="body"
          rows={1}
          placeholder="Write a message…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </>
  )
}
