import { useState, useEffect } from 'react';
import { ref, onValue, set, push, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Scale, Save, Download, CalendarClock, CheckCircle, Search, Settings, X, RefreshCw, ChevronUp, ChevronDown, FileText, History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';
import CalculadoraFlutuante from './CalculadoraFlutuante';
import ExcelJS from 'exceljs';
import { loadDraft, saveDraft, clearDraft } from '../hooks/useDraftCache';

interface HistoricoItem {
  id: string;
  insumoId: string;
  nome: string;
  unidade: string;
  tipo: string;
  detalhe?: string;
  qtdAntiga: number;
  qtdNova: number;
  precoUnitario: number;
  valorAntigo: number;
  valorNovo: number;
  timestamp: number;
}

interface RegistroBalanco {
  id: string;
  timestamp: number;
  funcionarioId: string;
  funcionarioNome: string;
  itens: HistoricoItem[];
  totalDiferencaValor: number;
}

export default function BalancoManager({ currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [novosEstoques, setNovosEstoques] = useState<Record<string, string>>({});
  const [novosCustos, setNovosCustos] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'estacionado' | 'rotativo'>('estacionado');
  const [filtroVencimento, setFiltroVencimento] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [modalResumo, setModalResumo] = useState<HistoricoItem[] | null>(null);
  const [historicoRegistros, setHistoricoRegistros] = useState<RegistroBalanco[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [registroExpandido, setRegistroExpandido] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadDraft<{novosEstoques: any, novosCustos: any, editMode: any}>('balanco', currentUser?.id);
    if (draft) {
      if (draft.novosEstoques) setNovosEstoques(draft.novosEstoques);
      if (draft.novosCustos) setNovosCustos(draft.novosCustos);
      if (draft.editMode) setEditMode(draft.editMode);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const isEmpty = Object.keys(novosEstoques).length === 0 && Object.keys(novosCustos).length === 0 && Object.keys(editMode).length === 0;
    if (isEmpty) {
      clearDraft('balanco', currentUser?.id);
    } else {
      saveDraft('balanco', currentUser?.id, { novosEstoques, novosCustos, editMode });
    }
  }, [novosEstoques, novosCustos, editMode, currentUser?.id]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  useEffect(() => {
    const hRef = ref(db, 'historico_balancos');
    return onValue(hRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) as RegistroBalanco[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        setHistoricoRegistros(list);
      } else {
        setHistoricoRegistros([]);
      }
    });
  }, []);

  const handleToggleEdit = (key: string) => {
    setEditMode(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cancelarEdicao = (key: string) => {
    setEditMode(prev => { const n = {...prev}; delete n[key]; return n; });
    setNovosEstoques(prev => { const n = {...prev}; delete n[key]; return n; });
    setNovosCustos(prev => { const n = {...prev}; delete n[key]; return n; });
  };

  const handleSalvarTudo = async () => {
    const chavesPendentes = Array.from(new Set([...Object.keys(novosEstoques), ...Object.keys(novosCustos)]));
    if (chavesPendentes.length === 0) return;

    const insumosAfetados = new Set(chavesPendentes.map(k => k.split('|')[0]));
    const novosHistoricos: HistoricoItem[] = [];

    for (const insumoId of insumosAfetados) {
      const insumo = insumos.find(i => i.id === insumoId);
      if (!insumo) continue;

      const precoUnitario = Number(insumo.precoPacote || 0) / Number(insumo.qtdPacote || 1);

      const insumoRef = ref(db, `insumos/${insumoId}`);
      await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          const rotKey = `${insumoId}|rot`;
          if (novosEstoques[rotKey] !== undefined && novosEstoques[rotKey] !== '') {
            const qtdAntiga = Number(insumo.estoqueRotativo ?? 0);
            const qtdNova = Number(Number(novosEstoques[rotKey]).toFixed(4));
            currentData.estoqueRotativo = qtdNova;
            novosHistoricos.push({
              id: Math.random().toString(36),
              insumoId, nome: insumo.nome, unidade: insumo.unidade,
              tipo: 'Rotativo', qtdAntiga, qtdNova, precoUnitario,
              valorAntigo: qtdAntiga * precoUnitario,
              valorNovo: qtdNova * precoUnitario,
              timestamp: Date.now()
            });
          }

          const legadoKey = `${insumoId}|legado`;
          const novoValorLegado = novosEstoques[legadoKey];
          const novoCustoLegado = novosCustos[legadoKey];
          let estUpdate = false;

          if (novoValorLegado !== undefined && novoValorLegado !== '') {
            const qtdAntiga = Number(insumo.estoqueEstacionario ?? 0);
            const qtdNova = Number(Number(novoValorLegado).toFixed(4));
            currentData.estoqueEstacionario = qtdNova;
            if (qtdNova === 0) { currentData.validade = null; currentData.lote = null; }
            estUpdate = true;
            const valNovo = novoCustoLegado !== undefined && novoCustoLegado !== '' ? Number(novoCustoLegado) : qtdNova * precoUnitario;
            novosHistoricos.push({
              id: Math.random().toString(36),
              insumoId, nome: insumo.nome, unidade: insumo.unidade,
              tipo: 'Estacionado', detalhe: 'Geral (Sem Lote)', qtdAntiga, qtdNova, precoUnitario,
              valorAntigo: qtdAntiga * precoUnitario, valorNovo: valNovo,
              timestamp: Date.now()
            });
          }

          if (novoCustoLegado !== undefined && novoCustoLegado !== '') {
            const estacionario = novoValorLegado !== undefined && novoValorLegado !== '' ? Number(novoValorLegado) : Number(currentData.estoqueEstacionario ?? 0);
            const qtdPacote = Number(currentData.qtdPacote || 1);
            const totalVols = estacionario / qtdPacote;
            currentData.precoPacote = totalVols > 0 ? Number((Number(novoCustoLegado) / totalVols).toFixed(4)) : 0;
            if (!estUpdate) {
              const qtdA = estacionario;
              novosHistoricos.push({
                id: Math.random().toString(36),
                insumoId, nome: insumo.nome, unidade: insumo.unidade,
                tipo: 'Estacionado', detalhe: 'Geral (Sem Lote)', qtdAntiga: qtdA, qtdNova: qtdA, precoUnitario,
                valorAntigo: qtdA * precoUnitario, valorNovo: Number(novoCustoLegado),
                timestamp: Date.now()
              });
            }
          }

          if (currentData.lotes) {
            let novoEstacionarioCalculado = Number(Number(currentData.estoqueEstacionario ?? 0).toFixed(4));
            let atualizouLotes = false;

            for (const loteId in currentData.lotes) {
              const key = `${insumoId}|${loteId}`;
              const nEstoque = novosEstoques[key];
              const nCusto = novosCustos[key];

              if ((nEstoque !== undefined && nEstoque !== '') || (nCusto !== undefined && nCusto !== '')) {
                const qtdAntiga = Number(Number(currentData.lotes[loteId].quantidade || 0).toFixed(4));
                const valAntigo = Number((currentData.lotes[loteId] as any).valorTotalLote || qtdAntiga * precoUnitario);

                let qtdNova = qtdAntiga;
                let valNovo = valAntigo;

                if (nEstoque !== undefined && nEstoque !== '') {
                  qtdNova = Number(Number(nEstoque).toFixed(4));
                  currentData.lotes[loteId].quantidade = qtdNova;
                  novoEstacionarioCalculado = Number(Math.max(0, novoEstacionarioCalculado - qtdAntiga + qtdNova).toFixed(4));
                  atualizouLotes = true;
                }

                if (nCusto !== undefined && nCusto !== '') {
                  valNovo = Number(nCusto);
                  (currentData.lotes[loteId] as any).valorTotalLote = valNovo;
                  atualizouLotes = true;
                }

                novosHistoricos.push({
                  id: Math.random().toString(36),
                  insumoId, nome: insumo.nome, unidade: insumo.unidade,
                  tipo: 'Estacionado', detalhe: currentData.lotes[loteId].lote || 'N/A',
                  qtdAntiga, qtdNova, precoUnitario, valorAntigo: valAntigo, valorNovo: valNovo,
                  timestamp: Date.now()
                });

                if (qtdNova === 0) delete currentData.lotes[loteId];
              }
            }

            if (atualizouLotes) {
              currentData.estoqueEstacionario = novoEstacionarioCalculado;
              let totalValorLotes = 0;
              let totalQtdLotes = 0;
              Object.values(currentData.lotes || {}).forEach((l: any) => {
                totalValorLotes += Number(l.valorTotalLote || 0);
                totalQtdLotes += Number(l.quantidade || 0);
              });
              const qtdPacote = Number(currentData.qtdPacote || 1);
              const totalVols = totalQtdLotes / qtdPacote;
              currentData.precoPacote = totalVols > 0 ? Number((totalValorLotes / totalVols).toFixed(4)) : 0;
            }
          }
        }
        return currentData;
      });
    }

    if (novosHistoricos.length > 0) {
      const totalDif = novosHistoricos.reduce((acc, h) => acc + (h.valorNovo - h.valorAntigo), 0);
      const registroRef = push(ref(db, 'historico_balancos'));
      await set(registroRef, {
        timestamp: Date.now(),
        funcionarioId: currentUser?.id || '',
        funcionarioNome: currentUser?.nome || 'Sistema',
        itens: novosHistoricos,
        totalDiferencaValor: totalDif,
      });

      setModalResumo(novosHistoricos);
    }

    showToast(`Balanço de ${insumosAfetados.size} insumo(s) salvo com sucesso!`, 'success');
    setNovosEstoques({});
    setNovosCustos({});
    setEditMode({});
    clearDraft('balanco', currentUser?.id);
  };

  const isProximoVencimento = (insumo: Insumo) => {
    const diasAviso = insumo.diasAvisoValidade !== undefined ? insumo.diasAvisoValidade : 7;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (insumo.lotes) {
      return Object.values(insumo.lotes).some((l: any) => l.validade && (new Date(`${l.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso);
    } else if (insumo.validade) {
      return (new Date(`${insumo.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso;
    }
    return false;
  };

  const isGestor = currentUser && (
    Array.isArray(currentUser.cargo)
      ? currentUser.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c))
      : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(currentUser.cargo as string)
  );

  const insumosPermitidos = insumos.filter(i => isGestor || !(i as any).restrito);
  const tiposExistentes = Array.from(new Set(insumosPermitidos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const insumosExibidos = insumosPermitidos.filter(i => {
    const matchSearch = searchTerm ? normalizeString(i.nome).includes(normalizeString(searchTerm)) || normalizeString((i as any).sku).includes(normalizeString(searchTerm)) : true;
    const matchVencimento = filtroVencimento ? isProximoVencimento(i) : true;
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchVencimento && matchTipo;
  });

  const sortedInsumosExibidos = [...insumosExibidos].sort((a, b) => {
    if (!sortConfig) return a.nome.localeCompare(b.nome);
    const { key, direction } = sortConfig;
    let valA: any = '';
    let valB: any = '';
    if (key === 'nome') { valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase(); }
    else if (key === 'estoque') {
      if (activeTab === 'estacionado') { valA = Number(a.estoqueEstacionario ?? 0); valB = Number(b.estoqueEstacionario ?? 0); }
      else { valA = Number(a.estoqueRotativo ?? 0); valB = Number(b.estoqueRotativo ?? 0); }
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const exportarExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ArttBurger';
    wb.created = new Date();
    const ws = wb.addWorksheet('Estoque Atual');

    const LARANJA = 'FFFF6B00';
    const CINZA_HEADER = 'FF374151';
    const BRANCO = 'FFFFFFFF';
    const CINZA_CLARO = 'FFF9FAFB';
    const CINZA_LINHA = 'FFE5E7EB';

    ws.mergeCells('A1:G1');
    const titulo = ws.getCell('A1');
    titulo.value = '🍔 ArttBurger — Relatório de Estoque';
    titulo.font = { bold: true, size: 14, color: { argb: BRANCO } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.mergeCells('A2:G2');
    const subtitulo = ws.getCell('A2');
    subtitulo.value = `Gerado em ${new Date().toLocaleString('pt-BR')}`;
    subtitulo.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    subtitulo.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const colunas = [
      { header: 'Insumo', key: 'nome', width: 30 },
      { header: 'Unidade', key: 'unidade', width: 10 },
      { header: 'Estoque Rotativo', key: 'rotativo', width: 18 },
      { header: 'Estoque Estacionado', key: 'estacionado', width: 22 },
      { header: 'Preço Unitário (R$)', key: 'preco', width: 20 },
      { header: 'Valor Total Rot. (R$)', key: 'valorRot', width: 22 },
      { header: 'Valor Total Est. (R$)', key: 'valorEst', width: 22 },
    ];
    ws.columns = colunas.map(c => ({ key: c.key, width: c.width }));

    const headerRow = ws.getRow(4);
    colunas.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: LARANJA } } };
    });
    headerRow.height = 28;

    let totalValorRot = 0, totalValorEst = 0;

    insumosExibidos.forEach((insumo, idx) => {
      const precoUnit = Number(insumo.precoPacote || 0) / Number(insumo.qtdPacote || 1);
      const rot = Number(insumo.estoqueRotativo ?? 0);
      const est = Number(insumo.estoqueEstacionario ?? 0);
      const vRot = rot * precoUnit;
      const vEst = est * precoUnit;
      totalValorRot += vRot;
      totalValorEst += vEst;

      const rowIdx = 5 + idx;
      const row = ws.getRow(rowIdx);
      row.values = ['', insumo.unidade, rot, est, precoUnit, vRot, vEst];
      const nomeCell = row.getCell(1);
      nomeCell.value = insumo.nome;
      nomeCell.font = { bold: true, size: 10 };

      const bgColor = idx % 2 === 0 ? BRANCO : CINZA_CLARO;
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = { bottom: { style: 'thin', color: { argb: CINZA_LINHA } } };
        cell.alignment = { vertical: 'middle' };
        if (c >= 3) {
          cell.numFmt = c >= 5 ? 'R$ #,##0.000' : '#,##0.000';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      }
      row.height = 20;
    });

    const totalRowIdx = 5 + insumosExibidos.length;
    const totalRow = ws.getRow(totalRowIdx);
    totalRow.values = ['TOTAL GERAL', '', '', '', '', totalValorRot, totalValorEst];
    for (let c = 1; c <= 7; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.border = { top: { style: 'medium', color: { argb: LARANJA } } };
      cell.alignment = { vertical: 'middle' };
      if (c >= 6) { cell.numFmt = 'R$ #,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
    }
    totalRow.height = 24;

    ws.autoFilter = { from: 'A4', to: 'G4' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarResumoExcel = async (itens: HistoricoItem[], dataBalanco?: number) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ArttBurger';
    wb.created = new Date();
    const ws = wb.addWorksheet('Balanço de Estoque');

    const LARANJA = 'FFFF6B00';
    const VERDE = 'FF059669';
    const VERMELHO = 'FFDC2626';
    const CINZA_HEADER = 'FF374151';
    const BRANCO = 'FFFFFFFF';
    const CINZA_CLARO = 'FFF9FAFB';
    const CINZA_LINHA = 'FFE5E7EB';
    const VERDE_CLARO = 'FFD1FAE5';
    const VERMELHO_CLARO = 'FFFEE2E2';

    const totalValorAntes = itens.reduce((acc, h) => acc + h.valorAntigo, 0);
    const totalValorDepois = itens.reduce((acc, h) => acc + h.valorNovo, 0);
    const totalDif = totalValorDepois - totalValorAntes;

    ws.mergeCells('A1:I1');
    const titulo = ws.getCell('A1');
    titulo.value = '🍔 ArttBurger — Balanço de Estoque';
    titulo.font = { bold: true, size: 14, color: { argb: BRANCO } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:I2');
    const dataCell = ws.getCell('A2');
    const dataStr = dataBalanco ? new Date(dataBalanco).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    dataCell.value = `Realizado em ${dataStr} · ${itens.length} item(ns) ajustado(s)`;
    dataCell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    dataCell.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;

    ws.mergeCells('A3:F3');
    ws.mergeCells('G3:G3');
    ws.mergeCells('H3:H3');
    ws.mergeCells('I3:I3');

    const resumoLabel = ws.getCell('A3');
    resumoLabel.value = 'RESUMO GERAL';
    resumoLabel.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
    resumoLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    resumoLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    const valAntesCel = ws.getCell('G3');
    valAntesCel.value = totalValorAntes;
    valAntesCel.numFmt = '"R$ "#,##0.00';
    valAntesCel.font = { bold: true, size: 10, color: { argb: '44374151' } };
    valAntesCel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    valAntesCel.alignment = { horizontal: 'right', vertical: 'middle' };

    const valDepoisCel = ws.getCell('H3');
    valDepoisCel.value = totalValorDepois;
    valDepoisCel.numFmt = '"R$ "#,##0.00';
    valDepoisCel.font = { bold: true, size: 10 };
    valDepoisCel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    valDepoisCel.alignment = { horizontal: 'right', vertical: 'middle' };

    const difGeralCel = ws.getCell('I3');
    difGeralCel.value = totalDif;
    difGeralCel.numFmt = '"R$ "#,##0.00;[Red]"-R$ "#,##0.00';
    difGeralCel.font = { bold: true, size: 12, color: { argb: totalDif >= 0 ? VERDE : VERMELHO } };
    difGeralCel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalDif >= 0 ? VERDE_CLARO : VERMELHO_CLARO } };
    difGeralCel.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(3).height = 26;

    ws.addRow([]);

    const colunas = [
      { header: 'Insumo', width: 28 },
      { header: 'Tipo / Lote', width: 20 },
      { header: 'Qtd Antes', width: 14 },
      { header: 'Qtd Depois', width: 14 },
      { header: 'Diferença Qtd', width: 16 },
      { header: 'Unidade', width: 10 },
      { header: 'Valor Antes (R$)', width: 18 },
      { header: 'Valor Depois (R$)', width: 18 },
      { header: 'Diferença (R$)', width: 18 },
    ];
    ws.columns = colunas.map((c, i) => ({ key: String(i), width: c.width }));

    const headerRow = ws.getRow(5);
    colunas.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: LARANJA } } };
    });
    headerRow.height = 30;

    const itensSorted = [...itens].sort((a, b) => a.nome.localeCompare(b.nome));

    itensSorted.forEach((h, idx) => {
      const difQtd = h.qtdNova - h.qtdAntiga;
      const difVal = h.valorNovo - h.valorAntigo;
      const rowIdx = 6 + idx;
      const row = ws.getRow(rowIdx);

      row.values = [
        h.nome,
        h.tipo + (h.detalhe ? ` (${h.detalhe})` : ''),
        h.qtdAntiga,
        h.qtdNova,
        difQtd,
        h.unidade,
        h.valorAntigo,
        h.valorNovo,
        difVal,
      ];

      const bgBase = idx % 2 === 0 ? BRANCO : CINZA_CLARO;

      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.border = { bottom: { style: 'thin', color: { argb: CINZA_LINHA } } };
        cell.alignment = { vertical: 'middle' };

        if (c === 1) { cell.font = { bold: true, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 2) { cell.font = { size: 9, color: { argb: 'FF6B7280' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 3) { cell.numFmt = '#,##0.000'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 10, color: { argb: 'FF6B7280' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 4) { cell.numFmt = '#,##0.000'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { bold: true, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 5) {
          cell.numFmt = '+#,##0.000;-#,##0.000;"-"';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { bold: true, size: 10, color: { argb: difQtd > 0 ? VERDE : difQtd < 0 ? VERMELHO : 'FF9CA3AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: difQtd > 0 ? VERDE_CLARO : difQtd < 0 ? VERMELHO_CLARO : bgBase } };
        }
        else if (c === 6) { cell.font = { size: 9, color: { argb: 'FF6B7280' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 7) { cell.numFmt = '"R$ "#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 10, color: { argb: 'FF6B7280' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 8) { cell.numFmt = '"R$ "#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { bold: true, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } }; }
        else if (c === 9) {
          cell.numFmt = '"R$ "#,##0.00;[Red]"-R$ "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { bold: true, size: 10, color: { argb: difVal > 0 ? VERDE : difVal < 0 ? VERMELHO : 'FF9CA3AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: difVal > 0 ? VERDE_CLARO : difVal < 0 ? VERMELHO_CLARO : bgBase } };
        }
      }
      row.height = 22;
    });

    const totalRowIdx = 6 + itensSorted.length;
    const totalRow = ws.getRow(totalRowIdx);
    totalRow.values = ['TOTAL GERAL', '', '', '', '', '', totalValorAntes, totalValorDepois, totalDif];
    for (let c = 1; c <= 9; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { bold: true, size: 11, color: { argb: BRANCO } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.border = { top: { style: 'medium', color: { argb: LARANJA } } };
      cell.alignment = { vertical: 'middle' };
      if (c === 7 || c === 8) { cell.numFmt = '"R$ "#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      if (c === 9) {
        cell.numFmt = '"R$ "#,##0.00;[Red]"-R$ "#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { bold: true, size: 12, color: { argb: totalDif >= 0 ? 'FF6EE7B7' : 'FFFCA5A5' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      }
    }
    totalRow.height = 28;

    ws.autoFilter = { from: 'A5', to: 'I5' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];

    const dataFormatada = new Date(dataBalanco || Date.now()).toLocaleDateString('pt-BR').replace(/\//g, '-');
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balanco_${dataFormatada}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    const qtdFormatada = Number(qtd.toFixed(4));
    if (pacote <= 1) return <span>{qtdFormatada} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = Number((qtd % pacote).toFixed(4));
    if (vols === 0) return <span>{qtdFormatada} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtdFormatada} {unid})</span></span>;
  };

  const chavesPendentes = Array.from(new Set([...Object.keys(novosEstoques), ...Object.keys(novosCustos)]));

  const TabelaResumoBalanco = ({ itens, timestamp }: { itens: HistoricoItem[]; timestamp?: number }) => {
    const totalValorAntes = itens.reduce((acc, h) => acc + h.valorAntigo, 0);
    const totalValorDepois = itens.reduce((acc, h) => acc + h.valorNovo, 0);
    const totalDiferenca = totalValorDepois - totalValorAntes;

    return (
      <div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50 shadow-sm">
              <tr className="text-[10px] uppercase text-gray-500 font-bold tracking-wider border-b border-gray-200">
                <th className="px-3 py-3">Insumo</th>
                <th className="px-3 py-3">Tipo / Lote</th>
                <th className="px-3 py-3 text-right">Qtd Antes</th>
                <th className="px-3 py-3 text-right">Qtd Depois</th>
                <th className="px-3 py-3 text-right">Dif. Qtd</th>
                <th className="px-3 py-3 text-right">Preço Unit.</th>
                <th className="px-3 py-3 text-right">Valor Antes</th>
                <th className="px-3 py-3 text-right">Valor Depois</th>
                <th className="px-3 py-3 text-right">Dif. Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...itens].sort((a, b) => a.nome.localeCompare(b.nome)).map(h => {
                const difQtd = h.qtdNova - h.qtdAntiga;
                const difValor = h.valorNovo - h.valorAntigo;
                return (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-gray-800">{h.nome}</td>
                    <td className="px-3 py-2.5 text-gray-500">{h.tipo}{h.detalhe ? ` (${h.detalhe})` : ''}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{h.qtdAntiga.toFixed(3)} {h.unidade}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-indigo-600">{h.qtdNova.toFixed(3)} {h.unidade}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${difQtd > 0 ? 'text-emerald-600' : difQtd < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {difQtd > 0 ? '+' : ''}{difQtd.toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">R$ {h.precoUnitario.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">R$ {h.valorAntigo.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-800">R$ {h.valorNovo.toFixed(2)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${difValor > 0 ? 'text-emerald-600' : difValor < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {difValor > 0 ? '+' : ''}R$ {difValor.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-300">
              <tr>
                <td colSpan={6} className="px-3 py-3 font-black text-gray-800 text-sm uppercase tracking-wide">TOTAL GERAL</td>
                <td className="px-3 py-3 text-right font-black text-gray-600">R$ {totalValorAntes.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-black text-gray-800">R$ {totalValorDepois.toFixed(2)}</td>
                <td className={`px-3 py-3 text-right font-black text-lg ${totalDiferenca > 0 ? 'text-emerald-600' : totalDiferenca < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {totalDiferenca > 0 ? '+' : ''}R$ {totalDiferenca.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t border-gray-100 pt-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${totalDiferenca > 0 ? 'bg-emerald-50 text-emerald-700' : totalDiferenca < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
            {totalDiferenca > 0 ? <TrendingUp size={16}/> : totalDiferenca < 0 ? <TrendingDown size={16}/> : <Minus size={16}/>}
            Diferença total de estoque: {totalDiferenca > 0 ? '+' : ''}R$ {totalDiferenca.toFixed(2)}
          </div>
          <button onClick={() => exportarResumoExcel(itens, timestamp)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors">
            <Download size={15}/> Exportar Excel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 flex items-center">
          <div className="bg-purple-100 p-3 rounded-xl mr-4 text-purple-600">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Auditoria e Balanço de Estoque</h3>
            <p className="text-sm text-gray-500">Faça a contagem física e ajuste os valores desatualizados do sistema.</p>
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit mt-3">
              <button onClick={() => setActiveTab('estacionado')} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'estacionado' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Estacionado (Físico / Prateleira)</button>
              <button onClick={() => setActiveTab('rotativo')} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'rotativo' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Rotativo (Cozinha)</button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm w-56" />
          </div>
          <select value={filtroTipoUso} onChange={(e) => setFiltroTipoUso(e.target.value)} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white">
            <option value="">Todos os Tipos</option>
            {tiposExistentes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
          </select>
          <button onClick={() => setFiltroVencimento(!filtroVencimento)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors border flex items-center shadow-sm ${filtroVencimento ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            <CalendarClock size={18} className="mr-2" />{filtroVencimento ? 'Mostrar Todos' : 'Próximos do Vencimento'}
          </button>
          <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex items-center shadow-sm">
            <Download size={18} className="mr-2" /> Exportar Excel
          </button>
          <button onClick={() => setShowHistorico(!showHistorico)} className={`px-4 py-2 rounded-lg font-bold text-sm border flex items-center shadow-sm transition-colors ${showHistorico ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            <History size={18} className="mr-2" /> Histórico
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100 select-none">
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('nome')}><div className="flex items-center">Insumo {sortConfig?.key === 'nome' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                {activeTab === 'estacionado' ? (
                  <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('estoque')}><div className="flex items-center">Estoque Estacionado (Lotes / Físico) {sortConfig?.key === 'estoque' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                ) : (
                  <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('estoque')}><div className="flex items-center">Estoque Rotativo (Em uso na Cozinha) {sortConfig?.key === 'estoque' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedInsumosExibidos.map(i => {
                const rotativo = Number(i.estoqueRotativo ?? 0);
                const estacionario = Number(i.estoqueEstacionario ?? 0);
                return (
                  <tr key={i.id} className="hover:bg-gray-50 transition-colors text-sm">
                    <td className="px-6 py-4 font-medium text-gray-900 align-top w-1/3">
                      {i.nome}
                      <p className="text-xs font-mono text-gray-400 mt-1">{(i as any).sku || 'Sem SKU'}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600 align-top">
                      {activeTab === 'estacionado' ? (
                        i.lotes ? (
                          <div className="space-y-2">
                            {Object.entries(i.lotes || {}).map(([loteId, l]: [string, any], idx: number) => {
                              const key = `${i.id}|${loteId}`;
                              return (
                                <div key={idx} className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                                  <div className="flex-1">
                                    <span>{l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{l.lote && l.lote !== 'N/A' && ` (L: ${l.lote})`}</span>
                                    <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(Number(l.quantidade || 0), Number(i.qtdPacote || 1), i.unidade)}</span>
                                    {l.valorTotalLote !== undefined && <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">R$ {Number(l.valorTotalLote).toFixed(2)}</span>}
                                  </div>
                                  {!editMode[key] ? (
                                    <button onClick={() => handleToggleEdit(key)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                                      <input type="number" step="any" value={novosEstoques[key] !== undefined ? novosEstoques[key] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [key]: e.target.value})} placeholder={`Qtd (${l.quantidade})`} className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" title="Nova Quantidade" />
                                      <div className="relative" title="Novo Valor Total do Lote">
                                        <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                                        <input type="text" value={novosCustos[key] !== undefined ? (novosCustos[key] === '' ? '' : Number(novosCustos[key]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [key]: val}); }} placeholder={(l.valorTotalLote || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" />
                                      </div>
                                      <button onClick={() => cancelarEdicao(key)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors" title="Cancelar"><X size={14}/></button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : i.validade || i.lote ? (
                          <div className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                            <div className="flex-1">
                              <span className="text-gray-500">{i.validade ? new Date(`${i.validade}T00:00:00`).toLocaleDateString('pt-BR') : 'Estoque Geral (S/ Lote)'}{i.lote && i.lote !== 'N/A' && ` (L: ${i.lote})`}</span>
                              <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(estacionario, Number(i.qtdPacote || 1), i.unidade)}</span>
                            </div>
                            {!editMode[`${i.id}|legado`] ? (
                              <button onClick={() => handleToggleEdit(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                                <input type="number" step="any" value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} placeholder={`Qtd (${estacionario})`} className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" title="Nova Quantidade" />
                                <div className="relative" title="Novo Valor Total do Estoque">
                                  <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                                  <input type="text" value={novosCustos[`${i.id}|legado`] !== undefined ? (novosCustos[`${i.id}|legado`] === '' ? '' : Number(novosCustos[`${i.id}|legado`]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [`${i.id}|legado`]: val}); }} placeholder="Valor Total" className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" />
                                </div>
                                <button onClick={() => cancelarEdicao(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors" title="Cancelar"><X size={14} /></button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                            <div className="flex-1">
                              <span className="text-gray-500">Estoque Geral (Sem lote)</span>
                              <span className="font-bold ml-2 text-indigo-600">{formatarQtdJSX(estacionario, Number(i.qtdPacote || 1), i.unidade)}</span>
                            </div>
                            {!editMode[`${i.id}|legado`] ? (
                              <button onClick={() => handleToggleEdit(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                                <input type="number" step="any" value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} placeholder={`Qtd (${estacionario})`} className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" title="Nova Quantidade" />
                                <div className="relative" title="Novo Valor Total do Estoque">
                                  <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                                  <input type="text" value={novosCustos[`${i.id}|legado`] !== undefined ? (novosCustos[`${i.id}|legado`] === '' ? '' : Number(novosCustos[`${i.id}|legado`]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [`${i.id}|legado`]: val}); }} placeholder="Valor Total" className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" />
                                </div>
                                <button onClick={() => cancelarEdicao(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors" title="Cancelar"><X size={14} /></button>
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-bold text-orange-600">{formatarQtdJSX(rotativo, Number(i.qtdPacote || 1), i.unidade)}</span>
                          {!editMode[`${i.id}|rot`] ? (
                            <button onClick={() => handleToggleEdit(`${i.id}|rot`)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Editar"><Settings size={16}/></button>
                          ) : (
                            <div className="flex items-center space-x-1 animate-in fade-in zoom-in duration-200">
                              <input type="number" step="any" value={novosEstoques[`${i.id}|rot`] !== undefined ? novosEstoques[`${i.id}|rot`] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|rot`]: e.target.value})} placeholder={`Qtd (${rotativo})`} className="w-24 p-2 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-orange-500 text-sm" title="Nova Quantidade" />
                              <button onClick={() => cancelarEdicao(`${i.id}|rot`)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors" title="Cancelar"><X size={16}/></button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {chavesPendentes.length > 0 && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgb(0,0,0,0.1)] z-40 animate-in slide-in-from-bottom duration-300">
          <div className="w-full mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <p className="font-black text-gray-800 text-lg">{chavesPendentes.length} item(ns) alterado(s)</p>
              <p className="text-sm text-gray-500">Revise suas alterações e clique em Salvar para ver o resumo completo.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={() => { setNovosEstoques({}); setNovosCustos({}); setEditMode({}); }} className="flex-1 sm:flex-none px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleSalvarTudo} className="flex-1 sm:flex-none px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-sm hover:bg-green-700 transition-colors flex items-center justify-center">
                <Save size={18} className="mr-2"/> Salvar Balanço
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Balanços */}
      {showHistorico && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center gap-3">
            <History size={18} className="text-indigo-500"/>
            <h3 className="font-bold text-gray-800">Histórico de Balanços</h3>
          </div>
          {historicoRegistros.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nenhum balanço registrado ainda.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {historicoRegistros.map(reg => {
                const dif = reg.totalDiferencaValor;
                return (
                  <div key={reg.id}>
                    <button onClick={() => setRegistroExpandido(registroExpandido === reg.id ? null : reg.id)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-4">
                        <FileText size={16} className="text-gray-400"/>
                        <div>
                          <p className="font-bold text-sm text-gray-800">{new Date(reg.timestamp).toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-gray-500">{reg.funcionarioNome} · {reg.itens?.length || 0} item(ns) ajustado(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-black text-sm ${dif > 0 ? 'text-emerald-600' : dif < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {dif > 0 ? '+' : ''}R$ {dif.toFixed(2)}
                        </span>
                        {registroExpandido === reg.id ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                      </div>
                    </button>
                    {registroExpandido === reg.id && reg.itens && (
                      <div className="px-4 pb-4 bg-gray-50">
                        <TabelaResumoBalanco itens={reg.itens} timestamp={reg.timestamp} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Resumo Pós-Salvamento */}
      {modalResumo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2.5 rounded-xl text-green-600">
                  <CheckCircle size={22}/>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800">Balanço Salvo com Sucesso</h3>
                  <p className="text-sm text-gray-500">{modalResumo.length} item(ns) ajustado(s) em {new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setModalResumo(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"><X size={22}/></button>
            </div>
            <div className="flex-1 overflow-hidden p-6">
              <TabelaResumoBalanco itens={modalResumo} timestamp={Date.now()} />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} />
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      <CalculadoraFlutuante />
    </div>
  );
}
