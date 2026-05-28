import { NextRequest, NextResponse } from "next/server";
import { allIngredients } from "@/lib/epicure";

function scoreMatch(name: string, query: string): number {
  // Normalise spaces to underscores so "olive oil" matches "olive_oil"
  const q = query.toLowerCase().replace(/\s+/g, "_");
  const n = name.toLowerCase();
  if (n === q) return 4;
  if (n.startsWith(q)) return 3;
  if (n.split("_").some((word) => word.startsWith(q))) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const results = allIngredients
    .map((name) => ({ name, score: scoreMatch(name, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(({ name }) => name);

  return NextResponse.json({ results });
}
