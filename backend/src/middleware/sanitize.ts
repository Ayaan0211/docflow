import validator from "validator";
import { Request, Response, NextFunction } from "express";

export const sanitizeDocument = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.body.title = validator.escape(req.body.title.trim());
  try {
    if (typeof req.body.content === "string") {
      req.body.content = JSON.parse(req.body.content);
    }
  } catch {
    return res.status(400).end("Invalid content format");
  }
  next();
};

export const sanitizeContent = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (typeof req.body.content === "string") {
      req.body.content = JSON.parse(req.body.content);
    }
  } catch {
    return res.status(400).end("Invalid content format");
  }
  next();
};

export const sanitizeTitle = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.body.title = validator.escape(req.body.title.trim());
  next();
};

export const sanitizeSharingCredentials = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!validator.isEmail(req.body.email))
    return res.status(400).end("Invalid email format");
  req.body.permission = validator.escape(req.body.permission);
  next();
};