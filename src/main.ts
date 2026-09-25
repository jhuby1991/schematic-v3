import './styles/tokens.css';
import './styles/app.css';
import './styles/print.css';
import { createApp } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');
createApp(root);
