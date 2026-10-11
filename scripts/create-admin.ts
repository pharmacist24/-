// Create or update the bootstrap admin account.
// Usage: bun run scripts/create-admin.ts
//
// This is the ONLY way to create an admin account — public signup is
// pharmacist-only. Run this once to set up your admin login, then keep
// the credentials private.
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@mediprice.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MediPrice_Admin_2026!";
const ADMIN_NAME = "Administrator";
const ADMIN_FLOOR = "10";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      floor: ADMIN_FLOOR,
      role: "admin",
    },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: "admin",
      floor: ADMIN_FLOOR,
    },
  });

  console.log("Admin account ready:");
  console.log("  Email:", user.email);
  console.log("  Password:", ADMIN_PASSWORD);
  console.log("  Floor:", user.floor);
  console.log("  Role:", user.role);
  console.log("");
  console.log("⚠️  Change this password after first login.");
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
