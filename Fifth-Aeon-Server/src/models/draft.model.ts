import { Draft, SavedDraft } from "../game_model/draft";
import { db } from "../db";
import { UserData } from "./authentication.model";
import { collectionModel } from "./collection.model";
import { tsrv } from "../i18n-messages";
import { Collection, SavedCollection } from "../game_model/collection";

class DraftModel {
    /**
     * Creates a draft for a user if they already have enough gold and aren't already doing one.
     * Runs inside a transaction with a row lock on the account so concurrent
     * requests can never double-spend gold or create two drafts.
     *
     * @param user - The user who will be drafting
     * @returns - the new draft if successful otherwise a translated error message
     */
    public async startDraft(user: UserData) {
        const client = await db.connect();
        try {
            await client.query("BEGIN");
            // Lock the account row: serializes concurrent startDraft calls
            const colResult = await client.query(
                `
                SELECT collection FROM CCG.Account
                WHERE accountID = $1
                FOR UPDATE;
            `,
                [user.uid]
            );
            if (colResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return tsrv("Not Enough Gold");
            }
            const collection = new Collection(
                colResult.rows[0].collection as SavedCollection
            );
            const draftExists = await client.query(
                `
                SELECT 1 FROM CCG.Draft WHERE accountID = $1;
            `,
                [user.uid]
            );
            if (draftExists.rows.length > 0) {
                await client.query("ROLLBACK");
                return tsrv("Already in draft");
            }
            if (collection.getGold() < Draft.cost) {
                await client.query("ROLLBACK");
                return tsrv("Not Enough Gold");
            }
            collection.removeGold(Draft.cost);
            const draft = new Draft();
            await client.query(
                `
                INSERT INTO CCG.Draft (accountID, draftData)
                VALUES ($1, $2);
            `,
                [user.uid, draft]
            );
            await client.query(
                `
                UPDATE CCG.Account
                SET collection = $1
                WHERE accountID = $2;
            `,
                [collection.getSavable(), user.uid]
            );
            await client.query("COMMIT");
            return draft.toSavable();
        } catch (e) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                // Transaction was already aborted
            }
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Updates a draft when the user has made a choice
     *
     * @returns A promise that completes when the operation is done
     */
    public updateDraft(user: UserData, draft: SavedDraft) {
        return db.query(
            `
            UPDATE CCG.Draft
            SET draftData = $2
            WHERE accountID = $1;
        `,
            [user.uid, draft]
        );
    }

    /**
     * Gets a users current draft or false if they don't have one
     *
     * @returns - A draft object or false if the user isn't enrolled in a draft.
     */
    public async getDraft(user: UserData) {
        const result = await db.query(
            `
            SELECT draftData as "draftData" FROM CCG.Draft
            WHERE accountID = $1;
        `,
            [user.uid]
        );
        if (result.rowCount === 0) { return false; }
        return result.rows[0].draftData as SavedDraft;
    }

    public async endDraft(user: UserData, data: SavedDraft) {
        const draft = new Draft(data);
        const rewards = draft.getRewards();
        await collectionModel.rewardPlayer(user, rewards);
        await db.query(
            `
            DELETE FROM CCG.Draft
            WHERE accountID = $1;
        `,
            [user.uid]
        );
        return rewards;
    }
}

export const draftModel = new DraftModel();
