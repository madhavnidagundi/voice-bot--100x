import { readFile } from "node:fs/promises";
const profile = JSON.parse(
  await readFile(
    new URL("../src/data/candidate.json", import.meta.url),
    "utf8",
  ),
);
const missing = Object.entries(profile.answers)
  .filter(([, value]) => !value.trim())
  .map(([key]) => key);
if (
  !profile.profileComplete ||
  missing.length ||
  profile.name === "The builder"
) {
  console.error(
    `Profile needs personal details before submission. Add a real name, fill answers (${missing.join(", ")}), and set profileComplete=true in src/data/candidate.json.`,
  );
  process.exitCode = 1;
} else
  console.log(
    "Candidate profile is complete. Review every fact for accuracy before submitting.",
  );
