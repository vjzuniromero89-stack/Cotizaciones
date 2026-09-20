import{afterEach,describe,expect,it,vi}from'vitest';
import worker from'../worker/index.js';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test'};

describe('flujo de productos y cotizaciones',()=>{
 afterEach(()=>vi.unstubAllGlobals());

 it('guarda el cálculo primero como producto',async()=>{
  const fetchMock=vi.fn()
   .mockResolvedValueOnce(new Response('',{status:200,headers:{'content-range':'0-0/0'}}))
   .mockResolvedValueOnce(new Response('',{status:201}));
  vi.stubGlobal('fetch',fetchMock);
  const result={landedMiami:125,landedDirect:200,totalBoxes:2};
  const response=await worker.fetch(new Request('https://cotizaciones.test/api/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Botellas',selectedRoute:'miami',result,products:[{name:'Botella',qty:100,price:1}],boxes:[],rates:{}})}),env);
  expect(response.status).toBe(201);
  const saved=JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(saved.record_type).toBe('product');
  expect(saved.total).toBe(125);
  expect(saved.number).toBe('PRO-2026-0001');
 });

 it('crea la cotización con precios de venta y ganancia',async()=>{
  const source={id:'p1',record_type:'product',customer_name:'Botellas',description:'100 botellas',products:[{name:'Botella',qty:100,price:1}],boxes:[],rates:{},totals:{totalUnits:100},route:'miami',total:150,total_boxes:2,notes:''};
  const fetchMock=vi.fn()
   .mockResolvedValueOnce(new Response(JSON.stringify([source]),{status:200,headers:{'content-type':'application/json'}}))
   .mockResolvedValueOnce(new Response('',{status:200,headers:{'content-range':'0-0/0'}}))
   .mockResolvedValueOnce(new Response('',{status:201}));
  vi.stubGlobal('fetch',fetchMock);
  const response=await worker.fetch(new Request('https://cotizaciones.test/api/products/p1/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer:'Wendy',products:[{name:'Botella',qty:100,price:1,salePrice:2}]})}),env);
  expect(response.status).toBe(201);
  const saved=JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(saved.record_type).toBe('quote');
  expect(saved.total).toBe(150);
  expect(saved.totals.saleTotal).toBe(200);
  expect(saved.totals.profit).toBe(50);
  expect(saved.totals.profitPercent).toBeCloseTo(33.33,2);
 });

 it('guarda desde la calculadora una cotización interna y para cliente',async()=>{
  const fetchMock=vi.fn()
   .mockResolvedValueOnce(new Response('',{status:200,headers:{'content-range':'0-0/0'}}))
   .mockResolvedValueOnce(new Response('',{status:201}))
   .mockResolvedValueOnce(new Response('',{status:201}));
  vi.stubGlobal('fetch',fetchMock);
  const result={landedMiami:180,landedDirect:250,totalBoxes:3,totalUnits:100};
  const response=await worker.fetch(new Request('https://cotizaciones.test/api/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer:'Wendy',selectedRoute:'miami',result,products:[{name:'Bolso',qty:100,price:1,salePrice:3,boxes:[]}],boxes:[],rates:{}})}),env);
  expect(response.status).toBe(201);
  const saved=JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(saved.record_type).toBe('quote');
  expect(saved.customer_name).toBe('Wendy');
  expect(saved.total).toBe(180);
  expect(saved.totals.saleTotal).toBe(300);
  expect(saved.totals.profit).toBe(120);
  expect(saved.products[0].salePrice).toBe(3);
 });
});
