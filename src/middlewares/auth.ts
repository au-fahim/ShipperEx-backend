import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { prisma } from "../config/prisma.js";
import { Role, StaffType, UserStatus } from "../generated/prisma/enums.js";
import { verifyAccessToken } from "../modules/auth/auth.utils.js";
import { ApiError } from "../shared/ApiError.js";

export const auth =
  (...allowedRoles: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Bearer token is required");
      }

      const token = authHeader.split(" ")[1];
      const decoded = verifyAccessToken(token);

      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          staffProfile: {
            select: {
              id: true,
              hubId: true,
              staffType: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired authentication");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "You are not allowed to access this resource");
      }

      if (user.role === Role.STAFF && (!user.staffProfile || user.staffProfile.deletedAt)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Staff profile is inactive or missing");
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        staffProfileId: user.staffProfile?.id,
        staffType: user.staffProfile?.staffType,
        hubId: user.staffProfile?.hubId,
      };

      next();
    } catch (error) {
      next(error);
    }
  };

export const roles = Role;

export const requireStaffType =
  (...allowedTypes: StaffType[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== Role.STAFF) {
        next();
        return;
      }

      if (!req.user.staffType || !allowedTypes.includes(req.user.staffType)) {
        throw new ApiError(httpStatus.FORBIDDEN, "This staff operation is not permitted");
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export const staffTypes = StaffType;
