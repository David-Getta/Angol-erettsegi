/** Writes exchange/vocab/incomplete.json from the database (used by /szokincs). */
import { writeIncompleteRequests, vocabExchange } from "@/lib/vocab/cards";
import { closeDb } from "@/lib/db/client";
import { rel } from "@/lib/paths";

const n = writeIncompleteRequests();
closeDb();
console.log(`${n} hiányos szó → ${rel(vocabExchange.requests())}`);
