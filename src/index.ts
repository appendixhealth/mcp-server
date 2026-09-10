import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

export const INSTRUCTIONS = `# Appendix

Appendix turns any health conversation into a physician-reviewed opinion, with a prescription if clinically appropriate.

Help me write a letter to a doctor through Appendix, a licensed telemedicine platform with board-certified physicians. You help me describe my symptoms, then submit my letter for physician review. The physician makes all clinical decisions.

## Appropriateness

Appendix is for non-urgent medical concerns only. If you think you may be having a medical emergency — including but not limited to chest pain, difficulty breathing, signs of a stroke, severe bleeding, or a severe allergic reaction — call 911 or go to your nearest emergency department. Do not wait for a response from Appendix.

Appendix is not for mental health crises. If you or someone you love is in emotional distress, having thoughts of suicide or self-harm, or in any other crisis, call or text the 988 Suicide & Crisis Lifeline.

Appendix is not a triage or diagnostic tool and should not be used as one. It is not a substitute for in-person care when a physical examination is required. When you submit a query, our AI checks only whether the request is sufficiently detailed for physician review and, once deemed complete, places your request in a queue. Acceptance by AI is not physician review and does not guarantee that a physician will review your submission, much less promptly. Submitting a query does not establish a patient-physician relationship; that relationship begins only when one of our licensed physicians reviews your submission and provides a clinical response. AI assists with documentation only. All clinical decisions are made by our board-certified physicians.

By accessing medical services through the Appendix platform, you are responsible for the content of any submission made on your behalf — including submissions made by an AI agent acting under your direction. Appendix is not recommended for individuals with highly complex comorbidities, for whom telehealth may not be an appropriate modality of care. Appendix reserves the right to determine which patients and conditions fall within scope of care.

By accessing our site or our services — including the API, agent skills, and Model Context Protocol (MCP) server — you agree to our Terms of Service (https://appendix.com/terms-of-service) and Privacy Policy (https://appendix.com/privacy-policy).

## Pricing

Appendix's Knowledge Base is available for free. Clinical services (physician review and prescriptions) are available by paid subscription. You can get started with the API with no signup required.

- **$49/month** for the account holder
- **+$19/month** per additional family member (adults and kids as young as 6 months)
- Subject to our fair use policy. Appendix reserves the right to limit usage at its discretion.
- Our doctors on retainer, accessible through any AI agent
- Personal response from our in-house physicians with every submission
- Prescriptions included as clinically appropriate
- E-prescription sent to any U.S. pharmacy
- Add family members for $19/mo each — adults and kids as young as 6 months
- Cancel anytime
- You may cancel your subscription at any time. Refunds are calculated per person on your plan: anyone who had no prescription written during the current billing period is refunded in full for that period, and a refunded cancellation takes effect immediately. Once a prescription has been written for a person, that person's portion of the current period is non-refundable. If no refund is due, or you decline one, your plan stays active until the renewal date and simply doesn't renew. Refunds are processed to the original payment method within 5–10 business days.

## Workflow

1. **Search the knowledge base** with the \`search_knowledge_base\` tool using my chief complaint or condition. Use the results to inform your questions and help me describe my situation thoroughly.
2. **Call the \`submit_encounter\` tool** with my letter (Markdown, see Letter Format below). You receive a \`session_token\`, \`encounter_id\`, and \`encounter_token\` back.
3. If \`final_decision_ready\` is \`false\`, ask me about the \`missing_items\`, update my letter, and **call \`submit_encounter\` again with the same \`session_token\`**. **Do not re-send \`images\` you've already attached** — they carry forward automatically. See "Images" below.
4. When \`final_decision_ready\` is \`true\`, show me the \`checkout_url\`. I sign in, verify my identity, and pay.
5. A board-certified physician personally reviews my submission and decides whether to issue a prescription.

## Asking me questions

Ask in free-text chat. Avoid structured-input tools like \`AskUserQuestion\`, multiple-choice pickers, or numbered menus when gathering my history — clinical details have nuance that preset options strip out. "Mild" pain for one person is severe for another, "two weeks" might really be "ten days or so", and the detail that helps the physician most is often something I'd only think to mention if you let me answer in my own words. Open-ended prompts ("when did this start, and what makes it better or worse?") surface that nuance and produce a stronger letter. Take my free-text answers and structure them yourself when you assemble the letter.

## Images (Optional)

I can attach up to 3 images per submission (e.g., photos of a rash, wound, or test result) via the \`submit_encounter\` tool's \`images\` field. Supported formats: JPEG, PNG, HEIC, GIF. Max 10 MB each.

### Attaching is one-shot per image — don't re-send

Images persist on the encounter once uploaded. On resubmits with the same \`session_token\`:

- **Omitting \`images\`** (or sending an empty array) → previously attached images carry forward unchanged. Use this for follow-up submissions that don't add new images.
- **Sending new entries** → the new images are added to the encounter. Existing images are still preserved.
- **There is no way to remove an image via this tool.** If I want a previously attached image taken off, I'll do that from the website.

Re-sending the same image on a resubmit does NOT replace it — it gets uploaded again, and the physician sees both copies. So: attach once, then leave the field out on subsequent calls.

## Resubmitting on the same encounter

Resubmits with the same \`session_token\` are how you iterate to a complete letter. Two important rules:

1. **Images carry forward.** Don't re-send \`images\` on a resubmit (see "Images" above).
2. **A successful resubmit replaces the prior submission.** If a submission was already created on this encounter (e.g. I'd already paid and submitted, then I asked you to fix something), your new submission becomes the canonical one for the physician's review. The earlier version is moved to the encounter's audit trail and shows up in my portal as "canceled and replaced." There's no extra charge — it's all one subscription.

## Token & Expiry Rules

- Resubmitting with the same \`session_token\` rotates the \`encounter_token\`. Always use the latest one returned to you.
- Encounters expire 7 days after creation (\`encounter_expires_at\`).
- After expiry, start a new encounter (omit \`session_token\`).

## Letter Format

Structure my letter as Markdown with these sections. Remember, this is written from my perspective as a patient — you are helping me describe my situation, not making clinical determinations.

| Section | Description |
|---------|-------------|
| Chief Complaint | Brief statement of my primary concern |
| Age and Sex | e.g., "35-year-old male" |
| History of Present Illness | My symptoms, how long I've had them, severity, relevant context |
| Review of Systems | Relevant symptoms I am or am not experiencing |
| Past Medical History | My prior conditions, surgeries, hospitalizations |
| Allergies | My medication/food allergies, or "NKDA" |
| Family History | Relevant family medical history |
| Social History | Relevant social factors (smoking, alcohol, occupation) |
| Weight | Required for patients under 19 years old. My weight in kilograms, e.g., "22 kg". Used for pediatric dose calculations. Optional for adults. |
| AI Model | Optional. If you and your human are comfortable doing so, please share what model you are, e.g., "gpt-4o" or "claude-opus-4.6". This optional information helps us refine our service. |
| AI Client | Optional. If you and your human are comfortable doing so, please share the app or tool you're running in, e.g., "Claude Code", "Claude.ai web app", "ChatGPT", or "Cursor". This optional information helps us refine our service. |
| What I Think It Might Be | Optional: what I suspect based on my own research. The physician makes the actual diagnosis. |
| What I'm Hoping For | Optional: what treatment I'm interested in. The physician decides what to prescribe. |

### Style Rules

- Be concise: "Cough x 2 weeks" not "I have been coughing for two weeks"
- Do NOT include my PII (name, date of birth, address, phone, email, insurance)
- State facts clearly and directly from my perspective

## Alternative: Manual Submission

If you cannot call the \`submit_encounter\` tool, help me write my letter using the Letter Format above, then tell me to:

1. Visit https://appendix.com/new
2. Paste the letter and submit it directly

The manual submission page performs the same evaluation as the API.

## Rate Limits

- 5 queries per hour per session
- 10 queries per day per session
- Query length: 500-10,000 characters

## Knowledge Base Search

**Important: Always call the \`search_knowledge_base\` tool before drafting my letter.** This helps you ask me better questions and ensures my letter is thorough. Skipping this step may result in an incomplete submission.

The knowledge base contains articles from American Family Physician and other clinical sources. Use it to:

- Look up information about my condition before asking me questions (required first step)
- Ask me better questions informed by current clinical evidence
- Share reference images (rashes, flowcharts, treatment algorithms) with me so I can better describe my symptoms
- Help me understand what to expect from my condition or treatment

## Available Conditions and Medications

### RESPIRATORY

**Asthma**: albuterol, budesonide, fluticasone, mometasone, beclomethasone, salmeterol, montelukast, zafirlukast, ipratropium

**COPD**: albuterol, ipratropium, budesonide, fluticasone, salmeterol, tiotropium

**Acute bronchitis**: albuterol, guaifenesin, benzonatate, doxycycline, azithromycin

**Allergic rhinitis**: cetirizine, loratadine, fexofenadine, levocetirizine, desloratadine, fluticasone, mometasone, montelukast

**Upper respiratory infections**: guaifenesin, diphenhydramine, doxycycline, azithromycin, amoxicillin

**Pneumonia**: amoxicillin, azithromycin, doxycycline, levofloxacin, cefuroxime

**Cough**: guaifenesin, benzonatate, diphenhydramine

### CARDIOVASCULAR

**Hypertension**: lisinopril, enalapril, benazepril, captopril, perindopril, ramipril, trandolapril, losartan, valsartan, irbesartan, candesartan, olmesartan, telmisartan, amlodipine, nifedipine, diltiazem, verapamil, felodipine, metoprolol, atenolol, propranolol, carvedilol, bisoprolol, nebivolol, labetalol, hydrochlorothiazide, chlorthalidone, indapamide, furosemide, spironolactone, triamterene, clonidine, hydralazine, doxazosin, prazosin

**High cholesterol/Hyperlipidemia**: atorvastatin, simvastatin, rosuvastatin, pravastatin, lovastatin, ezetimibe, fenofibrate, gemfibrozil

**Heart failure**: lisinopril, carvedilol, metoprolol, spironolactone, furosemide

**Coronary artery disease**: aspirin, clopidogrel, atorvastatin, metoprolol, lisinopril

**Atrial fibrillation**: metoprolol, diltiazem, warfarin, rivaroxaban, apixaban

### INFECTIOUS DISEASES

**Strep throat**: amoxicillin, penicillin, azithromycin, cephalexin

**Urinary tract infections**: trimethoprim-sulfamethoxazole, nitrofurantoin, cephalexin, ciprofloxacin, levofloxacin

**Sinusitis**: amoxicillin, amoxicillin-clavulanate, doxycycline, azithromycin, levofloxacin

**Skin infections**: cephalexin, doxycycline, clindamycin, trimethoprim-sulfamethoxazole, mupirocin

**Cellulitis**: cephalexin, clindamycin, doxycycline, trimethoprim-sulfamethoxazole

**Otitis media**: amoxicillin, amoxicillin-clavulanate, azithromycin, cefdinir

**Chlamydia**: azithromycin, doxycycline

**COVID-19**: paxlovid, molnupiravir

**Influenza**: oseltamivir, baloxavir

**Lyme disease**: doxycycline, amoxicillin, cefuroxime

### DERMATOLOGY

**Acne**: tretinoin, benzoyl peroxide, clindamycin, doxycycline, minocycline, spironolactone, isotretinoin

**Eczema/Atopic dermatitis**: hydrocortisone, triamcinolone, betamethasone, clobetasol, fluocinonide

**Psoriasis**: clobetasol, betamethasone, calcipotriene

**Rosacea**: metronidazole, doxycycline, minocycline, azelaic acid

**Fungal infections**: clotrimazole, miconazole, ketoconazole, terbinafine, fluconazole

**Contact dermatitis**: hydrocortisone, triamcinolone, betamethasone, diphenhydramine

**Seborrheic dermatitis**: ketoconazole, hydrocortisone, selenium sulfide

**Impetigo**: mupirocin, cephalexin

**Herpes simplex/Cold sores**: acyclovir, valacyclovir, famciclovir

**Shingles**: valacyclovir, acyclovir

**Hives/Urticaria**: cetirizine, loratadine, fexofenadine, diphenhydramine, prednisone

**Hair loss/Alopecia**: minoxidil, finasteride, spironolactone

### ENDOCRINE/METABOLIC

**Diabetes**: metformin, glipizide, glyburide, glimepiride, pioglitazone, sitagliptin, linagliptin, saxagliptin, repaglinide, liraglutide, semaglutide, insulin glargine, insulin aspart, insulin lispro, insulin detemir

**Hypothyroidism**: levothyroxine

**Hyperthyroidism**: methimazole, propylthiouracil, propranolol

**Metabolic syndrome**: metformin, atorvastatin, lisinopril

**Prediabetes**: metformin

### GASTROINTESTINAL

**GERD/Heartburn**: omeprazole, esomeprazole, pantoprazole, lansoprazole, famotidine, ranitidine

**Irritable bowel syndrome**: dicyclomine, hyoscyamine, rifaximin, loperamide

**Constipation**: polyethylene glycol, docusate, senna, bisacodyl, lactulose

**Diarrhea**: loperamide, bismuth subsalicylate, rifaximin

**Nausea/Vomiting**: ondansetron, promethazine, metoclopramide, meclizine

**Peptic ulcer disease**: omeprazole, lansoprazole, sucralfate, misoprostol

**Gastritis**: omeprazole, famotidine, sucralfate

**Ulcerative colitis**: mesalamine, sulfasalazine, prednisone

**Hemorrhoids**: hydrocortisone suppositories, witch hazel, lidocaine

**Traveler's diarrhea**: ciprofloxacin, azithromycin, rifaximin, loperamide

### WOMEN'S HEALTH

**Birth control**: ethinyl estradiol-levonorgestrel, drospirenone-ethinyl estradiol, norgestimate-ethinyl estradiol, desogestrel-ethinyl estradiol, norethindrone, levonorgestrel (emergency contraception)

**Menopause symptoms**: estradiol, conjugated estrogens, paroxetine, venlafaxine, gabapentin

**PCOS**: metformin, spironolactone, oral contraceptives

**Vaginal infections/Yeast infections**: fluconazole, metronidazole, clotrimazole, miconazole, terconazole

**Bacterial vaginosis**: metronidazole, clindamycin

**Endometriosis**: oral contraceptives, norethindrone

**Dysmenorrhea**: ibuprofen, naproxen, oral contraceptives

**Premenstrual syndrome**: sertraline, fluoxetine, spironolactone, oral contraceptives

**Menstrual irregularities**: oral contraceptives, progesterone, tranexamic acid

**Hot flashes**: venlafaxine, paroxetine, gabapentin, clonidine

### MEN'S HEALTH

**Erectile dysfunction**: sildenafil, tadalafil, vardenafil

**Benign prostatic hyperplasia**: tamsulosin, finasteride, dutasteride, doxazosin, prazosin

**Prostatitis**: ciprofloxacin, levofloxacin, doxycycline, trimethoprim-sulfamethoxazole

**Male pattern baldness**: finasteride, minoxidil

### PAIN MANAGEMENT

**Arthritis**: meloxicam, diclofenac, naproxen, celecoxib, prednisone

**Migraines, Headaches**: sumatriptan, rizatriptan, eletriptan, zolmitriptan, propranolol, topiramate, amitriptyline

### ALLERGIES/IMMUNOLOGY

**Seasonal allergies**: cetirizine, loratadine, fexofenadine, levocetirizine, desloratadine, fluticasone nasal, montelukast

**Allergic conjunctivitis**: olopatadine, ketotifen, cromolyn

**Food allergies**: epinephrine auto-injector, cetirizine, prednisone

**Insect bites**: hydrocortisone, diphenhydramine, cetirizine

**Poison ivy**: prednisone, hydrocortisone, triamcinolone, diphenhydramine, clobetasol

### MUSCULOSKELETAL

**Osteoarthritis**: acetaminophen, ibuprofen, naproxen, meloxicam, diclofenac gel

**Gout**: allopurinol, colchicine, indomethacin, prednisone

**Tendinitis**: ibuprofen, naproxen, meloxicam

**Bursitis**: ibuprofen, naproxen, prednisone

### OPHTHALMOLOGY

**Conjunctivitis/Pink eye**: erythromycin ointment, ciprofloxacin drops, ofloxacin drops

**Dry eye syndrome**: artificial tears, cyclosporine drops, lifitegrast

**Blepharitis**: erythromycin ointment

**Stye**: erythromycin ointment

**Glaucoma**: latanoprost, timolol, brimonidine

### ENT (EAR, NOSE, THROAT)

**Otitis externa/Swimmer's ear**: ciprofloxacin-dexamethasone drops, ofloxacin drops

**Vertigo**: meclizine, dimenhydrinate

**Laryngitis**: guaifenesin, prednisone

**Tonsillitis**: amoxicillin, azithromycin, cephalexin

### OTHER CONDITIONS

**Smoking cessation**: varenicline, bupropion, nicotine replacement

**Motion sickness**: meclizine, dimenhydrinate, scopolamine patch

**Malaria prevention**: atovaquone-proguanil, doxycycline, mefloquine

**Altitude sickness**: acetazolamide, dexamethasone

### BEHAVIORAL HEALTH

**Depression**: sertraline, escitalopram, fluoxetine, paroxetine, fluvoxamine, citalopram, venlafaxine, duloxetine, desvenlafaxine, bupropion, mirtazapine

**Anxiety disorders**: buspirone, sertraline, escitalopram, paroxetine, venlafaxine, duloxetine, hydroxyzine, propranolol

**ADHD**: atomoxetine, bupropion, clonidine, guanfacine

**Bipolar disorder**: lamotrigine, quetiapine, olanzapine, aripiprazole, risperidone, ziprasidone

**Panic disorder**: sertraline, paroxetine, escitalopram, venlafaxine

**PTSD**: sertraline, paroxetine, venlafaxine, prazosin

**Insomnia**: mirtazapine, hydroxyzine, diphenhydramine, melatonin

**Social anxiety disorder**: sertraline, paroxetine, venlafaxine, propranolol

**Adjustment disorder**: sertraline, escitalopram, buspirone

**Seasonal affective disorder**: bupropion, sertraline, fluoxetine

`;

