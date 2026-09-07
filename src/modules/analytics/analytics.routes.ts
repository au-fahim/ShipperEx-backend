import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { analyticsController } from "./analytics.controller.js";

const router = Router();

router.get("/admin/dashboard-stats", auth(roles.ADMIN), analyticsController.getDashboardStats);
router.get(
  "/admin/reports/shipments",
  auth(roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  analyticsController.getShipmentReport,
);

export const analyticsRoutes = router;
