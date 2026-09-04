import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (compatible; MyRecipeBookBot/1.0; +https://github.com/)';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^169\.254\./,
];

function assertPublicHost(url) {
  const { hostname } = new URL(url);
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new Error('Refusing to fetch a local/private address');
  }
}

export async function scrapeRecipe(url) {
  assertPublicHost(url);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const jsonLdRecipe = extractJsonLdRecipe($);
  const recipe = jsonLdRecipe
    ? normalizeJsonLdRecipe(jsonLdRecipe, $)
    : extractFallbackRecipe($, url);

  if (!recipe.ingredients.length && !recipe.steps.length) {
    throw new Error('No recipe content found on this page');
  }

  return recipe;
}

// --- JSON-LD (schema.org/Recipe) extraction -------------------------------

function extractJsonLdRecipe($) {
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    let data;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const recipe = findRecipeNode(data);
    if (recipe) return recipe;
  }
  return null;
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  if (types.includes('Recipe')) return node;

  if (Array.isArray(node['@graph'])) {
    return findRecipeNode(node['@graph']);
  }
  return null;
}

const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => HTML_ENTITIES[name]);
}

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return decodeEntities(value);
  if (typeof value === 'object' && value.name) return decodeEntities(value.name);
  return '';
}

function normalizeIngredients(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => (typeof i === 'string' ? decodeEntities(i.trim()) : textOf(i))).filter(Boolean);
}

function normalizeInstructions(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];

  const steps = [];
  const walk = (item) => {
    if (typeof item === 'string') {
      steps.push(decodeEntities(item.trim()));
    } else if (item && typeof item === 'object') {
      if (item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
        item.itemListElement.forEach(walk);
      } else if (item.text) {
        steps.push(decodeEntities(item.text.trim()));
      } else if (item.name) {
        steps.push(decodeEntities(item.name.trim()));
      }
    }
  };
  raw.forEach(walk);
  return steps.filter(Boolean);
}

const NUTRITION_FIELDS = [
  ['calories', 'Calories'],
  ['servingSize', 'Serving size'],
  ['fatContent', 'Fat'],
  ['saturatedFatContent', 'Saturated fat'],
  ['carbohydrateContent', 'Carbohydrates'],
  ['sugarContent', 'Sugar'],
  ['fiberContent', 'Fiber'],
  ['proteinContent', 'Protein'],
  ['sodiumContent', 'Sodium'],
  ['cholesterolContent', 'Cholesterol'],
];

function normalizeNutrition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nutrition = {};
  for (const [key, label] of NUTRITION_FIELDS) {
    if (raw[key]) nutrition[label] = decodeEntities(String(raw[key]).trim());
  }
  return Object.keys(nutrition).length ? nutrition : null;
}

function formatDuration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    iso.trim()
  );
  if (!match) return null;
  const [, years, months, weeks, days, hours, minutes] = match;
  const parts = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}mo`);
  if (weeks) parts.push(`${weeks}w`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours} hr`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.length ? parts.join(' ') : null;
}

function normalizeYield(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return decodeEntities(value.trim()) || null;
  return null;
}

function extractImage(node, $) {
  const img = node.image;
  if (img) {
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) return typeof img[0] === 'string' ? img[0] : img[0]?.url || null;
    if (typeof img === 'object' && img.url) return img.url;
  }
  return $('meta[property="og:image"]').attr('content') || null;
}

function extractVideoUrl(node, $) {
  const video = node?.video;
  if (video) {
    const v = Array.isArray(video) ? video[0] : video;
    if (typeof v === 'object') {
      if (v.contentUrl) return v.contentUrl;
      if (v.embedUrl) return v.embedUrl;
    }
  }
  const ogVideo =
    $('meta[property="og:video"]').attr('content') ||
    $('meta[property="og:video:url"]').attr('content');
  if (ogVideo) return ogVideo;

  const iframe = $(
    'iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"]'
  ).first();
  if (iframe.length) return iframe.attr('src');

  return null;
}

function normalizeJsonLdRecipe(node, $) {
  return {
    title: textOf(node.name) || $('title').first().text().trim(),
    image: extractImage(node, $),
    prepTime: formatDuration(node.prepTime),
    cookTime: formatDuration(node.cookTime),
    servings: normalizeYield(node.recipeYield || node.yield),
    ingredients: normalizeIngredients(node.recipeIngredient || node.ingredients),
    steps: normalizeInstructions(node.recipeInstructions),
    nutrition: normalizeNutrition(node.nutrition),
    videoUrl: extractVideoUrl(node, $),
  };
}

// --- Fallback heuristic HTML parsing --------------------------------------

function collectListText($, pattern) {
  const results = [];
  $('[class]').each((_, el) => {
    const className = $(el).attr('class') || '';
    if (!pattern.test(className)) return;
    $(el)
      .find('li')
      .each((__, li) => {
        const text = $(li).text().trim().replace(/\s+/g, ' ');
        if (text) results.push(text);
      });
  });
  return [...new Set(results)];
}

function findFirstText($, pattern, maxLength = 60) {
  let result = null;
  $('[class]').each((_, el) => {
    if (result) return;
    const className = $(el).attr('class') || '';
    if (!pattern.test(className)) return;
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text && text.length <= maxLength) result = text;
  });
  return result;
}

function extractFallbackRecipe($, url) {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').first().text().trim() ||
    url;

  return {
    title,
    image: $('meta[property="og:image"]').attr('content') || null,
    prepTime: findFirstText($, /prep-?time/i),
    cookTime: findFirstText($, /cook-?time/i),
    servings: findFirstText($, /(recipe-?yield|servings)/i),
    ingredients: collectListText($, /ingredient/i),
    steps: collectListText($, /instruction|direction|method|steps?\b/i),
    nutrition: null,
    videoUrl: extractVideoUrl(null, $),
  };
}
