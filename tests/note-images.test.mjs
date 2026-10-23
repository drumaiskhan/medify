import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {prepareImage,rasterType} from '../admin/src/utils/prepareNoteImage.ts';
const originalImage=globalThis.Image, originalDocument=globalThis.document;
afterEach(()=>{globalThis.Image=originalImage;globalThis.document=originalDocument;});
const png=Buffer.from('89504e470d0a1a0a00000000','hex');
function browser({failDecode=false,noCanvas=false,encode=()=>null}={}){
 globalThis.Image=class {naturalWidth=2800;naturalHeight=1400;set src(v){queueMicrotask(()=>failDecode?this.onerror?.():this.onload?.());}};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>noCanvas?null:{fillRect(){},drawImage(){}},toBlob(cb,type){cb(encode(type));}})};
}
test('detects original bytes even when Word MIME metadata is wrong',()=>{
 assert.equal(rasterType(png),'image/png');assert.equal(rasterType(new Uint8Array(20)),null);
});
test('keeps original PNG when canvas is unavailable',async()=>{
 browser({noCanvas:true});const r=await prepareImage(png.toString('base64'),'application/octet-stream');
 assert.equal(r.blob.type,'image/png');assert.deepEqual(Buffer.from(await r.blob.arrayBuffer()),png);
});
test('keeps original when every encoder returns null',async()=>{
 browser();assert.equal((await prepareImage(png.toString('base64'),'image/png')).blob.size,png.length);
});
test('keeps supported original when browser decoder fails',async()=>{
 browser({failDecode:true});const r=await prepareImage(png.toString('base64'),'image/png');assert.equal(r.width,undefined);assert.equal(r.blob.size,png.length);
});
test('falls back from WebP to JPEG and resizes dimensions',async()=>{
 browser({encode:t=>t==='image/jpeg'?new Blob(['jpeg'],{type:t}):null});
 const r=await prepareImage(png.toString('base64'),'image/png');assert.equal(r.blob.type,'image/jpeg');assert.equal(r.width,1400);assert.equal(r.height,700);
});
test('keeps a smaller original instead of inflating the file',async()=>{
 browser({encode:t=>new Blob([new Uint8Array(50)],{type:t})});const r=await prepareImage(png.toString('base64'),'image/png');assert.equal(r.blob.size,png.length);
});
test('rejects oversized originals if compression fails',async()=>{
 browser({noCanvas:true});const bytes=Buffer.alloc(4*1024*1024+1);png.copy(bytes);
 await assert.rejects(prepareImage(bytes.toString('base64'),'image/png'),/exceeds 4 MB/);
});
test('reports unsupported pictures honestly without dropping them silently',async()=>{
 browser({failDecode:true});await assert.rejects(prepareImage(Buffer.from('unsupported').toString('base64'),'image/x-emf'),/Unsupported or damaged/);
});
