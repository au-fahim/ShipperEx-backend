import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { notificationService } from "./notification.service.js";

export const notificationController = {
  getMyNotifications: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await notificationService.getMyNotifications(req.query, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Notifications retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  markAsRead: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await notificationService.markAsRead(req.params.id as string, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Notification marked as read",
      data: result,
    });
  }),
};
