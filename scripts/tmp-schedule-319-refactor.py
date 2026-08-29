from pathlib import Path

p = Path("src/routes/schedule.tsx")
s = p.read_text()

replacements = [
    (
        'const [tab, setTab] = useState<"today" | "list" | "cal">("today");',
        'const [tab, setTab] = useState<"today" | "list">("today");',
    ),
    ('{t("내 일정", "Schedule")}', '{t("일정", "Schedule")}'),
    (
        '<div className="px-5 pb-3 pt-6">',
        '<div className="mx-auto w-full max-w-[680px] px-5 pb-3 pt-6">',
    ),
    (
        '<div className="px-5 pb-2">',
        '<div className="mx-auto w-full max-w-[680px] px-5 pb-2">',
    ),
    (
        '<div className="flex-1 px-5 pb-24">',
        '<div className="mx-auto w-full max-w-[680px] flex-1 px-5 pb-24">',
    ),
    (
        '        ) : tab === "list" ? (\n',
        '        ) : (\n',
    ),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f"missing expected text: {old}")
    s = s.replace(old, new, 1)

subtitle = '''          <p className="page-eyebrow mt-2.5 max-w-[22rem] leading-relaxed text-ink-soft">
            {t(
              "시간이 포함된 기록은 여기에 자동으로 나타나요.",
              "Timed records show up here automatically.",
            )}
          </p>
'''
if subtitle not in s:
    raise SystemExit("schedule subtitle block not found")
s = s.replace(subtitle, "", 1)

calendar_tab = '''              <button
                type="button"
                role="tab"
                id="schedule-tab-cal"
                aria-selected={tab === "cal"}
                aria-controls="schedule-panel-cal"
                onClick={() => setTab("cal")}
                className={`segment-nav-item shrink-0 flex-none px-3 ${
                  tab === "cal" ? "segment-nav-item-active" : "segment-nav-item-inactive"
                }`}
              >
                {t("달력", "Calendar")}
              </button>
'''
if calendar_tab not in s:
    raise SystemExit("calendar tab block not found")
s = s.replace(calendar_tab, "", 1)

panel_id = '''            id={
              tab === "list"
                ? "schedule-panel-list"
                : tab === "today"
                  ? "schedule-panel-today"
                  : "schedule-panel-cal"
            }
'''
if panel_id not in s:
    raise SystemExit("tabpanel id block not found")
s = s.replace(
    panel_id,
    '            id={tab === "list" ? "schedule-panel-list" : "schedule-panel-today"}\n',
    1,
)

calendar_branch = '''        ) : (
          <CalendarGrid
            items={activeItems}
            pins={pins}
            onTogglePin={(id) => {
              togglePin(id);
              haptic(8);
            }}
            onEdit={(s) => setSheet({ open: true, edit: s })}
            onQuickAdd={openQuickAdd}
            onDelete={async (s) => {
              await deleteScheduleRow(s);
            }}
            onDuplicate={duplicateSchedule}
            onDropToDate={moveEventsToDate}
            onAlarm={(s) => setAlarmSheet(s)}
          />
        )}
'''
if calendar_branch not in s:
    raise SystemExit("calendar render branch not found")
s = s.replace(calendar_branch, "        )}\n", 1)

p.write_text(s)
