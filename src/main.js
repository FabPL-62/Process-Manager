import { createApp } from 'vue'
import App from './App.vue'
import 'bootstrap/dist/css/bootstrap.css';

window.$ = window.jQuery = require('jquery');
window.Popper = require('popper.js');
require('bootstrap');

createApp(App).mount('#app')
