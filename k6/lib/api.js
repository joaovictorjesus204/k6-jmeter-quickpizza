// Cliente da API do QuickPizza: cada função é uma operação de negócio.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, ALVO_LOCAL } from './config.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function cabecalhos(token) {
  return { ...JSON_HEADERS, Authorization: `token ${token}` };
}

// Cria um usuário exclusivo para a execução e devolve o token de acesso.
export function criarUsuarioELogar() {
  const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const usuario = { username: `k6_${sufixo}`.slice(0, 32), password: 'senha-k6-123' };

  const cadastro = http.post(`${BASE_URL}/api/users`, JSON.stringify(usuario), {
    headers: JSON_HEADERS, tags: { endpoint: 'cadastro' },
  });
  check(cadastro, { 'cadastro de usuário: status 201': (r) => r.status === 201 });

  const login = http.post(`${BASE_URL}/api/users/token/login`, JSON.stringify(usuario), {
    headers: JSON_HEADERS, tags: { endpoint: 'login' },
  });
  const logou = check(login, {
    'login: status 200': (r) => r.status === 200,
    'login: token com 16 caracteres': (r) => (r.json('token') || '').length === 16,
  });
  if (!logou) {
    throw new Error(`Não foi possível logar em ${BASE_URL} (status ${login.status})`);
  }
  return { usuario, token: login.json('token') };
}

export function paginaInicial() {
  return http.get(`${BASE_URL}/`, { tags: { endpoint: 'pagina_inicial' } });
}

export function recomendarPizza(token, restricoes) {
  return http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restricoes), {
    headers: cabecalhos(token), tags: { endpoint: 'recomendacao' },
  });
}

export function avaliarPizza(token, pizzaId, estrelas) {
  return http.post(`${BASE_URL}/api/ratings`, JSON.stringify({ pizza_id: pizzaId, stars: estrelas }), {
    headers: cabecalhos(token), tags: { endpoint: 'avaliacao_criar' },
  });
}

export function consultarAvaliacao(token, id) {
  return http.get(`${BASE_URL}/api/ratings/${id}`, {
    headers: cabecalhos(token), tags: { endpoint: 'avaliacao_consultar' },
  });
}

export function apagarAvaliacao(token, id) {
  // No ambiente público, o 403 do achado de sessão (ver README) não conta como erro HTTP.
  return http.del(`${BASE_URL}/api/ratings/${id}`, null, {
    headers: cabecalhos(token),
    tags: { endpoint: 'avaliacao_apagar' },
    responseCallback: ALVO_LOCAL ? http.expectedStatuses(204) : http.expectedStatuses(204, 403),
  });
}
