import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { shipmentRateController } from "./shipmentRate.controller.js";
import {
  createShipmentRateValidation,
  shipmentRateIdParamValidation,
  updateShipmentRateValidation,
} from "./shipmentRate.validation.js";

const router = Router();

router.get(
  "/",
  auth(roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  shipmentRateController.getRates,
);
router.post(
  "/",
  auth(roles.ADMIN),
  validateRequest(createShipmentRateValidation),
  shipmentRateController.createRate,
);
router.patch(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(updateShipmentRateValidation),
  shipmentRateController.updateRate,
);
router.delete(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(shipmentRateIdParamValidation),
  shipmentRateController.deleteRate,
);

export const shipmentRateRoutes = router;
