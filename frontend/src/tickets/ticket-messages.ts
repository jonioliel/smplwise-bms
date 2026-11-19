// The delivery lines of a ticket (CR-038 slice 5b, D14): the pure line logic is tickets/message-lines.ts; this module is the name its
// importers use. CR-FE-DEAD-CODE-2442: the `messagesBlock` renderer (and its `MessagesCtx`) had no caller and was deleted.
export { messageEventLine, messageLine, purposeLabel, visibleMessages, when } from './message-lines';
