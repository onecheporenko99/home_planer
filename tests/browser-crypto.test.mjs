import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {sha256,sha256Fallback,randomUuid} from '../src/browser-crypto.mjs';
test('LAN HTTP SHA-256 fallback agrees with Web Crypto for padding boundaries and binary assets',async()=>{
  for(const size of [0,1,3,55,56,63,64,65,1000,1024*1024]){
    const bytes=Uint8Array.from({length:size},(_,i)=>(i*37+11)%256),expected=createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256Fallback(bytes),expected);assert.equal(await sha256(bytes,{}),expected);assert.equal(await sha256(bytes,webcrypto),expected);
  }
});
test('LAN HTTP UUID fallback uses random bytes with UUID v4 version and variant',()=>{
  const ids=new Set(Array.from({length:100},()=>randomUuid(webcrypto)));
  assert.equal(ids.size,100);for(const id of ids)assert.match(id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
});
