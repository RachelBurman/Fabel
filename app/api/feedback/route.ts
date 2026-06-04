import { NextRequest, NextResponse } from "next/server";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getUserId } from "@/lib/get-user-id";

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    recipeId?: string;
    liked?: boolean;
    reasons?: string[];
    notes?: string;
    recipeTitle?: string;
    recipeIngredients?: string[];
    allergenProfile?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipeId, liked, reasons, notes, recipeTitle, recipeIngredients, allergenProfile } = body;
  if (!recipeId) {
    return NextResponse.json({ error: "Missing recipeId" }, { status: 400 });
  }
  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await dynamo.send(
    new PutCommand({
      TableName: "fable-feedback",
      Item: {
        userId,
        recipeId,
        liked: liked ?? true,
        reasons: reasons ?? [],
        notes: notes ?? "",
        recipeTitle: recipeTitle ?? "",
        recipeIngredients: recipeIngredients ?? [],
        allergenProfile: allergenProfile ?? "global",
        timestamp: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "5", 10), 20);
  let userId: string;
  try {
    const resolved = await getUserId(req.nextUrl.searchParams.get("userId")?.trim() ?? undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: "fable-feedback",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  const items = (result.Items ?? []) as Array<{
    liked: boolean;
    reasons: string[];
    recipeIngredients: string[];
    timestamp: string;
  }>;

  const dislikes = items
    .filter((i) => i.liked === false)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  const patterns = [...new Set(dislikes.flatMap((d) => d.reasons ?? []))];
  const ingredients = [...new Set(dislikes.flatMap((d) => d.recipeIngredients ?? []))];

  return NextResponse.json({ patterns, ingredients, count: dislikes.length });
}

export async function PATCH(req: NextRequest) {
  let body: {
    recipeId?: string;
    userId?: string;
    surveyResponse?: {
      ingredientsHighlighted?: string[];
      ingredientsSkipped?: string[];
      recipePositives?: string[];
      recipeNegatives?: string[];
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipeId, surveyResponse } = body;
  if (!recipeId) {
    return NextResponse.json({ error: "Missing recipeId" }, { status: 400 });
  }
  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (!surveyResponse) {
    return NextResponse.json({ error: "Missing surveyResponse" }, { status: 400 });
  }

  // Defensive: if an ingredient appears in both highlighted and skipped, remove from skipped
  const highlighted = surveyResponse.ingredientsHighlighted ?? [];
  const highlightedKeys = new Set(highlighted.map((i) => i.toLowerCase().trim()));
  const sanitized = {
    ingredientsHighlighted: highlighted,
    ingredientsSkipped: (surveyResponse.ingredientsSkipped ?? []).filter(
      (i) => !highlightedKeys.has(i.toLowerCase().trim())
    ),
    recipePositives: surveyResponse.recipePositives ?? [],
    recipeNegatives: surveyResponse.recipeNegatives ?? [],
  };

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: "fable-feedback",
        Key: { userId, recipeId },
        UpdateExpression: "SET surveyResponse = :sr",
        ExpressionAttributeValues: { ":sr": sanitized },
        ConditionExpression: "attribute_exists(userId)",
      })
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "ConditionalCheckFailedException"
    ) {
      console.warn("[feedback-survey] Record not found for survey patch:", userId, recipeId);
      return NextResponse.json({ error: "Feedback record not found" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