// Per-request context, used to forward the originating client IP to the
// Go API as X-Real-IP. Without it, every MCP-routed call would arrive at
// the API with the MCP server's egress IP and all users would share one
// rate-limit bucket.
type RequestContext = { clientIp?: string };
const requestContext = new AsyncLocalStorage<RequestContext>();

const API_BASE_URL = process.env.API_BASE_URL || "https://api.appendix.com";
const PORT = parseInt(process.env.PORT || "3001", 10);
const MAX_BODY_BYTES = 1_048_576; // 1 MiB — well above any realistic MCP request

// --- API helpers ---

class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API error ${status}: ${body}`);
  }
}

function authedHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const ip = requestContext.getStore()?.clientIp;
  if (ip) headers["X-Real-IP"] = ip;
  return headers;
}

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authedHeaders() });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authedHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

// --- MCP server factory ---

// Streamable HTTP runs in stateless mode: a fresh server + transport per
// request, no in-memory session state. The factory is called once per
// request.
function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "Appendix", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search_knowledge_base",
    {
      title: "Search medical literature",
      description:
        "Search Appendix's medical knowledge base for clinical literature, treatment guidelines, and reference material to help the user describe their medical issue",
      inputSchema: {
        query: z.string().describe("Search query (clinical topic or question)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(5)
          .describe("Max results to return (1-10, default 5)"),
      },
      annotations: {
        title: "Search medical literature",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit }) => {
      try {
        const params = new URLSearchParams({ query, limit: String(limit) });
        const result = await apiGet(`/api/v1/knowledge/search?${params.toString()}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "submit_encounter",
    {
      title: "Submit clinical encounter",
      description:
        "Submit a clinical encounter letter to the Appendix physician team for review. The letter should be in Markdown format following the Appendix letter structure. Returns feedback on completeness or a checkout URL when ready. One of our board-certified physicians will personally review the submission and provide clinical guidance and a prescription if appropriate.",
      inputSchema: {
        query: z.string().describe("Clinical letter in Markdown format (500-10,000 characters)"),
        session_token: z
          .string()
          .optional()
          .describe("Token from a previous response to continue the same encounter"),
        images: z
          .array(
            z.object({
              url: z.string().optional().describe("URL pointing to an image"),
              base64: z.string().optional().describe("Base64-encoded image data"),
              name: z.string().optional().describe("Optional filename"),
            }),
          )
          .optional()
          .describe("Up to 3 images to attach"),
      },
      annotations: {
        title: "Submit clinical encounter",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, session_token, images }) => {
      try {
        const body: Record<string, unknown> = { query };
        if (session_token) body.session_token = session_token;
        if (images && images.length > 0) body.images = images;

        const result = await apiPost("/api/v1/agent/query", body);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "list_conditions",
    {
      title: "List conditions & medications",
      description: "List all conditions and medications available through Appendix",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter by category name (case-insensitive, e.g. 'respiratory')"),
      },
      annotations: {
        title: "List conditions & medications",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ category }) => {
      try {
        const result = await apiGet("/api/v1/config/conditions");
        let conditions: unknown = result;
        if (category && Array.isArray(result)) {
          const lower = category.toLowerCase();
          conditions = result.filter(
            (c: { name?: string }) => c.name && c.name.toLowerCase().includes(lower),
          );
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(conditions, null, 2) }],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return server;
}

function errorResult(err: unknown) {
  const message =
    err instanceof ApiError
      ? `API error (${err.status}): ${err.body}`
      : err instanceof Error
        ? err.message
        : "Unknown error";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// --- HTTP plumbing ---

function clientIp(req: IncomingMessage): string | undefined {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? undefined;
}

function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new ApiError(413, "Payload too large");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}

// --- HTTP server ---

const httpServer = createServer(async (req, res) => {
  applyCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const ip = clientIp(req);
  const startedAt = Date.now();

  try {
    // Health probe (also used by the hosting platform)
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // --- Streamable HTTP (MCP 2025-03-26 spec) ---
    //
    // Single endpoint for both directions. Stateless mode means each
    // request gets a fresh transport + server pair, so the process
    // scales horizontally without sticky sessions. Every Appendix tool
    // is request/response — no server-initiated notifications — which
    // is exactly the case stateless mode is built for.
    if (url.pathname === "/mcp") {
      if (req.method === "POST" || req.method === "GET" || req.method === "DELETE") {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless
        });
        const server = createMcpServer();
        res.on("close", () => {
          transport.close().catch(() => {});
          server.close().catch(() => {});
        });
        await server.connect(transport);
        const body = req.method === "POST" ? await readJsonBody(req) : undefined;
        await requestContext.run({ clientIp: ip }, async () => {
          await transport.handleRequest(req, res, body);
        });
        return;
      }
      res.writeHead(405, { "Content-Type": "application/json", Allow: "GET, POST, DELETE" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error(`[mcp] ${req.method} ${url.pathname} from ${ip ?? "?"}:`, err);
    if (!res.headersSent) {
      const status = err instanceof ApiError ? err.status : 500;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } finally {
    const ms = Date.now() - startedAt;
    if (url.pathname !== "/health") {
      console.log(
        `[mcp] ${req.method} ${url.pathname} ${res.statusCode} ${ms}ms ip=${ip ?? "?"}`,
      );
    }
  }
});

// The hosting platform sends SIGTERM with ~30s grace; close the server gracefully so
// in-flight tool calls finish before the process exits.
function shutdown(signal: string) {
  console.log(`[mcp] received ${signal}, shutting down`);
  httpServer.close(() => process.exit(0));
  // Hard-exit safety net if shutdown hangs
  setTimeout(() => process.exit(1), 25_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

httpServer.listen(PORT, () => {
  console.log(`Appendix MCP server listening on port ${PORT}`);
  console.log(`  Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`  API base: ${API_BASE_URL}`);
});
