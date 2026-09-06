import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authController } from "./auth.controller.js";
import {
  googleLoginValidation,
  loginValidation,
  logoutValidation,
  refreshTokenValidation,
  registerValidation,
} from "./auth.validation.js";

const router = Router();

router.post("/register", validateRequest(registerValidation), authController.register);
router.post("/login", validateRequest(loginValidation), authController.login);
router.post("/google", validateRequest(googleLoginValidation), authController.googleLogin);
router.post("/refresh-token", validateRequest(refreshTokenValidation), authController.refreshToken);
router.post("/logout", validateRequest(logoutValidation), authController.logout);

export const authRoutes = router;
