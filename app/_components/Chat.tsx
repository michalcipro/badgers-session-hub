'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { sendMessage, type ActionResult } from '@/app/hub-actions'

export type ChatMessage = {
  id: string
  body: string
  created_at: string
  sender_id: string
  sender_name: string
  from_winning_minds: boolean
  file_name: string | null
  file_size: number | null
}

/** Readable size, so nobody taps a 20 MB file on a phone by accident. */
export function fileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** The paperclip chip under a message, and in the compose box. */
export function Attached({
  href,
  name,
  size,
}: {
  href?: string
  name: string
  size: number | null
}) {
  const inner = (
    <>
      <span aria-hidden>📎</span>
      <span className="trunc">{name}</span>
      {size ? <span className="faint xs num">{fileSize(size)}</span> : null}
    </>
  )
  return href ? (
    <a className="clip" href={href} download>{inner}</a>
  ) : (
    <span className="clip">{inner}</span>
  )
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
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages.length])

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset()
      setPicked(null)
    }
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
              {m.body ? <div className="bub">{m.body}</div> : null}
              {m.file_name && (
                <Attached
                  href={`/api/messages/${m.id}/file`}
                  name={m.file_name}
                  size={m.file_size}
                />
              )}
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
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          <label className="clip pick-file">
            <span aria-hidden>📎</span>
            <span>{picked ?? 'Attach a file'}</span>
            <input
              type="file"
              name="file"
              onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </div>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </>
  )
}
