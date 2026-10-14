(function () {
  'use strict';

  var DB = 'https://unsheltered-72d40-default-rtdb.firebaseio.com';
  var rota = window.location.pathname.match(/^\/u(\d+)/);
  if (!rota) return;
  var uid = 'u' + rota[1];

  var CAMPOS_TEXTO = { casa: 1, especie: 2, sangue: 3, patrono: 4, habilidade: 5, maldicao: 6, emprego: 7 };

  function limpar(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().replace(/\.+$/, '').trim();
  }
  function numero(t) {
    var m = String(t == null ? '' : t).match(/-?\d+(?:[.,]\d+)?/);
    return m ? Number(m[0].replace(',', '.')) : null;
  }
  function valorCampo(id) {
    var dl = document.getElementById('field_id' + id);
    if (!dl) return undefined;
    return dl.querySelector('.field_uneditable') || null;
  }
  function textoCampo(id) {
    var el = valorCampo(id);
    if (el === undefined) return undefined;
    return limpar(el ? el.textContent : '');
  }
  function igual(a, b) {
    function norm(v) {
      if (v && typeof v === 'object') {
        var o = {};
        Object.keys(v).sort().forEach(function (k) { o[k] = norm(v[k]); });
        return o;
      }
      return v === undefined ? null : v;
    }
    return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  }
  function barraDe(el) {
    var pai = el && el.parentElement;
    var dica = pai && pai.querySelector('.xp-bar-tooltip');
    return dica ? limpar(dica.textContent) : '';
  }

  function ler() {
    var d = {};

    Object.keys(CAMPOS_TEXTO).forEach(function (chave) {
      var v = textoCampo(CAMPOS_TEXTO[chave]);
      if (v !== undefined) d[chave] = v;
    });

    var idade = textoCampo(20);
    if (idade !== undefined) d.idade = numero(idade);

    var varinha = valorCampo(14);
    if (varinha !== undefined) {
      var img = varinha && varinha.querySelector('img');
      d.varinha = {
        texto: limpar(varinha ? varinha.textContent : ''),
        imagem: img ? img.getAttribute('src') || '' : ''
      };
    }

    var rep = textoCampo(25);
    if (rep !== undefined) {
      var r = rep.match(/^(.*?)\s*\[\s*\+?(\d+)\s*\/\s*-?(\d+)\s*\]/);
      if (r) {
        d.reputacao = limpar(r[1]);
        d.reputacao_pos = Number(r[2]);
        d.reputacao_neg = Number(r[3]);
      } else {
        d.reputacao = rep;
      }
    }

    var nivel = document.getElementById('rpg-nível');
    if (nivel) { d.nivel = numero(nivel.textContent); d.nivel_xp = barraDe(nivel); }

    var magia = document.getElementById('rpg-reserva-de-magia');
    if (magia) { d.magia = numero(magia.textContent); d.magia_xp = barraDe(magia); }

    var fama = document.getElementById('rpg-fama');
    if (fama) {
      d.fama = limpar(fama.textContent);
      var famaXp = document.getElementById('rpg-fama-xp');
      d.fama_xp = famaXp ? limpar(famaXp.textContent).replace(/^\(|\)$/g, '') : '';
    }

    var imagem = valorCampo(12);
    if (imagem !== undefined) {
      var im = imagem && imagem.querySelector('img');
      d.imagem = {
        url: im ? im.getAttribute('src') || '' : '',
        texto: im ? (im.getAttribute('alt') || '').replace(/\s+/g, ' ').trim() : ''
      };
    }

    var rank = document.querySelector('.pfrank0');
    if (rank) d.rank = limpar(rank.textContent);

    var mascote = document.getElementById('rpg-mascote');
    if (mascote) d.mascote = limpar(mascote.textContent);

    return d;
  }

  function iniciar() {
    var novo = ler();
    if (!Object.keys(novo).length) return;
    var url = DB + '/perfil/' + uid + '.json';
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (atual) {
        atual = atual || {};
        var mudou = {};
        Object.keys(novo).forEach(function (k) {
          if (!igual(atual[k], novo[k])) mudou[k] = novo[k];
        });
        if (!Object.keys(mudou).length) return;
        mudou.atualizado_em = { '.sv': 'timestamp' };
        return fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mudou)
        });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
