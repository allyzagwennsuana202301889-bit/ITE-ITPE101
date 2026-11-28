# Artistry AI Integration

## 1. Overview

The Artistry AI Assistant helps customers ask product-related questions and
receive database-verified product recommendations. The implementation uses
Groq with the OpenAI-compatible Node.js SDK.

The backend sends a customer's question and a limited product context to Groq.
Product names, categories, prices, stock quantities, descriptions, and images
shown to the user are subsequently loaded or reloaded from MySQL; they are not
trusted solely from the model's text.

## 2. Configuration

| Item | Implementation |
|---|---|
| Provider | Groq |
| API compatibility | OpenAI-compatible API |
| Base URL | `https://api.groq.com/openai/v1` |
| Model | `openai/gpt-oss-120b` |
| Backend SDK | OpenAI Node.js SDK |
| API key | `GROQ_API_KEY` in `server/.env` |
| Timeout | 15 seconds |
| Retries | Disabled |
| Maximum response | 800 tokens |

`GROQ_API_KEY` is read only by the backend. It must not be placed in
`VITE_*` frontend variables or committed to source control.

## 3. Request Endpoint

Frontend component: `client/src/AIAssistant.jsx`

Endpoint:

```http
POST /api/v1/ai/ask
Content-Type: application/json
```

Example request:

```json
{
  "question": "Recommend watercolor supplies for beginners."
}
```

The endpoint is public and uses IP-based rate limiting; it does not require a
JWT. It accepts a non-empty string of at most 1,000 characters.

## 4. Request Validation

| Condition | Response |
|---|---|
| Missing, empty, or non-string question | HTTP 400, `INVALID_QUESTION` |
| Question longer than 1,000 characters | HTTP 400, `QUESTION_TOO_LONG` |
| More than 10 requests in 15 minutes from the same IP | HTTP 429, `AI_RATE_LIMITED` |
| Provider, parsing, or response-validation failure | HTTP 503, `AI_UNAVAILABLE` |

The rate-limiter response uses a top-level `code` and `message`. The frontend
also prevents AI requests while the browser reports being offline.

## 5. Database-Grounded Product Retrieval

Before calling Groq, `server/services/aiAssistant.js`:

1. Converts the question to lowercase and extracts alphanumeric words.
2. Removes a short stop-word list and uses up to eight keywords.
3. Searches product name, category, and description fields.
4. Keeps only active products with stock greater than zero.
5. Supplies at most 12 candidate products to the model.

The model is told that this product list is its available database context.
No database candidate is sent to the model if the question yields no relevant
keywords or search matches.

## 6. Prompt and Structured Response

The backend requests JSON-formatted output with:

- `answer`: a text response
- `products`: an array of objects containing product `id` values

The system prompt directs the model to:

- treat the question only as customer input;
- recommend only supplied database products;
- return no invented product IDs or specifications;
- recommend only products with stock;
- return an empty product array when no suitable product exists;
- return only valid JSON.

These are prompt instructions, not a substitute for backend validation.

## 7. Backend Verification

After Groq returns a response, the backend:

1. Parses the JSON response.
2. Requires `answer` to be a string and `products` to be an array.
3. Keeps only integer IDs found in the original candidate set.
4. Removes duplicate IDs.
5. Requeries MySQL for active status and stock greater than zero.
6. Limits the verified product list to IDs that pass this final check.

If verified products exist, the backend replaces the model-generated answer
with:

```text
Here are some products from our database that match your request.
Their descriptions and details are shown below.
```

The model-generated answer is retained only when no verified products are
returned, and the answer is truncated to 5,000 characters.

The `/ai/ask` route additionally loads verified product fields from the
database and returns `id`, `name`, `category`, `price`, `stock`,
`description`, and `imageUrl`.

## 8. Frontend Behavior

The AI assistant chat is implemented in `client/src/AIAssistant.jsx`. It:

- displays an introductory message;
- submits questions from a text form;
- shows the backend answer and database product cards;
- displays a reconnect message when offline;
- offers standard product-search navigation when the AI service is unavailable.

Product cards use database fields returned by the backend. The chat is disclosed
as AI-assisted.

## 9. Error Handling

Provider, timeout, empty-response, JSON parsing, and response-validation
failures reach the route as exceptions. The route logs a server-side error
message and returns HTTP 503 with `AI_UNAVAILABLE`; raw provider error details
are not exposed to the frontend.

A missing or malformed question does not call the AI provider. An offline
browser also avoids sending the request.

## 10. Privacy and Security Limitations

- The API key remains in backend environment configuration.
- The request includes only the question and database-grounded product context.
- The implementation does not intentionally send passwords or JWT tokens to
  Groq.
- Questions are sent to an external provider and should not contain sensitive
  personal information.
- IP-based rate limiting is in-memory and resets when the server process
  restarts.
- Prompt instructions reduce but do not eliminate the need for backend
  validation and database verification.
- General AI text can still contain incorrect or incomplete art advice when
  no verified product is available.
- Search matching is keyword-based and may miss relevant products that use
  different wording.

## 11. Main Implementation Files

- `server/routes/ai.js`: endpoint, validation, and rate limiting
- `server/services/aiAssistant.js`: retrieval, prompt, provider request, and
  product-ID validation
- `client/src/AIAssistant.jsx`: chat interface and frontend error handling
- `client/src/api.js`: API base, bearer header, and response-error handling
