import React,{useEffect,useState}from'react';
import{Search,PackageSearch,X,Trash2,ReceiptText,Route,CalendarDays}from'lucide-react';
import'./products-page.css';

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
async function api(path,options){const r=await fetch('/api'+path,{headers:{'content-type':'application/json'},...options});const data=r.status===204?null:await r.json().catch(()=>({}));if(!r.ok)throw new Error([data?.error,data?.detail].filter(Boolean).join(': ')||'No se pudo completar');return data}

function QuoteDialog({product,onClose,onSaved}){
 const[form,setForm]=useState({customer:'',phone:'',description:product.description||product.customer_name,notes:''});
 const[items,setItems]=useState((product.products||[]).map(p=>({...p,salePrice:''})));
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 const total=items.reduce((s,p)=>s+(Number(p.qty)||0)*(Number(p.salePrice)||0),0);
 const profit=total-Number(product.total||0);
 const update=(i,v)=>setItems(x=>x.map((p,n)=>n===i?{...p,salePrice:v}:p));
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await api(`/products/${product.id}/quote`,{method:'POST',body:JSON.stringify({...form,products:items})});onSaved();onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="quoteBuilder" onSubmit={submit}>
  <div className="dialogHead"><div><small>COTIZACIÓN PARA CLIENTE</small><h2>Definir precios de venta</h2></div><button type="button" onClick={onClose}><X/></button></div>
  <div className="quoteClientGrid"><label><span>Cliente *</span><input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})}/></label><label><span>Teléfono / WhatsApp</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div>
  <label className="quoteFull"><span>Descripción</span><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
  <div className="saleItems"><div className="saleHead"><span>Producto</span><span>Cantidad</span><span>Precio venta/unidad</span><span>Subtotal</span></div>{items.map((p,i)=><div className="saleRow" key={p.id||i}><b>{p.name||'Producto'}</b><span>{Number(p.qty||0).toLocaleString()}</span><label><i>$</i><input type="number" min="0" step="any" required value={p.salePrice} onChange={e=>update(i,e.target.value)}/></label><strong>{money(Number(p.qty||0)*Number(p.salePrice||0))}</strong></div>)}</div>
  <div className="quoteTotals"><div><span>Costo interno</span><b>{money(product.total)}</b></div><div><span>Venta al cliente · envío incluido</span><b>{money(total)}</b></div><div className={profit>=0?'profitPositive':'profitNegative'}><span>Ganancia estimada</span><strong>{money(profit)}</strong></div></div>
  <label className="quoteFull"><span>Notas para la cotización</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
  {error&&<div className="saveError"><b>No se pudo crear la cotización</b><span>{error}</span></div>}
  <button className="primary" disabled={busy||!form.customer||!items.length}>{busy?'Creando…':'Crear cotización interna y del cliente'}</button>
 </form></div>
}

function ProductDetail({id,onClose,onChanged}){
 const[data,setData]=useState(null),[quote,setQuote]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/records/'+id).then(setData)},[id]);
 if(!data)return <div className="overlay"><div className="detailSheet loadingDetail">Cargando producto…</div></div>;
 const shipping=data.route==='miami'?data.totals.viaMiami:data.totals.direct;
 async function remove(){if(!confirm('¿Eliminar este producto guardado?'))return;setBusy(true);try{await api('/records/'+id,{method:'DELETE'});onChanged();onClose()}finally{setBusy(false)}}
 return <><div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="detailSheet productRecordDetail">
  <div className="detailTop"><div><span className="badge pending">Producto</span><small>EXPEDIENTE DE COSTOS</small><h2>{data.number}</h2></div><button className="iconBtn" onClick={onClose}><X/></button></div>
  <div className="detailActions"><button className="danger" disabled={busy} onClick={remove}><Trash2/> Eliminar</button><button className="clientQuoteButton" onClick={()=>setQuote(true)}><ReceiptText/> Crear cotización</button></div>
  <div className="detailGrid"><div className="detailCard"><label>Producto / referencia</label><b>{data.customer_name}</b><span><CalendarDays/> Guardado {new Date(data.created_at).toLocaleString()}</span></div><div className="detailCard"><label>Descripción</label><b>{data.description||'Sin descripción'}</b><span><Route/> {data.route==='miami'?'China → Miami → Managua':'China → Managua'}</span></div></div>
  <div className="detailSection"><h3>Productos y costos</h3><div className="savedProducts">{data.products.map((p,i)=><div key={i}>{p.imageUrl?<img src={p.imageUrl} alt=""/>:<span className="noPhoto">Sin foto</span>}<p><b>{p.name||'Producto'}</b><small>{p.qty} × {money(p.price)}</small></p><strong>{money(Number(p.qty)*Number(p.price))}</strong></div>)}</div><div className="costBreakdown productCosts"><div><span>Subtotal productos</span><b>{money(data.totals.productSubtotal)}</b></div><div><span>Comisión ({data.totals.feePercent}%)</span><b>{money(data.totals.feeAmount)}</b></div><div><span>Envío seleccionado</span><b>{money(shipping)}</b></div><div className="selectedCost"><span>Costo total puesto en Nicaragua</span><strong>{money(data.total)}</strong></div></div></div>
 </section></div>{quote&&<QuoteDialog product={data} onClose={()=>setQuote(false)} onSaved={onChanged}/>}</>
}

export default function ProductsPage({refreshKey,onChange,setPage}){
 const[rows,setRows]=useState([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState(null);
 async function load(){setLoading(true);try{setRows(await api('/records?type=product'))}finally{setLoading(false)}}
 useEffect(()=>{load()},[refreshKey]);
 const filtered=rows.filter(x=>(x.customer_name+' '+x.number+' '+(x.description||'')).toLowerCase().includes(query.toLowerCase()));
 function changed(){load();onChange()}
 return <div className="workspace"><div className="pageHead"><div><small>CATÁLOGO DE COSTOS</small><h1>Productos guardados</h1><p>Revisa tus costos y crea la cotización del cliente cuando estés listo.</p></div><button className="newProduct" onClick={()=>setPage('calculator')}>+ Nuevo cálculo</button></div>
  <div className="stats"><div><span>Productos</span><b>{rows.length}</b></div><div><span>Cajas</span><b>{rows.reduce((s,x)=>s+Number(x.total_boxes||0),0)}</b></div><div><span>Capital calculado</span><b>{money(rows.reduce((s,x)=>s+Number(x.total||0),0))}</b></div></div>
  <section className="panel records"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto o referencia…"/></div>{loading?<div className="empty">Cargando…</div>:!filtered.length?<div className="empty"><PackageSearch/><h3>No hay productos guardados</h3><p>Guarda el primer cálculo desde la calculadora.</p></div>:<div className="recordList">{filtered.map(x=><article className="record clickable" key={x.id} onClick={()=>setSelected(x.id)}><div className="recordMain"><span className="badge pending">Costo listo</span><b>{x.number}</b><h3>{x.customer_name}</h3><p>{x.description||'Sin descripción'} · {x.total_boxes} cajas · {x.route==='miami'?'Vía Miami':'Vía directa'}</p></div><div className="recordSide"><strong>{money(x.total)}</strong><small>Costo puesto en Nicaragua</small><button className="confirm" onClick={e=>{e.stopPropagation();setSelected(x.id)}}><ReceiptText/> Crear cotización</button></div></article>)}</div>}</section>
  {selected&&<ProductDetail id={selected} onClose={()=>setSelected(null)} onChanged={changed}/>}</div>
}
