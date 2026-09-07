import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { shipmentRateService } from "./shipmentRate.service.js";

export const shipmentRateController = {
  getRates: catchAsync(async (req, res) => {
    const result = await shipmentRateService.getRates(req.query);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment rates retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  createRate: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentRateService.createRate(req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Shipment rate created successfully",
      data: result,
    });
  }),

  updateRate: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentRateService.updateRate(
      req.params.id as string,
      req.body,
      authUser.userId,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment rate updated successfully",
      data: result,
    });
  }),

  deleteRate: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentRateService.deleteRate(req.params.id as string, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment rate deleted successfully",
      data: result,
    });
  }),
};
