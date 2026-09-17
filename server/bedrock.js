import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'us-east-1';

// A cross-region inference profile id. Override with BEDROCK_MODEL_ID; the target
// model must be enabled for your account in the Bedrock console for this region.
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

// No explicit credentials: the default provider chain resolves env vars locally
// and web-identity (IRSA) in-cluster.
const client = new BedrockRuntimeClient({ region: REGION });

const SYSTEM_INSTRUCTIONS = `You are a culinary assistant that rewrites an existing recipe so it satisfies the
dietary restrictions the user describes (for example: vegan, vegetarian, dairy-free,
nut-free, gluten-free, lower sodium, lower sugar).

Guidelines:
- Preserve the dish's intent, cooking technique, and overall structure.
- Keep the original number of servings unless the user asks to change it.
- Swap only what the restriction requires; call out each substitution in your reply.
- If a request is impossible without becoming a different dish, say so and suggest the
  closest faithful alternative.

Reply with a short conversational message. When you have a COMPLETE adapted recipe ready,
append a fenced code block exactly like this after your message:

\`\`\`json
{
  "title": "string",
  "servings": "string or null",
  "prepTime": "string or null",
  "cookTime": "string or null",
  "ingredients": ["string", "..."],
  "steps": ["string", "..."],
  "notes": "string summarising the substitutions"
}
\`\`\`

Only include the JSON block once the recipe is fully rewritten. If you are still asking
clarifying questions, omit it.`;

function serializeRecipe(recipe) {
  const lines = [
    `Title: ${recipe.title}`,
    recipe.servings ? `Servings: ${recipe.servings}` : null,
    recipe.prepTime ? `Prep time: ${recipe.prepTime}` : null,
    recipe.cookTime ? `Cook time: ${recipe.cookTime}` : null,
    '',
    'Ingredients:',
    ...(recipe.ingredients || []).map((item) => `- ${item}`),
    '',
    'Steps:',
    ...(recipe.steps || []).map((item, i) => `${i + 1}. ${item}`),
  ];
  return lines.filter((line) => line !== null).join('\n');
}

const JSON_BLOCK = /```json\s*([\s\S]*?)```/i;

function asStringArray(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return cleaned.length ? cleaned : null;
}

export function parseAdaptedRecipe(text) {
  const match = text.match(JSON_BLOCK);
  if (!match) return { reply: text.trim(), adaptedRecipe: null };

  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    // Model emitted a malformed block — treat the whole thing as prose.
    return { reply: text.trim(), adaptedRecipe: null };
  }

  const ingredients = asStringArray(parsed.ingredients);
  const steps = asStringArray(parsed.steps);
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  if (!title || !ingredients || !steps) {
    return { reply: text.trim(), adaptedRecipe: null };
  }

  const optionalString = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const adaptedRecipe = {
    title,
    servings: optionalString(parsed.servings),
    prepTime: optionalString(parsed.prepTime),
    cookTime: optionalString(parsed.cookTime),
    ingredients,
    steps,
    notes: optionalString(parsed.notes) || '',
  };

  const reply = text.replace(JSON_BLOCK, '').trim();
  return { reply, adaptedRecipe };
}

/**
 * Run one turn of the recipe-adaptation chat against Amazon Bedrock.
 *
 * @param {object} args
 * @param {object} args.recipe   The source recipe (used as context).
 * @param {Array<{role: 'user'|'assistant', content: string}>} args.messages
 * @returns {Promise<{reply: string, adaptedRecipe: object|null}>}
 */
export async function adaptRecipeChat({ recipe, messages }) {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [
      { text: SYSTEM_INSTRUCTIONS },
      { text: `Source recipe to adapt:\n\n${serializeRecipe(recipe)}` },
    ],
    messages: messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
    inferenceConfig: { maxTokens: 2000, temperature: 0.3 },
  });

  let response;
  try {
    response = await client.send(command);
  } catch (err) {
    const retriable = ['AccessDeniedException', 'CredentialsProviderError', 'ResourceNotFoundException'];
    if (retriable.includes(err.name)) {
      throw Object.assign(new Error(`AI service unavailable: ${err.message}`), {
        statusCode: 502,
      });
    }
    throw err;
  }

  const text = (response.output?.message?.content || [])
    .map((block) => block.text || '')
    .join('')
    .trim();

  if (!text) {
    throw Object.assign(new Error('AI service returned an empty response'), { statusCode: 502 });
  }

  return parseAdaptedRecipe(text);
}
