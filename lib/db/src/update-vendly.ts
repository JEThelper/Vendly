import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db/schema";
import { ilike } from "drizzle-orm";

const states = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT"
];

async function update() {
  console.log("Updating Vendly delivery locations...");
  try {
    const updated = await db.update(vendorsTable)
      .set({
        deliveryLocations: states,
        requiresDeliveryAddress: true
      })
      .where(ilike(vendorsTable.name, '%Vendly%'))
      .returning();
    
    console.log("Updated vendors:", updated.map(v => v.name));
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

update();
