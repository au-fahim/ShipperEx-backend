import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { notificationController } from "./notification.controller.js";

const router = Router();

router.get("/", auth(), notificationController.getMyNotifications);
router.patch("/:id/read", auth(), notificationController.markAsRead);

export const notificationRoutes = router;
