import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import httpStatus from "http-status";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { Role, UserStatus } from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  comparePassword,
  createAccessToken,
  createRefreshToken,
  hashPassword,
  type JwtPayload,
  verifyRefreshToken,
} from "./auth.utils.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const getTokenExpiry = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const buildAuthResponse = async (payload: JwtPayload) => {
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: payload.userId,
      expiresAt: getTokenExpiry(30),
    },
  });

  return { accessToken, refreshToken };
};

export const authService = {
  register: async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ApiError(httpStatus.CONFLICT, "User already exists with this email");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        phone: payload.phone,
        role: Role.CUSTOMER,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    const tokens = await buildAuthResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, ...tokens };
  },

  login: async (payload: { email: string; password: string }) => {
    const user = await prisma.user.findFirst({
      where: {
        email: payload.email,
        deletedAt: null,
      },
    });

    if (!user?.passwordHash) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(httpStatus.FORBIDDEN, "User account is blocked");
    }

    const isPasswordMatched = await comparePassword(payload.password, user.passwordHash);

    if (!isPasswordMatched) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    const tokens = await buildAuthResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        staffProfile: await prisma.staffProfile.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            staffType: true,
            hubId: true,
            availabilityStatus: true,
            activeTaskCount: true,
            maxActiveTasks: true,
          },
        }),
      },
      ...tokens,
    };
  },

  googleLogin: async (idToken: string) => {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Google login is not configured");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const googlePayload = ticket.getPayload();

    if (!googlePayload?.email || !googlePayload.email_verified) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Google token");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: googlePayload.email },
    });

    if (existingUser && existingUser.role !== Role.CUSTOMER) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Google login is available only for customer accounts",
      );
    }

    if (existingUser?.googleId && existingUser.googleId !== googlePayload.sub) {
      throw new ApiError(httpStatus.CONFLICT, "A different Google account is already linked");
    }

    const googleIdOwner = await prisma.user.findUnique({
      where: { googleId: googlePayload.sub },
      select: { id: true, email: true },
    });

    if (googleIdOwner && googleIdOwner.email !== googlePayload.email) {
      throw new ApiError(httpStatus.CONFLICT, "Google account is already linked");
    }

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: googlePayload.sub,
            avatarUrl: googlePayload.picture,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        })
      : await prisma.user.create({
          data: {
            name: googlePayload.name ?? googlePayload.email.split("@")[0],
            email: googlePayload.email,
            googleId: googlePayload.sub,
            avatarUrl: googlePayload.picture,
            role: Role.CUSTOMER,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        });

    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(httpStatus.FORBIDDEN, "User account is blocked");
    }

    const tokens = await buildAuthResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, ...tokens };
  },

  refreshToken: async (refreshToken: string) => {
    const decoded = verifyRefreshToken(refreshToken);
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        userId: decoded.userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!storedToken || storedToken.user.status !== UserStatus.ACTIVE) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
    }

    return buildAuthResponse({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });
  },

  logout: async (refreshToken: string) => {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return null;
  },
};
