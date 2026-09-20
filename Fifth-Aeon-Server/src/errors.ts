import { tsrvf } from "./i18n-messages";
import { MessageType } from "./message";
import { ServerMessenger } from "./messenger";

export enum ErrorType {
    GameActionError,
    AuthError,
    InvalidIdError,
    QueueError,
    DeckError
}

export interface ClientErrorData {
    message: string;
    type: ErrorType;
}

export class ErrorHandler {
    constructor(private messenger: ServerMessenger) {}

    public clientError(client: string, type: ErrorType, message?: string) {
        const msg = tsrvf("Error of type: {type} - {message}", {
            type: ErrorType[type],
            message: message ?? ""
        });
        this.messenger.sendMessageTo(
            MessageType.ClientError,
            {
                message: msg,
                type: type
            } as ClientErrorData,
            client
        );
    }
}
