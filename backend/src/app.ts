import "dotenv/config";
import { createServer } from "http";
import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import { Request, Response, NextFunction } from "express";
import { initDb } from "./db";
import { configurePassport } from "./config/passport";
import authRoutes from "./routes/authRoutes";
import documentRoutes from "./routes/documentRoutes";
import versionRoutes from "./routes/versionRoutes";
import rtcRoutes from "./routes/rtcRoutes";
import exportRoutes from "./routes/exportRoutes";
import shareRoutes from "./routes/shareRoutes";

const PORT = 8080;
const app = express();

initDb();

configurePassport();
app.use(express.json());
app.set("trust proxy", 1);

if (process.env.NODE_ENV == "dev") {
  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
}

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: true,
    cookie: {
      sameSite: true,
      secure: process.env.NODE_ENV == "prod", // sets the secure flag only with HTTPS in production
    },
  })
);

app.use(express.urlencoded({ extended: false }));

app.use(passport.initialize());
app.use(passport.session());
app.use(passport.authenticate("session"));

app.use(function (req: Request, res: Response, next: NextFunction) {
  req.email = req.session.email ? req.session.email : null;
  console.log("HTTP request", req.email, req.method, req.url, req.body);
  next();
});

app.use("/api", authRoutes);
app.use("/api", documentRoutes);
app.use("/api/documents", versionRoutes);
app.use("/api/documents", rtcRoutes);
app.use("/api/documents", exportRoutes);
app.use("/api/documents", shareRoutes);

export const server = createServer(app);

server.listen(PORT, () => {
  console.log(`✅ HTTP server running on http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("❌ Server error:", err);
});
