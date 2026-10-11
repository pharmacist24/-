// Seed the database from the imported Excel dataset (177 drug records).
// Usage: bun run scripts/seed-drugs.ts
// Idempotent: upserts by id, so re-running updates rather than duplicating.
import { db } from "../src/lib/db";
import { SEED_DRUGS } from "../src/lib/drug-data";

async function main() {
  console.log(`Seeding ${SEED_DRUGS.length} drugs into the database...`);

  for (const drug of SEED_DRUGS) {
    await db.drug.upsert({
      where: { id: drug.id },
      create: {
        id: drug.id,
        item: drug.item,
        genericName: drug.genericName,
        dosageForm: drug.dosageForm,
        unitPrice: drug.unitPrice,
        company: drug.company,
        priceOfPack: drug.priceOfPack,
        noOfTabPerPack: drug.noOfTabPerPack,
      },
      update: {
        item: drug.item,
        genericName: drug.genericName,
        dosageForm: drug.dosageForm,
        unitPrice: drug.unitPrice,
        company: drug.company,
        priceOfPack: drug.priceOfPack,
        noOfTabPerPack: drug.noOfTabPerPack,
      },
    });
  }

  const total = await db.drug.count();
  console.log(
    `Done. Upserted ${SEED_DRUGS.length} drugs. Total in DB: ${total}`
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
