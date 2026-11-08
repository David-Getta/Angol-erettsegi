/** Lists inbox submissions without feedback – used by /javitas. */
import { pendingInbox, readInboxFile } from "@/lib/exchange/files";

const ids = pendingInbox();
if (!ids.length) console.log("Nincs javításra váró beadás az exchange/inbox/-ban.");
for (const id of ids) {
  const s = readInboxFile(id);
  console.log(s ? `${id}  ${s.kind}  ${s.level}  v${s.version}  ${s.wordCount} szó  ${s.task.title}` : `${id}  (hibás fájl)`);
}
