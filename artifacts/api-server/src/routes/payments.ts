import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paymentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListVendorPaymentsParams } from "@workspace/api-zod";
import { toPayment } from "../lib/serializers";

const router: IRouter = Router();

router.get("/vendors/:vendorId/payments", async (req, res) => {
  const params = ListVendorPaymentsParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const rows = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.vendorId, params.data.vendorId))
    .orderBy(desc(paymentsTable.createdAt));
  return res.json(rows.map(toPayment));
});

export default router;
