# receipt-ocr-ng

**AI‑powered receipt OCR for Nigerian fintech transactions** (Opay, PalmPay, Kuda, Moniepoint, GTBank, etc.). Extracts structured transaction data directly from receipt images.

[![npm version](https://badge.fury.io/js/receipt-ocr-ng.svg)](https://www.npmjs.com/package/receipt-ocr-ng)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- 📸 **Vision‑based extraction** – uses Groq’s Llama 4 Scout (free tier) to read text from images.
- 🇳🇬 **Nigerian fintech focus** – works with OPay, PalmPay, Kuda, Moniepoint, GTB, Access, Zenith, UBA, etc.
- 🧾 **Structured output** – returns a clean JSON object (amount, sender, recipient, reference, date, status, etc.).
- ⚡ **Fast & cheap** – Groq’s free tier gives 30 requests/minute, 14,400/day – no credit card required.
- 🔌 **Simple API** – `extractFromBase64` and `extractFromUrl` methods.

## 📦 Installation

```bash
npm install receipt-ocr-ng groq-sdk
# or
pnpm add receipt-ocr-ng groq-sdk
```

## 🔑 Setup

1. Get a **Groq API key** from [console.groq.com](https://console.groq.com/keys) (free).
2. Set the key in your environment (e.g., `.env`):

```bash
GROQ_API_KEY=gsk_your_key_here
```

## 🧪 Usage

### TypeScript / JavaScript

```typescript
import { createExtractor } from 'receipt-ocr-ng';

const extractor = createExtractor({
    groqApiKey: process.env.GROQ_API_KEY!,
});

// From base64 image string
const base64Image = 'iVBORw0KGgoAAAANS...'; // your image base64
const result = await extractor.extractFromBase64(base64Image, 'image/jpeg');

console.log(result.transaction);
// {
//   amount: 2000,
//   currency: "NGN",
//   sender: "PRECIOUS OLAMILEKAN OLUSOLA",
//   recipient: "GUNYEMI OLAWANDE HANNAH",
//   recipient_account: "0472940898",
//   bank: "Guaranty Trust Bank",
//   reference: "260508020100032703690636",
//   transaction_date: "2026-05-08T10:01:09.000Z",
//   transaction_type: "payment",
//   status: "successful",
//   platform: "opay",
//   narration: "YouTube music subscription"
// }
```

### From a public image URL

```typescript
const result = await extractor.extractFromUrl('https://example.com/receipt.jpg');
```

## 🧠 Output Schema

```typescript
interface TransactionRecord {
    amount: number; // in Naira
    currency: 'NGN';
    sender: string | null;
    recipient: string | null;
    recipient_account: string | null;
    bank: string | null;
    reference: string | null;
    transaction_date: string | null; // ISO 8601
    transaction_type: 'transfer' | 'payment' | 'airtime' | 'bill' | 'other';
    status: 'successful' | 'failed' | 'pending';
    platform:
        | 'opay'
        | 'palmpay'
        | 'kuda'
        | 'moniepoint'
        | 'gtb'
        | 'access'
        | 'zenith'
        | 'uba'
        | 'wema'
        | 'other';
    narration: string | null;
}
```

## ⚠️ Rate Limits (Free Tier – Groq)

- **Requests per minute**: 30 (average)
- **Requests per day**: 14,400
- **Image size limit**: 20 MB
- **Output tokens**: up to 8,192 per call

You can process ~1 receipt every 2 seconds without hitting limits. For higher volume, implement a simple queue or rate limiter.

## 🛠️ Development

```bash
git clone https://github.com/codepraycode/dispacc-receipt-ocr.git
cd dispacc-receipt-ocr
pnpm install
pnpm build
```

## 📄 License

MIT © [codepraycode](https://github.com/codepraycode)

## 🤝 Contributing

Issues and pull requests are welcome! Please open an issue first to discuss changes.

## 🙏 Acknowledgements

- [Groq](https://groq.com) for the fast, free vision inference.
- [Llama 4 Scout](https://console.groq.com/docs/models) by Meta.
