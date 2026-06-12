/**
 * Seed script for fable-ingredient-insights table.
 * Run via: dotenv -e .env.local -- node scripts/seed-insights.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const raw = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const dynamo = DynamoDBDocumentClient.from(raw);

const TABLE = "fable-ingredient-insights";
const ALL_TIME = "all-time";

function getCurrentISOWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const WEEK = getCurrentISOWeek();
const NOW = new Date().toISOString();

const records = [
  // ─── global ────────────────────────────────────────────────────────────────
  {
    allergenProfile: "global",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "garlic",          likeCount: 41, score: 0.92 },
      { key: "lemon",           likeCount: 38, score: 0.89 },
      { key: "olive oil",       likeCount: 36, score: 0.87 },
      { key: "ginger",          likeCount: 31, score: 0.84 },
      { key: "cherry tomatoes", likeCount: 27, score: 0.81 },
    ],
    trendingPairings: [
      { beverage: "sparkling water", recipeType: "Mediterranean", score: 0.88 },
      { beverage: "green tea",       recipeType: "Asian",         score: 0.85 },
      { beverage: "red wine",        recipeType: "Italian",       score: 0.82 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Italian",        occasion: "weeknight",    score: 0.91 },
      { cuisine: "Mediterranean",  occasion: "dinner-party", score: 0.87 },
      { cuisine: "Asian",          occasion: "weeknight",    score: 0.83 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "global",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "garlic",          likeCount: 312, score: 0.95 },
      { key: "olive oil",       likeCount: 298, score: 0.94 },
      { key: "lemon",           likeCount: 276, score: 0.93 },
      { key: "ginger",          likeCount: 241, score: 0.91 },
      { key: "chicken thigh",   likeCount: 228, score: 0.90 },
      { key: "cherry tomatoes", likeCount: 197, score: 0.88 },
    ],
    trendingPairings: [
      { beverage: "sparkling water", recipeType: "Mediterranean", score: 0.91 },
      { beverage: "green tea",       recipeType: "Asian",         score: 0.88 },
      { beverage: "red wine",        recipeType: "Italian",       score: 0.86 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Italian",        occasion: "weeknight",    score: 0.93 },
      { cuisine: "Mediterranean",  occasion: "dinner-party", score: 0.90 },
      { cuisine: "Asian",          occasion: "weeknight",    score: 0.87 },
    ],
    lastUpdated: NOW,
  },

  // ─── gluten-free ────────────────────────────────────────────────────────────
  {
    allergenProfile: "gluten-free",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "rice noodles",  likeCount: 24, score: 0.87 },
      { key: "tamari",        likeCount: 21, score: 0.84 },
      { key: "buckwheat",     likeCount: 18, score: 0.81 },
      { key: "polenta",       likeCount: 15, score: 0.78 },
      { key: "corn tortillas", likeCount: 12, score: 0.75 },
    ],
    trendingPairings: [
      { beverage: "green tea",        recipeType: "Japanese",  score: 0.91 },
      { beverage: "sparkling water",  recipeType: "Mexican",   score: 0.83 },
      { beverage: "kombucha",         recipeType: "Asian",     score: 0.78 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Japanese",   occasion: "weeknight",   score: 0.89 },
      { cuisine: "Mexican",    occasion: "street-food", score: 0.84 },
      { cuisine: "Asian",      occasion: "weeknight",   score: 0.79 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "gluten-free",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "rice noodles",   likeCount: 187, score: 0.95 },
      { key: "tamari",         likeCount: 164, score: 0.93 },
      { key: "buckwheat",      likeCount: 142, score: 0.91 },
      { key: "polenta",        likeCount: 119, score: 0.89 },
      { key: "rice flour",     likeCount: 103, score: 0.87 },
      { key: "corn tortillas", likeCount: 91,  score: 0.85 },
    ],
    trendingPairings: [
      { beverage: "green tea",       recipeType: "Japanese", score: 0.92 },
      { beverage: "sparkling water", recipeType: "Mexican",  score: 0.86 },
      { beverage: "kombucha",        recipeType: "Asian",    score: 0.81 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Japanese", occasion: "weeknight",   score: 0.91 },
      { cuisine: "Mexican",  occasion: "street-food", score: 0.86 },
      { cuisine: "Asian",    occasion: "meal-prep",   score: 0.82 },
    ],
    lastUpdated: NOW,
  },

  // ─── dairy-free ─────────────────────────────────────────────────────────────
  {
    allergenProfile: "dairy-free",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "coconut milk",      likeCount: 29, score: 0.89 },
      { key: "oat cream",         likeCount: 23, score: 0.84 },
      { key: "nutritional yeast", likeCount: 19, score: 0.80 },
      { key: "cashew cream",      likeCount: 16, score: 0.77 },
      { key: "olive oil",         likeCount: 14, score: 0.75 },
    ],
    trendingPairings: [
      { beverage: "oat milk latte", recipeType: "Comfort",  score: 0.86 },
      { beverage: "coconut water",  recipeType: "Thai",     score: 0.82 },
      { beverage: "herbal tea",     recipeType: "British",  score: 0.76 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Thai",     occasion: "weeknight",    score: 0.88 },
      { cuisine: "Indian",   occasion: "dinner-party", score: 0.83 },
      { cuisine: "British",  occasion: "comfort-food", score: 0.78 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "dairy-free",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "coconut milk",      likeCount: 214, score: 0.95 },
      { key: "oat cream",         likeCount: 178, score: 0.92 },
      { key: "nutritional yeast", likeCount: 153, score: 0.90 },
      { key: "cashew cream",      likeCount: 131, score: 0.88 },
      { key: "olive oil",         likeCount: 118, score: 0.86 },
      { key: "almond milk",       likeCount: 97,  score: 0.83 },
    ],
    trendingPairings: [
      { beverage: "oat milk latte", recipeType: "Comfort",  score: 0.88 },
      { beverage: "coconut water",  recipeType: "Thai",     score: 0.84 },
      { beverage: "herbal tea",     recipeType: "British",  score: 0.79 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Thai",   occasion: "weeknight",    score: 0.90 },
      { cuisine: "Indian", occasion: "dinner-party", score: 0.86 },
      { cuisine: "Asian",  occasion: "meal-prep",    score: 0.81 },
    ],
    lastUpdated: NOW,
  },

  // ─── nut-free ───────────────────────────────────────────────────────────────
  {
    allergenProfile: "nut-free",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "sunflower seed butter", likeCount: 17, score: 0.80 },
      { key: "pumpkin seeds",         likeCount: 14, score: 0.77 },
      { key: "oat milk",              likeCount: 12, score: 0.75 },
      { key: "garlic",                likeCount: 11, score: 0.73 },
      { key: "olive oil",             likeCount: 10, score: 0.72 },
    ],
    trendingPairings: [
      { beverage: "oat milk", recipeType: "British",       score: 0.81 },
      { beverage: "green tea", recipeType: "Japanese",     score: 0.76 },
      { beverage: "fruit juice", recipeType: "American",   score: 0.71 },
    ],
    trendingRecipeTypes: [
      { cuisine: "British",    occasion: "comfort-food",  score: 0.83 },
      { cuisine: "Japanese",   occasion: "weeknight",     score: 0.78 },
      { cuisine: "American",   occasion: "packed-lunch",  score: 0.73 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "nut-free",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "sunflower seed butter", likeCount: 142, score: 0.93 },
      { key: "pumpkin seeds",         likeCount: 119, score: 0.91 },
      { key: "oat milk",              likeCount: 103, score: 0.89 },
      { key: "garlic",                likeCount: 97,  score: 0.87 },
      { key: "olive oil",             likeCount: 89,  score: 0.85 },
      { key: "hemp seeds",            likeCount: 71,  score: 0.81 },
    ],
    trendingPairings: [
      { beverage: "oat milk",    recipeType: "British",  score: 0.84 },
      { beverage: "green tea",   recipeType: "Japanese", score: 0.79 },
      { beverage: "fruit juice", recipeType: "American", score: 0.74 },
    ],
    trendingRecipeTypes: [
      { cuisine: "British",  occasion: "comfort-food", score: 0.86 },
      { cuisine: "Japanese", occasion: "weeknight",    score: 0.81 },
      { cuisine: "American", occasion: "packed-lunch", score: 0.76 },
    ],
    lastUpdated: NOW,
  },

  // ─── gluten-free#dairy-free ──────────────────────────────────────────────────
  {
    allergenProfile: "gluten-free#dairy-free",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "rice noodles",      likeCount: 19, score: 0.83 },
      { key: "coconut milk",      likeCount: 17, score: 0.81 },
      { key: "tamari",            likeCount: 14, score: 0.78 },
      { key: "nutritional yeast", likeCount: 11, score: 0.75 },
      { key: "sweet potato",      likeCount: 9,  score: 0.72 },
    ],
    trendingPairings: [
      { beverage: "green tea",      recipeType: "Japanese", score: 0.88 },
      { beverage: "coconut water",  recipeType: "Thai",     score: 0.83 },
      { beverage: "herbal tea",     recipeType: "Asian",    score: 0.77 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Japanese", occasion: "weeknight",   score: 0.87 },
      { cuisine: "Thai",     occasion: "dinner-party", score: 0.83 },
      { cuisine: "Asian",    occasion: "meal-prep",   score: 0.78 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "gluten-free#dairy-free",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "rice noodles",      likeCount: 156, score: 0.94 },
      { key: "coconut milk",      likeCount: 138, score: 0.92 },
      { key: "tamari",            likeCount: 121, score: 0.90 },
      { key: "nutritional yeast", likeCount: 103, score: 0.88 },
      { key: "sweet potato",      likeCount: 89,  score: 0.86 },
      { key: "quinoa",            likeCount: 74,  score: 0.83 },
    ],
    trendingPairings: [
      { beverage: "green tea",     recipeType: "Japanese", score: 0.91 },
      { beverage: "coconut water", recipeType: "Thai",     score: 0.86 },
      { beverage: "herbal tea",    recipeType: "Asian",    score: 0.80 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Japanese", occasion: "weeknight",    score: 0.90 },
      { cuisine: "Thai",     occasion: "dinner-party", score: 0.86 },
      { cuisine: "Asian",    occasion: "meal-prep",    score: 0.81 },
    ],
    lastUpdated: NOW,
  },

  // ─── vegan ──────────────────────────────────────────────────────────────────
  {
    allergenProfile: "vegan",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "chickpeas",          likeCount: 33, score: 0.90 },
      { key: "lentils",            likeCount: 29, score: 0.87 },
      { key: "tofu",               likeCount: 26, score: 0.85 },
      { key: "nutritional yeast",  likeCount: 22, score: 0.82 },
      { key: "coconut milk",       likeCount: 19, score: 0.79 },
    ],
    trendingPairings: [
      { beverage: "green tea",   recipeType: "Asian",        score: 0.89 },
      { beverage: "kombucha",    recipeType: "Mediterranean", score: 0.84 },
      { beverage: "oat milk",    recipeType: "British",      score: 0.79 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Indian",        occasion: "weeknight",    score: 0.91 },
      { cuisine: "Mediterranean", occasion: "dinner-party", score: 0.86 },
      { cuisine: "Asian",         occasion: "meal-prep",    score: 0.82 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "vegan",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "chickpeas",         likeCount: 247, score: 0.95 },
      { key: "lentils",           likeCount: 219, score: 0.93 },
      { key: "tofu",              likeCount: 198, score: 0.91 },
      { key: "tempeh",            likeCount: 171, score: 0.89 },
      { key: "nutritional yeast", likeCount: 153, score: 0.87 },
      { key: "coconut milk",      likeCount: 138, score: 0.85 },
    ],
    trendingPairings: [
      { beverage: "green tea", recipeType: "Asian",        score: 0.92 },
      { beverage: "kombucha",  recipeType: "Mediterranean", score: 0.87 },
      { beverage: "oat milk",  recipeType: "British",      score: 0.82 },
    ],
    trendingRecipeTypes: [
      { cuisine: "Indian",        occasion: "weeknight",    score: 0.93 },
      { cuisine: "Mediterranean", occasion: "dinner-party", score: 0.89 },
      { cuisine: "Asian",         occasion: "meal-prep",    score: 0.84 },
    ],
    lastUpdated: NOW,
  },

  // ─── low-fodmap ─────────────────────────────────────────────────────────────
  {
    allergenProfile: "low-fodmap",
    timeWindow: WEEK,
    trendingIngredients: [
      { key: "carrots",       likeCount: 21, score: 0.83 },
      { key: "courgette",     likeCount: 18, score: 0.80 },
      { key: "chicken breast", likeCount: 16, score: 0.78 },
      { key: "rice",          likeCount: 14, score: 0.76 },
      { key: "strawberries",  likeCount: 11, score: 0.73 },
    ],
    trendingPairings: [
      { beverage: "peppermint tea",   recipeType: "British",  score: 0.85 },
      { beverage: "sparkling water",  recipeType: "Asian",    score: 0.79 },
      { beverage: "ginger tea",       recipeType: "Japanese", score: 0.74 },
    ],
    trendingRecipeTypes: [
      { cuisine: "British",  occasion: "weeknight",   score: 0.86 },
      { cuisine: "Asian",    occasion: "meal-prep",   score: 0.81 },
      { cuisine: "Japanese", occasion: "packed-lunch", score: 0.76 },
    ],
    lastUpdated: NOW,
  },
  {
    allergenProfile: "low-fodmap",
    timeWindow: ALL_TIME,
    trendingIngredients: [
      { key: "carrots",        likeCount: 168, score: 0.94 },
      { key: "courgette",      likeCount: 147, score: 0.92 },
      { key: "chicken breast", likeCount: 131, score: 0.90 },
      { key: "rice",           likeCount: 119, score: 0.88 },
      { key: "strawberries",   likeCount: 97,  score: 0.85 },
      { key: "spinach",        likeCount: 84,  score: 0.82 },
    ],
    trendingPairings: [
      { beverage: "peppermint tea",  recipeType: "British",  score: 0.88 },
      { beverage: "sparkling water", recipeType: "Asian",    score: 0.83 },
      { beverage: "ginger tea",      recipeType: "Japanese", score: 0.77 },
    ],
    trendingRecipeTypes: [
      { cuisine: "British",  occasion: "weeknight",    score: 0.89 },
      { cuisine: "Asian",    occasion: "meal-prep",    score: 0.84 },
      { cuisine: "Japanese", occasion: "packed-lunch", score: 0.78 },
    ],
    lastUpdated: NOW,
  },
];

async function seed() {
  let written = 0;
  for (const record of records) {
    await dynamo.send(new PutCommand({ TableName: TABLE, Item: record }));
    written++;
    console.log(`✓ ${record.allergenProfile} / ${record.timeWindow}`);
  }
  console.log(`\nSeeded ${written} records to ${TABLE}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
