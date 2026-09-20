import * as express from "express";
import { draftModel } from "../models/draft.model";
import { UserData } from "../models/authentication.model";
import { passwords } from "../passwords";
import { tsrv, tsrvf } from "../i18n-messages";

const router = express.Router();

router.post("/startDraft", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        const result = await draftModel.startDraft(user);
        if (typeof result !== "string") {
            res.json({
                message: tsrv("Draft started"),
                data: result
            });
        } else {
            res.status(400).json({
                message: tsrvf("Cannot start draft: {reason}", { reason: result })
            });
        }
    } catch (e) {
        next(e);
    }
});

router.post("/updateDraft", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        await draftModel.updateDraft(user, req.body.draftData);
        res.json({ message: tsrv("success") });
    } catch (e) {
        next(e);
    }
});

router.get("/getDraft", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        const draftData = await draftModel.getDraft(user);
        if (!draftData) {
            return res.status(400).json({ message: tsrv("no data") });
        }
        res.json({ message: tsrv("success"), draftData: draftData });
    } catch (e) {
        next(e);
    }
});

router.post("/endDraft", passwords.authorize, async (req, res, next) => {
    try {
        const user: UserData = (req as any).user;
        const reward = await draftModel.endDraft(user, req.body.draftData);
        res.json({ message: tsrv("success"), reward });
    } catch (e) {
        next(e);
    }
});

export const draftRouter = router;
