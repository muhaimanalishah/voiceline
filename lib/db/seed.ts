// lib/db/seed.ts
import { db } from "@/lib/db/db";
import { tags } from "@/lib/db/schema";

const DEFAULT_TAGS = [
  {
    id: "tag-general",
    name: "General",
    description: "General notes, daily logs, and miscellaneous thoughts",
    color: "#64748b", // Slate
  },
  {
    id: "tag-other",
    name: "Other",
    description: "Fallback category for unclassified or mixed-topic recordings",
    color: "#71717a", // Zinc
  },
];

export async function seedTags() {
  if (!db) {
    throw new Error("Database client is not initialized. Ensure DATABASE_URL is set in your environment.");
  }

  console.log("Seeding default tags...");

  for (const tag of DEFAULT_TAGS) {
    await db
      .insert(tags)
      .values(tag)
      .onConflictDoNothing({ target: tags.id });
  }

  console.log("Default tags seeded successfully.");
}

// Allow running directly via CLI (e.g., `npx tsx lib/db/seed.ts`)
if (require.main === module) {
  seedTags()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}