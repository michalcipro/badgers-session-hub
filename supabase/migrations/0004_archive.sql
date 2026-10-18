-- Leaving the squad.
--
-- A player who graduates or stops should lose access without her history
-- disappearing: Winning Minds still has the notes and the attendance
-- record. "archived" is that state. Because is_active() demands 'active',
-- an archived account immediately loses every permission it had.
--
-- Deleting outright is a separate, deliberate act handled in the app, for
-- when someone asks to be erased rather than simply stopping.

alter type user_status add value if not exists 'archived';
