// Backoffice da equipa – parte 1: entrada e visão geral (só consulta).
(function () {
  'use strict';

  var CHAVE = 'futura_bo_token';
  var raiz = document.getElementById('conteudo');
  var topoConta = document.getElementById('topo-conta');
  var token = '';

  function el(tag, atributos, filhos) {
    var n = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'class') n.className = atributos[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), atributos[k]);
      else n.setAttribute(k, atributos[k]);
    });
    [].concat(filhos === undefined ? [] : filhos).forEach(function (f) {
      if (f === null || f === undefined || f === false) return;
      n.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
    });
    return n;
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function guardar(t) { try { localStorage.setItem(CHAVE, t); } catch (e) { /* sem armazenamento */ } }
  function lembrado() { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } }
  function esquecer() { try { localStorage.removeItem(CHAVE); } catch (e) { /* nada */ } }

  /* ---------- entrada ---------- */
  function ecraLogin(mensagem) {
    limpar(raiz); limpar(topoConta);
    var campo = el('input', { type: 'email', id: 'bo-email', autocomplete: 'email', required: 'required' });
    var estado = el('p', { class: mensagem ? 'erro' : 'suave', role: 'status' }, mensagem || '');
    var botao = el('button', { type: 'submit', class: 'botao' }, 'Receber link de acesso');
    var form = el('form', {
      class: 'login',
      onsubmit: function (ev) {
        ev.preventDefault();
        botao.disabled = true;
        botao.textContent = 'A enviar…';
        estado.className = 'suave';
        estado.textContent = 'A enviar o pedido. Pode demorar até meio minuto, aguarde.';
        window.futuraApi.boPedirAcesso(campo.value.trim()).then(function (r) {
          botao.disabled = false;
          botao.textContent = 'Receber link de acesso';
          if (r && r.ok) {
            estado.className = 'sucesso';
            estado.textContent = 'Se este email pertence à equipa, vai receber um link dentro de instantes. Pode fechar esta página.';
          } else if (r && r.erro === 'email_invalido') {
            estado.className = 'erro'; estado.textContent = 'Este email não parece válido.';
          } else {
            estado.className = 'erro'; estado.textContent = 'Não foi possível enviar agora. Tente daqui a pouco.';
          }
        }).catch(function () {
          botao.disabled = false;
          botao.textContent = 'Receber link de acesso';
          estado.className = 'erro'; estado.textContent = 'Sem ligação. Verifique a internet e tente outra vez.';
        });
      }
    }, [
      el('h1', {}, 'Backoffice'),
      el('p', { class: 'suave' }, 'Acesso reservado à equipa de produção. Escreva o seu email para receber um link de entrada.'),
      el('label', { for: 'bo-email' }, 'Email'),
      campo, botao, estado
    ]);
    raiz.appendChild(form);
    campo.focus();
  }

  /* ---------- painel ---------- */
  function cartao(numero, legenda) {
    return el('div', { class: 'cartao' }, [el('span', { class: 'numero' }, String(numero)), el('span', { class: 'legenda' }, legenda)]);
  }
  function tabela(cabecalho, linhas, numericas) {
    var cab = el('tr', {}, cabecalho.map(function (c, i) { return el('th', { class: numericas.indexOf(i) > -1 ? 'num' : '' }, c); }));
    var corpo = linhas.map(function (l) {
      return el('tr', {}, l.map(function (c, i) {
        var texto = c && c.texto !== undefined ? c.texto : c;
        return el('td', { class: (numericas.indexOf(i) > -1 ? 'num ' : '') + (c && c.classe ? c.classe : '') }, texto === null || texto === undefined ? '' : String(texto));
      }));
    });
    return el('div', { class: 'tabela-caixa' }, [el('table', {}, [el('thead', {}, cab), el('tbody', {}, corpo)])]);
  }
  function dia(d) {
    var m = /^\d{4}-\d{2}-(\d{2})$/.exec(String(d));
    return m ? m[1] + '/12' : String(d || '');
  }
  var NOMES_ESTADO = {
    pedido: 'Pedido (a pedir estadia)', oferecido: 'Oferecido', autorizado: 'Autorizado', nao_autorizado: 'Não autorizado',
    nao_necessita: 'Não necessita', a_avaliar: 'A avaliar', caso_especial: 'Caso especial', por_classificar: 'Por classificar', '(vazio)': 'Sem estado'
  };

  function ecraPainel(dados) {
    limpar(raiz); limpar(topoConta);
    topoConta.appendChild(el('span', {}, dados.equipa.nome || dados.equipa.email));
    topoConta.appendChild(el('span', { class: 'etiqueta' }, dados.equipa.papel));
    topoConta.appendChild(el('button', { type: 'button', class: 'botao-texto', onclick: function () { carregar(true); } }, 'Atualizar'));
    topoConta.appendChild(el('button', {
      type: 'button', class: 'botao-texto',
      onclick: function () { esquecer(); token = ''; ecraLogin(); }
    }, 'Sair'));

    var abas = [
      { id: 'geral', nome: 'Visão geral', corpo: el('div') },
      { id: 'pessoas', nome: 'Pessoas', corpo: el('div') },
      { id: 'sessoes', nome: 'Sessões', corpo: el('div') },
      { id: 'alojamento', nome: 'Alojamento', corpo: el('div') }
    ];
    var barra = el('div', { class: 'separadores', role: 'tablist' });
    var listas = null, aCarregarListas = false;
    function mostrar(id) {
      abas.forEach(function (a) { a.botao.className = 'separador' + (a.id === id ? ' ativo' : ''); a.corpo.hidden = a.id !== id; });
      if (id !== 'geral' && !listas && !aCarregarListas) carregarListas();
    }
    function carregarListas() {
      aCarregarListas = true;
      ['pessoas', 'sessoes', 'alojamento'].forEach(function (i) {
        var a = abas.filter(function (x) { return x.id === i; })[0];
        limpar(a.corpo); a.corpo.appendChild(el('p', { class: 'suave' }, 'A carregar a lista…'));
      });
      window.futuraApi.boListas(token).then(function (r) {
        aCarregarListas = false;
        if (!r || !r.ok) { esquecer(); token = ''; ecraLogin('A sessão terminou. Peça um novo link.'); return; }
        listas = r;
        desenharListas(abas, r);
      }).catch(function () {
        aCarregarListas = false;
        abas.slice(1).forEach(function (a) {
          limpar(a.corpo);
          a.corpo.appendChild(el('p', { class: 'erro' }, 'Não foi possível carregar. Verifique a internet.'));
          a.corpo.appendChild(el('button', { type: 'button', class: 'botao', onclick: carregarListas }, 'Tentar outra vez'));
        });
      });
    }
    abas.forEach(function (a) {
      a.botao = el('button', { type: 'button', class: 'separador', role: 'tab', onclick: function () { mostrar(a.id); } }, a.nome);
      barra.appendChild(a.botao);
    });
    raiz.appendChild(barra);
    abas.forEach(function (a) { raiz.appendChild(a.corpo); });
    desenharGeral(abas[0].corpo, dados);
    mostrar('geral');
  }

  function desenharGeral(raiz, dados) {
    var r = dados.resumo, p = r.pessoas;
    raiz.appendChild(el('h1', {}, 'Visão geral'));
    raiz.appendChild(el('p', { class: 'nota-atualizado' }, 'Atualizado às ' + new Date(dados.gerado_em).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) + ' · só consulta'));

    raiz.appendChild(el('h2', {}, 'Pessoas'));
    raiz.appendChild(el('div', { class: 'cartoes' }, [
      cartao(p.total, 'pessoas na base de dados'),
      cartao(p.inscritas, 'com inscrição confirmada'),
      cartao(p.canceladas, 'inscrições canceladas'),
      cartao(p.por_validar, 'por validar (peça declarada)'),
      cartao(p.por_classificar, 'por classificar (cor)')
    ]));
    raiz.appendChild(tabela(['Nível', 'Pessoas', 'Inscritas'], [1, 2, 3].map(function (n) {
      return ['Nível ' + n, p.por_nivel[n] || 0, p.inscritas_por_nivel[n] || 0];
    }), [1, 2]));
    raiz.appendChild(tabela(['Presença nos dias', 'Pessoas'], [
      ['10 de dezembro', p.presenca.dia_10], ['11 de dezembro', p.presenca.dia_11], ['12 de dezembro', p.presenca.dia_12]
    ], [1]));

    raiz.appendChild(el('h2', {}, 'Lugares por sessão'));
    raiz.appendChild(tabela(['Dia', 'Hora', 'Sessão', 'Sala', 'Lugares', 'Confirmados', 'Em espera', 'Livres'],
      r.sessoes.map(function (s) {
        var cheia = s.livres !== null && s.livres === 0;
        return [dia(s.dia), s.inicio, s.titulo, s.sala,
          s.lotacao === null ? 'sem limite' : s.lotacao, s.confirmados,
          { texto: s.espera, classe: s.espera > 0 ? 'espera-alta' : '' },
          { texto: s.livres === null ? '–' : s.livres, classe: cheia ? 'cheio' : '' }];
      }), [4, 5, 6, 7]));

    raiz.appendChild(el('h2', {}, 'Alojamento'));
    var a = r.alojamento;
    raiz.appendChild(el('div', { class: 'cartoes' }, [
      cartao(a.pedidos_ativos, 'pedidos submetidos'),
      cartao(a.noites, 'noites pedidas (total)')
    ]));
    raiz.appendChild(tabela(['Estado', 'Pessoas'], Object.keys(a.por_estado).sort().map(function (k) {
      return [NOMES_ESTADO[k] || k, a.por_estado[k]];
    }), [1]));
    if (Object.keys(a.por_tipo_quarto).length) {
      raiz.appendChild(tabela(['Tipo de quarto (pedidos)', 'Pedidos'], Object.keys(a.por_tipo_quarto).map(function (k) { return [k, a.por_tipo_quarto[k]]; }), [1]));
    }

    raiz.appendChild(el('h2', {}, 'Refeições'));
    raiz.appendChild(tabela(['Dia', 'Refeição', 'Inscritos'], r.refeicoes.map(function (x) { return [dia(x.dia), x.tipo, x.inscritos]; }), [2]));
  }

  /* ---------- listas ---------- */
  function semAcentos(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  // CSV para abrir no Excel (UTF-8 com BOM, separador ponto e vírgula). Células que começam por = + - @ levam um apóstrofo.
  function descarregarCsv(nome, cabecalho, linhas) {
    function cel(v) {
      var t = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@]/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    }
    var texto = [cabecalho].concat(linhas).map(function (l) { return l.map(cel).join(';'); }).join('\r\n');
    var blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: nome });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function botaoCsv(nome, cabecalho, obterLinhas) {
    return el('button', { type: 'button', class: 'botao-texto', onclick: function () { descarregarCsv(nome, cabecalho, obterLinhas()); } }, 'Descarregar CSV');
  }

  function desenharListas(abas, d) {
    desenharPessoas(abas[1].corpo, d.pessoas);
    desenharSessoes(abas[2].corpo, d.sessoes);
    desenharAlojamento(abas[3].corpo, d.alojamento);
  }

  var ESTADO_INSC = { confirmada: 'Inscrita', cancelada: 'Cancelada', '': '—' };
  var ESTADO_VAL = { ok: '', por_validar: 'Por validar', por_classificar: 'Por classificar' };

  function desenharPessoas(corpo, pessoas) {
    limpar(corpo);
    var filtro = { texto: '', nivel: 0, so: false };
    var busca = el('input', { type: 'text', placeholder: 'Procurar por nome, email ou instituição', 'aria-label': 'Procurar' });
    var contagem = el('p', { class: 'nota-atualizado' });
    var caixa = el('div');
    var visiveis = [];
    function chip(texto, fn, ativo) {
      var c = el('button', { type: 'button', class: 'chip' + (ativo ? ' ativo' : '') }, texto);
      c.addEventListener('click', function () { fn(); desenhar(); });
      return c;
    }
    var chips = el('div', { class: 'filtro' });
    function desenharChips() {
      limpar(chips);
      [[0, 'Todos'], [1, 'Nível 1'], [2, 'Nível 2'], [3, 'Nível 3']].forEach(function (n) {
        chips.appendChild(chip(n[1], function () { filtro.nivel = n[0]; }, filtro.nivel === n[0]));
      });
      chips.appendChild(chip('Só inscritas', function () { filtro.so = !filtro.so; }, filtro.so));
    }
    function desenhar() {
      desenharChips();
      var t = semAcentos(filtro.texto);
      visiveis = pessoas.filter(function (x) {
        if (filtro.nivel && x.nivel !== filtro.nivel) return false;
        if (filtro.so && x.inscricao !== 'confirmada') return false;
        return !t || semAcentos(x.nome + ' ' + x.email + ' ' + x.instituicao).indexOf(t) > -1;
      }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
      contagem.textContent = visiveis.length + ' de ' + pessoas.length + ' pessoas';
      limpar(caixa);
      caixa.appendChild(tabela(['Nome', 'Email', 'Instituição', 'Nível', 'Inscrição', 'Dias', 'Sessões', 'Notas'], visiveis.map(function (x) {
        var notas = [ESTADO_VAL[x.estado_validacao] || x.estado_validacao, x.peca_declarada ? 'Peça: ' + x.peca_declarada : '',
          x.restricoes ? 'Alimentação: ' + x.restricoes : '', x.necessidades ? 'Necessidades: ' + x.necessidades : ''].filter(Boolean).join(' · ');
        return [x.nome, x.email, x.instituicao, x.nivel, ESTADO_INSC[x.inscricao] || x.inscricao, x.dias, x.sessoes, notas];
      }), [3, 6]));
    }
    busca.addEventListener('input', function () { filtro.texto = busca.value; desenhar(); });
    corpo.appendChild(el('h1', {}, 'Pessoas'));
    corpo.appendChild(busca);
    corpo.appendChild(chips);
    corpo.appendChild(el('div', { class: 'acoes-lista' }, [contagem, botaoCsv('futura_pessoas.csv',
      ['Nome', 'Email', 'Instituição', 'Nível', 'Origem', 'Inscrição', 'Dias', 'Sessões', 'Validação', 'Peça declarada', 'Restrições alimentares', 'Necessidades'],
      function () { return visiveis.map(function (x) { return [x.nome, x.email, x.instituicao, x.nivel, x.origem, x.inscricao, x.dias, x.sessoes, x.estado_validacao, x.peca_declarada, x.restricoes, x.necessidades]; }); })]));
    corpo.appendChild(caixa);
    desenhar();
  }

  function desenharSessoes(corpo, sessoes) {
    limpar(corpo);
    corpo.appendChild(el('h1', {}, 'Sessões'));
    var seletor = el('select', { 'aria-label': 'Escolher sessão' }, sessoes.map(function (s, i) {
      return el('option', { value: String(i) }, dia(s.dia) + ' ' + s.inicio + ' · ' + s.titulo + ' (' + s.confirmados.length + (s.espera.length ? ' + ' + s.espera.length + ' em espera' : '') + ')');
    }));
    var caixa = el('div');
    function desenhar() {
      var s = sessoes[Number(seletor.value)]; limpar(caixa);
      if (!s) { caixa.appendChild(el('p', { class: 'suave' }, 'Sem sessões com inscrição.')); return; }
      caixa.appendChild(el('p', { class: 'suave' }, s.sala + ' · ' + (s.lotacao === null ? 'sem limite de lugares' : s.lotacao + ' lugares') + ' · ' + s.confirmados.length + ' confirmados'));
      caixa.appendChild(el('div', { class: 'acoes-lista' }, [
        el('span'), botaoCsv('futura_' + s.id + '.csv', ['Estado', 'Posição', 'Nome', 'Email', 'Instituição', 'Nível'],
          function () { return s.confirmados.map(function (x) { return ['Confirmado', '', x.nome, x.email, x.instituicao, x.nivel]; })
            .concat(s.espera.map(function (x) { return ['Em espera', x.posicao, x.nome, x.email, x.instituicao, x.nivel]; })); })]));
      caixa.appendChild(el('h2', {}, 'Confirmados (' + s.confirmados.length + ')'));
      caixa.appendChild(s.confirmados.length ? tabela(['Nome', 'Email', 'Instituição', 'Nível'], s.confirmados.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); })
        .map(function (x) { return [x.nome, x.email, x.instituicao, x.nivel]; }), [3]) : el('p', { class: 'suave' }, 'Ainda ninguém.'));
      caixa.appendChild(el('h2', {}, 'Lista de espera (' + s.espera.length + ')'));
      caixa.appendChild(s.espera.length ? tabela(['Posição', 'Nome', 'Email', 'Instituição', 'Nível', 'Pedido em'], s.espera
        .map(function (x) { return [x.posicao, x.nome, x.email, x.instituicao, x.nivel, x.pedido_em]; }), [0, 4]) : el('p', { class: 'suave' }, 'Ninguém em espera.'));
    }
    seletor.addEventListener('change', desenhar);
    corpo.appendChild(seletor); corpo.appendChild(caixa);
    desenhar();
  }

  function desenharAlojamento(corpo, lista) {
    limpar(corpo);
    corpo.appendChild(el('h1', {}, 'Alojamento'));
    var ordenada = lista.slice().sort(function (a, b) { return (b.pedido_submetido - a.pedido_submetido) || a.nome.localeCompare(b.nome, 'pt'); });
    var euros = function (n) { return n ? n.toFixed(2).replace('.', ',') + ' €' : ''; };
    corpo.appendChild(el('div', { class: 'acoes-lista' }, [
      el('p', { class: 'nota-atualizado' }, ordenada.length + ' pessoas com estado ou pedido de alojamento'),
      botaoCsv('futura_alojamento.csv', ['Nome', 'Email', 'Instituição', 'Nível', 'Estado', 'Pedido submetido', 'Viagem oferecida', 'Quarto', 'Partilha com', 'Entrada', 'Saída', 'Noites', 'Excedente', 'Taxa turística', 'Total', 'Pago', 'Notas'],
        function () { return ordenada.map(function (x) { return [x.nome, x.email, x.instituicao, x.nivel, x.estado, x.pedido_submetido ? 'sim' : 'não', x.viagem_oferecida, x.tipo_quarto, x.partilha_com, x.checkin, x.checkout, x.noites, x.excedente, x.taxa, x.total, x.pago, x.notas]; }); })
    ]));
    corpo.appendChild(tabela(['Nome', 'Instituição', 'Estado', 'Quarto', 'Entrada', 'Saída', 'Noites', 'Total', 'Pago', 'Notas'], ordenada.map(function (x) {
      return [x.nome, x.instituicao, (NOMES_ESTADO[x.estado] || x.estado) + (x.pedido_submetido ? ' · pedido feito' : ''),
        x.tipo_quarto + (x.partilha_com ? ' (com ' + x.partilha_com + ')' : ''), x.checkin, x.checkout, x.noites || '', euros(x.total), x.pago, x.notas];
    }), [6, 7]));
  }

  /* ---------- arranque ---------- */
  function carregar(manual) {
    if (!manual) { limpar(raiz); raiz.appendChild(el('p', { class: 'suave' }, 'A carregar…')); }
    window.futuraApi.boCarregar(token).then(function (r) {
      if (r && r.ok) { guardar(token); ecraPainel(r); return; }
      esquecer(); token = '';
      ecraLogin('Este link já não é válido (expirou ou o acesso foi retirado). Peça um novo link.');
    }).catch(function () {
      limpar(raiz);
      raiz.appendChild(el('p', { class: 'erro' }, 'Não foi possível carregar. Verifique a internet e tente outra vez.'));
      raiz.appendChild(el('button', { type: 'button', class: 'botao', onclick: function () { carregar(); } }, 'Tentar outra vez'));
    });
  }

  var parametros = new URLSearchParams(window.location.search);
  var doLink = parametros.get('t');
  if (doLink) {
    token = doLink;
    // tira o código do endereço, para não ficar no histórico nem em capturas de ecrã
    window.history.replaceState(null, '', window.location.pathname);
  } else {
    token = lembrado();
  }
  if (token) carregar(); else ecraLogin();
})();
