import { useEffect, useState } from "react";
import { supabase, configError } from "../integrations/client";
import { cleanupExpired } from "../integrations/save";
export function AuthPanel() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [user, setUser] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user.email ?? null),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || !supabase) return;
    void cleanupExpired(supabase).catch(() =>
      setMessage("임시 이미지 정리가 필요해요. 다음 로그인에서 다시 시도해요."),
    );
  }, [user]);
  if (!supabase)
    return (
      <aside className="notice">
        {configError ?? "V03 DB 미연결 · 로컬 검토만 가능해요."}
      </aside>
    );
  async function authenticate(signup: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const result = signup
        ? await supabase!.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: location.origin },
          })
        : await supabase!.auth.signInWithPassword({ email, password });
      setMessage(
        result.error
          ? "인증에 실패했어요. 입력과 V03 인증 설정을 확인해주세요."
          : signup
            ? "가입 요청을 보냈어요. 필요한 경우 이메일을 확인해주세요."
            : "로그인했어요.",
      );
    } catch {
      setMessage("인증 서버에 연결하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="account-menu" onBlur={e=>{if(e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false;}} onKeyDown={e=>{if(e.key==="Escape"){e.currentTarget.open=false;e.currentTarget.querySelector("summary")?.focus();}}}>
      <summary>V03 계정 · {user ? "로그인됨" : "로그인 필요"}</summary>
      <div className="account-popover">
      {user ? (
        <>
          <p>{user}</p>
          <button
            onClick={() =>
              void supabase!.auth
                .signOut()
                .then(({ error }) =>
                  setMessage(error ? "로그아웃 실패" : "로그아웃했어요."),
                )
            }
          >
            로그아웃
          </button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void authenticate(false);
          }}
        >
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="current-password"
          />
          <button className="primary" disabled={busy}>
            로그인
          </button>
          <button
            type="button"
            disabled={busy || !email || password.length < 8}
            onClick={() => void authenticate(true)}
          >
            가입
          </button>
        </form>
      )}
      <p role="status">{message}</p>
      </div>
    </details>
  );
}
