import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { paymentController } from "./payment.controller.js";
import { initiatePaymentValidation, paymentIdParamValidation } from "./payment.validation.js";

const router = Router();

router.post(
  "/:shipmentId/initiate",
  auth(roles.CUSTOMER),
  validateRequest(initiatePaymentValidation),
  paymentController.initiatePayment,
);
router.post("/webhook", paymentController.webhook);
router.get("/success", paymentController.success);
router.get("/cancel", paymentController.cancel);
router.get("/my", auth(roles.CUSTOMER), paymentController.getMyPayments);
router.get(
  "/:id",
  auth(roles.CUSTOMER, roles.ADMIN, roles.STAFF),
  requireStaffType(staffTypes.MANAGER),
  validateRequest(paymentIdParamValidation),
  paymentController.getPaymentById,
);

export const paymentRoutes = router;
