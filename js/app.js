// Página pública da futura (esqueleto): pedir link de acesso e ver a programação.
(function () {
  'use strict';

  var TEXTOS = window.FUTURA_TEXTOS;
  var raiz = document.getElementById('conteudo');
  var lang = 'pt';
  var token = null;
  var dados = null; // resposta de "carregar"

  function t(chave, vars) {
    var texto = TEXTOS[lang][chave];
    if (texto === undefined) return chave;
    if (typeof texto !== 'string') return texto;
    return texto.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }

  // Criar elementos sempre com textContent: o texto vindo da folha nunca é interpretado como HTML.
  function el(tag, atributos, filhos) {
    var e = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = atributos[k];
      else if (k === 'classe') e.className = atributos[k];
      else e.setAttribute(k, atributos[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(f); });
    return e;
  }

  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '').trim()); }

  function formatarDataHora(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon'
    }).format(new Date(iso));
  }

  function formatarDia(dia) {
    return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(new Date(dia + 'T12:00:00Z'));
  }

  /* ---------- início ---------- */

  function iniciar() {
    var params = new URLSearchParams(window.location.search);
    var guardado = null;
    try { guardado = window.localStorage.getItem('futura_lang'); } catch (e) { /* sem armazenamento */ }
    var pedido = params.get('l');
    lang = (pedido === 'pt' || pedido === 'en') ? pedido
      : (guardado === 'pt' || guardado === 'en') ? guardado
      : (String(navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en');

    // O token vem no link do email. Guarda-se só nesta sessão e tira-se do endereço.
    var tokenUrl = params.get('t');
    if (tokenUrl) {
      try { window.sessionStorage.setItem('futura_token', tokenUrl); } catch (e) { /* sem armazenamento */ }
      window.history.replaceState(null, '', window.location.pathname);
    }
    try { token = window.sessionStorage.getItem('futura_token'); } catch (e) { token = tokenUrl; }
    if (!token) token = tokenUrl;

    document.getElementById('botao-idioma').addEventListener('click', function () {
      lang = lang === 'pt' ? 'en' : 'pt';
      try { window.localStorage.setItem('futura_lang', lang); } catch (e) { /* sem armazenamento */ }
      desenhar();
    });

    if (token) carregar(); else { dados = null; desenhar(); }
  }

  async function carregar() {
    try {
      var r = await window.futuraApi.carregar(token);
      if (r && r.ok) {
        dados = r;
        desenhar();
      } else {
        token = null;
        try { window.sessionStorage.removeItem('futura_token'); } catch (e) { /* sem armazenamento */ }
        dados = null;
        desenhar(t('linkInvalido'));
      }
    } catch (e) {
      dados = null;
      desenhar(e && /API_URL/.test(e.message) ? t('erroConfig') : t('erroGeral'));
    }
  }

  /* ---------- desenhar ---------- */

  function desenhar(mensagemErro) {
    document.documentElement.lang = lang;
    document.title = t('titulo');
    document.getElementById('botao-idioma').textContent = t('idiomaBotao');
    document.getElementById('rodape-texto').textContent = t('rodape');
    raiz.textContent = '';
    if (dados) desenharPerfil(); else desenharPedido(mensagemErro);
  }

  function desenharPedido(mensagemErro) {
    raiz.appendChild(el('h1', { texto: t('introTitulo') }));
    raiz.appendChild(el('p', { texto: t('intro') }));
    if (mensagemErro) raiz.appendChild(el('p', { classe: 'erro', role: 'alert', texto: mensagemErro }));
    raiz.appendChild(el('p', { texto: t('introAcesso') }));

    var campo = el('input', { type: 'email', id: 'campo-email', name: 'email', autocomplete: 'email', required: 'required', inputmode: 'email' });
    var botao = el('button', { type: 'submit', classe: 'botao', texto: t('pedirBotao') });
    var estado = el('p', { id: 'estado-pedido', role: 'status', 'aria-live': 'polite' });
    var form = el('form', { novalidate: 'novalidate' }, [
      el('label', { 'for': 'campo-email', texto: t('emailEtiqueta') }), campo, botao, estado
    ]);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      estado.className = '';
      estado.textContent = '';
      var email = campo.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        estado.className = 'erro';
        estado.textContent = t('erroEmail');
        campo.focus();
        return;
      }
      botao.disabled = true;
      botao.textContent = t('aEnviar');
      try {
        var r = await window.futuraApi.pedirAcesso(email, lang);
        if (r && r.ok) {
          raiz.textContent = '';
          raiz.appendChild(el('h1', { texto: t('enviadoTitulo') }));
          raiz.appendChild(el('p', { texto: t('enviado') }));
          raiz.focus();
          return;
        }
        estado.className = 'erro';
        estado.textContent = r && r.erro === 'email_invalido' ? t('erroEmail')
          : r && r.erro === 'indisponivel' ? t('erroIndisponivel') : t('erroGeral');
      } catch (e) {
        estado.className = 'erro';
        estado.textContent = e && /API_URL/.test(e.message) ? t('erroConfig') : t('erroGeral');
      }
      botao.disabled = false;
      botao.textContent = t('pedirBotao');
    });
    raiz.appendChild(form);
  }


  /* ---------- área da pessoa: separadores ---------- */

  var ORDEM = ['presenca', 'programacao', 'refeicoes', 'resumo'];
  var separador = 'presenca';
  var rasc = null;        // rascunho (o que a pessoa está a preencher)
  var base = '';          // fotografia do rascunho guardado, para saber se há alterações
  var mensagem = null;    // {tipo:'ok'|'erro', texto}
  var aGuardar = false;
  var pediuConfirmar = false;
  var diaFiltro = '';
  var focoPendente = '';

  function inscrito() {
    var c = dados.selecao.confirmacao;
    return !!(c && c.estado !== 'cancelada');
  }
  function editavel() { return dados.janela.estado === 'aberta' && !aGuardar; }

  function iniciarRascunho() {
    var p = dados.pessoa, s = dados.selecao, c = s.confirmacao;
    var dias = c ? { dia_10: c.dia_10, dia_11: c.dia_11, dia_12: c.dia_12 }
      : Object.assign({}, s.dias_sugeridos || { dia_10: 'por_definir', dia_11: 'por_definir', dia_12: 'por_definir' });
    rasc = {
      nome: p.nome, telefone: p.telefone, instituicao: p.instituicao, funcao: p.funcao,
      necessidades: p.necessidades_especificas, peca_declarada: p.peca_declarada,
      dias: dias,
      sessoes: s.sessoes.map(function (x) { return x.sessao_id; }),
      refeicoes: s.refeicoes.slice(),
      restricoes: c ? c.restricoes_alimentares : '',
      mensagem: c ? c.mensagem : '',
      rgpd: c ? !!c.rgpd : false
    };
    base = fotografia();
    pediuConfirmar = false;
    diaFiltro = '';
    separador = inscrito() ? 'resumo' : 'presenca';
  }

  function fotografia() {
    return JSON.stringify([rasc.nome, rasc.telefone, rasc.instituicao, rasc.funcao, rasc.necessidades, rasc.peca_declarada,
      rasc.dias, rasc.sessoes.slice().sort(), rasc.refeicoes.slice().sort(), rasc.restricoes, rasc.mensagem]);
  }
  function alterado() { return fotografia() !== base; }

  function chaveDia(dia) { var m = /-(\d{2})$/.exec(dia); return m ? 'dia_' + parseInt(m[1], 10) : ''; }
  function diaNao(dia) { return rasc.dias[chaveDia(dia)] === 'nao'; }

  function sessaoPorId(id) { return dados.programa.sessoes.filter(function (s) { return s.id === id; })[0]; }
  function refeicaoPorId(id) { return dados.programa.refeicoes.filter(function (r) { return r.id === id; })[0]; }
  function estadoGuardado(id) {
    var x = dados.selecao.sessoes.filter(function (s) { return s.sessao_id === id; })[0];
    return x || null;
  }
  function inscricaoPossivel(s) { return s.inscricao === 'sim' && s.estado !== 'cancelada'; }

  function desenharPerfil() {
    if (!rasc) iniciarRascunho();
    var p = dados.pessoa;
    raiz.appendChild(el('h1', { texto: p.nome ? t('saudacao', { nome: p.nome }) : t('saudacaoSemNome') }));
    raiz.appendChild(el('p', { classe: 'suave', texto: t('nivel')[p.nivel] || '' }));

    var j = dados.janela;
    var aviso = j.estado === 'aberta' ? t('janelaAberta', { fecho: formatarDataHora(j.fecha_em) })
      : j.estado === 'por_abrir' ? t('janelaPorAbrir', { abre: formatarDataHora(j.abre_em) })
      : t('janelaFechada');
    raiz.appendChild(el('div', { classe: 'cartao aviso' }, [el('p', { texto: aviso })]));

    if (mensagem) {
      raiz.appendChild(el('p', { classe: mensagem.tipo === 'erro' ? 'erro' : 'sucesso', role: mensagem.tipo === 'erro' ? 'alert' : 'status', texto: mensagem.texto }));
    }

    var lista = el('div', { classe: 'separadores', role: 'tablist', 'aria-label': t('separadoresLabel') });
    ORDEM.forEach(function (id) {
      var b = el('button', {
        type: 'button', role: 'tab', id: 'sep-' + id, classe: 'separador' + (id === separador ? ' ativo' : ''),
        'aria-selected': id === separador ? 'true' : 'false', 'aria-controls': 'painel', texto: t('separadores')[id]
      });
      b.addEventListener('click', function () { mudarSeparador(id); });
      lista.appendChild(b);
    });
    raiz.appendChild(lista);

    var painel = el('div', { id: 'painel', role: 'tabpanel', 'aria-labelledby': 'sep-' + separador });
    raiz.appendChild(painel);
    desenharPainel(painel);
    if (focoPendente) {
      var f = document.getElementById(focoPendente);
      if (f) f.focus();
      focoPendente = '';
    }
  }

  function redesenhar(foco) {
    focoPendente = foco || '';
    var y = window.scrollY;
    desenhar();
    window.scrollTo(0, y);
  }

  function mudarSeparador(id) {
    separador = id;
    mensagem = null;
    desenhar();
    window.scrollTo(0, 0);
  }

  function desenharPainel(painel) {
    if (!editavel() && dados.janela.estado !== 'aberta' && separador === 'presenca') {
      painel.appendChild(el('p', { classe: 'suave', texto: t('consultaApenas') }));
    }
    if (separador === 'presenca') painelPresenca(painel);
    else if (separador === 'programacao') painelProgramacao(painel);
    else if (separador === 'refeicoes') painelRefeicoes(painel);
    else painelResumo(painel);
    if (separador !== 'resumo') {
      var seg = el('button', { type: 'button', classe: 'botao', texto: t('seguinte') });
      seg.addEventListener('click', function () { mudarSeparador(ORDEM[ORDEM.indexOf(separador) + 1]); });
      painel.appendChild(el('div', { classe: 'acoes' }, [seg]));
    }
  }

  /* campos de texto simples */
  function campoTexto(id, etiqueta, chave, opcoes) {
    opcoes = opcoes || {};
    var atributos = { type: opcoes.tipo || 'text', id: id, value: opcoes.valor !== undefined ? opcoes.valor : (rasc[chave] || ''), maxlength: opcoes.max || 120, autocomplete: opcoes.auto || 'off' };
    if (!editavel() || opcoes.bloqueado) atributos.disabled = 'disabled';
    var e = opcoes.multilinha ? el('textarea', { id: id, rows: '3', maxlength: opcoes.max || 500 }) : el('input', atributos);
    if (opcoes.multilinha) { e.value = rasc[chave] || ''; if (!editavel()) e.disabled = true; }
    e.addEventListener('input', function () { rasc[chave] = e.value; });
    return el('div', { classe: 'campo' }, [el('label', { 'for': id, texto: etiqueta }), e]);
  }

  function painelPresenca(painel) {
    var p = dados.pessoa;
    painel.appendChild(el('h2', { texto: t('dadosTitulo') }));
    painel.appendChild(campoTexto('f-nome', t('nome'), 'nome', { auto: 'name' }));
    painel.appendChild(campoTexto('f-email', t('emailEtiqueta'), 'email', { tipo: 'email', bloqueado: true, valor: p.email }));
    painel.appendChild(campoTexto('f-tel', t('telefone'), 'telefone', { tipo: 'tel', auto: 'tel', max: 40 }));
    painel.appendChild(campoTexto('f-inst', t('instituicao'), 'instituicao', { bloqueado: !p.instituicao_editavel }));
    painel.appendChild(campoTexto('f-funcao', t('funcao'), 'funcao'));
    painel.appendChild(campoTexto('f-nec', t('necessidades'), 'necessidades', { multilinha: true }));

    if (p.nivel === 3) {
      var titulos = {};
      dados.programa.sessoes.forEach(function (s) { s.pecas.forEach(function (x) { if (x.titulo) titulos[x.titulo] = true; }); });
      var sel = el('select', { id: 'f-peca' }, [el('option', { value: '', texto: t('pecaNenhuma') })]);
      Object.keys(titulos).sort().forEach(function (tt) { sel.appendChild(el('option', { value: tt, texto: tt })); });
      sel.value = rasc.peca_declarada || '';
      if (sel.value !== (rasc.peca_declarada || '')) sel.value = '';
      if (!editavel()) sel.disabled = true;
      sel.addEventListener('change', function () { rasc.peca_declarada = sel.value; });
      painel.appendChild(el('div', { classe: 'campo' }, [
        el('label', { 'for': 'f-peca', texto: t('pecaDeclarada') }), sel, el('p', { classe: 'suave pequeno', texto: t('pecaAjuda') })
      ]));
    }

    painel.appendChild(el('h2', { texto: t('diasTitulo') }));
    [['dia_10', '2026-12-10'], ['dia_11', '2026-12-11'], ['dia_12', '2026-12-12']].forEach(function (par) {
      var chave = par[0];
      var grupo = el('fieldset', { classe: 'dia-opcoes' }, [el('legend', { texto: formatarDia(par[1]) })]);
      [['sim', 'sim'], ['nao', 'nao'], ['por_definir', 'porDefinir']].forEach(function (op) {
        var id = 'd-' + chave + '-' + op[0];
        var r = el('input', { type: 'radio', name: 'd-' + chave, id: id, value: op[0] });
        r.checked = rasc.dias[chave] === op[0];
        if (!editavel()) r.disabled = true;
        r.addEventListener('change', function () {
          rasc.dias[chave] = op[0];
          if (op[0] === 'nao') {
            var antes = rasc.sessoes.length + rasc.refeicoes.length;
            rasc.sessoes = rasc.sessoes.filter(function (sid) { var s = sessaoPorId(sid); return !s || chaveDia(s.dia) !== chave; });
            rasc.refeicoes = rasc.refeicoes.filter(function (rid) { var x = refeicaoPorId(rid); return !x || chaveDia(x.dia) !== chave; });
            mensagem = (rasc.sessoes.length + rasc.refeicoes.length) < antes ? { tipo: 'ok', texto: t('diaRemovido') } : null;
          }
          redesenhar(id);
        });
        grupo.appendChild(el('label', { classe: 'opcao', 'for': id }, [r, el('span', { texto: t(op[1]) })]));
      });
      painel.appendChild(grupo);
    });
    painel.appendChild(campoTexto('f-msg', t('mensagemEtiqueta'), 'mensagem', { multilinha: true, max: 1000 }));
  }

  function filtroDias(painel) {
    var dias = [];
    dados.programa.sessoes.forEach(function (s) { if (dias.indexOf(s.dia) < 0) dias.push(s.dia); });
    dias.sort();
    var barra = el('div', { classe: 'filtro', role: 'group', 'aria-label': t('filtroDia') });
    [''].concat(dias).forEach(function (d) {
      var b = el('button', { type: 'button', classe: 'chip' + (diaFiltro === d ? ' ativo' : ''), 'aria-pressed': diaFiltro === d ? 'true' : 'false', texto: d ? formatarDia(d) : (lang === 'pt' ? 'Todos' : 'All') });
      b.addEventListener('click', function () { diaFiltro = d; redesenhar(); });
      barra.appendChild(b);
    });
    painel.appendChild(barra);
    return dias;
  }

  function painelProgramacao(painel) {
    painel.appendChild(el('h2', { texto: t('separadores').programacao }));
    var dias = filtroDias(painel);
    dias.filter(function (d) { return !diaFiltro || d === diaFiltro; }).forEach(function (dia) {
      painel.appendChild(el('h3', { classe: 'dia', texto: formatarDia(dia) }));
      if (diaNao(dia)) painel.appendChild(el('p', { classe: 'suave', texto: t('diaNaoMarcado') }));
      dados.programa.sessoes.filter(function (s) { return s.dia === dia; }).forEach(function (s) {
        painel.appendChild(desenharSessao(s));
      });
    });
  }

  function desenharSessao(s) {
    var hora = s.fim ? s.inicio + ' – ' + s.fim : s.inicio;
    var info = [];
    if (s.sala) info.push(s.sala);
    var guardada = estadoGuardado(s.id);
    var marcada = rasc.sessoes.indexOf(s.id) > -1;

    var etiquetas = [];
    if (s.tipo === 'bloco') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('bloco') }));
    if (s.inscricao === 'por_definir') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('inscricaoPorDefinir') }));
    else if (s.inscricao !== 'sim') etiquetas.push(el('span', { classe: 'etiqueta', texto: t('semInscricao') }));
    else if (s.lugares_livres !== null) {
      etiquetas.push(el('span', { classe: 'etiqueta', texto: s.lugares_livres > 0 ? t('lugaresLivres', { n: s.lugares_livres }) : t('semLugares') }));
    }
    if (guardada) {
      etiquetas.push(el('span', { classe: 'etiqueta cheia', texto: guardada.estado === 'lista_espera' ? t('estadoEspera', { n: guardada.posicao || '?' }) : t('estadoConfirmada') }));
    }

    var cartao = el('article', { classe: 'sessao' + (marcada ? ' marcada' : '') }, [
      el('div', { classe: 'sessao-cabeca' }, [
        el('span', { classe: 'sessao-hora', texto: hora }),
        el('span', { classe: 'sessao-titulo', texto: s.titulo })
      ]),
      el('p', { classe: 'sessao-info' }, etiquetas.concat([el('span', { texto: info.join(' · ') })]))
    ]);

    if (inscricaoPossivel(s)) {
      var id = 's-' + s.id;
      var cx = el('input', { type: 'checkbox', id: id });
      cx.checked = marcada;
      var bloqueada = !editavel() || diaNao(s.dia);
      if (bloqueada) cx.disabled = true;
      cx.addEventListener('change', function () {
        var i = rasc.sessoes.indexOf(s.id);
        if (cx.checked && i < 0) rasc.sessoes.push(s.id);
        if (!cx.checked && i > -1) rasc.sessoes.splice(i, 1);
        redesenhar(id);
      });
      cartao.appendChild(el('label', { classe: 'opcao', 'for': id }, [cx, el('span', { texto: t('inscreverEm', { titulo: s.titulo }) })]));
      if (marcada && !guardada && s.lugares_livres !== null && s.lugares_livres <= 0) {
        cartao.appendChild(el('p', { classe: 'aviso-espera', texto: t('vaiEspera') }));
      }
    }

    var comConteudo = s.pecas.filter(function (x) { return textoSinopse(x) || urlSegura(x.url) || x.artistas; });
    if (comConteudo.length) {
      var detalhes = el('details', {}, [el('summary', { texto: t('verMais') })]);
      comConteudo.forEach(function (x) {
        var sinopse = textoSinopse(x);
        detalhes.appendChild(el('div', { classe: 'peca' }, [
          el('h4', { texto: x.titulo }),
          x.artistas ? el('p', { classe: 'peca-artistas', texto: x.artistas }) : null,
          x.estado === 'por_confirmar' ? el('p', {}, [el('span', { classe: 'etiqueta', texto: t('porConfirmar') })]) : null,
          sinopse ? el('p', { texto: sinopse }) : null,
          urlSegura(x.url) ? el('p', {}, [el('a', { href: x.url.trim(), target: '_blank', rel: 'noopener noreferrer', texto: t('paginaPeca') })]) : null
        ]));
      });
      cartao.appendChild(detalhes);
    }
    return cartao;
  }

  function textoSinopse(peca) {
    var principal = lang === 'pt' ? peca.sinopse_pt : peca.sinopse_en;
    var outra = lang === 'pt' ? peca.sinopse_en : peca.sinopse_pt;
    return String(principal || outra || '').trim();
  }

  function painelRefeicoes(painel) {
    painel.appendChild(el('h2', { texto: t('refeicoesTitulo') }));
    var refeicoes = dados.programa.refeicoes.filter(function (r) { return r.acesso; });
    if (!refeicoes.length) { painel.appendChild(el('p', { classe: 'suave', texto: t('semRefeicoes') })); return; }
    painel.appendChild(el('p', { classe: 'suave', texto: t('refeicoesNota') }));
    refeicoes.forEach(function (r) {
      var hora = r.fim ? r.inicio + ' – ' + r.fim : r.inicio;
      var nome = r.tipo === 'jantar' ? t('jantar') : t('almoco');
      var linha = [formatarDia(r.dia), hora, r.local].filter(String).join(' · ');
      var id = 'r-' + r.id;
      var cx = el('input', { type: 'checkbox', id: id });
      cx.checked = rasc.refeicoes.indexOf(r.id) > -1;
      if (!editavel() || diaNao(r.dia)) cx.disabled = true;
      cx.addEventListener('change', function () {
        var i = rasc.refeicoes.indexOf(r.id);
        if (cx.checked && i < 0) rasc.refeicoes.push(r.id);
        if (!cx.checked && i > -1) rasc.refeicoes.splice(i, 1);
        redesenhar(id);
      });
      var partes = [
        el('div', { classe: 'sessao-cabeca' }, [el('span', { classe: 'sessao-titulo', texto: nome })]),
        el('p', { classe: 'sessao-info', texto: linha })
      ];
      if (r.custo_pessoa) partes.push(el('p', { classe: 'sessao-info', texto: t('custo', { valor: r.custo_pessoa }) }));
      if (diaNao(r.dia)) partes.push(el('p', { classe: 'sessao-info', texto: t('diaNaoMarcado') }));
      partes.push(el('label', { classe: 'opcao', 'for': id }, [cx, el('span', { texto: t('refeicaoEscolher', { titulo: nome + ' – ' + formatarDia(r.dia) }) })]));
      painel.appendChild(el('article', { classe: 'sessao' + (cx.checked ? ' marcada' : '') }, partes));
    });
    painel.appendChild(campoTexto('f-restr', t('restricoes'), 'restricoes', { multilinha: true, max: 300 }));
  }

  function listaResumo(titulo, itens) {
    var ul = el('ul', { classe: 'lista-resumo' });
    if (!itens.length) ul.appendChild(el('li', { classe: 'suave', texto: t('resumoNenhuma') }));
    itens.forEach(function (i) { ul.appendChild(el('li', { texto: i })); });
    return el('div', {}, [el('h3', { texto: titulo }), ul]);
  }

  function painelResumo(painel) {
    painel.appendChild(el('h2', { texto: t('resumoTitulo') }));
    var dias = ['dia_10', 'dia_11', 'dia_12'].map(function (k, i) {
      var v = rasc.dias[k];
      return formatarDia('2026-12-' + (10 + i)) + ': ' + (v === 'sim' ? t('sim') : v === 'nao' ? t('nao') : t('porDefinir'));
    });
    painel.appendChild(listaResumo(t('resumoDias'), dias));

    var sessoes = rasc.sessoes.map(function (id) {
      var s = sessaoPorId(id);
      if (!s) return null;
      var g = estadoGuardado(id);
      var cheia = !g && s.lugares_livres !== null && s.lugares_livres <= 0;
      var estado = g ? (g.estado === 'lista_espera' ? t('estadoEspera', { n: g.posicao || '?' }) : t('estadoConfirmada'))
        : (cheia ? t('pedidoEspera') : t('pedidoLugar'));
      return formatarDia(s.dia) + ' · ' + s.inicio + ' · ' + s.titulo + ' — ' + estado;
    }).filter(Boolean);
    painel.appendChild(listaResumo(t('resumoSessoes'), sessoes));

    var refs = rasc.refeicoes.map(function (id) {
      var r = refeicaoPorId(id);
      return r ? (r.tipo === 'jantar' ? t('jantar') : t('almoco')) + ' · ' + formatarDia(r.dia) : null;
    }).filter(Boolean);
    if (dados.programa.refeicoes.some(function (r) { return r.acesso; })) painel.appendChild(listaResumo(t('resumoRefeicoes'), refs));

    if (dados.janela.estado !== 'aberta') {
      painel.appendChild(el('p', { classe: 'suave', texto: t('consultaApenas') }));
      return;
    }

    var cx = el('input', { type: 'checkbox', id: 'f-rgpd' });
    cx.checked = rasc.rgpd;
    cx.disabled = aGuardar;
    cx.addEventListener('change', function () { rasc.rgpd = cx.checked; });
    var texto = el('span', { texto: t('rgpd') + ' ' });
    var rotulo = el('label', { classe: 'opcao', 'for': 'f-rgpd' }, [cx, texto]);
    var url = dados.config && dados.config.url_privacidade;
    if (urlSegura(url)) texto.appendChild(el('a', { href: url.trim(), target: '_blank', rel: 'noopener noreferrer', texto: t('politica') }));
    painel.appendChild(el('div', { classe: 'cartao' }, [rotulo]));

    var estado = el('p', { id: 'estado-guardar', role: 'status', 'aria-live': 'polite', classe: 'suave',
      texto: inscrito() ? (alterado() ? t('alteracoesPorGuardar') : t('semAlteracoes')) : '' });
    var botao = el('button', { type: 'button', classe: 'botao', id: 'botao-guardar', texto: aGuardar ? t('aGuardar') : (inscrito() ? t('guardarAlt') : t('confirmar')) });
    if (aGuardar) botao.disabled = true;
    botao.addEventListener('click', guardar);
    var acoes = el('div', { classe: 'acoes' }, [botao]);
    if (inscrito()) {
      var cancelar = el('button', { type: 'button', classe: 'botao-texto', texto: t('cancelarInsc') });
      if (aGuardar) cancelar.disabled = true;
      cancelar.addEventListener('click', cancelarInscricao);
      acoes.appendChild(cancelar);
    }
    painel.appendChild(estado);
    painel.appendChild(acoes);
  }

  function mensagemErro(r) {
    var erros = t('erros');
    return (r && erros[r.erro]) || erros.interno;
  }

  async function guardar() {
    mensagem = null;
    if (!String(rasc.nome || '').trim()) { mensagem = { tipo: 'erro', texto: t('faltaNome') }; separador = 'presenca'; desenhar(); window.scrollTo(0, 0); return; }
    if (!rasc.rgpd) { mensagem = { tipo: 'erro', texto: t('faltaRgpd') }; desenhar(); window.scrollTo(0, 0); return; }
    aGuardar = true;
    desenhar();
    var carga = {
      nome: rasc.nome, telefone: rasc.telefone, funcao: rasc.funcao, instituicao: rasc.instituicao,
      necessidades_especificas: rasc.necessidades, restricoes_alimentares: rasc.restricoes, mensagem: rasc.mensagem,
      peca_declarada: rasc.peca_declarada, idioma: lang, rgpd: true, dias: rasc.dias,
      sessoes: rasc.sessoes, refeicoes: rasc.refeicoes
    };
    try {
      var r = await window.futuraApi.guardar(token, carga);
      aGuardar = false;
      if (r && r.ok) {
        var espera = (r.adicionadas || []).filter(function (x) { return x.estado === 'lista_espera'; }).length;
        await recarregar();
        var texto = t('guardadoOk');
        if (espera) texto += ' ' + t('emEsperaAviso', { n: espera });
        mensagem = { tipo: 'ok', texto: texto };
        separador = 'resumo';
        desenhar();
      } else {
        mensagem = { tipo: 'erro', texto: mensagemErro(r) };
        if (r && (r.erro === 'link_invalido')) { token = null; dados = null; rasc = null; desenhar(t('linkInvalido')); return; }
        desenhar();
      }
    } catch (e) {
      aGuardar = false;
      mensagem = { tipo: 'erro', texto: t('erroGeral') };
      desenhar();
    }
    window.scrollTo(0, 0);
  }

  async function cancelarInscricao() {
    if (!window.confirm(t('confirmarCancelar'))) return;
    aGuardar = true;
    mensagem = null;
    desenhar();
    try {
      var r = await window.futuraApi.cancelar(token);
      aGuardar = false;
      if (r && r.ok) {
        await recarregar();
        mensagem = { tipo: 'ok', texto: t('canceladoOk') };
        separador = 'presenca';
      } else {
        mensagem = { tipo: 'erro', texto: mensagemErro(r) };
      }
    } catch (e) {
      aGuardar = false;
      mensagem = { tipo: 'erro', texto: t('erroGeral') };
    }
    desenhar();
    window.scrollTo(0, 0);
  }

  // Volta a ler tudo do servidor (lugares livres e estados atualizados) e refaz o rascunho.
  async function recarregar() {
    var r = await window.futuraApi.carregar(token);
    if (r && r.ok) { dados = r; iniciarRascunho(); }
  }

  iniciar();
})();
