-- Bản vẽ CAD / DXF của trạm — dùng chung, không theo từng user.

create table if not exists cad_drawings (
  id            text primary key,
  name          text not null,
  kind          text not null,
  he_thong      text not null default 'CHUNG',
  file_name     text not null default '',
  drive_url     text not null default '',
  dxf_text      text not null default '',
  entity_count  integer not null default 0,
  pins_json     text not null default '[]',
  actor_email   text not null,
  actor_role    text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cad_drawings_updated_idx on cad_drawings (updated_at desc);
