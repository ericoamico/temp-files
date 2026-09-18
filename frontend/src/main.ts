import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import HomePage from './pages/HomePage.vue';
import SharedFilePage from './pages/SharedFilePage.vue';
import './style.css';

// createWebHistory: SPA fallback funciona no Vite dev automaticamente e
// em producao basta servir index.html para rotas desconhecidas.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/f/:shareId', component: SharedFilePage },
  ],
});

createApp(App).use(router).mount('#app');
