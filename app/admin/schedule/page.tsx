import { Shell } from '@/app/_components/Shell'
import { WeekCalendar } from '@/app/_components/WeekCalendar'
import { MeetLinks } from '@/app/_components/MeetLinks'
import { RepeatWeek } from '@/app/_components/RepeatWeek'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { sessionMin } from '@/lib/settings'
import { loadWeekSlots } from '@/lib/slots'
import { loadSeries } from '@/lib/series'
import { hourRange, weekRange, weekStartFor } from '@/lib/week'
import { TZ_CZ, calFmt, dayKey } from '@/lib/time'

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
  const series = await loadSeries(supabase)

  return (
    <Shell profile={me}>
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
        lengthMin={await sessionMin(supabase)}
      />

      <RepeatWeek
        weekKey={dayKey(weekStart)}
        weekLabel={calFmt(weekStart, { day: 'numeric', month: 'long' })}
        slotCount={slots.filter((s) => s.kind === 'player').length}
        series={series}
      />

      <MeetLinks slots={slots} nowISO={new Date().toISOString()} />
    </Shell>
  )
}
