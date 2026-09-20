const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});

function supabaseConfig(env){
 const url=String(env.SUPABASE_URL||'').replace(/\/+$/,'');
 const key=String(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'');
 if(!url||!key)throw new Error('Falta configurar SUPABASE_URL y SUPABASE_SECRET_KEY en Cloudflare');
 return{url,key};
}

async function supabaseFetch(env,path,options={}){
 const{url,key}=supabaseConfig(env);
 const headers=new Headers(options.headers||{});
 headers.set('apikey',key);
 // Las claves nuevas sb_secret_ no son JWT y deben viajar solo en apikey.
 // La clave service_role antigua sí requiere Authorization: Bearer.
 if(!key.startsWith('sb_secret_'))headers.set('authorization',`Bearer ${key}`);
 return fetch(url+path,{...options,headers});
}

async function rest(env,path,options={}){
 const response=await supabaseFetch(env,'/rest/v1/'+path,options);
 if(!response.ok){
  const message=await response.text();
  throw new Error(message||`Supabase respondió ${response.status}`);
 }
 return response;
}

async function restRows(env,path,options={}){
 const response=await rest(env,path,options);
 return response.status===204?[]:response.json();
}

async function listRecords(env,type){
 const fields='id,number,record_type,customer_name,phone,description,route,total,total_boxes,status,notes,totals,created_at,updated_at';
 return restRows(env,`records?record_type=eq.${encodeURIComponent(type)}&select=${fields}&order=created_at.desc`);
}

async function countRecords(env,type){
 const response=await rest(env,`records?record_type=eq.${encodeURIComponent(type)}&select=id&limit=1`,{headers:{Prefer:'count=exact'}});
 const total=(response.headers.get('content-range')||'').split('/').pop();
 return Number(total)||0;
}

