"use strict";

const { pool } = require("./db");

async function fetchTeamMemberIds(leaderId) {
  if (!leaderId) return [];
  const { rows } = await pool.query("SELECT member_id FROM team_members WHERE leader_id = $1", [leaderId]);
  return rows.map((r) => r.member_id);
}

async function isTeamLead(employeeId) {
  if (!employeeId) return false;
  const { rows } = await pool.query("SELECT is_team_lead FROM employees WHERE id = $1", [employeeId]);
  return !!(rows[0] && rows[0].is_team_lead);
}

// Replaces a leader's whole member list in one go (self-references are dropped).
async function syncTeamMembers(leaderId, memberIds) {
  await pool.query("DELETE FROM team_members WHERE leader_id = $1", [leaderId]);
  const ids = [...new Set(memberIds)].filter((id) => id !== leaderId);
  if (!ids.length) return;
  const values = ids.map((_, i) => `($1, $${i + 2})`).join(",");
  await pool.query(`INSERT INTO team_members (leader_id, member_id) VALUES ${values}`, [leaderId, ...ids]);
}

module.exports = { fetchTeamMemberIds, isTeamLead, syncTeamMembers };
