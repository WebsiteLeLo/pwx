import { db, siteSettingsTable } from "@workspace/db";
async function run() {
  console.log(await db.select().from(siteSettingsTable));
}
run();
