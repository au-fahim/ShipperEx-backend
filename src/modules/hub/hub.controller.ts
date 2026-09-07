import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { hubService } from "./hub.service.js";

export const hubController = {
  createHub: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await hubService.createHub(req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Hub created successfully",
      data: result,
    });
  }),

  getHubs: catchAsync(async (req, res) => {
    const result = await hubService.getHubs(req.query);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Hubs retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  updateHub: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await hubService.updateHub(req.params.id as string, req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Hub updated successfully",
      data: result,
    });
  }),

  deleteHub: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await hubService.deleteHub(req.params.id as string, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Hub deleted successfully",
      data: result,
    });
  }),
};
