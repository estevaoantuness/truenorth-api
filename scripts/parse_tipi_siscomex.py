#!/usr/bin/env python3
"""
Script para parsear TIPI Excel + Siscomex JSON e gerar arquivo combinado
para importação no banco de dados PostgreSQL
"""

import json
import pandas as pd
import re
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
TIPI_PATH = BASE_DIR / "tipi.xlsx"
SISCOMEX_PATH = BASE_DIR / "ncm_siscomex.json"
OUTPUT_PATH = BASE_DIR / "ncm_completo.json"

def normalize_ncm(ncm: str) -> str:
    """Normaliza NCM para 8 dígitos"""
    if not ncm:
        return ""
    # Remove pontos e espaços
    ncm = re.sub(r'[.\s]', '', str(ncm))
    # Pad com zeros à direita se necessário
    if len(ncm) < 8:
        ncm = ncm.ljust(8, '0')
    return ncm[:8]

def parse_aliquota(val) -> float:
    """Converte alíquota para float"""
    if pd.isna(val) or val == '' or val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    # String: pode ter %, vírgula, etc
    s = str(val).strip().replace('%', '').replace(',', '.')
    try:
        return float(s)
    except:
        return 0.0

def parse_tipi_excel() -> dict:
    """Parseia TIPI Excel e retorna dict NCM -> alíquota IPI"""
    print(f"Lendo TIPI Excel: {TIPI_PATH}")

    # Header na linha 8 (index 7)
    df = pd.read_excel(TIPI_PATH, header=7)

    # Renomear colunas
    df.columns = ['ncm_raw', 'ex', 'descricao', 'aliquota_ipi']

    print(f"Total de linhas: {len(df)}")

    tipi_data = {}
    for _, row in df.iterrows():
        ncm_raw = str(row['ncm_raw']) if pd.notna(row['ncm_raw']) else ''
        ncm = normalize_ncm(ncm_raw)

        # Só aceita NCMs válidos (8 dígitos numéricos)
        if not ncm or not ncm.isdigit() or len(ncm) != 8:
            continue

        aliquota = parse_aliquota(row['aliquota_ipi'])
        descricao = str(row['descricao']) if pd.notna(row['descricao']) else ''

        tipi_data[ncm] = {
            'aliquota_ipi': aliquota,
            'descricao_tipi': descricao[:500]  # Limitar tamanho
        }

    print(f"NCMs válidos no TIPI: {len(tipi_data)}")
    return tipi_data

