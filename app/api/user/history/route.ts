import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getUserId } from "@/lib/get-user-id";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const resolved = await getUserId(req.nextUrl.searchParams.get("userId")?.trim() ?? undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const result = await dynamo.send(new QueryCommand({
    TableName: "fable-saved-recipes",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  // Return only history entries — items explicitly written with isSaved: false.
  // Saved recipes (isSaved: true) and old records without the field are excluded.
  const items = (result.Items ?? []).filter((item) => item.isSaved === false);

  return NextResponse.json({ entries: items });
}
