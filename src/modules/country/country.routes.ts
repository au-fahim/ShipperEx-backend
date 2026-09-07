import { Router } from "express";
import { countryController } from "./country.controller.js";

const router = Router();

router.get("/", countryController.getCountries);

export const countryRoutes = router;