async function getRecord(env,id){
 const rows=await restRows(env,`records?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
 return rows[0]||null;
}

async function updateRecord(env,id,values,extraFilter=''){
 const rows=await restRows(env,`records?id=eq.${encodeURIComponent(id)}${extraFilter}&select=*`,{
  method:'PATCH',
  headers:{'content-type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify(values)
 });
 return rows[0]||null;
}

async function createProductImagesBucket(env){
 const response=await supabaseFetch(env,'/storage/v1/bucket',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
   id:'product-images',
   name:'product-images',
   public:false,
   file_size_limit:5*1024*1024,
   allowed_mime_types:['image/jpeg','image/png','image/webp','image/gif']
  })
 });
 if(!response.ok&&response.status!==409){
  throw new Error((await response.text())||'No se pudo crear el contenedor de imágenes');
 }
}

async function uploadProductImage(env,key,type,bytes){
 const path=`/storage/v1/object/product-images/products/${key}`;
 const options={method:'POST',headers:{'content-type':type,'x-upsert':'false'}};
 let response=await supabaseFetch(env,path,{...options,body:bytes.slice(0)});
 if(response.status===404){
  await createProductImagesBucket(env);
  response=await supabaseFetch(env,path,{...options,body:bytes.slice(0)});
 }
 return response;
}

async function handleApi(request,env,url){
 try{
  const upload=url.pathname.match(/^\/api\/uploads\/([^/]+)$/);
  if(upload&&request.method==='PUT'){
   const type=request.headers.get('content-type')||'application/octet-stream';
   if(!type.startsWith('image/'))return json({error:'Solo se permiten imágenes'},400);
   const declaredSize=Number(request.headers.get('content-length')||0);
   if(declaredSize>5*1024*1024)return json({error:'La imagen supera 5 MB'},413);
   const bytes=await request.arrayBuffer();
   if(bytes.byteLength>5*1024*1024)return json({error:'La imagen supera 5 MB'},413);
   const key=encodeURIComponent(upload[1]);
   const response=await uploadProductImage(env,key,type,bytes);
   if(!response.ok)throw new Error((await response.text())||'Supabase Storage rechazó la imagen');
   return json({url:'/api/files/'+upload[1]},201);
  }

  const file=url.pathname.match(/^\/api\/files\/([^/]+)$/);
  if(file&&request.method==='GET'){
   const key=encodeURIComponent(file[1]);
   const response=await supabaseFetch(env,`/storage/v1/object/authenticated/product-images/products/${key}`);
   if(response.status===404)return new Response('Not found',{status:404});
   if(!response.ok)throw new Error((await response.text())||'No se pudo leer la imagen');
   return new Response(response.body,{headers:{'content-type':response.headers.get('content-type')||'application/octet-stream','cache-control':'private, max-age=86400'}});
  }

  if(url.pathname==='/api/records'&&request.method==='GET'){
   const requested=url.searchParams.get('type');
   const type=requested==='order'?'order':requested==='product'?'product':'quote';
   return json(await listRecords(env,type));
  }

  if(url.pathname==='/api/products'&&request.method==='POST'){
   const b=await request.json();
   if(!b.title?.trim())return json({error:'El nombre del producto es obligatorio'},400);
   const count=await countRecords(env,'product');
   const id=crypto.randomUUID();
   const number='PRO-'+new Date().getFullYear()+'-'+String(count+1).padStart(4,'0');
   const route=b.selectedRoute==='direct'?'direct':'miami';
   const total=route==='miami'?b.result.landedMiami:b.result.landedDirect;
   await rest(env,'records',{
    method:'POST',
    headers:{'content-type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({id,number,record_type:'product',customer_name:b.title.trim(),phone:'',description:b.description||'',boxes:b.boxes||[],rates:b.rates||{},totals:{...(b.result||{}),internalTotal:total},products:b.products||[],route,total,total_boxes:b.result.totalBoxes||0,status:'pending',notes:b.notes||''})
   });
   return json({id,number},201);
  }

  const createQuote=url.pathname.match(/^\/api\/products\/([^/]+)\/quote$/);
  if(createQuote&&request.method==='POST'){
   const b=await request.json();
   if(!b.customer?.trim())return json({error:'El cliente es obligatorio'},400);
   const source=await getRecord(env,createQuote[1]);
   if(!source||source.record_type!=='product')return json({error:'Producto no encontrado'},404);
   const products=(b.products||source.products||[]).map(p=>({...p,salePrice:Math.max(0,Number(p.salePrice)||0)}));
   if(products.some(p=>!p.salePrice))return json({error:'Agrega el precio de venta de cada producto'},400);
   const saleTotal=products.reduce((sum,p)=>sum+(Number(p.qty)||0)*p.salePrice,0);
   const internalTotal=Number(source.total)||0;
   const count=await countRecords(env,'quote');
   const id=crypto.randomUUID();
   const number='COT-'+new Date().getFullYear()+'-'+String(count+1).padStart(4,'0');
   await rest(env,'records',{
    method:'POST',
    headers:{'content-type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({id,number,record_type:'quote',customer_name:b.customer.trim(),phone:b.phone||'',description:b.description||source.description||source.customer_name,boxes:source.boxes||[],rates:source.rates||{},totals:{...(source.totals||{}),internalTotal,saleTotal,profit:saleTotal-internalTotal,sourceProductId:source.id},products,route:source.route,total:internalTotal,total_boxes:source.total_boxes||0,status:'pending',notes:b.notes||source.notes||''})
   });
   return json({id,number,saleTotal,internalTotal},201);
  }

  const promote=url.pathname.match(/^\/api\/records\/([^/]+)\/promote$/);
  if(promote&&request.method==='POST'){
   const count=await countRecords(env,'order');
   const number='ORD-'+new Date().getFullYear()+'-'+String(count+1).padStart(4,'0');
   const row=await updateRecord(env,promote[1],{record_type:'order',number,status:'confirmed',confirmed_at:new Date().toISOString()},'&record_type=eq.quote');
   if(!row)return json({error:'Cotización no encontrada'},404);
   return json({id:promote[1],number});
  }

  const revert=url.pathname.match(/^\/api\/records\/([^/]+)\/revert$/);
  if(revert&&request.method==='POST'){
   const current=await getRecord(env,revert[1]);
   if(!current||current.record_type!=='order')return json({error:'Orden no encontrada'},404);
   const suffix=String(current.number||'').replace(/^ORD-?/,'')||crypto.randomUUID().slice(0,8);
   const number='COT-R-'+suffix;
   await updateRecord(env,revert[1],{record_type:'quote',number,status:'returned',confirmed_at:null},'&record_type=eq.order');
   return json({id:revert[1],number});
  }

  const item=url.pathname.match(/^\/api\/records\/([^/]+)$/);
  if(item&&request.method==='GET'){
   const row=await getRecord(env,item[1]);
   if(!row)return json({error:'Registro no encontrado'},404);
   return json(row);
  }
  if(item&&request.method==='PATCH'){
   const b=await request.json();
   if(b.status){
    const allowed=['confirmed','purchased','transit','delivered','cancelled'];
    if(!allowed.includes(b.status))return json({error:'Estado inválido'},400);
    const row=await updateRecord(env,item[1],{status:b.status},'&record_type=eq.order');
    if(!row)return json({error:'Orden no encontrada'},404);
   }else{
    const route=b.route==='direct'?'direct':'miami';
    const values={customer_name:String(b.customer_name||'').trim(),phone:b.phone||'',description:b.description||'',notes:b.notes||'',route,total:Number(b.total)||0};
    const row=await updateRecord(env,item[1],values,'&record_type=eq.quote');
    if(!row)return json({error:'Solo se pueden editar cotizaciones'},400);
   }
   return json({ok:true});
  }
  if(item&&request.method==='DELETE'){
   const rows=await restRows(env,`records?id=eq.${encodeURIComponent(item[1])}&select=id`,{method:'DELETE',headers:{Prefer:'return=representation'}});
   if(!rows.length)return json({error:'Registro no encontrado'},404);
   return new Response(null,{status:204});
  }
  return json({error:'Ruta no encontrada'},404)
 }catch(e){
  const detail=String(e.message||e);
  const missing=detail.includes('SUPABASE_URL');
  return json({error:missing?'Supabase no está configurado en Cloudflare':'No se pudo guardar la información',detail},500);
 }
}
function staticResponse(path){const item=STATIC[path]||STATIC['/index.html'];if(!item)return new Response('Not found',{status:404});const body=item.base64?Uint8Array.from(atob(item.data),c=>c.charCodeAt(0)):item.data;return new Response(body,{headers:{'content-type':item.type,'cache-control':path==='/index.html'?'no-cache':'public, max-age=31536000, immutable'}})}
export default{async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env,url);const path=url.pathname==='/'?'/index.html':url.pathname;return staticResponse(path)}};
