import { dbSource, getSql } from "@/lib/db";
import { DEV_USER_ID, UnauthorizedError } from "@/lib/auth/verify.server";
import { can, type Action } from "@/lib/permissions";
import { SEED_USERS } from "@/lib/seed";
import type { AppUserRecord, Role, UserStatus } from "@/lib/types";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class StaffBlockedError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "StaffBlockedError";
  }
}

type StaffRow = {
  user_id: string;
  auth_user_id: string | null;
  email: string;
  ho_ten: string;
  so_dien_thoai: string;
  don_vi: string;
  ghi_chu: string;
  vai_tro: string;
  trang_thai: string;
  ngay_tao: string;
};

function toRecord(row: StaffRow): AppUserRecord {
  return {
    User_ID: row.user_id,
    Email: row.email,
    Ho_ten: row.ho_ten,
    So_dien_thoai: row.so_dien_thoai,
    Don_vi: row.don_vi,
    Ghi_chu: row.ghi_chu,
    Vai_tro: row.vai_tro as Role,
    Trang_thai: row.trang_thai as UserStatus,
    Ngay_tao: row.ngay_tao,
  };
}

async function seedStaff() {
  const sql = await getSql();
  for (const u of SEED_USERS) {
    await sql`
      insert into app_staff (
        user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
      ) values (
        ${u.User_ID}, ${u.Email.toLowerCase()}, ${u.Ho_ten}, ${u.So_dien_thoai},
        ${u.Don_vi}, ${u.Ghi_chu}, ${u.Vai_tro}, ${u.Trang_thai}, ${u.Ngay_tao}
      )
      on conflict (email) do nothing
    `;
  }
}

async function emailFor(authUserId: string): Promise<{ email: string; name: string }> {
  if (authUserId === DEV_USER_ID) {
    return { email: "dev@example.com", name: "Dev User" };
  }
  const sql = await getSql();
  const rows = await sql<{ email: string; name: string }>`
    select email, name from "user" where id = ${authUserId}
  `;
  const row = rows[0];
  if (!row?.email) throw new UnauthorizedError();
  return { email: row.email.toLowerCase().trim(), name: row.name || row.email };
}

export async function listStaff(): Promise<AppUserRecord[]> {
  await seedStaff();
  const sql = await getSql();
  const rows = await sql<StaffRow>`
    select user_id, auth_user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
    from app_staff
    order by ngay_tao, email
  `;
  return rows.map(toRecord);
}

export async function resolveStaff(authUserId: string): Promise<AppUserRecord> {
  await seedStaff();
  const sql = await getSql();
  const { email, name } = await emailFor(authUserId);

  const found = await sql<StaffRow>`
    select user_id, auth_user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
    from app_staff where email = ${email}
  `;
  let row = found[0];

  if (!row) {
    if (dbSource !== "pglite" && authUserId !== DEV_USER_ID) {
      throw new StaffBlockedError(
        "Tài khoản Google chưa được cấp trên hệ thống. Liên hệ quản lý để thêm email vào danh sách ca trực / nhà thầu.",
      );
    }
    const id = `USR-BOOT-${authUserId.slice(0, 8)}`;
    await sql`
      insert into app_staff (
        user_id, auth_user_id, email, ho_ten, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
      ) values (
        ${id}, ${authUserId}, ${email}, ${name},
        ${"Bệnh viện Đại học Y Dược TP.HCM"},
        ${"Tự cấp lần đầu trên máy xem trước — đổi vai trò trong Quản trị"},
        ${"QUAN_LY"}, ${"HOAT_DONG"}, ${new Date().toISOString().slice(0, 10)}
      )
      on conflict (email) do nothing
    `;
    const again = await sql<StaffRow>`
      select user_id, auth_user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
      from app_staff where email = ${email}
    `;
    row = again[0];
  }

  if (!row) {
    throw new StaffBlockedError("Không tạo được hồ sơ nhân sự.");
  }

  if (row.trang_thai === "TAM_KHOA") {
    throw new StaffBlockedError("Tài khoản đang tạm khóa. Liên hệ quản lý.");
  }
  if (row.trang_thai === "NGUNG") {
    throw new StaffBlockedError("Tài khoản đã ngừng trên hệ thống này.");
  }
  if (row.trang_thai !== "HOAT_DONG") {
    throw new StaffBlockedError(`Trạng thái tài khoản không hợp lệ (${row.trang_thai}).`);
  }

  if (row.auth_user_id !== authUserId) {
    await sql`update app_staff set auth_user_id = ${authUserId}, ngay_sua = now() where email = ${email}`;
  }

  return toRecord(row);
}

export async function requireAction(authUserId: string, action: Action): Promise<AppUserRecord> {
  const staff = await resolveStaff(authUserId);
  if (!can(staff.Vai_tro, action)) {
    throw new ForbiddenError(`Vai trò ${staff.Vai_tro} không được phép (${action}).`);
  }
  return staff;
}

export async function upsertStaff(authUserId: string, rec: AppUserRecord): Promise<AppUserRecord> {
  await requireAction(authUserId, "write_quantri");
  const sql = await getSql();
  const email = rec.Email.toLowerCase().trim();
  const id = rec.User_ID || `USR-${Date.now()}`;
  const ngay = rec.Ngay_tao || new Date().toISOString().slice(0, 10);
  await sql`
    insert into app_staff (
      user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
    ) values (
      ${id}, ${email}, ${rec.Ho_ten.trim()}, ${rec.So_dien_thoai ?? ""},
      ${rec.Don_vi ?? ""}, ${rec.Ghi_chu ?? ""}, ${rec.Vai_tro}, ${rec.Trang_thai}, ${ngay}
    )
    on conflict (email) do update set
      ho_ten = excluded.ho_ten,
      so_dien_thoai = excluded.so_dien_thoai,
      don_vi = excluded.don_vi,
      ghi_chu = excluded.ghi_chu,
      vai_tro = excluded.vai_tro,
      trang_thai = excluded.trang_thai,
      ngay_sua = now()
  `;
  const rows = await sql<StaffRow>`
    select user_id, auth_user_id, email, ho_ten, so_dien_thoai, don_vi, ghi_chu, vai_tro, trang_thai, ngay_tao
    from app_staff where email = ${email}
  `;
  if (!rows[0]) throw new Error("Không lưu được tài khoản.");
  return toRecord(rows[0]);
}
