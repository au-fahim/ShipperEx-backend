import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { courierController } from "./courier.controller.js";
import {
  courierIdParamValidation,
  createCourierValidation,
  createManagerValidation,
  updateCourierValidation,
} from "./courier.validation.js";

const router = Router();

router.post(
  "/admin/staff/managers",
  auth(roles.ADMIN),
  validateRequest(createManagerValidation),
  courierController.createManager,
);
router.post(
  "/admin/staff/couriers",
  auth(roles.ADMIN),
  validateRequest(createCourierValidation),
  courierController.createCourier,
);
router.get(
  "/couriers",
  auth(roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  courierController.getCouriers,
);
router.patch(
  "/couriers/:id",
  auth(roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(updateCourierValidation),
  courierController.updateCourier,
);
router.delete(
  "/couriers/:id",
  auth(roles.ADMIN),
  validateRequest(courierIdParamValidation),
  courierController.deleteCourier,
);

export const courierRoutes = router;
