let context:AudioContext|undefined;

// Resume during the click; play only after the requested change succeeds.
export function prepareCompletionSound(){
  try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{/* Audio must never block a status change. */}
}
export function playCompletionSound(){
  try{
    if(!context||context.state!=='running')return;
    const audio=context,start=audio.currentTime;
    [659.25,880].forEach((frequency,index)=>{
      const oscillator=audio.createOscillator(),gain=audio.createGain(),time=start+index*.12;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.055,time+.018);
      gain.gain.exponentialRampToValueAtTime(.0001,time+.42);
      oscillator.connect(gain);gain.connect(audio.destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
      oscillator.start(time);oscillator.stop(time+.44);
    });
  }catch{/* Sound is optional when the device cannot play it. */}
}
