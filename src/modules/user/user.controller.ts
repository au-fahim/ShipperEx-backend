import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { userService } from "./user.service.js";

export const userController = {
  getMe: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await userService.getMe(authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Profile retrieved successfully",
      data: result,
    });
  }),

  updateMe: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await userService.updateMe(authUser.userId, req.body);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Profile updated successfully",
      data: result,
    });
  }),

  getUsers: catchAsync(async (req, res) => {
    const result = await userService.getUsers(req.query);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Users retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  getUserById: catchAsync(async (req, res) => {
    const result = await userService.getUserById(req.params.id as string);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "User retrieved successfully",
      data: result,
    });
  }),

  updateUserStatus: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await userService.updateUserStatus(
      req.params.id as string,
      req.body.status,
      authUser.userId,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "User status updated successfully",
      data: result,
    });
  }),

  updateUserRole: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await userService.updateUserRole(
      req.params.id as string,
      req.body.role,
      authUser.userId,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "User role updated successfully",
      data: result,
    });
  }),
};
