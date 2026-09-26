import * as express from "express";
import { rateLimit } from "express-rate-limit";
import { db } from "../db";
import { email } from "../email";
import { tsrv } from "../i18n-messages";
import { authenticationModel, UserData } from "../models/authentication.model";
import { collectionModel } from "../models/collection.model";
import { passwords } from "../passwords";
import { validators } from "./validators";

const router = express.Router();

const tooManyMessage = { message: tsrv("Too many requests, please try again later") };

// Brute-force protection: tighter budgets on credential endpoints,
// looser ones on one-time-per-user flows.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyMessage
});
const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyMessage
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyMessage
});
const guestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyMessage
});

router.post(
    "/register",
    registerLimiter,
    validators.requiredAttributes(["username", "email", "password"]),
    async (req, res, next) => {
        try {
            const response = await authenticationModel.registerAccount(
                req.body
            );
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }
);

router.post(
    "/upgradeGuest",
    passwords.authorize,
    validators.requiredAttributes(["username", "email", "password"]),
    async (req, res, next) => {
        try {
            const user: UserData = (req as any).user;
            const response = await authenticationModel.upgradeGuestAccount(
                user,
                req.body
            );
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }
);

router.post(
    "/registerGuest",
    guestLimiter,
    async (req, res, next) => {
    try {
        const response = await authenticationModel.createGuestAccount();
        res.status(201).json(response);
    } catch (e) {
        next(e);
    }
});

router.post(
    "/login",
    loginLimiter,
    validators.requiredAttributes(["usernameOrEmail", "password"]),
    async (req, res, next) => {
        try {
            const result = await authenticationModel.login(
                req.body.usernameOrEmail,
                req.body.password
            );
            res.status(200).json(result);
        } catch (e) {
            next(e);
        }
    }
);

router.get("/userdata", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        const result = await authenticationModel.getUserData(user.uid);
        res.status(200).json(result);
    } catch (e) {
        next(e);
    }
});

router.post("/verifyEmail", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        if (user.email && user.uid) {
            const verificationResult = await db.query(
                `
                UPDATE CCG.Account
                SET emailVerified = true
                WHERE accountID = $1
                  AND emailVerified = false;
            `,
                [user.uid]
            );

            if (verificationResult.rowCount === 1) {
                await collectionModel.rewardPlayer(user, { packs: 2, gold: 0 });
            }

            res.status(200).json({
                message: tsrv("done")
            });
        } else {
            res.sendStatus(403);
        }
    } catch (err) {
        next(err);
    }
});

router.post(
    "/verifyReset",
    resetLimiter,
    passwords.authorize,
    validators.requiredAttributes(["password"]),
    async (req, res, next) => {
        try {
            const user: UserData = (req as any).user;
            // Only tokens minted for a password reset (email link) carry this
            // claim; a regular login JWT must not be able to change the
            // password without proving knowledge of the old one.
            if (!(user as any).pass) {
                res.status(403).json({
                    message: tsrv("Password reset token required")
                });
                return;
            }
            const passwordData = await passwords.getHashedPassword(
                req.body.password
            );
            const queryResult = await db.query(
                `
            UPDATE CCG.Account
            SET password = $1, salt = $2
            WHERE accountID = $3
            RETURNING username;`,
                [passwordData.hash, passwordData.salt, user.uid]
            );

            res.status(200).json({
                token: passwords.createUserToken(user.uid),
                username: queryResult.rows[0].username
            });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    "/requestReset",
    resetLimiter,
    validators.requiredAttributes(["usernameOrEmail"]),
    async (req, res, next) => {
        try {
            const queryResult = await db.query(
                `
            SELECT email, accountID
            FROM CCG.Account
            WHERE username = $1
               OR email    = $1`,
                [req.body.usernameOrEmail]
            );
            if (queryResult.rowCount === 0) {
                res.status(400).json({
                    account: req.body.usernameOrEmail,
                    message: tsrv("No such account")
                });
                return;
            }
            const result = queryResult.rows[0];
            email.sendPasswordResetEmail(result.email, result.accountid);
            res.json({ message: tsrv("Reset email sent") });
        } catch (err) {
            next(err);
        }
    }
);

router.get("/testAuth", passwords.authorize, async (req, res) => {
    res.json((req as any).user);
});

export const authRoutes = router;
