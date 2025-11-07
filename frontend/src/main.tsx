import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Removed StrictMode to prevent Socket.IO double connection in React 18
// The useRef-based socket management in useSocket.ts handles this properly
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

