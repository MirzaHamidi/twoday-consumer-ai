const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE plays (vid TEXT, game_id TEXT, created_at TEXT)");
  db.run("CREATE TABLE sessions (vid TEXT, game_id TEXT, duration INTEGER, created_at TEXT)");

  db.run("INSERT INTO plays VALUES ('user1', 'game1', '2026-08-24 10:00:00')");
  db.run("INSERT INTO plays VALUES ('user2', 'game1', '2026-08-24 10:00:00')");
  db.run("INSERT INTO plays VALUES ('user3', 'game1', '2026-08-25 10:00:00')"); // today

  // user1 comes back on 25th (Day 1)
  db.run("INSERT INTO sessions VALUES ('user1', 'game1', 60, '2026-08-25 12:00:00')");
  // user1 comes back on 31st (Day 7)
  db.run("INSERT INTO sessions VALUES ('user1', 'game1', 60, '2026-08-31 12:00:00')");
  
  // user2 doesn't come back

  const sql = `
      SELECT 
        p.game_id,
        COUNT(DISTINCT p.vid) AS cohort_size,
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
    console.log(rows);
  });
});
