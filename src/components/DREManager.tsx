import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Download, ChevronLeft, ChevronRight, Minus, Package, Receipt, PieChart, Calendar } from 'lucide-react';
import ExcelJS from 'exceljs';

interface VendaPDV {
  id: string;
  valor: number;
  valorLiquido: number;
  desconto?: number;
  timestamp: number;
  itens?: any[];
  tipoPedido?: string;
  formaPagamento?: string;
}

interface Compra {
  id: string;
  custoTotal: number;
  timestamp: number;
  descricao?: string;
}

interface ContaPagar {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Pago';
  tipo: string;
  dataPagamento?: string;
}

interface ContaReceber {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Recebido';
  dataPagamento?: string;
}

type Periodo = 'mes_atual' | 'mes_anterior' | 'trimestre' | 'semestre' | 'ano' | 'personalizado';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function DREManager() {
  const [vendas, setVendas] = useState<VendaPDV[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubVendas = onValue(ref(db, 'vendas_pdv'), snap => {
      const data = snap.val();
      setVendas(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubCompras = onValue(ref(db, 'historico_compras'), snap => {
      const data = snap.val();
      setCompras(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubPagar = onValue(ref(db, 'contas_pagar'), snap => {
      const data = snap.val();
      setContasPagar(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubReceber = onValue(ref(db, 'contas_receber'), snap => {
      const data = snap.val();
      setContasReceber(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { unsubVendas(); unsubCompras(); unsubPagar(); unsubReceber(); };
  }, []);

  const getRange = (): { inicio: Date; fim: Date } => {
    const agora = new Date();
    if (periodo === 'personalizado' && dataInicio && dataFim) {
      return { inicio: new Date(dataInicio + 'T00:00:00'), fim: new Date(dataFim + 'T23:59:59') };
    }
    if (periodo === 'mes_atual') {
      return {
        inicio: new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0),
        fim: new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59)
      };
    }
    if (periodo === 'mes_anterior') {
      const m = agora.getMonth() === 0 ? 11 : agora.getMonth() - 1;
      const a = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
      return { inicio: new Date(a, m, 1, 0, 0, 0), fim: new Date(a, m + 1, 0, 23, 59, 59) };
    }
    if (periodo === 'trimestre') {
      const q = Math.floor(agora.getMonth() / 3);
      return { inicio: new Date(agora.getFullYear(), q * 3, 1, 0, 0, 0), fim: new Date(agora.getFullYear(), q * 3 + 3, 0, 23, 59, 59) };
    }
    if (periodo === 'semestre') {
      const s = agora.getMonth() < 6 ? 0 : 6;
      return { inicio: new Date(agora.getFullYear(), s, 1, 0, 0, 0), fim: new Date(agora.getFullYear(), s + 6, 0, 23, 59, 59) };
    }
    if (periodo === 'ano') {
      return { inicio: new Date(agora.getFullYear(), 0, 1, 0, 0, 0), fim: new Date(agora.getFullYear(), 11, 31, 23, 59, 59) };
    }
    return { inicio: new Date(agora.getFullYear(), agora.getMonth(), 1), fim: agora };
  };

  const { inicio, fim } = getRange();
  const inicioTs = inicio.getTime();
  const fimTs = fim.getTime();

  const vendasPeriodo = vendas.filter(v => v.timestamp >= inicioTs && v.timestamp <= fimTs);
  const comprasPeriodo = compras.filter(c => c.timestamp >= inicioTs && c.timestamp <= fimTs);

  const isNoPeriodo = (dataStr?: string): boolean => {
    if (!dataStr) return false;
    const d = new Date(dataStr + 'T00:00:00').getTime();
    return d >= inicioTs && d <= fimTs;
  };

  const despesasPagas = contasPagar.filter(c => c.status === 'Pago' && isNoPeriodo(c.dataPagamento || c.vencimento));
  const outrasReceitas = contasReceber.filter(c => c.status === 'Recebido' && isNoPeriodo(c.dataPagamento || c.vencimento));

  // Receita Bruta das vendas
  const receitaBruta = vendasPeriodo.reduce((acc, v) => acc + (v.valor || 0), 0);
  const descontosVendas = vendasPeriodo.reduce((acc, v) => acc + (v.desconto || 0), 0);
  const receitaLiquida = receitaBruta - descontosVendas;

  // CMV — custo dos ingredientes registrados nas vendas
  const cmv = vendasPeriodo.reduce((acc, v) => acc + ((v.valor || 0) - (v.valorLiquido || v.valor || 0)), 0);
  const lucroBruto = receitaLiquida - cmv;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;

  // Despesas operacionais por categoria
  const despesasPorCategoria: Record<string, number> = {};
  despesasPagas.forEach(d => {
    const cat = d.tipo || 'Outros';
    despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + d.valor;
  });
  const totalDespesasOp = Object.values(despesasPorCategoria).reduce((a, b) => a + b, 0);

  // Compras de reabastecimento
  const totalCompras = comprasPeriodo.reduce((acc, c) => acc + (c.custoTotal || 0), 0);

  // Outras receitas não-operacionais
  const totalOutrasReceitas = outrasReceitas.reduce((acc, c) => acc + (c.valor || 0), 0);

  const ebitda = lucroBruto - totalDespesasOp;
  const lucroLiquido = ebitda + totalOutrasReceitas;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

  // Evolução mensal (últimos 6 meses)
  const evolucaoMensal = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const ini = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const fim2 = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
    const recMes = vendas.filter(v => v.timestamp >= ini && v.timestamp <= fim2).reduce((acc, v) => acc + (v.valor || 0), 0);
    const despMes = contasPagar.filter(c => c.status === 'Pago' && isNoPeriodo(c.dataPagamento || c.vencimento) && new Date((c.dataPagamento || c.vencimento) + 'T00:00:00').getTime() >= ini && new Date((c.dataPagamento || c.vencimento) + 'T00:00:00').getTime() <= fim2).reduce((acc, c) => acc + c.valor, 0);
    return { mes: `${MESES[d.getMonth()].substring(0,3)}/${d.getFullYear().toString().substring(2)}`, receita: recMes, despesas: despMes, lucro: recMes - despMes };
  });

  const exportarDRE = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('DRE');

    const LARANJA = 'FFFF6B00';
    const CINZA_HEADER = 'FF374151';
    const BRANCO = 'FFFFFFFF';
    const CINZA_CLARO = 'FFF9FAFB';
    const VERDE_CLARO = 'FFD1FAE5';
    const CINZA_LINHA = 'FFE5E7EB';

    ws.mergeCells('A1:C1');
    const titulo = ws.getCell('A1');
    titulo.value = '🍔 ArttBurger — Demonstração do Resultado (DRE)';
    titulo.font = { bold: true, size: 14, color: { argb: BRANCO } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.mergeCells('A2:C2');
    const subtitulo = ws.getCell('A2');
    subtitulo.value = `Período: ${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')} · Gerado em ${new Date().toLocaleString('pt-BR')}`;
    subtitulo.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    subtitulo.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const colunas = [
      { header: 'ITEM', key: 'item', width: 45 },
      { header: 'VALOR (R$)', key: 'valor', width: 20 },
      { header: '% RECEITA', key: 'pct', width: 15 },
    ];
    ws.columns = colunas;

    const headerRow = ws.getRow(4);
    colunas.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: LARANJA } } };
    });
    headerRow.height = 28;

    const addRow = (item: string, valor: number | string, pct: string, isBold: boolean, isTitle: boolean, color?: string, bg?: string) => {
      const row = ws.addRow([item, valor, pct]);
      row.height = isTitle ? 24 : 20;
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.font = { bold: isBold, size: isTitle ? 11 : 10, color: { argb: color || 'FF374151' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg || BRANCO } };
        cell.border = { bottom: { style: 'thin', color: { argb: CINZA_LINHA } } };
        cell.alignment = { vertical: 'middle' };
        if (c === 2 && typeof valor === 'number') {
          cell.numFmt = '"R$ "#,##0.00;[Red]"-R$ "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
        if (c === 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    };

    addRow('(+) Receita Bruta de Vendas', receitaBruta, '', false, false);
    addRow('(-) Descontos / Cancelamentos', descontosVendas > 0 ? -descontosVendas : 0, '', false, false);
    addRow('(=) RECEITA LÍQUIDA', receitaLiquida, '100.0%', true, true, 'FF047857', VERDE_CLARO);
    addRow('(-) Custo das Mercadorias Vendidas (CMV)', -cmv, receitaLiquida > 0 ? `${((cmv/receitaLiquida)*100).toFixed(1)}%` : '-', false, false, 'FFDC2626', 'FFFEE2E2');
    addRow('(=) LUCRO BRUTO', lucroBruto, receitaLiquida > 0 ? `${margemBruta.toFixed(1)}%` : '-', true, true, lucroBruto >= 0 ? 'FF1D4ED8' : 'FFDC2626', CINZA_CLARO);
    addRow('(-) Despesas Operacionais', -totalDespesasOp, receitaLiquida > 0 ? `${((totalDespesasOp/receitaLiquida)*100).toFixed(1)}%` : '-', false, false, 'FFDC2626', 'FFFEE2E2');
    
    Object.entries(despesasPorCategoria).forEach(([cat, val]) => {
      addRow(`   • ${cat}`, -val, '', false, false);
    });

    addRow('(=) EBITDA / RESULTADO OPERACIONAL', ebitda, receitaLiquida > 0 ? `${((ebitda/receitaLiquida)*100).toFixed(1)}%` : '-', true, true, ebitda >= 0 ? 'FF4338CA' : 'FFDC2626', CINZA_CLARO);
    if (totalOutrasReceitas > 0) {
      addRow('(+) Outras Receitas', totalOutrasReceitas, '', false, false, 'FF0D9488');
    }
    addRow('(=) LUCRO LÍQUIDO', lucroLiquido, receitaLiquida > 0 ? `${margemLiquida.toFixed(1)}%` : '-', true, true, lucroLiquido >= 0 ? 'FF065F46' : 'FF991B1B', lucroLiquido >= 0 ? 'FFD1FAE5' : 'FFFEE2E2');

    ws.addRow([]);
    const infoHeader = ws.addRow(['INFORMAÇÕES COMPLEMENTARES']);
    infoHeader.getCell(1).font = { bold: true, color: { argb: BRANCO } };
    infoHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
    ws.mergeCells(`A${infoHeader.number}:C${infoHeader.number}`);

    addRow('Compras/Reabastecimento no período', totalCompras, '', false, false);
    addRow('Qtd de vendas', vendasPeriodo.length, '', false, false);
    addRow('Ticket Médio', vendasPeriodo.length > 0 ? receitaBruta / vendasPeriodo.length : 0, '', false, false);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `DRE_${inicio.toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pct = (val: number) => receitaLiquida > 0 ? `${((val / receitaLiquida) * 100).toFixed(1)}%` : '-';

  const LinhaResultado = ({ label, valor, corValor, bold, indent, pctVal, subLabel }: any) => (
    <div className={`flex items-center justify-between py-2.5 px-4 ${bold ? 'bg-gray-50 rounded-lg' : ''}`} style={{ paddingLeft: indent ? `${indent * 20 + 16}px` : undefined }}>
      <div className="flex-1">
        <span className={`text-sm ${bold ? 'font-black text-gray-800' : 'text-gray-600'}`}>{label}</span>
        {subLabel && <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>}
      </div>
      <div className="flex items-center gap-6 ml-4">
        {pctVal !== undefined && (
          <span className="text-xs text-gray-400 w-14 text-right">{pctVal}</span>
        )}
        <span className={`font-bold text-sm w-28 text-right ${corValor || (valor < 0 ? 'text-red-600' : bold ? 'text-gray-800' : 'text-gray-700')}`}>
          {valor < 0 ? '-' : ''}R$ {Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );

  const maxEvolucao = Math.max(...evolucaoMensal.map(m => m.receita), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
            <BarChart2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">DRE — Demonstração do Resultado</h3>
            <p className="text-sm text-gray-500">Análise financeira completa de receitas, custos e lucros.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl flex-wrap gap-1">
            {([['mes_atual','Mês Atual'],['mes_anterior','Mês Anterior'],['trimestre','Trimestre'],['semestre','Semestre'],['ano','Este Ano'],['personalizado','Personalizado']] as [Periodo, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setPeriodo(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodo === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{l}</button>
            ))}
          </div>
          {periodo === 'personalizado' && (
            <div className="flex items-center gap-2">
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <span className="text-gray-400 text-sm">até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          <button onClick={exportarDRE} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 font-medium px-1">
        Período: <span className="text-gray-600 font-bold">{inicio.toLocaleDateString('pt-BR')} a {fim.toLocaleDateString('pt-BR')}</span>
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Bruta', valor: receitaBruta, cor: 'text-green-600', bg: 'bg-green-50', icon: <TrendingUp size={18} className="text-green-500"/>, sub: `${vendasPeriodo.length} vendas` },
          { label: 'Lucro Bruto', valor: lucroBruto, cor: lucroBruto >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-50', icon: <DollarSign size={18} className="text-blue-500"/>, sub: `Margem ${margemBruta.toFixed(1)}%` },
          { label: 'Despesas Op.', valor: -totalDespesasOp, cor: 'text-orange-600', bg: 'bg-orange-50', icon: <TrendingDown size={18} className="text-orange-500"/>, sub: `${despesasPagas.length} lançamentos` },
          { label: 'Lucro Líquido', valor: lucroLiquido, cor: lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700', bg: lucroLiquido >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: <PieChart size={18} className={lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-500'}/>, sub: `Margem ${margemLiquida.toFixed(1)}%` },
        ].map((k, i) => (
          <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
              <div className={`p-1.5 rounded-lg ${k.bg}`}>{k.icon}</div>
            </div>
            <p className={`text-2xl font-black ${k.cor}`}>
              {k.valor < 0 ? '-' : ''}R$ {Math.abs(k.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE Estruturado */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <Receipt size={18} className="text-emerald-500"/>
            <h4 className="font-bold text-gray-800">Resultado Estruturado</h4>
          </div>
          <div className="p-4 space-y-1">
            <LinhaResultado label="(+) Receita Bruta de Vendas" valor={receitaBruta} corValor="text-green-600" pctVal="" />
            {descontosVendas > 0 && <LinhaResultado label="(-) Descontos / Cancelamentos" valor={-descontosVendas} indent={1} pctVal="" />}
            <div className="border-t border-gray-200 my-1"/>
            <LinhaResultado label="(=) RECEITA LÍQUIDA" valor={receitaLiquida} corValor="text-green-700" bold pctVal="100,0%" />
            <LinhaResultado label="(-) Custo das Mercadorias (CMV)" valor={-cmv} corValor="text-red-500" indent={1} pctVal={pct(cmv)} subLabel="Custo dos ingredientes das vendas" />
            <div className="border-t border-gray-200 my-1"/>
            <LinhaResultado label="(=) LUCRO BRUTO" valor={lucroBruto} corValor={lucroBruto >= 0 ? 'text-blue-700' : 'text-red-600'} bold pctVal={pct(lucroBruto)} />

            <div className="mt-3">
              <button onClick={() => setExpandido(p => ({ ...p, despesas: !p.despesas }))} className="w-full flex items-center justify-between py-2 px-4 hover:bg-gray-50 rounded-lg transition-colors">
                <span className="text-sm text-gray-600 font-medium">(-) Despesas Operacionais</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">{pct(totalDespesasOp)}</span>
                  <span className="font-bold text-sm text-orange-600 w-28 text-right">- R$ {totalDespesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </button>
              {expandido.despesas && Object.entries(despesasPorCategoria).map(([cat, val]) => (
                <LinhaResultado key={cat} label={`• ${cat}`} valor={-val} indent={2} pctVal={pct(val)} />
              ))}
              {expandido.despesas && Object.keys(despesasPorCategoria).length === 0 && (
                <p className="text-xs text-gray-400 pl-8 py-2">Nenhuma despesa paga no período.</p>
              )}
            </div>

            <div className="border-t border-gray-200 my-1"/>
            <LinhaResultado label="(=) EBITDA / RESULTADO OPERACIONAL" valor={ebitda} corValor={ebitda >= 0 ? 'text-indigo-700' : 'text-red-600'} bold pctVal={pct(ebitda)} />

            {totalOutrasReceitas > 0 && <LinhaResultado label="(+) Outras Receitas (Contas a Receber)" valor={totalOutrasReceitas} corValor="text-teal-600" indent={1} pctVal="" />}

            <div className="border-t-2 border-gray-300 my-2"/>
            <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${lucroLiquido >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <span className={`font-black text-base ${lucroLiquido >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>(=) LUCRO LÍQUIDO</span>
              <div className="flex items-center gap-6">
                <span className={`text-sm font-bold ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margemLiquida.toFixed(1)}%</span>
                <span className={`font-black text-lg w-28 text-right ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {lucroLiquido < 0 ? '-' : ''}R$ {Math.abs(lucroLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico evolução + indicadores */}
        <div className="space-y-4">
          {/* Evolução mensal */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar size={18} className="text-indigo-500"/>
              <h4 className="font-bold text-gray-800">Evolução — Últimos 6 Meses</h4>
            </div>
            <div className="space-y-3">
              {evolucaoMensal.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-600 w-16">{m.mes}</span>
                    <div className="flex gap-4">
                      <span className="text-green-600 font-bold">R$ {m.receita.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                      <span className={`font-bold ${m.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.lucro >= 0 ? '+' : ''}R$ {m.lucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-green-400 rounded-full transition-all duration-700" style={{ width: `${(m.receita / maxEvolucao) * 100}%` }} />
                    {m.despesas > 0 && <div className="absolute inset-y-0 left-0 bg-orange-300 rounded-full opacity-70 transition-all duration-700" style={{ width: `${(m.despesas / maxEvolucao) * 100}%` }} />}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-400 rounded-sm inline-block"/>Receita</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-300 rounded-sm inline-block"/>Despesas</span>
              </div>
            </div>
          </div>

          {/* Indicadores adicionais */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Package size={18} className="text-purple-500"/>
              <h4 className="font-bold text-gray-800">Indicadores do Período</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ticket Médio', valor: vendasPeriodo.length > 0 ? receitaBruta / vendasPeriodo.length : 0, prefix: 'R$ ' },
                { label: 'Qtd de Vendas', valor: vendasPeriodo.length, prefix: '', suffix: ' pedidos' },
                { label: 'CMV %', valor: receitaLiquida > 0 ? (cmv / receitaLiquida) * 100 : 0, prefix: '', suffix: '%' },
                { label: 'Compras (Reabast.)', valor: totalCompras, prefix: 'R$ ' },
              ].map((ind, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-1">{ind.label}</p>
                  <p className="text-lg font-black text-gray-800">
                    {ind.prefix}{typeof ind.valor === 'number' ? (ind.suffix === '%' ? ind.valor.toFixed(1) : ind.suffix === ' pedidos' ? ind.valor : ind.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })) : ind.valor}{ind.suffix || ''}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Despesas por categoria */}
          {Object.keys(despesasPorCategoria).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h4 className="font-bold text-gray-800 mb-3">Despesas por Categoria</h4>
              <div className="space-y-2">
                {Object.entries(despesasPorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">{cat}</span>
                      <span className="font-bold text-orange-600">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${totalDespesasOp > 0 ? (val / totalDespesasOp) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
