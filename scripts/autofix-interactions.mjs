import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve("src");
const changed = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}

function tagNameText(node, sourceFile) {
  return node.tagName.getText(sourceFile);
}

function attributesByName(node) {
  const result = new Map();
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop)) result.set(prop.name.text, prop);
  }
  return result;
}

function initializerText(attribute, sourceFile) {
  if (!attribute?.initializer) return null;
  return attribute.initializer.getText(sourceFile);
}

for (const file of walk(ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const edits = [];

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagNameText(node, sf);
      const attrs = attributesByName(node);
      const insertAt = node.attributes.pos;

      const isButton = tag === "button" || tag.endsWith(".button");
      if (isButton && attrs.has("onClick") && !attrs.has("type")) {
        edits.push({ pos: insertAt, text: ' type="button"' });
      }

      const isFormControl = tag === "input" || tag === "textarea" || tag === "select";
      const hasAccessibleHook =
        attrs.has("aria-label") ||
        attrs.has("aria-labelledby") ||
        attrs.has("id") ||
        attrs.has("title");
      if (isFormControl && !hasAccessibleHook) {
        const placeholder = initializerText(attrs.get("placeholder"), sf);
        const name = initializerText(attrs.get("name"), sf);
        const labelSource = placeholder ?? name;
        if (labelSource) {
          edits.push({ pos: insertAt, text: ` aria-label=${labelSource}` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  if (!edits.length) continue;

  edits.sort((a, b) => b.pos - a.pos);
  let next = source;
  for (const edit of edits) {
    next = `${next.slice(0, edit.pos)}${edit.text}${next.slice(edit.pos)}`;
  }
  if (next !== source) {
    fs.writeFileSync(file, next);
    changed.push(path.relative(process.cwd(), file));
  }
}

console.log(`Autofixed ${changed.length} files.`);
for (const file of changed) console.log(`- ${file}`);
