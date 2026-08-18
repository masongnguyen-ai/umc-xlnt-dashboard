-- Vận hành XLNT: nhân sự, hóa chất, nhật ký sửa số, bản sao lưu.
-- Không chứa dữ liệu lưu lượng — lưu lượng chỉ đọc sheet công khai.

create table if not exists app_staff (
  user_id       text primary key,
  auth_user_id  text,
  email         text not null unique,
  ho_ten        text not null,
  so_dien_thoai text not null default '',
  don_vi        text not null default '',
  ghi_chu       text not null default '',
  vai_tro       text not null,
  trang_thai    text not null default 'HOAT_DONG',
  ngay_tao      text not null,
  ngay_sua      timestamptz not null default now()
);
create index if not exists app_staff_auth_user_id_idx on app_staff (auth_user_id);

create table if not exists chem_imports (
  thang         text primary key,
  receipts_json text not null,
  qty_json      text not null,
  locked        boolean not null default false,
  actor_email   text not null,
  actor_role    text not null,
  note          text not null default '',
  at            timestamptz not null default now()
);

create table if not exists chem_doses (
  iso           text primary key,
  qty_json      text not null,
  actor_email   text not null,
  actor_role    text not null,
  note          text not null default '',
  at            timestamptz not null default now()
);

create table if not exists chem_restocks (
  id            text primary key,
  qty_json      text not null,
  actor_email   text not null,
  reason        text not null default '',
  status        text not null default 'MOI',
  at            timestamptz not null default now()
);

create table if not exists chem_transactions (
  tx_id           text primary key,
  ma_hoa_chat     text not null,
  loai_giao_dich  text not null,
  so_luong        double precision not null,
  lo_san_xuat     text not null default '',
  han_su_dung     text not null default '',
  ngay_thuc_hien  text not null,
  ghi_chu         text not null default '',
  nguoi_tao       text not null,
  ngay_tao        timestamptz not null default now()
);

create table if not exists chem_stocks (
  ma_hoa_chat     text primary key,
  ton_kho         double precision not null default 0,
  ngay_cap_nhat   timestamptz not null default now()
);

create table if not exists audit_events (
  id            text primary key,
  at            timestamptz not null default now(),
  actor_email   text not null,
  actor_role    text not null,
  action        text not null,
  entity        text not null,
  entity_id     text not null,
  before_json   text not null default 'null',
  after_json    text not null default 'null'
);
create index if not exists audit_events_at_idx on audit_events (at desc);
create index if not exists audit_events_entity_idx on audit_events (entity, entity_id);

create table if not exists data_backups (
  id            text primary key,
  at            timestamptz not null default now(),
  actor_email   text not null,
  kind          text not null,
  payload_json  text not null
);
create index if not exists data_backups_at_idx on data_backups (at desc);
