import { Pool } from "pg";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { auth } from "../lib/auth";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
);

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getOrCreateAuthUser(
  name: string,
  email: string,
  password: string
): Promise<{ userId: string; created: boolean }> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email = $1',
    [email]
  );
  if (rows[0]) return { userId: rows[0].id, created: false };

  const result = (await auth.api.signUpEmail({
    body: { name, email, password },
  })) as { user: { id: string } };
  return { userId: result.user.id, created: true };
}

// ── Maya — allergen profile ──────────────────────────────────────────────────

async function seedMaya(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const addedAt = "2026-05-23";

  await dynamo.send(
    new PutCommand({
      TableName: "fable-users",
      Item: {
        userId,
        allergens: ["gluten", "milk"],
        customAllergens: [],
        ingredients: [
          { id: "maya-ing-01", name: "chicken_breast", displayName: "Chicken Breast", area: "fridge", quantity: "2", unit: "pieces", addedAt },
          { id: "maya-ing-02", name: "rice", displayName: "Rice", area: "cupboard", addedAt },
          { id: "maya-ing-03", name: "cumin", displayName: "Cumin", area: "cupboard", addedAt },
          { id: "maya-ing-04", name: "garlic", displayName: "Garlic", area: "cupboard", addedAt },
          { id: "maya-ing-05", name: "olive_oil", displayName: "Olive Oil", area: "cupboard", addedAt },
          { id: "maya-ing-06", name: "sweet_potato", displayName: "Sweet Potato", area: "cupboard", addedAt },
          { id: "maya-ing-07", name: "coriander", displayName: "Coriander", area: "fridge", addedAt },
          { id: "maya-ing-08", name: "smoked_paprika", displayName: "Smoked Paprika", area: "cupboard", addedAt },
          { id: "maya-ing-09", name: "chickpeas", displayName: "Chickpeas", area: "cupboard", addedAt },
          { id: "maya-ing-10", name: "lemon", displayName: "Lemon", area: "fridge", addedAt },
        ],
        safeIngredients: [],
        safeFoodsMode: false,
        showMacros: false,
        activePresets: [],
        lactoseIntolerant: false,
        lactoseMode: "include",
        kitchenEquipment: ["hob", "oven"],
        colorMode: "system",
        onboardingComplete: true,
        spiceTolerance: "hot",
        adventurousness: "adventurous",
        discoverSettings: {
          showDiscover: true,
          showTrendingForYou: true,
          showTrendingGlobally: true,
          showMostLoved: true,
          showTrendingPairings: true,
        },
        visibleTabs: ["kitchen", "recipe", "discover", "substitutes", "history", "saved"],
        preferenceSignals: [
          { ingredientKey: "cumin", signal: 1 },
          { ingredientKey: "coriander", signal: 1 },
          { ingredientKey: "smoked_paprika", signal: 1 },
          { ingredientKey: "garlic", signal: 1 },
          { ingredientKey: "chickpeas", signal: 1 },
          { ingredientKey: "sweet_potato", signal: 1 },
          { ingredientKey: "lemon", signal: 1 },
          { ingredientKey: "chicken_breast", signal: 1 },
          { ingredientKey: "cumin", signal: 1 },
          { ingredientKey: "coriander", signal: 1 },
          { ingredientKey: "smoked_paprika", signal: 1 },
          { ingredientKey: "garlic", signal: 1 },
          { ingredientKey: "chickpeas", signal: 1 },
          { ingredientKey: "sweet_potato", signal: 1 },
          { ingredientKey: "lemon", signal: 1 },
          { ingredientKey: "butter", signal: -1 },
          { ingredientKey: "cream", signal: -1 },
          { ingredientKey: "wheat_flour", signal: -1 },
        ],
        tasteProfile: {
          preferred: ["cumin", "coriander", "smoked_paprika", "garlic", "chickpeas"],
          avoided: ["butter", "cream", "wheat_flour"],
          emerging: ["sweet_potato", "lemon"],
          fading: [],
          formatSignals: [],
          strength: "full",
          signalCount: 18,
          recipeSuggestions: [
            {
              direction: "Moroccan-spiced chicken with roasted sweet potato",
              reasoning:
                "Your love of cumin, coriander and smoked paprika points straight at North African flavour territory. Sweet potato keeps appearing in your recent history.",
              noveltyNote:
                "Try adding preserved lemon if you can find it — it lifts the whole dish.",
            },
            {
              direction: "Smoky chickpea and garlic stew",
              reasoning:
                "Chickpeas and garlic are your most consistently liked ingredients. A simple stew lets them do the work.",
              noveltyNote:
                "A handful of fresh coriander stirred in at the end makes this feel restaurant-quality.",
            },
          ],
          lastComputedAt: "2026-06-06T18:00:00.000Z",
        },
        needsRecompute: "false",
        lastComputedAt: "2026-06-06T18:00:00.000Z",
        updatedAt: now,
      },
    })
  );

  const mayaFeedback = [
    {
      recipeId: "maya-recipe-001",
      liked: true,
      recipeTitle: "Moroccan Spiced Chicken with Sweet Potato",
      recipeIngredients: ["chicken breast", "sweet potato", "cumin", "coriander", "smoked paprika", "garlic", "olive oil", "lemon"],
      timestamp: "2026-05-23T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["cumin", "coriander", "chicken breast"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "maya-recipe-002",
      liked: true,
      recipeTitle: "Smoky Chickpea and Garlic Stew",
      recipeIngredients: ["chickpeas", "garlic", "smoked paprika", "olive oil", "coriander", "lemon"],
      timestamp: "2026-05-26T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["smoked paprika", "chickpeas", "garlic"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "maya-recipe-003",
      liked: true,
      recipeTitle: "Spiced Sweet Potato Bowl",
      recipeIngredients: ["sweet potato", "chickpeas", "cumin", "coriander", "garlic", "olive oil"],
      timestamp: "2026-05-29T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["coriander", "cumin", "sweet potato"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "maya-recipe-004",
      liked: false,
      recipeTitle: "Creamy Chicken Pasta",
      recipeIngredients: ["chicken breast", "cream", "pasta", "garlic", "butter"],
      timestamp: "2026-06-01T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: [], ingredientsSkipped: ["cream"], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "maya-recipe-005",
      liked: false,
      recipeTitle: "Buttered Rice with Herbs",
      recipeIngredients: ["rice", "butter", "garlic"],
      timestamp: "2026-06-03T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: [], ingredientsSkipped: ["butter"], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "maya-recipe-006",
      liked: true,
      recipeTitle: "Garlic Chickpea Bowl",
      recipeIngredients: ["chickpeas", "garlic", "olive oil", "lemon", "cumin"],
      timestamp: "2026-06-05T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["chickpeas", "garlic"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
  ];

  for (const fb of mayaFeedback) {
    await dynamo.send(
      new PutCommand({
        TableName: "fable-feedback",
        Item: {
          userId,
          recipeId: fb.recipeId,
          liked: fb.liked,
          reasons: [],
          notes: "",
          recipeTitle: fb.recipeTitle,
          recipeIngredients: fb.recipeIngredients,
          allergenProfile: "gluten#milk",
          timestamp: fb.timestamp,
          surveyResponse: fb.surveyResponse,
        },
      })
    );
  }

  const mayaSaved = [
    {
      recipeId: "maya-saved-001",
      title: "Moroccan Spiced Chicken with Roasted Sweet Potato",
      description:
        "Warmly spiced chicken with caramelised sweet potato wedges, fragrant with cumin, coriander, and smoked paprika. Gluten-free and dairy-free.",
      cookTime: "50 minutes",
      servings: 2,
      allergenFree: true,
      isSaved: true,
      ingredients: [
        { name: "chicken breast", amount: 2, unit: "pieces" },
        { name: "sweet potato", amount: 400, unit: "grams" },
        { name: "ground cumin", amount: 2, unit: "tsp" },
        { name: "ground coriander", amount: 1, unit: "tsp" },
        { name: "smoked paprika", amount: 1, unit: "tsp" },
        { name: "garlic", amount: 3, unit: "cloves" },
        { name: "olive oil", amount: 3, unit: "tbsp" },
        { name: "lemon", amount: 1, unit: "pieces" },
        { name: "fresh coriander", amount: 1, unit: "pieces" },
      ],
      steps: [
        "Preheat oven to 200°C. Peel and cut sweet potato into wedges. Mince garlic.",
        "Mix cumin, coriander, smoked paprika, half the garlic, and 2 tbsp olive oil into a paste. Coat chicken breasts thoroughly.",
        "Toss sweet potato with remaining olive oil and garlic. Spread on a baking tray alongside the chicken.",
        "Roast for 35–40 minutes until chicken is cooked through and sweet potato is caramelised.",
        "Squeeze lemon over everything and scatter fresh coriander before serving.",
      ],
      savedAt: "2026-05-23T12:00:00.000Z",
    },
    {
      recipeId: "maya-saved-002",
      title: "Smoky Chickpea and Garlic Stew",
      description:
        "A deeply satisfying chickpea stew built around smoked paprika and garlic, finished with bright lemon and coriander. Ready in 25 minutes, naturally gluten and dairy free.",
      cookTime: "25 minutes",
      servings: 2,
      allergenFree: true,
      isSaved: true,
      ingredients: [
        { name: "chickpeas (canned, drained)", amount: 800, unit: "grams" },
        { name: "garlic", amount: 5, unit: "cloves" },
        { name: "smoked paprika", amount: 2, unit: "tsp" },
        { name: "ground cumin", amount: 1, unit: "tsp" },
        { name: "olive oil", amount: 3, unit: "tbsp" },
        { name: "lemon", amount: 1, unit: "pieces" },
        { name: "fresh coriander", amount: 1, unit: "pieces" },
        { name: "vegetable stock", amount: 200, unit: "ml" },
      ],
      steps: [
        "Slice garlic thinly. Heat olive oil in a wide pan over medium heat.",
        "Fry garlic for 2 minutes until golden at the edges. Add smoked paprika and cumin, stir for 30 seconds.",
        "Add chickpeas and stock. Simmer for 15 minutes, pressing some chickpeas against the pan to thicken the sauce.",
        "Season with lemon juice and salt. Scatter fresh coriander over the top.",
        "Serve as-is or with warm rice.",
      ],
      savedAt: "2026-05-26T12:00:00.000Z",
    },
    {
      recipeId: "maya-saved-003",
      title: "Sweet Potato and Chickpea Curry",
      description:
        "A fragrant curry with sweet potato and chickpeas, spiced with cumin and coriander. Light yet filling — naturally gluten-free and dairy-free.",
      cookTime: "35 minutes",
      servings: 2,
      allergenFree: true,
      isSaved: true,
      ingredients: [
        { name: "sweet potato", amount: 500, unit: "grams" },
        { name: "chickpeas (canned, drained)", amount: 400, unit: "grams" },
        { name: "canned chopped tomatoes", amount: 400, unit: "grams" },
        { name: "garlic", amount: 4, unit: "cloves" },
        { name: "ground cumin", amount: 2, unit: "tsp" },
        { name: "ground coriander", amount: 1, unit: "tsp" },
        { name: "smoked paprika", amount: 1, unit: "tsp" },
        { name: "olive oil", amount: 2, unit: "tbsp" },
        { name: "lemon", amount: "½", unit: "pieces" },
        { name: "fresh coriander", amount: 1, unit: "pieces" },
        { name: "rice", amount: 200, unit: "grams" },
      ],
      steps: [
        "Peel and cube sweet potato. Mince garlic. Cook rice according to packet instructions.",
        "Heat olive oil in a large pan. Fry garlic with cumin, coriander, and paprika for 1 minute.",
        "Add sweet potato, chickpeas, and tomatoes. Pour in 150ml water and stir well.",
        "Simmer covered for 20 minutes until sweet potato is tender. Uncover and cook 5 more minutes to thicken.",
        "Squeeze lemon juice over and scatter fresh coriander. Serve over rice.",
      ],
      savedAt: "2026-05-29T12:00:00.000Z",
    },
  ];

  for (const recipe of mayaSaved) {
    const { recipeId, ...rest } = recipe;
    await dynamo.send(
      new PutCommand({
        TableName: "fable-saved-recipes",
        Item: { userId, recipeId, ...rest },
      })
    );
  }
}

// ── Seren — Safe Foods Mode ──────────────────────────────────────────────────

async function seedSeren(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const addedAt = "2026-05-27";

  await dynamo.send(
    new PutCommand({
      TableName: "fable-users",
      Item: {
        userId,
        allergens: [],
        customAllergens: [],
        ingredients: [
          { id: "seren-ing-01", name: "chicken_breast", displayName: "Chicken Breast", area: "fridge", quantity: "2", unit: "pieces", addedAt },
          { id: "seren-ing-02", name: "rice", displayName: "Rice", area: "cupboard", addedAt },
          { id: "seren-ing-03", name: "courgette", displayName: "Courgette", area: "fridge", addedAt },
          { id: "seren-ing-04", name: "carrot", displayName: "Carrot", area: "fridge", addedAt },
          { id: "seren-ing-05", name: "sweet_potato", displayName: "Sweet Potato", area: "cupboard", addedAt },
          { id: "seren-ing-06", name: "garlic", displayName: "Garlic", area: "cupboard", addedAt },
          { id: "seren-ing-07", name: "olive_oil", displayName: "Olive Oil", area: "cupboard", addedAt },
          { id: "seren-ing-08", name: "lemon", displayName: "Lemon", area: "fridge", addedAt },
          { id: "seren-ing-09", name: "ginger", displayName: "Ginger", area: "fridge", addedAt },
        ],
        safeIngredients: [
          "chicken_breast", "rice", "courgette", "olive_oil", "carrot",
          "sweet_potato", "fresh_herbs", "garlic", "lemon", "ginger",
        ],
        safeFoodsMode: true,
        showMacros: false,
        activePresets: [],
        lactoseIntolerant: false,
        lactoseMode: "include",
        kitchenEquipment: ["hob", "oven"],
        colorMode: "system",
        onboardingComplete: true,
        spiceTolerance: "none",
        adventurousness: "familiar",
        discoverSettings: {
          showDiscover: true,
          showTrendingForYou: true,
          showTrendingGlobally: true,
          showMostLoved: true,
          showTrendingPairings: true,
        },
        visibleTabs: ["kitchen", "recipe", "discover", "substitutes", "history", "saved"],
        preferenceSignals: [
          { ingredientKey: "chicken_breast", signal: 1 },
          { ingredientKey: "garlic", signal: 1 },
          { ingredientKey: "ginger", signal: 1 },
          { ingredientKey: "lemon", signal: 1 },
          { ingredientKey: "courgette", signal: 1 },
          { ingredientKey: "sweet_potato", signal: 1 },
          { ingredientKey: "chicken_breast", signal: 1 },
          { ingredientKey: "garlic", signal: 1 },
          { ingredientKey: "ginger", signal: 1 },
          { ingredientKey: "lemon", signal: 1 },
        ],
        tasteProfile: {
          preferred: ["chicken_breast", "garlic", "ginger", "lemon", "courgette"],
          avoided: [],
          emerging: ["ginger", "lemon"],
          fading: [],
          formatSignals: [],
          strength: "full",
          signalCount: 10,
          recipeSuggestions: [
            {
              direction: "Ginger and lemon chicken with rice",
              reasoning:
                "Ginger and lemon are both appearing more in your recent recipes. Simple, clean flavours that work within your safe foods.",
              noveltyNote:
                "A small amount of garlic-infused olive oil instead of plain olive oil adds depth without any new ingredients.",
            },
          ],
          lastComputedAt: "2026-06-06T18:00:00.000Z",
        },
        needsRecompute: "false",
        lastComputedAt: "2026-06-06T18:00:00.000Z",
        updatedAt: now,
      },
    })
  );

  const serenFeedback = [
    {
      recipeId: "seren-recipe-001",
      liked: true,
      recipeTitle: "Garlic Chicken with Rice",
      recipeIngredients: ["chicken breast", "rice", "garlic", "olive oil", "lemon"],
      timestamp: "2026-05-27T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["chicken breast", "garlic"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "seren-recipe-002",
      liked: true,
      recipeTitle: "Ginger and Lemon Chicken",
      recipeIngredients: ["chicken breast", "ginger", "lemon", "garlic", "olive oil", "rice"],
      timestamp: "2026-05-30T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["ginger", "lemon"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "seren-recipe-003",
      liked: true,
      recipeTitle: "Roasted Courgette with Garlic and Ginger",
      recipeIngredients: ["courgette", "garlic", "ginger", "olive oil", "lemon"],
      timestamp: "2026-06-02T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["garlic", "ginger"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
    {
      recipeId: "seren-recipe-004",
      liked: true,
      recipeTitle: "Sweet Potato and Courgette Bowl",
      recipeIngredients: ["sweet potato", "courgette", "chicken breast", "olive oil", "lemon"],
      timestamp: "2026-06-05T19:00:00.000Z",
      surveyResponse: { ingredientsHighlighted: ["chicken breast", "courgette"], ingredientsSkipped: [], recipePositives: [], recipeNegatives: [] },
    },
  ];

  for (const fb of serenFeedback) {
    await dynamo.send(
      new PutCommand({
        TableName: "fable-feedback",
        Item: {
          userId,
          recipeId: fb.recipeId,
          liked: fb.liked,
          reasons: [],
          notes: "",
          recipeTitle: fb.recipeTitle,
          recipeIngredients: fb.recipeIngredients,
          allergenProfile: "global",
          timestamp: fb.timestamp,
          surveyResponse: fb.surveyResponse,
        },
      })
    );
  }

  const serenSaved = [
    {
      recipeId: "seren-saved-001",
      title: "Ginger and Lemon Chicken Rice Bowl",
      description:
        "Tender chicken breast poached in a ginger and lemon broth, served over fluffy rice. Clean, bright flavours using only safe foods.",
      cookTime: "30 minutes",
      servings: 2,
      allergenFree: true,
      isSaved: true,
      ingredients: [
        { name: "chicken breast", amount: 2, unit: "pieces" },
        { name: "rice", amount: 200, unit: "grams" },
        { name: "fresh ginger", amount: 30, unit: "grams" },
        { name: "lemon", amount: 1, unit: "pieces" },
        { name: "garlic", amount: 2, unit: "cloves" },
        { name: "olive oil", amount: 1, unit: "tbsp" },
      ],
      steps: [
        "Cook rice according to packet instructions. Slice ginger into coins. Mince garlic.",
        "Bring 500ml water to a gentle simmer. Add ginger, garlic, and half the lemon juice.",
        "Poach chicken breasts in the broth for 15 minutes until cooked through. Remove and slice.",
        "Drizzle olive oil and remaining lemon juice over the chicken.",
        "Serve sliced chicken over rice with a little of the fragrant broth spooned on top.",
      ],
      savedAt: "2026-05-30T12:00:00.000Z",
    },
    {
      recipeId: "seren-saved-002",
      title: "Roasted Sweet Potato and Courgette with Lemon Dressing",
      description:
        "Sweet potato and courgette roasted until caramelised, with a simple lemon dressing. Every ingredient on the safe foods list.",
      cookTime: "40 minutes",
      servings: 2,
      allergenFree: true,
      isSaved: true,
      ingredients: [
        { name: "sweet potato", amount: 400, unit: "grams" },
        { name: "courgette", amount: 2, unit: "pieces" },
        { name: "carrot", amount: 2, unit: "pieces" },
        { name: "garlic", amount: 2, unit: "cloves" },
        { name: "olive oil", amount: 3, unit: "tbsp" },
        { name: "lemon", amount: 1, unit: "pieces" },
      ],
      steps: [
        "Preheat oven to 200°C. Peel and cube sweet potato. Slice courgette into rounds. Peel and slice carrot.",
        "Toss all vegetables with olive oil, minced garlic, and a pinch of salt. Spread on a baking tray.",
        "Roast for 30–35 minutes until edges are golden and sweet potato is tender.",
        "Mix lemon juice with 1 tbsp olive oil to make a simple dressing.",
        "Pile vegetables into bowls and drizzle the lemon dressing over everything.",
      ],
      savedAt: "2026-06-02T12:00:00.000Z",
    },
  ];

  for (const recipe of serenSaved) {
    const { recipeId, ...rest } = recipe;
    await dynamo.send(
      new PutCommand({
        TableName: "fable-saved-recipes",
        Item: { userId, recipeId, ...rest },
      })
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const maya = await getOrCreateAuthUser("Maya", "maya@demo.fable.app", "FableDemo2026!");
    console.log(`Maya: ${maya.created ? "created" : "skipped (exists)"} (${maya.userId})`);
    await seedMaya(maya.userId);
    console.log("✓ Maya: DynamoDB records written");

    const seren = await getOrCreateAuthUser("Seren", "seren@demo.fable.app", "FableDemo2026!");
    console.log(`Seren: ${seren.created ? "created" : "skipped (exists)"} (${seren.userId})`);
    await seedSeren(seren.userId);
    console.log("✓ Seren: DynamoDB records written");

    console.log("\nDemo accounts ready:");
    console.log("  Allergen filtering:  maya@demo.fable.app   /  FableDemo2026!");
    console.log("  Safe Foods Mode:     seren@demo.fable.app  /  FableDemo2026!");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
