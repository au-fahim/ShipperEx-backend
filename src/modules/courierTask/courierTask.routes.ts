import { Router } from "express";
import { auth, requireStaffType, roles, staffTypes } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { courierTaskController } from "./courierTask.controller.js";
import {
  completeCourierTaskValidation,
  courierTaskIdValidation,
  failCourierTaskValidation,
  startCourierTaskValidation,
} from "./courierTask.validation.js";

const router = Router();

router.use(auth(roles.STAFF), requireStaffType(staffTypes.COURIER));
router.get("/", courierTaskController.getMyTasks);
router.get("/:id", validateRequest(courierTaskIdValidation), courierTaskController.getTask);
router.patch(
  "/:id/start",
  validateRequest(startCourierTaskValidation),
  courierTaskController.startTask,
);
router.patch(
  "/:id/complete",
  validateRequest(completeCourierTaskValidation),
  courierTaskController.completeTask,
);
router.patch(
  "/:id/fail",
  validateRequest(failCourierTaskValidation),
  courierTaskController.failTask,
);

export const courierTaskRoutes = router;
