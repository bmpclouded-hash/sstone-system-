function ReceivingTab({profile,showToast}){
  const C=DARK;
  const [orders,setOrders]=uS([]);const [materials,setMaterials]=uS([]);const [editing,setEditing]=uS(null);const [receiving,setReceiving]=uS(null);const [loading,setLoading]=uS(true);

  async function load(){
    setLoading(true);
    const [o,m]=await Promise.all([
      sb.from("purchase_orders").select("*,po_items(*)").eq("org_id",profile.org_id).order("created_at",{ascending:false}),
      sb.from("materials").select("id,name,sku,unit").eq("org_id",profile.org_id).is("deleted_at",null),
    ]);
    setOrders(o.data||[]);setMaterials(byName(m.data||[]));setLoading(false);
  }
  uE(()=>{load();},[profile.org_id]);

  const statusColor={Ordered:{bg:C.yellowBg,c:C.yellow},Partial:{bg:"#1a2a3a",c:"#5ab4f0"},Received:{bg:C.greenBg,c:C.green},Cancelled:{bg:C.redBg,c:C.red}};

  if(loading) return <div style={{textAlign:"center",marginTop:60,color:C.muted}}>Loading…</div>;

  return(
    <div style={{padding:"16px 24px"}}>
      <div className="row" style={{marginBottom:18,justifyContent:"flex-end"}}>
        <button className="btn btn-primary" onClick={()=>setEditing({})}>+ New PO</button>
      </div>
      {orders.map(o=>{
        const sc=statusColor[o.status]||statusColor.Ordered;
        const items=o.po_items||[];const totalOrdered=items.reduce((s,i)=>s+i.ordered_qty,0);const totalReceived=items.reduce((s,i)=>s+i.received_qty,0);const pct=totalOrdered?Math.round(totalReceived/totalOrdered*100):0;
        return(
          <div key={o.id} className="card" style={{marginBottom:10,borderLeft:"3px solid "+sc.c}}>
            <div className="row" style={{marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{o.supplier||"Unknown supplier"}</div>
                <div className="muted" style={{fontSize:12,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                  {o.po_number&&<span>PO# {o.po_number}</span>}
                  <span>{o.location}</span>
                  {o.expected_date&&<span>Expected: {o.expected_date}</span>}
                </div>
              </div>
              <span className="tag" style={{background:sc.bg,color:sc.c}}>{o.status}</span>
            </div>
            {totalOrdered>0&&(
              <div style={{marginBottom:8}}>
                <div className="prog-bar"><div className="prog-fill" style={{width:pct+"%",background:pct===100?C.green:C.orange}}/></div>
                <div className="muted" style={{fontSize:11}}>{totalReceived} / {totalOrdered} received ({pct}%)</div>
              </div>
            )}
            <div className="row" style={{gap:6}}>
              <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEditing(o)}>Edit PO</button>
              {o.status!=="Received"&&<button className="btn btn-primary" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setReceiving(o)}>Receive Items</button>}
              <button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={async()=>{await sb.from("purchase_orders").delete().eq("id",o.id);load();}}>Delete</button>
            </div>
          </div>
        );
      })}
      {orders.length===0&&<div style={{textAlign:"center",marginTop:60,color:C.muted}}>No purchase orders yet.</div>}
      {editing&&<POModal profile={profile} order={editing.id?editing:null} materials={materials} onClose={()=>setEditing(null)} onDone={()=>{load();setEditing(null);}} showToast={showToast}/>}
      {receiving&&<ReceiveModal profile={profile} order={receiving} materials={materials} onClose={()=>setReceiving(null)} onDone={()=>{load();setReceiving(null);}} showToast={showToast}/>}
    </div>
  );
}

function POModal({profile,order,materials,onClose,onDone,showToast}){
  const C=DARK;
  const [f,setF]=uS(order?{supplier:order.supplier||"",po_number:order.po_number||"",order_date:order.order_date||"",expected_date:order.expected_date||"",location:order.location||"Charleston",status:order.status||"Ordered",notes:order.notes||""}:{supplier:"",po_number:"",order_date:new Date().toISOString().slice(0,10),expected_date:"",location:"Charleston",status:"Ordered",notes:""});
  const [items,setItems]=uS([]);const [newItem,setNewItem]=uS({material_id:"",material_name:"",ordered_qty:"",unit_cost:""});
  const [busy,setBusy]=uS(false);const [err,setErr]=uS("");

  uE(()=>{if(order?.id){sb.from("po_items").select("*").eq("po_id",order.id).then(({data})=>setItems(data||[]));};},[order?.id]);

  async function submit(){
    if(!f.supplier.trim()){setErr("Supplier required");return;}
    setBusy(true);
    try{
      let orderId=order?.id;
      if(order?.id){await sb.from("purchase_orders").update({supplier:f.supplier,po_number:f.po_number||null,order_date:f.order_date||null,expected_date:f.expected_date||null,location:f.location,status:f.status,notes:f.notes||null}).eq("id",order.id);}
      else{const {data}=await sb.from("purchase_orders").insert({org_id:profile.org_id,supplier:f.supplier,po_number:f.po_number||null,order_date:f.order_date||null,expected_date:f.expected_date||null,location:f.location,status:f.status,notes:f.notes||null}).select("id").single();orderId=data?.id;}
      for(const it of items.filter(x=>!x.id)){await sb.from("po_items").insert({po_id:orderId,material_id:it.material_id||null,material_name:it.material_name,ordered_qty:parseFloat(it.ordered_qty)||0,unit_cost:parseFloat(it.unit_cost)||null,received_qty:0});}
      showToast(order?"PO updated":"PO created");onDone();
    }catch(e){setErr(e.message);}setBusy(false);
  }

  function addItem(){
    const mat=materials.find(m=>m.id===newItem.material_id);
    if(!mat&&!newItem.material_name.trim()) return;
    setItems([...items,{...newItem,material_name:mat?mat.name:newItem.material_name,received_qty:0}]);
    setNewItem({material_id:"",material_name:"",ordered_qty:"",unit_cost:""});
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>{order?"Edit PO":"New Purchase Order"}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div className="lbl">Supplier</div><input value={f.supplier} onChange={e=>setF({...f,supplier:e.target.value})} placeholder="Stone Source"/></div>
          <div><div className="lbl">PO Number</div><input value={f.po_number} onChange={e=>setF({...f,po_number:e.target.value})} placeholder="PO-2024-001"/></div>
          <div><div className="lbl">Order date</div><input type="date" value={f.order_date} onChange={e=>setF({...f,order_date:e.target.value})}/></div>
          <div><div className="lbl">Expected date</div><input type="date" value={f.expected_date} onChange={e=>setF({...f,expected_date:e.target.value})}/></div>
          <div><div className="lbl">Location</div><select value={f.location} onChange={e=>setF({...f,location:e.target.value})}>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
          <div><div className="lbl">Status</div><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{["Ordered","Partial","Received","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div style={{marginBottom:14}}>
          <div className="lbl">Items</div>
          {items.map((it,i)=>(
            <div key={i} className="row" style={{background:C.surface,borderRadius:8,padding:"8px 10px",marginBottom:6,fontSize:12}}>
              <span style={{flex:1}}>{it.material_name}</span>
              <span className="muted">{it.ordered_qty}</span>
              {it.unit_cost&&<span className="muted">${it.unit_cost}/unit</span>}
              <button onClick={()=>setItems(items.filter((_,xi)=>xi!==i))} style={{background:"none",border:"none",color:C.red,cursor:"pointer"}}>×</button>
            </div>
          ))}
          <div className="row" style={{gap:8,background:C.surface,borderRadius:8,padding:10}}>
            <select value={newItem.material_id} onChange={e=>{const m=materials.find(x=>x.id===e.target.value);setNewItem({...newItem,material_id:e.target.value,material_name:m?m.name:newItem.material_name});}} style={{flex:1,padding:"6px 8px",fontSize:12}}>
              <option value="">From catalog…</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input value={newItem.material_name} onChange={e=>setNewItem({...newItem,material_name:e.target.value})} placeholder="Or type name" style={{flex:1,padding:"6px 8px",fontSize:12}}/>
            <input type="number" value={newItem.ordered_qty} onChange={e=>setNewItem({...newItem,ordered_qty:e.target.value})} placeholder="Qty" style={{width:70,padding:"6px 8px",fontSize:12}}/>
            <input type="number" step="0.01" value={newItem.unit_cost} onChange={e=>setNewItem({...newItem,unit_cost:e.target.value})} placeholder="$/unit" style={{width:80,padding:"6px 8px",fontSize:12}}/>
            <button className="btn btn-primary" style={{padding:"6px 12px",fontSize:12}} onClick={addItem}>+ Add</button>
          </div>
        </div>
        <div className="section"><div className="lbl">Notes</div><textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} style={{width:"100%",resize:"vertical"}}/></div>
        {err&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={submit}>{busy?"Saving…":order?"Save":"Create PO"}</button>
      </div>
    </div>
  );
}

function ReceiveModal({profile,order,materials,onClose,onDone,showToast}){
  const C=DARK;
  const [items,setItems]=uS([]);const [busy,setBusy]=uS(false);

  uE(()=>{sb.from("po_items").select("*").eq("po_id",order.id).then(({data})=>setItems((data||[]).map(it=>({...it,receiving:""}))));},[ order.id]);

  async function apply(){
    setBusy(true);
    try{
      let allReceived=true;let anyReceived=false;
      for(const it of items){
        const recv=parseFloat(it.receiving)||0;if(!recv)continue;
        anyReceived=true;
        const newRecv=it.received_qty+recv;
        await sb.from("po_items").update({received_qty:newRecv,received_at:new Date().toISOString()}).eq("id",it.id);
        // Update location stock
        if(it.material_id){
          const {data:ls}=await sb.from("location_stock").select("id,stock").eq("material_id",it.material_id).eq("location",order.location).maybeSingle();
          if(ls){await sb.from("location_stock").update({stock:ls.stock+recv}).eq("id",ls.id);}
          else{await sb.from("location_stock").insert({org_id:profile.org_id,material_id:it.material_id,location:order.location,stock:recv,cost:it.unit_cost||0});}
        }
        if(newRecv<it.ordered_qty) allReceived=false;
      }
      const newStatus=allReceived?"Received":anyReceived?"Partial":"Ordered";
      await sb.from("purchase_orders").update({status:newStatus}).eq("id",order.id);
      await logActivity(profile.org_id,profile.id,"PO received",order.supplier+" ("+order.po_number+")");
      showToast("Items received and stock updated");onDone();
    }catch(e){console.error(e);}setBusy(false);
  }

  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row" style={{marginBottom:18}}><h3 style={{flex:1}}>Receive Items — {order.supplier}</h3><button className="btn btn-ghost" style={{padding:"4px 10px"}} onClick={onClose}>×</button></div>
        <div className="muted" style={{fontSize:12,marginBottom:14}}>Enter the quantity received for each item. Stock will be updated automatically.</div>
        {items.map((it,i)=>(
          <div key={it.id} style={{background:C.surface,borderRadius:9,padding:"12px 14px",marginBottom:10}}>
            <div className="row" style={{marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{it.material_name}</div>
                <div className="muted" style={{fontSize:11}}>Ordered: {it.ordered_qty} · Already received: {it.received_qty}</div>
              </div>
              <span className="tag" style={{background:it.received_qty>=it.ordered_qty?C.greenBg:C.yellowBg,color:it.received_qty>=it.ordered_qty?C.green:C.yellow}}>
                {it.received_qty>=it.ordered_qty?"Complete":"Pending"}
              </span>
            </div>
            <div className="row">
              <div className="lbl" style={{marginBottom:0,marginRight:8}}>Receiving now:</div>
              <input type="number" value={it.receiving||""} onChange={e=>setItems(items.map((x,xi)=>xi===i?{...x,receiving:e.target.value}:x))} placeholder="0" style={{width:100}}/>
              <button onClick={()=>setItems(items.map((x,xi)=>xi===i?{...x,receiving:String(x.ordered_qty-x.received_qty)}:x))} className="btn btn-ghost" style={{fontSize:11,padding:"5px 10px"}}>All remaining</button>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" style={{width:"100%"}} disabled={busy} onClick={apply}>{busy?"Processing…":"Receive & update stock"}</button>
      </div>
    </div>
  );
}
