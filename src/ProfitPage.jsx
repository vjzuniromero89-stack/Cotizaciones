import React,{useEffect,useMemo,useState}from'react';
import{TrendingUp,WalletCards,Clock3,Search,CheckCircle2,FileText,ArrowUpRight}from'lucide-react';
import'./profit.css';

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
async function api(path){const r=await fetch('/api'+path);if(!r.ok)throw new Error('No se pudo cargar');return r.json()}

export default function ProfitPage(){
 const[quotes,setQuotes]=useState([]),[orders,setOrders]=useState([]),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([api('/records?type=quote'),api('/records?type=order')]).then(([q,o])=>{setQuotes(q);setOrders(o)}).finally(()=>setLoading(false))},[]);
 const records=useMemo(()=>[...orders.map(x=>({...x,profitState:'confirmed'})),...quotes.map(x=>({...x,profitState:'potential'}))].filter(x=>x.status!=='cancelled').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[quotes,orders]);
 const confirmed=orders.filter(x=>x.status!=='cancelled'),potential=quotes.filter(x=>x.status!=='cancelled');
 const profitOf=x=>Number(x.totals?.profit??Number(x.total)*.30),saleOf=x=>Number(x.totals?.saleTotal??Number(x.total)*1.30);
 const confirmedProfit=confirmed.reduce((s,x)=>s+profitOf(x),0),potentialProfit=potential.reduce((s,x)=>s+profitOf(x),0),confirmedSales=confirmed.reduce((s,x)=>s+saleOf(x),0);
 const visible=records.filter(x=>(filter==='all'||x.profitState===filter)&&(x.customer_name+' '+x.number+' '+(x.description||'')).toLowerCase().includes(query.toLowerCase()));
 const maxProfit=Math.max(1,...visible.map(profitOf));
 return <div className="workspace profitPage">
  <div className="pageHead"><div><small>CONTROL FINANCIERO</small><h1>Ganancias</h1><p>Conoce lo ganado en cada venta y la ganancia potencial de tus cotizaciones.</p></div></div>
  <section className="profitHero"><div className="profitMain"><span><TrendingUp/> GANANCIA CONFIRMADA</span><strong>{money(confirmedProfit)}</strong><small>{confirmed.length} {confirmed.length===1?'venta confirmada':'ventas confirmadas'}</small></div><div className="profitMetric"><i><Clock3/></i><span>Ganancia potencial</span><b>{money(potentialProfit)}</b><small>{potential.length} cotizaciones pendientes</small></div><div className="profitMetric"><i><WalletCards/></i><span>Ventas a clientes</span><b>{money(confirmedSales)}</b><small>Incluye costo y ganancia</small></div></section>
  <section className="profitPanel"><div className="profitControls"><div className="profitFilters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todas</button><button className={filter==='confirmed'?'active':''} onClick={()=>setFilter('confirmed')}>Confirmadas</button><button className={filter==='potential'?'active':''} onClick={()=>setFilter('potential')}>Pendientes</button></div><label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente o cotización…"/></label></div>
   {loading?<div className="profitEmpty">Calculando ganancias…</div>:visible.length===0?<div className="profitEmpty"><FileText/><b>No hay resultados</b><span>Las ganancias aparecerán cuando guardes cotizaciones.</span></div>:<div className="profitList">{visible.map(x=>{const cost=Number(x.total),sale=saleOf(x),profit=profitOf(x),percent=cost>0?(profit/cost)*100:0;return <article className="profitRecord" key={x.id}><div className="profitRecordTop"><div><span className={'profitStatus '+x.profitState}>{x.profitState==='confirmed'?<><CheckCircle2/> Ganancia confirmada</>:<><Clock3/> Ganancia potencial</>}</span><b>{x.number}</b><h3>{x.customer_name}</h3><p>{x.description||'Sin descripción'} · {x.total_boxes} cajas</p></div><div className="profitAmount"><small>GANANCIA</small><strong>{profit>=0?'+':''}{money(profit)}</strong><span><ArrowUpRight/> {percent>=0?'+':''}{percent.toFixed(2)}% sobre el costo</span></div></div><div className="profitBar"><i style={{width:`${Math.max(0,profit)/maxProfit*100}%`}}/></div><div className="profitBreakdown"><div><span>Costo interno</span><b>{money(cost)}</b></div><div><span>Cobrado al cliente</span><b>{money(sale)}</b></div><div><span>Fecha</span><b>{new Date(x.created_at).toLocaleDateString('es-NI')}</b></div></div></article>})}</div>}
  </section>
 </div>
}
