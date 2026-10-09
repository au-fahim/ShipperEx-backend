import { Router } from "express";
import { auth, roles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { countryController } from "./country.controller.js";
import {
  countryIdParamValidation,
  createCountryValidation,
  updateCountryValidation,
} from "./country.validation.js";

const router = Router();

router.get("/admin", auth(roles.ADMIN), countryController.getAdminCountries);
router.get("/", countryController.getCountries);
router.post("/", auth(roles.ADMIN), validateRequest(createCountryValidation), countryController.createCountry);
router.patch(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(updateCountryValidation),
  countryController.updateCountry,
);
router.delete(
  "/:id",
  auth(roles.ADMIN),
  validateRequest(countryIdParamValidation),
  countryController.archiveCountry,
);

export const countryRoutes = router;