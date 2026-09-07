import { Router } from "express";
import { auth, roles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { hubController } from "./hub.controller.js";
import {
  createHubValidation,
  hubIdParamValidation,
  updateHubValidation,
} from "./hub.validation.js";

const router = Router();

router.post("/", auth(roles.ADMIN), validateRequest(createHubValidation), hubController.createHub);
router.get("/", auth(roles.CUSTOMER, roles.STAFF, roles.ADMIN), hubController.getHubs);
router.patch(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(updateHubValidation),
  hubController.updateHub,
);
router.delete(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(hubIdParamValidation),
  hubController.deleteHub,
);

export const hubRoutes = router;
