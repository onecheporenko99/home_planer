import React from 'react';
import {createRoot} from 'react-dom/client';
import {CloudShell} from './CloudShell';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><CloudShell/></React.StrictMode>);
