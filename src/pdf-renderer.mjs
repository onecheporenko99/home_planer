import PDFDocument from 'pdfkit';import SVGtoPDF from 'svg-to-pdfkit';import {Buffer} from 'buffer';
export const MM_TO_PT=72/25.4;
export async function vectorPdf(pages,fontBytes,{title='Home Planer',date=new Date()}={},Document=PDFDocument){
 if(!pages.length||pages.length>100)throw Error('PDF: 1–100 страниц');const doc=new Document({autoFirstPage:false,font:Buffer.from(fontBytes),compress:true,info:{Title:title,CreationDate:date}}),chunks=[],warnings=[];const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(new Uint8Array(Buffer.concat(chunks))));doc.on('error',reject)});doc.registerFont('PlanFont',Buffer.from(fontBytes));
 try{for(const page of pages){doc.addPage({size:[page.width*MM_TO_PT,page.height*MM_TO_PT],margin:0});SVGtoPDF(doc,page.svg,0,0,{width:page.width*MM_TO_PT,height:page.height*MM_TO_PT,assumePt:true,preserveAspectRatio:'none',fontCallback:()=> 'PlanFont',warningCallback:w=>warnings.push(w)});}doc.end();const bytes=await done;if(warnings.length)throw Error('PDF не смог отрисовать все элементы: '+[...new Set(warnings)].slice(0,3).join('; '));return bytes;}catch(e){doc.destroy();done.catch(()=>{});throw e}
}
