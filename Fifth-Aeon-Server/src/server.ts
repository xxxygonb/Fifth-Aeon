import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";
import { NextFunction } from "express-serve-static-core";
import * as morgan from "morgan";
import * as os from "os";
import { authRoutes } from "./routes/authentication.routes";
import { availabilityRoutes } from "./routes/availability.routes";
import { cardRoutes } from "./routes/collection.routes";
import { draftRouter } from "./routes/draft.routes";
import { Account } from "./account";
import { startDB } from "./db";
import { ErrorHandler, ErrorType } from "./errors";
import { tsrv } from "./i18n-messages";
import { GameServer } from "./gameServer";
import { DeckList } from "./game_model/deckList";
import { MatchQueue } from "./matchmaking";
import { Message, MessageType } from "./message";
import { ServerMessenger } from "./messenger";
import { authenticationModel } from "./models/authentication.model";
import { getToken } from "./tokens";
import { tournamentRouter } from "./routes/tournament.routes";
import { moddingRouter } from "./routes/mods.routes";
import { adminRouter } from "./routes/admin.routes";

// 1 hour
const cleaningTime = 1000 * 60 * 60;

function isLocalRequest(req: express.Request): boolean {
    const remote = req.socket ? req.socket.remoteAddress : "";
    return (
        remote === "127.0.0.1" ||
        remote === "::1" ||
        remote === "::ffff:127.0.0.1"
    );
}

/**
 * Server that holds references to all the components of the app
 *
 * @export
 */
export class Server {
    private gameQueue: MatchQueue;
    private messenger: ServerMessenger;
    private games: Map<string, GameServer> = new Map<string, GameServer>();
    private accounts: Map<string, Account> = new Map<string, Account>();
    private app: express.Express;
    private errors: ErrorHandler;

    constructor(port: number) {
        this.app = express();
        this.app.use(bodyParser.json());
        this.addRoutes();
        const expressServer = this.app.listen(port, () => {
            console.log("Server started on port", port);
        });

        this.messenger = new ServerMessenger(expressServer);
        this.errors = new ErrorHandler(this.messenger);
        this.gameQueue = new MatchQueue(
            this,
            this.errors,
            this.messenger,
            this.makeGame.bind(this)
        );

        this.messenger.addHandler(MessageType.SetDeck, msg =>
            this.setDeck(msg)
        );
        this.messenger.onMessage = (msg: Message) => {
            const account = this.accounts.get(msg.source);
            if (account) {
                account.freshen();
            }
        };

        // Give a disconnected player 60s to reconnect before ending the
        // game they were in, so a dropped connection cannot stall it forever.
        const disconnectTimeout = 1000 * 60;
        this.messenger.onDisconnect = (token: string) => {
            this.gameQueue.removePrivateGamesFor(token);
            // 断线时同时移出公共匹配队列，避免幽灵玩家留在队列中
            // 与真实玩家匹配成一面倒的死局
            this.gameQueue.removeFromQueue(token);
            const account = this.accounts.get(token);
            if (!account || !account.gameId) {
                return;
            }
            const gameId = account.gameId;
            setTimeout(() => {
                const acc = this.accounts.get(token);
                if (!acc || acc.gameId !== gameId) {
                    return;
                }
                if (this.messenger.isConnected(token)) {
                    return;
                }
                const game = this.games.get(gameId);
                if (game) {
                    console.log(
                        "Player disconnected from game, ending it:",
                        game.getName()
                    );
                    game.end();
                }
            }, disconnectTimeout);
        };

        // Player reconnected (e.g. page refresh) and asks for the current
        // game state back - replay StartGame plus the full event log.
        this.messenger.addHandler(MessageType.ResendGame, (msg: Message) => {
            const acc = this.accounts.get(msg.source);
            if (!acc || !acc.gameId) {
                return;
            }
            const game = this.games.get(acc.gameId);
            if (game) {
                game.resendState(msg.source);
            }
        });

        this.passMessagesToGames();
        setInterval(this.pruneAccounts.bind(this), cleaningTime);
    }

