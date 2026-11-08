import { getDb, closeDb } from "@/lib/db/client";
import { paths, rel } from "@/lib/paths";

getDb();
closeDb();
console.log(`Adatbázis naprakész: ${rel(paths.db)}`);
