import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:cors});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return reply({error:"method_not_allowed"},405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return reply({error:"unauthorized"},401);
  const client = createClient(URL, KEY, {global:{headers:{Authorization:auth}}});
  const token = auth.slice(7);
  const {data:{user},error:userError} = await client.auth.getUser(token);
  if (userError || !user) return reply({error:"unauthorized"},401);
  let body: Record<string,unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const path = new URL(req.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  try {
    if (path === "getStatus" || path === "status") {
      const {data,error} = await client.rpc("fa_get_status");
      if (error) throw error;
      return reply({...data,success:true,granted:data.granted===true});
    }
    if (path === "reserve") {
      const {data,error} = await client.rpc("fa_reserve",{
        p_count:Number(body.count ?? 1),p_device_id:typeof body.deviceId==="string"?body.deviceId:null,
        p_flow_gaia:typeof body.flowGaia==="string"?body.flowGaia:null,p_flow_email:typeof body.flowEmail==="string"?body.flowEmail:null
      });
      if (error) throw error;
      return reply(data,data.granted?200:429);
    }
    if (path === "reconcile") {
      const {data,error} = await client.rpc("fa_reconcile",{p_used:Number(body.used??0),p_reservation_id:typeof body.reservationId==="string"?body.reservationId:null});
      if (error) throw error;
      return reply(data);
    }
    if (path === "flowAccounts" || path === "flow-accounts") {
      const {data,error}=await client.from("fa_flow_accounts").select("id,flow_gaia,flow_email,label,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
      if (error) throw error;
      return reply({accounts:data,flowAccounts:data,success:true});
    }
    if (path === "removeFlowAccount" || path === "remove-flow-account") {
      const gaia=String(body.flowGaia??""); if (!gaia) return reply({error:"flowGaia_required"},400);
      const {error}=await client.from("fa_flow_accounts").delete().eq("user_id",user.id).eq("flow_gaia",gaia);
      if (error) throw error; return reply({success:true,removed:true});
    }
    if (["checkout","createCheckout","create-checkout"].includes(path)) return reply({error:"checkout_not_configured",message:"Payments are not configured yet."},501);
    if (path === "refresh") return reply({error:"refresh_not_supported"},501);
    return reply({error:"unknown_endpoint",path},404);
  } catch (err) {
    const message=err instanceof Error?err.message:"internal_error";
    return reply({error:message},/unauthorized/i.test(message)?401:/quota/i.test(message)?429:400);
  }
});