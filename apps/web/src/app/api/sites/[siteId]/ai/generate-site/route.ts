import { prisma } from '@buildora/database';
import { ensureCommerceSchema } from '../../../../../../server/commerce';
import { assertOwnedSite, getHackathonUser, jsonError } from '../../../../../../server/hackathon';
import { classifySiteMode, type SiteMode } from '../../../../../../server/site-modes';

const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const THEME_IDS = ['minimal-blog','small-business','personal-portfolio','agency','restaurant','saas','event','personal-brand'] as const;

function tiptap(title: string, paragraphs: string[]) { return { type:'doc', content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:title}]}, ...paragraphs.map((text)=>({type:'paragraph',content:[{type:'text',text}]}))] }; }
function offerDoc(title: string, items: Array<{name:string;body:string}>) { return { type:'doc', content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:title}]}, ...items.flatMap((item)=>[{type:'heading',attrs:{level:2},content:[{type:'text',text:item.name}]},{type:'paragraph',content:[{type:'text',text:item.body}]}])] }; }
function cleanJson(text:string){return text.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/i,'').trim();}
function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||`story-${Date.now().toString(36)}`;}

const MODE_HINTS: Record<SiteMode,string> = {
  business:'Generate a professional business site with services and contact CTA.',
  portfolio:'Generate a portfolio/personal brand site focused on work, expertise and contact.',
  blog:'Generate a publication/blog site focused on articles and newsletter growth.',
  saas:'Generate a SaaS site with features, benefits, pricing-style copy and waitlist/demo CTA.',
  ecommerce:'Generate a product ecommerce site and real starter products.',
  booking:'Generate an appointment business site with bookable services and booking CTA.',
  restaurant:'Generate a restaurant site with menu-oriented offers and reservation CTA.',
  event:'Generate an event/conference site with speakers, agenda and registration CTA.',
  courses:'Generate a training/course site with course offerings and enrollment CTA.',
  'real-estate':'Generate a real-estate site with property-style listings and inquiry CTA.',
  recruitment:'Generate a careers/recruitment site with job-style offerings and application CTA.',
  nonprofit:'Generate an NGO/nonprofit site with programs, impact, volunteer and donation CTA.',
};

