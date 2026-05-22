import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListVendorCustomersParams } from "@workspace/api-zod";
import { toCustomer } from "../lib/serializers";

const router: IRouter = Router();

router.get("/vendors/:vendorId/customers", async (req, res) => {
  const params = ListVendorCustomersParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.vendorId, params.data.vendorId))
    .orderBy(desc(customersTable.totalSpent), desc(customersTable.createdAt));
  return res.json(rows.map(toCustomer));
});

export default router;
