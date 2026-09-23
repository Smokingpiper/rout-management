import { neon } from "@neondatabase/serverless";

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS annotations (
      id bigserial PRIMARY KEY,
      screen_id text NOT NULL,
      x numeric NOT NULL,
      y numeric NOT NULL,
      author text,
      comment text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function GET() {
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }
  await ensureTable(sql);
  const rows = await sql`
    SELECT id, screen_id, x, y, author, comment, created_at
    FROM annotations
    ORDER BY created_at ASC
  `;
  return Response.json(rows);
}

export async function POST(request) {
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }
  const body = await request.json();
  const { screen_id, x, y, author, comment } = body || {};
  if (!screen_id || x == null || y == null || !comment) {
    return Response.json({ error: "screen_id, x, y, comment are required" }, { status: 400 });
  }
  await ensureTable(sql);
  const rows = await sql`
    INSERT INTO annotations (screen_id, x, y, author, comment)
    VALUES (${screen_id}, ${x}, ${y}, ${author || null}, ${comment})
    RETURNING id, screen_id, x, y, author, comment, created_at
  `;
  return Response.json(rows[0]);
}

export async function PATCH(request) {
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }
  const body = await request.json();
  const { id, author, comment } = body || {};
  if (!id || !comment) {
    return Response.json({ error: "id and comment are required" }, { status: 400 });
  }
  await ensureTable(sql);
  const rows = await sql`
    UPDATE annotations
    SET author = ${author || null}, comment = ${comment}
    WHERE id = ${id}
    RETURNING id, screen_id, x, y, author, comment, created_at
  `;
  if (rows.length === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(rows[0]);
}

export async function DELETE(request) {
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  await ensureTable(sql);
  await sql`DELETE FROM annotations WHERE id = ${id}`;
  return Response.json({ ok: true });
}
