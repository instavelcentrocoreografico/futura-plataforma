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
    var r = dados.resumo, p = r.pessoas;
    limpar(raiz); limpar(topoConta);

    topoConta.appendChild(el('span', {}, dados.equipa.nome || dados.equipa.email));
    topoConta.appendChild(el('span', { class: 'etiqueta' }, dados.equipa.papel));
    topoConta.appendChild(el('button', { type: 'button', class: 'botao-texto', onclick: function () { carregar(true); } }, 'Atualizar'));
    topoConta.appendChild(el('button', {
      type: 'button', class: 'botao-texto',
      onclick: function () { esquecer(); token = ''; ecraLogin(); }
    }, 'Sair'));

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
