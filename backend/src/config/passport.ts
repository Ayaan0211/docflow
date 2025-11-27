import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Profile } from "passport-google-oauth20";
import { VerifyCallback } from "passport-oauth2";
import { pool } from "../db";

export function configurePassport() {
    passport.use(
        new GoogleStrategy(
            {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: "/api/oauth2/redirect/google/",
            },
            function verify(
            accessToken: string,
            refreshToken: string,
            profile: Profile,
            cb: VerifyCallback
            ) {
            const googleId = profile.id;
            const name = profile.displayName;
            const email =
                profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            // check if user is in db
            pool.query(
                "SELECT * FROM users WHERE google_id = $1 OR email = $2",
                [googleId, email],
                (err, result) => {
                if (err) return cb(err);
                // existing user
                if (result.rows.length > 0) {
                    const existingUser = result.rows[0];
                    // existing local user with email but now is signing in with google first time (link account)
                    if (!existingUser.google_id) {
                    pool.query(
                        `
                    UPDATE users
                    SET google_id = $1
                    WHERE email = $2
                    RETURNING *
                    `,
                        [googleId, email],
                        (err, updated) => {
                        if (err) return cb(err);
                        return cb(null, updated.rows[0]);
                        }
                    );
                    } else {
                    // exisitng google user
                    return cb(null, existingUser);
                    }
                }
                // new user completly (no local auth)
                pool.query(
                    "INSERT INTO users(name, email, google_id) VALUES ($1, $2, $3) RETURNING *",
                    [name, email, googleId],
                    (err, dbResult) => {
                    if (err) return cb(err);
                    return cb(null, dbResult.rows[0]);
                    }
                );
                }
            );
            }
        )
    );

    passport.serializeUser(function (user, cb) {
        cb(null, user.id);
    });

    passport.deserializeUser(function (id, cb) {
        pool.query("SELECT * FROM users WHERE id = $1", [id], function (err, result) {
            if (err) return cb(err);
            cb(null, result.rows[0]);
        });
    });
}