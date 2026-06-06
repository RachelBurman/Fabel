import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getUserId } from "@/lib/get-user-id";
import { type DiscoverSettings, DEFAULT_DISCOVER_SETTINGS, ALL_TABS } from "@/lib/types";

interface IngredientItem {
  id: string;
  name: string;
  area: "fridge" | "freezer" | "cupboard" | "pantry";
  useByDate?: string;
  addedAt: string;
}

function migrateIngredients(raw: unknown): IngredientItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === "string") {
      return {
        id: crypto.randomUUID(),
        name: item.trim().toLowerCase(),
        area: "fridge" as const,
        addedAt: new Date().toISOString().split("T")[0],
      };
    }
    return item as IngredientItem;
  });
}

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const resolved = await getUserId(req.nextUrl.searchParams.get("userId")?.trim() ?? undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const result = await dynamo.send(
    new GetCommand({ TableName: "fable-users", Key: { userId } })
  );

  if (!result.Item) return NextResponse.json({});

  const {
    allergens,
    customAllergens,
    ingredients,
    safeIngredients,
    safeFoodsMode,
    showMacros,
    activePresets,
    lactoseIntolerant,
    lactoseMode,
    kitchenEquipment,
    colorMode,
    darkMode,
    discoverSettings,
    visibleTabs,
    onboardingComplete,
  } = result.Item;

  // Migrate old boolean darkMode to string colorMode
  const resolvedColorMode: string | undefined =
    colorMode ?? (darkMode === true ? 'dark' : darkMode === false ? 'light' : undefined);

  return NextResponse.json({
    allergens,
    customAllergens,
    ingredients: migrateIngredients(ingredients),
    safeIngredients,
    safeFoodsMode,
    showMacros,
    activePresets,
    lactoseIntolerant,
    lactoseMode,
    kitchenEquipment,
    colorMode: resolvedColorMode,
    discoverSettings,
    visibleTabs,
    onboardingComplete,
  });
}

export async function PUT(req: NextRequest) {
  let body: {
    userId?: string;
    allergens?: string[];
    customAllergens?: string[];
    ingredients?: IngredientItem[];
    safeIngredients?: string[];
    safeFoodsMode?: boolean;
    showMacros?: boolean;
    activePresets?: string[];
    lactoseIntolerant?: boolean;
    lactoseMode?: "include" | "exclude";
    kitchenEquipment?: string[];
    colorMode?: "light" | "dark" | "system";
    discoverSettings?: DiscoverSettings;
    visibleTabs?: string[];
    onboardingComplete?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    allergens,
    customAllergens,
    ingredients,
    safeIngredients,
    safeFoodsMode,
    showMacros,
    activePresets,
    lactoseIntolerant,
    lactoseMode,
    kitchenEquipment,
    colorMode,
    discoverSettings,
    visibleTabs,
    onboardingComplete,
  } = body;
  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await dynamo.send(
    new PutCommand({
      TableName: "fable-users",
      Item: {
        userId,
        allergens: allergens ?? [],
        customAllergens: customAllergens ?? [],
        ingredients: ingredients ?? [],
        safeIngredients: safeIngredients ?? [],
        safeFoodsMode: safeFoodsMode ?? false,
        showMacros: showMacros ?? false,
        activePresets: activePresets ?? [],
        lactoseIntolerant: lactoseIntolerant ?? false,
        lactoseMode: lactoseMode ?? "include",
        kitchenEquipment: kitchenEquipment ?? ["hob", "oven"],
        colorMode: colorMode ?? "system",
        discoverSettings: discoverSettings ?? DEFAULT_DISCOVER_SETTINGS,
        visibleTabs: visibleTabs ?? [...ALL_TABS],
        onboardingComplete: onboardingComplete ?? false,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ ok: true });
}

// Partial update — only touches onboardingComplete, leaves all other fields intact.
export async function PATCH(req: NextRequest) {
  let body: { userId?: string; onboardingComplete?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.onboardingComplete !== "boolean") {
    return NextResponse.json({ error: "onboardingComplete must be a boolean" }, { status: 400 });
  }

  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: "fable-users",
      Key: { userId },
      UpdateExpression: "SET onboardingComplete = :val, updatedAt = :ts",
      ExpressionAttributeValues: {
        ":val": body.onboardingComplete,
        ":ts": new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ ok: true });
}
