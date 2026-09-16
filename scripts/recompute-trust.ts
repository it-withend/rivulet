import { supabaseAdmin } from "../src/lib/db/client";
import { recomputeTrust } from "../src/lib/trust/recompute";

async function main() {
  const db = supabaseAdmin();

  const { data: observers, error } = await db.from("observers").select("id");
  if (error) {
    throw new Error(`could not list observers: ${error.message}`);
  }

  const ids = (observers ?? []).map((o) => o.id as string);
  console.log(`Recomputing trust for ${ids.length} observers...`);

  // One recompute per observer keeps memory bounded and each observer's
  // update independent; recomputeTrust already batches the queries it needs
  // for the ids it is given, so pass them all at once.
  await recomputeTrust(db, ids);

  console.log("Trust recompute complete");
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
