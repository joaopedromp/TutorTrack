import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';
class Boundary extends React.Component<{children:React.ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message};}render(){return this.state.error?<main><h1>TutorTrack could not open</h1><p>{this.state.error}</p><p>Allow browser storage, then reload. Your existing data has not been cleared.</p><button onClick={()=>location.reload()}>Reload</button></main>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);
