const API_URL = 'https://api.openai.com/v1/chat/completions';

const callOpenAI = async (messages, model = 'gpt-4o-mini', temperature = 0.7) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key is not configured.');
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content);
};

exports.generateProductContent = async (productName, brand = '', category = '', inputLanguage = 'English', mode = 'search', existingData = {}) => {
    const jsonSchema = `{
  "found": true or false,
  "name_en": "Product name in English",
  "name_ar": "Product name in Arabic",
  "brand": "Brand/manufacturer name (empty string if unknown or not found)",
  "description_en": "2-3 sentence description in English",
  "description_ar": "2-3 sentence description in Arabic",
  "ingredients_en": "Key ingredients in English",
  "ingredients_ar": "Key ingredients in Arabic",
  "howToUse_en": "How to use instructions in English",
  "howToUse_ar": "How to use instructions in Arabic",
  "features_en": "Key features and benefits in English",
  "features_ar": "Key features and benefits in Arabic"
}`;

    let systemPrompt;
    let userPrompt;

    if (mode === 'enhance') {
        systemPrompt = `You are an expert bilingual (English and Arabic) marketing copywriter for a high-end beauty/wellness brand.
Enhance and professionally polish the user-provided product content. Keep the same meaning but make it more professional and marketable.
Always set "found": true in enhance mode.
Return ONLY a valid JSON object with these exact keys:
${jsonSchema}`;
        userPrompt = `Product: ${productName}${brand ? ` by ${brand}` : ''}${category ? ` (${category})` : ''}
Language of product name: ${inputLanguage}
Content to enhance:
${existingData.description_en ? `- Description EN: ${existingData.description_en}` : ''}
${existingData.description_ar ? `- Description AR: ${existingData.description_ar}` : ''}
${existingData.ingredients_en ? `- Ingredients EN: ${existingData.ingredients_en}` : ''}
${existingData.ingredients_ar ? `- Ingredients AR: ${existingData.ingredients_ar}` : ''}
${existingData.howToUse_en ? `- How To Use EN: ${existingData.howToUse_en}` : ''}
${existingData.howToUse_ar ? `- How To Use AR: ${existingData.howToUse_ar}` : ''}
${existingData.features_en ? `- Features EN: ${existingData.features_en}` : ''}
${existingData.features_ar ? `- Features AR: ${existingData.features_ar}` : ''}`;
    } else {
        systemPrompt = `You are an expert beauty and wellness product researcher.
Search your training knowledge for the specific product provided.
If you recognize it as a real specific known product, set "found": true and fill all fields with accurate data.
If you do not recognize it, set "found": false and leave all other fields as empty strings.
Return ONLY a valid JSON object with these exact keys:
${jsonSchema}`;
        userPrompt = `Product Name (${inputLanguage}): ${productName}
${brand ? `Brand: ${brand}` : ''}
${category ? `Category: ${category}` : ''}`;
    }

    return callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ]);
};

exports.generateServiceContent = async (serviceName, category = '', inputLanguage = 'English') => {
    const systemPrompt = `You are an expert bilingual (English and Arabic) marketing copywriter for a high-end salon/spa/clinic.
Generate compelling service content based on the provided service name.
You MUST return ONLY a valid JSON object with these exact keys:
{
  "name_en": "Service name in English",
  "name_ar": "Service name in Arabic",
  "description_en": "A 2-3 sentence engaging description of the service in English.",
  "description_ar": "A 2-3 sentence engaging description of the service in Arabic.",
  "benefits": [
    {"en": "Benefit description in English", "ar": "Benefit description in Arabic"}
  ],
  "whatToExpect": [
    {"en": "What happens during this service in English", "ar": "What happens during this service in Arabic"}
  ]
}`;

    let userPrompt = `Service Name (${inputLanguage}): ${serviceName}\n`;
    if (category) {
        userPrompt += `Category: ${category}\n`;
    }

    return callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ]);
};

exports.translateText = async (text, targetLanguage) => {
    const jsonResponse = await callOpenAI([
        {
            role: 'system',
            content: `You are a professional translator specializing in beauty and wellness terminology.
Translate the text to ${targetLanguage}.
Return exactly requested in this JSON format:
{
  "translatedText": "The translated text here"
}`
        },
        { role: 'user', content: `Text to translate: ${text}` }
    ], 'gpt-4o-mini', 0.3);

    return jsonResponse.translatedText;
};

