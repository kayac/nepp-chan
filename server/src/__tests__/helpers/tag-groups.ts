import { personaTagAliases, personaTagGroups } from "~/db";
import type { TestDb } from "./test-db";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

export const seedRelationGroups = async (db: TestDb) => {
  await db.insert(personaTagGroups).values(
    [
      ["tourist", "観光客", 10],
      ["migrant-candidate", "移住検討者", 20],
      ["returnee", "帰省者", 30],
      ["resident", "村内住民", 40],
      ["outsider", "村外", 50],
    ].map(([id, name, sortOrder]) => ({
      id: String(id),
      name: String(name),
      kind: "attribute",
      axis: "関わり",
      sortOrder: Number(sortOrder),
      createdAt: CREATED_AT,
    })),
  );
  await db.insert(personaTagGroups).values(
    [
      ["age-10s", "10代", 110],
      ["age-20s", "20代", 120],
      ["age-60s-plus", "60代以上", 160],
    ].map(([id, name, sortOrder]) => ({
      id: String(id),
      name: String(name),
      kind: "attribute",
      axis: "年代",
      sortOrder: Number(sortOrder),
      createdAt: CREATED_AT,
    })),
  );
  await db.insert(personaTagAliases).values(
    [
      ["観光客", "tourist"],
      ["旅行者", "tourist"],
      ["移住検討者", "migrant-candidate"],
      ["帰省者", "returnee"],
      ["村人", "resident"],
      ["村内", "resident"],
      ["村外", "outsider"],
      ["10代", "age-10s"],
      ["高校生", "age-10s"],
      ["20代", "age-20s"],
      ["60代", "age-60s-plus"],
      ["80代以上", "age-60s-plus"],
      ["高齢者", "age-60s-plus"],
    ].map(([tag, groupId]) => ({
      tag,
      groupId,
      assignedBy: "seed",
      createdAt: CREATED_AT,
    })),
  );
};
