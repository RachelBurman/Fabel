import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const result = await dynamo.send(
    new GetCommand({ TableName: "fable-users", Key: { userId } })
  );

  if (!result.Item) return NextResponse.json({});

  const { allergens, customAllergens, ingredients } = result.Item;
  return NextResponse.json({ allergens, customAllergens, ingredients });
}

export async function PUT(req: NextRequest) {
  let body: { userId?: string; allergens?: string[]; customAllergens?: string[]; ingredients?: string[] };
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, allergens, customAllergens, ingredients } = body;
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await dynamo.send(new PutCommand({
    TableName: "fable-users",
    Item: {
      userId,
      allergens: allergens ?? [],
      customAllergens: customAllergens ?? [],
      ingredients: ingredients ?? [],
      updatedAt: new Date().toISOString(),
    },
  }));

  return NextResponse.json({ ok: true });
}