def parse_siscomex_json() -> dict:
    """Parseia Siscomex JSON e retorna dict NCM -> dados"""
    print(f"Lendo Siscomex JSON: {SISCOMEX_PATH}")

    with open(SISCOMEX_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Pode ser lista direta ou objeto com chave 'Nomenclaturas'
    items = data.get('Nomenclaturas', data) if isinstance(data, dict) else data

    print(f"Total de registros no Siscomex: {len(items)}")

    siscomex_data = {}
    for item in items:
        codigo = item.get('Codigo', '')
        ncm = normalize_ncm(codigo)

        # Só aceita NCMs com 8 dígitos
        if not ncm or not ncm.isdigit() or len(ncm) != 8:
            continue

        descricao = item.get('Descricao', '')
        data_inicio = item.get('Data_Inicio', '')
        data_fim = item.get('Data_Fim', '')

        # Se já existe e tem data_fim (expirado), pular
        if ncm in siscomex_data and data_fim:
            continue

        siscomex_data[ncm] = {
            'descricao': descricao[:500],
            'data_inicio': data_inicio,
            'data_fim': data_fim
        }

    print(f"NCMs válidos no Siscomex: {len(siscomex_data)}")
    return siscomex_data

def detect_setor(ncm: str, descricao: str) -> str:
    """Detecta setor baseado no capítulo NCM e descrição"""
    capitulo = ncm[:2] if ncm else ''
    desc_lower = descricao.lower() if descricao else ''

    # Mapeamento por capítulo
    setor_map = {
        # Alimentos
        '01': 'Alimentos', '02': 'Alimentos', '03': 'Alimentos', '04': 'Alimentos',
        '05': 'Alimentos', '06': 'Alimentos', '07': 'Alimentos', '08': 'Alimentos',
        '09': 'Alimentos', '10': 'Alimentos', '11': 'Alimentos', '12': 'Alimentos',
        '13': 'Alimentos', '14': 'Alimentos', '15': 'Alimentos', '16': 'Alimentos',
        '17': 'Alimentos', '18': 'Alimentos', '19': 'Alimentos', '20': 'Alimentos',
        '21': 'Alimentos', '22': 'Bebidas', '23': 'Alimentos', '24': 'Tabaco',
        # Químicos
        '25': 'Quimicos', '26': 'Minerais', '27': 'Combustiveis', '28': 'Quimicos',
        '29': 'Quimicos', '30': 'Farmaceuticos', '31': 'Fertilizantes', '32': 'Quimicos',
        '33': 'Cosmeticos', '34': 'Quimicos', '35': 'Quimicos', '36': 'Explosivos',
        '37': 'Fotograficos', '38': 'Quimicos',
        # Plásticos e Borracha
        '39': 'Plasticos', '40': 'Borracha',
        # Couros e Têxteis
        '41': 'Couro', '42': 'Couro', '43': 'Peleteria',
        '44': 'Madeira', '45': 'Cortica', '46': 'Cestaria',
        '47': 'Papel', '48': 'Papel', '49': 'Papel',
        # Têxteis
        '50': 'Textil', '51': 'Textil', '52': 'Textil', '53': 'Textil',
        '54': 'Textil', '55': 'Textil', '56': 'Textil', '57': 'Textil',
        '58': 'Textil', '59': 'Textil', '60': 'Textil', '61': 'Vestuario',
        '62': 'Vestuario', '63': 'Textil',
        # Calçados
        '64': 'Calcados', '65': 'Chapeus', '66': 'Guarda-chuvas', '67': 'Penas',
        # Minerais e Metais
        '68': 'Minerais', '69': 'Ceramicas', '70': 'Vidro',
        '71': 'Joias', '72': 'Metais', '73': 'Metais', '74': 'Cobre',
        '75': 'Niquel', '76': 'Aluminio', '78': 'Chumbo', '79': 'Zinco',
        '80': 'Estanho', '81': 'Metais', '82': 'Ferramentas', '83': 'Metais',
        # Máquinas e Equipamentos
        '84': 'Maquinas', '85': 'Eletronicos',
        # Veículos
        '86': 'Ferroviario', '87': 'Autopecas', '88': 'Aeronautica', '89': 'Naval',
        # Instrumentos
        '90': 'Instrumentos', '91': 'Relogios', '92': 'Instrumentos_Musicais',
        # Outros
        '93': 'Armas', '94': 'Moveis', '95': 'Brinquedos', '96': 'Diversos',
        '97': 'Arte', '99': 'Diversos'
    }

    setor = setor_map.get(capitulo, 'Outros')

    # Refinamentos por descrição
    if 'smartphone' in desc_lower or 'celular' in desc_lower or 'telefone' in desc_lower:
        setor = 'Eletronicos'
    elif 'computador' in desc_lower or 'notebook' in desc_lower or 'laptop' in desc_lower:
        setor = 'Eletronicos'
    elif 'medicamento' in desc_lower or 'farmac' in desc_lower:
        setor = 'Farmaceuticos'
    elif 'cosmetic' in desc_lower or 'perfum' in desc_lower:
        setor = 'Cosmeticos'
    elif 'automovel' in desc_lower or 'veiculo' in desc_lower or 'automovel' in desc_lower:
        setor = 'Autopecas'

    return setor

def detect_anuentes(ncm: str, descricao: str, setor: str) -> list:
    """Detecta anuentes necessários baseado no NCM e setor"""
    anuentes = []
    capitulo = ncm[:2] if ncm else ''
    desc_lower = descricao.lower() if descricao else ''

    # ANVISA - Produtos de saúde, alimentos, cosméticos
    if setor in ['Farmaceuticos', 'Cosmeticos', 'Alimentos', 'Bebidas']:
        anuentes.append('ANVISA')
    if any(x in desc_lower for x in ['medicamento', 'farmac', 'vacina', 'soro', 'sangue']):
        if 'ANVISA' not in anuentes:
            anuentes.append('ANVISA')

    # MAPA - Produtos agropecuários
    if setor in ['Alimentos', 'Fertilizantes'] or capitulo in ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']:
        anuentes.append('MAPA')

    # IBAMA - Produtos com impacto ambiental
    if setor in ['Quimicos', 'Madeira'] or any(x in desc_lower for x in ['agrotox', 'pestici', 'herbici']):
        anuentes.append('IBAMA')

    # INMETRO - Produtos com certificação obrigatória
    if setor in ['Eletronicos', 'Autopecas', 'Brinquedos']:
        anuentes.append('INMETRO')

    # ANATEL - Telecomunicações
    if setor == 'Eletronicos' and any(x in desc_lower for x in ['telefone', 'celular', 'radio', 'transmissor', 'wifi', 'bluetooth']):
        anuentes.append('ANATEL')

    # Exército - Armas e explosivos
    if setor in ['Armas', 'Explosivos']:
        anuentes.append('EXERCITO')

    # ANP - Combustíveis
    if setor == 'Combustiveis':
        anuentes.append('ANP')

    return anuentes

def estimate_ii_rate(ncm: str, setor: str) -> float:
    """Estima alíquota II baseado no setor (aproximação)"""
    # Alíquotas médias por setor (aproximação)
    # Fonte real seria a TEC (Tarifa Externa Comum do Mercosul)
    ii_rates = {
        'Eletronicos': 14.0,
        'Autopecas': 18.0,
        'Maquinas': 14.0,
        'Textil': 35.0,
        'Vestuario': 35.0,
        'Calcados': 35.0,
        'Quimicos': 12.0,
        'Farmaceuticos': 8.0,
        'Cosmeticos': 18.0,
        'Alimentos': 14.0,
        'Bebidas': 20.0,
        'Brinquedos': 20.0,
        'Metais': 12.0,
        'Plasticos': 14.0,
        'Moveis': 16.0,
        'Papel': 12.0,
        'Instrumentos': 14.0,
    }
    return ii_rates.get(setor, 14.0)  # Default 14%

def combine_data():
    """Combina dados do TIPI e Siscomex"""
    tipi = parse_tipi_excel()
    siscomex = parse_siscomex_json()

    # Unir todos os NCMs de ambas as fontes
    all_ncms = set(tipi.keys()) | set(siscomex.keys())
    print(f"Total de NCMs únicos: {len(all_ncms)}")

    combined = []
    for ncm in sorted(all_ncms):
        tipi_info = tipi.get(ncm, {})
        siscomex_info = siscomex.get(ncm, {})

        # Priorizar descrição do Siscomex (mais completa), fallback para TIPI
        descricao = siscomex_info.get('descricao') or tipi_info.get('descricao_tipi', '')

        # Alíquota IPI do TIPI
        aliquota_ipi = tipi_info.get('aliquota_ipi', 0.0)

        # Detectar setor
        setor = detect_setor(ncm, descricao)

        # Detectar anuentes
        anuentes = detect_anuentes(ncm, descricao, setor)

        # Estimar II (aproximação)
        aliquota_ii = estimate_ii_rate(ncm, setor)

        # PIS/COFINS padrão (regime não-cumulativo)
        aliquota_pis = 2.10
        aliquota_cofins = 9.65

        record = {
            'ncm': ncm,
            'descricao': descricao[:500],
            'capitulo': ncm[:2],
            'aliquota_ii': aliquota_ii,
            'aliquota_ipi': aliquota_ipi,
            'aliquota_pis': aliquota_pis,
            'aliquota_cofins': aliquota_cofins,
            'anuentes': anuentes,
            'requer_lpco': len(anuentes) > 0,
            'setor': setor,
            'fonte_ipi': 'TIPI' if ncm in tipi else 'estimado',
            'fonte_ncm': 'Siscomex' if ncm in siscomex else 'TIPI'
        }
        combined.append(record)

    return combined

def main():
    print("=" * 60)
    print("Combinando dados TIPI + Siscomex")
    print("=" * 60)

    combined = combine_data()

    # Estatísticas
    print("\n" + "=" * 60)
    print("ESTATÍSTICAS")
    print("=" * 60)
    print(f"Total de NCMs: {len(combined)}")

    # Por setor
    setores = {}
    for r in combined:
        setor = r['setor']
        setores[setor] = setores.get(setor, 0) + 1

    print("\nPor setor:")
    for setor, count in sorted(setores.items(), key=lambda x: -x[1])[:15]:
        print(f"  {setor}: {count}")

    # Com anuentes
    com_anuentes = sum(1 for r in combined if r['anuentes'])
    print(f"\nCom anuentes necessários: {com_anuentes} ({100*com_anuentes/len(combined):.1f}%)")

    # Alíquota IPI
    com_ipi = sum(1 for r in combined if r['aliquota_ipi'] > 0)
    print(f"Com alíquota IPI > 0: {com_ipi} ({100*com_ipi/len(combined):.1f}%)")

    # Salvar JSON
    print(f"\nSalvando em: {OUTPUT_PATH}")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

    print(f"Arquivo salvo com {len(combined)} NCMs!")

    # Amostra
    print("\n" + "=" * 60)
    print("AMOSTRA (5 primeiros)")
    print("=" * 60)
    for r in combined[:5]:
        print(f"\nNCM: {r['ncm']}")
        print(f"  Descrição: {r['descricao'][:80]}...")
        print(f"  Setor: {r['setor']}")
        print(f"  II: {r['aliquota_ii']}%, IPI: {r['aliquota_ipi']}%")
        print(f"  PIS: {r['aliquota_pis']}%, COFINS: {r['aliquota_cofins']}%")
        print(f"  Anuentes: {r['anuentes']}")

if __name__ == '__main__':
    main()
