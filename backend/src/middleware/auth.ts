import validator from "validator";
import { Request, Response, NextFunction } from "express";

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.email) return res.status(401).end("access denied");
  next();
}

export const checkCredentials = function (req: Request, res: Response, next: NextFunction) {
  if (!validator.isAlphanumeric(req.body.username))
    return res.status(400).end("bad username input");
  if (!validator.isEmail(req.body.email))
    return res.status(400).end("bad email input");
  next();
};

export const checkEmail = function (req: Request, res: Response, next: NextFunction) {
  if (!validator.isEmail(req.body.email))
    return res.status(400).end("bad email input");
  next();
};