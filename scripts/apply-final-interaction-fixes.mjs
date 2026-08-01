import fs from "node:fs";

function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) {
    throw new Error(`Missing expected source for ${label}`);
  }
  return text.replace(before, after);
}

function update(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
}

update("src/routes/_authenticated/admin.tsx", (source) =>
  replaceRequired(
    source,
    `                    <select\n                      value={f.status}`,
    `                    <select\n                      aria-label={t("피드백 상태", "Feedback status")}\n                      value={f.status}`,
    "admin feedback status label",
  ),
);

update("src/routes/archive.tsx", (source) => {
  let next = source;

  next = replaceRequired(
    next,
    `          <div\n            className="absolute inset-0 bg-ink/40 backdrop-blur-md"\n            onClick={() => setGroupModal(false)}\n          />`,
    `          <button\n            type="button"\n            aria-label={t("새 모음 닫기", "Close new gathering")}\n            className="absolute inset-0 bg-ink/40 backdrop-blur-md"\n            onClick={() => setGroupModal(false)}\n          />`,
    "create group backdrop",
  );

  next = replaceRequired(
    next,
    `        <div\n          className="fixed inset-0 z-50 flex flex-col justify-end"\n          role="dialog"\n          aria-modal="true"\n          onClick={() => setUngroupTarget(null)}\n        >\n          <div className="flex-1 animate-fade-in bg-ink/30 backdrop-blur-sm" />\n          <div\n            className="animate-slide-up rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"\n            onClick={(e) => e.stopPropagation()}\n          >`,
    `        <div\n          className="fixed inset-0 z-50 flex flex-col justify-end"\n          role="presentation"\n        >\n          <button\n            type="button"\n            aria-label={t("그룹 해제 창 닫기", "Close remove group dialog")}\n            className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-sm"\n            onClick={() => setUngroupTarget(null)}\n          />\n          <div\n            role="dialog"\n            aria-modal="true"\n            aria-label={t("그룹 해제", "Remove group")}\n            className="relative animate-slide-up rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"\n          >`,
    "ungroup dialog semantics",
  );

  next = replaceRequired(
    next,
    `              <button\n                type="button"\n                onClick={() => setUngroupTarget(null)}`,
    `              <button\n                type="button"\n                autoFocus\n                onClick={() => setUngroupTarget(null)}`,
    "ungroup initial focus",
  );

  next = replaceRequired(
    next,
    `        <div\n          className="fixed inset-0 z-50 flex flex-col"\n          role="dialog"\n          aria-modal="true"\n          aria-labelledby="archive-edit-title"\n          data-testid="archive-edit-dialog"\n          onClick={() => setEditItem(null)}\n        >\n          <div className="flex-1 animate-fade-in bg-ink/30 backdrop-blur-sm" />\n          <div\n            className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"\n            onClick={(e) => e.stopPropagation()}\n          >`,
    `        <div\n          className="fixed inset-0 z-50 flex flex-col"\n          role="presentation"\n          data-testid="archive-edit-dialog"\n        >\n          <button\n            type="button"\n            aria-label={t("이름 수정 닫기", "Close name editor")}\n            className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-sm"\n            onClick={() => setEditItem(null)}\n          />\n          <div\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="archive-edit-title"\n            className="relative mt-auto animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"\n          >`,
    "archive edit dialog semantics",
  );

  next = replaceRequired(
    next,
    `            <input\n              value={editTitle}`,
    `            <input\n              aria-label={t("보관 이름", "Archive name")}\n              autoFocus\n              value={editTitle}`,
    "archive edit input label",
  );

  return next;
});
