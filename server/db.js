"use strict";

const { Pool } = require("pg");
const { g1AxesFor, g2AxesFor, DEFAULT_POSITION, STATIONS } = require("./labels");
const { hashPassword } = require("./auth");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL, as provided by Vercel Postgres/Neon)."
  );
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL,
    level TEXT NOT NULL,
    emp_code TEXT NOT NULL,
    join_year TEXT NOT NULL,
    g1 JSONB NOT NULL,
    g2 JSONB NOT NULL,
    st JSONB NOT NULL,
    stat_today TEXT NOT NULL DEFAULT '',
    stat_qc TEXT NOT NULL DEFAULT '',
    stat_rework TEXT NOT NULL DEFAULT '',
    stat_defect TEXT NOT NULL DEFAULT ''
  );

  ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_quota_vacation INTEGER NOT NULL DEFAULT 10;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_quota_sick INTEGER NOT NULL DEFAULT 30;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_quota_personal INTEGER NOT NULL DEFAULT 6;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN NOT NULL DEFAULT false;

  -- Custom team membership: which employees a team-lead employee is allowed to assign/manage
  -- tasks for. Independent of position/line - admin picks members explicitly per lead.
  CREATE TABLE IF NOT EXISTS team_members (
    leader_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    PRIMARY KEY (leader_id, member_id)
  );
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '';

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    due TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT 'กลาง',
    axis_group TEXT,
    axis_index INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'กลาง';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS axis_group TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS axis_index INTEGER;

  CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    done BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    hazards JSONB NOT NULL DEFAULT '[]'
  );

  ALTER TABLE stations ADD COLUMN IF NOT EXISTS hazards JSONB NOT NULL DEFAULT '[]';

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    expiry TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Daily record of who worked which station and for how long; station proficiency hours
  -- are summed from these instead of being typed in directly.
  CREATE TABLE IF NOT EXISTS work_logs (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hours NUMERIC NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Assembly lines/teams. Each employee belongs to one; each shift-leader account is scoped to one.
  CREATE TABLE IF NOT EXISTS lines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE employees ADD COLUMN IF NOT EXISTS line_id TEXT REFERENCES lines(id);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    line_id TEXT REFERENCES lines(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE;

  -- Tracks one-off data migrations that have no reliable structural marker to guard on.
  CREATE TABLE IF NOT EXISTS schema_flags (
    key TEXT PRIMARY KEY,
    done_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const SEED_EMPLOYEES = [
  ["E1", "นายอภิเดช สุขดี", "MR. APIDACH SUKDEE", "ชาย", "Senior Assembly Operator", "Advance", "EMP-1042", "2019",
    [100, 100, 87, 91, 100, 100], [0, 0, 0, 0, 0, 0], [95, 88, 100, 92, 70, 100, 85, 90, 78, 95],
    "8/12", "3/15", "0/30", "1/30"],
  ["E2", "นางสาวมนัสนันท์ ใจดี", "MS. MANATNAN JAIDEE", "หญิง", "QC Inspector", "Expert", "EMP-0871", "2016",
    [100, 100, 100, 96, 100, 100], [0, 0, 0, 0, 0, 0], [80, 75, 95, 90, 88, 100, 80, 95, 96, 100],
    "11/12", "12/15", "0/30", "0/30"],
  ["E3", "นายกฤษณะ วงศ์ทอง", "MR. KRITSANA WONGTHONG", "ชาย", "Assembly Operator", "Basic", "EMP-1120", "2023",
    [85, 70, 72, 64, 90, 80], [0, 0, 0, 0, 0, 0], [60, 40, 75, 68, 30, 55, 70, 50, 45, 58],
    "5/12", "0/15", "2/30", "3/30"],
  ["E4", "นางสาวปวีณา แสงจันทร์", "MS. PAWEENA SANGCHAN", "หญิง", "Line Leader", "Expert", "EMP-0654", "2014",
    [100, 100, 98, 100, 100, 100], [0, 0, 0, 0, 0, 0], [92, 90, 100, 98, 85, 100, 90, 96, 94, 100],
    "12/12", "10/15", "0/30", "0/30"],
  ["E5", "นายธนากร รักงาน", "MR. THANAKORN RAKNGAN", "ชาย", "Assembly Operator", "Advance", "EMP-1005", "2020",
    [95, 92, 88, 84, 96, 90], [0, 0, 0, 0, 0, 0], [85, 80, 92, 88, 72, 90, 84, 88, 76, 90],
    "9/12", "4/15", "1/30", "1/30"],
  ["E6", "นางสาวศิริพร มั่นคง", "MS. SIRIPORN MANKONG", "หญิง", "QC Inspector", "Advance", "EMP-0990", "2021",
    [92, 96, 85, 88, 94, 92], [0, 0, 0, 0, 0, 0], [70, 65, 90, 86, 80, 96, 78, 90, 88, 92],
    "7/12", "8/15", "0/30", "1/30"],
  ["E7", "นายวิชัย ตั้งใจ", "MR. WICHAI TANGJAI", "ชาย", "Assembly Operator", "Basic", "EMP-1201", "2024",
    [78, 62, 66, 58, 84, 74], [0, 0, 0, 0, 0, 0], [50, 35, 66, 60, 25, 48, 62, 44, 40, 52],
    "4/12", "0/15", "3/30", "4/30"],
  ["E8", "นางสาวจิราภา ดวงแก้ว", "MS. JIRAPA DUANGKAEW", "หญิง", "Senior Assembly Operator", "Advance", "EMP-0888", "2018",
    [98, 94, 90, 88, 98, 96], [0, 0, 0, 0, 0, 0], [88, 84, 96, 92, 78, 94, 86, 92, 82, 94],
    "10/12", "6/15", "0/30", "0/30"],
];

const SEED_TASKS = {
  E1: [
    { id: "T1a", title: "อบรมสถานี Torque (ST-08)", due: "15 ส.ค.", progress: 60 },
    { id: "T1b", title: "ประกอบ 50 ชิ้น/วัน", due: "ทุกวัน", progress: 85 },
  ],
  E2: [
    { id: "T2a", title: "สอนงาน QC ให้พนักงานใหม่", due: "20 ส.ค.", progress: 100 },
    { id: "T2b", title: "ตรวจ Final 15 ล็อต", due: "10 ส.ค.", progress: 80 },
  ],
  E3: [{ id: "T3a", title: "ฝึกลดของเสียให้ต่ำกว่า 2%", due: "31 ส.ค.", progress: 40 }],
  E4: [
    { id: "T4a", title: "จัดตารางกำลังคน Line A", due: "12 ส.ค.", progress: 100 },
    { id: "T4b", title: "Kaizen ลด cycle time 10%", due: "30 ส.ค.", progress: 55 },
  ],
  E5: [{ id: "T5a", title: "ผ่านเกณฑ์สถานี Painting (ST-05)", due: "25 ส.ค.", progress: 70 }],
  E6: [{ id: "T6a", title: "ตรวจ Visual 100 ชิ้น/กะ", due: "ทุกวัน", progress: 90 }],
  E7: [{ id: "T7a", title: "อบรม Basic standard", due: "18 ส.ค.", progress: 30 }],
  E8: [{ id: "T8a", title: "Certify สถานี Assembly A", due: "22 ส.ค.", progress: 75 }],
};

const SEED_ATTENDANCE = {
  E3: [{ id: "A3a", type: "มาสาย", date: "2026-08-03", note: "รถติด" }],
  E5: [{ id: "A5a", type: "ลาป่วย", date: "2026-08-04", note: "ไข้หวัด" }],
  E6: [{ id: "A6a", type: "ลาพักร้อน", date: "2026-08-06", note: "" }],
  E7: [
    { id: "A7a", type: "ขาด", date: "2026-08-01", note: "ไม่แจ้งล่วงหน้า" },
    { id: "A7b", type: "ลากิจ", date: "2026-08-05", note: "ธุระครอบครัว" },
  ],
};

let readyPromise = null;

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);

    // Seed the stations table once; further station edits happen via the API.
    const stationCount = await client.query("SELECT COUNT(*)::int AS count FROM stations");
    if (stationCount.rows[0].count === 0) {
      for (let i = 0; i < STATIONS.length; i++) {
        const s = STATIONS[i];
        await client.query(
          "INSERT INTO stations (id, code, name, image, sort_order) VALUES ($1,$2,$3,'',$4) ON CONFLICT (id) DO NOTHING",
          [s.code, s.code, s.name, i]
        );
      }
    }
    const { rows: stationRows } = await client.query("SELECT id FROM stations ORDER BY sort_order");
    const stationIds = stationRows.map((r) => r.id);

    // Seed a default line once; every existing employee is backfilled onto it below.
    const lineCount = await client.query("SELECT COUNT(*)::int AS count FROM lines");
    if (lineCount.rows[0].count === 0) {
      await client.query("INSERT INTO lines (id, name, sort_order) VALUES ('LINE-A', 'Line A', 0)");
    }
    const { rows: firstLineRows } = await client.query("SELECT id FROM lines ORDER BY sort_order LIMIT 1");
    const defaultLineId = firstLineRows[0].id;
    await client.query("UPDATE employees SET line_id = $1 WHERE line_id IS NULL", [defaultLineId]);

    // Seed default login accounts once: one admin, one shift leader for the default line.
    // These use known default passwords — change them from the admin accounts screen right away.
    const userCount = await client.query("SELECT COUNT(*)::int AS count FROM users");
    if (userCount.rows[0].count === 0) {
      const adminHash = await hashPassword("Admin@2026!");
      const leaderHash = await hashPassword("Leader@2026!");
      await client.query(
        "INSERT INTO users (id, username, password_hash, role, line_id, display_name) VALUES ($1,$2,$3,$4,$5,$6)",
        ["U-admin", "admin", adminHash, "admin", null, "ผู้ดูแลระบบ"]
      );
      await client.query(
        "INSERT INTO users (id, username, password_hash, role, line_id, display_name) VALUES ($1,$2,$3,$4,$5,$6)",
        ["U-leaderA", "leaderA", leaderHash, "shift_leader", defaultLineId, "หัวหน้า Line A"]
      );
    }

    // One-time migration: employees.st used to be a positional array; it's now an object keyed by station id.
    const { rows: empRows } = await client.query("SELECT id, st FROM employees");
    for (const row of empRows) {
      if (Array.isArray(row.st)) {
        const obj = {};
        stationIds.forEach((id, i) => { obj[id] = row.st[i] ?? 0; });
        await client.query("UPDATE employees SET st = $1 WHERE id = $2", [JSON.stringify(obj), row.id]);
      }
    }

    // One-time migration: station proficiency (st) used to be a 0-100 "skill %" per station;
    // it's now accumulated work hours mapped to a None/Basic/Skilled/Expert tier, so old
    // percentage values can't carry over — reset everyone's station values to 0 hours.
    const stHoursFlag = await client.query("SELECT 1 FROM schema_flags WHERE key = 'st_hours_reset'");
    if (stHoursFlag.rows.length === 0) {
      await client.query("UPDATE employees SET st = '{}'::jsonb");
      await client.query("INSERT INTO schema_flags (key) VALUES ('st_hours_reset') ON CONFLICT DO NOTHING");
    }

    // One-time migration: each station value used to be a plain hours number; it's now
    // { hours, trained } so a station can require passing basic training before any work
    // hours count toward Skilled/Expert. Wrap any lingering plain numbers into that shape.
    const stGateFlag = await client.query("SELECT 1 FROM schema_flags WHERE key = 'st_trained_gate'");
    if (stGateFlag.rows.length === 0) {
      const { rows: stEntryRows } = await client.query("SELECT id, st FROM employees");
      for (const row of stEntryRows) {
        const st = row.st || {};
        let changed = false;
        const next = {};
        for (const [sid, v] of Object.entries(st)) {
          if (typeof v === "number") {
            next[sid] = { hours: v, trained: v > 0 };
            changed = true;
          } else {
            next[sid] = v;
          }
        }
        if (changed) await client.query("UPDATE employees SET st = $1 WHERE id = $2", [JSON.stringify(next), row.id]);
      }
      await client.query("INSERT INTO schema_flags (key) VALUES ('st_trained_gate') ON CONFLICT DO NOTHING");
    }

    // One-time migration: station hours used to be typed directly into an employee's profile;
    // they're now summed from work_logs (daily "who worked which station, how many hours"
    // entries) so the number reflects actual logged work. Carry over any existing hours as a
    // one-off "ยอดยกมา" log entry, then drop hours from st (only { trained } remains there).
    const workLogSeedFlag = await client.query("SELECT 1 FROM schema_flags WHERE key = 'work_logs_seeded_from_st_hours'");
    if (workLogSeedFlag.rows.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { rows: stHourRows } = await client.query("SELECT id, st FROM employees");
      for (const row of stHourRows) {
        const st = row.st || {};
        const next = {};
        for (const [sid, entry] of Object.entries(st)) {
          const hours = entry && typeof entry === "object" ? Number(entry.hours) || 0 : 0;
          const trained = !!(entry && typeof entry === "object" && entry.trained);
          if (hours > 0 && stationIds.includes(sid)) {
            await client.query(
              "INSERT INTO work_logs (id, employee_id, station_id, date, hours, note) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
              [`WLSEED-${row.id}-${sid}`, row.id, sid, today, hours, "ยอดยกมา"]
            );
          }
          if (stationIds.includes(sid)) next[sid] = { trained };
        }
        await client.query("UPDATE employees SET st = $1 WHERE id = $2", [JSON.stringify(next), row.id]);
      }
      await client.query("INSERT INTO schema_flags (key) VALUES ('work_logs_seeded_from_st_hours') ON CONFLICT DO NOTHING");
    }

    // One-time migration: %Skill judgment axes were replaced with a different, unrelated set of
    // categories, so old scores can't carry over — reset g2 to zeros sized to the new axis count.
    const { rows: g2Rows } = await client.query("SELECT id, g2 FROM employees");
    for (const row of g2Rows) {
      if (!Array.isArray(row.g2) || row.g2.length !== g2AxesFor(DEFAULT_POSITION).length) {
        await client.query("UPDATE employees SET g2 = $1 WHERE id = $2", [JSON.stringify(g2AxesFor(DEFAULT_POSITION).map(() => 0)), row.id]);
      }
    }

    // One-time migration: both axis sets were replaced with position-specific ones (Material
    // Handler / Cert Forklift / Shift Leader each measure genuinely different things now), so old
    // scores can't carry over even though the axis count is still 6 either way — reset everyone.
    const posAxisFlag = await client.query("SELECT 1 FROM schema_flags WHERE key = 'g1_g2_position_specific_reset'");
    if (posAxisFlag.rows.length === 0) {
      const { rows: empPosRows } = await client.query("SELECT id, position FROM employees");
      for (const row of empPosRows) {
        const zerosG1 = g1AxesFor(row.position).map(() => 0);
        const zerosG2 = g2AxesFor(row.position).map(() => 0);
        await client.query("UPDATE employees SET g1 = $1, g2 = $2 WHERE id = $3", [JSON.stringify(zerosG1), JSON.stringify(zerosG2), row.id]);
      }
      await client.query("INSERT INTO schema_flags (key) VALUES ('g1_g2_position_specific_reset') ON CONFLICT DO NOTHING");
    }

    // One-time migration: tasks used to belong to exactly one employee (employee_id + progress%);
    // they're now shared via task_assignments so a task can have multiple assignees, each with
    // their own done flag.
    const { rows: taskColCheck } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'employee_id'"
    );
    if (taskColCheck.length) {
      const { rows: oldTasks } = await client.query("SELECT id, employee_id, progress FROM tasks");
      for (const t of oldTasks) {
        await client.query(
          "INSERT INTO task_assignments (id, task_id, employee_id, done) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
          ["TA" + t.id, t.id, t.employee_id, t.progress >= 100]
        );
      }
      await client.query("ALTER TABLE tasks DROP COLUMN IF EXISTS employee_id");
      await client.query("ALTER TABLE tasks DROP COLUMN IF EXISTS progress");
    }

    const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM employees");
    if (rows[0].count > 0) return;

    await client.query("BEGIN");
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const row of SEED_EMPLOYEES) {
        const [id, name, nameEn, gender, position, level, empCode, joinYear, g1, g2, st, statToday, statQc, statRework, statDefect] = row;
        if (g1.length !== g1AxesFor(position).length || g2.length !== g2AxesFor(position).length || st.length !== stationIds.length) {
          throw new Error(`Seed data for ${id} has mismatched axis/station counts`);
        }
        const stObj = {};
        // Seed data historically stored 0-100 proficiency percentages; scale to plausible work hours
        // and record them as a seed work-log entry, since hours are now summed from work_logs.
        const seedStationHours = [];
        stationIds.forEach((sid, i) => {
          const hours = Math.round(st[i] * 3.2);
          stObj[sid] = { trained: hours > 0 };
          if (hours > 0) seedStationHours.push([sid, hours]);
        });
        await client.query(
          `INSERT INTO employees (id, name, name_en, gender, position, level, emp_code, join_year, g1, g2, st, stat_today, stat_qc, stat_rework, stat_defect, line_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [id, name, nameEn, gender, position, level, empCode, joinYear, JSON.stringify(g1), JSON.stringify(g2), JSON.stringify(stObj), statToday, statQc, statRework, statDefect, defaultLineId]
        );
        for (const [sid, hours] of seedStationHours) {
          await client.query(
            "INSERT INTO work_logs (id, employee_id, station_id, date, hours, note) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
            [`WLSEED-${id}-${sid}`, id, sid, todayStr, hours, "ยอดยกมา"]
          );
        }
        for (const t of SEED_TASKS[id] || []) {
          await client.query(
            "INSERT INTO tasks (id, title, due, level) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
            [t.id, t.title, t.due, t.level || "กลาง"]
          );
          await client.query(
            "INSERT INTO task_assignments (id, task_id, employee_id, done) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
            ["TA" + t.id, t.id, id, t.progress >= 100]
          );
        }
        for (const a of SEED_ATTENDANCE[id] || []) {
          await client.query(
            "INSERT INTO attendance (id, employee_id, type, date, note) VALUES ($1,$2,$3,$4,$5)",
            [a.id, id, a.type, a.date, a.note]
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

function ready() {
  if (!readyPromise) readyPromise = ensureSchema();
  return readyPromise;
}

module.exports = { pool, ready };
