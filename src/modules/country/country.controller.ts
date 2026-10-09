import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { countryService } from "./country.service.js";

export const countryController = {
  getCountries: catchAsync(async (req, res) => {
    const result = await countryService.getCountries(req.query.search as string | undefined);
    sendResponse({ res, statusCode: httpStatus.OK, message: "Countries retrieved successfully", data: result });
  }),

  getAdminCountries: catchAsync(async (_req, res) => {
    const result = await countryService.getAdminCountries();
    sendResponse({ res, statusCode: httpStatus.OK, message: "Country assignments retrieved successfully", data: result });
  }),

  createCountry: catchAsync(async (req, res) => {
    const result = await countryService.createCountry(req.body, getAuthUser(req).userId);
    sendResponse({ res, statusCode: httpStatus.CREATED, message: "Country added to rate zones successfully", data: result });
  }),

  updateCountry: catchAsync(async (req, res) => {
    const result = await countryService.updateCountry(req.params.id as string, req.body, getAuthUser(req).userId);
    sendResponse({ res, statusCode: httpStatus.OK, message: "Country assignment updated successfully", data: result });
  }),

  archiveCountry: catchAsync(async (req, res) => {
    const result = await countryService.archiveCountry(req.params.id as string, getAuthUser(req).userId);
    sendResponse({ res, statusCode: httpStatus.OK, message: "Country archived successfully", data: result });
  }),
};