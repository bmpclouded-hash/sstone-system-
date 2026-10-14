// ── Paste your Supabase values here ──────────────────────────────
const SUPABASE_URL  = "YOUR_SUPABASE_URL";
const SUPABASE_ANON = "YOUR_SUPABASE_ANON_KEY";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Constants ─────────────────────────────────────────────────────
const ROLES     = ["operations_manager","estimator","project_manager","fabricator","installer","delivery_crew"];
const RLBL      = {operations_manager:"Operations Manager",estimator:"Estimator",project_manager:"Project Manager",fabricator:"Fabricator",installer:"Install Crew",delivery_crew:"Delivery Crew"};
const ADMIN_R   = ["operations_manager","estimator","project_manager"];
const STATUSES  = ["Scheduled","In progress","Complete"];
const FAB_STATS = ["Queued","In Fab","Cut","Polished","Ready"];
const LOCATIONS = ["Charleston"];
const DEFAULT_TH = 700;

// ── Theme ─────────────────────────────────────────────────────────
const DARK = {bg:"#1a1a17",surface:"#232320",card:"#2a2a26",border:"#38382f",orange:"#d4642a",text:"#f0ede8",muted:"#8a8880",dim:"#5a5955",red:"#c0392b",yellow:"#c8960a",green:"#2d7a45",redBg:"#2c1a18",yellowBg:"#2c2410",greenBg:"#182c20"};

// ── Shared helpers ────────────────────────────────────────────────
const byName  = arr => [...arr].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:"base"}));
const isAdmin = role => ADMIN_R.includes(role);
const ago     = iso => { const m = Math.floor((Date.now()-new Date(iso))/60000); if(m<1) return "just now"; if(m<60) return m+"m ago"; const h = Math.floor(m/60); if(h<24) return h+"h ago"; return Math.floor(h/24)+"d ago"; };
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
const locColor = (loc, C) => loc==="Charleston" ? {bg:C.greenBg,c:C.green} : {bg:C.yellowBg,c:C.yellow};

async function logActivity(orgId, userId, action, detail) {
  await sb.from("activity_log").insert({org_id:orgId, user_id:userId, action, detail:detail||null});
}
