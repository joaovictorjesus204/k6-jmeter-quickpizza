"""Lê o resultado do JMeter (.jtl) e falha se a taxa de erros passar do limite.

O JMeter termina com sucesso mesmo quando asserções falham. Este script
transforma o resultado em critério de aceite para o pipeline.

Uso: python3 jmeter/verificar_resultados.py reports/jmeter.jtl 1
"""
import csv
import sys
from collections import defaultdict

arquivo, limite = sys.argv[1], float(sys.argv[2])

total = falhas = 0
por_requisicao = defaultdict(lambda: [0, 0])
mensagens = defaultdict(int)

with open(arquivo, newline='', encoding='utf-8') as f:
    for linha in csv.DictReader(f):
        # Transações agrupam requisições; contamos só as requisições reais.
        if linha['label'][:2].isdigit():
            continue
        total += 1
        por_requisicao[linha['label']][0] += 1
        if linha['success'] != 'true':
            falhas += 1
            por_requisicao[linha['label']][1] += 1
            mensagens[linha.get('failureMessage') or linha['responseMessage']] += 1

if total == 0:
    sys.exit('Nenhuma requisição registrada no resultado do JMeter.')

taxa = 100 * falhas / total
print(f'Requisições: {total} | Falhas: {falhas} | Taxa de erros: {taxa:.2f}% (limite {limite}%)')
for nome, (qtd, erros) in sorted(por_requisicao.items()):
    print(f'  {nome}: {qtd} requisições, {erros} falhas')
for msg, qtd in mensagens.items():
    print(f'  Falha: {msg} ({qtd}x)')

if taxa > limite:
    sys.exit(f'Critério de aceite violado: {taxa:.2f}% de erros.')
print('Critério de aceite atendido.')
