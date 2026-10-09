import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { rateZoneService } from "./rateZone.service.js";

export const rateZoneController = {
  getRateZones: catchAsync(async (_req, res) => {
    const result = await rateZoneService.getRateZones();
    sendResponse({ res, statusCode: httpStatus.OK, message: "Rate zones retrieved successfully", data: result });
  }),
};