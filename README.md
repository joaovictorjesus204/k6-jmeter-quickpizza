# k6 + JMeter | QuickPizza (Grafana)

[![Testes de desempenho](https://github.com/joaovictorjesus204/k6-jmeter-quickpizza/actions/workflows/performance.yml/badge.svg)](https://github.com/joaovictorjesus204/k6-jmeter-quickpizza/actions/workflows/performance.yml)

**📊 Relatórios da última execução:** https://joaovictorjesus204.github.io/k6-jmeter-quickpizza/

Testes de **desempenho** com **k6 (JavaScript)** e **Apache JMeter** no **[QuickPizza](https://quickpizza.grafana.com)**, a aplicação de recomendação de pizzas que a Grafana mantém para estudos de desempenho e observabilidade. Cobre smoke, carga, estresse e pico, com critérios de aceite que reprovam o pipeline quando o desempenho piora.

Autor: João Victor de Jesus

---

## Números

| | |
|---|---|
| Tipos de teste | 4 no k6 (smoke, carga, estresse, pico) e 1 plano no JMeter (jornada do cliente) |
| Jornada simulada | Abrir o site, pedir recomendação de pizza, avaliar, consultar e apagar a avaliação |
| Verificações | 22 no k6, incluindo 6 regras de negócio da pizza e 5 cenários negativos |
| Carga máxima | 200 usuários simultâneos (pico) |
| Critérios de aceite | Menos de 1% de erros, 95% das respostas em até 1 s, regras de negócio 100% corretas |
| Execução automática | A cada push e diariamente, nos dias úteis, pelo GitHub Actions |
| Relatórios | Painel HTML do k6 e relatório HTML do JMeter publicados no GitHub Pages |

---

## Por que o QuickPizza

Teste de carga em site real sem autorização pode derrubar o serviço e prejudicar quem usa. Por isso o alvo é o QuickPizza, que a própria Grafana publica para isso, com uma regra clara: o ambiente público aceita **testes em pequena escala**. Este projeto segue a regra:

| Teste | Onde roda | Por quê |
|---|---|---|
| Smoke (1 usuário) | Ambiente público | Valida o ambiente real com carga mínima |
| Carga (até 10 usuários) | Ambiente público ou local | Pequena escala, dentro do permitido |
| Estresse e pico (até 200 usuários) | **Só em instância local** | O script recusa rodar contra o ambiente público |

No GitHub Actions, carga, estresse, pico e JMeter rodam contra um QuickPizza criado dentro do próprio servidor do CI (contêiner Docker).

---

## Tipos de teste

| Teste | Arquivo | Usuários | Duração | O que responde |
|---|---|---|---|---|
| **Smoke** | `k6/smoke.js` | 1 | 30 s | O sistema e o script funcionam? Os erros são tratados certo? |
| **Carga** | `k6/load.js` | 0 → 10 → 0 | 3 min 30 s | Aguenta o uso normal dentro dos critérios? |
| **Estresse** | `k6/stress.js` | 50 → 100 → 150 | 4 min 30 s | Até onde aguenta antes de degradar? |
| **Pico** | `k6/spike.js` | 5 → 200 em 10 s | 2 min 30 s | Aguenta uma explosão de acessos e se recupera? |
| **Jornada (JMeter)** | `jmeter/plano.jmx` | 10 | 2 min | A mesma jornada no JMeter, com asserções por requisição |

### Critérios de aceite (thresholds)

| Critério | Smoke e carga | Estresse | Pico |
|---|---|---|---|
| Taxa de erros | < 1% | < 5% | < 5% |
| Tempo de resposta (p95) | < 1 s | < 3 s | < 5 s |
| Recomendação de pizza (p95) | < 1,5 s | | |
| Regras de negócio da pizza | 100% | 100% | 100% |

Se qualquer critério for violado, o k6 termina com erro e o pipeline fica vermelho.

---

## Como rodar (Windows)

Pré-requisitos:

| Ferramenta | Como instalar |
|---|---|
| **k6** | `winget install k6 --source winget` |
| **Java 17+** | Necessário para o JMeter |
| **JMeter 5.6+** | Baixe o zip em https://jmeter.apache.org/download_jmeter.cgi, extraia em `C:\jmeter` e adicione `C:\jmeter\apache-jmeter-5.6.3\bin` ao PATH |

```bash
git clone https://github.com/joaovictorjesus204/k6-jmeter-quickpizza.git
cd k6-jmeter-quickpizza
k6 run k6/smoke.js
```

| Comando | O que faz |
|---|---|
| `k6 run k6/smoke.js` | Smoke no ambiente público |
| `k6 run k6/load.js` | Carga no ambiente público (até 10 usuários) |
| `jmeter -n -t jmeter/plano.jmx -l reports/jmeter.jtl -e -o reports/jmeter` | JMeter sem interface, gera o relatório HTML em `reports\jmeter\index.html` |

O JMeter exige que a pasta do relatório não exista. Para rodar de novo, apague antes: `Remove-Item reports\jmeter* -Recurse`.

### Ver os testes rodando na tela

| Comando | O que faz |
|---|---|
| `$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_OPEN="true"; k6 run k6/load.js` | Abre no navegador o painel do k6, com gráficos ao vivo de usuários, tempo de resposta e erros |
| `jmeter -t jmeter/plano.jmx` | Abre o plano no JMeter com interface. Clique no ▶ verde e acompanhe em "Ver árvore de resultados" e "Relatório resumido" |

### Estresse e pico (instância local)

Precisa do Docker. Suba o QuickPizza e rode apontando para ele:

```bash
docker run --rm -d -p 3333:3333 --name quickpizza ghcr.io/grafana/quickpizza-local:latest
k6 run -e BASE_URL=http://localhost:3333 k6/stress.js
k6 run -e BASE_URL=http://localhost:3333 k6/spike.js
docker stop quickpizza
```

No JMeter, o alvo muda por parâmetro: `-Jprotocolo=http -Jhost=localhost -Jporta=3333`. Também dá para mudar a carga: `-Jusuarios=20 -Jrampa=60 -Jduracao=300`.

---

## Estrutura

```
k6/
  smoke.js, load.js, stress.js, spike.js    um arquivo por tipo de teste
  lib/config.js                             alvo, critérios de aceite e trava de ambiente
  lib/api.js                                cliente da API (cada função é uma operação de negócio)
  lib/jornada.js                            jornada do cliente, regras de negócio e métricas próprias
jmeter/
  plano.jmx                                 plano do JMeter (preparação + clientes)
  verificar_resultados.py                   transforma o resultado do JMeter em critério de aceite
pages/index.html                            página inicial dos relatórios no GitHub Pages
.github/workflows/performance.yml           CI: k6 em matriz, JMeter e publicação dos relatórios
```

---

## Decisões técnicas

| Decisão | Por quê |
|---|---|
| **Um arquivo por tipo de teste, jornada compartilhada** | Smoke, carga, estresse e pico mudam só o perfil de carga. A jornada fica em um lugar só e uma mudança na API é corrigida uma vez |
| **Critérios de aceite como thresholds** | Desempenho vira resultado objetivo: passou ou não passou. Sem isso, teste de carga só gera gráfico |
| **Trava de ambiente** (`exigirAlvoLocal`) | Estresse e pico recusam rodar contra o ambiente público. Respeita a regra de uso do QuickPizza e evita causar dano por engano |
| **Regras de negócio conferidas sob carga** | Além de status e tempo, cada pizza é validada: calorias = soma dos ingredientes, pedido vegetariano respeitado, ferramenta excluída não usada. Sistema rápido que responde errado também é falha |
| **Métricas próprias** (`pizzas_recomendadas`, `tempo_recomendacao_ms`, `regras_da_pizza_ok`) | Indicadores de negócio aparecem no relatório ao lado das métricas HTTP |
| **Tags por endpoint** | Permite critério específico para a recomendação, a operação mais lenta da aplicação |
| **Usuário próprio por execução** (`setup`) | Cada execução cria e usa o próprio usuário, sem depender de dados de outras pessoas |
| **Cada iteração apaga o que criou** | A avaliação criada é apagada no fim da jornada. O ambiente não acumula lixo |
| **Tempo de pensamento entre ações** (`sleep` e timer aleatório) | Usuários reais não clicam sem parar. Sem pausa, 10 usuários virtuais viram uma carga muito maior que 10 pessoas |
| **Cenários negativos no smoke** | Sem token (401), avaliação com 6 estrelas (400), login inválido (401), ingrediente inexistente (400) e avaliação inexistente (404) |
| **JMeter parametrizado por propriedades** (`-J`) | O mesmo plano roda no ambiente público ou local, com qualquer carga, sem editar o arquivo |
| **Script que reprova o JMeter pelo resultado** | O JMeter termina com sucesso mesmo com asserções falhando. O `verificar_resultados.py` lê o `.jtl` e reprova o pipeline acima de 1% de erros |
| **Matriz no GitHub Actions** | Os 4 testes do k6 rodam em paralelo, cada um com o seu QuickPizza, e uma falha não esconde as outras |

---

## Achados

| Achado | Evidência | Como foi tratado |
|---|---|---|
| **A recomendação pode ultrapassar o limite de calorias pedido** | Com `maxCaloriesPerSlice: 300`, a API respondeu 200 com pizzas de 350, 375, 400 e 450 calorias. Na execução local, só 2 de 5 respeitaram o limite; no ambiente público, 1 de 5 e 2 de 5 em duas execuções. O código da aplicação tenta 10 combinações e, se nenhuma servir, devolve a última sem avisar | Registrado na métrica `achado_limite_de_calorias_respeitado`, sem reprovar o teste. O comportamento esperado seria avisar que não há pizza possível (por exemplo, 422) |
| **No ambiente público, o servidor às vezes não reconhece o usuário logado** | No smoke, 4 de 6 tentativas de apagar a própria avaliação responderam `403 operation not permitted for default user`, embora criar e consultar a mesma avaliação tivessem funcionado. Os ids das avaliações vieram em duas sequências separadas (6582, 6583 e 8689, 8690), o que indica mais de uma instância, cada uma com os próprios dados: quando a requisição cai numa instância que não conhece o token, ela trata o cliente como usuário padrão, que não pode apagar. Na instância local, que é única, o apagar funcionou em 100% das vezes | No ambiente público, o 403 com essa mensagem é aceito e medido na métrica `achado_sessao_reconhecida_ao_apagar`, com aviso no terminal. Na instância local, só 204 é aceito. O esperado seria a sessão valer em todas as instâncias (dados compartilhados ou sessão fixa por cliente) |

---

## Limitações

- O ambiente público é compartilhado e fica fora do Brasil: os tempos medidos daqui incluem a distância de rede. Por isso os critérios do ambiente público são mais largos que os de uma instância local.
- No CI, a aplicação e o k6 rodam no mesmo servidor. Os resultados de estresse e pico servem para comparar execuções entre si, e não como capacidade real de produção.

## Próximos passos

- Enviar as métricas do k6 para Prometheus e montar um painel no Grafana.
- Comparar cada execução com a anterior e falhar se o p95 piorar mais de 20%.
- Teste de resistência (soak) de 1 hora para detectar vazamento de memória.
- Teste de navegador com o módulo `k6/browser` para medir Web Vitals.
