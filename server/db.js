"use strict";

const { Pool } = require("pg");
const { G1_AXES, G2_AXES, STATIONS } = require("./labels");

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

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const SEED_EMPLOYEES = [
  ["E1", "นายอภิเดช สุขดี", "MR. APIDACH SUKDEE", "ชาย", "Senior Assembly Operator", "Advance", "EMP-1042", "2019",
    [100, 100, 87, 91, 100, 100], [94, 94, 76, 94, 94], [95, 88, 100, 92, 70, 100, 85, 90, 78, 95],
    "8/12", "3/15", "0/30", "1/30"],
  ["E2", "นางสาวมนัสนันท์ ใจดี", "MS. MANATNAN JAIDEE", "หญิง", "QC Inspector", "Expert", "EMP-0871", "2016",
    [100, 100, 100, 96, 100, 100], [100, 98, 92, 100, 96], [80, 75, 95, 90, 88, 100, 80, 95, 96, 100],
    "11/12", "12/15", "0/30", "0/30"],
  ["E3", "นายกฤษณะ วงศ์ทอง", "MR. KRITSANA WONGTHONG", "ชาย", "Assembly Operator", "Basic", "EMP-1120", "2023",
    [85, 70, 72, 64, 90, 80], [70, 68, 60, 72, 66], [60, 40, 75, 68, 30, 55, 70, 50, 45, 58],
    "5/12", "0/15", "2/30", "3/30"],
  ["E4", "นางสาวปวีณา แสงจันทร์", "MS. PAWEENA SANGCHAN", "หญิง", "Line Leader", "Expert", "EMP-0654", "2014",
    [100, 100, 98, 100, 100, 100], [98, 100, 90, 96, 100], [92, 90, 100, 98, 85, 100, 90, 96, 94, 100],
    "12/12", "10/15", "0/30", "0/30"],
  ["E5", "นายธนากร รักงาน", "MR. THANAKORN RAKNGAN", "ชาย", "Assembly Operator", "Advance", "EMP-1005", "2020",
    [95, 92, 88, 84, 96, 90], [90, 88, 80, 86, 90], [85, 80, 92, 88, 72, 90, 84, 88, 76, 90],
    "9/12", "4/15", "1/30", "1/30"],
  ["E6", "นางสาวศิริพร มั่นคง", "MS. SIRIPORN MANKONG", "หญิง", "QC Inspector", "Advance", "EMP-0990", "2021",
    [92, 96, 85, 88, 94, 92], [92, 90, 82, 90, 88], [70, 65, 90, 86, 80, 96, 78, 90, 88, 92],
    "7/12", "8/15", "0/30", "1/30"],
  ["E7", "นายวิชัย ตั้งใจ", "MR. WICHAI TANGJAI", "ชาย", "Assembly Operator", "Basic", "EMP-1201", "2024",
    [78, 62, 66, 58, 84, 74], [64, 60, 55, 66, 62], [50, 35, 66, 60, 25, 48, 62, 44, 40, 52],
    "4/12", "0/15", "3/30", "4/30"],
  ["E8", "นางสาวจิราภา ดวงแก้ว", "MS. JIRAPA DUANGKAEW", "หญิง", "Senior Assembly Operator", "Advance", "EMP-0888", "2018",
    [98, 94, 90, 88, 98, 96], [92, 94, 84, 90, 92], [88, 84, 96, 92, 78, 94, 86, 92, 82, 94],
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
    const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM employees");
    if (rows[0].count > 0) return;

    await client.query("BEGIN");
    try {
      for (const row of SEED_EMPLOYEES) {
        const [id, name, nameEn, gender, position, level, empCode, joinYear, g1, g2, st, statToday, statQc, statRework, statDefect] = row;
        if (g1.length !== G1_AXES.length || g2.length !== G2_AXES.length || st.length !== STATIONS.length) {
          throw new Error(`Seed data for ${id} has mismatched axis/station counts`);
        }
        await client.query(
          `INSERT INTO employees (id, name, name_en, gender, position, level, emp_code, join_year, g1, g2, st, stat_today, stat_qc, stat_rework, stat_defect)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [id, name, nameEn, gender, position, level, empCode, joinYear, JSON.stringify(g1), JSON.stringify(g2), JSON.stringify(st), statToday, statQc, statRework, statDefect]
        );
        for (const t of SEED_TASKS[id] || []) {
          await client.query(
            "INSERT INTO tasks (id, employee_id, title, due, progress) VALUES ($1,$2,$3,$4,$5)",
            [t.id, id, t.title, t.due, t.progress]
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
