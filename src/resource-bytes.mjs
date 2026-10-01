import {RESOURCE_LIMIT,PIXEL_LIMIT,RESOURCE_MIMES} from './underlays.mjs';
// Shared header checks for server storage and portable archives. Image decoding
// remains a separate browser check before uploading imported resources.
export function inspectResource(input,mime){
 const bytes=new Uint8Array(input.buffer,input.byteOffset,input.byteLength),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const ascii=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
 if(!RESOURCE_MIMES.includes(mime)||!bytes.length||bytes.length>RESOURCE_LIMIT)throw Error('Файл: JPG, PNG, WEBP или PDF, до 20 МБ');
 let width,height;
 if(mime==='image/png'&&bytes.length>=33&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)&&ascii(12,16)==='IHDR'){width=v.getUint32(16);height=v.getUint32(20)}
 else if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)continue;let marker=bytes[i++];if(marker===255){i--;continue}if(marker===217||marker===218)break;const size=v.getUint16(i);if(size<2||i+size>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=v.getUint16(i+3);width=v.getUint16(i+5);break}i+=size}}
 else if(mime==='image/webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){const kind=ascii(12,16);if(kind==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)}else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383}else if(kind==='VP8L'&&bytes[20]===47){const n=v.getUint32(21,true);width=1+(n&16383);height=1+((n>>>14)&16383)}}
 else if(mime==='application/pdf'&&ascii(0,5)==='%PDF-'&&ascii(Math.max(0,bytes.length-4096),bytes.length).includes('%%EOF'))return {};
 if(!width||!height||width>8192||height>8192||width*height>PIXEL_LIMIT)throw Error('Файл повреждён, не соответствует формату или превышает 8192 px / 24 Мп');
 return {width,height};
}
