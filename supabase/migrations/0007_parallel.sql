-- Two of you, so two calls can run at once.
--
-- Until now any two overlapping times were refused, which was right when
-- one person ran everything. Winning Minds is Michal and Milan, so the
-- same hour can hold two calls.
--
-- A slot gets a lane: simply "the first one" and "the second one". It is
-- deliberately not a person — you two decide between yourselves who takes
-- whom, and nothing in the app needs to know. Within one lane the old rule
-- still holds, so neither of you can be in two places at once.

create extension if not exists btree_gist;

alter table slots
  add column lane smallint not null default 1
  check (lane between 1 and 4);

alter table slots drop constraint slots_no_overlap;

alter table slots
  add constraint slots_no_overlap
  exclude using gist (lane with =, span with &&);

create index slots_lane_idx on slots (starts_at, lane);
