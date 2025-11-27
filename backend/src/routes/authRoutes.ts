import { Router } from "express";
import passport from "passport";
import { pool } from "../db";
import { isAuthenticated, checkCredentials, checkEmail } from "../middleware/auth";
import { Request, Response, NextFunction } from "express";
import { compare, genSalt, hash } from "bcrypt";
const router = Router();
const saltRounds = 10;

// sign up local auth
router.post(
  "/signup/",
  checkCredentials,
  function (req: Request, res: Response, next: NextFunction) {
    // extract data from HTTP request
    if (!("username" in req.body))
      return res.status(400).end("username is missing");
    if (!("email" in req.body)) return res.status(400).end("email is missing");
    if (!("password" in req.body))
      return res.status(400).end("password is missing");
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;
    // check if user already exists in the database
    pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
      function (err, result) {
        if (err) return res.status(500).end(err);
        if (result.rows.length > 0)
          return res.status(409).end("Email already exists, please sign in");
        genSalt(saltRounds, function (err, salt) {
          if (err) return res.status(500).end(err);
          hash(password, salt, function (err, hash) {
            if (err) return res.status(500).end(err);
            pool.query(
              "INSERT INTO users(name, password, email) VALUES ($1, $2, $3)",
              [username, hash, email],
              function (err) {
                if (err) return res.status(500).end(err);
                // start session
                req.session.email = email;
                return res.json({
                  username,
                  email,
                });
              }
            );
          });
        });
      }
    );
  }
);

// sign in local auth
router.post(
  "/signin/",
  checkEmail,
  function (req: Request, res: Response, next: NextFunction) {
    // extract data from HTTP request
    if (!("email" in req.body)) return res.status(400).end("email is missing");
    if (!("password" in req.body))
      return res.status(400).end("password is missing");
    const email = req.body.email;
    const password = req.body.password;
    pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
      (err, result) => {
        if (err) return res.status(500).end(err);
        if (result.rows.length === 0)
          return res.status(401).end("User does not exist!");
        const user = result.rows[0];
        compare(password, user.password, (err, valid) => {
          if (err) return res.status(500).end(err);
          if (!valid) return res.status(401).end("Password is incorrect!");
          req.session.email = user.email;
          return res.json({
            username: user.name,
            email: user.email,
          });
        });
      }
    );
  }
);

// sign in google auth
router.get(
  "/oauth2/google/",
  (req: Request, res: Response, next: NextFunction) => {
    // temp set it to lax so we can get the cookies from oauth
    req.session.cookie.sameSite = "lax";
    req.session.save(() => next());
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// sign in redirect
router.get(
  "/oauth2/redirect/google/",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req: Request, res) => {
    req.session.cookie.sameSite = "strict";
    req.session.email = req.user!.email;
    delete req.user;
    res.redirect("/");
  }
);

// sign out
router.get(
  "/signout/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    req.session.destroy(function (err) {
      if (err) return res.status(500).end(err);
      res.redirect("/");
    });
  }
);

// session check
router.get(
  "/session/",
  function (req: Request, res: Response, next: NextFunction) {
    if (req.email) {
      pool.query(
        "SELECT name FROM users WHERE email = $1",
        [req.email],
        (err, nameRow) => {
          if (err) return res.status(500).end(err);
          if (nameRow.rows.length === 0)
            return res.status(401).end("Invalid session");

          const username = nameRow.rows[0].name;
          res.json({
            isLoggedIn: true,
            email: req.email,
            username,
          });
        }
      );
    } else {
      res.json({
        isLoggedIn: false,
        email: null,
        username: null,
      });
    }
  }
);

export default router;