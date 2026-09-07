import { Router } from "express";
import { shipmentController } from "../shipment/shipment.controller.js";

const router = Router();

router.get("/:trackingNumber", shipmentController.trackByTrackingNumber);

export const trackingRoutes = router;
