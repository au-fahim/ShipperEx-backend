import { Router } from "express";
import { auth, roles } from "../../middlewares/auth.js";
import { auditLogController } from "./auditLog.controller.js";

const router = Router();

router.get("/admin/audit-logs", auth(roles.ADMIN), auditLogController.getAuditLogs);

export const auditLogRoutes = router;
