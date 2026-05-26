/* ============================================
   GESTÃO DE LOJA - Fórmulas Matemáticas
   ============================================ */

class Formulas {
  // CUSTO MÉDIO PONDERADO
  static calcularCMP(stockAtual, cmpAtual, litrosEntrada, precoCustoEntrada) {
    const valorStockAtual = stockAtual * cmpAtual;
    const valorEntrada = litrosEntrada * precoCustoEntrada;
    const stockTotal = stockAtual + litrosEntrada;
    const cmpNovo = stockTotal > 0 ? (valorStockAtual + valorEntrada) / stockTotal : 0;
    return {
      cmpNovo: Math.round(cmpNovo * 100) / 100,
      stockTotal: Math.round(stockTotal * 100) / 100
    };
  }

  // PREÇO VENDA POR PERCENTAGEM
  static precoVendaPorPercentagem(precoCusto, percentagemLucro) {
    if (precoCusto <= 0 || percentagemLucro < 0) return 0;
    return Math.round(precoCusto * (1 + percentagemLucro / 100) * 100) / 100;
  }

  // PERCENTAGEM POR PREÇO VENDA
  static percentagemPorPrecoVenda(precoCusto, precoVenda) {
    if (precoCusto <= 0 || precoVenda <= 0) return 0;
    return Math.round(((precoVenda - precoCusto) / precoCusto) * 100 * 100) / 100;
  }

  // LUCRO ABSOLUTO
  static lucroAbsoluto(precoCusto, precoVenda, quantidade) {
    return (precoVenda - precoCusto) * quantidade;
  }

  // CM → LITROS (cilíndrico horizontal)
  static cmParaLitrosCilindricoHorizontal(comprimentoCm, diametroCm, alturaMedidaCm) {
    const r = diametroCm / 2;
    const h = Math.max(0, Math.min(alturaMedidaCm, diametroCm));
    const termo1 = r * r * Math.acos((r - h) / r);
    const termo2 = (r - h) * Math.sqrt(2 * r * h - h * h);
    const litros = (comprimentoCm * (termo1 - termo2)) / 1000;
    return Math.max(0, Math.round(litros * 100) / 100);
  }

  // CM → LITROS (cilíndrico vertical)
  static cmParaLitrosCilindricoVertical(diametroCm, alturaMedidaCm) {
    const r = diametroCm / 2;
    return Math.max(0, Math.round((Math.PI * r * r * alturaMedidaCm / 1000) * 100) / 100);
  }

  // CM → LITROS (retangular)
  static cmParaLitrosRetangular(larguraCm, profundidadeCm, alturaMedidaCm) {
    return Math.max(0, Math.round((larguraCm * profundidadeCm * alturaMedidaCm / 1000) * 100) / 100);
  }

  // CM → LITROS (genérico)
  static cmParaLitros(tanque, alturaMedidaCm) {
    switch (tanque.forma) {
      case 'cilindrico_horizontal':
        return this.cmParaLitrosCilindricoHorizontal(tanque.comprimento_cm, tanque.diametro_cm, alturaMedidaCm);
      case 'cilindrico_vertical':
        return this.cmParaLitrosCilindricoVertical(tanque.diametro_cm, alturaMedidaCm);
      case 'retangular':
        return this.cmParaLitrosRetangular(tanque.largura_cm, tanque.profundidade_cm, alturaMedidaCm);
      default:
        return 0;
    }
  }

  // Arredondar para MZN
  static arredondarMZN(valor) {
    return Math.round(valor * 100) / 100;
  }

  // Percentagem de divergência
  static percentagemDivergencia(esperado, real) {
    if (esperado === 0) return real === 0 ? 0 : 100;
    return ((real - esperado) / esperado) * 100;
  }

  // Previsão de ganhos
  static previsaoGanhos(historicoLucros, dias = 7) {
    if (!historicoLucros || historicoLucros.length === 0) return 0;
    const ultimos = historicoLucros.slice(-dias);
    return Math.round((ultimos.reduce((a, b) => a + b, 0) / ultimos.length) * 100) / 100;
  }

  // Calcular volume do tanque cheio
  static volumeTanqueCheio(tanque) {
    switch (tanque.forma) {
      case 'cilindrico_horizontal':
        return this.cmParaLitrosCilindricoHorizontal(tanque.comprimento_cm, tanque.diametro_cm, tanque.diametro_cm);
      case 'cilindrico_vertical':
        return this.cmParaLitrosCilindricoVertical(tanque.diametro_cm, tanque.altura_cm || tanque.diametro_cm);
      case 'retangular':
        return this.cmParaLitrosRetangular(tanque.largura_cm, tanque.profundidade_cm, tanque.altura_cm || 100);
      default:
        return tanque.capacidade_litros || 0;
    }
  }

  // Stock status
  static stockStatus(stock, minimo) {
    if (stock <= 0) return 'critico';
    if (stock <= minimo) return 'baixo';
    return 'ok';
  }

  // Total carrinho
  static totalCarrinho(itens) {
    return itens.reduce((total, item) => total + (item.preco_venda * item.quantidade), 0);
  }

  // Formatar data
  static formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Formatar data/hora
  static formatarDataHora(data) {
    if (!data) return '';
    const d = new Date(data);
    return d.toLocaleString('pt-MZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Formatar Moeda MZN
  static formatarMZN(valor) {
    if (valor === null || valor === undefined) return '0,00 MZN';
    return new Intl.NumberFormat('pt-MZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor) + ' MZN';
  }

  // Formatar número
  static formatarNumero(valor, decimais = 2) {
    if (valor === null || valor === undefined) return '0';
    return new Intl.NumberFormat('pt-MZ', {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais
    }).format(valor);
  }

  // Formatar litros
  static formatarLitros(valor) {
    return this.formatarNumero(valor, 2) + ' L';
  }

  // UUID simples
  static uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }
}
