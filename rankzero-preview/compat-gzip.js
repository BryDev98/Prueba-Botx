(function(){
  if ('DecompressionStream' in window) return;
  if (!window.TransformStream || !window.fflate) {
    console.error('RANK ZERO: gzip compatibility layer unavailable');
    return;
  }
  class RZGzipDecompressionStream {
    constructor(format){
      if(format !== 'gzip') throw new TypeError('Only gzip is supported');
      const chunks=[];
      const ts=new TransformStream({
        transform(chunk){
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        },
        flush(controller){
          let size=0;
          for(const c of chunks) size+=c.byteLength;
          const input=new Uint8Array(size);
          let off=0;
          for(const c of chunks){ input.set(c,off); off+=c.byteLength; }
          const output=window.fflate.gunzipSync(input);
          controller.enqueue(output);
        }
      });
      this.readable=ts.readable;
      this.writable=ts.writable;
    }
  }
  window.DecompressionStream=RZGzipDecompressionStream;
})();
