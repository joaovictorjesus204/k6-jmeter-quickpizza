// SMOKE: 1 usuário por 30 segundos. Confere se a aplicação e o script
// funcionam antes de qualquer teste com carga. Também roda os cenários negativos.
import http from 'k6/http';
import { check, group } from 'k6';
import exec from 'k6/execution';
import { Rate } from 'k6/metrics';
import { BASE_URL, CRITERIOS_PADRAO } from './lib/config.js';
import { criarUsuarioELogar, cabecalhos, recomendarPizza, consultarAvaliacao } from './lib/api.js';
import { jornadaDoCliente } from './lib/jornada.js';

// Achado documentado no README: com limite de calorias apertado, a API pode
// devolver uma pizza acima do limite. A métrica registra a taxa sem reprovar o teste.
const limiteDeCaloriasRespeitado = new Rate('achado_limite_de_calorias_respeitado');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: CRITERIOS_PADRAO,
};

export function setup() {
  return criarUsuarioELogar();
}

function cenariosNegativos(token) {
  group('Cenários negativos', () => {
    check(http.post(`${BASE_URL}/api/pizza`, '{}', { headers: { 'Content-Type': 'application/json' }, responseCallback: http.expectedStatuses(401) }), {
      'sem token: recomendação recusada com 401': (r) => r.status === 401,
    });

    check(http.post(`${BASE_URL}/api/ratings`, JSON.stringify({ pizza_id: 1, stars: 6 }), { headers: cabecalhos(token), responseCallback: http.expectedStatuses(400) }), {
      'avaliação com 6 estrelas: recusada com 400': (r) => r.status === 400,
      'avaliação com 6 estrelas: mensagem explica a regra': (r) => (r.json('error') || '').includes('between 1 and 5'),
    });

    check(http.post(`${BASE_URL}/api/users/token/login`, JSON.stringify({ username: 'usuario_inexistente_k6', password: 'errada' }), { headers: { 'Content-Type': 'application/json' }, responseCallback: http.expectedStatuses(401) }), {
      'login inválido: recusado com 401': (r) => r.status === 401,
    });

    check(http.get(`${BASE_URL}/api/ingredients/ingrediente_inexistente`, { headers: cabecalhos(token), responseCallback: http.expectedStatuses(400) }), {
      'tipo de ingrediente inexistente: 400': (r) => r.status === 400,
    });

    const params = { responseCallback: http.expectedStatuses(404) };
    check(http.get(`${BASE_URL}/api/ratings/999999999`, { headers: cabecalhos(token), ...params }), {
      'avaliação inexistente: 404': (r) => r.status === 404,
    });
  });

  group('Achado: limite de calorias apertado', () => {
    for (let i = 0; i < 5; i++) {
      const res = recomendarPizza(token, { maxCaloriesPerSlice: 300, minNumberOfToppings: 2, maxNumberOfToppings: 2 });
      if (res.status === 200) {
        limiteDeCaloriasRespeitado.add(res.json('calories') <= 300);
      }
    }
  });
}

export default function ({ token }) {
  // Os cenários negativos rodam uma vez, na primeira iteração.
  if (exec.scenario.iterationInTest === 0) {
    cenariosNegativos(token);
  }
  jornadaDoCliente(token);
}
