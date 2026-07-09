import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import {
  getAdminStats,
  listRecentUsers,
  listRecentThoughts,
  grantAdmin,
  revokeAdmin,
  adminDeleteInbox,
  getMyAdminStatus,
  getAdminCount,
  listFeedback,
  updateFeedbackStatus,
  deleteFeedback,
} from "@/lib/admin.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const t = useT();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = t("관리자 — ItJima", "Admin — ItJima");
  }, [t]);

  const adminCheck = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => getMyAdminStatus(),
    retry: false,
  });

  const adminCount = useQuery({
    queryKey: ["adminCount"],
    queryFn: () => getAdminCount(),
    enabled: !adminCheck.data?.isAdmin,
    retry: false,
  });

  const isAdmin = !!adminCheck.data?.isAdmin;
  const myUserId = adminCheck.data?.userId;
  const myEmail = adminCheck.data?.email;
  const adminCountValue =
    adminCheck.data?.adminCount ?? adminCount.data?.count ?? null;
  const adminCountKnown = adminCountValue !== null;
  const noAdminsYet = adminCountKnown && adminCountValue === 0;
  const gateLoading =
    !isAdmin && (adminCheck.isLoading || adminCount.isLoading);

  const bootstrap = useMutation({
    mutationFn: async () => {
      if (!myUserId) throw new Error("No user");
      return grantAdmin({ userId: myUserId });
    },
    onSuccess: () => {
      toast.success(t("관리자로 등록됐어요", "You are now an admin"));
      qc.invalidateQueries({ queryKey: ["isAdmin"] });
      qc.invalidateQueries({ queryKey: ["adminCount"] });
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (
        msg.includes("Could not find the function") ||
        msg.includes("bootstrap_admin")
      ) {
        toast.error(
          t(
            "DB 함수가 아직 없어요. Supabase SQL Editor에서 bootstrap_admin 마이그레이션을 실행해 주세요.",
            "DB function missing. Run the bootstrap_admin migration in Supabase SQL Editor.",
          ),
        );
        return;
      }
      if (msg.includes("Admin already exists")) {
        toast.error(
          t(
            `다른 관리자 계정이 ${adminCountValue ?? 1}개 있어요. Supabase SQL Editor에서 아래 UID를 admin으로 추가해 주세요.`,
            `Another admin account exists (${adminCountValue ?? 1}). Add your UID as admin in Supabase SQL Editor.`,
          ),
        );
        return;
      }
      if (msg.includes("ON CONFLICT")) {
        toast.error(
          t(
            "앱이 예전 버전이에요. 새로고침(Cmd+Shift+R) 후 다시 시도해 주세요.",
            "App is outdated. Hard refresh (Cmd+Shift+R) and try again.",
          ),
        );
        return;
      }
      toast.error(msg);
    },
  });

  if (adminCheck.isLoading || gateLoading) {
    return (
      <Shell>
        <div className="p-8 text-ink-soft">
          {t("확인 중...", "Checking...")}
        </div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <Shield size={48} className="text-ink-soft" />
          <div className="text-lg font-bold text-ink">
            {t("관리자 전용", "Admins only")}
          </div>
          <p className="max-w-sm text-sm text-ink-soft">
            {noAdminsYet
              ? t(
                  "아직 관리자가 없어요. 첫 관리자가 되시겠어요?",
                  "No admin yet. Become the first admin?",
                )
              : adminCountKnown
                ? t(
                    `관리자 ${adminCountValue}명이 등록되어 있어요. 본인 계정에 권한이 없으면 Supabase에서 UID를 추가해 주세요.`,
                    `${adminCountValue} admin(s) registered. If you lack access, add your UID in Supabase.`,
                  )
                : t(
                    "관리자 권한이 없어요. 아래 버튼으로 첫 관리자 등록을 시도해 보세요.",
                    "You are not an admin. Try becoming the first admin below.",
                  )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => bootstrap.mutate()}
              disabled={bootstrap.isPending}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-ink shadow-card disabled:opacity-50"
            >
              {bootstrap.isPending
                ? t("처리 중...", "Working...")
                : noAdminsYet
                  ? t("첫 관리자 되기", "Become first admin")
                  : t("권한 다시 확인", "Recheck access")}
            </button>
            <button
              type="button"
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ["isAdmin"] });
                void qc.invalidateQueries({ queryKey: ["adminCount"] });
              }}
              className="rounded-full bg-ink/[0.06] px-4 py-2.5 text-sm font-semibold text-ink-soft"
            >
              {t("새로고침", "Refresh")}
            </button>
          </div>
          {(myEmail || myUserId) && (
            <div className="max-w-sm space-y-1 text-[11px] text-ink-soft/80">
              {myEmail && (
                <p>
                  {t("로그인", "Signed in")}: {myEmail}
                </p>
              )}
              {myUserId && (
                <p className="break-all">
                  {t("내 UID", "My UID")}: {myUserId}
                </p>
              )}
              {adminCountKnown && (
                <p>
                  {t("등록된 관리자", "Admins registered")}: {adminCountValue}
                </p>
              )}
            </div>
          )}
          {myUserId && !noAdminsYet && (
            <div className="max-w-sm rounded-2xl bg-ink/[0.04] px-3 py-2 text-left">
              <p className="text-[10px] font-semibold text-ink-soft">
                Supabase SQL Editor
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-ink/80">
                {`INSERT INTO public.user_roles (user_id, role)
VALUES ('${myUserId}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;`}
              </pre>
            </div>
          )}
          <Link to="/" className="text-xs text-ink-soft underline">
            {t("홈으로", "Back home")}
          </Link>
        </div>
      </Shell>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const t = useT();
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["adminStats"],
    queryFn: () => getAdminStats(),
    retry: false,
  });
  const users = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => listRecentUsers(),
    retry: false,
  });
  const thoughts = useQuery({
    queryKey: ["adminThoughts"],
    queryFn: () => listRecentThoughts(),
    retry: false,
  });
  const feedback = useQuery({
    queryKey: ["adminFeedback"],
    queryFn: () => listFeedback(),
    retry: false,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["adminStats"] });
    qc.invalidateQueries({ queryKey: ["adminUsers"] });
    qc.invalidateQueries({ queryKey: ["adminThoughts"] });
    qc.invalidateQueries({ queryKey: ["adminFeedback"] });
  };

  const feedbackStatusMut = useMutation({
    mutationFn: (v: {
      id: string;
      status: "new" | "reviewing" | "resolved" | "archived";
    }) => updateFeedbackStatus(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminFeedback"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const feedbackDeleteMut = useMutation({
    mutationFn: (id: string) => deleteFeedback({ id }),
    onSuccess: () => {
      toast.success(t("삭제됨", "Deleted"));
      qc.invalidateQueries({ queryKey: ["adminFeedback"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantMut = useMutation({
    mutationFn: (userId: string) => grantAdmin({ userId }),
    onSuccess: () => {
      toast.success(t("권한 부여됨", "Granted"));
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeAdmin({ userId }),
    onSuccess: () => {
      toast.success(t("권한 회수됨", "Revoked"));
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteInbox({ id }),
    onSuccess: () => {
      toast.success(t("삭제됨", "Deleted"));
      qc.invalidateQueries({ queryKey: ["adminThoughts"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">
              {t("관리자", "Admin")}
            </h1>
            <p className="text-sm text-ink-soft">
              {t(
                "운영 지표 및 사용자/콘텐츠 관리",
                "Stats and user/content management",
              )}
            </p>
          </div>
          <button
            onClick={refreshAll}
            className="glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft shadow-card"
          >
            <RefreshCw size={14} /> {t("새로고침", "Refresh")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={t("사용자", "Users")}
            value={stats.data?.userCount}
          />
          <StatCard
            label={t("생각", "Thoughts")}
            value={stats.data?.inboxCount}
          />
          <StatCard
            label={t("일정", "Schedules")}
            value={stats.data?.scheduleCount}
          />
          <StatCard
            label={t("보관", "Archive")}
            value={stats.data?.archiveCount}
          />
        </div>

        <section className="glass-soft rounded-3xl p-4 shadow-card md:p-6">
          <h2 className="mb-3 text-lg font-bold text-ink">
            {t("최근 사용자", "Recent users")}
          </h2>
          {users.isLoading ? (
            <div className="text-sm text-ink-soft">
              {t("불러오는 중...", "Loading...")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-ink-soft">
                  <tr>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">{t("가입", "Joined")}</th>
                    <th className="py-2 pr-3">
                      {t("최근 로그인", "Last sign-in")}
                    </th>
                    <th className="py-2 pr-3">{t("역할", "Role")}</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(users.data ?? []).map((u) => {
                    const isAdminRow = u.roles.includes("admin");
                    return (
                      <tr key={u.id} className="border-t border-white/40">
                        <td className="py-2 pr-3 font-medium text-ink">
                          {u.email || "—"}
                        </td>
                        <td className="py-2 pr-3 text-ink-soft">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-ink-soft">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {isAdminRow ? (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                              admin
                            </span>
                          ) : (
                            <span className="text-xs text-ink-soft">user</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {isAdminRow ? (
                            <button
                              onClick={() => revokeMut.mutate(u.id)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-white/60"
                            >
                              <UserMinus size={12} /> {t("회수", "Revoke")}
                            </button>
                          ) : (
                            <button
                              onClick={() => grantMut.mutate(u.id)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-white/60"
                            >
                              <UserPlus size={12} />{" "}
                              {t("관리자 부여", "Make admin")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-soft rounded-3xl p-4 shadow-card md:p-6">
          <h2 className="mb-3 text-lg font-bold text-ink">
            {t("최근 생각 (전체 유저)", "Recent thoughts (all users)")}
          </h2>
          {thoughts.isLoading ? (
            <div className="text-sm text-ink-soft">
              {t("불러오는 중...", "Loading...")}
            </div>
          ) : (
            <ul className="space-y-2">
              {(thoughts.data ?? []).map((th) => (
                <li
                  key={th.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-white/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {th.text || "(empty)"}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {new Date(th.created_at).toLocaleString()} ·{" "}
                      {th.user_id.slice(0, 8)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t("삭제할까요?", "Delete?")))
                        deleteMut.mutate(th.id);
                    }}
                    className="shrink-0 rounded-full p-1.5 text-destructive hover:bg-white/60"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {(thoughts.data ?? []).length === 0 && (
                <li className="text-sm text-ink-soft">
                  {t("아직 없어요.", "None yet.")}
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="glass-soft rounded-3xl p-4 shadow-card md:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
            <MessageSquare size={18} />
            {t("사용자 피드백", "User feedback")}
            {(feedback.data?.filter((f) => f.status === "new").length ?? 0) >
              0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-ink">
                {feedback.data?.filter((f) => f.status === "new").length}{" "}
                {t("새 글", "new")}
              </span>
            )}
          </h2>
          {feedback.isLoading ? (
            <div className="text-sm text-ink-soft">
              {t("불러오는 중...", "Loading...")}
            </div>
          ) : (
            <ul className="space-y-2">
              {(feedback.data ?? []).map((f) => (
                <li key={f.id} className="rounded-2xl bg-white/40 px-3 py-2.5">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-soft">
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 font-semibold text-ink">
                      {f.category}
                    </span>
                    <select
                      value={f.status}
                      onChange={(e) =>
                        feedbackStatusMut.mutate({
                          id: f.id,
                          status: e.target.value as
                            | "new"
                            | "reviewing"
                            | "resolved"
                            | "archived",
                        })
                      }
                      className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-ink focus:outline-none"
                    >
                      <option value="new">new</option>
                      <option value="reviewing">reviewing</option>
                      <option value="resolved">resolved</option>
                      <option value="archived">archived</option>
                    </select>
                    <span className="ml-auto">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(t("삭제할까요?", "Delete?")))
                          feedbackDeleteMut.mutate(f.id);
                      }}
                      className="rounded-full p-1 text-destructive hover:bg-white/60"
                      aria-label="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">
                    {f.message}
                  </p>
                  {(f.email || f.user_id || f.page_path) && (
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {f.email && <>✉ {f.email} · </>}
                      {f.user_id && <>👤 {f.user_id.slice(0, 8)} · </>}
                      {f.page_path && <>📍 {f.page_path}</>}
                    </p>
                  )}
                </li>
              ))}
              {(feedback.data ?? []).length === 0 && (
                <li className="text-sm text-ink-soft">
                  {t("아직 없어요.", "None yet.")}
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="glass-soft rounded-3xl p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh w-full">{children}</div>;
}
