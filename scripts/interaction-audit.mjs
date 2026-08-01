import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "qa-artifacts");
const STRICT = process.argv.includes("--strict");

const interactiveTags = new Set([
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "summary",
  "Link",
  "motion.button",
  "motion.a",
]);
const nativeButtonTags = new Set(["button", "motion.button"]);
const formControlTags = new Set(["input", "textarea", "select"]);
const iconLikePattern = /(^|\.)(Icon|Arrow|Chevron|Plus|Minus|X|Check|Bell|Mic|Image|Pencil|Trash|Settings|User|Archive|Calendar|Clock|Globe|Shield|Download|Upload|Search|Menu|More|Copy|Pin|Timer|Sparkles)/;

function listFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else if (entry.isFile() && full.endsWith(".tsx")) result.push(full);
  }
  return result;
}

function tagName(node) {
  const name = node.tagName;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return `${name.expression.getText()}.${name.name.text}`;
  return name.getText();
}

function attrs(node) {
  const map = new Map();
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop)) map.set(prop.name.getText(), prop);
  }
  return map;
}

function attrText(attribute) {
  if (!attribute?.initializer) return "";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer)) {
    return attribute.initializer.expression?.getText() ?? "";
  }
  return attribute.initializer.getText();
}

function hasMeaningfulChild(node) {
  for (const child of node.children ?? []) {
    if (ts.isJsxText(child) && child.getText().trim()) return true;
    if (ts.isJsxExpression(child) && child.expression) {
      const text = child.expression.getText();
      if (text && !/^(false|null|undefined)$/.test(text)) return true;
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const childTag = tagName(ts.isJsxElement(child) ? child.openingElement : child);
      if (!iconLikePattern.test(childTag) && childTag !== "span") return true;
      if (ts.isJsxElement(child) && hasMeaningfulChild(child)) return true;
    }
  }
  return false;
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function addIssue(issues, severity, rule, file, source, node, message) {
  issues.push({
    severity,
    rule,
    file: path.relative(ROOT, file),
    line: lineOf(source, node),
    message,
  });
}

function intentionallyHiddenControl(tag, attributes) {
  if (!formControlTags.has(tag)) return false;
  if (attributes.has("hidden")) return true;
  const className = attrText(attributes.get("className"));
  const ariaHidden = attrText(attributes.get("aria-hidden"));
  const tabIndex = attrText(attributes.get("tabIndex"));
  return (
    /(^|\s)hidden(\s|$)/.test(className) ||
    ariaHidden === "true" ||
    tabIndex === "-1"
  );
}

const files = listFiles(SRC);
const inventory = [];
const issues = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(opening);
      const attributes = attrs(opening);
      const hiddenControl = intentionallyHiddenControl(tag, attributes);
      const onClick = attributes.get("onClick");
      const role = attrText(attributes.get("role"));
      const testId = attrText(attributes.get("data-testid"));
      const ariaLabel = attrText(attributes.get("aria-label"));
      const ariaLabelledBy = attrText(attributes.get("aria-labelledby"));
      const title = attrText(attributes.get("title"));
      const accessibleName = Boolean(
        ariaLabel || ariaLabelledBy || title || (ts.isJsxElement(node) && hasMeaningfulChild(node)),
      );
      const isInteractive =
        !hiddenControl && (interactiveTags.has(tag) || Boolean(onClick));

      if (isInteractive) {
        inventory.push({
          file: path.relative(ROOT, file),
          line: lineOf(source, opening),
          tag,
          role,
          testId,
          accessibleName,
          hasClick: Boolean(onClick),
        });
      }

      if (nativeButtonTags.has(tag) && !attributes.has("type")) {
        addIssue(
          issues,
          "error",
          "button-type",
          file,
          source,
          opening,
          "Button is missing an explicit type and can accidentally submit a parent form.",
        );
      }

      if ((tag === "button" || tag === "motion.button" || tag === "a" || tag === "Link") && !accessibleName) {
        addIssue(
          issues,
          "error",
          "accessible-name",
          file,
          source,
          opening,
          "Interactive control has no detectable accessible name.",
        );
      }

      if (formControlTags.has(tag) && !hiddenControl) {
        const hasProgrammaticLabel = Boolean(
          attributes.has("id") ||
            attributes.has("aria-label") ||
            attributes.has("aria-labelledby") ||
            attributes.has("title"),
        );
        if (!hasProgrammaticLabel) {
          addIssue(
            issues,
            "error",
            "form-control-label",
            file,
            source,
            opening,
            "Form control has no id or accessible label hook.",
          );
        }
      }

      if ((tag === "a" || tag === "motion.a") && attrText(attributes.get("target")).includes("_blank")) {
        const rel = attrText(attributes.get("rel"));
        if (!rel.includes("noopener") || !rel.includes("noreferrer")) {
          addIssue(
            issues,
            "error",
            "external-link-rel",
            file,
            source,
            opening,
            "target=_blank link must include rel=\"noopener noreferrer\".",
          );
        }
      }

      if (tag === "img" && !attributes.has("alt")) {
        addIssue(
          issues,
          "error",
          "image-alt",
          file,
          source,
          opening,
          "Image is missing alt text. Use alt=\"\" for decorative images.",
        );
      }

      if (onClick && ["div", "span", "li", "section", "article"].includes(tag)) {
        const keyboardHandler =
          attributes.has("onKeyDown") ||
          attributes.has("onKeyUp") ||
          attributes.has("onKeyPress");
        const keyboardRole = ["button", "link", "checkbox", "switch", "tab", "menuitem"].includes(role);
        const focusable = attributes.has("tabIndex");
        if (!keyboardHandler || !keyboardRole || !focusable) {
          addIssue(
            issues,
            "error",
            "click-keyboard-parity",
            file,
            source,
            opening,
            "Non-native clickable element needs an interactive role, tabIndex, and keyboard handler.",
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

const counts = inventory.reduce((acc, item) => {
  acc[item.tag] = (acc[item.tag] ?? 0) + 1;
  return acc;
}, {});
const errorCount = issues.filter((issue) => issue.severity === "error").length;
const report = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  interactiveCount: inventory.length,
  counts,
  errorCount,
  issues,
  inventory,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "interaction-audit.json"),
  JSON.stringify(report, null, 2),
);

const markdown = [
  "# Interaction audit",
  "",
  `- TSX files scanned: ${files.length}`,
  `- Interactive elements inventoried: ${inventory.length}`,
  `- Errors: ${errorCount}`,
  "",
  "## Counts by element",
  "",
  ...Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, count]) => `- \`${tag}\`: ${count}`),
  "",
  "## Issues",
  "",
  ...(issues.length
    ? issues.map(
        (issue) =>
          `- **${issue.rule}** — \`${issue.file}:${issue.line}\`: ${issue.message}`,
      )
    : ["No issues found."]),
  "",
].join("\n");
fs.writeFileSync(path.join(OUT, "interaction-audit.md"), markdown);

console.log(markdown);
if (STRICT && errorCount > 0) process.exit(1);
