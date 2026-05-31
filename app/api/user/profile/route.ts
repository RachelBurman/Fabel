import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

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
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const result = await dynamo.send(
    new GetCommand({ TableName: "fable-users", Key: { userId } })
  );

  if (!result.Item) return NextResponse.json({});

  const { allergens, customAllergens, ingredients, safeIngredients, safeFoodsMode, showMacros, activePresets, lactoseIntolerant, lactoseMode, kitchenEquipment, darkMode } =
    result.Item;

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
    darkMode,
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
    lactoseMode?: 'include' | 'exclude';
    kitchenEquipment?: string[];
    darkMode?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, allergens, customAllergens, ingredients, safeIngredients, safeFoodsMode, showMacros, activePresets, lactoseIntolerant, lactoseMode, kitchenEquipment, darkMode } =
    body;
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

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
        lactoseMode: lactoseMode ?? 'include',
        kitchenEquipment: kitchenEquipment ?? ['hob', 'oven'],
        darkMode: darkMode ?? false,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ ok: true });
}
