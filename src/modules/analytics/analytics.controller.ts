import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { analyticsService } from "./analytics.service.js";

export const analyticsController = {
  getDashboardStats: catchAsync(async (_req, res) => {
    const result = await analyticsService.getDashboardStats();

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Dashboard stats retrieved successfully",
      data: result,
    });
  }),

  getShipmentReport: catchAsync(async (req, res) => {
    const result = await analyticsService.getShipmentReport(getAuthUser(req));

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment report retrieved successfully",
      data: result,
    });
  }),
};
