# Badgers Session Hub

Working prototype of the scheduling and communication platform between
**Winning Minds** and the **Wisconsin Badgers women's tennis** team.

Every two weeks Winning Minds opens a set of call slots. Players book the one
that fits, and everything around the call — Google Meet link, notes, tasks,
files, messages — lives in the same place.

## What is in here

One self-contained page, no build step for the browser, no backend. State lives
in memory, so a reload resets it. Use the role switcher in the dark strip at the
top to move between the three sides:

| Role | Sees |
| --- | --- |
| **Winning Minds** | Cycle and slot builder, approvals queue, player profiles with private notes, tasks, files, all message threads |
| **Player** | Week schedule with free slots, one-tap booking with a confirmation, own call and Meet link, own tasks and files, direct thread |
| **Coach** | Booking status and attendance only — no notes, no messages, no session content |

### Decisions worth knowing

- **Time zones.** Every slot is stored as one absolute instant; Prague (24h) and
  Madison (12h) are only two renderings of it. The clock gap is 7 hours most of
  the year but drops to 6 for about two weeks each spring and autumn, because
  the EU and the US change clocks on different dates. The page computes it.
- **Google Meet.** Phase 1 is a pasted link per slot. Auto-generating one per
  booking needs a Google Calendar API connection and is deliberately left out.
- **Access.** Email + password sign-up lands in an approval queue. Nothing is
  visible until Winning Minds approves the account and sets the role.
- **Privacy.** Players see each other's names on the schedule and nothing else.

The roster in the prototype is placeholder data, not real athletes.

## Running it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Editing

`session-hub.html` is the source. It is authored as a page body, because the
same file is published as a Claude Artifact, where the surrounding HTML document
is supplied by the runtime. `build.mjs` wraps it into the standalone
`index.html` that GitHub Pages serves:

```bash
node build.mjs
```

Edit `session-hub.html`, run the build, commit both.
