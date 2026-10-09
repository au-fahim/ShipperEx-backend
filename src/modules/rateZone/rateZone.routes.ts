import { Router } from "express";
import { auth, roles } from "../../middlewares/auth.js";
import { rateZoneController } from "./rateZone.controller.js";

const router = Router();

router.get("/", auth(roles.ADMIN), rateZoneController.getRateZones);

export const rateZoneRoutes = router;