export async function POST(request:Request,{params}:{params:{siteId:string}}){
  const apiKey=process.env.MISTRAL_API_KEY;
  if(!apiKey)return jsonError('AI is not configured yet. Add MISTRAL_API_KEY.',503);
  try{
    const {site:ownedSite}=await assertOwnedSite(params.siteId); const user=await getHackathonUser();
    const body=await request.json() as {description?:string}; const description=body.description?.trim();
    if(!description||description.length<10)return jsonError('Describe the business or website in at least 10 characters.');
    const siteMode=classifySiteMode(description); const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),25_000); const started=Date.now();
    const response=await fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:MODEL,temperature:.65,max_tokens:3000,messages:[{role:'system',content:`You are Buildora. Return ONLY valid JSON. Theme must be one of ${THEME_IDS.join(', ')}. Website mode is ${siteMode}. ${MODE_HINTS[siteMode]} Create concise polished copy.`},{role:'user',content:`Create a ${siteMode} starter website from:\n${description}\nReturn exactly JSON: {"siteName":"...","tagline":"...","themeId":"small-business","accentColor":"#174d3e","seoTitle":"...","seoDescription":"...","home":{"title":"Home","headline":"...","body":["...","..."],"cta":"..."},"about":{"title":"About","body":["...","..."]},"offers":{"title":"...","items":[{"name":"...","body":"..."},{"name":"...","body":"..."},{"name":"...","body":"..."}]},"products":[{"name":"...","description":"...","priceNgn":15000,"stock":12}],"blogIdeas":["...","...","..."]}. Only ecommerce mode should return products; other modes return [].`}]}),signal:controller.signal});
    clearTimeout(timeout); if(!response.ok)return jsonError('AI provider request failed',502);
    const json=await response.json() as {choices?:Array<{message?:{content?:string}}>;usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}}; const raw=json.choices?.[0]?.message?.content; if(!raw)return jsonError('AI returned an empty response',502);
    let generated:any; try{generated=JSON.parse(cleanJson(raw));}catch{return jsonError('AI returned invalid website data. Try again.',502);}
    const themeId=(THEME_IDS as readonly string[]).includes(generated.themeId)?generated.themeId:(siteMode==='restaurant'?'restaurant':siteMode==='event'?'event':siteMode==='saas'?'saas':'small-business');
    const accentColor=/^#[0-9a-f]{6}$/i.test(generated.accentColor||'')?generated.accentColor:'#174d3e';
    const blogIdeas=Array.isArray(generated.blogIdeas)?generated.blogIdeas.map((x:unknown)=>String(x).trim()).filter(Boolean).slice(0,3):[];
    const existingConfig=ownedSite.themeConfig&&typeof ownedSite.themeConfig==='object'?ownedSite.themeConfig as Record<string,unknown>:{};
    const offerTitle=String(generated.offers?.title||({ecommerce:'Products',booking:'Services',restaurant:'Menu',event:'Event highlights',courses:'Courses','real-estate':'Properties',recruitment:'Open roles',nonprofit:'Programs'} as Record<string,string>)[siteMode]||'Services').slice(0,100);
    const offerItems=(Array.isArray(generated.offers?.items)?generated.offers.items:[]).map((item:any)=>({name:String(item?.name||'').trim().slice(0,100),body:String(item?.body||'').trim().slice(0,500)})).filter((x:{name:string;body:string})=>x.name&&x.body).slice(0,6);
    const finalOffers=offerItems.length?offerItems:[{name:'Featured offering',body:'A key offering generated for this website.'},{name:'Popular choice',body:'Another useful option for visitors.'},{name:'Get started',body:'A clear next step for interested visitors.'}];
    const starterProducts=siteMode==='ecommerce'?(Array.isArray(generated.products)?generated.products:finalOffers.slice(0,3)).map((item:any,index:number)=>({name:String(item?.name||`Product ${index+1}`).slice(0,120),description:String(item?.description||item?.body||'A product created by Buildora AI.').slice(0,1200),price:Math.max(10000,Math.round(Number(item?.priceNgn||(12000+index*5000))*100)),stock:Math.max(1,Math.min(999,Math.round(Number(item?.stock||(10+index*3)))))})).slice(0,6):[];
    const site=await prisma.site.update({where:{id:params.siteId},data:{name:String(generated.siteName||'My Buildora Site').slice(0,100),themeId,themeConfig:{...existingConfig,tagline:String(generated.tagline||'').slice(0,220),accentColor,seoTitle:String(generated.seoTitle||'').slice(0,70),seoDescription:String(generated.seoDescription||'').slice(0,160),generatedFrom:description,siteMode,commerceEnabled:siteMode==='ecommerce',blogIdeas}}});
    const homeBody=Array.isArray(generated.home?.body)?generated.home.body.map(String):[]; const aboutBody=Array.isArray(generated.about?.body)?generated.about.body.map(String):[];
    const modeSlug=({ecommerce:'products',booking:'services',restaurant:'menu',event:'event',courses:'courses','real-estate':'properties',recruitment:'jobs',nonprofit:'programs'} as Record<string,string>)[siteMode]||'services';
    await prisma.$transaction(async(tx)=>{await tx.page.updateMany({where:{siteId:params.siteId,isHomepage:true},data:{isHomepage:false}}); const pages=[{slug:'home',title:generated.home?.title||'Home',isHomepage:true,contentJson:tiptap(generated.home?.headline||generated.siteName||'Welcome',[...homeBody,generated.home?.cta?`Next step: ${generated.home.cta}`:''].filter(Boolean))},{slug:'about',title:generated.about?.title||'About',isHomepage:false,contentJson:tiptap(generated.about?.title||'About',aboutBody)},{slug:modeSlug,title:offerTitle,isHomepage:false,contentJson:offerDoc(offerTitle,finalOffers)}]; for(const page of pages)await tx.page.upsert({where:{siteId_slug:{siteId:params.siteId,slug:page.slug}},update:{title:page.title,contentJson:page.contentJson,isHomepage:page.isHomepage,status:'PUBLISHED',publishedAt:new Date()},create:{siteId:params.siteId,slug:page.slug,title:page.title,contentJson:page.contentJson,isHomepage:page.isHomepage,status:'PUBLISHED',publishedAt:new Date()}}); for(const idea of blogIdeas){const slug=slugify(idea);const excerpt=`A practical guide from ${String(generated.siteName||'our team')} about ${idea.toLowerCase()}.`;await tx.post.upsert({where:{siteId_slug:{siteId:params.siteId,slug}},update:{title:idea,excerpt,contentJson:tiptap(idea,[excerpt]),status:'PUBLISHED',publishedAt:new Date()},create:{siteId:params.siteId,title:idea,slug,excerpt,contentJson:tiptap(idea,[excerpt]),status:'PUBLISHED',publishedAt:new Date()}});}});
    if(siteMode==='ecommerce'){await ensureCommerceSchema();for(const product of starterProducts){const productSlug=slugify(product.name);const existing=await prisma.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM commerce_products WHERE siteId = ? AND slug = ? LIMIT 1',params.siteId,productSlug);if(existing[0])await prisma.$executeRawUnsafe('UPDATE commerce_products SET name = ?, description = ?, price = ?, stockQuantity = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',product.name,product.description,product.price,product.stock,'PUBLISHED',existing[0].id);else await prisma.$executeRawUnsafe('INSERT INTO commerce_products (id, siteId, name, slug, description, price, currency, imageUrl, stockQuantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',crypto.randomUUID(),params.siteId,product.name,productSlug,product.description,product.price,'NGN',null,product.stock,'PUBLISHED');}}
    const promptTokens=json.usage?.prompt_tokens??0,completionTokens=json.usage?.completion_tokens??0,totalTokens=json.usage?.total_tokens??promptTokens+completionTokens;
    await prisma.aiGeneration.create({data:{siteId:params.siteId,userId:user.id,actionType:'DRAFT',model:MODEL,promptTokens,completionTokens,totalTokens,durationMs:Date.now()-started,success:true,metadata:{kind:'SITE_GENERATOR',siteMode,descriptionLength:description.length,generatedPosts:blogIdeas.length,generatedProducts:starterProducts.length}}});
    return Response.json({site,generated:{siteName:site.name,tagline:(site.themeConfig as Record<string,unknown>).tagline,themeId,accentColor,siteMode,modePage:modeSlug,shopUrl:siteMode==='ecommerce'?`/site/${site.slug}/shop`:null,products:starterProducts,blogIdeas}});
  }catch(error){if(error instanceof Error&&error.name==='AbortError')return jsonError('AI website generation timed out',504);console.error('AI site generation failed',error);return jsonError('Unable to generate website',500);}
}
