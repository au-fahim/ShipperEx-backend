import { Router } from "express";
import { auth, roles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { userController } from "./user.controller.js";
import {
  updateMeValidation,
  updateUserRoleValidation,
  updateUserStatusValidation,
  userIdParamValidation,
} from "./user.validation.js";

const router = Router();

router.get("/users/me", auth(), userController.getMe);
router.patch("/users/me", auth(), validateRequest(updateMeValidation), userController.updateMe);

router.get("/admin/users", auth(roles.ADMIN), userController.getUsers);
router.get(
  "/admin/users/:id",
  auth(roles.ADMIN),
  validateRequest(userIdParamValidation),
  userController.getUserById,
);
router.patch(
  "/admin/users/:id/status",
  auth(roles.ADMIN),
  validateRequest(updateUserStatusValidation),
  userController.updateUserStatus,
);
router.patch(
  "/admin/users/:id/role",
  auth(roles.ADMIN),
  validateRequest(updateUserRoleValidation),
  userController.updateUserRole,
);

export const userRoutes = router;
