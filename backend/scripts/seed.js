// Adds the starter curriculum (Years -> Modules) without overwriting anything that already exists.
//
// "Modules" are stored as `blocks` records (Year -> Module -> Note). Notes are uploaded into a module
// from Admin -> Subject notes, and every student whose subscription covers that year can read them.
//
// One-time tidy-up for databases created before the module layout: the old starter blocks
// (block-d ... block-l) are hidden from students if nothing was ever uploaded into them. A legacy block
// that already holds uploaded notes is left exactly as it is, and is listed below so you can decide.
const pool = require("../db");
const records = require("../curriculum-seed.json");

const LEGACY_BLOCKS = [
  "block-d", "block-e", "block-f", "block-g", "block-h", "block-i", "block-j", "block-k", "block-l",
];
const MARKER_ID = "curriculumModulesV1";

(async () => {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    for (const r of records)
      await db.query(
        "INSERT INTO records(collection,id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [r.collection, r.id, r.data],
      );

    const done = await db.query(
      "SELECT 1 FROM records WHERE collection='settings' AND id=$1",
      [MARKER_ID],
    );
    const kept = [];
    const hidden = [];
    if (!done.rows.length) {
      for (const blockId of LEGACY_BLOCKS) {
        const block = await db.query(
          "SELECT 1 FROM records WHERE collection='blocks' AND id=$1",
          [blockId],
        );
        if (!block.rows.length) continue;
        const withNotes = await db.query(
          `SELECT 1 FROM records s JOIN records c ON c.collection='subjectContent' AND c.id=s.id
           WHERE s.collection='subjects' AND s.data->>'blockId'=$1 LIMIT 1`,
          [blockId],
        );
        if (withNotes.rows.length) {
          kept.push(blockId);
          continue;
        }
        await db.query(
          "UPDATE records SET data=data || '{\"published\":false}'::jsonb, updated_at=now() WHERE collection='blocks' AND id=$1",
          [blockId],
        );
        await db.query(
          "UPDATE records SET data=data || '{\"published\":false}'::jsonb, updated_at=now() WHERE collection='subjects' AND data->>'blockId'=$1",
          [blockId],
        );
        hidden.push(blockId);
      }
      await db.query(
        "INSERT INTO records(collection,id,data) VALUES('settings',$1,$2) ON CONFLICT DO NOTHING",
        [MARKER_ID, { appliedAt: new Date().toISOString(), hidden, kept }],
      );
    }
    await db.query("COMMIT");
    console.log("Starter curriculum (Years and Modules) added; existing records preserved.");
    if (hidden.length)
      console.log("Old empty starter blocks hidden from students: " + hidden.join(", "));
    if (kept.length)
      console.log(
        "Old blocks that already contain uploaded notes were left unchanged: " + kept.join(", ") +
          ". Re-upload those notes into the matching module in Admin, then unpublish the old block.",
      );
    console.log("Upload and publish notes in Admin -> Subject notes.");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