    private async addRoutes() {
        await startDB();
        authenticationModel.setServer(this);
        this.app.use(cors());
        this.app.use(
            morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
        );
        this.app.use("/api/auth", authRoutes);
        this.app.use("/api/availability", availabilityRoutes);
        this.app.use("/api/cards", cardRoutes);
        this.app.use("/api/drafts", draftRouter);
        this.app.use("/api/modding", moddingRouter);
        this.app.use("/api/tournament", tournamentRouter);
        this.app.use("/api/admin", adminRouter);

        this.app.get("/report", (req, res) => {
            // Ops health endpoint: counts and memory only, and only for
            // local monitoring - it used to list usernames publicly.
            if (!isLocalRequest(req)) {
                res.status(403).send("Forbidden");
                return;
            }
            res.send(this.getReport());
        });
        this.app.use(this.expressErrorHandler as any);
    }

    private expressErrorHandler(
        err: Error,
        req: Request,
        res: express.Response,
        next: NextFunction
    ) {
        if ((err as any).problem) {
            res.status(400).json({
                message: (err as any).problem
            });
        } else {
            console.error(err);
            res.status(500).json({
                message: err.message || err.name
            });
        }
    }

    private pruneAccount(acc: Account) {
        console.log("prune", acc.username);
        this.accounts.delete(acc.token);
        this.gameQueue.removeFromQueue(acc.token);
        this.messenger.deleteUser(acc.token);
        if (acc.gameId) {
            const game = this.games.get(acc.gameId);
            if (game) {
                game.end();
            }
        }
    }

    private pruneAccounts() {
        console.log("Pruning accounts");
        const now = Date.now();
        for (const account of Array.from(this.accounts.values())) {
            const time = now - account.lastUsed.getTime();
            if (time > cleaningTime) {
                this.pruneAccount(account);
            }
        }
    }

    private getReport() {
        return {
            users: this.accounts.size,
            games: this.games.size,
            queue: this.gameQueue.getPlayersInQueue(),
            memory: {
                server: process.memoryUsage(),
                totalFree: os.freemem(),
                totalUsed: os.totalmem()
            }
        };
    }

    public isLoggedIn(token: string): boolean {
        return this.accounts.has(token);
    }

    public createMultiplayerUser(username: string) {
        const existing = Array.from(this.accounts.values()).find(
            acc => acc.username === username
        );
        if (existing) {
            return existing;
        }
        const token = getToken();
        const account = new Account(token, username);
        this.accounts.set(account.token, account);
        return account;
    }

    private setDeck(msg: Message) {
        const acc = this.accounts.get(msg.source);
        if (!acc) {
            this.errors.clientError(
                msg.source,
                ErrorType.AuthError,
                tsrv("You must be logged in to set your deck.")
            );
            return;
        }

        const deck = new DeckList();
        try {
            acc.deck.fromJson(msg.data.deckList);
        } catch (e) {
            this.errors.clientError(
                msg.source,
                ErrorType.DeckError,
                tsrv("Invalid Deck.")
            );
            acc.deck = new DeckList();
        }
    }

    private passMessagesToGames() {
        this.messenger.addHandler(MessageType.GameAction, (msg: Message) => {
            const acc = this.accounts.get(msg.source);
            if (!acc) {
                this.errors.clientError(
                    msg.source,
                    ErrorType.GameActionError,
                    tsrv("Not logged in.")
                );
                return;
            }
            const id = acc.getGame();

            if (!id || !this.games.has(id)) {
                this.errors.clientError(
                    msg.source,
                    ErrorType.GameActionError,
                    tsrv("Not in game.")
                );
                return;
            }
            (this.games.get(id) as GameServer).handleAction(msg);
        });
    }

    public makeGame(token1: string, token2: string) {
        const id = getToken();
        const ac1 = this.accounts.get(token1);
        const ac2 = this.accounts.get(token2);
        if (!ac1 || !ac2) {
            return;
        }
        ac1.setInGame(id);
        ac2.setInGame(id);
        const server = new GameServer(this.messenger, this, id, ac1, ac2);
        this.games.set(id, server);
        server.start();
    }

    public endGame(gameId: string) {
        if (this.games.has(gameId)) {
            this.games.delete(gameId);
        } else {
            console.error("Trying to delete non-existent game with id", gameId);
        }
    }

    public getErrorHandler() {
        return this.errors;
    }
}
