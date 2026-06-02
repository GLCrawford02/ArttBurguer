const fs = require('fs');
const file = 'src/components/LancamentoVendas.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr1 = `  const calculateDeliveryFee = (clienteLat?: number, clienteLng?: number) => {
    if (!clienteLat || !clienteLng || !taxasEntregaConfig.lojaLat || !taxasEntregaConfig.lojaLng) return null;
    const dist = getDistanceFromLatLonInKm(taxasEntregaConfig.lojaLat, taxasEntregaConfig.lojaLng, clienteLat, clienteLng);
    const km = Math.ceil(dist);
    if (km > 20 || !taxasEntregaConfig.taxas[km]) return null;
    return Number(taxasEntregaConfig.taxas[km]);
    if (!clienteLat || !clienteLng) return null;

    const zonaComValor = zonasValor.find(zona => isPointInPolygon([Number(clienteLat), Number(clienteLng)], zona.coords || zona));
    if (zonaComValor) {
      return Number(zonaComValor.valor);
    }

    if (zonasRestritas.some(zona => isPointInPolygon([Number(clienteLat), Number(clienteLng)], zona.coords || zona))) {
      return 'restrita';
    }

    if (taxasEntregaConfig.lojaLat && taxasEntregaConfig.lojaLng) {
      const dist = getDistanceFromLatLonInKm(taxasEntregaConfig.lojaLat, taxasEntregaConfig.lojaLng, clienteLat, clienteLng);
      const km = Math.ceil(dist);
      if (km <= 20 && taxasEntregaConfig.taxas[km] && taxasEntregaConfig.taxas[km] > 0) {
        return Number(taxasEntregaConfig.taxas[km]);
      }
    }
    return 'restrita';
  };

  let taxaEntregaPdv = 0;
  let taxaEntregaText = '';

  if (pdvTipoPedido === 'Entrega' && !pdvIsRetirada) {
    if (pdvTaxaEntregaFixa !== null) {
      taxaEntregaPdv = pdvTaxaEntregaFixa;
      taxaEntregaText = \`R$ \${taxaEntregaPdv.toFixed(2).replace('.', ',')}\`;
    } else if (pdvCliente && pdvCliente.lat && pdvCliente.lng) {
      const calculated = calculateDeliveryFee(pdvCliente.lat, pdvCliente.lng);
      if (calculated !== null) {
      if (typeof calculated === 'number') {
        taxaEntregaPdv = calculated;
        taxaEntregaText = \`R$ \${taxaEntregaPdv.toFixed(2).replace('.', ',')}\`;
      } else if (calculated === 'restrita') {
        taxaEntregaText = 'Área Restrita';
      } else {
        taxaEntregaText = 'A Calcular / Fora de Área';
      }
    } else if (pdvCliente) {
      taxaEntregaText = 'Sem Coordenadas GPS';
    }
  }`;

const newStr1 = `  const calculateDeliveryFee = (clienteLat?: number, clienteLng?: number) => {
    if (clienteLat === undefined || clienteLng === undefined) return null;

    const zonaComValor = zonasValor.find(zona => isPointInPolygon([clienteLat, clienteLng], zona.coords || zona));
    if (zonaComValor) {
      return Number(zonaComValor.valor);
    }

    if (zonasRestritas.some(zona => isPointInPolygon([clienteLat, clienteLng], zona.coords || zona))) {
      return 'restrita';
    }

    if (taxasEntregaConfig.lojaLat && taxasEntregaConfig.lojaLng) {
      const dist = getDistanceFromLatLonInKm(taxasEntregaConfig.lojaLat, taxasEntregaConfig.lojaLng, clienteLat, clienteLng);
      const km = Math.ceil(dist);
      if (km <= 20 && taxasEntregaConfig.taxas[km] && taxasEntregaConfig.taxas[km] > 0) {
        return Number(taxasEntregaConfig.taxas[km]);
      }
    }
    return 'restrita';
  };

  let taxaEntregaPdv = 0;
  let taxaEntregaText = '';

  if (pdvTipoPedido === 'Entrega' && !pdvIsRetirada) {
    if (pdvTaxaEntregaFixa !== null) {
      taxaEntregaPdv = pdvTaxaEntregaFixa;
      taxaEntregaText = \`R$ \${taxaEntregaPdv.toFixed(2).replace('.', ',')}\`;
    } else if (pdvCliente && pdvCliente.lat && pdvCliente.lng) {
      const calculated = calculateDeliveryFee(pdvCliente.lat, pdvCliente.lng);
      if (calculated !== null) {
        if (typeof calculated === 'number') {
          taxaEntregaPdv = calculated;
          taxaEntregaText = \`R$ \${taxaEntregaPdv.toFixed(2).replace('.', ',')}\`;
        } else if (calculated === 'restrita') {
          taxaEntregaText = 'Área Restrita';
        } else {
          taxaEntregaText = 'A Calcular / Fora de Área';
        }
      }
    } else if (pdvCliente) {
      taxaEntregaText = 'Sem Coordenadas GPS';
    }
  }`;

if (content.includes(oldStr1)) {
  content = content.replace(oldStr1, newStr1);
  console.log('Replaced block 1 successfully.');
} else {
  console.log('Could not find block 1!');
  process.exit(1);
}

const oldStr2 = `  const aplicarEdicaoAutorizada = (itemId: string, delta: 1 | -1, autorizadoPor: string) => {`;
const newStr2 = `  function aplicarEdicaoAutorizada(itemId: string, delta: 1 | -1, autorizadoPor: string) {`;
if (content.includes(oldStr2)) {
  content = content.replace(oldStr2, newStr2);
  console.log('Replaced block 2 successfully.');
} else {
  console.log('Could not find block 2!');
}

const oldStr3 = `  const imprimirTicketInterno = async (itens: any[], destLabel: string, identificador: string, printerIp?: string, lancadoPor?: string) => {`;
const newStr3 = `  async function imprimirTicketInterno(itens: any[], destLabel: string, identificador: string, printerIp?: string, lancadoPor?: string) {`;
if (content.includes(oldStr3)) {
  content = content.replace(oldStr3, newStr3);
  console.log('Replaced block 3 successfully.');
} else {
  console.log('Could not find block 3!');
}

fs.writeFileSync(file, content, 'utf8');
