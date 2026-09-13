import {createDemo} from './audio';
self.onmessage=({data:{kind}})=>{
  const clip=createDemo(kind);
  self.postMessage(clip,{transfer:clip.channels.map(c=>c.buffer)});
};
