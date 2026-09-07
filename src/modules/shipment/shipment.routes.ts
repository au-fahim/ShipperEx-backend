import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { shipmentController } from "./shipment.controller.js";
import {
  assignCourierValidation,
  autoAssignValidation,
  checkpointValidation,
  collectShipmentValidation,
  createShipmentValidation,
  quoteShipmentValidation,
  returnOrderValidation,
  shipmentIdParamValidation,
  updateShipmentStatusValidation,
  updateShipmentValidation,
} from "./shipment.validation.js";

const router = Router();

router.post(
  "/quote",
  auth(roles.CUSTOMER, roles.STAFF, roles.ADMIN),
  validateRequest(quoteShipmentValidation),
  shipmentController.quoteShipment,
);
router.post(
  "/",
  auth(roles.CUSTOMER),
  validateRequest(createShipmentValidation),
  shipmentController.createShipment,
);
router.get(
  "/",
  auth(roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  shipmentController.getShipments,
);
router.get("/my", auth(roles.CUSTOMER), shipmentController.getMyShipments);
router.post(
  "/auto-assign",
  auth(roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(autoAssignValidation),
  shipmentController.autoAssign,
);
router.get(
  "/:id",
  auth(),
  validateRequest(shipmentIdParamValidation),
  shipmentController.getShipmentById,
);
router.patch(
  "/:id",
  auth(roles.CUSTOMER),
  validateRequest(updateShipmentValidation),
  shipmentController.updateShipment,
);
router.delete(
  "/:id",
  auth(roles.CUSTOMER, roles.ADMIN),
  validateRequest(shipmentIdParamValidation),
  shipmentController.deleteShipment,
);
router.post(
  "/:id/assignments",
  auth(roles.STAFF, roles.ADMIN),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(assignCourierValidation),
  shipmentController.assignCourier,
);
router.patch(
  "/:id/status",
  auth(roles.STAFF, roles.ADMIN),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(updateShipmentStatusValidation),
  shipmentController.updateStatus,
);
router.post(
  "/:id/checkpoints",
  auth(roles.STAFF, roles.ADMIN),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(checkpointValidation),
  shipmentController.addCheckpoint,
);
router.post(
  "/:id/collect",
  auth(roles.STAFF, roles.ADMIN),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(collectShipmentValidation),
  shipmentController.collectFromHub,
);
router.post(
  "/:id/return-orders",
  auth(roles.CUSTOMER),
  validateRequest(returnOrderValidation),
  shipmentController.createReturnOrder,
);
router.get(
  "/:id/timeline",
  auth(),
  validateRequest(shipmentIdParamValidation),
  shipmentController.getTimeline,
);

export const shipmentRoutes = router;
