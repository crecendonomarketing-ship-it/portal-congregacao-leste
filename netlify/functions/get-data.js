const NOTION_VERSION = "2022-06-28";

const DATABASES = {
  programacaoSemanal: "7d7dce8d05404eac9965b7c7731c722c",
  partesReuniao: "bab12f7fd4e146e7ba383bccdb1142e1",
  indicadores: "562ab5fb-b788-42d7-a623-8e286db09c7f",
  limpeza: "c2fe9cde-2a6a-4986-945b-f4525bf0d075",
  grupos: "d56b8645-c6ba-4285-94de-cc39afe01ea8",
  carrinhos: "62765ed7-2433-4c1b-8054-3202134d8ccf",
  dirigenteCampo: "82893762-e094-4b3d-8274-3d4c6c5a2759",
  responsaveis: "703d3a68-459f-4a12-a289-539f5f4327d1",
  territorio: "49566af7-d7f2-4c2a-9418-2fe2be7412bb",
  agenda: "eae15bbb-f970-4783-9786-948d6f5c3133",
};

function extractPlainValue(prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title": return prop.title.map((t) => t.plain_text).join("");
    case "rich_text": return prop.rich_text.map((t) => t.plain_text).join("");
    case "select": return prop.select ? prop.select.name : "";
    case "multi_select": return prop.multi_select.map((s) => s.name).join(", ");
    case "date":
      if (!prop.date) return "";
      return prop.date.end ? `${prop.date.start} a ${prop.date.end}` : prop.date.start;
    case "email": return prop.email || "";
    case "phone_number": return prop.phone_number || "";
    case "checkbox": return prop.checkbox ? "Sim" : "Não";
    case "number": return prop.number != null ? String(prop.number) : "";
    case "url": return prop.url || "";
    case "relation": return (prop.relation || []).map((r) => r.id).join(",");
    default: return "";
  }
}

async function queryDatabase(id, token) {
  const results = [];
  let cursor = undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error (${res.status}) on ${id}: ${text}`);
    }
    const data = await res.json();
    for (const page of data.results) {
      const row = { _id: page.id };
      for (const [key, prop] of Object.entries(page.properties)) {
        row[key] = extractPlainValue(prop);
      }
      results.push(row);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

exports.handler = async function () {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "NOTION_TOKEN não configurado no Netlify." }) };
  }
  try {
    const entries = await Promise.all(
      Object.entries(DATABASES).map(async ([key, id]) => [key, await queryDatabase(id, token)])
    );
    const payload = Object.fromEntries(entries);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
      body: JSON.stringify(payload),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
