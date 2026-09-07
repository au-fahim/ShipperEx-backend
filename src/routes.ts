import { Router } from "express";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { auditLogRoutes } from "./modules/auditLog/auditLog.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { countryRoutes } from "./modules/country/country.routes.js";
import { courierRoutes } from "./modules/courier/courier.routes.js";
import { courierTaskRoutes } from "./modules/courierTask/courierTask.routes.js";
import { hubRoutes } from "./modules/hub/hub.routes.js";
import { notificationRoutes } from "./modules/notification/notification.routes.js";
import { paymentRoutes } from "./modules/payment/payment.routes.js";
import { shipmentRoutes } from "./modules/shipment/shipment.routes.js";
import { shipmentRateRoutes } from "./modules/shipmentRate/shipmentRate.routes.js";
import { trackingRoutes } from "./modules/tracking/tracking.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ShipperEx API is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use("/auth", authRoutes);
router.use("/", userRoutes);
router.use("/countries", countryRoutes);
router.use("/shipment-rates", shipmentRateRoutes);
router.use("/hubs", hubRoutes);
router.use("/", courierRoutes);
router.use("/courier/tasks", courierTaskRoutes);
router.use("/shipments", shipmentRoutes);
router.use("/tracking", trackingRoutes);
router.use("/payments", paymentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/", auditLogRoutes);
router.use("/", analyticsRoutes);

export const routes = router;
