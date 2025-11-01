import "express";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name?: string;
      google_id?: string;
    }
  }
}