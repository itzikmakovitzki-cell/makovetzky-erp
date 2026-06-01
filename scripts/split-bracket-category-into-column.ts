// One-shot data fix: tasks and templates that were imported with the category
// embedded as `[xxx] name` (PR #33) get split into the `category` column +
// clean `name`. After this runs the Block-13 "סיווג" table column will show
// the value instead of dashes.
//
// Uses raw SQL because per-row Prisma updates timed out the implicit
// transaction (164 rows × eu-central-1 RTT). Idempotent — the WHERE clause
// only matches rows that still have a `[xxx]` prefix, and COALESCE never
// overwrites a manually-set category.
//
// Usage:  npx tsx scripts/split-bracket-category-into-column.ts
//         npx tsx scripts/split-bracket-category-into-column.ts --dry-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TASK_UPDATE = `
  UPDATE "Task"
  SET
    category = COALESCE(NULLIF(category, ''), substring(name from '^\\s*\\[([^\\]]+)\\]')),
    name     = regexp_replace(name, '^\\s*\\[[^\\]]+\\]\\s*', '')
  WHERE name ~ '^\\s*\\[[^\\]]+\\]\\s*\\S'
    AND "deletedAt" IS NULL
`;

const TEMPLATE_UPDATE = `
  UPDATE "TaskTemplate"
  SET
    category = COALESCE(NULLIF(category, ''), substring(name from '^\\s*\\[([^\\]]+)\\]')),
    name     = regexp_replace(name, '^\\s*\\[[^\\]]+\\]\\s*', '')
  WHERE name ~ '^\\s*\\[[^\\]]+\\]\\s*\\S'
`;

async function countCandidates() {
  const tasks = await prisma.task.count({
    where: { deletedAt: null, name: { startsWith: "[" } }
  });
  const templates = await prisma.taskTemplate.count({
    where: { name: { startsWith: "[" } }
  });
  return { tasks, templates };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "(dry-run)" : "(committing)");

  const before = await countCandidates();
  console.log(`Before:  Task rows starting with '['  = ${before.tasks}`);
  console.log(`         Template rows starting with '['  = ${before.templates}`);

  if (dryRun) {
    console.log("\n(dry-run — no DB writes)");
    return;
  }

  const taskRows = await prisma.$executeRawUnsafe(TASK_UPDATE);
  const templateRows = await prisma.$executeRawUnsafe(TEMPLATE_UPDATE);
  console.log(`\nUpdated:  Tasks      = ${taskRows}`);
  console.log(`          Templates  = ${templateRows}`);

  const after = await countCandidates();
  console.log(`\nAfter:   Task rows starting with '['  = ${after.tasks}`);
  console.log(`         Template rows starting with '['  = ${after.templates}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
