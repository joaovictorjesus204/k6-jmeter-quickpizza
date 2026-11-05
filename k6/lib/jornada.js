// Jornada do cliente usada pelos testes de carga, estresse e pico:
// abrir o site, pedir uma recomendação de pizza, avaliar e apagar a avaliação.
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { ALVO_LOCAL } from './config.js';
import {
  paginaInicial, recomendarPizza, avaliarPizza, consultarAvaliacao, apagarAvaliacao,
} from './api.js';

// Métricas de negócio, além das métricas HTTP padrão do k6.
export const pizzasRecomendadas = new Counter('pizzas_recomendadas');
export const tempoRecomendacao = new Trend('tempo_recomendacao_ms', true);
export const regrasDaPizzaOk = new Rate('regras_da_pizza_ok');

// Achado do ambiente público (ver README): às vezes o servidor não reconhece o
// token do usuário e trata a requisição como "usuário padrão", que não pode apagar.
export const sessaoReconhecida = new Rate('achado_sessao_reconhecida_ao_apagar');

function ehAchadoDeSessao(res) {
  return res.status === 403 && (res.body || '').includes('default user');
}

const FERRAMENTAS = ['Knife', 'Pizza cutter', 'Scissors'];

function sortear(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// Restrições variadas, como clientes diferentes pediriam.
export function restricoesAleatorias() {
  return {
    maxCaloriesPerSlice: 1000,
    mustBeVegetarian: Math.random() < 0.3,
    excludedIngredients: [],
    excludedTools: [sortear(FERRAMENTAS)],
    maxNumberOfToppings: 5,
    minNumberOfToppings: 2,
  };
}

// Regras de negócio da recomendação, conferidas em toda resposta.
export function conferirRegrasDaPizza(res, restricoes) {
  const corpo = res.json();
  const pizza = corpo.pizza;
  const somaCalorias = pizza.ingredients.reduce((total, i) => total + i.caloriesPerSlice, 0);
  const todosVegetarianos = pizza.ingredients.every((i) => i.vegetarian);

  return check(corpo, {
    'pizza: tem id e nome': () => pizza.id > 0 && pizza.name.length > 0,
    'pizza: calorias = soma dos ingredientes': () => corpo.calories === somaCalorias,
    'pizza: indicador vegetariano condiz com os ingredientes': () => corpo.vegetarian === todosVegetarianos,
    'pizza: respeita o pedido vegetariano': () => !restricoes.mustBeVegetarian || todosVegetarianos,
    'pizza: não usa a ferramenta excluída': () => !restricoes.excludedTools.includes(pizza.tool),
    'pizza: base (3) + coberturas dentro do limite': () =>
      pizza.ingredients.length <= 3 + restricoes.maxNumberOfToppings,
  });
}

export function jornadaDoCliente(token) {
  group('01 Página inicial', () => {
    const res = paginaInicial();
    check(res, { 'página inicial: status 200': (r) => r.status === 200 });
  });
  sleep(1);

  let pizzaId;
  group('02 Recomendação de pizza', () => {
    const restricoes = restricoesAleatorias();
    const res = recomendarPizza(token, restricoes);
    const ok = check(res, { 'recomendação: status 200': (r) => r.status === 200 });
    if (!ok) return;

    pizzasRecomendadas.add(1);
    tempoRecomendacao.add(res.timings.duration);
    regrasDaPizzaOk.add(conferirRegrasDaPizza(res, restricoes));
    pizzaId = res.json('pizza.id');
  });
  sleep(1);

  if (!pizzaId) return;

  group('03 Avaliação da pizza', () => {
    const estrelas = 1 + Math.floor(Math.random() * 5);
    const criada = avaliarPizza(token, pizzaId, estrelas);
    const ok = check(criada, {
      'avaliação: status 201': (r) => r.status === 201,
      'avaliação: guarda as estrelas enviadas': (r) => r.json('stars') === estrelas,
    });
    if (!ok) return;

    const id = criada.json('id');
    const consulta = consultarAvaliacao(token, id);
    check(consulta, {
      'consulta da avaliação: status 200': (r) => r.status === 200,
      'consulta da avaliação: mesma pizza': (r) => r.json('pizza_id') === pizzaId,
    });

    // Limpeza: cada iteração apaga o que criou.
    const apagada = apagarAvaliacao(token, id);
    sessaoReconhecida.add(apagada.status === 204);
    if (ALVO_LOCAL) {
      check(apagada, { 'avaliação apagada: status 204': (r) => r.status === 204 });
    } else {
      check(apagada, {
        'avaliação apagada: 204 (ou 403 do achado de sessão)': (r) => r.status === 204 || ehAchadoDeSessao(r),
      });
    }
    if (apagada.status !== 204) {
      console.warn(`Apagar avaliação ${id} respondeu ${apagada.status}: ${apagada.body}`);
    }
  });

  // Tempo de "leitura" do cliente entre uma ação e outra.
  sleep(1 + Math.random() * 2);
}
