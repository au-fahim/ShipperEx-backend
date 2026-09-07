import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { courierTaskService } from "./courierTask.service.js";

export const courierTaskController = {
  getMyTasks: catchAsync(async (req, res) => {
    const result = await courierTaskService.getMyTasks(req.query, getAuthUser(req));
    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier tasks retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  getTask: catchAsync(async (req, res) => {
    const result = await courierTaskService.getTask(req.params.id as string, getAuthUser(req));
    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier task retrieved successfully",
      data: result,
    });
  }),

  startTask: catchAsync(async (req, res) => {
    const result = await courierTaskService.startTask(
      req.params.id as string,
      req.body.note,
      getAuthUser(req),
    );
    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier task started successfully",
      data: result,
    });
  }),

  completeTask: catchAsync(async (req, res) => {
    const result = await courierTaskService.completeTask(
      req.params.id as string,
      req.body,
      getAuthUser(req),
    );
    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier task completed successfully",
      data: result,
    });
  }),

  failTask: catchAsync(async (req, res) => {
    const result = await courierTaskService.failTask(
      req.params.id as string,
      req.body,
      getAuthUser(req),
    );
    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Delivery failure recorded successfully",
      data: result,
    });
  }),
};
