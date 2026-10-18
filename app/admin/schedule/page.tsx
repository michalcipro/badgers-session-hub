import { Shell } from '@/app/_components/Shell'
import { WeekCalendar } from '@/app/_components/WeekCalendar'
import { MeetLinks } from '@/app/_components/MeetLinks'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { loadWeekSlots } from '@/lib/slots'
import { hourRange, weekRange, weekStartFor } from '@/lib/week'
import { TZ_CZ } from '@/lib/time'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const me = await requireActive('admin')
  const { week } = await searchParams

  const weekStart = weekStartFor(week, TZ_CZ)
  const { fromISO, toISO } = weekRange(weekStart, TZ_CZ)

  const supabase = await createClient()
  const slots = await loadWeekSlots(supabase, fromISO, toISO, 'staff', me.id)

  return (
    <Shell profile={me} current="/admin/schedule">
      <div className="page-h">
        <h2>Your availability</h2>
        <p>Click a square to offer that time. Click it again to take it back.</p>
      </div>

      <WeekCalendar
        mode="admin"
        tz={TZ_CZ}
        weekStart={weekStart}
        basePath="/admin/schedule"
        slots={slots}
        hours={hourRange(slots, TZ_CZ, [12, 21])}
        meId={me.id}
        nowISO={new Date().toISOString()}
      />

      <MeetLinks slots={slots} />
    </Shell>
  )
}
