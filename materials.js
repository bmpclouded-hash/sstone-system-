function MaterialsTab({profile,showToast}){
  const C=DARK;
  const [materials,setMaterials]=uS([]);const [cats,setCats]=uS([]);const [locStock,setLocStock]=uS([]);
  const [search,setSearch]=uS("");const [catFilt,setCatFilt]=uS("All");const [locFilt,setLocFilt]=uS("All");
  const [editing,setEditing]=uS(null);const [transferring,setTransferring]=uS(null);const [csvOpen,setCsvOpen]=uS(false);
  const [selMode,setSelMode]=uS(false);const [sel,setSel]=uS([]);const [bulkOpen,setBulkOpen]=uS(false);
  const [loading,setLoading]=uS(true);

  async function load(){
    setLoading(true);
    const [m,c,ls]=await Promise.all([
      sb.from("materials").select("*").eq("org_id",profile.org_id).is("deleted_at",null),
      sb.from("categories").select("name").eq("org_id",profile.org_id).order("name"),
      sb.from("location_stock").select("*").eq("org_id",profile.org_id),
    ]);
    setMaterials(byName(m.data||[]));setCats((c.data||[]).map(x=>x.name));setLocStock(ls.data||[]);setLoading(false);
  }
  uE(()=>{load();},[profile.org_id]);

  function stockFor(matId,loc){
    if(loc==="All"){const rows=locStock.filter(x=>x.material_id===matId);return rows.reduce((s,r)=>s+r.stock,0);}
    return locStock.find(x=>x.material_id===matId&&x.location===loc)?.stock||0;
  }
  function costFor(matId,loc){
    if(loc==="All"){const rows=locStock.filter(x=>x.material_id===matId);return rows.length?rows[0].cost:0;}
    return locStock.find(x=>x.material_id===matId&&x.location===loc)?.cost||0;
  }

  const filtered=materials.filter(m=>(catFilt==="All"||m.category===catFilt)&&(!search||m.name.toLowerCase().includes(search.toLowerCase())||m.sku.toLowerCase().includes(search.toLowerCase())));

  async function deleteMat(m){
    await sb.from("materials").update({deleted_at:new Date().toISOString()}).eq("id",m.id);
    await logActivity(profile.org_id,profile.id,"Material deleted",m.name);showToast("Moved to trash");load();
  }

  async function bulkDelete(){
    await sb.from("materials").update({deleted_at:new Date().toISOString()}).in("id",sel);
    showToast("Deleted "+sel.length);setSel([]);setSelMode(false);load();
  }

  function exportCSV(){
    const rows=[["SKU","Name","Category","Supplier","Charleston Stock","Charleston Stock","Cost","Low Threshold","Unit"]];
    filtered.forEach(m=>{rows.push([m.sku,m.name,m.category||"",m.supplier||"",stockFor(m.id,"Charleston"),stockFor(m.id,"Charleston"),costFor(m.id,locFilt==="All"?"Charleston":locFilt),m.low_threshold,m.unit]);});
    const csv=rows.map(r=>r.map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const fn="materials-"+new Date().toISOString().slice(0,10)+".csv";
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv"});
    try{if(navigator.canShare){const f=new File([blob],fn,{type:"text/csv"});if(navigator.canShare({files:[f]})){navigator.share({files:[f],title:fn});return;}}}catch(_){}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);
    showToast("CSV exported");
  }

  if(loading) return <div style={{textAlign:"center",marginTop:60,color:C.muted}}>Loading…</div>;

  return(
    <div style={{padding:"16px 24px"}}>
      <div className="row" style={{marginBottom:12,gap:8}}>
        <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:140}}/>
        <button className={"btn "+(selMode?"btn-primary":"btn-ghost")} onClick={()=>{setSelMode(s=>!s);setSel([]);}}>{selMode?"Done":"Select"}</button>
        <button className="btn btn-ghost" onClick={exportCSV}>Export CSV</button>
        <button className="btn btn-ghost" onClick={()=>setCsvOpen(true)}>Import CSV</button>
        <button className="btn btn-primary" onClick={()=>setEditing({})}>+ Add</button>
      </div>

      <div className="row" style={{marginBottom:10,gap:6}}>
        {["All",...cats].map(c=><button key={c} className={"pill"+(catFilt===c?" active":"")} onClick={()=>setCatFilt(c)}>{c}</button>)}
      </div>
      <div className="row" style={{marginBottom:14,gap:6}}>
        {["All",...LOCATIONS].map(l=><button key={l} className={"pill"+(locFilt===l?" active":"")} onClick={()=>setLocFilt(l)}>{l==="All"?"All Locations":l}</button>)}
      </div>

      {selMode&&sel.length>0&&(
        <div className="card row" style={{borderColor:C.orange,marginBottom:12}}>
          <span style={{fontWeight:700}}>{sel.length} selected</span>
          <div style={{flex:1}}/>
          <button className="btn btn-primary" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setBulkOpen(true)}>Bulk Edit</button>
          <button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={bulkDelete}>Delete</button>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(m=>{
          const stock=stockFor(m.id,locFilt==="All"?"Charleston":locFilt);
          const totalStock=stockFor(m.id,"All");
          const cltStock=stockFor(m.id,"Charleston");
          const chsStock=stockFor(m.id,"Charleston");
          const low=totalStock>0&&totalStock<m.low_threshold;const out=totalStock===0;
          const checked=sel.includes(m.id);
          return(
            <div key={m.id} onClick={selMode?()=>setSel(p=>p.includes(m.id)?p.filter(x=>x!==m.id):[...p,m.id]):undefined}
              style={{background:checked?C.surface:C.card,borderRadius:12,padding:"14px 18px",border:"1px solid "+(out?C.red:low?C.yellow:C.border),borderLeft:"3px solid "+(out?C.red:low?C.yellow:C.orange),display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",cursor:selMode?"pointer":"default"}}>
              {selMode&&<input type="checkbox" checked={checked} readOnly style={{width:18,height:18,accentColor:C.orange}}/>}
              <div style={{flex:1,minWidth:180}}>
                <div className="row" style={{gap:8,marginBottom:3}}>
                  <span style={{fontWeight:700,fontSize:14}}>{m.name}</span>
                  <span className="mono tag" style={{color:C.orange,background:C.surface,fontSize:11}}>{m.sku}</span>
                  {m.unit==="units"&&<span className="tag" style={{background:C.surface,color:C.muted,border:"1px solid "+C.border}}>UNITS</span>}
                  {out&&<span className="tag" style={{background:C.redBg,color:C.red}}>OUT</span>}
                  {low&&!out&&<span className="tag" style={{background:C.yellowBg,color:C.yellow}}>LOW</span>}
                </div>
                <div className="muted" style={{fontSize:12,display:"flex",gap:12,flexWrap:"wrap"}}>
                  <span>{m.category||"—"}</span>
                  <span style={{color:C.green,fontWeight:700}}>CLT: {cltStock} {m.unit}</span>
                  <span style={{color:C.green,fontWeight:700}}>CHS: {chsStock} {m.unit}</span>
                  <span>${costFor(m.id,"Charleston").toFixed(2)}/{m.unit}</span>
                </div>
              </div>
              {!selMode&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setTransferring(m)}>Transfer</button>}
              {!selMode&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEditing(m)}>Edit</button>}
              {!selMode&&<button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>deleteMat(m)}>Delete</button>}
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",marginTop:60,color:C.muted}}>No materials. Add one or import a CSV.</div>}
      </div>

      {editing&&<MatModal profile={profile} mat={editing.id?editing:null} cats={cats} locStock={locStock} onClose={()=>setEditing(null)} onDone={()=>{load();setEditing(null);}} showToast={showToast}/>}
      {transferring&&<TransferModal profile={profile} mat={transferring} locStock={locStock} onClose={()=>setTransferring(null)} onDone={()=>{load();setTransferring(null);}} showToast={showToast}/>}
      {csvOpen&&<CSVImportModal profile={profile} materials={materials} locStock={locStock} onClose={()=>setCsvOpen(false)} onDone={()=>{load();setCsvOpen(false);}} showToast={showToast}/>}
      {bulkOpen&&<BulkEditModal ids={sel} cats={cats} onClose={()=>setBulkOpen(false)} onDone={()=>{load();setSel([]);setSelMode(false);setBulkOpen(false);}} showToast={showToast}/>}
    </div>
  );
}

function MatModal({profile,mat,cats,locStock,onClose,onDone,showToast}){
  const C=DARK;
  const cltLS=mat?locStock.find(x=>x.material_id===mat.id&&x.location==="Charleston"):null;
  const chsLS=mat?locStock.find(x=>x.material_id===mat.id&&x.location==="Charleston"):null;
  const [f,setF]=uS(mat?{...mat}:{sku:"",name:"",category:"",supplier:"",unit:"sqft",low_threshold:String(DEFAULT_TH)});
  const [cltStock,setCltStock]=uS(String(cltLS?.stock||0));
  const [chsStock,setChsStock]=uS(String(chsLS?.stock||0));
  const [cltCost,setCltCost]=uS(String(cltLS?.cost||0));
  const [busy,setBusy]=uS(false);const [err,setErr]=uS("");

  async function submit(){
    if(!f.name.trim()){setErr("Name required");return;}
    if(!mat&&!f.sku.trim()){setErr("SKU required");return;}
    setBusy(true);
    try{
      let matId=mat?.id;
      if(mat){await sb.from("materials").update({name:f.name.trim(),category:f.category||null,supplier:f.supplier||null,unit:f.unit||"sqft",low_threshold:parseFloat(f.low_threshold)||DEFAULT_TH}).eq("id",mat.id);}
      else{const {data,error}=await sb.from("materials").insert({org_id:profile.org_id,sku:f.sku.trim().toUpperCase(),name:f.name.trim(),category:f.category||null,supplier:f.supplier||null,unit:f.unit||"sqft",low_threshold:parseFloat(f.low_threshold)||DEFAULT_TH}).select("id").single();if(error)throw error;matId=data.id;}
      // Upsert location stock
      for(const [loc,stock,cost] of [["Charleston",cltStock,cltCost],["Charleston",chsStock,cltCost]]){
        await sb.from("location_stock").upsert({org_id:profile.org_id,material_id:matId,location:loc,stock:parseFloat(stock)||0,cost:parseFloat(cost)||0},{onConflict:"material_id,location"});
      }
      showToast(mat?"Updated":"Added");onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  const um=f.unit==="units"?"units":"sqft";
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>{mat?"Edit Material":"Add Material"}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        {!mat&&<div className="section"><div className="lbl">SKU</div><input value={f.sku} onChange={e=>setF({...f,sku:e.target.value})} placeholder="e.g. TW3"/></div>}
        <div className="section"><div className="lbl">Name</div><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Travertine Silver 12x24"/></div>
        <div className="section"><div className="lbl">Category</div>
          <select value={f.category||""} onChange={e=>setF({...f,category:e.target.value})}>
            <option value="">— None —</option>{cats.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="section"><div className="lbl">Supplier</div><input value={f.supplier||""} onChange={e=>setF({...f,supplier:e.target.value})}/></div>
        <div className="section"><div className="lbl">Measured in</div>
          <div className="row" style={{gap:8}}>
            {[["sqft","Square Feet"],["units","Units (count)"]].map(([v,l])=>(
              <button key={v} onClick={()=>setF({...f,unit:v})} style={{flex:1,padding:"9px",borderRadius:8,cursor:"pointer",border:"1.5px solid "+(f.unit===v?C.orange:C.border),background:f.unit===v?C.surface:"transparent",color:f.unit===v?C.orange:C.muted,fontWeight:700,fontSize:13}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          <div><div className="lbl">CLT Stock ({um})</div><input type="number" value={cltStock} onChange={e=>setCltStock(e.target.value)}/></div>
          <div><div className="lbl">CHS Stock ({um})</div><input type="number" value={chsStock} onChange={e=>setChsStock(e.target.value)}/></div>
          <div><div className="lbl">Cost/${um}</div><input type="number" step="0.01" value={cltCost} onChange={e=>setCltCost(e.target.value)}/></div>
        </div>
        <div className="section"><div className="lbl">Low threshold ({um})</div><input type="number" value={f.low_threshold||""} onChange={e=>setF({...f,low_threshold:e.target.value})}/></div>
        {err&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Saving…":mat?"Save changes":"Add material"}</button>
      </div>
    </div>
  );
}

function TransferModal({profile,mat,locStock,onClose,onDone,showToast}){
  const C=DARK;
  const [from,setFrom]=uS("Charleston");const [to,setTo]=uS("Charleston");const [qty,setQty]=uS("");const [notes,setNotes]=uS("");const [busy,setBusy]=uS(false);const [err,setErr]=uS("");
  const fromStock=locStock.find(x=>x.material_id===mat.id&&x.location===from)?.stock||0;

  async function submit(){
    const q=parseFloat(qty);if(!q||q<=0){setErr("Enter a valid quantity");return;}if(q>fromStock){setErr("Not enough stock in "+from);return;}
    setBusy(true);
    try{
      await sb.from("location_stock").upsert({org_id:profile.org_id,material_id:mat.id,location:from,stock:fromStock-q},{onConflict:"material_id,location"});
      const toStock=locStock.find(x=>x.material_id===mat.id&&x.location===to)?.stock||0;
      await sb.from("location_stock").upsert({org_id:profile.org_id,material_id:mat.id,location:to,stock:toStock+q},{onConflict:"material_id,location"});
      await sb.from("stock_transfers").insert({org_id:profile.org_id,material_id:mat.id,from_location:from,to_location:to,qty:q,notes:notes||null});
      await logActivity(profile.org_id,profile.id,"Stock transfer",`${q} ${mat.unit} of ${mat.name}: ${from} → ${to}`);
      showToast(`Transferred ${q} ${mat.unit} to ${to}`);onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>Transfer Stock — {mat.name}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div className="lbl">From</div>
            <select value={from} onChange={e=>{setFrom(e.target.value);setTo(LOCATIONS.find(l=>l!==e.target.value));}}>
              {LOCATIONS.map(l=><option key={l}>{l}</option>)}
            </select>
            <div className="muted" style={{fontSize:11,marginTop:4}}>Available: {fromStock} {mat.unit}</div>
          </div>
          <div><div className="lbl">To</div>
            <select value={to} onChange={e=>setTo(e.target.value)}>
              {LOCATIONS.filter(l=>l!==from).map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="section"><div className="lbl">Quantity ({mat.unit})</div><input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></div>
        <div className="section"><div className="lbl">Notes</div><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional"/></div>
        {err&&<div style={{color:DARK.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Transferring…":"Transfer stock"}</button>
      </div>
    </div>
  );
}

function BulkEditModal({ids,cats,onClose,onDone,showToast}){
  const C=DARK;
  const [category,setCategory]=uS("");const [unit,setUnit]=uS("");const [supplier,setSupplier]=uS("");const [threshold,setThreshold]=uS("");const [busy,setBusy]=uS(false);

  async function apply(){
    setBusy(true);
    const patch={};
    if(category) patch.category=category;if(unit) patch.unit=unit;if(supplier.trim()) patch.supplier=supplier.trim();if(threshold!=="") patch.low_threshold=parseFloat(threshold)||0;
    if(Object.keys(patch).length) await sb.from("materials").update(patch).in("id",ids);
    showToast("Updated "+ids.length);onDone();
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>Edit {ids.length} materials</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="muted" style={{fontSize:12,marginBottom:16}}>Only the fields you set are changed.</div>
        <div className="section"><div className="lbl">Category</div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">— No change —</option>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="section"><div className="lbl">How it's counted</div><select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">— No change —</option><option value="sqft">Square Feet</option><option value="units">Units</option></select></div>
        <div className="section"><div className="lbl">Supplier</div><input value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Leave blank for no change"/></div>
        <div className="section"><div className="lbl">Low threshold</div><input type="number" value={threshold} onChange={e=>setThreshold(e.target.value)} placeholder="Leave blank for no change"/></div>
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={apply}>{busy?"Applying…":"Apply to "+ids.length}</button>
      </div>
    </div>
  );
}

function CSVImportModal({profile,materials,locStock,onClose,onDone,showToast}){
  const C=DARK;
  const [txt,setTxt]=uS("");const [preview,setPreview]=uS(null);const [err,setErr]=uS("");const [busy,setBusy]=uS(false);const fileRef=uR();

  function detectDelim(t){const f=(t.replace(/^\uFEFF/,"").split(/\r?\n/).find(l=>l.trim())||"");const counts={","：0,"\t":0,";"：0};let inQ=false;for(const ch of f){if(ch==='"'){inQ=!inQ;continue;}if(!inQ&&counts[ch]!==undefined)counts[ch]++;}let best=",",n=0;for(const d in counts)if(counts[d]>n){n=counts[d];best=d;}return best;}

  function parseGrid(text){const rows=[];let field="",row=[],inQ=false,i=0;text=String(text).replace(/^\uFEFF/,"");const D=detectDelim(text);while(i<text.length){const c=text[i];if(inQ){if(c==='"'){if(text[i+1]==='"'){field+='"';i+=2;continue;}inQ=false;i++;continue;}field+=c;i++;continue;}if(c==='"'){inQ=true;i++;continue;}if(c===D){row.push(field);field="";i++;continue;}if(c==='\r'){i++;continue;}if(c==='\n'){row.push(field);rows.push(row);row=[];field="";i++;continue;}field+=c;i++;}if(field.length||row.length){row.push(field);rows.push(row);}return rows.filter(r=>r.some(c=>c.trim()!==""));}

  const HMAP={sku:"sku",material:"name",name:"name",quantity:"qty",qty:"qty",stock:"qty",cost:"cost",price:"cost",category:"cat",type:"cat",supplier:"supplier",location:"location"};
  function buildPreview(){setErr("");const grid=parseGrid(txt);if(grid.length<2){setErr("Need a header row and at least one data row.");return;}const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,"");const headers=grid[0].map(h=>HMAP[norm(h)]||null);const out=[];for(let r=1;r<grid.length;r++){const o={};headers.forEach((k,ci)=>{if(k&&grid[r][ci]!==undefined)o[k]=String(grid[r][ci]).trim();});const name=o.name||o.sku||"";const qty=parseFloat(o.qty);if(!name||!isFinite(qty)||qty<=0)continue;const match=materials.find(m=>m.name.toLowerCase()===name.toLowerCase()||(o.sku&&m.sku.toLowerCase()===o.sku.toLowerCase()));out.push({name,qty,sku:o.sku,cost:parseFloat(o.cost)||null,location:o.location||"Charleston",exists:!!match,matId:match?.id});}if(!out.length){setErr("No valid rows found.");return;}setPreview(out);}

  async function apply(){
    if(!preview)return;setBusy(true);
    try{
      for(const r of preview){
        let matId=r.matId;
        if(!matId){let base=(r.sku||r.name.replace(/[^A-Za-z0-9]/g,"").slice(0,6)||"SKU").toUpperCase();let sku=base,k=2;while(materials.find(m=>m.sku===sku)){sku=base+k;k++;}const {data}=await sb.from("materials").insert({org_id:profile.org_id,sku,name:r.name,unit:"sqft",low_threshold:DEFAULT_TH}).select("id").single();matId=data?.id;}
        if(!matId) continue;
        const cur=locStock.find(x=>x.material_id===matId&&x.location===r.location)?.stock||0;
        await sb.from("location_stock").upsert({org_id:profile.org_id,material_id:matId,location:r.location,stock:cur+r.qty,...(r.cost?{cost:r.cost}:{})},{onConflict:"material_id,location"});
      }
      showToast("Imported "+preview.length+" rows");onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  function readFile(f){const lower=f.name.toLowerCase();const isExcel=/\.(xlsx|xls)$/.test(lower);const rd=new FileReader();if(isExcel){rd.onload=()=>{try{const wb=XLSX.read(new Uint8Array(rd.result),{type:"array"});setTxt(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));setPreview(null);setErr("");}catch(_){setErr("Couldn't read Excel file.");}};rd.readAsArrayBuffer(f);}else{rd.onload=()=>{setTxt(rd.result);setPreview(null);setErr("");};rd.readAsText(f);}}

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:14}}><h3 style={{flex:1}}>Import Materials from Spreadsheet</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="muted" style={{fontSize:13,marginBottom:12,lineHeight:1.6}}>Upload CSV or Excel, or paste from Numbers. First row = headers.<br/>Columns: <b style={{color:DARK.text}}>Name, SKU, Quantity, Category, Supplier, Cost, Location</b></div>
        <input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>{if(e.target.files[0])readFile(e.target.files[0]);e.target.value="";}}/>
        <button className="btn btn-primary" style={{marginBottom:10}} onClick={()=>fileRef.current&&fileRef.current.click()}>Choose file</button>
        <textarea value={txt} onChange={e=>{setTxt(e.target.value);setPreview(null);setErr("");}} rows={4} placeholder={"Name\tQty\tLocation\nTravertine Silver\t640\tCharleston"} style={{width:"100%",resize:"vertical",fontFamily:"monospace",fontSize:12,display:"block",marginBottom:8}}/>
        {err&&<div style={{color:DARK.red,fontSize:12,marginBottom:8}}>{err}</div>}
        {!preview&&txt.trim()&&<button className="btn btn-ghost" onClick={buildPreview}>Preview</button>}
        {preview&&(
          <div style={{marginTop:10}}>
            <div className="row" style={{marginBottom:8}}>
              <span style={{fontWeight:700,flex:1}}>{preview.filter(r=>!r.exists).length} new · {preview.filter(r=>r.exists).length} update</span>
              <button className="btn btn-primary" disabled={busy} onClick={apply}>{busy?"Importing…":"Apply import"}</button>
            </div>
            <div style={{maxHeight:200,overflowY:"auto",border:"1px solid "+DARK.border,borderRadius:8}}>
              {preview.map((r,i)=>(
                <div key={i} className="row" style={{padding:"8px 12px",borderBottom:"1px solid "+DARK.border,fontSize:12}}>
                  <span style={{flex:1}}>{r.name}</span>
                  <span className="muted">{r.qty}</span>
                  <span className="muted">{r.location}</span>
                  <span className="tag" style={{background:r.exists?DARK.yellowBg:DARK.greenBg,color:r.exists?DARK.yellow:DARK.green}}>{r.exists?"Update":"New"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
