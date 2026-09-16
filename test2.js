const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE plays (vid TEXT, game_id TEXT, created_at TEXT)");
  db.run("CREATE TABLE sessions (vid TEXT, game_id TEXT, duration INTEGER, created_at TEXT)");

  // Player joined 2 days ago
  db.run("INSERT INTO plays VALUES ('u1', 'g1', date('now', '-2 days') || ' 10:00:00')");
  // Returned 1 day ago (Day 1)
  db.run("INSERT INTO sessions VALUES ('u1', 'g1', 60, date('now', '-1 days') || ' 12:00:00')");
  // Returned today (Day 2)
  db.run("INSERT INTO sessions VALUES ('u1', 'g1', 60, date('now') || ' 12:00:00')");

  // Player joined yesterday
  db.run("INSERT INTO plays VALUES ('u2', 'g1', date('now', '-1 days') || ' 10:00:00')");
  // Returned today (Day 1)
  db.run("INSERT INTO sessions VALUES ('u2', 'g1', 60, date('now') || ' 12:00:00')");

  // Player joined today (not eligible for D1)
  db.run("INSERT INTO plays VALUES ('u3', 'g1', date('now') || ' 10:00:00')");

  // Player joined 8 days ago
  db.run("INSERT INTO plays VALUES ('u4', 'g1', date('now', '-8 days') || ' 10:00:00')");
  // Returned 1 day ago (Day 7)
  db.run("INSERT INTO sessions VALUES ('u4', 'g1', 60, date('now', '-1 days') || ' 12:00:00')");

  const sql = `
      SELECT 
        p.game_id,
        COUNT(DISTINCT p.vid) AS total_cohort_size,
        COUNT(DISTINCT CASE WHEN date(p.created_at) <= date('now', '-1 day') THEN p.vid END) AS d1_cohort_size,
        COUNT(DISTINCT CASE WHEN date(p.created_at) <= date('now', '-7 days') THEN p.vid END) AS d7_cohort_size,
        COUNT(DISTINCT CASE WHEN date(s.created_at) = date(p.created_at, '+1 day') THEN s.vid END) AS d1_returns,
        COUNT(DISTINCT CASE WHEN date(s.created_at) = date(p.created_at, '+7 days') THEN s.vid END) AS d7_returns
      FROM plays p
      LEFT JOIN sessions s ON p.vid = s.vid AND p.game_id = s.game_id
      GROUP BY p.game_id
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(JSON.stringify(rows, null, 2));
  });
});
