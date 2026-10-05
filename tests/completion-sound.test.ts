import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()});
it('plays two quiet notes only when explicitly requested',async()=>{
  const start=vi.fn(),stop=vi.fn(),volume=vi.fn();
  const audio={state:'running',currentTime:0,destination:{},resume:vi.fn(async()=>{}),createOscillator:vi.fn(()=>({type:'',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop})),createGain:()=>({connect:vi.fn(),disconnect:vi.fn(),gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:volume,exponentialRampToValueAtTime:vi.fn()}})};
  vi.stubGlobal('AudioContext',function(){return audio});
  const sound=await import('../src/completionSound');
  expect(start).not.toHaveBeenCalled();sound.prepareCompletionSound();expect(start).not.toHaveBeenCalled();
  sound.playCompletionSound();expect(start).toHaveBeenCalledTimes(2);expect(stop).toHaveBeenCalledTimes(2);expect(volume).toHaveBeenCalledWith(.055,.018);
});
it('does not interrupt status changes when audio is unavailable',async()=>{
  vi.stubGlobal('AudioContext',function(){throw Error('No audio device')});
  const sound=await import('../src/completionSound');
  expect(()=>{sound.prepareCompletionSound();sound.playCompletionSound()}).not.toThrow();
});
