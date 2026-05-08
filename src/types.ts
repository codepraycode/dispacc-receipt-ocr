export type TransactionStatus = 'successful' | 'failed' | 'pending';

export interface TransactionRecord {
    amount: number;
    currency: string;
    sender: string | null;
    recipient: string | null;
    recipient_account: string | null;
    bank: string | null;
    reference: string | null;
    transaction_date: string | null;
    transaction_type: string;
    status: TransactionStatus;
    platform: string;
    narration: string | null;
}

export interface ExtractorConfig {
    groqApiKey: string;
}

export interface ExtractResult {
    transaction: TransactionRecord;
    rawResponse: string;
}
