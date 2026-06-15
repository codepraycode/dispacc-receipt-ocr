export type TransactionStatus = 'successful' | 'failed' | 'pending' | 'reversed';
export type TransactionDirection = 'debit' | 'credit' | 'unknown';

/**
 * The structured object the extractor returns. Keys map one-to-one to the
 * JSON schema requested in `ReceiptExtractor.getPrompt()` — this type is the
 * source of truth for that prompt's output. Any field may be null when the
 * receipt is partial, cropped, or illegible.
 */
export interface TransactionRecord {
    amount_raw: string | null;
    amount: number | null;
    fee: number | null;
    currency: string;
    direction: TransactionDirection;
    sender_name: string | null;
    sender_account: string | null;
    sender_bank: string | null;
    recipient_name: string | null;
    recipient_account: string | null;
    recipient_bank: string | null;
    reference: string | null;
    transaction_date: string | null;
    transaction_type: string | null;
    status: TransactionStatus | null;
    platform: string | null;
    platform_raw: string | null;
    narration: string | null;
}

export interface ExtractorConfig {
    groqApiKey: string;
}

export interface ExtractResult {
    transaction: TransactionRecord | null;
    rawResponse: string;
    error?: string;
}
