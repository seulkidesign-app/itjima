import fs from "node:fs";

const path = "src/ui-responsive-pro.css";
const source = fs.readFileSync(path, "utf8");
const marker = "/* QA: fixed 44px composer targets */";
if (source.includes(marker)) {
  console.log("Pixel touch target rules already present.");
  process.exit(0);
}

const rules = `

${marker}
.phone-frame form.composer-hero > div:first-child > button {
  min-height: 44px !important;
  height: 44px !important;
}

.phone-frame .capture-submit-button {
  min-height: 44px !important;
  height: 44px !important;
}
`;

fs.writeFileSync(path, `${source.trimEnd()}${rules}`);
console.log(`Updated ${path}`);
