
import { listSkillsTool, readSkillTool } from "../mastra/tools/skill-tools";

async function verifySkills() {
    console.log("--- Verifying Skills ---");

    // 1. List Skills
    console.log("\n1. Listing Skills...");
    const listResult = await listSkillsTool.execute({ context: {} });
    console.log("Skills found:", listResult.skills.map(s => s.name).join(", "));

    const expectedSkills = ["counseling", "village-guide", "office-support"];
    const foundSkills = listResult.skills.map(s => s.name);

    const missing = expectedSkills.filter(s => !foundSkills.includes(s));
    if (missing.length > 0) {
        console.error("❌ Missing skills:", missing);
    } else {
        console.log("✅ All new skills listed.");
    }

    // 2. Read Counseling Skill
    console.log("\n2. Reading 'counseling' skill...");
    try {
        const readResult = await readSkillTool.execute({ context: { skillName: "counseling" } });
        if (readResult.content.includes("カウンセリング・傾聴スキル")) {
            console.log("✅ Counseling skill content verified.");
        } else {
            console.error("❌ Counseling skill content mismatch.");
        }
    } catch (error) {
        console.error("❌ Failed to read counseling skill:", error);
    }
}

verifySkills();
