import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { courierService } from "./courier.service.js";

export const courierController = {
  createManager: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await courierService.createManager(req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Manager account created successfully",
      data: result,
    });
  }),

  createCourier: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await courierService.createCourier(req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Courier created successfully",
      data: result,
    });
  }),

  getCouriers: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await courierService.getCouriers(req.query, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Couriers retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  updateCourier: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await courierService.updateCourier(req.params.id as string, req.body, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier updated successfully",
      data: result,
    });
  }),

  deleteCourier: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await courierService.deleteCourier(req.params.id as string, authUser.userId);

    sendResponse({
      res,    
      statusCode: httpStatus.OK,
      message: "Courier deleted successfully",
      data: result,
    });
  }),
};
