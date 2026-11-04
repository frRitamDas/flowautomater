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
  const getSupabaseUser = async () => { const session = await refreshSession(); return session?.user || null; };
  const callBackend = async (endpoint, body = {}) => {
    const session = await refreshSession();
    if (!session?.access_token) throw new Error("Please sign in again.");
    const response = await ORIGINAL_FETCH(SUPABASE_URL + "/functions/v1/flow-api/" + encodeURIComponent(endpoint), {
      method:"POST", headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"}, body:JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Unable to load account status");
    return data;
  };
  const ORIGINAL_FETCH = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === "string" ? input : input?.url || "";
    if (rawUrl.includes("www.googleapis.com/oauth2/v3/userinfo") || rawUrl.includes("www.googleapis.com/oauth2/v2/userinfo")) {
      const user = await getSupabaseUser();
      if (!user) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"Content-Type":"application/json"}});
      return new Response(JSON.stringify({id:user.id,sub:user.id,email:user.email||"",name:user.user_metadata?.full_name||user.email?.split("@")[0]||"User",picture:user.user_metadata?.avatar_url||""}),{status:200,headers:{"Content-Type":"application/json"}});
    }
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

  // Supabase-native account screen. The legacy account handler assumes Firebase/Google auth;
  // stop it from treating a valid Supabase session as signed out.
  let accountStatusCache = null, accountStatusFetchedAt = 0, accountStatusPromise = null;
  const paintAccountStatus = (status) => {
    const plan=status?.plan||{}, limit=Number(status?.limit??status?.daily_limit??0), used=Number(status?.used??0), reserved=Number(status?.reserved??0), remaining=Number(status?.remaining??Math.max(0,limit-used-reserved));
    const pct=limit>0?Math.min(100,Math.round(((used+reserved)/limit)*100)):0;
    const badge=$("acctPlanBadge"), usage=$("acctUsageText"), fill=$("acctUsageFill"), hint=$("acctUsageHint"), upgrade=$("acctUpgrade");
    if(badge) badge.textContent=plan.name||plan.code||"Free";
    if(usage) usage.textContent=(limit>=100000?"Unlimited":limit.toLocaleString())+" daily · "+used.toLocaleString()+" used";
    if(fill) fill.style.width=pct+"%";
    if(hint) hint.textContent=(limit>=100000?"Unlimited":remaining.toLocaleString()+" remaining")+" today"+(reserved?" · "+reserved.toLocaleString()+" reserved":"");
    if(upgrade) upgrade.hidden=true;
  };
  const loadAccountStatus = async (force=false) => {
    if(!force && accountStatusCache && Date.now()-accountStatusFetchedAt<15000) { paintAccountStatus(accountStatusCache); return accountStatusCache; }
    if(accountStatusPromise) return accountStatusPromise;
    accountStatusPromise=callBackend("getStatus",{}).then(status=>{accountStatusCache=status;accountStatusFetchedAt=Date.now();paintAccountStatus(status);return status;}).catch(error=>{
      if($("acctPlanBadge")) $("acctPlanBadge").textContent="Unavailable";
      if($("acctUsageText")) $("acctUsageText").textContent="Usage unavailable";
      if($("acctUsageHint")) $("acctUsageHint").textContent=error.message||"Could not load usage";
      return null;
    }).finally(()=>{accountStatusPromise=null;});
    return accountStatusPromise;
  };
  const openSupabaseAccount = () => {
    const overlay=$("acctOverlay"); if(!overlay) return;
    overlay.hidden=false;
    getSession().then(async stored=>{
      let session=stored;
      if(!session?.access_token) session=await refreshSession();
      if(!session?.access_token){overlay.hidden=true;showGate();return;}
      const email=session.user?.email||"Signed-in user";
      const name=session.user?.user_metadata?.full_name||email.split("@")[0];
      if($("acctName")) $("acctName").textContent=name;
      if($("acctEmail")) $("acctEmail").textContent=email;
      if($("acctAvatar")) $("acctAvatar").textContent=(name.trim()[0]||email[0]||"?").toUpperCase();
      const method=overlay.querySelector(".card .info-row .info-val"); if(method) method.textContent="Supabase email and password";
      if($("acctLastLogin")) $("acctLastLogin").textContent=session.user?.last_sign_in_at?new Date(session.user.last_sign_in_at).toLocaleString():"Current session";
      if(accountStatusCache) paintAccountStatus(accountStatusCache);
      loadAccountStatus(false);
    }).catch(error=>{if($("acctUsageHint")) $("acctUsageHint").textContent=error.message||"Could not load account";});
  };
  document.addEventListener("click", (event) => {
    const profile = event.target?.closest?.("#profileBtn");
    if (profile) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSupabaseAccount().catch(error => setError(error.message));
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#signOutBtn")) {
      event.preventDefault(); event.stopImmediatePropagation();
      clearSession().then(()=>{ if ($("acctOverlay")) $("acctOverlay").hidden=true; showGate(); });
      return;
    }
    if (event.target?.closest?.("#acctClose")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if ($("acctOverlay")) $("acctOverlay").hidden = true;
    }
  }, true);

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