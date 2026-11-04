(() => {
  const SUPABASE_URL = "https://lejfarzqdywdaqvbfcaj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_kEtqDqvSZta5-Qp78uP12w_7T4SPGz2";
  const STORE = "flowAutomatorSupabaseSession";
  const $ = (id) => document.getElementById(id);
  const setError = (message) => {
    const el = $("authErr");
    if (el) { el.textContent = message || ""; el.hidden = !message; }
  };
  const getSession = async () => (await chrome.storage.local.get(STORE))[STORE] || null;
  const saveSession = async (session) => chrome.storage.local.set({[STORE]:session});
  const clearSession = async () => chrome.storage.local.remove(STORE);
  const authRequest = async (path, body) => {
    const response = await fetch(SUPABASE_URL + "/auth/v1/" + path, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
      body:JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || "Authentication failed");
    return data;
  };
  const showApp = () => { if ($("authGate")) $("authGate").hidden = true; };
  const showGate = () => { if ($("authGate")) $("authGate").hidden = false; };
  const refreshSession = async () => {
    const session = await getSession();
    if (!session?.refresh_token) return null;
    if (session.expires_at && session.expires_at * 1000 > Date.now() + 60000) return session;
    try {
      const next = await authRequest("token?grant_type=refresh_token",{refresh_token:session.refresh_token});
      const normalized = {...next,expires_at:Math.floor(Date.now()/1000)+(next.expires_in || 3600)};
      await saveSession(normalized);
      return normalized;
    } catch { await clearSession(); return null; }
  };
  const buildAuthForm = () => {
    const card = document.querySelector("#authGate .auth-card");
    if (!card || $("faAuthForm")) return;
    const existingGoogle = $("googleSignIn");
    if (existingGoogle) existingGoogle.hidden = true;
    const paragraph = card.querySelector(".auth-sub");
    if (paragraph) paragraph.textContent = "Create an account or sign in with your email and password.";
    const form = document.createElement("form");
    form.id = "faAuthForm";
    form.innerHTML = `
      <label class="field-label" for="faEmail">Email address</label>
      <input id="faEmail" type="email" required autocomplete="email" placeholder="you@example.com" style="width:100%;box-sizing:border-box;margin:8px 0 14px;padding:12px;border-radius:10px;border:1px solid var(--border,#444);background:var(--input-bg,#111);color:inherit">
      <label class="field-label" for="faPassword">Password</label>
      <input id="faPassword" type="password" required minlength="8" autocomplete="current-password" placeholder="At least 8 characters" style="width:100%;box-sizing:border-box;margin:8px 0 14px;padding:12px;border-radius:10px;border:1px solid var(--border,#444);background:var(--input-bg,#111);color:inherit">
      <button class="btn primary" type="submit" id="faSignIn" style="width:100%">Sign in</button>
      <button class="btn" type="button" id="faSignUp" style="width:100%;margin-top:8px">Create account</button>
    `;
    if (existingGoogle) existingGoogle.parentNode.insertBefore(form,existingGoogle);
    else card.appendChild(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); setError("");
      const email=$("faEmail").value.trim().toLowerCase(), password=$("faPassword").value;
      try {
        const session=await authRequest("token?grant_type=password",{email,password});
        await saveSession({...session,expires_at:Math.floor(Date.now()/1000)+(session.expires_in||3600)});
        showApp();
        window.dispatchEvent(new CustomEvent("fa-auth-ready"));
      } catch(error) { setError(error.message); }
    });
    $("faSignUp").addEventListener("click", async () => {
      setError("");
      const email=$("faEmail").value.trim().toLowerCase(), password=$("faPassword").value;
      if (!email || password.length < 8) { setError("Enter a valid email and a password with at least 8 characters."); return; }
      try {
        const result=await authRequest("signup",{email,password,data:{full_name:email.split("@")[0]}});
        if (result.access_token) {
          await saveSession({...result,expires_at:Math.floor(Date.now()/1000)+(result.expires_in||3600)});
          showApp(); window.dispatchEvent(new CustomEvent("fa-auth-ready"));
        } else {
          setError("Account created. Verify your email, then sign in.");
        }
      } catch(error) { setError(error.message); }
    });
  };
  const ORIGINAL_FETCH = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === "string" ? input : input?.url || "";
    if (!rawUrl.includes("tryaitoday-automator.cloudfunctions.net")) return ORIGINAL_FETCH(input,init);
    const session = await refreshSession();
    if (!session?.access_token) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"Content-Type":"application/json"}});
    const original = new URL(rawUrl);
    const endpoint = original.pathname.split("/").filter(Boolean).pop();
    const target = SUPABASE_URL + "/functions/v1/flow-api/" + encodeURIComponent(endpoint);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("apikey",SUPABASE_KEY);
    headers.set("Authorization","Bearer " + session.access_token);
    if (!headers.has("Content-Type")) headers.set("Content-Type","application/json");
    return ORIGINAL_FETCH(target,{...init,method:init.method || "POST",headers});
  };
  document.addEventListener("DOMContentLoaded", async () => {
    buildAuthForm();
    const session=await refreshSession();
    if (session?.access_token) showApp(); else showGate();
    $("signOutBtn")?.addEventListener("click", async (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      await clearSession(); showGate();
    },true);
  });
  if (document.readyState !== "loading") {
    buildAuthForm();
    refreshSession().then(session => session?.access_token ? showApp() : showGate());
  }
})();