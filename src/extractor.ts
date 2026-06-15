import Groq from 'groq-sdk';
import { ExtractorConfig, ExtractResult, TransactionRecord } from './types';

export class ReceiptExtractor {
    private client: Groq;

    constructor(private config: ExtractorConfig) {
        if (!config.groqApiKey) {
            throw new Error('Groq API key is required');
        }
        this.client = new Groq({ apiKey: config.groqApiKey });
    }

    async extractFromBase64(
        base64: string,
        mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    ): Promise<ExtractResult> {
        // Strip out any existing base64 data URL prefixes if accidentally passed in full
        const pureBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
        return this._extract(pureBase64, mediaType);
    }

    async extractFromUrl(url: string, timeoutMs: number = 10_000): Promise<ExtractResult> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
            response = await fetch(url, { signal: controller.signal });
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                throw new Error(`Image fetch timed out after ${timeoutMs}ms: ${url}`);
            }
            throw new Error(`Failed to fetch image from URL: ${(err as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        // Isolate the pure mime-type (e.g., 'image/png; charset=utf-8' -> 'image/png')
        const rawMimeType = response.headers.get('content-type') || 'image/jpeg';
        const mimeType = rawMimeType.split(';')[0].trim() as
            | 'image/jpeg'
            | 'image/png'
            | 'image/webp';

        return this.extractFromBase64(base64, mimeType);
    }

    private async _extract(base64Image: string, mediaType: string): Promise<ExtractResult> {
        const dataUrl = `data:${mediaType};base64,${base64Image}`;

        const chatCompletion = await this.client.chat.completions.create({
            // Meta-Llama-4 excels at visual JSON layout tracking
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: this.getPrompt() },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
            temperature: 0, // Keep at 0 for deterministic extractions
            max_tokens: 1024,
            response_format: { type: 'json_object' }, // Enforces JSON natively
        });

        const rawResponse = chatCompletion.choices[0]?.message?.content;
        if (!rawResponse) {
            throw new Error('No response content received from Groq API.');
        }

        return this.parseResponse(rawResponse);
    }

    private getPrompt(): string {
        return `You are an expert data extraction AI. Your task is to analyze the provided image of a Nigerian bank or fintech receipt (e.g., OPay, PalmPay, Kuda, Moniepoint, GTBank, Access, Zenith, UBA, Wema, FirstBank, Fidelity, Stanbic, Polaris, Sterling, Carbon, VFD, FairMoney, etc.) and extract transaction details into the requested JSON schema.

Analyze the image carefully. If a field is missing, not visible, or completely illegible, set its value to null.

### Expected JSON Schema:
{
  "amount_raw": "string or null (extract the amount exactly as written on the receipt, e.g., '5,000.00' or '₦2,500')",
  "amount": "number or null (parse the amount as a plain decimal number in Naira including kobo, e.g., 5000.75 — no commas, no currency symbol. If unreadable, use null)",
  "fee": "number or null (any service charge, VAT, or stamp duty shown separately as a plain decimal number)",
  "currency": "NGN",
  "direction": "debit | credit | unknown (debit = money left the account, credit = money was received)",
  "sender_name": "string or null",
  "sender_account": "string or null",
  "sender_bank": "string or null (the institution the money is leaving)",
  "recipient_name": "string or null",
  "recipient_account": "string or null",
  "recipient_bank": "string or null (the institution receiving the money)",
  "reference": "string or null (Transaction Reference, Session ID, or Ref ID)",
  "transaction_date": "string or null (extract raw text as it appears, e.g., '2026-06-15' or '15/06/2026 08:01')",
  "transaction_type": "transfer | payment | airtime | data | bill | cashout | withdrawal | deposit | other",
  "status": "successful | failed | pending | reversed",
  "platform": "opay | palmpay | kuda | moniepoint | gtb | access | zenith | uba | wema | firstbank | fidelity | stanbic | polaris | sterling | carbon | vfd | fairmoney | other",
  "platform_raw": "string or null (exact platform or bank name as written on the receipt)",
  "narration": "string or null (remarks, payment memo, or description)"
}

### Field Rules:
1. "platform": Look closely at the logo, background watermark, app name, or footer to identify the originating app or bank.
2. "transaction_type": POS withdrawal or merchant cash out → "cashout". ATM withdrawal → "withdrawal". Direct account credit → "deposit".
3. "direction": If the receipt says "Debit", "You sent", or "Transfer Out" → "debit". If it says "Credit", "You received", or "Transfer In" → "credit". Otherwise → "unknown".
4. "amount": Must be a plain number. Convert "5,000.00" → 5000.00, "₦2,500" → 2500. If you cannot parse it confidently, set to null and preserve the raw value in "amount_raw".
5. Normalize all enum fields ("direction", "transaction_type", "status", "platform") to lowercase matching the schema options exactly.
6. If the receipt is partial, cropped, or unclear, extract whatever is visible and null the rest.`;
    }

    private parseResponse(rawResponse: string): ExtractResult {
        try {
            // Clean markdown blocks if the LLM leaked any despite JSON mode
            const cleaned = rawResponse.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            // Post-processing: enforce lowercase constraints on enum fields
            const transaction: TransactionRecord = {
                ...parsed,
                status: parsed.status?.toLowerCase() ?? null,
                transaction_type: parsed.transaction_type?.toLowerCase() ?? null,
                platform: parsed.platform?.toLowerCase() ?? null,
                direction: parsed.direction?.toLowerCase() ?? null,
                // Ensure amount is a number or null — guard against the model returning a string
                amount:
                    parsed.amount !== null && parsed.amount !== undefined
                        ? Number(parsed.amount)
                        : null,
                // Ensure fee is a number or null
                fee: parsed.fee !== null && parsed.fee !== undefined ? Number(parsed.fee) : null,
            };

            // If amount coercion produced NaN, fall back to null
            if (transaction.amount !== null && isNaN(transaction.amount)) {
                transaction.amount = 0;
            }
            if (transaction.fee !== null && isNaN(transaction.fee)) {
                transaction.fee = 0;
            }

            return { transaction, rawResponse };
        } catch (error) {
            // Return raw response alongside the error so callers can debug or retry
            return {
                transaction: null,
                rawResponse,
                error: `Failed to parse Groq extraction response: ${(error as Error).message}`,
            };
        }
    }
}