exports.generateAboutUsContent = async (storyText, facilitiesText = '', inputLanguage = 'English') => {
    const iconList = 'HeartIcon, StarIcon, SparklesIcon, BoltIcon, CheckCircleIcon, GlobeAltIcon, UserGroupIcon, TrophyIcon, ShieldCheckIcon, LightBulbIcon';
    const systemPrompt = `You are an expert bilingual (English and Arabic) brand storyteller for a luxury beauty/wellness business.
Based on the admin's "About Us" story, generate a professional and complete About Us page.
Return ONLY a valid JSON object - no extra text, no markdown:
{
  "storyEn": "Enhanced professional story in English (2-4 paragraphs)",
  "storyAr": "Enhanced professional story in Arabic (2-4 paragraphs)",
  "missions": [
    {
      "titleEn": "Mission title in English",
      "titleAr": "Mission title in Arabic",
      "detailsEn": "Mission details in English (1-2 sentences)",
      "detailsAr": "Mission details in Arabic (1-2 sentences)",
      "iconName": "OneIconFromList"
    }
  ],
  "visions": [
    {
      "titleEn": "Vision title in English",
      "titleAr": "Vision title in Arabic",
      "detailsEn": "Vision details in English (1-2 sentences)",
      "detailsAr": "Vision details in Arabic (1-2 sentences)",
      "iconName": "OneIconFromList"
    }
  ],
  "values": [
    {
      "titleEn": "Value title in English",
      "titleAr": "Value title in Arabic",
      "detailsEn": "Value description in English (1-2 sentences)",
      "detailsAr": "Value description in Arabic (1-2 sentences)",
      "iconName": "OneIconFromList"
    }
  ],
  "facilitiesEn": "Enhanced facilities description in English, or empty string",
  "facilitiesAr": "Enhanced facilities description in Arabic, or empty string"
}
Rules:
- Generate 2 to 5 items for EACH of missions, visions, values
- Each iconName MUST be exactly one from: ${iconList}
- Missions = what we do for clients. Visions = where we see ourselves. Values = core principles
- Preserve the original story meaning, only enhance the language and professionalism
- If no facilitiesText provided, return empty strings for facilitiesEn and facilitiesAr`;

    return callOpenAI([
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `Story Text (${inputLanguage}): ${storyText}${facilitiesText ? `\n\nFacilities Description (${inputLanguage}): ${facilitiesText}` : ''}`
        }
    ]);
};

exports.generateConsultantAnalysis = async (businessSnapshot, options = {}) => {
    const snapshotJson = JSON.stringify(businessSnapshot || {}, null, 2);
    const systemPrompt = `You are a senior salon business consultant for multi-tenant beauty businesses.
You do not sound like generic ChatGPT.
You analyze only the provided business snapshot and return a structured dashboard response for an enterprise consultant workspace.

Return ONLY valid JSON with exactly these top-level keys:
{
  "summary": "Concise executive summary. No markdown.",
  "healthScore": 84,
  "kpis": [
    {
      "type": "revenue|retention|rebooking|no-show|refunds",
      "label": "Human readable KPI label",
      "value": 0,
      "unit": "SAR|%|count|ratio",
      "delta": 0,
      "direction": "up|down|flat",
      "trend": "positive|negative|neutral"
    }
  ],
  "charts": [
    {
      "type": "line|bar|pie",
      "title": "Chart title",
      "description": "What the chart shows",
      "labels": [],
      "series": [
        {
          "name": "Series name",
          "data": []
        }
      ]
    }
  ],
  "tables": [
    {
      "title": "Table title",
      "description": "Why this table matters",
      "columns": [],
      "rows": [],
      "source": "Appointments|Payments|Refunds|Customers|Employees|Services|Products|Orders"
    }
  ],
  "alerts": [
    {
      "severity": "low|medium|high",
      "title": "Alert title",
      "detail": "What is happening and why it matters",
      "deepLink": "/dashboard/..."
    }
  ],
  "recommendations": [
    {
      "priority": "low|medium|high",
      "title": "Recommendation title",
      "detail": "Actionable recommendation",
      "deepLink": "/dashboard/..."
    }
  ],
  "actions": [
    {
      "title": "Action title",
      "detail": "Short action description",
      "module": "financial|reports|customers|appointments|employees|services|products|notifications|schedule|consultant",
      "deepLink": "/dashboard/...",
      "priority": "low|medium|high"
    }
  ]
}

Rules:
- healthScore must be an integer from 0 to 100.
- Use the snapshot numbers directly when possible.
- If a metric is missing, leave the related arrays empty rather than inventing data.
- Prefer concise, high-signal consultant language.
- The response must be structured and dashboard-ready.
- Every action should point to an existing workspace route when possible.
- Use charts only when the snapshot supports a real trend or comparison.
- Use tables only when the snapshot includes row-level or grouped data.`;

    const userPrompt = `Business snapshot JSON:
${snapshotJson}

Analytical focus:
- Revenue, growth, discounts, and refunds
- Retention, new customers, returning customers, and inactive customers
- No-shows, cancellations, and occupancy
- Employee revenue, productivity, completion, and commissions
- Product sales and quantity

Guidance:
- Keep the response operational, like a real salon consultant.
- Prefer data-backed findings over generic advice.
- Use deep links that help the tenant act immediately.`;

    const temperature = Number.isFinite(Number(options.temperature))
        ? Number(options.temperature)
        : 0.2;

    const model = options.model || 'gpt-4o-mini';

    return callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], model, temperature);
};
